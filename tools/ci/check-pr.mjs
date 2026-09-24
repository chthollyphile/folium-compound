#!/usr/bin/env node
// tools/ci/check-pr.mjs
// Format check for a submission pull request (workflow: submission-check.yml).
//
//   node tools/ci/check-pr.mjs --pr <number> --pr-dir <checkout of the PR head> --expected-sha <sha>
//
// Runs from a checkout of main; the PR checkout is only read as data. Posts
// (or updates) the result comment and pass/fail labels on the pull request
// and, for a new mod, on its submission issue. Exits 1 when the check fails.

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { REPO_ROOT } from '../lib/repo.mjs';
import { createGitHub, setCheckLabels } from './lib/github.mjs';
import { evaluatePullRequest } from './lib/evaluate.mjs';
import { COMMENT_MARKERS, LABELS, renderCheckComment } from './lib/submission.mjs';

const { values } = parseArgs({
    options: {
        pr: { type: 'string' },
        'pr-dir': { type: 'string' },
        'expected-sha': { type: 'string' },
    },
});

const prNumber = Number(values.pr);
if (!prNumber || !values['pr-dir'] || !values['expected-sha']) {
    console.error('usage: check-pr.mjs --pr <number> --pr-dir <dir> --expected-sha <sha>');
    process.exit(2);
}

const checkedOut = execFileSync('git', ['-C', values['pr-dir'], 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (checkedOut !== values['expected-sha']) {
    console.error(`PR checkout is at ${checkedOut}, expected ${values['expected-sha']}; a newer push will be checked by its own run`);
    process.exit(1);
}

const github = createGitHub();
const evaluation = await evaluatePullRequest(github, { prNumber, baseDir: REPO_ROOT, prDir: values['pr-dir'] });
if (evaluation.skip) {
    console.log(`#${prNumber} is a maintainer change outside community submissions; skipping`);
    process.exit(0);
}

const passed = evaluation.errors.length === 0;
const headSha = evaluation.pr.head.sha;
const report = { errors: evaluation.errors, warnings: evaluation.warnings, headSha, modId: evaluation.modId, manifest: evaluation.manifest, isUpdate: evaluation.isUpdate };
await github.upsertComment(prNumber, COMMENT_MARKERS.pr, renderCheckComment({ marker: COMMENT_MARKERS.pr, ...report }));
await setCheckLabels(github, prNumber, passed, LABELS);
if (evaluation.submission) {
    const issueNumber = evaluation.submission.issue.number;
    await github.upsertComment(issueNumber, COMMENT_MARKERS.issue, renderCheckComment({ marker: COMMENT_MARKERS.issue, ...report }));
    await setCheckLabels(github, issueNumber, passed, LABELS);
}

console.log(passed ? `#${prNumber} passed` : `#${prNumber} failed:\n- ${evaluation.errors.join('\n- ')}`);
process.exit(passed ? 0 : 1);
