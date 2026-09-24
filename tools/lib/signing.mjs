// tools/lib/signing.mjs
// The Folium mod signature format, shared by every tool in this repository.
//
// This file mirrors electron/modSystem/modSignature.cjs in the Folia host. The
// two must produce the same signed digest and the same signed message byte for
// byte, or a signature made here will not verify in the app. Both repositories
// pin this with the same test vector (test/signing.test.mjs here,
// test/unit/mod-system/modSignature.test.ts in Folia): change one, change both.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SIGNATURE_FILE = 'folium.sig.json';
export const SIGNATURE_FORMAT = 'folium-signature';
export const SIGNATURE_VERSION = 1;
// Written by file browsers, never by mod authors, and never loadable as code.
export const IGNORED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
// Same caps as the host's content digest (electron/modSystem/modDigest.cjs).
export const DIGEST_LIMITS = { maxFiles: 2000, maxTotalBytes: 64 * 1024 * 1024 };

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

/*
 * Every file the signature covers, sorted by NFC relative path in code-unit
 * order. Throws on symlinks, special files, NFC collisions and oversized trees:
 * none of those hash the same way on every machine.
 */
export const collectSignedFiles = (rootDir) => {
    const files = [];
    let totalBytes = 0;

    const walk = (currentDir, prefix) => {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const name = entry.name.normalize('NFC');
            const relative = prefix ? `${prefix}/${name}` : name;
            const absolute = path.join(currentDir, entry.name);
            if (entry.isSymbolicLink()) {
                throw new Error(`signed-tree-has-symlink:${relative}`);
            }
            if (entry.isDirectory()) {
                walk(absolute, relative);
                continue;
            }
            if (!entry.isFile()) {
                throw new Error(`signed-tree-has-special-file:${relative}`);
            }
            if (IGNORED_FILE_NAMES.has(name) || relative === SIGNATURE_FILE) {
                continue;
            }
            totalBytes += fs.statSync(absolute).size;
            files.push({ relative, absolute });
            if (files.length > DIGEST_LIMITS.maxFiles || totalBytes > DIGEST_LIMITS.maxTotalBytes) {
                throw new Error('signed-tree-too-large');
            }
        }
    };

    walk(rootDir, '');
    files.sort((left, right) => compareCodeUnits(left.relative, right.relative));
    for (let index = 1; index < files.length; index += 1) {
        if (files[index].relative === files[index - 1].relative) {
            throw new Error(`signed-tree-has-duplicate-path:${files[index].relative}`);
        }
    }
    return files;
};

/*
 * Signed digest v1: sha256 over the lines `<sha256 hex of file> <relative path>\n`
 * (UTF-8), as `sha256:<hex>`. `lines` is what `sha256sum` would print for the
 * same files, handy for reviewing exactly what a signature covers.
 */
export const computeSignedDigest = (dirPath) => {
    const lines = collectSignedFiles(dirPath).map((file) => {
        const fileHash = crypto.createHash('sha256').update(fs.readFileSync(file.absolute)).digest('hex');
        return `${fileHash} ${file.relative}\n`;
    });
    const digest = crypto.createHash('sha256').update(lines.join(''), 'utf8').digest('hex');
    return { digest: `sha256:${digest}`, lines };
};

const isSingleLine = (value, maxLength) => (
    typeof value === 'string' && value.length > 0 && value.length <= maxLength && !/[\r\n]/.test(value)
);

/** The exact bytes that get signed: a fixed line format, so nothing depends on JSON key order. */
export const buildSignedMessage = ({ modId, modVersion, digest, keyId, signedAt }) => Buffer.from([
    `${SIGNATURE_FORMAT}/${SIGNATURE_VERSION}`,
    `modId=${modId}`,
    `modVersion=${modVersion}`,
    `digest=${digest}`,
    `keyId=${keyId}`,
    `signedAt=${signedAt}`,
    '',
].join('\n'), 'utf8');

