// test/awesome.test.mjs
// awesome-Folia and the market's categories: the entry rules, the issue form and what `/list` writes,
// AWESOME.md, the category and tag tables, and the submission rules that send source mods to awesome-Folia.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkAwesome, checkAwesomeEntry, httpsUrlOf, readAwesome, renderAwesomeMarkdown, writeAwesome } from '../tools/lib/awesome.mjs';
import { CATEGORIES, autoTagsOf, categoryFormOption, categoryOf, parseCategory } from '../tools/lib/categories.mjs';
import { AWESOME_FORM_FIELDS, awesomeEntryHash, isListCommand, listCommandHash, parseAwesomeIssue, renderAwesomeCheckComment, withAwesomeEntry } from '../tools/ci/lib/awesomeForm.mjs';
import { checkIssueTitle, hostRangeUpperBoundNote, issueKind, sourceModRefusal } from '../tools/ci/lib/submission.mjs';

const entry = (more = {}) => ({
    id: 'outside', name: 'Outside', kind: 'source', category: null, description: 'A source kept elsewhere.',
    url: 'https://github.com/me/outside', owners: ['me'], tags: [], addedAt: '2026-11-01', updatedAt: '2026-11-02', ...more,
});

const formBody = (overrides = {}) => {
    const values = {
        id: 'my-source',
        name: '我的音源',
        kind: '音源模组 / Source mod (source)',
        url: 'https://github.com/dev/my-source',
        description: 'Plays songs from somewhere.',
        owners: '',
        category: '不分类 / None',
        license: 'MIT',
        confirmations: '- [X] author\n- [X] no data\n- [X] not signed',
        ...overrides,
    };
    return Object.keys(AWESOME_FORM_FIELDS).filter((key) => values[key] !== undefined)
        .map((key) => `### ${AWESOME_FORM_FIELDS[key]}\n\n${values[key] === '' ? '_No response_' : values[key]}`).join('\n\n');
};

test('awesome entries: https links only, known kinds, unique ids', () => {
    assert.deepEqual(checkAwesomeEntry(entry()), []);
    assert.equal(httpsUrlOf('http://example.com'), null);
    assert.equal(httpsUrlOf('javascript:alert(1)'), null);
    assert.equal(httpsUrlOf('https://user:pw@example.com/'), null);
    assert.match(checkAwesomeEntry(entry({ url: 'http://github.com/me/outside' })).join('\n'), /https/);
    assert.match(checkAwesomeEntry(entry({ kind: 'virus' })).join('\n'), /类型/);
    assert.match(checkAwesomeEntry(entry({ id: 'Bad Id' })).join('\n'), /id/);
    assert.match(checkAwesomeEntry(entry({ category: 'nope' })).join('\n'), /分类/);
    assert.match(checkAwesomeEntry(entry({ owners: ['not a name!'] })).join('\n'), /作者/);
    assert.match(checkAwesomeEntry(entry({ description: 'x'.repeat(601) })).join('\n'), /简介/);
    assert.match(checkAwesomeEntry(entry({ homepage: 'ftp://x.test' })).join('\n'), /homepage/);
    const errors = checkAwesome({ entries: [entry(), entry({ name: 'Again' })] }, { modIds: ['outside-mod'] });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /已被占用/);
    assert.match(checkAwesome({ entries: [entry({ id: 'taken' })] }, { modIds: ['taken'] }).join('\n'), /已被占用/);
});

