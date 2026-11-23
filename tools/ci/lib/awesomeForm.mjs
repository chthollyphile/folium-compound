// tools/ci/lib/awesomeForm.mjs
// The awesome-Folia issue form (.github/ISSUE_TEMPLATE/awesome-entry.yml): how it reads, what the format
// check says, and what a maintainer's `/list` does with it. Only the form is checked: the linked repository
// is never fetched or run, because nothing of it enters this repository; an entry is a name, a description
// and links (tools/lib/awesome.mjs). Pure functions, unit-tested in test/ci.test.mjs.

import crypto from 'node:crypto';
import { AWESOME_KINDS, checkAwesomeEntry, httpsUrlOf } from '../../lib/awesome.mjs';
import { parseCategory } from '../../lib/categories.mjs';
import { COMMENT_MARKERS, STALE_DAYS, parseIssueFormSections } from './submission.mjs';

// Headings of the form; keep both sides in sync.
export const AWESOME_FORM_FIELDS = {
    id: '登记 id / Entry id',
    name: '名称 / Name',
    kind: '类型 / Kind',
    url: '链接 / Link',
    description: '简介 / Description',
    owners: '作者 / Authors',
    category: '分类 / Category',
    license: '许可证 / License',
    confirmations: '确认 / Confirmations',
};

/** The form's dropdown text of a kind ("音源模组 / Source mod (source)"). */
export const awesomeKindFormOption = (kind) => `${kind.label['zh-CN']} / ${kind.label.en} (${kind.id})`;

const parseKind = (value) => {
    const text = String(value ?? '').trim();
    const id = /\(([a-z]+)\)\s*$/.exec(text)?.[1] ?? text;
    return AWESOME_KINDS.some((kind) => kind.id === id) ? id : null;
};

// GitHub user names, separated by commas, spaces or new lines, with or without `@`.
const parseOwners = (value) => String(value ?? '')
    .split(/[\s,，、]+/)
    .map((name) => name.replace(/^@/, '').trim())
    .filter(Boolean);

const checkedAll = (text) => /- \[[xX]\]/.test(text) && !/- \[ \]/.test(text);

const sameLogin = (left, right) => String(left).toLowerCase() === String(right).toLowerCase();

/*
 * A short fingerprint of what an entry says. The check comment shows it and `/list <hash>` must repeat it, so
 * what gets listed is what the maintainer read: an issue edited after that reads to another hash and is refused.
 */
export const awesomeEntryHash = (entry) => crypto.createHash('sha256').update(JSON.stringify([
    entry.id, entry.name, entry.kind, entry.category ?? null, entry.description, entry.url, entry.owners, entry.license ?? null,
])).digest('hex').slice(0, 12);

/*
 * Reads an awesome-Folia issue into an entry (without the dates, which `/list` sets). `author` is the
 * issue's author, the owner when the form names none. Returns `{ entry, errors }`; `existing` (the
 * current awesome.json) and `modIds` (the repository's mods) are what the id may not collide with.
 * An id already listed may be reused by one of that entry's owners: the issue then updates it.
 */
export const parseAwesomeIssue = (body, { author, existing = { entries: [] }, modIds = [] }) => {
    const sections = parseIssueFormSections(body);
    const errors = [];
    const owners = parseOwners(sections[AWESOME_FORM_FIELDS.owners]);
    const category = parseCategory(sections[AWESOME_FORM_FIELDS.category]);
    if (category === undefined) errors.push(`「${AWESOME_FORM_FIELDS.category}」请从列表里选一个分类，或选「不分类」`);
    const kind = parseKind(sections[AWESOME_FORM_FIELDS.kind]);
    const entry = {
        id: (sections[AWESOME_FORM_FIELDS.id] ?? '').trim(),
        name: (sections[AWESOME_FORM_FIELDS.name] ?? '').trim(),
        kind: kind ?? String(sections[AWESOME_FORM_FIELDS.kind] ?? '').trim(),
        category: category ?? null,
        description: (sections[AWESOME_FORM_FIELDS.description] ?? '').trim(),
        url: httpsUrlOf(sections[AWESOME_FORM_FIELDS.url]) ?? (sections[AWESOME_FORM_FIELDS.url] ?? '').trim(),
        owners: owners.length > 0 ? owners : [author].filter(Boolean),
        license: (sections[AWESOME_FORM_FIELDS.license] ?? '').trim() || null,
        tags: [],
    };
    const listed = existing.entries.find((other) => other.id === entry.id) ?? null;
    // An update that names no authors keeps the listed ones (GitHub logins are not case-sensitive, below).
    if (listed && owners.length === 0 && Array.isArray(listed.owners) && listed.owners.length > 0) entry.owners = [...listed.owners];
    const taken = new Set([...modIds, ...existing.entries.filter((other) => other !== listed).map((other) => other.id)]);
    // Dates are only checked once `/list` sets them.
    const problems = checkAwesomeEntry({ ...entry, addedAt: '2000-01-01', updatedAt: '2000-01-01' }, { ids: taken });
    errors.push(...problems);
    if (modIds.includes(entry.id)) errors.push(`id \`${entry.id}\` 是本仓库里一个模组的 id，请换一个`);
    if (listed && !(listed.owners ?? []).some((owner) => sameLogin(owner, author))) {
        errors.push(`id \`${entry.id}\` 已经登记过（作者 ${(listed.owners ?? []).map((owner) => `@${owner}`).join('、')}），只有它的作者可以更新；新作品请换一个 id`);
    }
    if (!checkedAll(sections[AWESOME_FORM_FIELDS.confirmations] ?? '')) errors.push(`请勾选「${AWESOME_FORM_FIELDS.confirmations}」里的全部项目`);
    return { entry, errors: [...new Set(errors)], updates: listed };
};

