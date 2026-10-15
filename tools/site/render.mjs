// tools/site/render.mjs
// Renders the market page to static HTML at build time. Everything shown is in
// the markup already; site/assets/app.js only filters, opens the detail
// dialogs, switches language and copies hashes. Mod names, descriptions and authors come from third parties,
// so every value goes through escapeHtml, and the page's CSP (vercel.json)
// allows no inline script or style.

import { SITE_REPOSITORY } from './config.mjs';

export const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Chinese is the default markup; app.js swaps in English (site/assets/app.js has both tables).
export const PERMISSION_TEXT = {
    'filesystem.data': '读写自己的数据文件',
    'runtime.playback': '读取播放状态',
    'render.export': '导出透明歌词视频',
    'playback.control': '控制播放：播放、暂停、跳转、切歌',
    'net.fetch': '访问网络',
    'net.embed': '嵌入外部网页',
    'ui.stage': '在播放页上绘制图层',
};

const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const hueClass = (id) => {
    let hash = 0;
    for (const char of id) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    return `hue-${hash % 12}`;
};

const t = (key, zh) => `<span data-i18n="${key}">${escapeHtml(zh)}</span>`;

const chip = (className, label, title, attributes = '') => (
    `<li class="chip ${className}" title="${escapeHtml(title)}"${attributes}>${escapeHtml(label)}</li>`
);

const ICON_SIGNED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v9.2l3.3-3.3 1.4 1.4L12 17l-5.7-5.7 1.4-1.4 3.3 3.3V4ZM5 19h14v2H5z"/></svg>';
const ICON_FLASK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6v2h-1v5.3l5.6 9.4A2.2 2.2 0 0 1 17.7 22H6.3a2.2 2.2 0 0 1-1.9-3.3L10 9.3V4H9V2Zm3 9.1L8.6 17h6.8L12 11.1Z"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/></svg>';

// The fragment that opens a mod's detail dialog; also its shareable link.
const detailId = (mod) => `mod-${mod.id}`;

const initialOf = (mod) => Array.from(mod.name.trim() || mod.id)[0].toUpperCase();

