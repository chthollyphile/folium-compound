// test/site.test.mjs
// The market site build: zips are deterministic, round-trip byte for byte and
// still verify after extraction; the page escapes third-party text; every mod,
// beta and awesome-Folia entry sits in one waterfall; and a repository with an
// unverified mod (or an awesome entry with a bad link) is never published.
//
// Uses the test-only "folium-test-vector" key (see signing.test.mjs).

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SIGNATURE_FILE, signMod } from '../tools/lib/signing.mjs';
import { REPO_ROOT } from '../tools/lib/repo.mjs';
import { createZip, crc32, readZip } from '../tools/lib/zip.mjs';
import { buildSite } from '../tools/site/build.mjs';
import { escapeHtml, feedbackUrlOf } from '../tools/site/render.mjs';
import { makePng } from './fixtures.mjs';

const TEST_PUBLIC = { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE' };
const TEST_PRIVATE = { ...TEST_PUBLIC, d: 'CmEPWKhK8Rtwoh4xPYIMdKzUh34cc1pJhKqPFaOCWJI' };
const RELEASE_KEY = { keyId: 'folium-test-vector', privateJwk: TEST_PRIVATE };

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

/* Writes and signs mods/<origin>/<id> with `manifest` (plus a client and a preview image). */
const writeMod = (root, origin, manifest, { key = RELEASE_KEY, files = {}, sign = true } = {}) => {
    const modDir = path.join(root, 'mods', origin, manifest.id);
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'mod.json'), JSON.stringify({ client: 'client.mjs', preview: 'preview.png', ...manifest }));
    fs.writeFileSync(path.join(modDir, 'client.mjs'), 'export default function activate(folium) {}\n');
    fs.writeFileSync(path.join(modDir, 'preview.png'), makePng(1280, 720));
    for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(modDir, name), data);
    if (sign) fs.writeFileSync(path.join(modDir, SIGNATURE_FILE), JSON.stringify(signMod(modDir, key)));
    return modDir;
};

/*
 * A minimal repository: trusted test key, one signed community mod with hostile text, a README and a
 * GitLab repository. `community` is merged into its community.json entry.
 */
const siteRepo = ({ sign = true, community = {} } = {}) => {
    const root = tempDir('folium-site-');
    fs.mkdirSync(path.join(root, 'keys'));
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: [{ keyId: 'folium-test-vector', label: 'Test key', publicKey: TEST_PUBLIC, revoked: false }] }));
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [] }));
    fs.cpSync(path.join(REPO_ROOT, 'site'), path.join(root, 'site'), { recursive: true });
    writeMod(root, 'community', {
        folium: 1, id: 'evil-mod', name: '<img src=x onerror=alert(1)>', version: '1.2.3',
        author: '"quoted" & <b>', description: '</p><script>alert(1)</script>', permissions: ['net.fetch'],
        repository: 'https://gitlab.com/dev/evil-mod.git', license: 'MIT',
    }, { sign, files: { '.DS_Store': 'junk', 'README.md': '# Evil mod\n\n<script>alert(1)</script>\n' } });
    fs.writeFileSync(path.join(root, 'community.json'), JSON.stringify({
        mods: { 'evil-mod': { owners: ['dev'], source: 'javascript:alert(1)', category: 'lyrics', addedAt: '2026-10-01', updatedAt: '2026-11-02', ...community } },
    }));
    return root;
};

/* The markup of one `<dialog id="…">`. */
const dialogOf = (html, id) => {
    const start = html.indexOf(`<dialog class="detail" id="${id}"`);
    assert.ok(start >= 0, `a dialog ${id}`);
    return html.slice(start, html.indexOf('</dialog>', start) + '</dialog>'.length);
};

/* The markup of the card whose detail is `#id`. */
const cardOf = (html, id) => {
    const link = html.indexOf(`<h2><a href="#${id}">`);
    assert.ok(link >= 0, `a card for ${id}`);
    const start = html.lastIndexOf('<article', link);
    return html.slice(start, html.indexOf('</article>', link) + '</article>'.length);
};

