// 落雪歌单转换 · Folium 客户端入口
//
// 把洛雪（LX Music）导出的 .lxmc 歌单转换成 Folia 的歌单文件（.folia-playlist.json），
// 让用户在 Folia 的「导入歌单」里导入。纯本地转换：只读用户选的文件，不联网、不下载音频。
//
// 入口：
//   - 首页新页面「落雪歌单转换」：拖入 / 选择 .lxmc，选好选项，转换成 Folia 歌单并保存到下载文件夹
//   - 命令「打开落雪歌单转换」：从命令面板打开这个页面

const FOLIA_FILE_FORMAT = 'folia-playlist';
const FOLIA_FILE_VERSION = 1;
const UNSUPPORTED_PLATFORMS = { mg: 1 };

const CTRL = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;
const HAS_CTRL = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PRIVATE_HOST = /^(localhost|.*\.(local|lan|internal|home\.arpa)|127\..*|10\..*|192\.168\..*|172\.(1[6-9]|2\d|3[01])\..*|169\.254\..*|0\.0\.0\.0|\[.*\])$/i;
const CREDENTIAL_KEY = /(^|[^a-z])(token|cookie|secret|passw|pwd|api.?key|auth|session|signature|sign)($|[^a-z])/i;

const clean = (value) => String(value == null ? '' : value).replace(CTRL, '');
const clip = (value, max) => clean(value).slice(0, max);

export const CONVERTER_VERSION = '1.0.0';

/** 把 02:00 这样的时长转成毫秒。 */
export function durationMs(interval) {
  const m = /^(\d+):(\d+)$/.exec(String(interval || '').trim());
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : 0;
}

/** 歌手名按常见分隔符拆开。 */
export function splitSinger(text) {
  return String(text || '')
    .split(/[、,，&/]|\s+feat\.?\s+|\s+x\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 16);
}

/** 只收公开、无凭据的 http(s) 封面地址。 */
export function coverUrl(url) {
  const text = String(url || '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(text)) return '';
  let u;
  try { u = new URL(text); } catch { return ''; }
  if (u.username || u.password) return '';
  if (PRIVATE_HOST.test(u.hostname)) return '';
  const keys = [];
  u.searchParams.forEach((_value, key) => keys.push(key));
  for (const key of keys) if (CREDENTIAL_KEY.test(key)) return '';
  return text;
}

function decodeText(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

async function decompress(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Response(stream).text();
}

/** 解析 .lxmc 的字节：gzip / zlib / 纯 JSON 都认。 */
export async function parseLxmcBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text;
  if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
    text = await decompress(u8, 'gzip');
  } else {
    let plain = decodeText(u8);
    if (u8.length > 1 && u8[0] === 0x78) {
      try { plain = await decompress(u8, 'deflate'); } catch { /* 不是 zlib，按纯文本读 */ }
    }
    text = plain;
  }
  text = text.replace(/^\uFEFF/, '').trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('这个文件不是有效的 .lxmc / JSON：' + (e && e.message ? e.message : '解析失败'));
  }
}

/** 从 LX 的 JSON 里取出歌单名与歌曲数组。 */
export function playlistOf(lxmc) {
  if (!lxmc || typeof lxmc !== 'object') throw new Error('文件内容不是 LX Music 歌单');
  const data = lxmc.data && typeof lxmc.data === 'object' ? lxmc.data : lxmc;
  const list = Array.isArray(data.list) ? data.list
    : Array.isArray(lxmc.list) ? lxmc.list
      : Array.isArray(data.songs) ? data.songs
        : Array.isArray(lxmc.songs) ? lxmc.songs
          : null;
  if (!list) throw new Error('歌单里没有找到歌曲列表（可能是别种 .lxmc 结构）');
  const name = String(data.name || lxmc.name || '').trim();
  return { name, songs: list };
}