/*
 * `/list <hash>` (first line only): a maintainer lists the entry the check comment showed with that hash.
 * `isListCommand` is true for any `/list` line (a bare one is answered with how to write it); `listCommandHash`
 * gives the hash, or null.
 */
const LIST_LINE = /^\/list(?:\s+([0-9a-f]{12}))?\s*$/;
const firstLine = (body) => String(body ?? '').replace(/\r\n/g, '\n').split('\n')[0].trim();
export const isListCommand = (body) => LIST_LINE.test(firstLine(body));
export const listCommandHash = (body) => LIST_LINE.exec(firstLine(body))?.[1] ?? null;

/*
 * awesome.json with the issue's entry put in (replacing the listed one of the same id, whose `addedAt`
 * it keeps). `today` is YYYY-MM-DD.
 */
export const withAwesomeEntry = (awesome, entry, { issueNumber, today }) => {
    const previous = awesome.entries.find((other) => other.id === entry.id) ?? null;
    const listed = {
        ...entry,
        addedAt: previous?.addedAt ?? today,
        updatedAt: today,
        submission: previous?.submission ?? issueNumber,
        ...(previous ? { lastIssue: issueNumber } : {}),
    };
    if (!listed.license) delete listed.license;
    return { ...awesome, entries: [...awesome.entries.filter((other) => other.id !== entry.id), listed] };
};

/* The format check's comment on an awesome-Folia issue. */
export const renderAwesomeCheckComment = ({ errors, entry, updates = null, checkedAt = null }) => {
    const lines = [COMMENT_MARKERS.check];
    if (checkedAt) lines.push(`<!-- folium-bot:checked-at=${checkedAt} -->`);
    if (errors.length === 0) {
        lines.push(`✅ 格式检查通过。请等待维护者查看${updates ? `：这会更新已登记的 \`${entry.id}\`` : ''}。`);
        lines.push('');
        lines.push(`- ${entry.name}（\`${entry.id}\`，${AWESOME_KINDS.find((kind) => kind.id === entry.kind)?.label['zh-CN'] ?? entry.kind}）：${entry.url}`);
        lines.push(`- 作者：${entry.owners.map((owner) => `@${owner}`).join('、')}`);
        lines.push('');
        lines.push('awesome-Folia 只登记链接，作品不会被取回、签名或执行；模组市场里它显示为「外部链接」，用户从你的仓库安装，问题也会被引到你的仓库。');
        lines.push('');
        lines.push(`维护者看过之后，在本 issue 评论 \`/list ${awesomeEntryHash(entry)}\` 即可登记。issue 之后再改动的话，会重新检查并给出新的命令。`);
    } else {
        lines.push(COMMENT_MARKERS.checkFailed);
        lines.push('❌ 格式检查未通过，请修改后编辑本 issue，会自动重新检查：');
        lines.push('');
        errors.forEach((error) => lines.push(`- ${error}`));
        lines.push('');
        lines.push(`${STALE_DAYS} 天内没有回应（编辑 issue 或在这里评论）的话，这个 issue 会被自动关闭。`);
    }
    return lines.join('\n');
};
