// test/ci.test.mjs
// The submission workflow's rules and its signing jobs, without GitHub: the
// issue form and `/sign` parsing, what a submission PR may touch, the mod
// directory checks, the PR evaluation against a fake GitHub client, and the
// merge/sign and re-sign flows against throwaway git repositories.
//
// The key is the test-only "folium-test-vector" key (see signing.test.mjs).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyMod } from '../tools/lib/signing.mjs';
import { readCommunityRegistry } from '../tools/lib/index.mjs';
import {
    FORM_FIELDS,
    checkModTree,
    classifyChangedFiles,
    compareVersions,
    parsePullRequestReference,
    parseSignCommand,
    parseSubmissionIssue,
    renderCheckComment,
    touchedSignatureFiles,
} from '../tools/ci/lib/submission.mjs';
import { evaluatePullRequest } from '../tools/ci/lib/evaluate.mjs';
import { loadSigningKey, mergeAndSign, resignRepository } from '../tools/ci/lib/signflow.mjs';

const REPOSITORY = 'chthollyphile/folium-compound';
const TEST_KEY_ID = 'folium-test-vector';
const TEST_PUBLIC = { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE' };
const TEST_PRIVATE = { ...TEST_PUBLIC, d: 'CmEPWKhK8Rtwoh4xPYIMdKzUh34cc1pJhKqPFaOCWJI' };
const KEY = { keyId: TEST_KEY_ID, privateJwk: TEST_PRIVATE };
const KEYS = [{ keyId: TEST_KEY_ID, label: 'Test', publicKey: TEST_PUBLIC, revoked: false }];

const tempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const issueBody = (overrides = {}) => {
    const values = {
        modId: 'cool-mod',
        pullRequest: '#7',
        source: 'https://github.com/someone/cool-mod',
        description: 'Does cool things.',
        permissions: '无',
        license: 'MIT',
        confirmations: '- [X] author\n- [X] no data\n- [X] reviews',
        ...overrides,
    };
    return Object.entries(FORM_FIELDS).map(([key, label]) => `### ${label}\n\n${values[key]}`).join('\n\n');
};

const writeMod = (root, modId, { version = '1.0.0', manifest = {}, files = {} } = {}) => {
    const dir = path.join(root, 'mods', 'community', modId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'mod.json'), `${JSON.stringify({ folium: 1, id: modId, name: modId, version, client: 'client.mjs', ...manifest }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, 'client.mjs'), 'export default function activate(folium) {}\n');
    Object.entries(files).forEach(([name, content]) => fs.writeFileSync(path.join(dir, name), content));
    return dir;
};

test('the submission issue form reads into fields', () => {
    const { fields, errors } = parseSubmissionIssue(issueBody(), REPOSITORY);
    assert.deepEqual(errors, []);
    assert.deepEqual(fields, { modId: 'cool-mod', pullRequest: 7, source: 'https://github.com/someone/cool-mod', license: 'MIT' });

    const bad = parseSubmissionIssue(issueBody({ modId: 'Cool Mod', pullRequest: 'https://github.com/other/repo/pull/7', source: '_No response_', confirmations: '- [ ] author\n- [X] no data' }), REPOSITORY);
    assert.equal(bad.errors.length, 4);
});

test('pull request references and /sign commands', () => {
    assert.equal(parsePullRequestReference('#12', REPOSITORY), 12);
    assert.equal(parsePullRequestReference('12', REPOSITORY), 12);
    assert.equal(parsePullRequestReference(`https://github.com/${REPOSITORY}/pull/12/files`, REPOSITORY), 12);
    assert.equal(parsePullRequestReference('https://github.com/else/where/pull/12', REPOSITORY), null);

    assert.equal(parseSignCommand('/sign 1a2b3c4d'), '1a2b3c4d');
    assert.equal(parseSignCommand('/sign ABCDEF0123456789\nlooks good'), 'abcdef0123456789');
    assert.equal(parseSignCommand('/sign'), '');
    assert.equal(parseSignCommand('/sign abc'), '');
    assert.equal(parseSignCommand('/signature please'), null);
    assert.equal(parseSignCommand('LGTM /sign 1a2b3c4d'), null);
});

