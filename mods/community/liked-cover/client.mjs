// liked-cover/client.mjs
// 只做一件事：把资料库里「我喜欢」这一项的封面换成用户自己的图。
//
// 原理：Folia 在资料库、歌单侧边面板、集合页头图里画封面时，img 的 alt 就是这一项的显示名
// （QQ 音乐里叫「我喜欢」）。模组用 registries.styles 注入一小段 CSS：
//   img[alt="我喜欢"] { opacity: 0 }                     —— 藏掉原来那张大爱心
//   *:has(> img[alt="我喜欢"]) { background-image: ... } —— 在它原来占的方框上画新图
// 图片本身存在模组自己的数据文件里（folia.storage），运行时转成 blob: URL 交给 CSS，
// 这样既能重启后还在，又不会因为 CSS 有 64KB 上限而把大图截坏。
// Bravais 海报墙那张卡另有一条规则（[data-bravais-special="liked"]），可以在设置里关掉。

/** @typedef {import('../folium').FoliumClientApi} Folium */

const STORAGE_KEY = 'cover';
const STYLE_ID = 'cover';
const MAX_SIDE = 1024;
const MAX_DATA_URL = 600000;

const TEXT = {
  zh: {
    sectionLabel: '「我喜欢」的封面',
    sectionDesc: '换掉资料库里「我喜欢」那一项显示的图。QQ 音乐不给改，所以一直是那颗大爱心。',
    empty: '还没有设置，现在显示的是 QQ 音乐自带的那张图。',
    pick: '选择图片…',
    drop: '也可以把图片拖进来',
    remove: '恢复默认',
    fit: '图片怎么放',
    fitCover: '铺满',
    fitContain: '完整显示',
    nameLabel: '列表里显示的名字',
    nameHint: '默认「我喜欢」。如果换上后没反应，就把它改成资料库里那一行实际显示的文字。',
    wallLabel: '同时替换海报墙（Bravais 资料库）那张卡',
    saved: '封面已更换',
    cleared: '已恢复默认封面',
    failed: '这张图读不了，换一张试试',
    tooBig: '图片太大，存不下',
    reading: '正在处理图片…',
    unsupported: '这张图片的格式读不了，试试 JPG / PNG / WebP',
  },
  en: {
    sectionLabel: 'Cover of the liked playlist',
    sectionDesc: 'Replaces the artwork of the liked collection in the library — QQ Music gives it a big heart and no way to change it.',
    empty: 'Nothing set yet. The host artwork (QQ Music’s heart) is showing.',
    pick: 'Choose an image…',
    drop: 'or drop an image here',
    remove: 'Reset',
    fit: 'How to fit',
    fitCover: 'Fill',
    fitContain: 'Fit inside',
    nameLabel: 'Name shown in the list',
    nameHint: 'Defaults to 我喜欢. If nothing changes, set it to the exact text of that row.',
    wallLabel: 'Also replace the poster-wall card (Bravais library)',
    saved: 'Cover replaced',
    cleared: 'Back to the default cover',
    failed: 'That image could not be read, try another one',
    tooBig: 'The image is too large to store',
    reading: 'Processing the image…',
    unsupported: 'Unsupported image format, try JPG / PNG / WebP',
  },
};

/** 把任意文字变成 CSS 字符串字面量（只转义反斜杠、引号和换行，中文原样保留）。 */
const cssString = (value) => `"${String(value)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\r?\n/g, '\\a ')}"`;

const dataUrlToBlob = (dataUrl) => {
  const comma = dataUrl.indexOf(',');
  const head = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = /data:([^;]+)/.exec(head);
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime ? mime[1] : 'image/png' });
};

const encodeCanvas = (canvas, quality) => {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', quality);
};

/** 缩到最长边 MAX_SIDE，转成 webp（不支持就 jpeg），再压到能塞进数据文件。 */
const prepareImage = async (file) => {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === 'function') bitmap.close();

  let quality = 0.9;
  let dataUrl = encodeCanvas(canvas, quality);
  while (dataUrl.length > MAX_DATA_URL && quality > 0.4) {
    quality -= 0.1;
    dataUrl = encodeCanvas(canvas, quality);
  }
  return { dataUrl, width, height, bytes: Math.round((dataUrl.length * 3) / 4) };
};

