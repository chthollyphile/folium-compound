// test/repository.test.mjs
// The repository itself: every mod on main is signed by an active trusted key
// and index.json describes exactly the mods present.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { readModIdentity, verifyMod } from '../tools/lib/signing.mjs';
import { checkPreview } from '../tools/lib/image.mjs';
import { REPO_ROOT, listModDirs, readRevokedDigests, readTrustedKeys } from '../tools/lib/repo.mjs';

test('the trusted key list is well formed', () => {
    const keys = readTrustedKeys();
    assert.ok(keys.length > 0);
    for (const key of keys) {
        assert.match(key.keyId, /^[a-z0-9][a-z0-9.-]{0,63}$/);
        assert.equal(key.publicKey.kty, 'OKP');
        assert.equal(key.publicKey.crv, 'Ed25519');
        assert.equal(key.publicKey.d, undefined, `${key.keyId} must not contain a private key`);
    }
});

test('every mod verifies', () => {
    const keys = readTrustedKeys();
    const revokedDigests = readRevokedDigests();
    for (const target of listModDirs()) {
        assert.equal(verifyMod(target.dir, keys, { revokedDigests }).status, 'verified', target.relative);
    }
});

test('every mod carries a valid introduction image', () => {
    for (const target of listModDirs()) {
        assert.deepEqual(checkPreview(target.dir, readModIdentity(target.dir).manifest).errors, [], target.relative);
    }
});

test('index.json lists exactly the mods in the repository', () => {
    const index = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'index.json'), 'utf8'));
    assert.deepEqual(index.mods.map((mod) => mod.path).sort(), listModDirs().map((target) => target.relative).sort());
});
