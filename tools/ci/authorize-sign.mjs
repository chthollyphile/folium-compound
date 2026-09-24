#!/usr/bin/env node
// tools/ci/authorize-sign.mjs
// First job of sign.yml, which holds no secrets: decides whether a `/sign`
// comment may trigger signing. It must be a comment on an open pull request
// into main, by someone with write access or more, naming the commit that is
// still the pull request's head (the commit the maintainer reviewed).
//
// Writes `authorized`, `pr` and `sha` to $GITHUB_OUTPUT. Refusals are answered
// with a comment; only an authorized run reaches the signing job and its key.

import fs from 'node:fs';
import { createGitHub } from './lib/github.mjs';
import { COMMENT_MARKERS, SIGNER_PERMISSIONS, parseSignCommand } from './lib/submission.mjs';

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

if (!event.issue.pull_request) await refuse('`/sign` 只能在 PR 里评论。');

const permission = await github.getPermission(commenter);
if (!SIGNER_PERMISSIONS.has(permission)) await refuse('只有仓库维护者可以签名。');
if (command === '') await refuse('请写明审查过的提交：`/sign <commit>`（至少 7 位）。');

const pr = await github.getPullRequest(number);
if (pr.state !== 'open') await refuse('PR 已经关闭。');
if (pr.base.ref !== 'main') await refuse('PR 的目标分支不是 `main`。');
if (!pr.head.sha.startsWith(command)) {
    await refuse(`PR 的最新提交是 \`${pr.head.sha.slice(0, 12)}\`，不是你审查的 \`${command}\`。请审查新提交后再评论。`);
}

await github.react(event.comment.id, 'eyes');
output({ authorized: 'true', pr: String(number), sha: pr.head.sha });
console.log(`authorized: #${number} at ${pr.head.sha} by ${commenter} (${permission})`);