function mediaOf(song) {
  const src = String((song && song.source) || '').toLowerCase();
  const meta = (song && song.meta) || {};
  const rawId = String((song && song.id) || '');
  if (src === 'wy') {
    const wyId = String(meta.songId != null && meta.songId !== '' ? meta.songId : rawId.split('_').pop()).trim();
    if (!/^\d+$/.test(wyId)) return null;
    const data = { platform: 'wy' };
    if (meta.albumId != null && meta.albumId !== '') data.albumId = String(meta.albumId);
    return { platform: 'wy', mediaId: 'wy:' + wyId, providerData: data };
  }
  if (src === 'tx') {
    const mid = String(meta.songId != null && meta.songId !== '' ? meta.songId : (rawId.indexOf('tx_') === 0 ? rawId.slice(3) : '')).trim();
    if (!/^[0-9A-Za-z]{8,32}$/.test(mid)) return null;
    const data = { platform: 'tx' };
    if (meta.id != null && meta.id !== '') data.songId = String(meta.id);
    if (meta.strMediaMid) data.mediaMid = String(meta.strMediaMid);
    if (meta.albumMid) data.albumMid = String(meta.albumMid);
    if (meta.albumId != null && meta.albumId !== '') data.albumId = String(meta.albumId);
    return { platform: 'tx', mediaId: 'tx:' + mid, providerData: data };
  }
  if (src === 'kg') {
    const hash = String(meta.hash || rawId.split('_').pop() || '').trim();
    if (!/^[0-9a-fA-F]{32}$/.test(hash)) return null;
    const data = { platform: 'kg' };
    if (meta.albumId != null && meta.albumId !== '') data.albumId = String(meta.albumId);
    return { platform: 'kg', mediaId: 'kg:' + hash.toLowerCase(), providerData: data };
  }
  if (src === 'kw') {
    const kwId = String(meta.songId != null && meta.songId !== '' ? meta.songId : (rawId.indexOf('kw_') === 0 ? rawId.slice(3) : '')).trim();
    if (!/^\d+$/.test(kwId)) return null;
    const data = { platform: 'kw' };
    if (meta.albumId != null && meta.albumId !== '') data.albumId = String(meta.albumId);
    return { platform: 'kw', mediaId: 'kw:' + kwId, providerData: data };
  }
  return null;
}

/**
 * 转换核心。
 * options: { name, favorite, includeLocal, now }
 * 返回 { file, stats }；file 是 Folia 导入用的 JSON 对象。
 */
