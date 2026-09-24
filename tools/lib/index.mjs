// tools/lib/index.mjs
// Builds index.json and reads/writes community.json.
//
// community.json records who owns each community mod (the GitHub accounts
// whose pull requests may update it), the submission issue and the source
// repository. It lives outside the mod directories on purpose: anything inside
// a mod directory is covered by the signature and shipped to users.

import fs from 'node:fs';
import path from 'node:path';
import { SIGNATURE_FILE, readModIdentity, verifyMod } from './signing.mjs';
import { REPO_ROOT, listModDirs, readRevokedDigests, readTrustedKeys } from './repo.mjs';

export const COMMUNITY_FILE = 'community.json';

/** community.json as `{ mods: { [modId]: { owners, submission, source, addedAt } } }`. */
export const readCommunityRegistry = (root = REPO_ROOT) => {
    const file = path.join(root, COMMUNITY_FILE);
    if (!fs.existsSync(file)) return { mods: {} };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { mods: parsed && typeof parsed.mods === 'object' && parsed.mods ? parsed.mods : {} };
};

export const writeCommunityRegistry = (registry, root = REPO_ROOT) => {
    const sorted = Object.fromEntries(Object.keys(registry.mods).sort().map((id) => [id, registry.mods[id]]));
    fs.writeFileSync(path.join(root, COMMUNITY_FILE), `${JSON.stringify({ mods: sorted }, null, 2)}\n`);
};

/*
 * The index.json text for the repository at `root`, or the problems that stop
 * it: every listed mod must verify, so the index never advertises a mod the
 * app would reject.
 */
export const buildIndex = (root = REPO_ROOT) => {
    const keys = readTrustedKeys(root);
    const revokedDigests = readRevokedDigests(root);
    const community = readCommunityRegistry(root);
    const mods = [];
    const errors = [];

    for (const target of listModDirs(root)) {
        const result = verifyMod(target.dir, keys, { revokedDigests });
        if (result.status !== 'verified') {
            errors.push(`${target.relative}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
            continue;
        }
        const { id, version, name, manifest } = readModIdentity(target.dir);
        const signature = JSON.parse(fs.readFileSync(path.join(target.dir, SIGNATURE_FILE), 'utf8'));
        const registered = target.origin === 'community' ? community.mods[id] ?? null : null;
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
            ...(registered ? { owners: registered.owners ?? [], source: registered.source ?? null } : {}),
        });
    }

    const seen = new Set();
    for (const mod of mods) {
        if (seen.has(mod.id)) errors.push(`duplicate mod id in the repository: ${mod.id}`);
        seen.add(mod.id);
    }

    const text = `${JSON.stringify({ format: 'folium-compound-index', version: 1, mods }, null, 2)}\n`;
    return { text, errors, mods };
};
