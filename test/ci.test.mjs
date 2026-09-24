// test/ci.test.mjs
// The community submission workflow without GitHub: the two issue forms, the
// source repository rules (URL, directory, ref resolution, staging), the
// `/sign` command, the mod directory checks, issue evaluation against a fake
// GitHub client with a local git repository standing in for the author's
// repository, and the import/sign and re-sign flows in throwaway repositories.
//
// The key is the test-only "folium-test-vector" key (see signing.test.mjs).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SIGNATURE_FILE, signMod, verifyMod } from '../tools/lib/signing.mjs';
import { readCommunityRegistry } from '../tools/lib/index.mjs';
import {
    FORM_FIELDS,
    checkModTree,
    compareVersions,
    issueKind,
    parseSignCommand,
    parseSubmissionIssue,
    renderCheckComment,
} from '../tools/ci/lib/submission.mjs';
import {
    isValidRef,
    normalizeModPath,
    normalizeRepositoryUrl,
    pickCommitFromLsRemote,
    reviewLinks,
    stageModFiles,
} from '../tools/ci/lib/source.mjs';
import { evaluateIssue } from '../tools/ci/lib/evaluate.mjs';
import { importAndSign, loadSigningKey, resignRepository } from '../tools/ci/lib/signflow.mjs';

const TEST_KEY_ID = 'folium-test-vector';
const TEST_PUBLIC = { kty: 'OKP', crv: 'Ed25519', x: 'eFPb57OC44VB-NMjj74WnUVLARt7gz38aBcXpykspvE' };
const TEST_PRIVATE = { ...TEST_PUBLIC, d: 'CmEPWKhK8Rtwoh4xPYIMdKzUh34cc1pJhKqPFaOCWJI' };
const KEY = { keyId: TEST_KEY_ID, privateJwk: TEST_PRIVATE };
const KEYS = [{ keyId: TEST_KEY_ID, label: 'Test', publicKey: TEST_PUBLIC, revoked: false }];
const SOURCE_URL = 'https://example.test/dev/cool-mod';

const tempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

const git = (cwd, ...args) => execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' },
}).trim();

const submissionBody = (overrides = {}) => {
    const values = {
        modId: 'cool-mod',
        repository: SOURCE_URL,
        ref: 'v1.0.0',
        path: 'dist/cool-mod',
        description: 'Does cool things.',
        permissions: '无',
        license: 'MIT',
        confirmations: '- [X] author\n- [X] no data\n- [X] reviews',
        ...overrides,
    };
    return ['modId', 'repository', 'ref', 'path', 'description', 'permissions', 'license', 'confirmations']
        .map((key) => `### ${FORM_FIELDS[key]}\n\n${values[key]}`).join('\n\n');
};

const updateBody = (overrides = {}) => {
    const values = { modId: 'cool-mod', ref: 'v1.1.0', changes: 'Faster.', confirmations: '- [X] no data', ...overrides };
    return ['modId', 'ref', 'changes', 'confirmations'].map((key) => `### ${FORM_FIELDS[key]}\n\n${values[key]}`).join('\n\n');
};

const manifestText = (modId, version, extra = {}) => `${JSON.stringify({ folium: 1, id: modId, name: modId, version, client: 'client.mjs', ...extra }, null, 2)}\n`;

// ---- pure rules

test('issue forms read into fields', () => {
    const submission = parseSubmissionIssue(submissionBody({ repository: 'https://github.com/dev/cool-mod.git/', path: './dist/cool-mod/' }), 'submission');
    assert.deepEqual(submission.errors, []);
    assert.deepEqual(submission.fields, { modId: 'cool-mod', ref: 'v1.0.0', repository: 'https://github.com/dev/cool-mod', path: 'dist/cool-mod', license: 'MIT' });
    assert.equal(parseSubmissionIssue(submissionBody({ path: '_No response_' }), 'submission').fields.path, '');

    const bad = parseSubmissionIssue(submissionBody({ modId: 'Cool Mod', repository: 'http://x.test/a/b', ref: 'a..b', path: '../escape', confirmations: '- [ ] author' }), 'submission');
    assert.equal(bad.errors.length, 5);

    const update = parseSubmissionIssue(updateBody(), 'update');
    assert.deepEqual(update, { fields: { modId: 'cool-mod', ref: 'v1.1.0' }, errors: [] });
    assert.equal(issueKind({ labels: [{ name: 'mod-update' }] }), 'update');
    assert.equal(issueKind({ labels: ['mod-submission'] }), 'submission');
    assert.equal(issueKind({ labels: [] }), null);
});

