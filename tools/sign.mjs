#!/usr/bin/env node
// tools/sign.mjs
// Signs mods with a Folium private key and writes folium.sig.json into each.
//
//   node tools/sign.mjs --key ~/.config/folium-signing/folium-2026-1.key.json mods/official/<id> ...
//   node tools/sign.mjs --key <file> --all
//
// The key can also come from the environment for CI: FOLIUM_SIGNING_KEY is a
// path to the key file, FOLIUM_SIGNING_KEY_JSON is the file's content. Every
// new signature is verified against keys/trusted-keys.json before it is kept,
// so a key the repository does not list cannot sign anything here.
//
// Sign only after review: the signature says "the Folium maintainers vouch for
// exactly these bytes". Re-sign whenever any file in the mod changes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { SIGNATURE_FILE, computeSignedDigest, signMod, verifyMod } from './lib/signing.mjs';
import { listModDirs, readTrustedKeys, resolveModArgs } from './lib/repo.mjs';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        key: { type: 'string' },
        all: { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
    },
});

const loadKey = () => {
    const inline = process.env.FOLIUM_SIGNING_KEY_JSON;
    const file = values.key ?? process.env.FOLIUM_SIGNING_KEY;
    if (!inline && !file) {
        console.error('no signing key: pass --key <file> or set FOLIUM_SIGNING_KEY / FOLIUM_SIGNING_KEY_JSON');
        process.exit(1);
    }
    const text = inline ?? fs.readFileSync(path.resolve(file.replace(/^~(?=$|\/)/, os.homedir())), 'utf8');
    const parsed = JSON.parse(text);
    if (typeof parsed.keyId !== 'string' || !parsed.privateKey?.d) {
        console.error('key file must be { "keyId": "...", "privateKey": <Ed25519 private JWK> } as written by tools/keygen.mjs');
        process.exit(1);
    }
    return parsed;
};

const targets = values.all ? listModDirs() : resolveModArgs(positionals);
if (!values.all && positionals.length === 0) {
    console.error('usage: node tools/sign.mjs --key <file> (<mod dir> ... | --all) [--dry-run]');
    process.exit(1);
}

const { keyId, privateKey } = loadKey();
const trustedKeys = readTrustedKeys();
if (!trustedKeys.some((key) => key.keyId === keyId && !key.revoked)) {
    console.error(`key "${keyId}" is not an active key in keys/trusted-keys.json`);
    process.exit(1);
}

let failed = false;
for (const target of targets) {
    try {
        const { lines } = computeSignedDigest(target.dir);
        const record = signMod(target.dir, { keyId, privateJwk: privateKey });
        if (values['dry-run']) {
            console.log(`would sign ${target.relative} ${record.modId}@${record.modVersion} ${record.digest} (${lines.length} files)`);
            continue;
        }
        const signaturePath = path.join(target.dir, SIGNATURE_FILE);
        const previous = fs.existsSync(signaturePath) ? fs.readFileSync(signaturePath, 'utf8') : null;
        fs.writeFileSync(signaturePath, `${JSON.stringify(record, null, 2)}\n`);
        const check = verifyMod(target.dir, trustedKeys);
        if (check.status !== 'verified') {
            // Never leave a signature behind that the host would reject.
            if (previous === null) fs.rmSync(signaturePath);
            else fs.writeFileSync(signaturePath, previous);
            throw new Error(`fresh signature did not verify (${check.reason})`);
        }
        console.log(`signed ${target.relative} ${record.modId}@${record.modVersion} ${record.digest} (${lines.length} files)`);
    } catch (error) {
        failed = true;
        console.error(`failed ${target.relative}: ${error.message}`);
    }
}
process.exit(failed ? 1 : 0);
