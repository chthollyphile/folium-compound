#!/usr/bin/env node
// tools/build-index.mjs
// Writes index.json: one entry per mod with its identity, origin and signature.
// Only verified mods are listed; an unsigned or invalid mod stops the build, so
// the index can never advertise a mod the app would not verify.
//
//   node tools/build-index.mjs            write index.json
//   node tools/build-index.mjs --check    fail if index.json is out of date (CI)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SIGNATURE_FILE, readModIdentity, verifyMod } from './lib/signing.mjs';
import { REPO_ROOT, listModDirs, readRevokedDigests, readTrustedKeys } from './lib/repo.mjs';

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });

const keys = readTrustedKeys();
const revokedDigests = readRevokedDigests();
const mods = [];
let failed = false;

for (const target of listModDirs()) {
    const result = verifyMod(target.dir, keys, { revokedDigests });
    if (result.status !== 'verified') {
        failed = true;
        console.error(`${target.relative}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
        continue;
    }
    const { id, version, name, manifest } = readModIdentity(target.dir);
    const signature = JSON.parse(fs.readFileSync(path.join(target.dir, SIGNATURE_FILE), 'utf8'));
    mods.push({
        id,
        name,
        version,
        author: manifest.author ?? null,
        description: manifest.description ?? null,
        origin: target.origin,
        path: target.relative,
        digest: result.digest,
        keyId: result.keyId,
        signedAt: signature.signedAt,
    });
}

if (failed) process.exit(1);

const duplicate = mods.find((mod, index) => mods.findIndex((other) => other.id === mod.id) !== index);
if (duplicate) {
    console.error(`duplicate mod id in the repository: ${duplicate.id}`);
    process.exit(1);
}

const text = `${JSON.stringify({ format: 'folium-compound-index', version: 1, mods }, null, 2)}\n`;
const indexPath = path.join(REPO_ROOT, 'index.json');
if (values.check) {
    const current = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
    if (current !== text) {
        console.error('index.json is out of date: run `npm run index`');
        process.exit(1);
    }
    console.log(`index.json is up to date (${mods.length} mods)`);
} else {
    fs.writeFileSync(indexPath, text);
    console.log(`wrote index.json (${mods.length} mods)`);
}
