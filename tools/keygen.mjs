#!/usr/bin/env node
// tools/keygen.mjs
// Generates a Folium signing key pair.
//
//   node tools/keygen.mjs --key-id folium-2026-1 --out ~/.config/folium-signing
//
// The private key goes to <out>/<key-id>.key.json (mode 600, directory 700) and
// must never enter this or any other repository. The public key is printed and
// added to keys/trusted-keys.json here and to the host's trusted key list
// (Folia: electron/modSystem/trustedKeys.cjs); a key only verifies mods in a
// host build that ships it.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
    options: {
        'key-id': { type: 'string' },
        out: { type: 'string', default: path.join(os.homedir(), '.config', 'folium-signing') },
        label: { type: 'string', default: 'Folium official' },
    },
});

const keyId = values['key-id'];
if (!keyId || !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(keyId)) {
    console.error('usage: node tools/keygen.mjs --key-id <id> [--out <dir>] [--label <text>]');
    console.error('key id: lowercase letters, digits, "." and "-", e.g. folium-2026-1');
    process.exit(1);
}

const outDir = path.resolve(values.out.replace(/^~(?=$|\/)/, os.homedir()));
const privatePath = path.join(outDir, `${keyId}.key.json`);
if (fs.existsSync(privatePath)) {
    console.error(`refusing to overwrite an existing private key: ${privatePath}`);
    process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const publicJwk = publicKey.export({ format: 'jwk' });
const privateJwk = privateKey.export({ format: 'jwk' });

fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
fs.chmodSync(outDir, 0o700);
fs.writeFileSync(privatePath, `${JSON.stringify({ keyId, privateKey: privateJwk }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });

const entry = {
    keyId,
    label: values.label,
    publicKey: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x },
    revoked: false,
    createdAt: new Date().toISOString().slice(0, 10),
};

console.log(`private key: ${privatePath} (keep it offline or in a CI secret; never commit it)`);
console.log('public key entry for keys/trusted-keys.json and the host trusted key list:');
console.log(JSON.stringify(entry, null, 2));
