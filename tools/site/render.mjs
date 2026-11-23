// tools/site/render.mjs
// Renders the market page to static HTML at build time. Everything shown is in
// the markup already; site/assets/app.js only filters and sorts the cards, opens
// the detail dialogs, switches language and copies hashes. Mod names,
// descriptions, authors and awesome-Folia entries come from third parties, so
// every value goes through escapeHtml, links from data must be https, and the
// page's CSP (site/_headers) allows no inline script or style.

import { SITE_REPOSITORY } from './config.mjs';
import { AUTO_TAGS, CATEGORIES } from '../lib/categories.mjs';
import { AWESOME_KINDS } from '../lib/awesome.mjs';

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/*
 * What each permission allows (foliumShared.json `permissions` lists what each guards). Chinese is the
 * default markup; app.js swaps in English (PERMISSIONS_EN there). `runtime.playback` and `ui.stage` are
 * the older names of `playback.read` and `stageLayers`, still found in published mods.
 */
export const PERMISSION_TEXT = {
    'filesystem.data': '读写自己的数据文件',
    'playback.read': '读取播放状态',
    'playback.control': '控制播放：播放、暂停、跳转、切歌、音量与循环',
    'playback.queue': '替换整个播放队列',
    'equalizer.control': '调整均衡器',
    'visualizer.renderQuality': '调整歌词动画的渲染画质',
    'visualizer.mode': '切换歌词样式',
    'visualizer.tuning': '调整歌词样式的参数',
    'visualizer.beatEffects': '设置节拍效果',
    'visualizer.background': '设置播放页背景',
    'visualizer.animationIntensity': '调整动画强度',
    'theme.write': '修改应用的主题配色',
    'render.export': '导出透明歌词视频',
    'net.fetch': '访问网络',
    'net.embed': '嵌入外部网页',
    stageLayers: '在播放页上绘制图层',
    'platform.netease.read': '用你登录的网易云音乐账号读取数据',
    'platform.netease.write': '用你登录的网易云音乐账号写入数据（收藏、歌单等）',
    'runtime.playback': '读取播放状态',
    'ui.stage': '在播放页上绘制图层',
};

const COMPOUND_ISSUES = `https://github.com/${SITE_REPOSITORY}/issues`;

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const hueClass = (id) => {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return `hue-${hash % 12}`;
};

// Fixed page text: Chinese here, English from app.js's EN table by key.
const t = (key, zh) => `<span data-i18n="${key}">${escapeHtml(zh)}</span>`;

// Text from a label table ({ 'zh-CN', en }): Chinese here, English carried in data-en for app.js.
const label = (pair) => `<span data-en="${escapeHtml(pair?.en ?? pair?.['zh-CN'] ?? '')}">${escapeHtml(pair?.['zh-CN'] ?? pair?.en ?? '')}</span>`;

const svg = (path) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
const ICON_SIGNED = svg('M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z');
const ICON_DOWNLOAD = svg('M11 4h2v9.2l3.3-3.3 1.4 1.4L12 17l-5.7-5.7 1.4-1.4 3.3 3.3V4ZM5 19h14v2H5z');
const ICON_FLASK = svg('M9 2h6v2h-1v5.3l5.6 9.4A2.2 2.2 0 0 1 17.7 22H6.3a2.2 2.2 0 0 1-1.9-3.3L10 9.3V4H9V2Zm3 9.1L8.6 17h6.8L12 11.1Z');
const ICON_CLOSE = svg('m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z');
const ICON_SEARCH = svg('M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z');
const ICON_EXTERNAL = svg('M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z');
const ICON_CODE = svg('m8.6 6.6 1.4 1.4L6 12l4 4-1.4 1.4L3.2 12l5.4-5.4Zm6.8 0L20.8 12l-5.4 5.4L14 16l4-4-4-4 1.4-1.4Z');
const ICON_ISSUE = svg('M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Zm1 2v10.2L7.2 14H19V6H5Zm6 1.5h2v4h-2v-4Zm0 5h2v2h-2v-2Z');
const ICON_DOC = svg('M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.8V9h5.2L13 3.8ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z');
const ICON_HOME = svg('M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z');
const ICON_PERSON = svg('M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 11c4.4 0 8 2.2 8 5v2H4v-2c0-2.8 3.6-5 8-5Z');
const KIND_ICONS = {
    source: svg('M12 3v10.6A4 4 0 1 0 14 17V7h4V3h-6Z'),
    plugin: svg('M10 2.5a2 2 0 0 1 4 0V4h4a2 2 0 0 1 2 2v4h-1.5a2 2 0 0 0 0 4H20v4a2 2 0 0 1-2 2h-4v-1.5a2 2 0 0 0-4 0V20H6a2 2 0 0 1-2-2v-4h1.5a2 2 0 0 0 0-4H4V6a2 2 0 0 1 2-2h4V2.5Z'),
    app: svg('M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 4v10h16V8H4Zm1-3v2h2V5H5Zm3 0v2h2V5H8Z'),
    tool: ICON_CODE,
    other: ICON_EXTERNAL,
};

