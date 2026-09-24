#!/usr/bin/env node
// tools/verify.mjs
// Verifies mod signatures the way the Folia host does.
//
//   node tools/verify.mjs                 every mod in mods/
//   node tools/verify.mjs mods/community/x   just these
//   node tools/verify.mjs --strict        unsigned mods fail too (use on main)
//   node tools/verify.mjs --list <dir>    print the files a signature covers
//
// Exit code 1 when any signature is invalid, or with --strict when any mod is
// unsigned. Pull requests that add a third-party mod arrive unsigned; a
// maintainer signs after review, and main must pass --strict.

import { parseArgs } from 'node:util';
import { computeSignedDigest, readModIdentity, verifyMod } from './lib/signing.mjs';
import { readRevokedDigests, readTrustedKeys, resolveModArgs } from './lib/repo.mjs';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        strict: { type: 'boolean', default: false },
        list: { type: 'boolean', default: false },
    },
});

const targets = resolveModArgs(positionals);

if (values.list) {
    for (const target of targets) {
        const { digest, lines } = computeSignedDigest(target.dir);
        console.log(`# ${target.relative} ${digest}`);
        process.stdout.write(lines.join(''));
    }
    process.exit(0);
}

const keys = readTrustedKeys();
const revokedDigests = readRevokedDigests();
let failed = false;
for (const target of targets) {
    let result;
    let identity = '?';
    try {
        const { id, version } = readModIdentity(target.dir);
        identity = `${id}@${version}`;
        if (!target.origin) console.warn(`warning: ${target.relative} is not under mods/official or mods/community`);
        result = verifyMod(target.dir, keys, { revokedDigests });
    } catch (error) {
        result = { status: 'invalid', reason: error.message };
    }
    const failedHere = result.status === 'invalid' || (values.strict && result.status === 'unsigned');
    failed ||= failedHere;
    const detail = result.status === 'verified' ? `key ${result.keyId}` : result.reason ?? '';
    console.log(`${failedHere ? 'FAIL' : 'ok  '} ${result.status.padEnd(8)} ${target.relative} ${identity} ${detail}`.trimEnd());
}
process.exit(failed ? 1 : 0);