export function convert(lxmc, options = {}) {
  const parsed = playlistOf(lxmc);
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const entries = [];
  const warnings = [];
  const seen = new Set();
  const counts = {};
  const skipped = { unsupported: 0, duplicate: 0, invalid: 0, local: 0, mg: 0 };

  parsed.songs.forEach((song, i) => {
    song = song || {};
    const src = String(song.source || '').toLowerCase();

    if (src === 'local') {
      if (!options.includeLocal) {
        skipped.local += 1;
        return;
      }
      const localName = clip(song.name, 500);
      if (!localName) {
        skipped.invalid += 1;
        return;
      }
      const localMeta = song.meta || {};
      const filePath = String(localMeta.filePath || '');
      let fileName = filePath ? filePath.split(/[\\/]/).pop() : '';
      if (!fileName) fileName = localName + '.' + String(localMeta.ext || 'mp3');
      const localDuration = durationMs(song.interval);
      entries.push({
        source: 'local',
        addedAt: now + i,
        song: {
          name: localName,
          artists: splitSinger(song.singer).map((name) => ({ id: 0, name })),
          album: { id: 0, name: clip(localMeta.albumName, 500) },
          durationMs: localDuration,
        },
        local: Object.assign({ fileName: fileName.slice(0, 512) }, localDuration > 0 ? { durationMs: localDuration } : {}),
      });
      return;
    }

    if (UNSUPPORTED_PLATFORMS[src]) {
      skipped.mg += 1;
      if (warnings.length < 10) warnings.push('已跳过咪咕歌曲（Folia 洛雪音源不支持咪咕）：' + clip(song.name, 40));
      return;
    }

    const media = mediaOf(song);
    if (!media) {
      skipped.unsupported += 1;
      if (warnings.length < 10) warnings.push('无法识别（' + (src || '未知平台') + '）：' + clip(song.name, 40));
      return;
    }
    if (seen.has(media.mediaId)) {
      skipped.duplicate += 1;
      return;
    }
    seen.add(media.mediaId);

    const name = clip(song.name, 500);
    if (!name) {
      skipped.invalid += 1;
      return;
    }
    const meta = song.meta || {};
    const album = { id: 0, name: clip(meta.albumName, 500) };
    const cover = coverUrl(meta.picUrl);
    if (cover) album.coverUrl = cover;
    counts[media.platform] = (counts[media.platform] || 0) + 1;

    entries.push({
      source: 'online',
      addedAt: now + i,
      song: {
        id: media.mediaId,
        name,
        artists: splitSinger(song.singer).map((artistName) => ({ id: 0, name: artistName })),
        album,
        durationMs: durationMs(song.interval),
        sourceRef: {
          kind: 'online',
          providerId: 'lxmusic',
          mediaId: media.mediaId,
          providerData: media.providerData,
        },
      },
    });
  });

  const playlistName = clip(options.name || parsed.name || '导入的歌单', 200) || '导入的歌单';
  const file = {
    format: FOLIA_FILE_FORMAT,
    version: FOLIA_FILE_VERSION,
    exportedAt: now,
    playlist: { name: playlistName, createdAt: now, entries },
  };
  if (options.favorite) file.playlist.favorite = true;

  return {
    file,
    stats: {
      total: parsed.songs.length,
      entries: entries.length,
      online: entries.filter((entry) => entry.source === 'online').length,
      local: entries.filter((entry) => entry.source === 'local').length,
      platforms: counts,
      skipped,
      warnings,
      name: playlistName,
    },
  };
}

/** 文件名 → 建议歌单名。 */
export function nameFromFileName(fileName) {
  return String(fileName || '').replace(/\.lxmc$/i, '') || 'LX 歌单';
}

// ---------------------------------------------------------------------------
// 首页页面 UI
// ---------------------------------------------------------------------------