// Only https links: community.json and awesome.json values come from submission forms, and a
// javascript: URL would survive HTML escaping.
const httpsUrl = (value) => (typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value) ? value : null);

const externalLink = (url, inner, className = '') => `<a${className ? ` class="${className}"` : ''} href="${escapeHtml(url)}" rel="noopener noreferrer nofollow" target="_blank">${inner}</a>`;

/*
 * Where to report a problem with a work: its `bugs` link; else the issue tracker of its repository when
 * that is a plain `https://host/owner/repo(.git)` on GitHub, Codeberg or GitLab; else the repository
 * itself. Official mods are this repository's own, so their problems come here. Null when there is
 * nowhere to send them.
 */
export const feedbackUrlOf = ({ official = false, bugs = null, repository = null } = {}) => {
    if (official) return COMPOUND_ISSUES;
    const direct = httpsUrl(bugs);
    if (direct) return direct;
    const repo = httpsUrl(repository);
    if (!repo) return null;
    const match = /^https:\/\/(github\.com|codeberg\.org|gitlab\.com)\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i.exec(repo);
    if (match) return `https://${match[1].toLowerCase()}/${match[2]}/${match[3]}/${match[1].toLowerCase() === 'gitlab.com' ? '-/issues' : 'issues'}`;
    return repo;
};

const isBeta = (mod) => mod.channel === 'beta';

const BADGE_TEXT = {
    official: t('badge.official', '官方'),
    community: t('badge.community', '社区'),
    beta: t('badge.beta', '先行测试'),
};

// The origin badge in a card's head; a beta mod's shows as the purple corner badge instead.
const originBadge = (mod) => (isBeta(mod) ? '' : `<span class="badge badge-${escapeHtml(mod.origin)}">${BADGE_TEXT[mod.origin] ?? escapeHtml(mod.origin)}</span>`);

const cornerBadge = (inner, className) => `<span class="corner-badge ${className}">${inner}</span>`;

// The signature line: release mods install as officially verified, beta mods as preview builds.
const signedMark = (mod) => (isBeta(mod)
    ? `<span class="signed signed-beta" data-i18n-title="beta.signed.title" title="由 Folium 先行测试密钥签名：仅通过安全审查，不保证功能可用">${ICON_FLASK}${t('beta.signed', '先行测试')}</span>`
    : `<span class="signed" data-i18n-title="signed.title" title="由 Folium 签名，安装后显示为「官方认证」">${ICON_SIGNED}${t('signed', '已签名')}</span>`);

// The one sentence about the beta channel, shown only inside a beta mod's detail dialog.
const BETA_NOTE = '先行测试模组只通过了安全审查，功能可能不完整甚至无法工作，需要 Folia 0.7.20 及以上版本。';

const downloadButton = (mod) => `<a class="download${isBeta(mod) ? ' download-beta' : ''}" href="${escapeHtml(mod.download.url)}" download="${escapeHtml(mod.download.fileName)}">${ICON_DOWNLOAD}${t('download', '下载')} <span class="size">${formatSize(mod.download.size)}</span></a>`;

