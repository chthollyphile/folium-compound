#!/usr/bin/env node
// tools/ci/sign-issue.mjs
// Second job of sign.yml (environment: signing): imports and signs the mod a
// maintainer approved with `/sign <commit>`.
//
//   node tools/ci/sign-issue.mjs --issue <number> --commit <reviewed commit> [--beta true]
//
// Runs in a checkout of main. Re-evaluates the issue (the commit must still be
// the one approved), imports exactly the staged files into the channel the
// issue asks for (beta when the maintainer said `/sign <commit> beta`), signs
// with that channel's key, commits and pushes main once, then reports on the
// issue and closes it.

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../lib/repo.mjs';
import { createGitHub } from './lib/github.mjs';
import { evaluateIssue } from './lib/evaluate.mjs';
import { importAndSign, loadSigningKey } from './lib/signflow.mjs';
import { CHANNEL_TEXT, COMMENT_MARKERS, LABELS } from './lib/submission.mjs';

const { values } = parseArgs({ options: { issue: { type: 'string' }, commit: { type: 'string' }, beta: { type: 'string', default: 'false' } } });
const issueNumber = Number(values.issue);
const approved = values.commit;
if (!issueNumber || !/^[0-9a-f]{40}$/.test(approved ?? '')) {
    console.error('usage: sign-issue.mjs --issue <number> --commit <40-char commit>');
    process.exit(2);
}

const github = createGitHub();
const fail = async (reason) => {
    await github.comment(issueNumber, `${COMMENT_MARKERS.sign}\n❌ 签名失败：${reason}\n\nmain 没有任何改动。`);
    console.error(reason);
    process.exit(1);
};

const issue = await github.getIssue(issueNumber);
const evaluation = await evaluateIssue(github, { issue, baseDir: REPO_ROOT });
// A maintainer may demote a release request to beta, never the other way round.
const demoted = values.beta === 'true' && evaluation.channel !== 'beta';
const channel = values.beta === 'true' ? 'beta' : evaluation.channel;
let result;
try {
    if (evaluation.errors.length > 0) await fail(`格式检查未通过：\n- ${evaluation.errors.join('\n- ')}`);
    if (evaluation.source.commit !== approved) await fail(`issue 现在指向 \`${evaluation.source.commit.slice(0, 12)}\`，与授权的提交不一致。`);
    try {
        result = importAndSign({
            repoDir: REPO_ROOT,
            stagedDir: evaluation.stagedDir,
            modId: evaluation.modId,
            kind: evaluation.kind,
            channel,
            author: issue.user.login,
            authorId: issue.user.id,
            issueNumber,
            source: evaluation.source,
            key: loadSigningKey(REPO_ROOT, undefined, channel),
        });
    } catch (error) {
        await fail(error.message);
    }
} finally {
    evaluation.cleanup();
}

try {
    execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
    await fail(`推送 main 失败（可能有人同时推送了 main，重新评论一次即可）：${String(error.stderr ?? error.message).trim()}`);
}

const { record, commit } = result;
const action = evaluation.isUpdate ? `已更新到 ${record.modVersion}` : `已收录 ${record.modVersion}`;
const channelNote = demoted ? `（维护者改为收录到「${CHANNEL_TEXT.beta.name}」：只通过了安全审查）` : '';
await github.comment(issueNumber, `${COMMENT_MARKERS.sign}\n✅ \`${record.modId}\` ${action}，发布渠道「${CHANNEL_TEXT[channel].name}」${channelNote}，签名并合入 main（${commit.slice(0, 12)}）。\n\n来源：${evaluation.source.repository} @ \`${evaluation.source.commit.slice(0, 12)}\` · 签名密钥 \`${record.keyId}\` · 签名摘要 \`${record.digest}\`\n\n之后发布新版本时，请开一个「模组更新」issue。`);
await github.removeLabel(issueNumber, LABELS.awaitingReview);
await github.addLabels(issueNumber, [LABELS.signed]);
await github.closeIssue(issueNumber);
console.log(`signed ${record.modId}@${record.modVersion} (${channel}) in ${commit}`);