test('source repository rules', () => {
    assert.equal(normalizeRepositoryUrl('https://github.com/a/b'), 'https://github.com/a/b');
    assert.equal(normalizeRepositoryUrl('https://gitlab.com/group/sub/repo.git'), 'https://gitlab.com/group/sub/repo');
    for (const bad of ['http://github.com/a/b', 'https://user:pw@github.com/a/b', 'https://github.com/a', 'https://github.com/a/b?x=1', 'file:///etc', 'git@github.com:a/b.git']) {
        assert.equal(normalizeRepositoryUrl(bad), null, bad);
    }
    assert.equal(normalizeModPath(''), '');
    assert.equal(normalizeModPath('./a/b/'), 'a/b');
    for (const bad of ['../a', 'a/../b', '/abs', 'a\\b', 'C:/x']) assert.equal(normalizeModPath(bad), null, bad);
    assert.ok(isValidRef('v1.0.0') && isValidRef('release/2') && isValidRef('a'.repeat(40)));
    assert.ok(!isValidRef('') && !isValidRef('-x') && !isValidRef('a..b') && !isValidRef('x.lock'));

    const lsRemote = [
        '1111111111111111111111111111111111111111\trefs/heads/v2',
        '2222222222222222222222222222222222222222\trefs/tags/v2',
        '3333333333333333333333333333333333333333\trefs/tags/v2^{}',
        '4444444444444444444444444444444444444444\trefs/heads/main',
    ].join('\n');
    assert.equal(pickCommitFromLsRemote(lsRemote, 'v2'), '3333333333333333333333333333333333333333');
    assert.equal(pickCommitFromLsRemote(lsRemote, 'main'), '4444444444444444444444444444444444444444');
    assert.equal(pickCommitFromLsRemote(lsRemote, 'missing'), null);

    assert.deepEqual(reviewLinks('https://github.com/a/b', 'c'.repeat(40), 'dist/m', 'p'.repeat(40)), {
        tree: `https://github.com/a/b/tree/${'c'.repeat(40)}/dist/m`,
        compare: `https://github.com/a/b/compare/${'p'.repeat(40)}...${'c'.repeat(40)}`,
    });
    assert.deepEqual(reviewLinks('https://example.test/a/b', 'c'.repeat(40), ''), { tree: null, compare: null });
});

test('/sign commands', () => {
    assert.equal(parseSignCommand('/sign 1a2b3c4d'), '1a2b3c4d');
    assert.equal(parseSignCommand('/sign ABCDEF0123456789\nlooks good'), 'abcdef0123456789');
    assert.equal(parseSignCommand('/sign'), '');
    assert.equal(parseSignCommand('/sign abc'), '');
    assert.equal(parseSignCommand('/signature please'), null);
    assert.equal(parseSignCommand('LGTM /sign 1a2b3c4d'), null);
});

test('version comparison', () => {
    assert.ok(compareVersions('1.2.0', '1.1.9') > 0);
    assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
    assert.equal(compareVersions('2.0.0', '2.0.0'), 0);
    assert.ok(Number.isNaN(compareVersions('1.0', '1.0.0')));
});

const writeModDir = (dir, modId, { version = '1.0.0', manifest = {}, files = {} } = {}) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'mod.json'), manifestText(modId, version, manifest));
    fs.writeFileSync(path.join(dir, 'client.mjs'), 'export default function activate(folium) {}\n');
    Object.entries(files).forEach(([name, content]) => {
        fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
        fs.writeFileSync(path.join(dir, name), content);
    });
    return dir;
};

