// tools/ci/lib/evaluate.mjs
// Evaluates a community submission pull request against the rules in
// submission.mjs. Shared by the PR check, the issue check and the signing job,
// so all three judge a submission identically. The GitHub client is passed in
// (tests use a fake); the PR's files are read from a checkout as data only.

import fs from 'node:fs';
import path from 'node:path';
import { listModDirs } from '../../lib/repo.mjs';
import { readModIdentity } from '../../lib/signing.mjs';
import { readCommunityRegistry } from '../../lib/index.mjs';
import {
    LABELS,
    SIGNATURE_FILE,
    SIGNER_PERMISSIONS,
    checkModTree,
    classifyChangedFiles,
    parseSubmissionIssue,
    touchedSignatureFiles,
} from './submission.mjs';

/** Every mod id in the repository at `root`. */
export const knownModIds = (root) => listModDirs(root).map((target) => {
    try {
        return readModIdentity(target.dir).id;
    } catch {
        return path.basename(target.dir);
    }
});

/*
 * The open submission issue that names this pull request, or null. Only
 * issues carrying the submission label (applied by the issue form) count.
 */
export const findSubmissionIssue = async (github, prNumber) => {
    const issues = await github.listOpenIssuesWithLabel(LABELS.submission);
    for (const issue of issues) {
        if (issue.pull_request) continue;
        const { fields } = parseSubmissionIssue(issue.body, github.repository);
        if (fields.pullRequest === prNumber) return { issue, fields };
    }
    return null;
};

/*
 * Returns `{ skip, errors, warnings, modId, manifest, isUpdate, pr, submission }`.
 * `skip` is true for pull requests by maintainers that are not community
 * submissions (tooling changes): those are reviewed like any internal PR.
 *   - baseDir: checkout of main (the rules and the current mods)
 *   - prDir:   checkout of the pull request head
 */
export const evaluatePullRequest = async (github, { prNumber, baseDir, prDir }) => {
    const pr = await github.getPullRequest(prNumber);
    const author = pr.user.login;
    const files = await github.listPullRequestFiles(prNumber);
    const { modIds, outside } = classifyChangedFiles(files);
    const authorPermission = await github.getPermission(author);
    const isMaintainer = SIGNER_PERMISSIONS.has(authorPermission);

    if (isMaintainer && (outside.length > 0 || modIds.length === 0)) {
        return { skip: true, pr, errors: [], warnings: [] };
    }

    const errors = [];
    const warnings = [];
    if (pr.base.ref !== 'main') errors.push(`PR 必须合并到 \`main\`，当前目标是 \`${pr.base.ref}\``);
    if (outside.length > 0) {
        errors.push(`社区提交只能修改 \`mods/community/<模组 id>/\` 下的文件，以下文件超出范围：${outside.slice(0, 20).map((file) => `\`${file}\``).join('、')}`);
    }
    if (modIds.length !== 1) {
        errors.push(modIds.length === 0 ? 'PR 没有修改任何 `mods/community/<模组 id>/` 下的文件' : `一个 PR 只能提交一个模组，当前涉及：${modIds.join('、')}`);
        return { skip: false, pr, errors, warnings, modId: modIds[0] ?? null, manifest: null, isUpdate: false, submission: null };
    }

    if (touchedSignatureFiles(files).length > 0) {
        errors.push(`不要提交或修改 \`${SIGNATURE_FILE}\`：签名由维护者审查后通过 CI 生成`);
    }

    const modId = modIds[0];
    const existingDir = path.join(baseDir, 'mods', 'community', modId);
    const existing = fs.existsSync(path.join(existingDir, 'mod.json'))
        ? JSON.parse(fs.readFileSync(path.join(existingDir, 'mod.json'), 'utf8'))
        : null;
    const isUpdate = existing !== null;
    const tree = checkModTree({
        modDir: path.join(prDir, 'mods', 'community', modId),
        modId,
        existing,
        knownModIds: knownModIds(baseDir),
    });
    errors.push(...tree.errors);
    warnings.push(...tree.warnings);

    let submission = null;
    if (isUpdate) {
        const owners = readCommunityRegistry(baseDir).mods[modId]?.owners ?? [];
        if (!owners.includes(author)) warnings.push(`PR 作者 @${author} 不是 \`${modId}\` 的登记维护者（${owners.map((owner) => `@${owner}`).join('、') || '无'}）`);
    } else {
        submission = await findSubmissionIssue(github, prNumber);
        if (!submission) {
            errors.push('新模组需要先按模板开一个「模组提交」issue，并在其中填写本 PR 的链接');
        } else {
            if (submission.issue.user.login !== author) errors.push(`提交 issue #${submission.issue.number} 的作者必须与 PR 作者相同`);
            if (submission.fields.modId !== modId) errors.push(`提交 issue #${submission.issue.number} 填写的模组 id（\`${submission.fields.modId}\`）与 PR 里的目录 \`${modId}\` 不一致`);
            const formErrors = parseSubmissionIssue(submission.issue.body, github.repository).errors;
            if (formErrors.length > 0) errors.push(`提交 issue #${submission.issue.number} 填写不完整`);
        }
    }

    return { skip: false, pr, errors, warnings, modId, manifest: tree.manifest, isUpdate, submission };
};
