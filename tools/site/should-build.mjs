#!/usr/bin/env node
// tools/site/should-build.mjs
// Vercel "Ignored Build Step" (vercel.json ignoreCommand). Vercel skips the
// build when this exits 0 and builds when it exits 1.
//
// A commit where some mod does not verify is skipped: typically a reviewed
// update was just merged and resign.yml has not pushed the new signature yet.
// Skipping keeps the previous deployment live; the re-sign commit that follows
// verifies and gets deployed.

import { buildIndex } from '../lib/index.mjs';

const { errors } = buildIndex();
if (errors.length > 0) {
    console.log('skipping deploy: the repository does not fully verify yet (waiting for CI to re-sign):');
    errors.forEach((error) => console.log(`  ${error}`));
    process.exit(0);
}
console.log('every mod verifies; building');
process.exit(1);