test('mod directory checks', () => {
    const root = tempDir('folium-tree-');
    const ok = writeModDir(path.join(root, 'good'), 'good');
    assert.deepEqual(checkModTree({ modDir: ok, modId: 'good' }).errors, []);

    const mismatched = writeModDir(path.join(root, 'dir-name'), 'other-name');
    assert.match(checkModTree({ modDir: mismatched, modId: 'dir-name' }).errors.join('\n'), /必须与目录名/);

    const invalid = writeModDir(path.join(root, 'invalid'), 'invalid', { manifest: { permissions: ['root.everything'], client: 'missing.mjs' } });
    const invalidErrors = checkModTree({ modDir: invalid, modId: 'invalid' }).errors.join('\n');
    assert.match(invalidErrors, /unknown or unsupported permission/);
    assert.match(invalidErrors, /入口文件 `missing.mjs` 不存在/);

    const signed = writeModDir(path.join(root, 'signed'), 'signed', { files: { [SIGNATURE_FILE]: '{}' } });
    assert.match(checkModTree({ modDir: signed, modId: 'signed' }).errors.join('\n'), /folium\.sig\.json/);

    const linked = writeModDir(path.join(root, 'linked'), 'linked');
    fs.symlinkSync('client.mjs', path.join(linked, 'alias.mjs'));
    assert.match(checkModTree({ modDir: linked, modId: 'linked' }).errors.join('\n'), /符号链接/);

    assert.match(checkModTree({ modDir: ok, modId: 'good', existing: { version: '1.0.0' } }).errors.join('\n'), /提升版本号/);
    assert.deepEqual(checkModTree({ modDir: ok, modId: 'good', existing: { version: '0.9.0' } }).errors, []);
    assert.match(checkModTree({ modDir: ok, modId: 'good', knownModIds: ['good'] }).errors.join('\n'), /已被仓库里的其他模组占用/);
});

test('staging leaves out dot entries and node_modules', () => {
    const checkout = tempDir('folium-checkout-');
    writeModDir(path.join(checkout, 'pkg'), 'cool-mod', {
        files: { '.eslintrc': 'x', '.github/workflows/ci.yml': 'x', 'node_modules/dep/index.js': 'x', 'lib/util.mjs': 'export {};\n', 'LICENSE': 'MIT\n' },
    });
    fs.writeFileSync(path.join(checkout, 'README.md'), 'outside the mod directory');
    const staged = stageModFiles(checkout, 'pkg', 'cool-mod', tempDir('folium-stage-'));
    const list = (dir, prefix = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
        entry.isDirectory() ? list(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]
    )).sort();
    assert.deepEqual(list(staged), ['LICENSE', 'client.mjs', 'lib/util.mjs', 'mod.json']);
    assert.throws(() => stageModFiles(checkout, 'nope', 'cool-mod', tempDir('folium-stage-')), /没有目录/);
});

test('the check comment shows the review links, the files and the /sign command', () => {
    const commit = 'a'.repeat(40);
    const text = renderCheckComment({
        errors: [],
        evaluation: {
            isUpdate: true,
            previousVersion: '1.0.0',
            manifest: { id: 'x', version: '1.1.0', permissions: ['net.fetch'] },
            source: { repository: 'https://github.com/a/b', commit },
            links: { tree: 'https://tree', compare: 'https://compare' },
            files: ['h1 client.mjs\n', 'h2 mod.json\n'],
            digest: 'sha256:d',
        },
    });
    assert.match(text, /请等待维护者审查/);
    assert.match(text, /1\.0\.0 → 1\.1\.0/);
    assert.match(text, /https:\/\/compare/);
    assert.match(text, /h2 mod\.json/);
    assert.match(text, /\/sign aaaaaaaaaaaa/);
    assert.match(renderCheckComment({ errors: ['broken'] }), /- broken/);
});

// ---- evaluation against a local "author repository"

/* The author's repository: the mod under dist/cool-mod, tagged (annotated) per version. */
const sourceRepo = () => {
    const dir = tempDir('folium-author-');
    git(dir, 'init', '-q', '-b', 'main');
    const release = (version, extraFiles = {}) => {
        writeModDir(path.join(dir, 'dist', 'cool-mod'), 'cool-mod', { version, files: { '.editorconfig': 'root = true\n', ...extraFiles } });
        fs.writeFileSync(path.join(dir, 'README.md'), `# cool-mod ${version}\n`);
        git(dir, 'add', '-A');
        git(dir, 'commit', '-q', '-m', `v${version}`);
        git(dir, 'tag', '-a', `v${version}`, '-m', `v${version}`);
        return git(dir, 'rev-parse', 'HEAD');
    };
    return { dir, release };
};

const baseRepo = () => {
    const root = tempDir('folium-base-');
    fs.mkdirSync(path.join(root, 'mods', 'official'), { recursive: true });
    fs.mkdirSync(path.join(root, 'keys'));
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: KEYS }));
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [] }));
    fs.writeFileSync(path.join(root, 'community.json'), '{\n  "mods": {}\n}\n');
    fs.writeFileSync(path.join(root, 'index.json'), '{}\n');
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'init');
    return root;
};

