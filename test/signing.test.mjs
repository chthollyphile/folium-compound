// test/signing.test.mjs
// Pins the signature format. The vector below is shared with the Folia host
// (test/unit/mod-system/modSignature.test.ts): if either side changes the
// signed digest or the signed message, one of the two suites fails.
//
// The key here is a test-only key ("folium-test-vector"). It is in no trusted
// key list and verifies nothing outside these tests.

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    SIGNATURE_FILE,
    buildSignedMessage,
    computeSignedDigest,
    parseSignatureRecord,
    signMod,
    verifyMod,
} from '../tools/lib/signing.mjs';

const VECTOR_DIGEST = 'sha256:954b2e8f88ba256336eebe96506da418cdd089553b1cc3f1e460dcf467d373eb';
const TEST_KEY = {
    keyId: 'folium-test-vector',
    publicKey: { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE' },
    privateKey: { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE', d: 'CmEPWKhK8Rtwoh4xPYIMdKzUh34cc1pJhKqPFaOCWJI' },
};
const VECTOR_FIELDS = {
    modId: 'vector',
    modVersion: '1.0.0',
    digest: VECTOR_DIGEST,
    keyId: 'folium-test-vector',
    signedAt: '2026-01-01T00:00:00.000Z',
};
const VECTOR_SIGNATURE = 'PoZgJ8TJCS17TyAV2UizP6m7JZSt8KeCzB9TPXgYwffq3w9kT5PvJPu3S0sUF1tviFA4fA4LphBDzu00K9VcAA==';
const KEYS = [{ keyId: TEST_KEY.keyId, publicKey: TEST_KEY.publicKey, revoked: false }];

/*
 * The vector tree: code-unit order (B before a), CRLF bytes kept as is, an NFD
 * file name that must hash as NFC, and files the digest skips (OS clutter and
 * the signature file itself).
 */
const writeVectorTree = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-vector-'));
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.writeFileSync(path.join(dir, 'mod.json'), '{"folium":1,"id":"vector","name":"Vector","version":"1.0.0","client":"client.mjs"}\n');
    fs.writeFileSync(path.join(dir, 'client.mjs'), 'export default function activate() {}\n');
    fs.writeFileSync(path.join(dir, 'B.txt'), 'upper\n');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'lower\n');
    fs.writeFileSync(path.join(dir, 'lib', 'crlf.txt'), 'crlf\r\nline\r\n');
    fs.writeFileSync(path.join(dir, 'lib', 'café.mjs'), 'nfd\n');
    fs.writeFileSync(path.join(dir, '.DS_Store'), 'junk');
    fs.writeFileSync(path.join(dir, 'lib', 'Thumbs.db'), 'junk');
    fs.writeFileSync(path.join(dir, SIGNATURE_FILE), '{}');
    return dir;
};

const signInPlace = (dir, key = TEST_KEY) => {
    const record = signMod(dir, { keyId: key.keyId, privateJwk: key.privateKey, signedAt: VECTOR_FIELDS.signedAt });
    fs.writeFileSync(path.join(dir, SIGNATURE_FILE), `${JSON.stringify(record, null, 2)}\n`);
    return record;
};

test('signed digest matches the shared vector', () => {
    const { digest, lines } = computeSignedDigest(writeVectorTree());
    assert.equal(digest, VECTOR_DIGEST);
    assert.deepEqual(lines.map((line) => line.slice(65, -1)), ['B.txt', 'a.txt', 'client.mjs', 'lib/café.mjs', 'lib/crlf.txt', 'mod.json']);
});

test('signed message and signature match the shared vector', () => {
    const message = buildSignedMessage(VECTOR_FIELDS).toString('utf8');
    assert.equal(message, [
        'folium-signature/1',
        'modId=vector',
        'modVersion=1.0.0',
        `digest=${VECTOR_DIGEST}`,
        'keyId=folium-test-vector',
        'signedAt=2026-01-01T00:00:00.000Z',
        '',
    ].join('\n'));
    const privateKey = crypto.createPrivateKey({ key: TEST_KEY.privateKey, format: 'jwk' });
    // Ed25519 is deterministic, so the same key and message always give this signature.
    assert.equal(crypto.sign(null, buildSignedMessage(VECTOR_FIELDS), privateKey).toString('base64'), VECTOR_SIGNATURE);
});

test('a freshly signed tree verifies, and OS clutter added later does not break it', () => {
    const dir = writeVectorTree();
    const record = signInPlace(dir);
    assert.equal(record.signature, VECTOR_SIGNATURE);
    assert.deepEqual(verifyMod(dir, KEYS), { status: 'verified', keyId: TEST_KEY.keyId, digest: VECTOR_DIGEST });
    fs.writeFileSync(path.join(dir, 'lib', '.DS_Store'), 'more junk');
    assert.equal(verifyMod(dir, KEYS).status, 'verified');
});

test('any change after signing invalidates the signature', () => {
    const edited = writeVectorTree();
    signInPlace(edited);
    fs.appendFileSync(path.join(edited, 'client.mjs'), '// sneaky\n');
    assert.equal(verifyMod(edited, KEYS).reason, 'digest-mismatch');

    const added = writeVectorTree();
    signInPlace(added);
    fs.writeFileSync(path.join(added, 'extra.mjs'), 'export {};\n');
    assert.equal(verifyMod(added, KEYS).reason, 'digest-mismatch');

    const bumped = writeVectorTree();
    signInPlace(bumped);
    const manifestPath = path.join(bumped, 'mod.json');
    fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').replace('1.0.0', '1.0.1'));
    assert.equal(verifyMod(bumped, KEYS).reason, 'mod-mismatch');
});

test('signatures from unknown or revoked keys, or of revoked mods, do not verify', () => {
    const dir = writeVectorTree();
    signInPlace(dir);
    assert.equal(verifyMod(dir, []).reason, 'unknown-key');
    assert.equal(verifyMod(dir, [{ ...KEYS[0], revoked: true }]).reason, 'revoked-key');
    assert.equal(verifyMod(dir, KEYS, { revokedDigests: [VECTOR_DIGEST] }).reason, 'revoked-mod');

    const forgedKey = crypto.generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
    assert.equal(verifyMod(dir, [{ keyId: TEST_KEY.keyId, publicKey: forgedKey, revoked: false }]).reason, 'bad-signature');
});

test('unsigned and malformed signature files are told apart', () => {
    const dir = writeVectorTree();
    fs.rmSync(path.join(dir, SIGNATURE_FILE));
    assert.deepEqual(verifyMod(dir, KEYS), { status: 'unsigned' });
    fs.writeFileSync(path.join(dir, SIGNATURE_FILE), '{"format":"folium-signature"}');
    assert.equal(verifyMod(dir, KEYS).reason, 'malformed');
    assert.equal(parseSignatureRecord({ ...VECTOR_FIELDS, format: 'folium-signature', version: 1, signature: 'x', modId: 'Bad Id' }), null);
    assert.equal(parseSignatureRecord({ ...VECTOR_FIELDS, format: 'folium-signature', version: 1, signature: 'x', signedAt: 'x\nkeyId=evil' }), null);
});

test('trees that cannot hash the same everywhere are refused', () => {
    const dir = writeVectorTree();
    fs.symlinkSync('client.mjs', path.join(dir, 'link.mjs'));
    assert.throws(() => computeSignedDigest(dir), /signed-tree-has-symlink/);
});