test('AWESOME.md lists entries by kind, with third-party text unable to add markup', () => {
    const markdown = renderAwesomeMarkdown({ entries: [entry({ name: '[click](https://evil.test) <b>x</b>', description: 'line one\nline two `code`' }), entry({ id: 'tool-a', kind: 'tool', name: 'A tool', owners: ['dev'] })] });
    assert.match(markdown, /## 音源模组 \/ Source mod/);
    assert.match(markdown, /## 开发工具 \/ Developer tool/);
    assert.ok(markdown.includes('[\\[click\\](https://evil.test) \\<b\\>x\\</b\\>](https://github.com/me/outside)'));
    assert.ok(markdown.includes('line one line two \\`code\\`'));
    assert.ok(markdown.indexOf('Source mod') < markdown.indexOf('Developer tool'));

    // A link that closes itself and opens another passes as an https URL; in AWESOME.md it stays one link.
    const sneaky = 'https://github.com/a/b)[Download official build](https://evil.example/x.zip';
    assert.deepEqual(checkAwesomeEntry(entry({ url: sneaky })), []);
    const line = renderAwesomeMarkdown({ entries: [entry({ url: sneaky })] }).split('\n').find((text) => text.startsWith('- ['));
    assert.ok(!line.includes(')['));
    assert.ok(line.includes('(https://github.com/a/b%29%5BDownload%20official%20build%5D%28https://evil.example/x.zip)'));
});

test('writeAwesome sorts the entries and keeps AWESOME.md in step', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'folium-awesome-'));
    writeAwesome({ entries: [entry({ id: 'zeta' }), entry({ id: 'alpha' })] }, root);
    assert.deepEqual(readAwesome(root).entries.map((item) => item.id), ['alpha', 'zeta']);
    assert.equal(fs.readFileSync(path.join(root, 'AWESOME.md'), 'utf8'), renderAwesomeMarkdown(readAwesome(root)));
    fs.rmSync(root, { recursive: true, force: true });
});

test('the awesome-Folia form reads into an entry', () => {
    const parsed = parseAwesomeIssue(formBody(), { author: 'dev' });
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.entry, {
        id: 'my-source', name: '我的音源', kind: 'source', category: null, description: 'Plays songs from somewhere.',
        url: 'https://github.com/dev/my-source', owners: ['dev'], license: 'MIT', tags: [],
    });
    assert.deepEqual(parseAwesomeIssue(formBody({ owners: '@a, b c', category: '音效 / Sound (audio)' }), { author: 'dev' }).entry.owners, ['a', 'b', 'c']);
    assert.equal(parseAwesomeIssue(formBody({ category: '音效 / Sound (audio)' }), { author: 'dev' }).entry.category, 'audio');

    const bad = parseAwesomeIssue(formBody({ url: 'http://github.com/dev/x', kind: 'Malware', confirmations: '- [ ] author' }), { author: 'dev' });
    assert.equal(bad.errors.length, 3);
    assert.equal(issueKind({ labels: [{ name: 'awesome-entry' }] }), 'awesome');
    assert.match(checkIssueTitle('[awesome-Folia]', 'awesome'), /作品的名字/);
    assert.equal(checkIssueTitle('[awesome-Folia] 我的音源', 'awesome'), null);
});

test('an awesome id may be reused only by that entry\'s owners, never a mod id', () => {
    const existing = { entries: [entry({ id: 'my-source', owners: ['dev'], addedAt: '2026-01-01', submission: 5 })] };
    const byOwner = parseAwesomeIssue(formBody(), { author: 'dev', existing });
    assert.deepEqual(byOwner.errors, []);
    assert.ok(byOwner.updates);
    assert.match(parseAwesomeIssue(formBody(), { author: 'mallory', existing }).errors.join('\n'), /只有它的作者可以更新/);
    // GitHub logins are not case-sensitive; an update that names no authors keeps the listed ones.
    assert.deepEqual(parseAwesomeIssue(formBody(), { author: 'Dev', existing }).errors, []);
    const shared = { entries: [entry({ id: 'my-source', owners: ['dev', 'friend'] })] };
    assert.deepEqual(parseAwesomeIssue(formBody(), { author: 'dev', existing: shared }).entry.owners, ['dev', 'friend']);
    assert.match(parseAwesomeIssue(formBody(), { author: 'dev', modIds: ['my-source'] }).errors.join('\n'), /模组的 id/);

    const updated = withAwesomeEntry(existing, byOwner.entry, { issueNumber: 9, today: '2026-11-23' });
    assert.equal(updated.entries.length, 1);
    assert.deepEqual([updated.entries[0].addedAt, updated.entries[0].updatedAt, updated.entries[0].submission, updated.entries[0].lastIssue], ['2026-01-01', '2026-11-23', 5, 9]);
    const added = withAwesomeEntry({ entries: [] }, { ...byOwner.entry, license: null }, { issueNumber: 9, today: '2026-11-23' });
    assert.deepEqual([added.entries[0].addedAt, added.entries[0].submission, 'license' in added.entries[0]], ['2026-11-23', 9, false]);
    assert.deepEqual(checkAwesome(added), []);
});

