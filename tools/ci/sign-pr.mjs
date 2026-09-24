#!/usr/bin/env node
// tools/ci/sign-pr.mjs
// Second job of sign.yml (environment: signing): signs and merges a submission
// that authorize-sign.mjs approved.
//
//   node tools/ci/sign-pr.mjs --pr <number> --sha <reviewed commit>
//
// Runs in a full checkout of main. Re-checks that the pull request still points
// at the reviewed commit, fetches exactly that commit, re-runs the submission
// check on it, then merges, signs, commits and pushes main in one push. GitHub
// marks the pull request merged once its commit is on main; the submission
// issue is closed.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../lib/repo.mjs';
import { createGitHub } from './lib/github.mjs';
import { evaluatePullRequest } from './lib/evaluate.mjs';
import { loadSigningKey, mergeAndSign } from './lib/signflow.mjs';
import { COMMENT_MARKERS, LABELS } from './lib/submission.mjs';

const { values } = parseArgs({ options: { pr: { type: 'string' }, sha: { type: 'string' } } });
const prNumber = Number(values.pr);
const sha = values.sha;
if (!prNumber || !/^[0-9a-f]{40}$/.test(sha ?? '')) {
    console.error('usage: sign-pr.mjs --pr <number> --sha <40-char commit>');
    process.exit(2);
}

const github = createGitHub();
const git = (...args) => execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
const fail = async (reason) => {
    await github.comment(prNumber, `${COMMENT_MARKERS.sign}\n❌ 签名失败：${reason}\n\nmain 没有任何改动。`);
    console.error(reason);
    process.exit(1);
};

const pr = await github.getPullRequest(prNumber);
if (pr.state !== 'open' || pr.head.sha !== sha) await fail(`PR 在授权之后发生了变化（最新提交 \`${pr.head.sha.slice(0, 12)}\`）。`);

git('fetch', '--no-tags', 'origin', `+refs/pull/${prNumber}/head:refs/remotes/pull/${prNumber}`);
if (git('rev-parse', `refs/remotes/pull/${prNumber}`) !== sha) await fail('取到的 PR 提交与审查的提交不一致。');

// Re-run the submission check on exactly the reviewed commit, in a separate worktree.
const prDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-pr-'));
git('worktree', 'add', '--detach', prDir, sha);
let evaluation;
try {
    evaluation = await evaluatePullRequest(github, { prNumber, baseDir: REPO_ROOT, prDir });
} finally {
    git('worktree', 'remove', '--force', prDir);
}
if (evaluation.skip) await fail('这不是社区模组提交（修改了 mods/community 以外的文件），请按普通 PR 审查合并。');
if (evaluation.errors.length > 0) await fail(`格式检查未通过：\n- ${evaluation.errors.join('\n- ')}`);

let result;
try {
    result = mergeAndSign({
        repoDir: REPO_ROOT,
        prNumber,
        sha,
        headLabel: pr.head.label,
        title: pr.title,
        author: pr.user.login,
        modId: evaluation.modId,
        submission: evaluation.submission,
        key: loadSigningKey(REPO_ROOT),
    });
} catch (error) {
    await fail(error.message);
}

try {
    git('push', 'origin', 'HEAD:main');
} catch (error) {
    await fail(`推送 main 失败（可能有人同时推送了 main，重新评论一次即可）：${String(error.stderr ?? error.message).trim()}`);
}

const { record, signCommit } = result;
await github.comment(prNumber, `${COMMENT_MARKERS.sign}\n✅ 已签名并合入 main（${signCommit.slice(0, 12)}）：\`${record.modId}\` ${record.modVersion}，签名密钥 \`${record.keyId}\`，签名摘要 \`${record.digest}\`。\n\n之后对这个模组的更新请继续提交 PR；维护者审查合并后 CI 会自动重新签名。`);
await github.removeLabel(prNumber, LABELS.awaitingReview);
await github.addLabels(prNumber, [LABELS.signed]);
if (evaluation.submission) {
    const issueNumber = evaluation.submission.issue.number;
    await github.comment(issueNumber, `${COMMENT_MARKERS.sign}\n✅ \`${record.modId}\` ${record.modVersion} 已通过审查，签名并收录（#${prNumber}）。`);
    await github.removeLabel(issueNumber, LABELS.awaitingReview);
    await github.addLabels(issueNumber, [LABELS.signed]);
    await github.closeIssue(issueNumber);
}
console.log(`signed ${record.modId}@${record.modVersion} in ${signCommit}`);