const fakeGitHub = (permissions = {}) => ({ getPermission: async (user) => permissions[user] ?? 'read' });

const issueFor = (kind, body, author = 'dev') => ({ number: kind === 'update' ? 12 : 11, user: { login: author, id: 4242 }, labels: [{ name: kind === 'update' ? 'mod-update' : 'mod-submission' }], body, state: 'open' });

const evaluate = (issue, baseDir, source, permissions) => evaluateIssue(fakeGitHub(permissions), {
    issue, baseDir, fetchUrlFor: (url) => (url === SOURCE_URL ? source.dir : url), allowLocal: true,
});

test('a new submission is fetched at the tagged commit, staged and checked', async () => {
    const source = sourceRepo();
    const commit = source.release('1.0.0');
    const base = baseRepo();
    const evaluation = await evaluate(issueFor('submission', submissionBody()), base, source);
    try {
        assert.deepEqual(evaluation.errors, []);
        assert.deepEqual(evaluation.source, { repository: SOURCE_URL, path: 'dist/cool-mod', ref: 'v1.0.0', commit });
        assert.deepEqual(evaluation.files.map((line) => line.slice(65, -1)), ['client.mjs', 'mod.json']);
        assert.match(evaluation.digest, /^sha256:/);
        assert.equal(evaluation.manifest.version, '1.0.0');
    } finally {
        evaluation.cleanup();
    }

    const pinned = await evaluate(issueFor('submission', submissionBody({ ref: commit })), base, source);
    assert.equal(pinned.source.commit, commit);
    pinned.cleanup();

    const missingTag = await evaluate(issueFor('submission', submissionBody({ ref: 'v9.9.9' })), base, source);
    assert.match(missingTag.errors.join('\n'), /找不到 tag 或分支/);
    const wrongDir = await evaluate(issueFor('submission', submissionBody({ path: 'src' })), base, source);
    assert.match(wrongDir.errors.join('\n'), /没有目录/);
    wrongDir.cleanup();
});