test('/list <hash> and the awesome check comment', () => {
    assert.equal(isListCommand('/list'), true);
    assert.equal(isListCommand('/list 0123456789ab\nthanks'), true);
    assert.equal(isListCommand('/listing'), false);
    assert.equal(isListCommand('please /list'), false);
    assert.equal(listCommandHash('/list'), null);
    assert.equal(listCommandHash('/list 0123456789ab'), '0123456789ab');
    assert.equal(listCommandHash('/list 0123'), null);
    const parsed = parseAwesomeIssue(formBody(), { author: 'dev' });
    const ok = renderAwesomeCheckComment({ ...parsed, checkedAt: '2026-11-23T00:00:00Z' });
    assert.match(ok, /格式检查通过/);
    // The command carries the hash of what the comment shows; an edited issue reads to another one.
    const hash = awesomeEntryHash(parsed.entry);
    assert.match(hash, /^[0-9a-f]{12}$/);
    assert.ok(ok.includes(`\`/list ${hash}\``));
    assert.notEqual(awesomeEntryHash(parseAwesomeIssue(formBody({ url: 'https://github.com/dev/other' }), { author: 'dev' }).entry), hash);
    assert.match(ok, /checked-at=2026-11-23/);
    const failed = renderAwesomeCheckComment({ errors: ['链接必须是 https 地址'], entry: parsed.entry });
    assert.match(failed, /folium-bot:check-failed/);
});

test('categories: the table, the form texts and the fallback', () => {
    assert.equal(new Set(CATEGORIES.map((category) => category.id)).size, CATEGORIES.length);
    assert.equal(CATEGORIES.at(-1).id, 'other');
    for (const category of CATEGORIES) {
        assert.equal(parseCategory(categoryFormOption(category)), category.id);
        assert.ok(category.label['zh-CN'] && category.label.en);
    }
    assert.equal(parseCategory('保持不变 / Keep current'), null);
    assert.equal(parseCategory('不分类 / None'), null);
    assert.equal(parseCategory(''), null);
    assert.equal(parseCategory('Whatever'), undefined);
    assert.equal(categoryOf('nope'), 'other');
    assert.equal(categoryOf(undefined), 'other');
});

test('auto tags come from the manifest', () => {
    assert.deepEqual(autoTagsOf({ main: 'main.cjs', permissions: ['net.fetch', 'visualizer.mode', 'stageLayers', 'equalizer.control', 'playback.queue', 'platform.netease.read'], experimental: ['platform.raw'] }),
        ['node', 'network', 'visualizer', 'stage', 'equalizer', 'queue', 'platform', 'experimental']);
    assert.deepEqual(autoTagsOf({ embedOrigins: ['https://www.youtube.com'], permissions: ['render.export'] }), ['embed', 'export']);
    assert.deepEqual(autoTagsOf({}), []);
});

test('source mods are sent to awesome-Folia; upper bounds on folia get a note', () => {
    assert.match(sourceModRefusal({ folium: 2, sources: [{ id: 'main' }] }), /awesome-Folia/);
    assert.match(sourceModRefusal({ folium: 1, experimental: ['omni.providers'] }), /omni\.providers/);
    assert.equal(sourceModRefusal({ folium: 2, sources: [] }), null);
    assert.equal(sourceModRefusal({ folium: 1, experimental: ['platform.raw'] }), null);
    assert.equal(sourceModRefusal(null), null);

    assert.match(hostRangeUpperBoundNote({ folia: '>=0.7.0 <0.8.0' }), /上界/);
    assert.match(hostRangeUpperBoundNote({ folia: '^0.7.0' }), /上界/);
    assert.match(hostRangeUpperBoundNote({ folia: '<=0.7.29' }, '0.7.29'), /上界/);
    assert.equal(hostRangeUpperBoundNote({ folia: '>=0.7.0 <2.0.0' }, '0.7.29'), null);
    assert.equal(hostRangeUpperBoundNote({ folia: '>=0.7.29' }), null);
    assert.equal(hostRangeUpperBoundNote({}), null);
});
