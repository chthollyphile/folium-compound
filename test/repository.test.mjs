// test/repository.test.mjs
// The repository itself: every mod on main is signed by an active trusted key
// of its directory's channel, and index.json describes exactly the mods present.
// Every mod has a registered category; community/ and beta/ hold no source mods
// (those are listed in awesome-Folia); awesome.json checks and AWESOME.md matches it.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { readModIdentity } from '../tools/lib/signing.mjs';
import { checkPreview } from '../tools/lib/image.mjs';
import { REPO_ROOT, channelOf, keyChannel, listModDirs, readRevokedDigests, readTrustedKeys, verifyRepoMod } from '../tools/lib/repo.mjs';
import { readCommunityRegistry, readOfficialMeta } from '../tools/lib/index.mjs';
import { CATEGORY_IDS } from '../tools/lib/categories.mjs';
import { AWESOME_MARKDOWN, checkAwesome, readAwesome, renderAwesomeMarkdown } from '../tools/lib/awesome.mjs';
import { sourceModRefusal } from '../tools/ci/lib/submission.mjs';

test('the trusted key list is well formed', () => {
    const keys = readTrustedKeys();
    assert.ok(keys.length > 0);
    for (const key of keys) {
        assert.match(key.keyId, /^[a-z0-9][a-z0-9.-]{0,63}$/);
        assert.equal(key.publicKey.kty, 'OKP');
        assert.equal(key.publicKey.crv, 'Ed25519');
        assert.equal(key.publicKey.d, undefined, `${key.keyId} must not contain a private key`);
        assert.ok(['release', 'beta'].includes(keyChannel(key)), `${key.keyId}: channel must be "release", "beta" or absent`);
    }
});

test('every mod verifies', () => {
    const keys = readTrustedKeys();
    const revokedDigests = readRevokedDigests();
    for (const target of listModDirs()) {
        const expected = channelOf(target.origin) === 'beta' ? 'beta' : 'verified';
        assert.equal(verifyRepoMod(target, keys, { revokedDigests }).status, expected, target.relative);
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

test('every mod has a category from the table', () => {
    const community = readCommunityRegistry().mods;
    const official = readOfficialMeta().mods;
    for (const target of listModDirs()) {
        const { id } = readModIdentity(target.dir);
        const registered = target.origin === 'official' ? official[id] : community[id];
        assert.ok(registered, `${target.relative}: no entry in ${target.origin === 'official' ? 'official-meta.json' : 'community.json'}`);
        assert.ok(CATEGORY_IDS.has(registered.category), `${target.relative}: category "${registered.category}" is not in tools/lib/categories.mjs`);
    }
});

test('community and beta hold no source mods', () => {
    for (const target of listModDirs().filter((item) => item.origin !== 'official')) {
        assert.equal(sourceModRefusal(readModIdentity(target.dir).manifest), null, `${target.relative}: source mods are listed in awesome-Folia, not kept here`);
    }
});

test('awesome.json checks and AWESOME.md is generated from it', () => {
    const awesome = readAwesome();
    const modIds = listModDirs().map((target) => readModIdentity(target.dir).id);
    assert.deepEqual(checkAwesome(awesome, { modIds }), []);
    assert.equal(fs.readFileSync(path.join(REPO_ROOT, AWESOME_MARKDOWN), 'utf8'), renderAwesomeMarkdown(awesome), 'AWESOME.md is out of date: run writeAwesome');
});