const CSS = `
.lxmc2folia { box-sizing: border-box; height: 100%; overflow: auto; padding: 28px 28px 120px; font: 14px/1.7 var(--folium-font, "Microsoft YaHei", system-ui, sans-serif); color: inherit; }
.lxmc2folia * { box-sizing: border-box; }
.lxmc2folia .wrap { max-width: 920px; margin: 0 auto; }
.lxmc2folia h1 { margin: 0 0 4px; font-size: 22px; }
.lxmc2folia .sub { margin: 0 0 20px; opacity: .7; font-size: 13px; }
.lxmc2folia .card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 16px; padding: 18px; margin-bottom: 16px; background: color-mix(in srgb, currentColor 4%, transparent); }
.lxmc2folia .drop { border: 2px dashed color-mix(in srgb, currentColor 26%, transparent); border-radius: 14px; padding: 26px 16px; text-align: center; cursor: pointer; transition: .15s; }
.lxmc2folia .drop:hover, .lxmc2folia .drop.hover { border-color: #6f9cff; background: color-mix(in srgb, #6f9cff 8%, transparent); }
.lxmc2folia .drop b { display: block; font-size: 15px; margin-bottom: 2px; }
.lxmc2folia .drop span { opacity: .65; font-size: 12.5px; }
.lxmc2folia .fileline { margin-top: 10px; font-size: 13px; opacity: .85; }
.lxmc2folia .row { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: 14px; }
.lxmc2folia label.opt { display: inline-flex; gap: 8px; align-items: center; cursor: pointer; font-size: 13px; }
.lxmc2folia input[type=text] { flex: 1; min-width: 200px; background: color-mix(in srgb, currentColor 6%, transparent); border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 9px; color: inherit; padding: 8px 12px; font: inherit; outline: none; }
.lxmc2folia input[type=text]:focus { border-color: #6f9cff; }
.lxmc2folia button { border: 1px solid color-mix(in srgb, currentColor 30%, transparent); background: color-mix(in srgb, currentColor 8%, transparent); color: inherit; border-radius: 999px; padding: 8px 20px; font: inherit; font-weight: 600; cursor: pointer; }
.lxmc2folia button.primary { background: #6f9cff; border-color: #6f9cff; color: #0b0e13; }
.lxmc2folia button:disabled { opacity: .4; cursor: default; }
.lxmc2folia .msg { font-size: 13px; margin-top: 12px; min-height: 18px; }
.lxmc2folia .msg.err { color: #ff6b6b; }
.lxmc2folia .msg.ok { color: #4cc38a; }
.lxmc2folia .stats { font-size: 13px; margin-top: 10px; }
.lxmc2folia .stats b { font-weight: 600; }
.lxmc2folia .tag { display: inline-block; border-radius: 7px; padding: 1px 8px; margin: 0 6px 4px 0; font-size: 12px; background: color-mix(in srgb, currentColor 10%, transparent); }
.lxmc2folia .warn { color: #e8b04b; font-size: 12.5px; margin-top: 8px; }
.lxmc2folia .path { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; word-break: break-all; opacity: .9; }
.lxmc2folia ol { margin: 8px 0 0; padding-left: 20px; font-size: 13px; opacity: .8; }
.lxmc2folia code { background: color-mix(in srgb, currentColor 10%, transparent); border-radius: 5px; padding: 1px 6px; font-size: 12.5px; }
`;

