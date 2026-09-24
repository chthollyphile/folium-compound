#!/usr/bin/env node
// tools/ci/check-issue.mjs
// Format check for a submission or update issue (workflow: submission-check.yml).
//
//   node tools/ci/check-issue.mjs --issue <number>
//
// Runs from a checkout of main. Fetches the named commit of the author's
// repository as data, checks it, and posts (or updates) the result comment and
// pass/fail labels on the issue. Exits 1 when the check fails.

import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../lib/repo.mjs';
import { createGitHub, setCheckLabels } from './lib/github.mjs';
import { evaluateIssue } from './lib/evaluate.mjs';
import { COMMENT_MARKERS, LABELS, renderCheckComment } from './lib/submission.mjs';

const { values } = parseArgs({ options: { issue: { type: 'string' } } });
const issueNumber = Number(values.issue);
if (!issueNumber) {
    console.error('usage: check-issue.mjs --issue <number>');
    process.exit(2);
}

const github = createGitHub();
const issue = await github.getIssue(issueNumber);
if (issue.state !== 'open') {
    console.log(`issue #${issueNumber} is closed; nothing to check`);
    process.exit(0);
}

const evaluation = await evaluateIssue(github, { issue, baseDir: REPO_ROOT });
try {
    const passed = evaluation.errors.length === 0;
    await github.upsertComment(issueNumber, COMMENT_MARKERS.check, renderCheckComment({ errors: evaluation.errors, warnings: evaluation.warnings, evaluation }));
    await setCheckLabels(github, issueNumber, passed, LABELS);
    console.log(passed
        ? `#${issueNumber} passed: ${evaluation.source.repository}@${evaluation.source.commit}`
        : `#${issueNumber} failed:\n- ${evaluation.errors.join('\n- ')}`);
    process.exitCode = passed ? 0 : 1;
} finally {
    evaluation.cleanup();
}
