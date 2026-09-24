// tools/lib/repo.mjs
// Repository layout helpers: where mods live and which keys this repository trusts.
//
//   mods/official/<mod-id>/    mods written by the Folium maintainers
//   mods/community/<mod-id>/   third-party mods that passed review
//
// Both are signed with the same Folium key and show as "verified" in the app;
// the split only records where a mod came from (it lands in index.json).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODS_ROOT = path.join(REPO_ROOT, 'mods');
export const ORIGINS = ['official', 'community'];

/** Every mod directory in the repository as `{ origin, dir, relative }`. */
export const listModDirs = () => ORIGINS.flatMap((origin) => {
    const originDir = path.join(MODS_ROOT, origin);
    if (!fs.existsSync(originDir)) return [];
    return fs.readdirSync(originDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => ({
            origin,
            dir: path.join(originDir, entry.name),
            relative: `mods/${origin}/${entry.name}`,
        }))
        .sort((left, right) => (left.relative < right.relative ? -1 : 1));
});

/** keys/trusted-keys.json: the public keys this repository's signatures must verify against. */
export const readTrustedKeys = () => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'keys', 'trusted-keys.json'), 'utf8')).keys;

/** keys/revoked-mods.json: signed digests pulled after release. */
export const readRevokedDigests = () => {
    const file = path.join(REPO_ROOT, 'keys', 'revoked-mods.json');
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).digests.map((entry) => entry.digest) : [];
};

/** Resolves command-line mod arguments (paths) to mod directories, or all of them when none are given. */
export const resolveModArgs = (args) => {
    if (args.length === 0) return listModDirs();
    return args.map((arg) => {
        const dir = path.resolve(arg);
        const relative = path.relative(REPO_ROOT, dir).split(path.sep).join('/');
        const origin = ORIGINS.find((candidate) => relative.startsWith(`mods/${candidate}/`)) ?? null;
        return { origin, dir, relative };
    });
};
