// tools/site/render.mjs
// Renders the market page to static HTML at build time. Everything shown is in
// the markup already; site/assets/app.js only filters, switches language and
// copies hashes. Mod names, descriptions and authors come from third parties,
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

const renderCard = (mod) => {
    const searchText = [mod.name, mod.id, mod.author, mod.description].filter(Boolean).join(' ').toLowerCase();
    const chips = [
        ...mod.permissions.map((permission) => chip('chip-permission', permission, PERMISSION_TEXT[permission] ?? permission, ` data-permission="${escapeHtml(permission)}"`)),
        ...(mod.hasMain ? [`<li class="chip chip-node" data-i18n-title="node.title" title="包含在主进程运行的代码，拥有完整的 Node.js 权限">${t('node', 'Node 入口')}</li>`] : []),
        ...mod.experimental.map((feature) => `<li class="chip chip-experimental" title="${escapeHtml(feature)}">${t('experimental', '实验接口')} · ${escapeHtml(feature)}</li>`),
        ...mod.embedOrigins.map((origin) => `<li class="chip" title="${escapeHtml(origin)}">${t('embeds', '可嵌入')} · ${escapeHtml(origin.replace(/^https:\/\//, ''))}</li>`),
        ...mod.depends.map((dependency) => `<li class="chip" title="${escapeHtml(dependency)}">${t('depends', '依赖')} · ${escapeHtml(dependency)}</li>`),
    ];
    const initial = Array.from(mod.name.trim() || mod.id)[0].toUpperCase();
    // Only https links: community.json values come from the submission form, and a
    // javascript: URL would survive HTML escaping.
    const source = /^https:\/\//.test(mod.source ?? '') ? `<a class="source" href="${escapeHtml(mod.source)}" rel="noopener noreferrer nofollow" target="_blank">${t('source', '源码')}</a>` : '';
    return `
      <article class="card" data-origin="${escapeHtml(mod.origin)}" data-search="${escapeHtml(searchText)}">
        <header class="card-head">
          <div class="monogram ${hueClass(mod.id)}" aria-hidden="true">${escapeHtml(initial)}</div>
          <div class="card-title">
            <h2>${escapeHtml(mod.name)}</h2>
            <p class="meta"><code>${escapeHtml(mod.id)}</code> · v${escapeHtml(mod.version)}${mod.author ? ` · ${escapeHtml(mod.author)}` : ''}</p>
          </div>
          <span class="badge badge-${escapeHtml(mod.origin)}">${mod.origin === 'official' ? t('badge.official', '官方') : t('badge.community', '社区')}</span>
        </header>
        ${mod.description ? `<p class="description">${escapeHtml(mod.description)}</p>` : ''}
        <ul class="chips">${chips.length > 0 ? chips.join('') : `<li class="chip chip-none">${t('permissions.none', '无需权限')}</li>`}</ul>
        <details class="details">
          <summary>${t('details', '签名与校验')}</summary>
          <dl>
            <dt>${t('key', '签名密钥')}</dt><dd>${escapeHtml(mod.keyLabel)} <code>${escapeHtml(mod.keyId)}</code></dd>
            <dt>${t('signedAt', '签名时间')}</dt><dd>${escapeHtml(mod.signedAt.slice(0, 10))}</dd>
            <dt>${t('digest', '签名摘要')}</dt><dd><code class="hash">${escapeHtml(mod.digest)}</code></dd>
            <dt>${t('zipsha', '文件 SHA-256')}</dt><dd><code class="hash">${escapeHtml(mod.download.sha256)}</code>
              <button type="button" class="copy" data-copy="${escapeHtml(mod.download.sha256)}">${t('copy', '复制')}</button></dd>
          </dl>
        </details>
        <footer class="card-foot">
          <span class="signed" data-i18n-title="signed.title" title="由 Folium 签名，安装后显示为「官方认证」"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z"/></svg>${t('signed', '已签名')}</span>
          ${source}
          <a class="download" href="${escapeHtml(mod.download.url)}" download="${escapeHtml(mod.download.fileName)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4h2v9.2l3.3-3.3 1.4 1.4L12 17l-5.7-5.7 1.4-1.4 3.3 3.3V4ZM5 19h14v2H5z"/></svg>
            ${t('download', '下载')} <span class="size">${formatSize(mod.download.size)}</span>
          </a>
        </footer>
      </article>`;
};

export const renderMarketPage = (catalog) => {
    const submitUrl = `https://github.com/${SITE_REPOSITORY}/issues/new?template=mod-submission.yml`;
    const repoUrl = `https://github.com/${SITE_REPOSITORY}`;
    const counts = {
        all: catalog.mods.length,
        official: catalog.mods.filter((mod) => mod.origin === 'official').length,
        community: catalog.mods.filter((mod) => mod.origin === 'community').length,
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
      <p class="tagline">${t('tagline', 'Folia 的官方模组与经过审查的社区模组。每个模组都由 Folium 签名，安装后显示为「官方认证」。')}</p>
      <ol class="steps">
        <li>${t('install.1', '在 Folia 的「设置 → 实验室」里开启模组系统')}</li>
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
        </div>
      </div>

      <section class="grid" data-grid>${catalog.mods.map(renderCard).join('')}
      </section>
      <p class="empty" data-empty hidden>${t('empty', '没有匹配的模组')}</p>
    </main>

    <footer class="site-foot">
      <p>${t('footer.note', '签名证明模组经过 Folium 审查、且发布后没有被改动；但模组启用后仍拥有应用的完整权限，请只启用你需要的模组。')}</p>
      <p><a href="/catalog.json">${t('footer.api', '目录数据（JSON）')}</a> · <a href="${repoUrl}" rel="noopener" target="_blank">${escapeHtml(SITE_REPOSITORY)}</a>${catalog.commit ? ` · <code>${escapeHtml(catalog.commit.slice(0, 7))}</code>` : ''}</p>
    </footer>
  </div>
</body>
</html>
`;
};