const visitButton = (url) => externalLink(url, `${ICON_EXTERNAL}${t('visit', '前往仓库')}`, 'download download-external');

const initialOf = (name, id) => Array.from(String(name ?? '').trim() || id)[0].toUpperCase();

const monogram = (id, name) => `<div class="monogram ${hueClass(id)}" aria-hidden="true">${escapeHtml(initialOf(name, id))}</div>`;

const ownerLinks = (owners) => (owners ?? [])
    .filter((owner) => owner && typeof owner.login === 'string')
    .map((owner) => {
        const url = httpsUrl(owner.url);
        return url ? externalLink(url, `@${escapeHtml(owner.login)}`) : `@${escapeHtml(owner.login)}`;
    })
    .join(', ');

const tagChip = (id) => (AUTO_TAGS[id] ? `<li class="chip chip-tag${id === 'node' ? ' chip-node' : ''}">${label(AUTO_TAGS[id])}</li>` : '');

const freeTagChip = (text) => `<li class="chip chip-tag">${escapeHtml(text)}</li>`;

/* A `<dt>`/`<dd>` pair, or nothing when there is no value. `value` is markup. */
const row = (key, zh, value) => (value ? `<dt>${t(key, zh)}</dt><dd>${value}</dd>` : '');

const section = (key, zh, body) => (body ? `
          <section class="detail-section">
            <h3>${t(key, zh)}</h3>
            ${body}
          </section>` : '');

// One entry of a dialog's "who and where" panel: an icon, a label and a value (markup).
const linkItem = (icon, key, zh, value) => (value ? `<div class="link-item">${icon}<span class="link-key">${t(key, zh)}</span><span class="link-value">${value}</span></div>` : '');