/** Checks a parsed signature file's shape; returns the record or null. */
export const parseSignatureRecord = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const { format, version, modId, modVersion, digest, keyId, signedAt, signature } = raw;
    if (format !== SIGNATURE_FORMAT || version !== SIGNATURE_VERSION) return null;
    if (!isSingleLine(modId, 64) || !MOD_ID_PATTERN.test(modId)) return null;
    if (!isSingleLine(modVersion, 64)) return null;
    if (!isSingleLine(digest, 80) || !DIGEST_PATTERN.test(digest)) return null;
    if (!isSingleLine(keyId, 64) || !KEY_ID_PATTERN.test(keyId)) return null;
    if (!isSingleLine(signedAt, 64) || Number.isNaN(Date.parse(signedAt))) return null;
    if (!isSingleLine(signature, 200)) return null;
    return { modId, modVersion, digest, keyId, signedAt, signature };
};

/** Reads `mod.json` and returns `{ id, version }`, throwing when either is missing. */
export const readModIdentity = (modDir) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(modDir, 'mod.json'), 'utf8'));
    if (manifest.folium !== 1) throw new Error(`${modDir}: mod.json is not a Folium 1 manifest`);
    if (typeof manifest.id !== 'string' || !MOD_ID_PATTERN.test(manifest.id)) throw new Error(`${modDir}: invalid mod id`);
    if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`${modDir}: invalid version`);
    return { id: manifest.id, version: manifest.version, name: manifest.name ?? manifest.id, manifest };
};

/** Signs a mod directory with a private JWK; returns the signature record (not yet written). */
export const signMod = (modDir, { keyId, privateJwk, signedAt = new Date().toISOString() }) => {
    if (!KEY_ID_PATTERN.test(keyId)) throw new Error(`invalid key id: ${keyId}`);
    const { id, version } = readModIdentity(modDir);
    const { digest } = computeSignedDigest(modDir);
    const fields = { modId: id, modVersion: version, digest, keyId, signedAt };
    const privateKey = crypto.createPrivateKey({ key: privateJwk, format: 'jwk' });
    const signature = crypto.sign(null, buildSignedMessage(fields), privateKey).toString('base64');
    return { format: SIGNATURE_FORMAT, version: SIGNATURE_VERSION, ...fields, signature };
};

/*
 * Verifies a mod directory the way the host does. `keys` is the trusted key
 * list (keys/trusted-keys.json). Returns `{ status, reason?, keyId?, digest? }`
 * with status 'verified' | 'unsigned' | 'invalid'.
 */
export const verifyMod = (modDir, keys, { revokedDigests = [] } = {}) => {
    const signaturePath = path.join(modDir, SIGNATURE_FILE);
    if (!fs.existsSync(signaturePath)) return { status: 'unsigned' };
    let record;
    try {
        record = parseSignatureRecord(JSON.parse(fs.readFileSync(signaturePath, 'utf8')));
    } catch {
        record = null;
    }
    if (!record) return { status: 'invalid', reason: 'malformed' };
    const key = keys.find((candidate) => candidate.keyId === record.keyId);
    if (!key) return { status: 'invalid', reason: 'unknown-key', keyId: record.keyId };
    if (key.revoked) return { status: 'invalid', reason: 'revoked-key', keyId: record.keyId };
    const { id, version } = readModIdentity(modDir);
    if (record.modId !== id || record.modVersion !== version) return { status: 'invalid', reason: 'mod-mismatch', keyId: record.keyId };
    const publicKey = crypto.createPublicKey({ key: key.publicKey, format: 'jwk' });
    if (!crypto.verify(null, buildSignedMessage(record), publicKey, Buffer.from(record.signature, 'base64'))) {
        return { status: 'invalid', reason: 'bad-signature', keyId: record.keyId };
    }
    const { digest } = computeSignedDigest(modDir);
    if (digest !== record.digest) return { status: 'invalid', reason: 'digest-mismatch', keyId: record.keyId, digest };
    if (revokedDigests.includes(digest)) return { status: 'invalid', reason: 'revoked-mod', keyId: record.keyId, digest };
    return { status: 'verified', keyId: record.keyId, digest };
};
