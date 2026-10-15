// tools/lib/repo.mjs
// Repository layout helpers: where mods live and which keys this repository trusts.
//
//   mods/official/<mod-id>/    mods written by the Folium maintainers
//   mods/community/<mod-id>/   third-party mods that passed the full review (release channel)
//   mods/beta/<mod-id>/        third-party mods that passed the security review only (beta channel)
//
// official and community are signed with the release keys and show as
// "verified" in the app; that split only records where a mod came from. beta
// is signed with a `channel: "beta"` key and shows as a preview build. The
// directory decides the channel: a mod signed with the other channel's key
// does not verify here (reason 'wrong-channel'), so moving a mod between
// community/ and beta/ is how a maintainer promotes or demotes it (resign.yml
// then signs it with the right key).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMod } from './signing.mjs';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODS_ROOT = path.join(REPO_ROOT, 'mods');
export const ORIGINS = ['official', 'community', 'beta'];

/** The channel a directory publishes to: 'beta' for mods/beta, else 'release'. */
export const channelOf = (origin) => (origin === 'beta' ? 'beta' : 'release');

/** The channel a trusted key signs for. */
export const keyChannel = (key) => (key?.channel === 'beta' ? 'beta' : 'release');

/** Where a community mod of `channel` lives, relative to the repository root. */
export const communityDir = (modId, channel) => `mods/${channel === 'beta' ? 'beta' : 'community'}/${modId}`;

/*
 * verifyMod for a mod inside the repository: a valid signature also has to come
 * from the channel of the directory it sits in. Returns verifyMod's result,
 * with a valid signature from the wrong channel turned into
 * `{ status: 'invalid', reason: 'wrong-channel' }`. Without an origin (a path
 * outside mods/<origin>/) the channel is not checked.
 */
export const verifyRepoMod = (target, keys, options = {}) => {
    const result = verifyMod(target.dir, keys, options);
    if (!target.origin || (result.status !== 'verified' && result.status !== 'beta')) return result;
    const expected = channelOf(target.origin) === 'beta' ? 'beta' : 'verified';
    return result.status === expected ? result : { ...result, status: 'invalid', reason: 'wrong-channel', signedAs: result.status };
};

/** Whether a verifyRepoMod result is a good signature for the repository. */
export const isSigned = (result) => result.status === 'verified' || result.status === 'beta';

/** Every mod directory in the repository as `{ origin, dir, relative }`. */
export const listModDirs = (root = REPO_ROOT) => ORIGINS.flatMap((origin) => {
    const originDir = path.join(root, 'mods', origin);
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
export const readTrustedKeys = (root = REPO_ROOT) => JSON.parse(fs.readFileSync(path.join(root, 'keys', 'trusted-keys.json'), 'utf8')).keys;

/** keys/revoked-mods.json: signed digests pulled after release. */
export const readRevokedDigests = (root = REPO_ROOT) => {
    const file = path.join(root, 'keys', 'revoked-mods.json');
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
