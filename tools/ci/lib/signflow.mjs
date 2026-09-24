// tools/ci/lib/signflow.mjs
// The two jobs that hold the CI signing key, minus their GitHub calls:
//   - mergeAndSign: a maintainer said `/sign <commit>` on a reviewed submission.
//     Merge exactly that commit into main, sign the mod, update community.json
//     and index.json, and commit, all locally; the caller pushes once, so main
//     never shows an unsigned mod and a failure leaves main untouched.
//   - resignRepository: after a reviewed update is merged (or anything else
//     lands on main), re-sign every mod whose signature no longer verifies.
// Both finish with the repository-wide check (every mod verified, index
// current) before anything is committed.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SIGNATURE_FILE, readModIdentity, signMod, verifyMod } from '../../lib/signing.mjs';
import { listModDirs, readRevokedDigests, readTrustedKeys } from '../../lib/repo.mjs';
import { buildIndex, readCommunityRegistry, writeCommunityRegistry } from '../../lib/index.mjs';
import { COMMUNITY_PREFIX } from './submission.mjs';

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

/*
 * The CI signing key from FOLIUM_SIGNING_KEY_JSON (the key file written by
 * tools/keygen.mjs). It must be an active key in the repository's trusted list,
 * or nothing gets signed.
 */
export const loadSigningKey = (root, json = process.env.FOLIUM_SIGNING_KEY_JSON) => {
    if (!json) throw new Error('FOLIUM_SIGNING_KEY_JSON is not set (the signing environment secret)');
    const parsed = JSON.parse(json);
    if (typeof parsed.keyId !== 'string' || !parsed.privateKey?.d) throw new Error('FOLIUM_SIGNING_KEY_JSON is not a key file from tools/keygen.mjs');
    const trusted = readTrustedKeys(root).find((key) => key.keyId === parsed.keyId);
    if (!trusted || trusted.revoked) throw new Error(`signing key ${parsed.keyId} is not an active key in keys/trusted-keys.json`);
    return { keyId: parsed.keyId, privateJwk: parsed.privateKey };
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
 * Merges the reviewed commit `sha` of pull request `prNumber` into the checked
 * out main at `repoDir`, then signs `modId` and commits. The commit must already
 * be fetched. Returns `{ mergeCommit, signCommit, record }`; throws (leaving
 * the working tree reset to where it started) on conflicts, on a merge that
 * reaches outside the mod directory, or on a failed final check.
 */
export const mergeAndSign = ({ repoDir, prNumber, sha, headLabel, title, author, modId, submission, key, runTests = true, now = new Date() }) => {
    const start = git(repoDir, ['rev-parse', 'HEAD']);
    const reset = () => {
        spawnSync('git', ['merge', '--abort'], { cwd: repoDir });
        git(repoDir, ['reset', '--hard', start]);
    };
    try {
        try {
            git(repoDir, ['merge', '--no-ff', '-m', `Merge pull request #${prNumber} from ${headLabel}\n\n${title}`, sha]);
        } catch (error) {
            throw new Error(`合并冲突，请作者基于最新的 main 更新 PR（${String(error.stderr ?? error.message).trim().split('\n')[0]}）`);
        }
        const mergeCommit = git(repoDir, ['rev-parse', 'HEAD']);
        const prefix = `${COMMUNITY_PREFIX}${modId}/`;
        const touched = git(repoDir, ['diff', '--name-only', `${start}..${mergeCommit}`]).split('\n').filter(Boolean);
        const outside = touched.filter((file) => !file.startsWith(prefix));
        if (outside.length > 0) throw new Error(`合并结果修改了 ${prefix} 以外的文件：${outside.join(', ')}`);

        const modDir = path.join(repoDir, 'mods', 'community', modId);
        const { version } = readModIdentity(modDir);
        const registry = readCommunityRegistry(repoDir);
        if (!registry.mods[modId]) {
            registry.mods[modId] = {
                owners: [author],
                submission: submission?.issue?.number ?? null,
                source: submission?.fields?.source ?? null,
                addedAt: now.toISOString().slice(0, 10),
            };
            writeCommunityRegistry(registry, repoDir);
        }
        const record = writeSignature(modDir, key);
        finalizeRepository(repoDir, { runTests });

        git(repoDir, ['add', '-A', path.join('mods', 'community', modId), 'community.json', 'index.json']);
        git(repoDir, ['commit', '-m', `sign(community): ${modId}@${version}\n\nReviewed commit ${sha} from #${prNumber}, signed with ${key.keyId}.`]);
        return { mergeCommit, signCommit: git(repoDir, ['rev-parse', 'HEAD']), record };
    } catch (error) {
        reset();
        throw error;
    }
};

/*
 * Re-signs every mod on main whose signature does not verify: an update just
 * merged (digest or version changed), an unsigned mod added by a maintainer, or
 * a signature from a key that has since been rotated out. A mod whose content
 * is on the revoked list is never re-signed. Returns the re-signed mods and
 * leaves committing to the caller.
 */
export const resignRepository = ({ root, key, runTests = true }) => {
    const keys = readTrustedKeys(root);
    const revokedDigests = readRevokedDigests(root);
    const resigned = [];
    for (const target of listModDirs(root)) {
        const result = verifyMod(target.dir, keys, { revokedDigests });
        if (result.status === 'verified') continue;
        if (result.reason === 'revoked-mod') throw new Error(`${target.relative} is on the revoked list; remove it instead of re-signing`);
        const record = writeSignature(target.dir, key);
        resigned.push({ path: target.relative, modId: record.modId, version: record.modVersion, previous: result.reason ?? result.status });
    }
    finalizeRepository(root, { runTests });
    return { resigned };
};
