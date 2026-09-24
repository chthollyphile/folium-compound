#!/usr/bin/env node
// tools/build-index.mjs
// Writes index.json: one entry per mod with its identity, origin, signature
// and (for community mods) owners and source from community.json. Only
// verified mods are listed; an unsigned or invalid mod stops the build, so the
// index can never advertise a mod the app would not verify.
//
//   node tools/build-index.mjs            write index.json
//   node tools/build-index.mjs --check    fail if index.json is out of date (CI)

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildIndex } from './lib/index.mjs';
import { REPO_ROOT } from './lib/repo.mjs';

const { values } = parseArgs({ options: { check: { type: 'boolean', default: false } } });

const { text, errors, mods } = buildIndex();
if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
}

const indexPath = path.join(REPO_ROOT, 'index.json');
if (values.check) {
    const current = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
    if (current !== text) {
        console.error('index.json is out of date: run `npm run index`');
        process.exit(1);
    }
    console.log(`index.json is up to date (${mods.length} mods)`);
} else {
    fs.writeFileSync(indexPath, text);
    console.log(`wrote index.json (${mods.length} mods)`);
}