function buildPage(folium, container, ctx) {
  const zh = String((ctx && ctx.locale) || navigator.language || '').toLowerCase().startsWith('zh');
  const t = (zhText, enText) => (zh ? zhText : enText);
  const rpc = folium.rpc;
  let pickedFile = null;
  let lastResult = null;

  const style = document.createElement('style');
  style.textContent = CSS;

  const root = document.createElement('div');
  root.className = 'lxmc2folia';
  root.innerHTML = `
    <div class="wrap">
      <h1>${t('落雪歌单转换', 'LX Music playlist converter')}</h1>
      <p class="sub">${t(
        '把洛雪（LX Music）导出的 .lxmc 歌单转换成 Folia 的歌单文件，再用 Folia 的「导入歌单」导入。纯本地转换，不联网、不下载音频。',
        'Convert an LX Music .lxmc playlist into a Folia playlist file, then import it with Folia\'s “Import playlist”. Local only: no network, no audio downloads.'
      )}</p>
      <div class="card">
        <div class="drop" id="drop">
          <b>${t('把 .lxmc 文件拖到这里', 'Drop an .lxmc file here')}</b>
          <span>${t('或点击选择文件', 'or click to choose a file')}</span>
          <input type="file" id="picker" accept=".lxmc,.json,application/json,application/gzip" hidden>
        </div>
        <div class="fileline" id="fileline">${t('还没有选择文件', 'No file selected yet')}</div>
        <div class="row">
          <input type="text" id="name" placeholder="${t('歌单名（留空用文件里的名字）', 'Playlist name (leave empty to use the file name)')}">
        </div>
        <div class="row">
          <label class="opt"><input type="checkbox" id="fav" checked> ${t('标记为「我喜欢的音乐」', 'Mark as “Liked Songs”')}</label>
          <label class="opt"><input type="checkbox" id="local" checked> ${t('包含本地歌（只写文件名和时长线索）', 'Include local songs (file name + duration hint only)')}</label>
        </div>
        <div class="row">
          <button class="primary" id="convert" disabled>${t('转换', 'Convert')}</button>
          <button id="save" disabled>${t('保存到下载文件夹', 'Save to Downloads')}</button>
        </div>
        <div class="msg" id="msg"></div>
        <div id="result"></div>
      </div>
      <div class="card">
        <b>${t('在 Folia 里导入', 'Import in Folia')}</b>
        <ol>
          <li>${t('保存后，打开 Folia 的本地音乐 / 歌单区域', 'After saving, open the local music / playlists area in Folia')}</li>
          <li>${t('操作菜单（新建歌单、排序歌单那一排）→「导入歌单」', 'Open the actions menu (next to New playlist / Reorder) → “Import playlist”')}</li>
          <li>${t('选择刚才保存的 .folia-playlist.json，确认预览后导入', 'Pick the saved .folia-playlist.json and confirm the preview')}</li>
        </ol>
        <p class="warn">${t(
          '转换后的歌单里的歌指向 Folia 的「洛雪音源（lxmusic）」。能不能播放取决于你在 Folia 里启用的音源和导入的第三方脚本——这部分和本模组无关，脚本来源与可用性由你自己负责。',
          'Songs point at Folia\'s lxmusic source. Whether they play depends on the sources you enable and the third-party scripts you import — outside this mod, and the scripts\' provenance is your own responsibility.'
        )}</p>
      </div>
    </div>
  `;
  container.append(style, root);

  const drop = root.querySelector('#drop');
  const picker = root.querySelector('#picker');
  const fileline = root.querySelector('#fileline');
  const nameInput = root.querySelector('#name');
  const favInput = root.querySelector('#fav');
  const localInput = root.querySelector('#local');
  const convertBtn = root.querySelector('#convert');
  const saveBtn = root.querySelector('#save');
  const msg = root.querySelector('#msg');
  const result = root.querySelector('#result');

  let converting = false;

  const setMsg = (text, kind) => {
    msg.textContent = text || '';
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  };

  const chooseFile = (file) => {
    if (!file) return;
    pickedFile = file;
    fileline.textContent = t('已选择：', 'Selected: ') + file.name + '（' + Math.max(1, Math.round(file.size / 1024)) + ' KB）';
    convertBtn.disabled = false;
    saveBtn.disabled = true;
    lastResult = null;
    result.textContent = '';
    setMsg('');
  };

  drop.addEventListener('click', () => picker.click());
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('hover');
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) chooseFile(file);
  });
  picker.addEventListener('change', () => { if (picker.files && picker.files[0]) chooseFile(picker.files[0]); });

  convertBtn.addEventListener('click', async () => {
    if (!pickedFile || converting) return;
    converting = true;
    convertBtn.disabled = true;
    setMsg(t('正在读取并转换…', 'Reading and converting…'));
    try {
      const bytes = new Uint8Array(await pickedFile.arrayBuffer());
      const lxmc = await parseLxmcBytes(bytes);
      const converted = convert(lxmc, {
        name: nameInput.value.trim(),
        favorite: favInput.checked,
        includeLocal: localInput.checked,
      });
      if (!converted.stats.entries) {
        throw new Error(t('这个歌单里没有能导入的歌。', 'Nothing in this playlist can be imported.'));
      }
      const suggested = nameFromFileName(pickedFile.name) + '.folia-playlist.json';
      lastResult = { fileName: suggested, content: JSON.stringify(converted.file, null, 1) + '\n' };
      renderResult(converted.stats);
      saveBtn.disabled = false;
      setMsg(t('转换完成，可以保存了。', 'Converted — ready to save.'), 'ok');
    } catch (error) {
      lastResult = null;
      saveBtn.disabled = true;
      setMsg((error && error.message) || String(error), 'err');
    } finally {
      converting = false;
      convertBtn.disabled = !pickedFile;
    }
  });

  const renderResult = (stats) => {
    result.textContent = '';
    const line = document.createElement('div');
    line.className = 'stats';
    line.innerHTML = t('歌单名：', 'Playlist: ') + '<b>' + escapeHtml(stats.name) + '</b> · '
      + t('原文件 ', 'file ') + '<b>' + stats.total + '</b> ' + t('首', 'songs') + ' · '
      + t('写入 ', 'imported ') + '<b>' + stats.entries + '</b> ' + t('首', 'songs')
      + '（' + t('在线 ', 'online ') + stats.online + (stats.local ? t('，本地 ', ', local ') + stats.local : '') + '）';
    result.append(line);
    const tags = document.createElement('div');
    tags.className = 'stats';
    Object.entries(stats.platforms).forEach(([platform, count]) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = platform + ' ' + count;
      tags.append(tag);
    });
    result.append(tags);
    const skipped = [];
    if (stats.skipped.local) skipped.push(t('本地 ', 'local ') + stats.skipped.local);
    if (stats.skipped.mg) skipped.push(t('咪咕 ', 'mg ') + stats.skipped.mg);
    if (stats.skipped.unsupported) skipped.push(t('无法识别 ', 'unrecognized ') + stats.skipped.unsupported);
    if (stats.skipped.duplicate) skipped.push(t('重复 ', 'duplicate ') + stats.skipped.duplicate);
    if (stats.skipped.invalid) skipped.push(t('无效 ', 'invalid ') + stats.skipped.invalid);
    if (skipped.length) {
      const skipLine = document.createElement('div');
      skipLine.className = 'stats';
      skipLine.textContent = t('跳过：', 'Skipped: ') + skipped.join('，');
      result.append(skipLine);
    }
    if (stats.warnings.length) {
      const warn = document.createElement('div');
      warn.className = 'warn';
      warn.textContent = '⚠ ' + stats.warnings.slice(0, 6).join('\n⚠ ');
      result.append(warn);
    }
  };

  saveBtn.addEventListener('click', async () => {
    if (!lastResult) return;
    saveBtn.disabled = true;
    setMsg(t('正在保存…', 'Saving…'));
    try {
      const saved = await rpc.call('save-file', lastResult);
      const path = saved && typeof saved.path === 'string' ? saved.path : '';
      result.textContent = '';
      const line = document.createElement('div');
      line.className = 'stats';
      line.innerHTML = t('已保存到：', 'Saved to: ');
      const code = document.createElement('div');
      code.className = 'path';
      code.textContent = path;
      result.append(line, code);
      setMsg(t('下载文件夹里已经生成 Folia 歌单文件，去「导入歌单」导入它。', 'Saved to your Downloads folder — import it with “Import playlist”.'), 'ok');
      if (folium.ui && folium.ui.toast) {
        folium.ui.toast(t('已保存 ' + lastResult.fileName, 'Saved ' + lastResult.fileName), { type: 'success' });
      }
    } catch (error) {
      saveBtn.disabled = false;
      setMsg((error && error.message) || String(error), 'err');
    }
  });

  return () => {
    container.textContent = '';
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export default function activate(folium) {
  const tab = folium.registries.homeTabs.register({
    id: 'converter',
    order: 300,
    label: { 'zh-CN': '落雪歌单转换', 'zh-TW': '落雪歌單轉換', en: 'LX playlist converter' },
    mount(container, ctx) {
      return buildPage(folium, container, ctx);
    },
  });

  const command = folium.registries.commands.register({
    id: 'open',
    label: { 'zh-CN': '打开落雪歌单转换', 'zh-TW': '開啟落雪歌單轉換', en: 'Open LX playlist converter' },
    description: { 'zh-CN': '把 .lxmc 歌单转换成 Folia 歌单文件', en: 'Convert an .lxmc playlist into a Folia playlist file' },
    keywords: ['lxmc', 'lx music', '落雪', '歌单', 'playlist', 'convert'],
    run() {
      folium.ui.openHomeTab('converter');
      return { message: 'ok' };
    },
  });

  return () => {
    command.unregister();
    tab.unregister();
  };
}
