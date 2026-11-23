// tools/lib/awesome.mjs
// Awesome-Folia: works around Folia that this repository does not keep, listed as links to their own
// repositories. Source mods go here by policy (they are not taken into mods/community or mods/beta);
// system plugins, outside programs and developer tools may be listed too. Nothing listed is fetched,
// signed or run by this repository; an entry is only a name, a description and links.
//
// awesome.json is written by the `/list` command on an `awesome-entry` issue (tools/ci/list-awesome.mjs)
// and may be edited by maintainers directly; AWESOME.md is generated from it for readers on GitHub.

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './repo.mjs';
import { CATEGORIES, CATEGORY_IDS } from './categories.mjs';

export const AWESOME_FILE = 'awesome.json';
export const AWESOME_MARKDOWN = 'AWESOME.md';

export const AWESOME_KINDS = Object.freeze([
    { id: 'source', label: { 'zh-CN': '音源模组', en: 'Source mod' } },
    { id: 'plugin', label: { 'zh-CN': '系统插件', en: 'System plugin' } },
    { id: 'app', label: { 'zh-CN': '外部程序', en: 'App' } },
    { id: 'tool', label: { 'zh-CN': '开发工具', en: 'Developer tool' } },
    { id: 'other', label: { 'zh-CN': '其他', en: 'Other' } },
]);
const KIND_IDS = new Set(AWESOME_KINDS.map((kind) => kind.id));

export const AWESOME_LIMITS = { name: 80, description: 600, owners: 8, tags: 8, tag: 24, url: 300 };

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** An https URL without credentials, or null. */
// A link target inside `[…](…)`: the characters that would end it, or start another link, are percent-encoded.
// An https URL keeps `( ) [ ]` as they are, and `https://a/b)[Download](https://elsewhere` would read as two links.
const markdownUrl = (url) => String(url).replace(/[()[\]<>\s]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);

export const httpsUrlOf = (value) => {
    if (typeof value !== 'string' || value.length > AWESOME_LIMITS.url) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') ? url.href : null;
    } catch {
        return null;
    }
};

/*
 * The problems of one entry (empty when it is fine). `ids` are the other entries' ids (and the repository's
 * mod ids), which this one may not reuse.
 */
export const checkAwesomeEntry = (entry, { ids = new Set() } = {}) => {
    const errors = [];
    if (!entry || typeof entry !== 'object') return ['不是一个对象'];
    if (typeof entry.id !== 'string' || !ID_PATTERN.test(entry.id)) errors.push(`id \`${entry.id}\` 只能用小写字母、数字和 -`);
    else if (ids.has(entry.id)) errors.push(`id \`${entry.id}\` 已被占用`);
    if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > AWESOME_LIMITS.name) errors.push(`名称必填，不超过 ${AWESOME_LIMITS.name} 个字`);
    if (!KIND_IDS.has(entry.kind)) errors.push(`类型 \`${entry.kind}\` 不在 ${[...KIND_IDS].join(' / ')} 里`);
    if (entry.category !== undefined && entry.category !== null && !CATEGORY_IDS.has(entry.category)) errors.push(`分类 \`${entry.category}\` 不在分类表里`);
    if (typeof entry.description !== 'string' || !entry.description.trim() || entry.description.length > AWESOME_LIMITS.description) errors.push(`简介必填，不超过 ${AWESOME_LIMITS.description} 个字`);
    if (!httpsUrlOf(entry.url)) errors.push('链接必须是 https 地址');
    for (const field of ['homepage', 'bugs']) {
        if (entry[field] !== undefined && entry[field] !== null && !httpsUrlOf(entry[field])) errors.push(`${field} 必须是 https 地址`);
    }
    if (!Array.isArray(entry.owners) || entry.owners.length === 0 || entry.owners.length > AWESOME_LIMITS.owners
        || !entry.owners.every((owner) => typeof owner === 'string' && OWNER_PATTERN.test(owner))) {
        errors.push(`作者是 1 到 ${AWESOME_LIMITS.owners} 个 GitHub 用户名`);
    }
    if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.length > AWESOME_LIMITS.tags
        || !entry.tags.every((tag) => typeof tag === 'string' && tag.trim() && tag.length <= AWESOME_LIMITS.tag))) {
        errors.push(`标签最多 ${AWESOME_LIMITS.tags} 个，每个不超过 ${AWESOME_LIMITS.tag} 个字`);
    }
    for (const field of ['addedAt', 'updatedAt']) {
        if (typeof entry[field] !== 'string' || !DATE_PATTERN.test(entry[field])) errors.push(`${field} 必须是 YYYY-MM-DD`);
    }
    return errors;
};