export default function activate(folium) {
  const zh = (navigator.language || 'zh').toLowerCase().startsWith('zh');
  const t = TEXT[zh ? 'zh' : 'en'];

  let cover = null;          // { dataUrl, width, height, bytes }
  let objectUrl = null;
  let styleHandle = null;
  let section = null;
  let disposed = false;
  const listeners = new Set();

  const snapshot = () => ({
    hasCover: Boolean(cover),
    objectUrl,
    width: cover ? cover.width : 0,
    height: cover ? cover.height : 0,
  });

  const notify = () => listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      folium.log.error('listener failed', String(error));
    }
  });

  const values = () => {
    const raw = section ? section.settings.get() : {};
    return {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '我喜欢',
      fit: raw.fit === 'contain' ? 'contain' : 'cover',
      wall: raw.wall !== false,
    };
  };

  const buildCss = (url, { name, fit, wall }) => {
    const sized = `background-image:url("${url}") !important;`
      + `background-size:${fit} !important;`
      + 'background-position:center center !important;'
      + 'background-repeat:no-repeat !important;';
    const selector = `img[alt=${cssString(name)}]`;
    const rules = [
      `${selector}{opacity:0 !important}`,
      `*:has(> ${selector}){${sized}}`,
    ];
    if (wall) rules.push(`.bravais-tile[data-bravais-special="liked"] > .lattice-poster{${sized}}`);
    return rules.join('\n');
  };

  const apply = () => {
    const css = objectUrl ? buildCss(objectUrl, values()) : '';
    if (styleHandle) {
      styleHandle.unregister();
      styleHandle = null;
    }
    if (!css) return;
    try {
      styleHandle = folium.registries.styles.register({ id: STYLE_ID, css });
    } catch (error) {
      folium.log.error('failed to register the stylesheet', String(error));
    }
  };

  const setCover = async (next) => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = next.dataUrl ? URL.createObjectURL(dataUrlToBlob(next.dataUrl)) : null;
    cover = next.dataUrl ? { dataUrl: next.dataUrl, width: next.width, height: next.height } : null;
    apply();
    notify();
  };

  const persist = async (payload) => {
    if (payload) await folium.storage.set(STORAGE_KEY, payload);
    else await folium.storage.delete(STORAGE_KEY);
  };

  const useFile = async (file) => {
    if (!file) return;
    folium.ui.toast(t.reading, { type: 'info' });
    const prepared = await prepareImage(file);
    if (!prepared) {
      folium.ui.toast(t.unsupported, { type: 'error' });
      return;
    }
    if (prepared.dataUrl.length > MAX_DATA_URL) {
      folium.ui.toast(t.tooBig, { type: 'error' });
      return;
    }
    try {
      await persist(prepared);
    } catch (error) {
      folium.log.error('failed to store the cover', String(error));
      folium.ui.toast(t.tooBig, { type: 'error' });
      return;
    }
    await setCover(prepared);
    folium.ui.toast(t.saved, { type: 'success' });
  };

  const clearCover = async () => {
    try {
      await persist(null);
    } catch (error) {
      folium.log.error('failed to clear the cover', String(error));
    }
    await setCover({ dataUrl: null });
    folium.ui.toast(t.cleared, { type: 'success' });
  };

  /* ---------- 设置面板 ---------- */

  const h = (tag, props, children) => {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (key === 'style') Object.assign(node.style, value);
        else if (key === 'text') node.textContent = value;
        else if (key === 'class') node.className = value;
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
        else node.setAttribute(key, value);
      }
    }
    for (const child of children || []) {
      if (child == null) continue;
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  };

  const mountPanel = (container, ctx) => {
    const style = h('style', {
      text: `
        :host, * { box-sizing: border-box; }
        .wrap { display: flex; flex-direction: column; gap: 14px; font: 13px/1.6 var(--folium-font, sans-serif); color: var(--folium-primary, #fff); }
        .top { display: flex; gap: 14px; align-items: center; }
        .thumb { width: 72px; height: 72px; border-radius: 12px; flex: none; overflow: hidden;
          background: color-mix(in srgb, currentColor 10%, transparent); display: grid; place-items: center; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .thumb span { font-size: 11px; opacity: .5; }
        .grow { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        button { font: inherit; padding: 7px 14px; border-radius: 999px; cursor: pointer;
          border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
          background: transparent; color: inherit; transition: background .16s; }
        button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
        button.primary { background: var(--folium-accent, #e05252); border-color: transparent; color: #fff; font-weight: 600; }
        .seg { display: inline-flex; border: 1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 999px; overflow: hidden; }
        .seg button { border: 0; border-radius: 0; padding: 6px 14px; }
        .seg button.on { background: color-mix(in srgb, currentColor 18%, transparent); font-weight: 600; }
        .note { font-size: 11.5px; opacity: .6; }
        .drop { border: 1px dashed color-mix(in srgb, currentColor 30%, transparent); border-radius: 12px;
          padding: 10px 14px; font-size: 12px; opacity: .75; transition: background .16s, border-color .16s; }
        .drop.over { background: color-mix(in srgb, var(--folium-accent, #e05252) 14%, transparent);
          border-color: var(--folium-accent, #e05252); opacity: 1; }
        input[type=text] { font: inherit; width: 100%; padding: 7px 12px; border-radius: 10px; color: inherit;
          border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
          background: color-mix(in srgb, currentColor 6%, transparent); }
        label.check { display: flex; gap: 8px; align-items: center; font-size: 12.5px; }
        .label { font-size: 11.5px; letter-spacing: .04em; text-transform: uppercase; opacity: .5; }
      `,
    });

    const thumb = h('div', { class: 'thumb' });
    const status = h('div', { class: 'note' });
    const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    const pickButton = h('button', { class: 'primary', type: 'button', text: t.pick });
    const removeButton = h('button', { type: 'button', text: t.remove });
    const drop = h('div', { class: 'drop', text: t.drop });
    const nameInput = h('input', { type: 'text', spellcheck: 'false' });
    const segCover = h('button', { type: 'button', text: t.fitCover });
    const segContain = h('button', { type: 'button', text: t.fitContain });
    const seg = h('div', { class: 'seg' }, [segCover, segContain]);
    const wallBox = h('input', { type: 'checkbox' });
    const wallLabel = h('label', { class: 'check' }, [wallBox, h('span', { text: t.wallLabel })]);

    let nameFocused = false;

    const render = () => {
      const state = snapshot();
      const v = values();
      thumb.replaceChildren();
      if (state.hasCover && state.objectUrl) {
        thumb.append(h('img', { src: state.objectUrl, alt: '' }));
        status.textContent = `${state.width} × ${state.height}`;
        removeButton.disabled = false;
      } else {
        thumb.append(h('span', { text: '—' }));
        status.textContent = t.empty;
        removeButton.disabled = true;
      }
      if (!nameFocused) nameInput.value = v.name;
      segCover.classList.toggle('on', v.fit === 'cover');
      segContain.classList.toggle('on', v.fit === 'contain');
      wallBox.checked = v.wall;
    };

    nameInput.addEventListener('focus', () => { nameFocused = true; });
    nameInput.addEventListener('blur', () => { nameFocused = false; });

    pickButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      void useFile(file);
    });
    removeButton.addEventListener('click', () => { void clearCover(); });
    segCover.addEventListener('click', () => { ctx.settings.set({ fit: 'cover' }); });
    segContain.addEventListener('click', () => { ctx.settings.set({ fit: 'contain' }); });
    nameInput.addEventListener('input', () => { ctx.settings.set({ name: nameInput.value }); });
    wallBox.addEventListener('change', () => { ctx.settings.set({ wall: wallBox.checked }); });

    drop.addEventListener('dragover', (event) => {
      event.preventDefault();
      drop.classList.add('over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (event) => {
      event.preventDefault();
      drop.classList.remove('over');
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      void useFile(file);
    });

    const root = h('div', { class: 'wrap' }, [
      h('div', { class: 'top' }, [
        thumb,
        h('div', { class: 'grow' }, [
          h('div', { class: 'row' }, [pickButton, removeButton]),
          status,
        ]),
      ]),
      drop,
      h('div', {}, [h('div', { class: 'label', text: t.fit }), h('div', { class: 'row', style: { marginTop: '6px' } }, [seg])]),
      h('div', {}, [
        h('div', { class: 'label', text: t.nameLabel }),
        h('div', { style: { marginTop: '6px' } }, [nameInput]),
        h('div', { class: 'note', style: { marginTop: '6px' }, text: t.nameHint }),
      ]),
      wallLabel,
      fileInput,
    ]);

    container.append(style, root);
    render();
    listeners.add(render);
    ctx.settings.onChange(() => apply());
    ctx.onDispose(() => listeners.delete(render));
  };

  /* ---------- 启动 ---------- */

  section = folium.registries.settingsSections.register({
    id: 'cover',
    label: { 'zh-CN': t.sectionLabel, en: TEXT.en.sectionLabel },
    description: { 'zh-CN': t.sectionDesc, en: TEXT.en.sectionDesc },
    settings: [
      { key: 'name', type: 'text', label: { 'zh-CN': t.nameLabel, en: TEXT.en.nameLabel }, defaultValue: '我喜欢' },
      {
        key: 'fit',
        type: 'select',
        label: { 'zh-CN': t.fit, en: TEXT.en.fit },
        defaultValue: 'cover',
        options: [
          { value: 'cover', label: { 'zh-CN': t.fitCover, en: TEXT.en.fitCover } },
          { value: 'contain', label: { 'zh-CN': t.fitContain, en: TEXT.en.fitContain } },
        ],
      },
      { key: 'wall', type: 'boolean', label: { 'zh-CN': t.wallLabel, en: TEXT.en.wallLabel }, defaultValue: true },
    ],
    settingsPanel: mountPanel,
  });

  section.settings.onChange(() => apply());

  const load = async () => {
    try {
      const stored = await folium.storage.get(STORAGE_KEY);
      if (disposed) return;
      if (stored && typeof stored.dataUrl === 'string' && stored.dataUrl.startsWith('data:')) {
        await setCover({
          dataUrl: stored.dataUrl,
          width: Number(stored.width) || 0,
          height: Number(stored.height) || 0,
        });
      } else {
        notify();
      }
    } catch (error) {
      folium.log.error('failed to load the cover', String(error));
      notify();
    }
  };
  void load();

  return () => {
    disposed = true;
    listeners.clear();
    if (styleHandle) {
      styleHandle.unregister();
      styleHandle = null;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
}
