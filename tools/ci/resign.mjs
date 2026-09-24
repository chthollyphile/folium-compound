#!/usr/bin/env node
// tools/ci/resign.mjs
// Workflow resign.yml (environment: signing), on every push to main: re-signs
// mods whose signature no longer verifies (a reviewed update was merged, a
// maintainer added or edited a mod, a key was rotated), rebuilds index.json,
// and runs the repository-wide check. Commits and pushes only when something
// changed. Pushes made with the workflow token start no new workflow runs, so
// this cannot loop.

import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from '../lib/repo.mjs';
import { BOT_IDENTITY, loadSigningKey, resignRepository } from './lib/signflow.mjs';

const git = (...args) => execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
        ...process.env,
        GIT_AUTHOR_NAME: BOT_IDENTITY.name,
        GIT_AUTHOR_EMAIL: BOT_IDENTITY.email,
        GIT_COMMITTER_NAME: BOT_IDENTITY.name,
        GIT_COMMITTER_EMAIL: BOT_IDENTITY.email,
    },
}).trim();

const { resigned } = resignRepository({ root: REPO_ROOT, key: loadSigningKey(REPO_ROOT) });

if (git('status', '--porcelain') === '') {
    console.log('every mod verifies and index.json is current; nothing to do');
    process.exit(0);
}

const summary = resigned.map((entry) => `${entry.modId}@${entry.version}`).join(', ');
const details = resigned.map((entry) => `- ${entry.path}: ${entry.previous} -> signed`).join('\n');
git('add', '-A', 'mods', 'index.json');
git('commit', '-m', resigned.length > 0 ? `chore(sign): 自动续签 ${summary}\n\n${details}` : 'chore(index): 更新 index.json');
git('push', 'origin', 'HEAD:main');
console.log(resigned.length > 0 ? `re-signed ${summary}` : 'updated index.json');
