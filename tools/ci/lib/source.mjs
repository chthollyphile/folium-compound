// tools/ci/lib/source.mjs
// Getting a community mod out of its author's own repository.
//
// A submission names a repository (https), a ref (tag, branch or full commit)
// and the directory inside the repository that holds mod.json. The ref is
// resolved to a commit once, and everything after that is bound to the commit:
// what the maintainer reviews, what `/sign <commit>` names, and what gets
// imported and signed. Moving a tag later changes nothing already reviewed.
//
// The repository is fetched as data: a shallow fetch of one commit, no hooks,
// no submodules, no LFS, and nothing from it is ever executed. Only the mod
// directory is staged for import, minus dot entries (.git, .github, editor
// files) and node_modules.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const FULL_SHA = /^[0-9a-f]{40}$/;
const FETCH_TIMEOUT_MS = 120_000;

/*
 * Validates a submitted repository URL: https, no credentials, no query or
 * fragment. Returns the normalized URL (no trailing slash or .git) or null.
 */
export const normalizeRepositoryUrl = (value) => {
    let url;
    try {
        url = new URL(String(value ?? '').trim());
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    const pathname = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
    if (!/^\/[^/]+\/.+/.test(pathname)) return null;
    return `https://${url.host}${pathname}`;
};

/*
 * The directory inside the repository that holds mod.json: '' for the root,
 * otherwise a forward-slash relative path. Null when it tries to leave the
 * repository.
 */
export const normalizeModPath = (value) => {
    const raw = String(value ?? '').trim().replace(/^\.\/+/, '').replace(/\/+$/, '');
    if (raw === '' || raw === '.') return '';
    if (raw.startsWith('/') || raw.includes('\\') || /^[a-zA-Z]:/.test(raw)) return null;
    const segments = raw.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return null;
    return segments.join('/');
};

/** A ref is a full commit, or a tag/branch name git would accept. */
export const isValidRef = (value) => {
    const ref = String(value ?? '').trim();
    if (FULL_SHA.test(ref.toLowerCase())) return true;
    return /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(ref) && !ref.includes('..') && !ref.endsWith('.lock') && !ref.endsWith('/');
};

/*
 * Picks the commit for `ref` out of `git ls-remote` output. Annotated tags are
 * listed twice; the peeled `^{}` line is the commit. Tags win over branches of
 * the same name.
 */
export const pickCommitFromLsRemote = (output, ref) => {
    const lines = String(output).split('\n').map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 2);
    const find = (name) => lines.find(([, refName]) => refName === name)?.[0] ?? null;
    return find(`refs/tags/${ref}^{}`) ?? find(`refs/tags/${ref}`) ?? find(`refs/heads/${ref}`) ?? null;
};

const gitEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_LFS_SKIP_SMUDGE: '1',
    GIT_CONFIG_NOSYSTEM: '1',
};