export const readAwesome = (root = REPO_ROOT) => {
    const file = path.join(root, AWESOME_FILE);
    if (!fs.existsSync(file)) return { format: 'folium-awesome', version: 1, entries: [] };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { format: 'folium-awesome', version: 1, entries: Array.isArray(parsed?.entries) ? parsed.entries : [] };
};

/** Every problem of awesome.json, by entry. */
export const checkAwesome = (awesome, { modIds = [] } = {}) => {
    const errors = [];
    const ids = new Set(modIds);
    for (const entry of awesome.entries) {
        const problems = checkAwesomeEntry(entry, { ids });
        problems.forEach((problem) => errors.push(`awesome.json ${entry?.id ?? '?'}: ${problem}`));
        if (typeof entry?.id === 'string') ids.add(entry.id);
    }
    return errors;
};

const sortEntries = (entries) => [...entries].sort((left, right) => left.id.localeCompare(right.id, 'en'));

export const writeAwesome = (awesome, root = REPO_ROOT) => {
    const data = { format: 'folium-awesome', version: 1, entries: sortEntries(awesome.entries) };
    fs.writeFileSync(path.join(root, AWESOME_FILE), `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(path.join(root, AWESOME_MARKDOWN), renderAwesomeMarkdown(data));
};

// Markdown text from third parties: no HTML, no link syntax of its own, one line.
const markdownText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().replace(/([\\`*_[\]<>|#])/g, '\\$1');

/** AWESOME.md: the entries by kind, each a link with its authors and description. */
export const renderAwesomeMarkdown = (awesome) => {
    const lines = [
        '# Awesome-Folia',
        '',
        '<!-- 由 awesome.json 生成（tools/lib/awesome.mjs），不要手改 / Generated from awesome.json -->',
        '',
        '不收进本仓库、以外部链接登记的 Folia 相关作品：音源模组、系统插件、外部程序、开发工具等。它们没有经过 Folium 签名，',
        '安装和使用前请自行判断；有问题请到各自的仓库反馈。登记新作品：开一个「Awesome-Folia 登记」issue。',
        '',
        'Folia-related works kept elsewhere and listed here as links. They are not signed by Folium; report problems to their own repositories.',
        '',
    ];
    const categoryName = new Map(CATEGORIES.map((category) => [category.id, category.label['zh-CN']]));
    for (const kind of AWESOME_KINDS) {
        const entries = sortEntries(awesome.entries.filter((entry) => entry.kind === kind.id));
        if (entries.length === 0) continue;
        lines.push(`## ${kind.label['zh-CN']} / ${kind.label.en}`, '');
        for (const entry of entries) {
            const owners = entry.owners.map((owner) => `[@${owner}](https://github.com/${owner})`).join(', ');
            const category = entry.category ? ` · ${categoryName.get(entry.category) ?? entry.category}` : '';
            lines.push(`- [${markdownText(entry.name)}](${markdownUrl(entry.url)}) — ${owners}${category}  `);
            lines.push(`  ${markdownText(entry.description)}`);
        }
        lines.push('');
    }
    return `${lines.join('\n').trimEnd()}\n`;
};
