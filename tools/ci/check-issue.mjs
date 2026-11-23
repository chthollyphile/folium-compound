#!/usr/bin/env node
// tools/ci/check-issue.mjs
// Format check for a submission, update or awesome-Folia issue (workflow: submission-check.yml).
//
//   node tools/ci/check-issue.mjs --issue <number>
//
// Runs from a checkout of main. A second submission for a mod its author
// already has an open submission for is closed and sent back to the first one
// (updates may be opened any number of times). Otherwise fetches the named
// commit of the author's repository as data, checks it, and posts (or updates)
// the result comment and pass/fail labels on the issue. Exits 1 when the check
// fails.

import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../lib/repo.mjs';
import { readAwesome } from '../lib/awesome.mjs';
import { createGitHub, setCheckLabels } from './lib/github.mjs';
import { evaluateIssue, knownModIds } from './lib/evaluate.mjs';
import { COMMENT_MARKERS, LABELS, checkIssueTitle, findEarlierSubmission, issueKind, renderCheckComment, renderDuplicateComment, takenBySubmissionError } from './lib/submission.mjs';
import { parseAwesomeIssue, renderAwesomeCheckComment } from './lib/awesomeForm.mjs';

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

// awesome-Folia: only the form is checked; the linked repository is never fetched.
if (issueKind(issue) === 'awesome') {
    const parsed = parseAwesomeIssue(issue.body, { author: issue.user.login, existing: readAwesome(REPO_ROOT), modIds: knownModIds(REPO_ROOT) });
    const titleError = checkIssueTitle(issue.title, 'awesome');
    if (titleError) parsed.errors.unshift(titleError);
    const passed = parsed.errors.length === 0;
    await github.upsertComment(issueNumber, COMMENT_MARKERS.check, renderAwesomeCheckComment({ ...parsed, checkedAt: new Date().toISOString() }));
    await setCheckLabels(github, issueNumber, passed, LABELS);
    console.log(passed ? `#${issueNumber} passed: awesome entry ${parsed.entry.id}` : `#${issueNumber} failed:\n- ${parsed.errors.join('\n- ')}`);
    process.exit(passed ? 0 : 1);
}

const earlier = issueKind(issue) === 'submission'
    ? findEarlierSubmission(issue, await github.listOpenIssues(LABELS.submission))
    : null;
if (earlier?.sameAuthor) {
    await github.upsertComment(issueNumber, COMMENT_MARKERS.duplicate, renderDuplicateComment(earlier));
    await github.removeLabel(issueNumber, LABELS.awaitingReview);
    await github.removeLabel(issueNumber, LABELS.needsChanges);
    await github.addLabels(issueNumber, [LABELS.duplicate]);
    await github.closeIssue(issueNumber, 'duplicate');
    console.log(`#${issueNumber} closed: duplicate of #${earlier.original.number} (${earlier.modId})`);
    process.exit(0);
}

const evaluation = await evaluateIssue(github, { issue, baseDir: REPO_ROOT });
if (earlier) evaluation.errors.push(takenBySubmissionError(earlier));
try {
    const passed = evaluation.errors.length === 0;
    await github.upsertComment(issueNumber, COMMENT_MARKERS.check, renderCheckComment({ errors: evaluation.errors, warnings: evaluation.warnings, evaluation, checkedAt: new Date().toISOString() }));
    await setCheckLabels(github, issueNumber, passed, LABELS);
    console.log(passed
        ? `#${issueNumber} passed: ${evaluation.source.repository}@${evaluation.source.commit}`
        : `#${issueNumber} failed:\n- ${evaluation.errors.join('\n- ')}`);
    process.exitCode = passed ? 0 : 1;
} finally {
    evaluation.cleanup();
}
