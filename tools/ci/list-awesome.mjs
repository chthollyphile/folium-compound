#!/usr/bin/env node
// tools/ci/list-awesome.mjs
// A maintainer commented `/list` on an awesome-Folia issue (workflow: list.yml): put the entry the issue
// describes into awesome.json (and AWESOME.md), push main, report and close the issue.
//
//   node tools/ci/list-awesome.mjs
//
// Reads the comment from $GITHUB_EVENT_PATH. Only someone with write access or more may list; the issue
// must be open, pass the same format check as submission-check.yml (read again here), and still read to the
// hash the command names, the one in the check comment the maintainer read: an issue edited since is refused
// rather than listed as it now reads (`/sign <commit>` pins a mod the same way). Nothing behind the entry's links is fetched or run, and this job holds no secrets:
// an entry is data only. Like the signing job, a push rejected because main moved is redone on top of it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { REPO_ROOT } from '../lib/repo.mjs';
import { readAwesome, writeAwesome, AWESOME_FILE, AWESOME_MARKDOWN } from '../lib/awesome.mjs';
import { createGitHub } from './lib/github.mjs';
import { knownModIds } from './lib/evaluate.mjs';
import { BOT_IDENTITY } from './lib/signflow.mjs';
import { COMMENT_MARKERS, LABELS, SIGNER_PERMISSIONS, checkIssueTitle, issueKind } from './lib/submission.mjs';
import { awesomeEntryHash, isListCommand, listCommandHash, parseAwesomeIssue, withAwesomeEntry } from './lib/awesomeForm.mjs';

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
if (!isListCommand(event.comment?.body)) process.exit(0);

const github = createGitHub();
const number = event.issue.number;
const commenter = event.comment.user.login;
const refuse = async (reason) => {
    await github.comment(number, `${COMMENT_MARKERS.sign}\n@${commenter} 没有登记：${reason}`);
    console.log(`refused: ${reason}`);
    process.exit(0);
};

const git = (args) => execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: BOT_IDENTITY.name, GIT_AUTHOR_EMAIL: BOT_IDENTITY.email, GIT_COMMITTER_NAME: BOT_IDENTITY.name, GIT_COMMITTER_EMAIL: BOT_IDENTITY.email },
}).trim();

if (!SIGNER_PERMISSIONS.has(await github.getPermission(commenter))) await refuse('只有仓库维护者可以登记。');
if (event.issue.pull_request) await refuse('awesome-Folia 通过「awesome-Folia 登记」issue 登记。');
const issue = await github.getIssue(number);
if (issueKind(issue) !== 'awesome') await refuse('这个 issue 不是 awesome-Folia 登记。');
if (issue.state !== 'open') await refuse('issue 已经关闭。');
const wantedHash = listCommandHash(event.comment.body);
if (!wantedHash) await refuse('请照格式检查评论里写的评论 `/list <校验码>`：校验码对应你看过的那一版内容。');

const today = new Date().toISOString().slice(0, 10);
let entry = null;
let updated = false;
for (let attempt = 1; ; attempt++) {
    // Read against main as it is now, so a racing `/list` of the same id is refused instead of overwritten.
    const existing = readAwesome(REPO_ROOT);
    const parsed = parseAwesomeIssue(issue.body, { author: issue.user.login, existing, modIds: knownModIds(REPO_ROOT) });
    const titleError = checkIssueTitle(issue.title, 'awesome');
    if (titleError) parsed.errors.unshift(titleError);
    if (parsed.errors.length > 0) await refuse(`格式检查未通过：\n- ${parsed.errors.join('\n- ')}`);
    if (awesomeEntryHash(parsed.entry) !== wantedHash) {
        await refuse('issue 的内容和校验码对不上：检查之后它被改过。请看最新的格式检查评论，确认无误后用那里的新命令。');
    }
    entry = parsed.entry;
    updated = Boolean(parsed.updates);
    writeAwesome(withAwesomeEntry(existing, entry, { issueNumber: number, today }), REPO_ROOT);
    git(['add', AWESOME_FILE, AWESOME_MARKDOWN]);
    git(['commit', '-q', '-m', `awesome: ${updated ? 'update' : 'list'} ${entry.id}\n\nListed from #${number} by @${commenter}: ${entry.url}`]);
    try {
        git(['push', 'origin', 'HEAD:main']);
        break;
    } catch (error) {
        if (attempt >= 5) {
            await github.comment(number, `${COMMENT_MARKERS.sign}\n❌ 登记失败：推送 main 失败（已尝试 5 次）。main 没有任何改动。`);
            console.error(String(error.stderr ?? error.message));
            process.exit(1);
        }
        git(['fetch', '-q', 'origin', 'main']);
        git(['reset', '-q', '--hard', 'FETCH_HEAD']);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * attempt);
    }
}

const commit = git(['rev-parse', 'HEAD']);
await github.comment(number, `${COMMENT_MARKERS.sign}\n✅ \`${entry.id}\` ${updated ? '已更新' : '已登记'}到 awesome-Folia（${commit.slice(0, 12)}）。站点重新部署后，它会以「外部链接」出现在模组市场和 AWESOME.md 里。\n\n以后要改名称、简介或链接，再开一个 awesome-Folia 登记 issue、填同一个 id 即可。`);
await github.removeLabel(number, LABELS.awaitingReview);
await github.addLabels(number, [LABELS.listed]);
await github.closeIssue(number);
console.log(`listed ${entry.id} in ${commit}`);
