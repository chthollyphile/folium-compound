// tools/ci/lib/submission.mjs
// The rules for community submissions, as pure functions the workflows call:
// what a submission pull request may touch, what a community mod directory must
// look like, how the submission issue form reads, and what a maintainer's
// `/sign <commit>` comment means. No network and no git here, so every rule is
// unit-tested (test/ci.test.mjs).
//
// Nothing in this file executes code from a submission. Mod files are read as
// data (mod.json parsed, everything else only hashed), which is what lets the
// checks run on pull_request_target without exposing anything to the PR.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SIGNATURE_FILE, collectSignedFiles } from '../../lib/signing.mjs';

export { SIGNATURE_FILE };

const require = createRequire(import.meta.url);
const { validateManifest, parseDependency } = require('../../vendor/folia-manifest.cjs');

export const COMMUNITY_PREFIX = 'mods/community/';
export const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// Community mods are source trees; tighter than the signed digest's own caps.
export const COMMUNITY_LIMITS = { maxFiles: 300, maxTotalBytes: 16 * 1024 * 1024 };

// Roles that may run `/sign` (GitHub collaborator permission levels).
export const SIGNER_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

// Labels the workflows manage.
export const LABELS = {
    submission: 'mod-submission',
    awaitingReview: 'awaiting-review',
    needsChanges: 'needs-changes',
    signed: 'signed',
};

// Headings of the issue form (.github/ISSUE_TEMPLATE/mod-submission.yml); keep both in sync.
export const FORM_FIELDS = {
    modId: '模组 id / Mod id',
    pullRequest: '提交 PR / Pull request',
    source: '源码仓库 / Source repository',
    description: '模组说明 / Description',
    permissions: '权限说明 / Permissions',
    license: '许可证 / License',
    confirmations: '确认 / Confirmations',
};

/*
 * Issue forms render as `### <label>\n\n<value>` sections. Returns a map from
 * label to trimmed value; GitHub's "_No response_" for an empty optional field
 * reads as an empty string.
 */
export const parseIssueFormSections = (body) => {
    const sections = {};
    const parts = String(body ?? '').replace(/\r\n/g, '\n').split(/^### +/m).slice(1);
    for (const part of parts) {
        const newline = part.indexOf('\n');
        const label = (newline === -1 ? part : part.slice(0, newline)).trim();
        const value = newline === -1 ? '' : part.slice(newline + 1).trim();
        sections[label] = value === '_No response_' ? '' : value;
    }
    return sections;
};

/** A pull request number from "#12", "12" or a pull URL of this repository; null otherwise. */
export const parsePullRequestReference = (text, repository) => {
    const value = String(text ?? '').trim();
    let match = /^#?(\d+)$/.exec(value);
    if (match) return Number(match[1]);
    match = /^https:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/.exec(value);
    if (match && repository && match[1].toLowerCase() === repository.toLowerCase()) return Number(match[2]);
    return null;
};

/*
 * Reads a submission issue. Returns `{ fields, errors }`: `fields.modId`,
 * `fields.pullRequest` (number) and `fields.source` are what the workflows use.
 */
export const parseSubmissionIssue = (body, repository) => {
    const sections = parseIssueFormSections(body);
    const errors = [];
    const modId = (sections[FORM_FIELDS.modId] ?? '').trim();
    if (!MOD_ID_PATTERN.test(modId)) errors.push(`「${FORM_FIELDS.modId}」必须是模组的 id（小写字母、数字和 -），当前是 \`${modId || '空'}\``);
    const pullRequest = parsePullRequestReference(sections[FORM_FIELDS.pullRequest], repository);
    if (!pullRequest) errors.push(`「${FORM_FIELDS.pullRequest}」必须是本仓库的 PR 链接或编号（如 #12）`);
    const source = (sections[FORM_FIELDS.source] ?? '').trim();
    if (!/^https:\/\/\S+$/.test(source)) errors.push(`「${FORM_FIELDS.source}」必须是 https 链接`);
    const confirmations = sections[FORM_FIELDS.confirmations] ?? '';
    if (/- \[ \]/.test(confirmations) || !/- \[[xX]\]/.test(confirmations)) errors.push(`请勾选「${FORM_FIELDS.confirmations}」里的全部项目`);
    return {
        fields: {
            modId,
            pullRequest,
            source,
            license: (sections[FORM_FIELDS.license] ?? '').trim(),
        },
        errors,
    };
};

/*
 * `/sign <commit>`: the commit (7-40 hex chars) is the one the maintainer
 * reviewed; signing refuses if the pull request has moved past it. Returns the
 * lowercase commit prefix, or null when the comment is not a sign command.
 */
export const parseSignCommand = (body) => {
    const firstLine = String(body ?? '').replace(/\r\n/g, '\n').split('\n')[0].trim();
    if (!/^\/sign(\s|$)/.test(firstLine)) return null;
    const match = /^\/sign\s+([0-9a-fA-F]{7,40})$/.exec(firstLine);
    return match ? match[1].toLowerCase() : '';
};

/*
 * Sorts a pull request's changed files: which community mod directories they
 * touch and which paths fall outside mods/community/<id>/. Renames count on
 * both their old and new path.
 */
export const classifyChangedFiles = (files) => {
    const modIds = new Set();
    const outside = [];
    for (const file of files) {
        for (const filename of [file.filename, file.previous_filename].filter(Boolean)) {
            const rest = filename.startsWith(COMMUNITY_PREFIX) ? filename.slice(COMMUNITY_PREFIX.length) : null;
            const slash = rest ? rest.indexOf('/') : -1;
            if (rest && slash > 0) modIds.add(rest.slice(0, slash));
            else outside.push(filename);
        }
    }
    return { modIds: [...modIds].sort(), outside: [...new Set(outside)].sort() };
};

/*
 * Signature files a pull request adds, changes or deletes. Submitters never
 * touch them: CI writes signatures after review. (An update PR's directory
 * still holds main's old signature; that is expected and not counted here.)
 */
export const touchedSignatureFiles = (files) => files
    .flatMap((file) => [file.filename, file.previous_filename].filter(Boolean))
    .filter((filename) => filename.startsWith(COMMUNITY_PREFIX) && filename.endsWith(`/${SIGNATURE_FILE}`)
        && filename.split('/').length === 4);

const parseVersion = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version ?? ''));
    return match ? match.slice(1).map(Number) : null;
};