const linkUrlText = (url) => escapeHtml(url.replace(/^https:\/\//, '').replace(/\/$/, ''));

const closeButton = () => `<a class="detail-close" href="#" data-close>${ICON_CLOSE}<span class="visually-hidden">${t('close', '关闭')}</span></a>`;

/* ---- mods */

const modDetailId = (mod) => `mod-${mod.id}`;

// The repository a mod's source lives in: its own for community and beta mods, this one for official mods.
const modRepository = (mod, catalog) => httpsUrl(mod.repository)
    ?? (mod.origin === 'official' && typeof mod.path === 'string' ? `https://github.com/${catalog.repository ?? SITE_REPOSITORY}/tree/main/${mod.path.split('/').map(encodeURIComponent).join('/')}` : null);

const modFeedback = (mod) => feedbackUrlOf({ official: mod.origin === 'official', bugs: mod.bugs, repository: mod.repository ?? mod.source });

const readmeUrl = (mod) => (typeof mod.readme === 'string' && /^\/readmes\/[A-Za-z0-9._-]+\.md$/.test(mod.readme) ? mod.readme : null);

const modSearchText = (mod, categoryLabel) => [
    mod.name, mod.id, mod.author,
    ...(mod.owners ?? []).map((owner) => owner?.login),
    mod.description,
    categoryLabel?.['zh-CN'], categoryLabel?.en,
    ...(mod.tags ?? []).flatMap((tag) => [AUTO_TAGS[tag]?.['zh-CN'], AUTO_TAGS[tag]?.en]),
    ...mod.permissions.flatMap((permission) => [permission, PERMISSION_TEXT[permission]]),
    ...mod.experimental,
].filter(Boolean).join(' ').toLowerCase();

const renderModCard = (mod, order, context) => {
    const href = `#${escapeHtml(modDetailId(mod))}`;
    const categoryLabel = context.categoryLabels.get(mod.category);
    const tags = (mod.tags ?? []).map(tagChip).join('');
    const preview = mod.preview
        ? `<a class="preview" href="${href}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(mod.preview.url)}" width="${Number(mod.preview.width)}" height="${Number(mod.preview.height)}" alt="" loading="lazy" decoding="async"></a>`
        : '';
    return `
      <article class="card${isBeta(mod) ? ' card-beta' : ''}" data-origin="${escapeHtml(mod.origin)}" data-category="${escapeHtml(mod.category ?? '')}" data-tags="${escapeHtml((mod.tags ?? []).join(' '))}" data-permissions="${escapeHtml(mod.permissions.join(' '))}" data-order="${order}" data-updated="${escapeHtml(mod.updatedAt ?? '')}" data-name="${escapeHtml(String(mod.name).toLowerCase())}" data-search="${escapeHtml(modSearchText(mod, categoryLabel))}">
        ${isBeta(mod) ? cornerBadge(`${ICON_FLASK}${t('badge.beta', '先行测试')}`, 'corner-beta') : ''}
        ${preview}
        <header class="card-head">
          ${monogram(mod.id, mod.name)}
          <div class="card-title">
            <h2><a href="${href}">${escapeHtml(mod.name)}</a></h2>
            <p class="meta">${mod.author ? `${escapeHtml(mod.author)} · ` : ''}v${escapeHtml(mod.version)}</p>
          </div>
          ${originBadge(mod)}
        </header>
        ${mod.description ? `<p class="description">${escapeHtml(mod.description)}</p>` : ''}
        <ul class="chips">${categoryLabel ? `<li class="chip chip-category">${label(categoryLabel)}</li>` : ''}${tags}</ul>
        <footer class="card-foot">
          ${signedMark(mod)}
          <a class="more" href="${href}">${t('more', '详情')}</a>
          ${downloadButton(mod)}
        </footer>
      </article>`;
};

/*
 * The full view of one mod: who made it and where to take its problems, the whole description, each
 * permission with what it allows, compatibility, where the files came from and the signature. A
 * `<dialog>` that app.js opens modally; without script it still shows through `:target` (see app.css).
 */
const renderModDetail = (mod, context) => {
    const id = modDetailId(mod);
    const categoryLabel = context.categoryLabels.get(mod.category);
    const permissions = [
        ...mod.permissions.map((permission) => `<li><code>${escapeHtml(permission)}</code><span data-permission-text="${escapeHtml(permission)}">${escapeHtml(PERMISSION_TEXT[permission] ?? permission)}</span></li>`),
        ...(mod.hasMain ? [`<li class="perm-node"><code>main</code>${t('node.title', '包含在主进程运行的代码，拥有完整的 Node.js 权限')}</li>`] : []),
    ];
    const repository = modRepository(mod, context.catalog);
    const feedback = modFeedback(mod);
    const readme = readmeUrl(mod);
    const authors = mod.origin === 'official'
        ? `${mod.author ? `${escapeHtml(mod.author)} · ` : ''}${t('detail.official', 'Folium 维护者')}`
        : ownerLinks(mod.owners) || escapeHtml(mod.author ?? '');
    const links = [
        linkItem(ICON_PERSON, 'detail.author', '作者', authors),
        linkItem(ICON_CODE, 'detail.repository', '源码仓库', repository ? externalLink(repository, linkUrlText(repository)) : ''),
        linkItem(ICON_ISSUE, 'detail.feedback', '反馈问题', feedback ? externalLink(feedback, linkUrlText(feedback)) : ''),
        linkItem(ICON_DOC, 'detail.readme', '说明', readme ? `<a href="${escapeHtml(readme)}" target="_blank" rel="noopener">${t('detail.readme.open', '查看说明')}</a>` : ''),
    ].join('');
    const info = [
        row('detail.category', '分类', categoryLabel ? label(categoryLabel) : ''),
        row('detail.tags', '标签', (mod.tags ?? []).length > 0 ? `<ul class="chips">${(mod.tags ?? []).map(tagChip).join('')}</ul>` : ''),
        row('detail.version', '版本', `<code>${escapeHtml(mod.version)}</code>`),
        row('detail.folia', '兼容版本', typeof mod.folia === 'string' && mod.folia ? `<code>${escapeHtml(mod.folia)}</code>` : ''),
        row('detail.license', '许可证', mod.license ? escapeHtml(mod.license) : ''),
        row('detail.updated', '更新于', mod.updatedAt ? escapeHtml(mod.updatedAt) : ''),
        row('detail.added', '收录于', mod.addedAt ? escapeHtml(mod.addedAt) : ''),
    ].join('');
    const compat = [
        row('depends', '依赖', mod.depends.map((dependency) => `<code>${escapeHtml(dependency)}</code>`).join(' ')),
        row('experimental', '实验接口', mod.experimental.map((feature) => `<code>${escapeHtml(feature)}</code>`).join(' ')),
        row('embeds', '可嵌入', mod.embedOrigins.map((origin) => `<code>${escapeHtml(origin)}</code>`).join(' ')),
    ].join('');
    const source = httpsUrl(mod.source);
    const provenance = mod.origin === 'official'
        ? row('detail.origin', '来源', t('detail.official.origin', 'Folium 维护者编写，源码就在本仓库'))
        : [
            row('source', '审查的源码', source ? externalLink(source, linkUrlText(source)) : ''),
            row('detail.commit', '审查的提交', mod.sourceCommit ? `<code>${escapeHtml(String(mod.sourceCommit).slice(0, 12))}</code>` : ''),
        ].join('');
    const preview = mod.preview
        ? `<a class="detail-preview" href="${escapeHtml(mod.preview.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(mod.preview.url)}" width="${Number(mod.preview.width)}" height="${Number(mod.preview.height)}" alt="${escapeHtml(mod.name)}" loading="lazy" decoding="async"></a>`
        : '';
    return `
    <dialog class="detail" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
      <div class="detail-body">
        ${closeButton()}
        ${preview}
        <header class="card-head">
          ${monogram(mod.id, mod.name)}
          <div class="card-title">
            <h2 id="${escapeHtml(id)}-title">${escapeHtml(mod.name)}</h2>
            <p class="meta"><code>${escapeHtml(mod.id)}</code> · v${escapeHtml(mod.version)}${mod.author ? ` · ${escapeHtml(mod.author)}` : ''}</p>
          </div>
          ${isBeta(mod) ? `<span class="badge badge-beta">${BADGE_TEXT.beta}</span>` : originBadge(mod)}
        </header>
        ${isBeta(mod) ? `<p class="beta-note">${ICON_FLASK}${t('beta.note', BETA_NOTE)}</p>` : ''}
        <div class="detail-links">${links}</div>
        <p class="detail-hint">${t('detail.hint', '模组的问题请向作者反馈')}</p>
        ${mod.description ? `<p class="detail-description">${escapeHtml(mod.description)}</p>` : ''}
        <div class="detail-sections">${section('detail.info', '概况', `<dl>${info}</dl>`)}${section('detail.permissions', '权限', `<ul class="perm-list">${permissions.length > 0 ? permissions.join('') : `<li>${t('permissions.none', '无需权限')}</li>`}</ul>`)}${section('detail.compat', '依赖与实验接口', compat && `<dl>${compat}</dl>`)}${section('detail.provenance', '来源', provenance && `<dl>${provenance}</dl>`)}${section('details', '签名与校验', `<dl>
              <dt>${t('key', '签名密钥')}</dt><dd>${escapeHtml(mod.keyLabel)} <code>${escapeHtml(mod.keyId)}</code></dd>
              <dt>${t('signedAt', '签名时间')}</dt><dd>${escapeHtml(String(mod.signedAt ?? '').slice(0, 10))}</dd>
              <dt>${t('digest', '签名摘要')}</dt><dd><code class="hash">${escapeHtml(mod.digest)}</code></dd>
              <dt>${t('zipsha', '文件 SHA-256')}</dt><dd><code class="hash">${escapeHtml(mod.download.sha256)}</code>
                <button type="button" class="copy" data-copy="${escapeHtml(mod.download.sha256)}">${t('copy', '复制')}</button></dd>
            </dl>`)}
        </div>
        <footer class="card-foot">
          ${signedMark(mod)}
          ${downloadButton(mod)}
        </footer>
      </div>
    </dialog>`;
};

/* ---- awesome-Folia */

const awesomeDetailId = (entry) => `awesome-${entry.id}`;

const kindLine = (entry, context) => `<span class="kind">${KIND_ICONS[entry.kind] ?? KIND_ICONS.other}${label(context.kindLabels.get(entry.kind) ?? context.kindLabels.get('other'))}</span>`;

const awesomeSearchText = (entry, context) => {
    const category = context.categoryLabels.get(entry.category);
    const kind = context.kindLabels.get(entry.kind);
    return [
        entry.name, entry.id,
        ...(entry.owners ?? []).map((owner) => owner?.login),
        entry.description,
        kind?.['zh-CN'], kind?.en,
        category?.['zh-CN'], category?.en,
        ...(entry.tags ?? []),
        'awesome-folia', '外部链接', 'external',
    ].filter(Boolean).join(' ').toLowerCase();
};

const renderAwesomeCard = (entry, order, context) => {
    const url = httpsUrl(entry.url);
    const href = `#${escapeHtml(awesomeDetailId(entry))}`;
    const categoryLabel = context.categoryLabels.get(entry.category);
    const owners = (entry.owners ?? []).map((owner) => `@${escapeHtml(owner?.login)}`).join(', ');
    return `
      <article class="card card-awesome" data-origin="awesome" data-category="${escapeHtml(entry.category ?? '')}" data-tags="" data-permissions="" data-order="${order}" data-updated="${escapeHtml(entry.updatedAt ?? '')}" data-name="${escapeHtml(String(entry.name).toLowerCase())}" data-search="${escapeHtml(awesomeSearchText(entry, context))}">
        <header class="card-head">
          ${monogram(entry.id, entry.name)}
          <div class="card-title">
            <h2><a href="${href}">${escapeHtml(entry.name)}</a></h2>
            <p class="meta">${owners}</p>
          </div>
          <span class="badge badge-external">${ICON_EXTERNAL}${t('badge.external', '外部链接')}</span>
        </header>
        <p class="kind-line">${kindLine(entry, context)}</p>
        <p class="description">${escapeHtml(entry.description)}</p>
        <ul class="chips">${categoryLabel ? `<li class="chip chip-category">${label(categoryLabel)}</li>` : ''}${(entry.tags ?? []).map(freeTagChip).join('')}</ul>
        <footer class="card-foot">
          <span class="unsigned">${t('awesome.unsigned', '未经 Folium 签名')}</span>
          <a class="more" href="${href}">${t('more', '详情')}</a>
          ${url ? visitButton(url) : ''}
        </footer>
      </article>`;
};

const renderAwesomeDetail = (entry, context) => {
    const id = awesomeDetailId(entry);
    const url = httpsUrl(entry.url);
    const homepage = httpsUrl(entry.homepage);
    const feedback = feedbackUrlOf({ bugs: entry.bugs, repository: entry.url });
    const categoryLabel = context.categoryLabels.get(entry.category);
    const links = [
        linkItem(ICON_PERSON, 'detail.author', '作者', ownerLinks(entry.owners)),
        linkItem(ICON_CODE, 'detail.repository', '源码仓库', url ? externalLink(url, linkUrlText(url)) : ''),
        linkItem(ICON_ISSUE, 'detail.feedback', '反馈问题', feedback ? externalLink(feedback, linkUrlText(feedback)) : ''),
        linkItem(ICON_HOME, 'detail.homepage', '主页', homepage ? externalLink(homepage, linkUrlText(homepage)) : ''),
    ].join('');
    const info = [
        row('detail.kind', '类型', kindLine(entry, context)),
        row('detail.category', '分类', categoryLabel ? label(categoryLabel) : ''),
        row('detail.tags', '标签', (entry.tags ?? []).length > 0 ? `<ul class="chips">${entry.tags.map(freeTagChip).join('')}</ul>` : ''),
        row('detail.updated', '更新于', entry.updatedAt ? escapeHtml(entry.updatedAt) : ''),
        row('detail.added', '收录于', entry.addedAt ? escapeHtml(entry.addedAt) : ''),
    ].join('');
    return `
    <dialog class="detail" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
      <div class="detail-body">
        ${closeButton()}
        <header class="card-head">
          ${monogram(entry.id, entry.name)}
          <div class="card-title">
            <h2 id="${escapeHtml(id)}-title">${escapeHtml(entry.name)}</h2>
            <p class="meta"><code>${escapeHtml(entry.id)}</code> · awesome-Folia</p>
          </div>
          <span class="badge badge-external">${t('badge.external', '外部链接')}</span>
        </header>
        <p class="external-note">${ICON_EXTERNAL}${t('awesome.note', '这个作品没有经过 Folium 签名，需要从它自己的仓库安装。')}</p>
        <div class="detail-links">${links}</div>
        <p class="detail-hint">${t('awesome.hint', '使用中的问题请向作者反馈')}</p>
        <p class="detail-description">${escapeHtml(entry.description)}</p>
        <div class="detail-sections">${section('detail.info', '概况', `<dl>${info}</dl>`)}</div>
        <footer class="card-foot">
          <span class="unsigned">${t('awesome.unsigned', '未经 Folium 签名')}</span>
          ${url ? visitButton(url) : ''}
        </footer>
      </div>
    </dialog>`;
};

/* ---- the page */

const filterButton = (attribute, value, inner, count, active = false, extraClass = '') => (
    `<button type="button" class="filter${extraClass ? ` ${extraClass}` : ''}${active ? ' is-active' : ''}" data-${attribute}="${escapeHtml(value)}" aria-pressed="${active}">${inner}${count === null ? '' : ` <span class="n">${count}</span>`}</button>`
);

export const renderMarketPage = (catalog) => {
    const repository = catalog.repository ?? SITE_REPOSITORY;
    const repoUrl = `https://github.com/${repository}`;
    const submitUrl = `${repoUrl}/issues/new?template=mod-submission.yml`;
    const awesomeUrl = `${repoUrl}/issues/new?template=awesome-entry.yml`;
    const categories = Array.isArray(catalog.categories) && catalog.categories.length > 0 ? catalog.categories : CATEGORIES;
    const awesome = Array.isArray(catalog.awesome) ? catalog.awesome.filter((entry) => httpsUrl(entry?.url)) : [];
    const context = {
        catalog,
        categoryLabels: new Map(categories.map((category) => [category.id, category.label])),
        kindLabels: new Map(AWESOME_KINDS.map((kind) => [kind.id, kind.label])),
    };

    // One waterfall in the build's order (official, community, beta, then awesome-Folia); data-order keeps it.
    const cards = [
        ...catalog.mods.map((mod, index) => renderModCard(mod, index, context)),
        ...awesome.map((entry, index) => renderAwesomeCard(entry, catalog.mods.length + index, context)),
    ];
    const total = catalog.mods.length + awesome.length;
    const categoryCount = (id) => catalog.mods.filter((mod) => mod.category === id).length + awesome.filter((entry) => entry.category === id).length;
    const categoryChips = categories
        .map((category) => ({ category, count: categoryCount(category.id) }))
        .filter(({ count }) => count > 0)
        .map(({ category, count }) => filterButton('category', category.id, label(category.label), count));
    const sourceCount = (origin) => (origin === 'awesome' ? awesome.length : catalog.mods.filter((mod) => mod.origin === origin).length);
    const sources = [
        ['official', t('filter.official', '官方'), ''],
        ['community', t('filter.community', '社区'), ''],
        ['beta', t('filter.beta', '先行测试'), 'filter-beta'],
        ['awesome', 'awesome-Folia', 'filter-awesome'],
    ].map(([origin, inner, extraClass]) => filterButton('source', origin, inner, sourceCount(origin), false, extraClass));
    const usedTags = new Set(catalog.mods.flatMap((mod) => mod.tags ?? []));
    const tagChips = Object.entries(AUTO_TAGS)
        .filter(([id]) => usedTags.has(id))
        .map(([id, pair]) => filterButton('tag', id, label(pair), catalog.mods.filter((mod) => (mod.tags ?? []).includes(id)).length, false, 'filter-tag'));

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Folium 模组市场</title>
  <meta name="description" content="Folia 的官方模组、经过审查的社区模组与 awesome-Folia 外部作品。正式发布的模组都由 Folium 签名。">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/app.css">
  <script src="/assets/app.js" defer></script>
</head>
<body>
  <div class="page">
    <header class="topbar">
      <a class="brand" href="/"><img src="/assets/icon.svg" alt="" width="28" height="28"><span>Folium</span></a>
      <nav class="top-links">
        <a href="${escapeHtml(submitUrl)}" rel="noopener" target="_blank">${t('submit', '提交模组')}</a>
        <a href="${escapeHtml(awesomeUrl)}" rel="noopener" target="_blank">${t('submit.awesome', '登记 awesome-Folia')}</a>
        <a href="${escapeHtml(repoUrl)}" rel="noopener" target="_blank">GitHub</a>
        <button type="button" class="lang" data-lang-toggle aria-label="Switch language">EN</button>
      </nav>
    </header>

    <section class="hero">
      <h1>${t('title', '模组市场')}</h1>
      <p class="tagline">${t('tagline', 'Folia 的官方模组与经过审查的社区模组，正式发布的都由 Folium 签名；另有 awesome-Folia 收录的外部作品。')}</p>
      <ol class="steps">
        <li>${t('install.1', 'Folia 0.8 起内置模组市场：在「设置 → 模组」里安装、更新和卸载')}</li>
        <li>${t('install.2', '在这里下载的 zip 也可以直接拖进模组页')}</li>
      </ol>
    </section>

    <main>
      <div class="toolbar">
        <label class="search">
          ${ICON_SEARCH}
          <span class="visually-hidden">${t('search.label', '搜索')}</span>
          <input type="search" data-search-input data-i18n-placeholder="search" placeholder="搜索名称、作者、描述、分类、标签或权限" autocomplete="off" enterkeyhint="search">
        </label>
        <div class="chip-row" role="group" data-i18n-label="group.category" aria-label="分类">
          ${filterButton('category', '', t('filter.all', '全部'), total, true)}${categoryChips.join('')}
        </div>
        <div class="toolbar-row">
          <div class="segmented" role="group" data-i18n-label="group.source" aria-label="来源">
            ${filterButton('source', '', t('filter.all', '全部'), null, true)}${sources.join('')}
          </div>
          <label class="sort">
            <span>${t('sort', '排序')}</span>
            <select data-sort>
              <option value="" data-i18n="sort.recommended">推荐</option>
              <option value="updated" data-i18n="sort.updated">最近更新</option>
              <option value="name" data-i18n="sort.name">名称</option>
            </select>
          </label>
        </div>
        ${tagChips.length > 0 ? `<div class="chip-row chip-row-tags" role="group" data-i18n-label="group.tag" aria-label="标签">
          <span class="row-label">${t('tags', '标签')}</span>${tagChips.join('')}
        </div>` : ''}
      </div>

      <p class="result-count" data-count aria-live="polite"></p>
      <section class="grid" data-grid>${cards.join('')}
      </section>
      <div class="empty" data-empty hidden>
        <p>${t('empty', '没有匹配的结果')}</p>
        <button type="button" class="reset" data-reset>${t('reset', '清除搜索与筛选')}</button>
      </div>
    </main>
${catalog.mods.map((mod) => renderModDetail(mod, context)).join('')}
${awesome.map((entry) => renderAwesomeDetail(entry, context)).join('')}

    <footer class="site-foot">
      <p>${t('footer.note', '签名证明模组经过 Folium 审查、且发布后没有被改动；但模组启用后仍拥有应用的完整权限，请只启用你需要的模组。awesome-Folia 的作品不经 Folium 签名，请自行判断。')}</p>
      <p><a href="/catalog.json">${t('footer.api', '目录数据（JSON）')}</a> · <a href="${escapeHtml(repoUrl)}" rel="noopener" target="_blank">${escapeHtml(repository)}</a>${catalog.commit ? ` · <code>${escapeHtml(String(catalog.commit).slice(0, 7))}</code>` : ''}</p>
    </footer>
  </div>
</body>
</html>
`;
};