const gridOf = (html) => html.slice(html.indexOf('data-grid>'), html.indexOf('data-empty hidden'));

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
    assert.deepEqual([...names].sort(), ['evil-mod/README.md', 'evil-mod/client.mjs', 'evil-mod/folium.sig.json', 'evil-mod/mod.json', 'evil-mod/preview.png']);
    assert.equal(names.at(-1), 'evil-mod/folium.sig.json');
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
    assert.ok(!/\sstyle=/.test(html), 'no inline style attributes');
    // Each card links to its detail dialog, which carries the full description and the owners.
    assert.ok(html.includes('<a href="#mod-evil-mod">'));
    const dialog = dialogOf(html, 'mod-evil-mod');
    assert.ok(dialog.includes(`<p class="detail-description">${escapeHtml('</p><script>alert(1)</script>')}</p>`));
    assert.ok(dialog.includes('<a href="https://github.com/dev" rel="noopener noreferrer nofollow" target="_blank">@dev</a>'));
    assert.ok(dialog.includes('data-copy="' + mod.download.sha256 + '"'));
    assert.ok(dialog.includes('data-i18n="detail.hint">模组的问题请向作者反馈'));
    assert.ok(dialog.includes('<a href="/readmes/evil-mod-1.2.3.md" target="_blank" rel="noopener">'), 'the readme is linked, not rendered');
    assert.ok(dialog.includes('MIT'));
    assert.ok(!/<script>(?!<)/.test(html.replace('<script src="/assets/app.js" defer></script>', '')), 'no inline script');
    assert.ok(fs.existsSync(path.join(outDir, 'assets', 'app.js')));
    assert.match(fs.readFileSync(path.join(outDir, '_headers'), 'utf8'), /Content-Security-Policy: default-src 'self'/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'catalog.json'), 'utf8')).commit, 'abc1234def');
});

test('catalog.json is version 3 with categories, awesome entries and per-mod metadata', () => {
    const root = siteRepo();
    const outDir = path.join(root, 'dist');
    buildSite({ root, outDir });
    const catalog = JSON.parse(fs.readFileSync(path.join(outDir, 'catalog.json'), 'utf8'));
    assert.equal(catalog.version, 3);
    assert.ok(Array.isArray(catalog.categories) && catalog.categories.some((category) => category.id === 'lyrics' && category.label.en));
    assert.deepEqual(catalog.awesome, []);
    const [mod] = catalog.mods;
    assert.equal(mod.category, 'lyrics');
    assert.deepEqual(mod.tags, ['network']);
    assert.deepEqual(mod.owners, [{ login: 'dev', url: 'https://github.com/dev' }]);
    assert.equal(mod.repository, 'https://gitlab.com/dev/evil-mod.git');
    assert.equal(mod.license, 'MIT');
    assert.equal(mod.updatedAt, '2026-11-02');
    assert.equal(mod.readme, '/readmes/evil-mod-1.2.3.md');
    assert.equal(fs.readFileSync(path.join(outDir, 'readmes', 'evil-mod-1.2.3.md'), 'utf8'), '# Evil mod\n\n<script>alert(1)</script>\n');
});

/* Adds mods/beta/<id> to a siteRepo, signed with `privateJwk` under `keyId`, and trusts a beta key. */
const BETA_PAIR = crypto.generateKeyPairSync('ed25519');
const BETA_KEY = { keyId: 'folium-test-beta', privateJwk: BETA_PAIR.privateKey.export({ format: 'jwk' }) };
const addBetaMod = (root, { key = BETA_KEY } = {}) => {
    const keysFile = path.join(root, 'keys', 'trusted-keys.json');
    const trusted = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
    trusted.keys.push({ keyId: BETA_KEY.keyId, label: 'Test beta', channel: 'beta', publicKey: BETA_PAIR.publicKey.export({ format: 'jwk' }), revoked: false });
    fs.writeFileSync(keysFile, JSON.stringify(trusted));
    writeMod(root, 'beta', {
        folium: 1, id: 'wild-idea', name: 'Wild idea', version: '0.1.0',
        repository: 'https://github.com/dev/wild-idea', bugs: 'https://example.org/wild-idea/bugs',
    }, { key });
};

/* Adds an official mod, whose `bugs` must not win over this repository's issues. */
const addOfficialMod = (root) => {
    writeMod(root, 'official', { folium: 1, id: 'tidy-official', name: 'Tidy', version: '1.0.0', bugs: 'https://example.org/not-here', permissions: ['stageLayers'] });
    fs.writeFileSync(path.join(root, 'official-meta.json'), JSON.stringify({ mods: { 'tidy-official': { category: 'visualizer' } } }));
};

