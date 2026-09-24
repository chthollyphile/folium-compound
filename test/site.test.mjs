// test/site.test.mjs
// The market site build: zips are deterministic, round-trip byte for byte and
// still verify after extraction; the page escapes third-party text; and a
// repository with an unverified mod is never published.
//
// Uses the test-only "folium-test-vector" key (see signing.test.mjs).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SIGNATURE_FILE, signMod } from '../tools/lib/signing.mjs';
import { REPO_ROOT } from '../tools/lib/repo.mjs';
import { createZip, crc32, readZip } from '../tools/lib/zip.mjs';
import { buildSite } from '../tools/site/build.mjs';
import { escapeHtml } from '../tools/site/render.mjs';
import { makePng } from './fixtures.mjs';

const TEST_PUBLIC = { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE' };
const TEST_PRIVATE = { ...TEST_PUBLIC, d: 'CmEPWKhK8Rtwoh4xPYIMdKzUh34cc1pJhKqPFaOCWJI' };

const tempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test('crc32 matches the standard check value', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('zips are deterministic, UTF-8 flagged and round-trip exactly', () => {
    const entries = [
        { name: 'mod/mod.json', data: Buffer.from('{"id":"mod"}\n') },
        { name: 'mod/lib/café.mjs', data: Buffer.from('export const x = 1;\n'.repeat(50)) },
        { name: 'mod/crlf.txt', data: Buffer.from('a\r\nb\r\n') },
        { name: 'mod/empty.txt', data: Buffer.alloc(0) },
    ];
    const first = createZip(entries);
    assert.deepEqual(createZip(entries), first);
    assert.equal(first.readUInt16LE(6) & 0x0800, 0x0800);
    assert.deepEqual(readZip(first).map(({ name, data }) => [name, data.toString('hex')]), entries.map(({ name, data }) => [name, data.toString('hex')]));
    assert.throws(() => createZip([{ name: '../evil', data: Buffer.alloc(1) }]), /unsafe/);
});

/* A minimal repository: trusted test key, one signed community mod with hostile text. */
const siteRepo = ({ sign = true } = {}) => {
    const root = tempDir('folium-site-');
    fs.mkdirSync(path.join(root, 'keys'));
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: [{ keyId: 'folium-test-vector', label: 'Test key', publicKey: TEST_PUBLIC, revoked: false }] }));
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [] }));
    fs.cpSync(path.join(REPO_ROOT, 'site'), path.join(root, 'site'), { recursive: true });
    const modDir = path.join(root, 'mods', 'community', 'evil-mod');
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'mod.json'), JSON.stringify({
        folium: 1, id: 'evil-mod', name: '<img src=x onerror=alert(1)>', version: '1.2.3', client: 'client.mjs', preview: 'preview.png',
        author: '"quoted" & <b>', description: '</p><script>alert(1)</script>', permissions: ['net.fetch'],
    }));
    fs.writeFileSync(path.join(modDir, 'client.mjs'), 'export default function activate(folium) {}\n');
    fs.writeFileSync(path.join(modDir, 'preview.png'), makePng(1280, 720));
    fs.writeFileSync(path.join(modDir, '.DS_Store'), 'junk');
    fs.writeFileSync(path.join(root, 'community.json'), JSON.stringify({ mods: { 'evil-mod': { owners: ['dev'], source: 'javascript:alert(1)' } } }));
    if (sign) {
        const record = signMod(modDir, { keyId: 'folium-test-vector', privateJwk: TEST_PRIVATE });
        fs.writeFileSync(path.join(modDir, SIGNATURE_FILE), JSON.stringify(record));
    }
    return root;
};

test('the build publishes verified zips, a catalog and an escaped page', () => {
    const root = siteRepo();
    const outDir = path.join(root, 'dist');
    const catalog = buildSite({ root, outDir, commit: 'abc1234def' });

    assert.equal(catalog.mods.length, 1);
    const [mod] = catalog.mods;
    assert.equal(mod.download.url, '/downloads/evil-mod-1.2.3.zip');
    assert.deepEqual(mod.permissions, ['net.fetch']);
    assert.equal(mod.keyLabel, 'Test key');

    const archive = fs.readFileSync(path.join(outDir, 'downloads', 'evil-mod-1.2.3.zip'));
    assert.equal(archive.length, mod.download.size);
    const names = readZip(archive).map((entry) => entry.name);
    assert.deepEqual(names, ['evil-mod/client.mjs', 'evil-mod/mod.json', 'evil-mod/preview.png', 'evil-mod/folium.sig.json']);
    assert.deepEqual(mod.preview, { url: '/previews/evil-mod-1.2.3.png', width: 1280, height: 720 });
    assert.ok(fs.existsSync(path.join(outDir, 'previews', 'evil-mod-1.2.3.png')));

    // Same input, same bytes: a rebuild never changes a download.
    buildSite({ root, outDir: path.join(root, 'dist2'), commit: 'abc1234def' });
    assert.deepEqual(fs.readFileSync(path.join(root, 'dist2', 'downloads', 'evil-mod-1.2.3.zip')), archive);

    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('<img src="/previews/evil-mod-1.2.3.png" width="1280" height="720"'));
    assert.ok(html.includes(escapeHtml('</p><script>alert(1)</script>')));
    assert.ok(!html.includes('javascript:'), 'non-https source links are dropped');
    assert.ok(!/<script>(?!<)/.test(html.replace('<script src="/assets/app.js" defer></script>', '')), 'no inline script');
    assert.ok(fs.existsSync(path.join(outDir, 'assets', 'app.js')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'catalog.json'), 'utf8')).commit, 'abc1234def');
});

test('an unverified repository is not published', () => {
    const root = siteRepo({ sign: false });
    assert.throws(() => buildSite({ root, outDir: path.join(root, 'dist') }), /does not verify/);
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
