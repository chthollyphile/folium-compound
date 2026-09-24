#!/usr/bin/env node
// tools/ci/check-issue.mjs
// First half of the submission issue check (workflow: submission-check.yml):
// reads the issue form and resolves the pull request it names.
//
//   node tools/ci/check-issue.mjs --issue <number>
//
// On a bad form or an unusable pull request it comments on the issue and exits
// 1. Otherwise it writes `pr` and `sha` to $GITHUB_OUTPUT; the workflow then
// checks out that commit and runs check-pr.mjs, which reports on both the
// issue and the pull request.

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { createGitHub, setCheckLabels } from './lib/github.mjs';
import { COMMENT_MARKERS, LABELS, parseSubmissionIssue, renderCheckComment } from './lib/submission.mjs';

const { values } = parseArgs({ options: { issue: { type: 'string' } } });
const issueNumber = Number(values.issue);
if (!issueNumber) {
    console.error('usage: check-issue.mjs --issue <number>');
    process.exit(2);
}

const github = createGitHub();
const issue = await github.getIssue(issueNumber);
const { fields, errors } = parseSubmissionIssue(issue.body, github.repository);

let pr = null;
if (fields.pullRequest) {
    try {
        pr = await github.getPullRequest(fields.pullRequest);
    } catch (error) {
        if (error.status !== 404) throw error;
        errors.push(`本仓库没有 PR #${fields.pullRequest}`);
    }
}
if (pr) {
    if (pr.state !== 'open') errors.push(`PR #${pr.number} 不是打开状态`);
    if (pr.user.login !== issue.user.login) errors.push(`PR #${pr.number} 的作者必须与本 issue 的作者相同`);
}

if (errors.length > 0) {
    await github.upsertComment(issueNumber, COMMENT_MARKERS.issue, renderCheckComment({ marker: COMMENT_MARKERS.issue, errors }));
    await setCheckLabels(github, issueNumber, false, LABELS);
    console.error(`issue #${issueNumber} failed:\n- ${errors.join('\n- ')}`);
    process.exit(1);
}

if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `pr=${pr.number}\nsha=${pr.head.sha}\n`);
}
console.log(`issue #${issueNumber} names PR #${pr.number} at ${pr.head.sha}`);