test('imported submissions are signed and registered; updates need an owner and a higher version', async () => {
    const source = sourceRepo();
    const firstCommit = source.release('1.0.0', { 'old.mjs': 'export {};\n' });
    const base = baseRepo();

    const submission = await evaluate(issueFor('submission', submissionBody()), base, source);
    const imported = importAndSign({
        repoDir: base, stagedDir: submission.stagedDir, modId: 'cool-mod', kind: 'submission', author: 'dev', authorId: 4242,
        issueNumber: 11, source: submission.source, key: KEY, runTests: false, now: new Date('2026-01-02T00:00:00Z'),
    });
    submission.cleanup();
    const modDir = path.join(base, 'mods', 'community', 'cool-mod');
    assert.equal(verifyMod(modDir, KEYS).status, 'verified');
    assert.equal(fs.existsSync(path.join(modDir, '.editorconfig')), false);
    assert.equal(git(base, 'status', '--porcelain'), '');
    assert.match(git(base, 'log', '-1', '--format=%B'), /Imported from https:\/\/example\.test\/dev\/cool-mod@[0-9a-f]{40} \(dist\/cool-mod\), reviewed in #11/);
    assert.match(git(base, 'log', '-1', '--format=%B'), /Co-authored-by: dev <4242\+dev@users\.noreply\.github\.com>/);
    assert.equal(imported.record.modVersion, '1.0.0');
    assert.deepEqual(readCommunityRegistry(base).mods['cool-mod'], {
        owners: ['dev'], submission: 11, source: SOURCE_URL, path: 'dist/cool-mod', commit: firstCommit, version: '1.0.0', addedAt: '2026-01-02', updatedAt: '2026-01-02',
    });
    const index = JSON.parse(fs.readFileSync(path.join(base, 'index.json'), 'utf8'));
    assert.deepEqual(index.mods.map((mod) => [mod.id, mod.origin, mod.owners, mod.sourceCommit]), [['cool-mod', 'community', ['dev'], firstCommit]]);

    // A second submission of the same id is refused.
    const again = await evaluate(issueFor('submission', submissionBody()), base, source);
    assert.match(again.errors.join('\n'), /已被占用/);

    // v1.1.0 drops old.mjs; only the owner (or a maintainer) may submit it.
    fs.rmSync(path.join(source.dir, 'dist', 'cool-mod', 'old.mjs'));
    const secondCommit = source.release('1.1.0');
    const stranger = await evaluate(issueFor('update', updateBody(), 'mallory'), base, source);
    assert.match(stranger.errors.join('\n'), /只有 `cool-mod` 的登记维护者/);
    const maintainer = await evaluate(issueFor('update', updateBody(), 'boss'), base, source, { boss: 'maintain' });
    assert.deepEqual(maintainer.errors, []);
    maintainer.cleanup();

    const update = await evaluate(issueFor('update', updateBody()), base, source);
    assert.deepEqual(update.errors, []);
    assert.equal(update.previousVersion, '1.0.0');
    assert.equal(update.source.commit, secondCommit);
    importAndSign({ repoDir: base, stagedDir: update.stagedDir, modId: 'cool-mod', kind: 'update', author: 'dev', issueNumber: 12, source: update.source, key: KEY, runTests: false, now: new Date('2026-02-03T00:00:00Z') });
    update.cleanup();
    assert.equal(fs.existsSync(path.join(modDir, 'old.mjs')), false, 'files dropped upstream are dropped here');
    assert.equal(verifyMod(modDir, KEYS).status, 'verified');
    assert.deepEqual(readCommunityRegistry(base).mods['cool-mod'], {
        owners: ['dev'], submission: 11, source: SOURCE_URL, path: 'dist/cool-mod', commit: secondCommit, version: '1.1.0', addedAt: '2026-01-02', updatedAt: '2026-02-03', lastIssue: 12,
    });

    // Re-submitting the same version is refused.
    const stale = await evaluate(issueFor('update', updateBody()), base, source);
    assert.match(stale.errors.join('\n'), /提升版本号/);
    stale.cleanup();
});

test('a failed import leaves main exactly as it was', async () => {
    const source = sourceRepo();
    source.release('1.0.0');
    const base = baseRepo();
    const before = git(base, 'rev-parse', 'HEAD');
    const evaluation = await evaluate(issueFor('submission', submissionBody()), base, source);
    // A key the repository does not trust: the final repository check fails.
    const untrusted = { keyId: 'someone-else', privateJwk: TEST_PRIVATE };
    assert.throws(() => importAndSign({ repoDir: base, stagedDir: evaluation.stagedDir, modId: 'cool-mod', kind: 'submission', author: 'dev', issueNumber: 11, source: evaluation.source, key: untrusted, runTests: false }), /does not verify/);
    evaluation.cleanup();
    assert.equal(git(base, 'rev-parse', 'HEAD'), before);
    assert.equal(git(base, 'status', '--porcelain', '--untracked-files=all'), '');
});

test('resignRepository re-signs what no longer verifies and never re-signs a revoked mod', () => {
    const root = baseRepo();
    const modDir = writeModDir(path.join(root, 'mods', 'official', 'tool'), 'tool');
    fs.writeFileSync(path.join(modDir, SIGNATURE_FILE), JSON.stringify(signMod(modDir, { keyId: TEST_KEY_ID, privateJwk: TEST_PRIVATE })));
    assert.deepEqual(resignRepository({ root, key: KEY, runTests: false }).resigned, []);

    fs.appendFileSync(path.join(modDir, 'client.mjs'), '// edited on main\n');
    const { resigned } = resignRepository({ root, key: KEY, runTests: false });
    assert.deepEqual(resigned.map((entry) => [entry.modId, entry.previous]), [['tool', 'digest-mismatch']]);
    assert.equal(verifyMod(modDir, KEYS).status, 'verified');

    const { digest } = verifyMod(modDir, KEYS);
    fs.writeFileSync(path.join(root, 'keys', 'revoked-mods.json'), JSON.stringify({ digests: [{ digest }] }));
    assert.throws(() => resignRepository({ root, key: KEY, runTests: false }), /revoked list/);
});

test('the CI key must be an active trusted key', () => {
    const root = baseRepo();
    const json = JSON.stringify({ keyId: TEST_KEY_ID, privateKey: TEST_PRIVATE });
    assert.equal(loadSigningKey(root, json).keyId, TEST_KEY_ID);
    assert.throws(() => loadSigningKey(root, JSON.stringify({ keyId: 'other-key', privateKey: TEST_PRIVATE })), /not an active key/);
    fs.writeFileSync(path.join(root, 'keys', 'trusted-keys.json'), JSON.stringify({ keys: [{ ...KEYS[0], revoked: true }] }));
    assert.throws(() => loadSigningKey(root, json), /not an active key/);
    assert.throws(() => loadSigningKey(root, ''), /not set/);
});
