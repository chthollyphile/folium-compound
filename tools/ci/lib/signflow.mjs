// tools/ci/lib/signflow.mjs
// The two jobs that hold the CI signing key, minus their GitHub calls:
//   - importAndSign: a maintainer said `/sign <commit>` on a reviewed
//     submission or update issue. Replace mods/community/<id>/ (or
//     mods/beta/<id>/ for the beta channel) with the files
//     staged from that commit of the author's repository, sign them, update
//     community.json and index.json, and commit, all locally; the caller pushes
//     once, so main never shows an unsigned mod and a failure leaves main
//     untouched.
//   - resignRepository: after anything lands on main (a maintainer's edit, a
//     key rotation, a mod moved between community/ and beta/), re-sign every
//     mod whose signature no longer verifies, with the key of its channel.
// Both finish with the repository-wide check (every mod verified, index
// current) before anything is committed.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNATURE_FILE, readModIdentity, signMod } from '../../lib/signing.mjs';
import { channelOf, communityDir, isSigned, keyChannel, listModDirs, readRevokedDigests, readTrustedKeys, verifyRepoMod } from '../../lib/repo.mjs';
import { buildIndex, readCommunityRegistry, writeCommunityRegistry } from '../../lib/index.mjs';

export const BOT_IDENTITY = {
    name: 'github-actions[bot]',
    email: '41898282+github-actions[bot]@users.noreply.github.com',
};

const git = (repoDir, args, options = {}) => execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
        ...process.env,
        GIT_AUTHOR_NAME: BOT_IDENTITY.name,
        GIT_AUTHOR_EMAIL: BOT_IDENTITY.email,
        GIT_COMMITTER_NAME: BOT_IDENTITY.name,
        GIT_COMMITTER_EMAIL: BOT_IDENTITY.email,
    },
    ...options,
}).trim();

// The signing environment secret holding each channel's CI key.
export const SIGNING_KEY_ENV = { release: 'FOLIUM_SIGNING_KEY_JSON', beta: 'FOLIUM_BETA_SIGNING_KEY_JSON' };

/*
 * A channel's CI signing key from its secret (the key file written by
 * tools/keygen.mjs; `json` defaults to the environment). It must be an active
 * key in the repository's trusted list, for that channel, or nothing gets
 * signed.
 */
export const loadSigningKey = (root, json = undefined, channel = 'release') => {
    const name = SIGNING_KEY_ENV[channel];
    const text = json ?? process.env[name];
    if (!text) throw new Error(`${name} is not set (the signing environment secret)`);
    const parsed = JSON.parse(text);
    if (typeof parsed.keyId !== 'string' || !parsed.privateKey?.d) throw new Error(`${name} is not a key file from tools/keygen.mjs`);
    const trusted = readTrustedKeys(root).find((key) => key.keyId === parsed.keyId);
    if (!trusted || trusted.revoked) throw new Error(`signing key ${parsed.keyId} is not an active key in keys/trusted-keys.json`);
    if (keyChannel(trusted) !== channel) throw new Error(`${name} holds ${parsed.keyId}, a ${keyChannel(trusted)}-channel key, not a ${channel}-channel key`);
    return { keyId: parsed.keyId, privateJwk: parsed.privateKey, channel };
};

const writeSignature = (modDir, key) => {
    const record = signMod(modDir, { keyId: key.keyId, privateJwk: key.privateJwk });
    fs.writeFileSync(path.join(modDir, SIGNATURE_FILE), `${JSON.stringify(record, null, 2)}\n`);
    return record;
};

/*
 * The repository-wide gate: index.json rebuilt (every mod must verify) and the
 * repository tests passing. Throws with the problems otherwise.
 */
export const finalizeRepository = (root, { runTests = true } = {}) => {
    const { text, errors } = buildIndex(root);
    if (errors.length > 0) throw new Error(`repository does not verify:\n${errors.join('\n')}`);
    fs.writeFileSync(path.join(root, 'index.json'), text);
    if (runTests) {
        const testDir = path.join(root, 'test');
        const files = fs.readdirSync(testDir).filter((name) => name.endsWith('.test.mjs')).map((name) => path.join(testDir, name));
        const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8' });
        if (result.status !== 0) throw new Error(`repository tests failed:\n${result.stdout}\n${result.stderr}`);
    }
};

