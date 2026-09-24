// tools/ci/lib/submission.mjs
// The rules for community submissions, as pure functions the workflows call:
// how the two issue forms (new mod, update) read, what a community mod
// directory must look like, and what a maintainer's `/sign <commit>` comment
// means. No network and no git here, so every rule is unit-tested
// (test/ci.test.mjs).
//
// Nothing in this file executes code from a submission. Mod files are read as
// data (mod.json parsed, everything else only hashed).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SIGNATURE_FILE, collectSignedFiles } from '../../lib/signing.mjs';
import { isValidRef, normalizeModPath, normalizeRepositoryUrl } from './source.mjs';

const require = createRequire(import.meta.url);
const { validateManifest, parseDependency } = require('../../vendor/folia-manifest.cjs');

export const MOD_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// Community mods are source trees; tighter than the signed digest's own caps.
export const COMMUNITY_LIMITS = { maxFiles: 300, maxTotalBytes: 16 * 1024 * 1024 };

// Roles that may run `/sign` (GitHub collaborator permission levels).
export const SIGNER_PERMISSIONS = new Set(['admin', 'maintain', 'write']);

// Labels the workflows manage. The two form labels are applied by the issue templates.
export const LABELS = {
    submission: 'mod-submission',
    update: 'mod-update',
    awaitingReview: 'awaiting-review',
    needsChanges: 'needs-changes',
    signed: 'signed',
};

// Headings of the issue forms (.github/ISSUE_TEMPLATE/mod-submission.yml and
// mod-update.yml); keep both sides in sync.
export const FORM_FIELDS = {
    modId: '模组 id / Mod id',
    repository: '源码仓库 / Source repository',
    ref: '版本 / Version (tag or commit)',
    path: '模组目录 / Mod directory',
    description: '模组说明 / Description',
    permissions: '权限说明 / Permissions',
    license: '许可证 / License',
    changes: '更新说明 / What changed',
    confirmations: '确认 / Confirmations',
};

/** Which form an issue is: 'submission', 'update' or null, by its labels. */
export const issueKind = (issue) => {
    const names = (issue?.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name));
    if (names.includes(LABELS.update)) return 'update';
    if (names.includes(LABELS.submission)) return 'submission';
    return null;
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

const checkedAll = (text) => /- \[[xX]\]/.test(text) && !/- \[ \]/.test(text);

/*
 * Reads a submission or update issue. Returns `{ fields, errors }` with
 * `fields.modId`, `fields.ref`, and for a new mod `fields.repository` and
 * `fields.path` (normalized: '' is the repository root).
 */
export const parseSubmissionIssue = (body, kind = 'submission') => {
    const sections = parseIssueFormSections(body);
    const errors = [];
    const modId = (sections[FORM_FIELDS.modId] ?? '').trim();
    if (!MOD_ID_PATTERN.test(modId)) errors.push(`「${FORM_FIELDS.modId}」必须是模组的 id（小写字母、数字和 -），当前是 \`${modId || '空'}\``);
    const ref = (sections[FORM_FIELDS.ref] ?? '').trim();
    if (!isValidRef(ref)) errors.push(`「${FORM_FIELDS.ref}」必须是 tag、分支名或完整的 40 位 commit，当前是 \`${ref || '空'}\``);
    const fields = { modId, ref };
    if (kind === 'submission') {
        const repository = normalizeRepositoryUrl(sections[FORM_FIELDS.repository]);
        if (!repository) errors.push(`「${FORM_FIELDS.repository}」必须是公开仓库的 https 地址（如 https://github.com/you/my-mod）`);
        const modPath = normalizeModPath(sections[FORM_FIELDS.path]);
        if (modPath === null) errors.push(`「${FORM_FIELDS.path}」必须是仓库内的相对路径，根目录留空`);
        Object.assign(fields, { repository, path: modPath ?? '', license: (sections[FORM_FIELDS.license] ?? '').trim() });
    }
    if (!checkedAll(sections[FORM_FIELDS.confirmations] ?? '')) errors.push(`请勾选「${FORM_FIELDS.confirmations}」里的全部项目`);
    return { fields, errors };
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
        return { errors: ['模组目录不存在'], warnings, manifest: null };
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

    if (fs.existsSync(path.join(modDir, SIGNATURE_FILE))) {
        errors.push(`源码里不要包含 \`${SIGNATURE_FILE}\`：签名由维护者审查后通过 CI 生成`);
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
    check: '<!-- folium-bot:check -->',
    sign: '<!-- folium-bot:sign -->',
};

/*
 * The check result comment on a submission or update issue. On success it asks
 * the author to wait for review and gives maintainers the review links, the
 * exact files that would be signed, and the `/sign` command for this commit.
 */
export const renderCheckComment = ({ errors, warnings = [], evaluation = null }) => {
    const lines = [COMMENT_MARKERS.check];
    const source = evaluation?.source;
    const at = source?.commit ? `（\`${source.repository}\` @ \`${source.commit.slice(0, 12)}\`）` : '';
    if (errors.length === 0) {
        lines.push(`✅ 格式检查通过${at}。请等待维护者审查。`);
        lines.push('');
        const manifest = evaluation.manifest;
        const permissions = Array.isArray(manifest.permissions) && manifest.permissions.length > 0 ? manifest.permissions.join(', ') : '无';
        lines.push(`模组：\`${manifest.id}\` ${evaluation.isUpdate ? `${evaluation.previousVersion} → ${manifest.version}` : manifest.version} · 权限：${permissions}${manifest.main ? ' · 含 Node 入口（main）' : ''}`);
        if (evaluation.links?.compare) lines.push(`对比上一个签名版本：${evaluation.links.compare}`);
        if (evaluation.links?.tree) lines.push(`源码：${evaluation.links.tree}`);
        lines.push('');
        lines.push(`<details><summary>将要签名的 ${evaluation.files.length} 个文件（签名摘要 \`${evaluation.digest}\`）</summary>`);
        lines.push('');
        lines.push('```');
        evaluation.files.slice(0, 200).forEach((line) => lines.push(line.trimEnd()));
        if (evaluation.files.length > 200) lines.push(`…（另有 ${evaluation.files.length - 200} 个）`);
        lines.push('```');
        lines.push('</details>');
        lines.push('');
        lines.push(`维护者审查这个提交后，在本 issue 评论 \`/sign ${source.commit.slice(0, 12)}\` 即可签名并收录。作者修改 issue 指向新的提交后，需要按新提交重新审查。`);
    } else {
        lines.push(`❌ 格式检查未通过${at}，请修改后编辑本 issue，会自动重新检查：`);
        lines.push('');
        errors.forEach((error) => lines.push(`- ${error}`));
    }
    if (warnings.length > 0) {
        lines.push('');
        lines.push('需要维护者留意：');
        warnings.forEach((warning) => lines.push(`- ${warning}`));
    }
    return lines.join('\n');
};