test('changed files are sorted into mod directories and everything else', () => {
    const files = [
        { filename: 'mods/community/a/mod.json' },
        { filename: 'mods/community/a/lib/x.mjs' },
        { filename: 'mods/community/b/folium.sig.json' },
        { filename: '.github/workflows/sign.yml' },
        { filename: 'mods/community/a/new.mjs', previous_filename: 'tools/sign.mjs' },
        { filename: 'mods/community/stray.txt' },
    ];
    assert.deepEqual(classifyChangedFiles(files), {
        modIds: ['a', 'b'],
        outside: ['.github/workflows/sign.yml', 'mods/community/stray.txt', 'tools/sign.mjs'],
    });
    assert.deepEqual(touchedSignatureFiles(files), ['mods/community/b/folium.sig.json']);
    assert.deepEqual(touchedSignatureFiles([{ filename: 'mods/community/a/sub/folium.sig.json' }]), []);
});

test('version comparison', () => {
    assert.ok(compareVersions('1.2.0', '1.1.9') > 0);
    assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
    assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
    assert.ok(Number.isNaN(compareVersions('1.0', '1.0.0')));
});

test('mod directory checks', () => {
    const root = tempDir('folium-tree-');
    const ok = writeMod(root, 'good');
    assert.deepEqual(checkModTree({ modDir: ok, modId: 'good' }).errors, []);

    const mismatched = writeMod(root, 'dir-name', { manifest: { id: 'other-name' } });
    assert.match(checkModTree({ modDir: mismatched, modId: 'dir-name' }).errors.join('\n'), /必须与目录名/);

    const invalid = writeMod(root, 'invalid', { manifest: { permissions: ['root.everything'], client: 'missing.mjs' } });
    const invalidErrors = checkModTree({ modDir: invalid, modId: 'invalid' }).errors.join('\n');
    assert.match(invalidErrors, /unknown or unsupported permission/);
    assert.match(invalidErrors, /入口文件 `missing.mjs` 不存在/);

    const linked = writeMod(root, 'linked');
    fs.symlinkSync('client.mjs', path.join(linked, 'alias.mjs'));
    assert.match(checkModTree({ modDir: linked, modId: 'linked' }).errors.join('\n'), /符号链接/);

    const update = writeMod(root, 'update', { version: '1.0.0' });
    assert.match(checkModTree({ modDir: update, modId: 'update', existing: { version: '1.0.0' } }).errors.join('\n'), /提升版本号/);
    assert.deepEqual(checkModTree({ modDir: update, modId: 'update', existing: { version: '0.9.0' } }).errors, []);

    assert.match(checkModTree({ modDir: ok, modId: 'good', knownModIds: ['good'] }).errors.join('\n'), /已被仓库里的其他模组占用/);
    assert.match(checkModTree({ modDir: path.join(root, 'nope'), modId: 'nope' }).errors.join('\n'), /不存在/);

    const withDependency = writeMod(root, 'dependent', { manifest: { depends: ['base-mod@^1.0.0'] } });
    assert.match(checkModTree({ modDir: withDependency, modId: 'dependent' }).warnings.join('\n'), /base-mod/);
});

test('the check comment asks to wait for review on success and lists problems on failure', () => {
    const passed = renderCheckComment({ marker: '<!-- m -->', errors: [], headSha: 'abcdef0123456789', modId: 'x', manifest: { id: 'x', version: '1.0.0', permissions: ['net.fetch'] } });
    assert.match(passed, /请等待维护者审查/);
    assert.match(passed, /\/sign abcdef012345/);
    assert.match(passed, /net\.fetch/);
    const failed = renderCheckComment({ marker: '<!-- m -->', errors: ['broken'] });
    assert.match(failed, /- broken/);
});

// ---- PR evaluation against a fake GitHub

const fakeGitHub = ({ pr, files, permissions = {}, issues = [] }) => ({
    repository: REPOSITORY,
    getPullRequest: async () => pr,
    listPullRequestFiles: async () => files,
    getPermission: async (user) => permissions[user] ?? 'read',
    listOpenIssuesWithLabel: async () => issues,
});

const prFor = (number, author, overrides = {}) => ({
    number, user: { login: author }, base: { ref: 'main' }, head: { sha: 'f'.repeat(40), label: `${author}:branch` }, title: 'Add mod', state: 'open', ...overrides,
});

const baseRepo = () => {
    const root = tempDir('folium-base-');
    fs.mkdirSync(path.join(root, 'mods', 'official'), { recursive: true });
    fs.writeFileSync(path.join(root, 'community.json'), '{\n  "mods": {}\n}\n');
    return root;
};

