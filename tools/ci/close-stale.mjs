#!/usr/bin/env node
// tools/ci/close-stale.mjs
// Daily job (workflow: stale-submissions.yml): closes submission and update
// issues whose format check failed and whose author has not responded (edited
// the issue or commented) for STALE_DAYS days.
//
//   node tools/ci/close-stale.mjs [--dry-run]

import { parseArgs } from 'node:util';
import { createGitHub } from './lib/github.mjs';
import { LABELS, isStaleFailure, renderStaleComment } from './lib/submission.mjs';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const github = createGitHub();
const now = Date.now();

for (const issue of await github.listOpenIssues(LABELS.needsChanges)) {
    const comments = await github.listComments(issue.number);
    if (!isStaleFailure({ issue, comments, now })) continue;
    console.log(`#${issue.number} has had a failed check with no response; ${values['dry-run'] ? 'would close' : 'closing'}`);
    if (values['dry-run']) continue;
    await github.comment(issue.number, renderStaleComment());
    await github.closeIssue(issue.number, 'not_planned');
}