// Only https links: community.json values come from the submission form, and a
// javascript: URL would survive HTML escaping.
const httpsUrl = (value) => (/^https:\/\//.test(value ?? '') ? value : null);

const isBeta = (mod) => mod.channel === 'beta';

const BADGE_TEXT = {
    official: t('badge.official', '官方'),
    community: t('badge.community', '社区'),
    beta: t('badge.beta', '先行测试'),
};

const originBadge = (mod) => `<span class="badge badge-${escapeHtml(mod.origin)}">${BADGE_TEXT[mod.origin] ?? escapeHtml(mod.origin)}</span>`;

// The signature line: release mods install as officially verified, beta mods as preview builds.
const signedMark = (mod) => (isBeta(mod)
    ? `<span class="signed signed-beta" data-i18n-title="beta.signed.title" title="由 Folium 先行测试密钥签名：仅通过安全审查，不保证功能可用">${ICON_FLASK}${t('beta.signed', '先行测试')}</span>`
    : `<span class="signed" data-i18n-title="signed.title" title="由 Folium 签名，安装后显示为「官方认证」">${ICON_SIGNED}${t('signed', '已签名')}</span>`);

// Shown at the top of the beta section and in each beta mod's detail dialog.
const BETA_NOTE = '先行测试模组仅通过了安全审查，不保证功能实现的整洁，甚至功能可以完全无法工作。它们主要给社区开发者做创意实验，普通用户请勿轻易下载使用。需要支持先行测试签名的 Folia 版本，旧版本会把它们显示为「签名不匹配」。';
const betaNotice = () => `<p class="beta-note">${ICON_FLASK}${t('beta.note', BETA_NOTE)}</p>`;

const downloadButton = (mod) => `<a class="download${isBeta(mod) ? ' download-beta' : ''}" href="${escapeHtml(mod.download.url)}" download="${escapeHtml(mod.download.fileName)}">
            ${ICON_DOWNLOAD}
            ${t('download', '下载')} <span class="size">${formatSize(mod.download.size)}</span>
          </a>`;

const renderCard = (mod) => {
    const searchText = [mod.name, mod.id, mod.author, mod.description].filter(Boolean).join(' ').toLowerCase();
    const href = `#${escapeHtml(detailId(mod))}`;
    const chips = [
        ...mod.permissions.map((permission) => chip('chip-permission', permission, PERMISSION_TEXT[permission] ?? permission, ` data-permission="${escapeHtml(permission)}"`)),
        ...(mod.hasMain ? [`<li class="chip chip-node" data-i18n-title="node.title" title="包含在主进程运行的代码，拥有完整的 Node.js 权限">${t('node', 'Node 入口')}</li>`] : []),
        ...mod.experimental.map((feature) => `<li class="chip chip-experimental" title="${escapeHtml(feature)}">${t('experimental', '实验接口')} · ${escapeHtml(feature)}</li>`),
    ];
    const preview = mod.preview
        ? `<a class="preview" href="${href}" tabindex="-1" aria-hidden="true"><img src="${escapeHtml(mod.preview.url)}" width="${Number(mod.preview.width)}" height="${Number(mod.preview.height)}" alt="" loading="lazy" decoding="async"></a>`
        : '';
    return `
      <article class="card" data-origin="${escapeHtml(mod.origin)}" data-search="${escapeHtml(searchText)}">
        ${preview}
        <header class="card-head">
          <div class="monogram ${hueClass(mod.id)}" aria-hidden="true">${escapeHtml(initialOf(mod))}</div>
          <div class="card-title">
            <h2><a href="${href}">${escapeHtml(mod.name)}</a></h2>
            <p class="meta"><code>${escapeHtml(mod.id)}</code> · v${escapeHtml(mod.version)}${mod.author ? ` · ${escapeHtml(mod.author)}` : ''}</p>
          </div>
          ${originBadge(mod)}
        </header>
        ${mod.description ? `<p class="description">${escapeHtml(mod.description)}</p>` : ''}
        <ul class="chips">${chips.length > 0 ? chips.join('') : `<li class="chip chip-none">${t('permissions.none', '无需权限')}</li>`}</ul>
        <footer class="card-foot">
          ${signedMark(mod)}
          <a class="more" href="${href}">${t('more', '详情')}</a>
          ${downloadButton(mod)}
        </footer>
      </article>`;
};

/* A `<dt>`/`<dd>` pair, or nothing when there is no value. `value` is markup. */
const row = (key, zh, value) => (value ? `<dt>${t(key, zh)}</dt><dd>${value}</dd>` : '');

const section = (key, zh, body) => (body ? `
          <section class="detail-section">
            <h3>${t(key, zh)}</h3>
            ${body}
          </section>` : '');

/*
 * The full view of one mod: the whole description, each permission with what
 * it allows, compatibility, where the files came from and the signature. A
 * `<dialog>` that app.js opens modally; without script it still shows through
 * `:target` (see app.css).
 */
const renderDetail = (mod) => {
    const id = detailId(mod);
    const permissions = [
        ...mod.permissions.map((permission) => `<li><code>${escapeHtml(permission)}</code><span data-permission-text="${escapeHtml(permission)}">${escapeHtml(PERMISSION_TEXT[permission] ?? permission)}</span></li>`),
        ...(mod.hasMain ? [`<li class="perm-node"><code>main</code>${t('node.title', '包含在主进程运行的代码，拥有完整的 Node.js 权限')}</li>`] : []),
    ];
    const compat = [
        row('detail.folia', '适用的 Folia 版本', typeof mod.folia === 'string' && mod.folia ? `<code>${escapeHtml(mod.folia)}</code>` : ''),
        row('depends', '依赖', mod.depends.map((dependency) => `<code>${escapeHtml(dependency)}</code>`).join(' ')),
        row('experimental', '实验接口', mod.experimental.map((feature) => `<code>${escapeHtml(feature)}</code>`).join(' ')),
        row('embeds', '可嵌入', mod.embedOrigins.map((origin) => `<code>${escapeHtml(origin)}</code>`).join(' ')),
    ].join('');
    const source = httpsUrl(mod.source);
    const origin = mod.origin === 'official'
        ? row('detail.origin', '来源', t('detail.official', 'Folium 维护者编写'))
        : [
            row('detail.owners', '维护者', (mod.owners ?? []).map((owner) => `<a href="https://github.com/${encodeURIComponent(owner)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(owner)}</a>`).join(', ')),
            row('source', '源码', source ? `<a href="${escapeHtml(source)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(source.replace(/^https:\/\//, ''))}</a>` : ''),
            row('detail.commit', '审查的提交', mod.sourceCommit ? `<code>${escapeHtml(String(mod.sourceCommit).slice(0, 12))}</code>` : ''),
        ].join('');
    const preview = mod.preview
        ? `<a class="detail-preview" href="${escapeHtml(mod.preview.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(mod.preview.url)}" width="${Number(mod.preview.width)}" height="${Number(mod.preview.height)}" alt="${escapeHtml(mod.name)}" loading="lazy" decoding="async"></a>`
        : '';
    return `
    <dialog class="detail" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
      <div class="detail-body">
        <a class="detail-close" href="#" data-close>${ICON_CLOSE}<span class="visually-hidden">${t('close', '关闭')}</span></a>
        ${preview}
        <header class="card-head">
          <div class="monogram ${hueClass(mod.id)}" aria-hidden="true">${escapeHtml(initialOf(mod))}</div>
          <div class="card-title">
            <h2 id="${escapeHtml(id)}-title">${escapeHtml(mod.name)}</h2>
            <p class="meta"><code>${escapeHtml(mod.id)}</code> · v${escapeHtml(mod.version)}${mod.author ? ` · ${escapeHtml(mod.author)}` : ''}</p>
          </div>
          ${originBadge(mod)}
        </header>
        ${isBeta(mod) ? betaNotice() : ''}
        ${mod.description ? `<p class="detail-description">${escapeHtml(mod.description)}</p>` : ''}
        <div class="detail-sections">${section('detail.permissions', '权限', `<ul class="perm-list">${permissions.length > 0 ? permissions.join('') : `<li>${t('permissions.none', '无需权限')}</li>`}</ul>`)}${section('detail.compat', '兼容与依赖', compat && `<dl>${compat}</dl>`)}${section('detail.provenance', '来源', origin && `<dl>${origin}</dl>`)}${section('details', '签名与校验', `<dl>
              <dt>${t('key', '签名密钥')}</dt><dd>${escapeHtml(mod.keyLabel)} <code>${escapeHtml(mod.keyId)}</code></dd>
              <dt>${t('signedAt', '签名时间')}</dt><dd>${escapeHtml(mod.signedAt.slice(0, 10))}</dd>
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

export const renderMarketPage = (catalog) => {
    const submitUrl = `https://github.com/${SITE_REPOSITORY}/issues/new?template=mod-submission.yml`;
    const repoUrl = `https://github.com/${SITE_REPOSITORY}`;
    // Beta mods stay out of "all": they get their own tab and section.
    const released = catalog.mods.filter((mod) => !isBeta(mod));
    const beta = catalog.mods.filter(isBeta);
    const counts = {
        all: released.length,
        official: released.filter((mod) => mod.origin === 'official').length,
        community: released.filter((mod) => mod.origin === 'community').length,
        beta: beta.length,
    };
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Folium 模组市场</title>
  <meta name="description" content="Folia 的官方模组与经过审查的社区模组，全部由 Folium 签名。">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/app.css">
  <script src="/assets/app.js" defer></script>
</head>
<body>
  <div class="page">
    <header class="hero">
      <div class="hero-top">
        <a class="brand" href="/"><img src="/assets/icon.svg" alt="" width="28" height="28"><span>Folium</span></a>
        <nav class="hero-links">
          <a href="${submitUrl}" rel="noopener" target="_blank">${t('submit', '提交模组')}</a>
          <a href="${repoUrl}" rel="noopener" target="_blank">GitHub</a>
          <button type="button" class="lang" data-lang-toggle aria-label="Switch language">EN</button>
        </nav>
      </div>
      <h1>${t('title', '模组市场')}</h1>
      <p class="tagline">${t('tagline', 'Folia 的官方模组与经过审查的社区模组。正式发布的模组都由 Folium 签名，安装后显示为「官方认证」。')}</p>
      <ol class="steps">
        <li>${t('install.1', '在 Folia 的「设置 → 系统 → 模组」里开启模组系统')}</li>
        <li>${t('install.2', '下载模组的 zip，拖进模组面板')}</li>
        <li>${t('install.3', '启用时核对确认窗口里的签名与权限')}</li>
      </ol>
    </header>

    <main>
      <div class="toolbar">
        <label class="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3a7 7 0 0 1 5.6 11.2l4.6 4.6-1.4 1.4-4.6-4.6A7 7 0 1 1 10 3Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/></svg>
          <input type="search" data-search-input data-i18n-placeholder="search" placeholder="搜索名称、id、作者或描述" autocomplete="off">
        </label>
        <div class="filters" role="group">
          <button type="button" class="filter is-active" data-filter="all">${t('filter.all', '全部')} <span class="n">${counts.all}</span></button>
          <button type="button" class="filter" data-filter="official">${t('filter.official', '官方')} <span class="n">${counts.official}</span></button>
          <button type="button" class="filter" data-filter="community">${t('filter.community', '社区')} <span class="n">${counts.community}</span></button>
          <button type="button" class="filter filter-beta" data-filter="beta">${t('filter.beta', '先行测试')} <span class="n">${counts.beta}</span></button>
        </div>
      </div>

      <section class="grid" data-grid>${released.map(renderCard).join('')}
      </section>

      <section class="beta-zone" data-beta-zone aria-labelledby="beta-title">
        <h2 id="beta-title">${t('beta.title', '先行测试')}</h2>
        ${betaNotice()}
        ${beta.length > 0 ? `<div class="grid">${beta.map(renderCard).join('')}
        </div>` : `<p class="empty">${t('beta.empty', '目前还没有先行测试模组')}</p>`}
      </section>
      <p class="empty" data-empty hidden>${t('empty', '没有匹配的模组')}</p>
    </main>
${catalog.mods.map(renderDetail).join('')}

    <footer class="site-foot">
      <p>${t('footer.note', '签名证明模组经过 Folium 审查、且发布后没有被改动；但模组启用后仍拥有应用的完整权限，请只启用你需要的模组。')}</p>
      <p><a href="/catalog.json">${t('footer.api', '目录数据（JSON）')}</a> · <a href="${repoUrl}" rel="noopener" target="_blank">${escapeHtml(SITE_REPOSITORY)}</a>${catalog.commit ? ` · <code>${escapeHtml(catalog.commit.slice(0, 7))}</code>` : ''}</p>
    </footer>
  </div>
</body>
</html>
`;
};
