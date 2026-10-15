// tools/ci/lib/evaluate.mjs
// Evaluates a submission or update issue: reads the form, resolves the source
// commit, fetches it from the author's repository, stages the mod directory
// exactly as it would be imported, and checks it. Shared by the issue check
// and the signing job, so both judge the same commit identically.
//
// The GitHub client is passed in (tests use a fake). `fetchUrlFor` maps the
// submitted repository URL to what git fetches (tests point it at a local
// repository together with `allowLocal`).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { communityDir, listModDirs } from '../../lib/repo.mjs';
import { computeSignedDigest, readModIdentity } from '../../lib/signing.mjs';
import { readCommunityRegistry } from '../../lib/index.mjs';
import { SIGNER_PERMISSIONS, checkIssueTitle, checkModTree, compareVersions, issueKind, parseSubmissionIssue } from './submission.mjs';
import { fetchCommit, resolveRef, reviewLinks, stageModFiles } from './source.mjs';

/** Every mod id in the repository at `root`. */
export const knownModIds = (root) => listModDirs(root).map((target) => {
    try {
        return readModIdentity(target.dir).id;
    } catch {
        return path.basename(target.dir);
    }
});

/* The channel a community mod is published in on main, or null when it is in neither directory. */
export const currentChannel = (baseDir, modId) => ['release', 'beta']
    .find((channel) => fs.existsSync(path.join(baseDir, communityDir(modId, channel), 'mod.json'))) ?? null;

/*
 * Returns `{ kind, errors, warnings, modId, manifest, isUpdate, previousVersion,
 * channel, previousChannel, source: { repository, path, ref, commit },
 * stagedDir, files, digest, links, cleanup }`. `channel` is what the issue
 * asks for: the form's choice, else (an older issue without the field) the
 * mod's current channel for an update and release for a new mod. `stagedDir` is the mod as it would be imported (call `cleanup()`
 * when done). `errors` block signing; `warnings` are for the maintainer.
 */
export const evaluateIssue = async (github, options) => {
    const result = await evaluateForm(github, options);
    // Checked last so a bare title does not hide the other problems from the author.
    const titleError = result.kind ? checkIssueTitle(options.issue.title, result.kind) : null;
    if (titleError) result.errors.unshift(titleError);
    return result;
};

const evaluateForm = async (github, { issue, baseDir, fetchUrlFor = (url) => url, allowLocal = false }) => {
    const errors = [];
    const warnings = [];
    const kind = issueKind(issue);
    const result = { kind, errors, warnings, modId: null, manifest: null, isUpdate: kind === 'update', previousVersion: null, channel: 'release', previousChannel: null, source: null, stagedDir: null, files: [], digest: null, links: null, cleanup: () => {} };
    if (!kind) {
        errors.push('这个 issue 不是模组提交或模组更新');
        return result;
    }

    const { fields, errors: formErrors } = parseSubmissionIssue(issue.body, kind);
    errors.push(...formErrors);
    result.modId = fields.modId || null;
    if (errors.length > 0) return result;

    const author = issue.user.login;
    const registry = readCommunityRegistry(baseDir);
    const entry = registry.mods[fields.modId] ?? null;
    const known = knownModIds(baseDir);
    result.previousChannel = kind === 'update' ? currentChannel(baseDir, fields.modId) : null;
    result.channel = fields.channel ?? result.previousChannel ?? 'release';
    const existingDir = result.previousChannel ? path.join(baseDir, communityDir(fields.modId, result.previousChannel)) : null;
    let existing = null;
    let repository;
    let modPath;
    if (kind === 'submission') {
        if (known.includes(fields.modId)) errors.push(`模组 id \`${fields.modId}\` 已被占用；更新已收录的模组请用「模组更新」issue`);
        repository = fields.repository;
        modPath = fields.path;
    } else {
        if (!entry || !existingDir) {
            errors.push(`\`${fields.modId}\` 不是已收录的社区模组；新模组请用「模组提交」issue`);
        } else {
            existing = JSON.parse(fs.readFileSync(path.join(existingDir, 'mod.json'), 'utf8'));
            result.previousVersion = existing.version;
            const owners = entry.owners ?? [];
            if (!owners.includes(author) && !SIGNER_PERMISSIONS.has(await github.getPermission(author))) {
                errors.push(`只有 \`${fields.modId}\` 的登记维护者（${owners.map((owner) => `@${owner}`).join('、') || '无'}）可以提交更新`);
            }
            repository = entry.source;
            modPath = entry.path ?? '';
            if (!repository) errors.push(`\`${fields.modId}\` 没有登记源码仓库，请联系维护者`);
        }
    }
    if (errors.length > 0) return result;

    let commit;
    try {
        commit = resolveRef(fetchUrlFor(repository), fields.ref, { allowLocal });
    } catch (error) {
        errors.push(error.message.startsWith('仓库') ? error.message : `无法访问源码仓库：${String(error.stderr ?? error.message).trim().split('\n').pop()}`);
        return result;
    }
    result.source = { repository, path: modPath, ref: fields.ref, commit };

    let checkout;
    try {
        checkout = fetchCommit(fetchUrlFor(repository), commit, { ref: fields.ref, allowLocal });
    } catch (error) {
        errors.push(error.message);
        return result;
    }
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-stage-'));
    result.cleanup = () => fs.rmSync(stagingRoot, { recursive: true, force: true });
    try {
        result.stagedDir = stageModFiles(checkout, modPath, fields.modId, stagingRoot);
    } catch (error) {
        errors.push(error.message);
        return result;
    } finally {
        fs.rmSync(checkout, { recursive: true, force: true });
    }

    const changesChannel = Boolean(result.previousChannel) && result.previousChannel !== result.channel;
    const tree = checkModTree({ modDir: result.stagedDir, modId: fields.modId, existing, knownModIds: known, changesChannel });
    errors.push(...tree.errors);
    warnings.push(...tree.warnings);
    result.manifest = tree.manifest;
    // Moving channels at the same version re-signs the same mod: users who have that version
    // must not end up with different bytes under it.
    if (changesChannel && tree.manifest && compareVersions(tree.manifest.version, existing.version) === 0
        && computeSignedDigest(result.stagedDir).digest !== computeSignedDigest(existingDir).digest) {
        errors.push(`换渠道时版本号不变，内容必须与已收录的 ${existing.version} 完全相同；内容有改动请提升版本号`);
    }
    if (errors.length === 0) {
        const { digest, lines } = computeSignedDigest(result.stagedDir);
        result.digest = digest;
        result.files = lines;
        result.links = reviewLinks(repository, commit, modPath, entry?.commit ?? null);
    }
    return result;
};