/*
 * Imports a staged mod (see source.mjs stageModFiles) into the checked-out
 * main at `repoDir`, signs it with `key` (the key of `channel`) and commits.
 * `kind` is 'submission' or 'update'; `source` is `{ repository, path, commit }`.
 * The mod lands in mods/community/<id> (release) or mods/beta/<id> (beta); a
 * copy in the other channel's directory is removed, which is how an update
 * promotes or demotes a mod. Returns `{ commit, record }`; throws, leaving the
 * working tree exactly as it was, when the final check fails.
 */
export const importAndSign = ({ repoDir, stagedDir, modId, kind, channel = 'release', author, authorId = null, issueNumber, source, key, runTests = true, now = new Date() }) => {
    const start = git(repoDir, ['rev-parse', 'HEAD']);
    const relativeDir = communityDir(modId, channel);
    const otherDir = communityDir(modId, channel === 'beta' ? 'release' : 'beta');
    const targetDir = path.join(repoDir, relativeDir);
    const reset = () => {
        git(repoDir, ['reset', '-q', '--hard', start]);
        git(repoDir, ['clean', '-fdq', '--', relativeDir, otherDir]);
    };
    try {
        fs.rmSync(path.join(repoDir, otherDir), { recursive: true, force: true });
        fs.rmSync(targetDir, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(targetDir), { recursive: true });
        fs.cpSync(stagedDir, targetDir, { recursive: true, verbatimSymlinks: true });

        const { version } = readModIdentity(targetDir);
        const today = now.toISOString().slice(0, 10);
        const registry = readCommunityRegistry(repoDir);
        const previous = registry.mods[modId];
        registry.mods[modId] = kind === 'submission' || !previous
            ? { owners: [author], submission: issueNumber, source: source.repository, path: source.path, commit: source.commit, version, addedAt: today, updatedAt: today }
            : { ...previous, commit: source.commit, version, updatedAt: today, lastIssue: issueNumber };
        writeCommunityRegistry(registry, repoDir);

        const record = writeSignature(targetDir, key);
        finalizeRepository(repoDir, { runTests });

        const coAuthor = authorId ? `\n\nCo-authored-by: ${author} <${authorId}+${author}@users.noreply.github.com>` : '';
        // The other channel's directory is staged only when main had it (a promotion or demotion removed it).
        const removed = git(repoDir, ['ls-files', '--', otherDir]) ? [otherDir] : [];
        git(repoDir, ['add', '-A', relativeDir, ...removed, 'community.json', 'index.json']);
        git(repoDir, ['commit', '-q', '-m', `sign(${channel === 'beta' ? 'beta' : 'community'}): ${modId}@${version}\n\nImported from ${source.repository}@${source.commit}${source.path ? ` (${source.path})` : ''}, reviewed in #${issueNumber}, signed with ${key.keyId}.${coAuthor}`]);
        return { commit: git(repoDir, ['rev-parse', 'HEAD']), record };
    } catch (error) {
        reset();
        throw error;
    }
};

/*
 * Re-signs every mod on main whose signature does not verify: a maintainer
 * edited or added a mod directly, moved it between community/ and beta/, or a
 * key has since been rotated out. Each mod is signed with the key of its
 * directory's channel (`signingKeys` is `{ release, beta }`; a missing key
 * fails only when a mod of that channel needs it). A mod whose content is on
 * the revoked list is never re-signed. Returns the re-signed mods and leaves
 * committing to the caller.
 */
export const resignRepository = ({ root, signingKeys, runTests = true }) => {
    const keys = readTrustedKeys(root);
    const revokedDigests = readRevokedDigests(root);
    const resigned = [];
    for (const target of listModDirs(root)) {
        const result = verifyRepoMod(target, keys, { revokedDigests });
        if (isSigned(result)) continue;
        if (result.reason === 'revoked-mod') throw new Error(`${target.relative} is on the revoked list; remove it instead of re-signing`);
        const channel = channelOf(target.origin);
        const key = signingKeys[channel];
        if (!key) throw new Error(`${target.relative} needs re-signing, but there is no ${channel}-channel key (${SIGNING_KEY_ENV[channel]})`);
        const record = writeSignature(target.dir, key);
        resigned.push({ path: target.relative, modId: record.modId, version: record.modVersion, previous: result.reason ?? result.status });
    }
    finalizeRepository(root, { runTests });
    return { resigned };
};
