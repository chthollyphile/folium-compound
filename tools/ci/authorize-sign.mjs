#!/usr/bin/env node
// tools/ci/authorize-sign.mjs
// First job of sign.yml, which holds no secrets: decides whether a `/sign`
// comment may trigger signing. It must be a comment on an open submission or
// update issue, by someone with write access or more, naming the commit the
// issue currently resolves to (the commit the maintainer reviewed). The ref is
// resolved again here, so a tag moved or an issue edited after review is
// refused.
//
// Writes `authorized`, `issue` and `commit` to $GITHUB_OUTPUT. Refusals are
// answered with a comment; only an authorized run reaches the signing job.

import fs from 'node:fs';
import { REPO_ROOT } from '../lib/repo.mjs';
import { readCommunityRegistry } from '../lib/index.mjs';
import { createGitHub } from './lib/github.mjs';
import { resolveRef } from './lib/source.mjs';
import { COMMENT_MARKERS, SIGNER_PERMISSIONS, issueKind, parseSignCommand, parseSubmissionIssue } from './lib/submission.mjs';

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const output = (values) => {
    if (!process.env.GITHUB_OUTPUT) return;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
};

const command = parseSignCommand(event.comment?.body);
if (command === null) {
    output({ authorized: 'false' });
    process.exit(0);
}

const github = createGitHub();
const number = event.issue.number;
const commenter = event.comment.user.login;
const refuse = async (reason) => {
    await github.comment(number, `${COMMENT_MARKERS.sign}\n@${commenter} 没有执行签名：${reason}`);
    output({ authorized: 'false' });
    console.log(`refused: ${reason}`);
    process.exit(0);
};

const permission = await github.getPermission(commenter);
if (!SIGNER_PERMISSIONS.has(permission)) await refuse('只有仓库维护者可以签名。');
if (event.issue.pull_request) await refuse('模组通过「模组提交 / 模组更新」issue 签名，不在 PR 里签名。');
const issue = await github.getIssue(number);
const kind = issueKind(issue);
if (!kind) await refuse('这个 issue 不是模组提交或模组更新。');
if (issue.state !== 'open') await refuse('issue 已经关闭。');
if (command === '') await refuse('请写明审查过的提交：`/sign <commit>`（至少 7 位）。');

const { fields, errors } = parseSubmissionIssue(issue.body, kind);
if (errors.length > 0) await refuse('issue 表单没有通过检查。');
const repository = kind === 'submission' ? fields.repository : readCommunityRegistry(REPO_ROOT).mods[fields.modId]?.source;
if (!repository) await refuse(`找不到 \`${fields.modId}\` 的源码仓库。`);
let commit;
try {
    commit = resolveRef(repository, fields.ref);
} catch (error) {
    await refuse(`无法解析版本 \`${fields.ref}\`：${error.message}`);
}
if (!commit.startsWith(command)) {
    await refuse(`\`${fields.ref}\` 现在指向 \`${commit.slice(0, 12)}\`，不是你审查的 \`${command}\`。请审查新提交后再评论。`);
}

await github.react(event.comment.id, 'eyes');
output({ authorized: 'true', issue: String(number), commit });
console.log(`authorized: #${number} ${repository}@${commit} by ${commenter} (${permission})`);