const git = (args, { cwd, allowLocal = false } = {}) => execFileSync('git', [
    '-c', `protocol.file.allow=${allowLocal ? 'always' : 'never'}`,
    '-c', 'protocol.ext.allow=never',
    '-c', 'core.hooksPath=/dev/null',
    '-c', 'submodule.recurse=false',
    '-c', 'advice.detachedHead=false',
    ...args,
], { cwd, env: gitEnv, encoding: 'utf8', timeout: FETCH_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/*
 * Resolves a ref to a full commit. A full commit is taken as given (the fetch
 * proves it exists); tags and branches go through `git ls-remote`.
 * `allowLocal` permits file paths (tests only).
 */
export const resolveRef = (url, ref, { allowLocal = false } = {}) => {
    const value = String(ref).trim();
    if (FULL_SHA.test(value.toLowerCase())) return value.toLowerCase();
    const output = git(['ls-remote', '--tags', '--heads', url, value, `${value}^{}`], { allowLocal });
    const commit = pickCommitFromLsRemote(output, value);
    if (!commit) throw new Error(`仓库里找不到 tag 或分支 \`${value}\``);
    return commit;
};

/*
 * Fetches exactly `commit` from `url` into a fresh directory and checks it out.
 * `ref` (a tag or branch name) is fetched by name when given, for hosts that
 * refuse fetching arbitrary commits; either way the checkout must be `commit`.
 * Returns the checkout directory.
 */
export const fetchCommit = (url, commit, { ref = null, allowLocal = false } = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-source-'));
    git(['init', '-q', dir]);
    git(['remote', 'add', 'origin', url], { cwd: dir });
    const wants = [commit, ...(ref && !FULL_SHA.test(ref) ? [ref] : [])];
    let fetched = false;
    let lastError = null;
    for (const want of wants) {
        try {
            git(['fetch', '-q', '--depth', '1', '--no-tags', '--no-recurse-submodules', 'origin', want], { cwd: dir, allowLocal });
            if (git(['rev-parse', 'FETCH_HEAD'], { cwd: dir }) === commit) {
                fetched = true;
                break;
            }
        } catch (error) {
            lastError = error;
        }
    }
    if (!fetched) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw new Error(`无法从仓库取得提交 \`${commit.slice(0, 12)}\`${lastError ? `：${String(lastError.stderr ?? lastError.message).trim().split('\n').pop()}` : ''}`);
    }
    git(['checkout', '-q', '--detach', 'FETCH_HEAD'], { cwd: dir });
    return dir;
};

/* Entries that never become part of an imported mod. */
export const isExcludedFromImport = (segment) => segment.startsWith('.') || segment === 'node_modules';

/*
 * Copies the mod directory out of a checkout into `<stagingRoot>/<modId>/`,
 * leaving out excluded entries. Symlinks are copied as symlinks so the
 * signability check rejects them instead of silently following them.
 * Returns the staged directory, or throws when the directory is missing.
 */
export const stageModFiles = (checkoutDir, modPath, modId, stagingRoot) => {
    const sourceDir = modPath ? path.join(checkoutDir, ...modPath.split('/')) : checkoutDir;
    if (!fs.existsSync(sourceDir) || !fs.lstatSync(sourceDir).isDirectory()) {
        throw new Error(`仓库里没有目录 \`${modPath || '/'}\``);
    }
    const target = path.join(stagingRoot, modId);
    fs.mkdirSync(target, { recursive: true });
    const copy = (from, to) => {
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
            if (isExcludedFromImport(entry.name)) continue;
            const source = path.join(from, entry.name);
            const destination = path.join(to, entry.name);
            if (entry.isSymbolicLink()) {
                fs.symlinkSync(fs.readlinkSync(source), destination);
            } else if (entry.isDirectory()) {
                fs.mkdirSync(destination);
                copy(source, destination);
            } else if (entry.isFile()) {
                fs.copyFileSync(source, destination);
            }
        }
    };
    copy(sourceDir, target);
    return target;
};

/*
 * Browser links a maintainer reviews with: the mod directory at the commit,
 * and for an update the comparison with the previously signed commit. Known
 * hosts only (GitHub, GitLab, Codeberg/Gitea); null elsewhere.
 */
export const reviewLinks = (repository, commit, modPath, previousCommit = null) => {
    const host = new URL(repository).host;
    const suffix = modPath ? `/${modPath}` : '';
    if (host === 'github.com') {
        return {
            tree: `${repository}/tree/${commit}${suffix}`,
            compare: previousCommit ? `${repository}/compare/${previousCommit}...${commit}` : null,
        };
    }
    if (host === 'gitlab.com') {
        return {
            tree: `${repository}/-/tree/${commit}${suffix}`,
            compare: previousCommit ? `${repository}/-/compare/${previousCommit}...${commit}` : null,
        };
    }
    if (host === 'codeberg.org') {
        return {
            tree: `${repository}/src/commit/${commit}${suffix}`,
            compare: previousCommit ? `${repository}/compare/${previousCommit}...${commit}` : null,
        };
    }
    return { tree: null, compare: null };
};