test('beta mods sit in the one waterfall with a badge, never as verified', () => {
    const root = siteRepo();
    addBetaMod(root);
    const outDir = path.join(root, 'dist');
    const catalog = buildSite({ root, outDir });
    assert.deepEqual(catalog.mods.map((mod) => [mod.id, mod.origin, mod.channel]), [['evil-mod', 'community', 'release'], ['wild-idea', 'beta', 'beta']]);
    assert.equal(catalog.version, 3);

    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.ok(!html.includes('data-beta-zone'), 'no separate beta section');
    const grid = gridOf(html);
    assert.ok(grid.includes('#mod-evil-mod') && grid.includes('#mod-wild-idea'), 'the main grid holds beta mods too');
    const card = cardOf(html, 'mod-wild-idea');
    assert.match(card, /data-origin="beta"/);
    assert.match(card, /<span class="corner-badge corner-beta">.*?先行测试/);
    assert.ok(!card.includes('class="beta-note"'), 'the beta warning is not on the card');
    assert.match(card, /data-order="1"/);
    assert.match(html, /data-source="beta" aria-pressed="false">.*?<span class="n">1<\/span>/);
    assert.match(html, /data-category="" aria-pressed="true">.*?<span class="n">2<\/span>/);

    const dialog = dialogOf(html, 'mod-wild-idea');
    assert.match(dialog, /<p class="beta-note">.*?<span data-i18n="beta.note">[^<。]*。<\/span><\/p>/, 'one short sentence');
    assert.ok(dialog.includes('download-beta'));
    assert.ok(!dialog.includes('data-i18n-title="signed.title"'), 'a beta mod is never labelled as verified');
    // Feedback: `bugs` wins over the repository's issues.
    assert.ok(dialog.includes('href="https://example.org/wild-idea/bugs"'));
    assert.ok(!dialog.includes('https://github.com/dev/wild-idea/issues'));
    assert.ok(dialog.includes('href="https://github.com/dev/wild-idea"'));
});

test('feedback links: bugs, else the repository issues, else the repository; official mods report here', () => {
    assert.equal(feedbackUrlOf({ bugs: 'https://example.org/bugs', repository: 'https://github.com/a/b' }), 'https://example.org/bugs');
    assert.equal(feedbackUrlOf({ repository: 'https://github.com/a/b' }), 'https://github.com/a/b/issues');
    assert.equal(feedbackUrlOf({ repository: 'https://github.com/a/b.git' }), 'https://github.com/a/b/issues');
    assert.equal(feedbackUrlOf({ repository: 'https://codeberg.org/a/b/' }), 'https://codeberg.org/a/b/issues');
    assert.equal(feedbackUrlOf({ repository: 'https://gitlab.com/a/b.git' }), 'https://gitlab.com/a/b/-/issues');
    assert.equal(feedbackUrlOf({ repository: 'https://github.com/a/b/tree/main/mod' }), 'https://github.com/a/b/tree/main/mod');
    assert.equal(feedbackUrlOf({ repository: 'https://git.example.org/a/b' }), 'https://git.example.org/a/b');
    assert.equal(feedbackUrlOf({ bugs: 'javascript:alert(1)', repository: 'http://github.com/a/b' }), null);
    assert.equal(feedbackUrlOf({ official: true, bugs: 'https://example.org/bugs' }), 'https://github.com/chthollyphile/folium-compound/issues');

    const root = siteRepo();
    addOfficialMod(root);
    const outDir = path.join(root, 'dist');
    buildSite({ root, outDir });
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.ok(dialogOf(html, 'mod-evil-mod').includes('href="https://gitlab.com/dev/evil-mod/-/issues"'));
    const official = dialogOf(html, 'mod-tidy-official');
    assert.ok(official.includes('href="https://github.com/chthollyphile/folium-compound/issues"'));
    assert.ok(!official.includes('example.org/not-here'));
    assert.ok(official.includes('data-permission-text="stageLayers">在播放页上绘制图层'));
});

test('category chips count every card and hide empty categories', () => {
    const root = siteRepo();
    addOfficialMod(root);
    addBetaMod(root);
    fs.writeFileSync(path.join(root, 'awesome.json'), JSON.stringify({ entries: [
        { id: 'far-lyrics', name: 'Far lyrics', kind: 'tool', category: 'lyrics', description: 'Elsewhere.', url: 'https://github.com/dev/far-lyrics', owners: ['dev'], addedAt: '2026-11-01', updatedAt: '2026-11-03' },
    ] }));
    const outDir = path.join(root, 'dist');
    buildSite({ root, outDir });
    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    const chips = html.slice(html.indexOf('<div class="chip-row"'), html.indexOf('<div class="toolbar-row">'));
    const count = (id) => new RegExp(`data-category="${id}" aria-pressed="false"><span data-en="[^"]*">[^<]*</span> <span class="n">(\\d+)</span>`).exec(chips)?.[1];
    assert.equal(count('lyrics'), '2', 'a mod and an awesome entry');
    assert.equal(count('visualizer'), '1');
    assert.equal(count('other'), '1', 'the beta mod has no category registered');
    assert.equal(count('ai'), undefined, 'empty categories are hidden');
    assert.match(chips, /data-category="" aria-pressed="true">.*?<span class="n">4<\/span>/);
    // Categories keep the table's order.
    assert.ok(chips.indexOf('data-category="visualizer"') < chips.indexOf('data-category="lyrics"'));
    assert.ok(chips.indexOf('data-category="lyrics"') < chips.indexOf('data-category="other"'));
    // Tag chips list only tags that appear.
    assert.ok(html.includes('data-tag="network"') && html.includes('data-tag="stage"'));
    assert.ok(!html.includes('data-tag="equalizer"'));
});

