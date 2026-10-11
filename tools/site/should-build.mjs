#!/usr/bin/env node
// tools/site/should-build.mjs
// Decides whether a commit is deployed: exits 0 to skip, 1 to build. Used as
// Vercel's ignoreCommand and by `npm run deploy` (Cloudflare Workers Builds).
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