test('a new submission passes with a matching issue and fails without one', async () => {
    const base = baseRepo();
    const head = tempDir('folium-head-');
    writeMod(head, 'cool-mod');
    const files = [{ filename: 'mods/community/cool-mod/mod.json' }, { filename: 'mods/community/cool-mod/client.mjs' }];
    const issue = { number: 3, user: { login: 'dev' }, body: issueBody() };

    const passing = await evaluatePullRequest(fakeGitHub({ pr: prFor(7, 'dev'), files, issues: [issue] }), { prNumber: 7, baseDir: base, prDir: head });
    assert.deepEqual(passing.errors, []);
    assert.equal(passing.modId, 'cool-mod');
    assert.equal(passing.isUpdate, false);
    assert.equal(passing.submission.issue.number, 3);

    const orphan = await evaluatePullRequest(fakeGitHub({ pr: prFor(7, 'dev'), files }), { prNumber: 7, baseDir: base, prDir: head });
    assert.match(orphan.errors.join('\n'), /模组提交/);

    const impostor = await evaluatePullRequest(fakeGitHub({ pr: prFor(7, 'dev'), files, issues: [{ ...issue, user: { login: 'someone-else' } }] }), { prNumber: 7, baseDir: base, prDir: head });
    assert.match(impostor.errors.join('\n'), /作者必须与 PR 作者相同/);
});

test('submissions may not reach outside their directory or touch signatures', async () => {
    const base = baseRepo();
    const head = tempDir('folium-head-');
    writeMod(head, 'cool-mod');
    const issue = { number: 3, user: { login: 'dev' }, body: issueBody() };
    const files = [
        { filename: 'mods/community/cool-mod/mod.json' },
        { filename: 'mods/community/cool-mod/folium.sig.json' },
        { filename: '.github/workflows/sign.yml' },
    ];
    const result = await evaluatePullRequest(fakeGitHub({ pr: prFor(7, 'dev'), files, issues: [issue] }), { prNumber: 7, baseDir: base, prDir: head });
    const text = result.errors.join('\n');
    assert.match(text, /\.github\/workflows\/sign\.yml/);
    assert.match(text, /folium\.sig\.json/);

    // The same change from a maintainer is an internal PR, not a submission.
    const maintainer = await evaluatePullRequest(fakeGitHub({ pr: prFor(8, 'boss'), files, permissions: { boss: 'admin' } }), { prNumber: 8, baseDir: base, prDir: head });
    assert.equal(maintainer.skip, true);
});

test('an update needs a version bump and flags authors who are not registered owners', async () => {
    const base = baseRepo();
    writeMod(base, 'cool-mod', { version: '1.0.0' });
    fs.writeFileSync(path.join(base, 'community.json'), JSON.stringify({ mods: { 'cool-mod': { owners: ['dev'] } } }));
    const head = tempDir('folium-head-');
    writeMod(head, 'cool-mod', { version: '1.1.0' });
    const files = [{ filename: 'mods/community/cool-mod/mod.json' }];

    const byOwner = await evaluatePullRequest(fakeGitHub({ pr: prFor(9, 'dev'), files }), { prNumber: 9, baseDir: base, prDir: head });
    assert.equal(byOwner.isUpdate, true);
    assert.deepEqual(byOwner.errors, []);
    assert.deepEqual(byOwner.warnings, []);

    const byStranger = await evaluatePullRequest(fakeGitHub({ pr: prFor(9, 'stranger'), files }), { prNumber: 9, baseDir: base, prDir: head });
    assert.deepEqual(byStranger.errors, []);
    assert.match(byStranger.warnings.join('\n'), /不是 `cool-mod` 的登记维护者/);
});

// ---- signing flows against throwaway git repositories

const git = (cwd, ...args) => execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
}).trim();

const signingRepo = () => {
    const root = baseRepo();
    fs.mkdirSync(path.join(root, 'keys'));
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: KEYS }));
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [] }));
    fs.writeFileSync(path.join(root, 'index.json'), '{}\n');
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'init');
    return root;
};

const submitOnBranch = (root, modId, mutate = () => {}) => {
    git(root, 'switch', '-q', '-c', `pr-${modId}`);
    writeMod(root, modId);
    mutate(root);
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', `add ${modId}`);
    const sha = git(root, 'rev-parse', 'HEAD');
    git(root, 'switch', '-q', 'main');
    return sha;
};