test('awesome-Folia entries are escaped link cards with a detail dialog', () => {
    const root = siteRepo();
    fs.writeFileSync(path.join(root, 'awesome.json'), JSON.stringify({ entries: [{
        id: 'far-away', name: '<img src=y onerror=alert(2)>', kind: 'source', description: '"><script>alert(2)</script>',
        url: 'https://github.com/dev2/far-away.git', homepage: 'https://far.example.org/', owners: ['dev2'], tags: ['<b>lx</b>'],
        addedAt: '2026-11-01', updatedAt: '2026-11-20',
    }] }));
    const outDir = path.join(root, 'dist');
    const catalog = buildSite({ root, outDir });
    assert.deepEqual(catalog.awesome.map((entry) => [entry.id, entry.owners]), [['far-away', [{ login: 'dev2', url: 'https://github.com/dev2' }]]]);

    const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
    assert.ok(!html.includes('<img src=y') && !html.includes('<script>alert(2)') && !html.includes('<b>lx</b>'));
    const card = cardOf(html, 'awesome-far-away');
    assert.ok(gridOf(html).includes(card), 'awesome cards share the waterfall');
    assert.match(card, /data-origin="awesome"/);
    assert.match(card, /data-order="1"/, 'after the mods');
    assert.ok(card.includes(escapeHtml('<img src=y onerror=alert(2)>')));
    assert.ok(card.includes('data-i18n="badge.external">外部链接'));
    assert.ok(card.includes('<span data-en="Source mod">音源模组</span>'));
    assert.ok(card.includes('<a class="download download-external" href="https://github.com/dev2/far-away.git" rel="noopener noreferrer nofollow" target="_blank">'));
    assert.ok(!card.includes('<img'), 'a letter avatar, no preview image');
    assert.ok(!card.includes('download='), 'nothing to download');
    assert.match(html, /data-source="awesome" aria-pressed="false">awesome-Folia <span class="n">1<\/span>/);

    const dialog = dialogOf(html, 'awesome-far-away');
    assert.ok(dialog.includes(`<p class="detail-description">${escapeHtml('"><script>alert(2)</script>')}</p>`));
    assert.ok(dialog.includes('href="https://github.com/dev2/far-away/issues"'), 'feedback derived from the url');
    assert.ok(dialog.includes('href="https://far.example.org/"'));
    assert.ok(dialog.includes('<a href="https://github.com/dev2" rel="noopener noreferrer nofollow" target="_blank">@dev2</a>'));
    assert.ok(dialog.includes('data-i18n="awesome.note"'));
    assert.ok(!dialog.includes('data-i18n-title="signed.title"'));
});

test('an awesome entry whose link is not https is not published', () => {
    const root = siteRepo();
    fs.writeFileSync(path.join(root, 'awesome.json'), JSON.stringify({ entries: [{
        id: 'sneaky', name: 'Sneaky', kind: 'tool', description: 'x', url: 'javascript:alert(1)', owners: ['dev'], addedAt: '2026-11-01', updatedAt: '2026-11-01',
    }] }));
    assert.throws(() => buildSite({ root, outDir: path.join(root, 'dist') }), /awesome\.json does not check/);
});

test('a beta directory signed with a release key is not published', () => {
    const root = siteRepo();
    addBetaMod(root, { key: RELEASE_KEY });
    assert.throws(() => buildSite({ root, outDir: path.join(root, 'dist') }), /mods\/beta\/wild-idea: invalid \(wrong-channel\)/);
});

test('an unverified repository is not published', () => {
    const root = siteRepo({ sign: false });
    assert.throws(() => buildSite({ root, outDir: path.join(root, 'dist') }), /does not verify/);
    assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});