/** Semver comparison of MAJOR.MINOR.PATCH strings: negative, zero or positive. */
export const compareVersions = (left, right) => {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) return Number.NaN;
    for (let index = 0; index < 3; index += 1) {
        if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
};

/*
 * Checks one community mod directory as submitted. `existing` is the mod's
 * manifest on main (null for a new mod), `knownModIds` every mod id already in
 * the repository. Returns `{ errors, warnings, manifest }`; errors block review,
 * warnings are for the maintainer.
 */
export const checkModTree = ({ modDir, modId, existing = null, knownModIds = [] }) => {
    const errors = [];
    const warnings = [];
    if (!fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
        return { errors: [`\`mods/community/${modId}/\` 不存在（删除模组需要维护者手动处理）`], warnings, manifest: null };
    }
    if (!MOD_ID_PATTERN.test(modId)) errors.push(`目录名 \`${modId}\` 不是合法的模组 id`);

    let manifest = null;
    try {
        manifest = JSON.parse(fs.readFileSync(path.join(modDir, 'mod.json'), 'utf8'));
    } catch (error) {
        errors.push(`\`mod.json\` 缺失或不是合法的 JSON：${error.message}`);
    }
    if (manifest) {
        const result = validateManifest(manifest);
        if (!result.ok) result.errors.forEach((error) => errors.push(`mod.json：${error}`));
        if (manifest.id !== modId) errors.push(`mod.json 的 id（\`${manifest.id}\`）必须与目录名 \`${modId}\` 相同`);
        for (const entry of [manifest.main, manifest.client].filter((value) => typeof value === 'string')) {
            const entryPath = path.join(modDir, entry);
            if (!entryPath.startsWith(modDir + path.sep) || !fs.existsSync(entryPath)) errors.push(`入口文件 \`${entry}\` 不存在`);
        }
        (Array.isArray(manifest.depends) ? manifest.depends : []).forEach((dependency) => {
            const parsed = parseDependency(dependency);
            if (parsed.ok && !knownModIds.includes(parsed.id)) warnings.push(`依赖 \`${parsed.id}\` 不在本仓库里`);
        });
        if (existing) {
            const order = compareVersions(manifest.version, existing.version);
            if (!(order > 0)) errors.push(`更新必须提升版本号：main 上是 ${existing.version}，提交的是 ${manifest.version}`);
        } else if (knownModIds.includes(modId)) {
            errors.push(`模组 id \`${modId}\` 已被仓库里的其他模组占用`);
        }
    }

    try {
        const files = collectSignedFiles(modDir);
        const totalBytes = files.reduce((sum, file) => sum + fs.statSync(file.absolute).size, 0);
        if (files.length > COMMUNITY_LIMITS.maxFiles) errors.push(`文件过多：${files.length} 个（上限 ${COMMUNITY_LIMITS.maxFiles}）`);
        if (totalBytes > COMMUNITY_LIMITS.maxTotalBytes) errors.push(`体积过大：${totalBytes} 字节（上限 ${COMMUNITY_LIMITS.maxTotalBytes}）`);
    } catch (error) {
        errors.push(`目录无法签名：${error.message}（不能包含符号链接或特殊文件）`);
    }
    return { errors, warnings, manifest };
};

export const COMMENT_MARKERS = {
    pr: '<!-- folium-bot:pr-check -->',
    issue: '<!-- folium-bot:issue-check -->',
    sign: '<!-- folium-bot:sign -->',
};

/*
 * The check result comment. On success it asks the author to wait for review
 * and tells maintainers how to sign; on failure it lists what to fix.
 */
export const renderCheckComment = ({ marker, errors, warnings = [], headSha = null, modId = null, manifest = null, isUpdate = false }) => {
    const lines = [marker];
    const at = headSha ? `（提交 \`${headSha.slice(0, 12)}\`）` : '';
    if (errors.length === 0) {
        lines.push(`✅ 格式检查通过${at}。请等待维护者审查。`);
        lines.push('');
        if (isUpdate) {
            lines.push(`这是对 \`${modId}\` 的更新：维护者审查并合并后，CI 会自动重新签名。`);
        } else {
            lines.push(`维护者审查通过后，在 PR 里评论 \`/sign ${headSha ? headSha.slice(0, 12) : '<commit>'}\` 即可签名并合入。审查之后如果 PR 又有新提交，需要按新提交重新审查。`);
        }
    } else {
        lines.push(`❌ 格式检查未通过${at}，请修改后再推送：`);
        lines.push('');
        errors.forEach((error) => lines.push(`- ${error}`));
    }
    if (warnings.length > 0) {
        lines.push('');
        lines.push('需要维护者留意：');
        warnings.forEach((warning) => lines.push(`- ${warning}`));
    }
    if (manifest && errors.length === 0) {
        const permissions = Array.isArray(manifest.permissions) && manifest.permissions.length > 0 ? manifest.permissions.join(', ') : '无';
        lines.push('');
        lines.push(`模组：\`${manifest.id}\` ${manifest.version} · 权限：${permissions}${manifest.main ? ' · 含 Node 入口（main）' : ''}`);
    }
    return lines.join('\n');
};