test('mergeAndSign merges the reviewed commit, signs it and registers the owner', () => {
    const root = signingRepo();
    const sha = submitOnBranch(root, 'cool-mod');
    const submission = { issue: { number: 3 }, fields: { source: 'https://github.com/dev/cool-mod' } };
    const result = mergeAndSign({ repoDir: root, prNumber: 7, sha, headLabel: 'dev:branch', title: 'Add cool-mod', author: 'dev', modId: 'cool-mod', submission, key: KEY, runTests: false, now: new Date('2026-01-02T00:00:00Z') });

    assert.equal(git(root, 'rev-parse', `${result.signCommit}~1`), result.mergeCommit);
    assert.equal(git(root, 'rev-parse', `${result.mergeCommit}^2`), sha);
    assert.equal(git(root, 'status', '--porcelain'), '');
    assert.equal(verifyMod(path.join(root, 'mods', 'community', 'cool-mod'), KEYS).status, 'verified');
    assert.deepEqual(readCommunityRegistry(root).mods['cool-mod'], { owners: ['dev'], submission: 3, source: 'https://github.com/dev/cool-mod', addedAt: '2026-01-02' });
    const index = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
    assert.deepEqual(index.mods.map((mod) => [mod.id, mod.origin, mod.owners]), [['cool-mod', 'community', ['dev']]]);
});

test('mergeAndSign refuses a merge that reaches outside the mod and leaves main untouched', () => {
    const root = signingRepo();
    const before = git(root, 'rev-parse', 'HEAD');
    const sha = submitOnBranch(root, 'sneaky', (dir) => fs.writeFileSync(path.join(dir, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: [] })));
    assert.throws(
        () => mergeAndSign({ repoDir: root, prNumber: 8, sha, headLabel: 'x:y', title: 't', author: 'x', modId: 'sneaky', submission: null, key: KEY, runTests: false }),
        /以外的文件/,
    );
    assert.equal(git(root, 'rev-parse', 'HEAD'), before);
    assert.equal(git(root, 'status', '--porcelain'), '');
});

test('resignRepository re-signs what no longer verifies and never re-signs a revoked mod', () => {
    const root = signingRepo();
    const sha = submitOnBranch(root, 'cool-mod');
    mergeAndSign({ repoDir: root, prNumber: 7, sha, headLabel: 'dev:b', title: 't', author: 'dev', modId: 'cool-mod', submission: null, key: KEY, runTests: false });
    const modDir = path.join(root, 'mods', 'community', 'cool-mod');

    // A reviewed update merged through the GitHub UI: content and version changed.
    fs.appendFileSync(path.join(modDir, 'client.mjs'), '// v1.1\n');
    const manifestPath = path.join(modDir, 'mod.json');
    fs.writeFileSync(manifestPath, fs.readFileSync(manifestPath, 'utf8').replace('"1.0.0"', '"1.1.0"'));
    assert.equal(verifyMod(modDir, KEYS).reason, 'mod-mismatch');

    const { resigned } = resignRepository({ root, key: KEY, runTests: false });
    assert.deepEqual(resigned.map((entry) => [entry.modId, entry.version, entry.previous]), [['cool-mod', '1.1.0', 'mod-mismatch']]);
    assert.equal(verifyMod(modDir, KEYS).status, 'verified');
    assert.deepEqual(resignRepository({ root, key: KEY, runTests: false }).resigned, []);

    const { digest } = verifyMod(modDir, KEYS);
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [{ digest }] }));
    assert.throws(() => resignRepository({ root, key: KEY, runTests: false }), /revoked list/);
});

test('the CI key must be an active trusted key', () => {
    const root = signingRepo();
    const json = JSON.stringify({ keyId: TEST_KEY_ID, privateKey: TEST_PRIVATE });
    assert.equal(loadSigningKey(root, json).keyId, TEST_KEY_ID);
    assert.throws(() => loadSigningKey(root, JSON.stringify({ keyId: 'other-key', privateKey: TEST_PRIVATE })), /not an active key/);
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: [{ ...KEYS[0], revoked: true }] }));
    assert.throws(() => loadSigningKey(root, json), /not an active key/);
    assert.throws(() => loadSigningKey(root, ''), /not set/);
});
