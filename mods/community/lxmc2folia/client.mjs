// 洛雪歌单转换 · Folium 客户端入口
//
// 把洛雪（LX Music）导出的 .lxmc 歌单转换成 Folia 的歌单文件（.folia-playlist.json），
// 让用户在 Folia 的「导入歌单」里导入。纯本地转换：只读用户选的文件，不联网、不下载音频。
//
// 入口：
//   - 首页新页面「洛雪歌单转换」：拖入 / 选择 .lxmc，选好选项，转换成 Folia 歌单并保存到下载文件夹
//   - 命令「打开洛雪歌单转换」：从命令面板打开这个页面

const FOLIA_FILE_FORMAT = 'folia-playlist';
const FOLIA_FILE_VERSION = 1;
const UNSUPPORTED_PLATFORMS = { mg: 1 };
const SUPPORTED_PLATFORMS = { wy: 1, tx: 1, kg: 1, kw: 1 };
const PLATFORM_LABELS = { wy: '网易云', tx: 'QQ', kg: '酷狗', kw: '酷我' };

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
  const skipped = { unsupported: 0, duplicate: 0, invalid: 0, local: 0, mg: 0, byPlatform: {} };
  const allowed = Array.isArray(options.platforms) && options.platforms.length
    ? new Set(options.platforms.filter((platform) => SUPPORTED_PLATFORMS[platform]))
    : null;

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

    if (allowed && SUPPORTED_PLATFORMS[src] && !allowed.has(src)) {
      skipped.byPlatform[src] = (skipped.byPlatform[src] || 0) + 1;
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
.lxmc2folia {
  --lx-fg: rgba(255, 255, 255, 0.95);
  --lx-muted: rgba(255, 255, 255, 0.74);
  --lx-faint: rgba(255, 255, 255, 0.52);
  --lx-card: rgba(255, 255, 255, 0.05);
  --lx-card-strong: rgba(255, 255, 255, 0.08);
  --lx-border: rgba(255, 255, 255, 0.10);
  --lx-border-strong: rgba(255, 255, 255, 0.18);
  --lx-input: rgba(255, 255, 255, 0.06);
  --lx-accent: #a8d96b;
  --lx-accent-strong: #7fb83c;
  --lx-on-accent: #0e1806;
  --lx-ok: #86e08b;
  --lx-danger: #ff8f85;
  --lx-glow: rgba(255, 255, 255, 0.16);
  position: relative;
  overflow: hidden;
  font-family: inherit;
  color: var(--lx-fg);
  padding: 32px 24px 140px;
  isolation: isolate;
}
.lxmc2folia.theme-light {
  --lx-fg: rgba(16, 24, 15, 0.93);
  --lx-muted: rgba(16, 24, 15, 0.72);
  --lx-faint: rgba(16, 24, 15, 0.50);
  --lx-card: rgba(255, 255, 255, 0.58);
  --lx-card-strong: rgba(255, 255, 255, 0.86);
  --lx-border: rgba(16, 24, 15, 0.10);
  --lx-border-strong: rgba(16, 24, 15, 0.18);
  --lx-input: rgba(255, 255, 255, 0.82);
  --lx-accent: #4f8f1f;
  --lx-accent-strong: #3a6f10;
  --lx-on-accent: #ffffff;
  --lx-ok: #2f7a35;
  --lx-danger: #b42318;
  --lx-glow: rgba(255, 255, 255, 0.65);
}
.lxmc2folia * { box-sizing: border-box; }
.lxmc2folia .aura {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.55;
}
.lxmc2folia .aura-1 {
  width: 560px; height: 560px; left: -180px; top: -160px;
  background: radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--lx-accent) 55%, transparent), transparent 70%);
}
.lxmc2folia .aura-2 {
  width: 520px; height: 520px; right: -200px; top: 240px;
  background: radial-gradient(circle at 60% 40%, rgba(110, 150, 255, 0.38), transparent 72%);
}
.lxmc2folia .aura-3 {
  width: 420px; height: 420px; left: 30%; bottom: -180px;
  background: radial-gradient(circle at 50% 50%, rgba(255, 140, 190, 0.22), transparent 72%);
}
.lxmc2folia .wrap {
  position: relative;
  z-index: 1;
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.lxmc2folia h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 34px);
  font-weight: 750;
  letter-spacing: -0.025em;
  line-height: 1.15;
  color: var(--lx-fg);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
}
.lxmc2folia .sub {
  margin: 8px 0 0;
  max-width: 760px;
  color: var(--lx-muted);
  font-size: 14px;
  line-height: 1.65;
}
.lxmc2folia .card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
  border-radius: 24px;
  border: 1px solid transparent;
  background:
    linear-gradient(150deg,
      color-mix(in srgb, var(--lx-fg) 8%, transparent),
      color-mix(in srgb, var(--lx-fg) 3%, transparent) 55%,
      color-mix(in srgb, var(--lx-fg) 5%, transparent)) padding-box;
  backdrop-filter: blur(28px) saturate(1.7);
  -webkit-backdrop-filter: blur(28px) saturate(1.7);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 var(--lx-glow),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.lxmc2folia .card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.08) 42%, rgba(255, 255, 255, 0.02) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.lxmc2folia .card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(140px 70px at 16% 0%, rgba(255, 255, 255, 0.10), transparent 72%);
  pointer-events: none;
  z-index: 0;
}
.lxmc2folia .card > b { position: relative; z-index: 1; font-size: 15px; font-weight: 650; }
.lxmc2folia .card > * { position: relative; z-index: 1; }
.lxmc2folia .drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 22px;
  text-align: center;
  cursor: pointer;
  border-radius: 20px;
  border: 1.5px dashed var(--lx-border-strong);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent);
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.lxmc2folia .drop b { font-size: 15px; font-weight: 600; }
.lxmc2folia .drop span { color: var(--lx-muted); font-size: 13px; }
.lxmc2folia .drop:hover,
.lxmc2folia .drop.hover {
  border-color: var(--lx-accent);
  background: color-mix(in srgb, var(--lx-accent) 10%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 12px 34px color-mix(in srgb, var(--lx-accent) 16%, transparent);
}
.lxmc2folia .fileline { color: var(--lx-muted); font-size: 13px; }
.lxmc2folia .row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.lxmc2folia input[type="text"],
.lxmc2folia input[type="number"],
.lxmc2folia select {
  min-width: 0;
  padding: 11px 15px;
  border-radius: 14px;
  border: 1px solid var(--lx-border);
  background: var(--lx-input);
  color: var(--lx-fg);
  font: inherit;
  font-size: 14px;
  outline: none;
  backdrop-filter: blur(10px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.lxmc2folia input[type="text"] { flex: 1 1 240px; }
.lxmc2folia input[type="text"]::placeholder { color: var(--lx-faint); }
.lxmc2folia input[type="text"]:focus,
.lxmc2folia input[type="number"]:focus,
.lxmc2folia select:focus {
  border-color: var(--lx-accent);
  background: color-mix(in srgb, var(--lx-accent) 6%, var(--lx-input));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--lx-accent) 24%, transparent);
}
.lxmc2folia select option { background: #151915; color: #f2f2f2; }
.lxmc2folia.theme-light select option { background: #ffffff; color: #10180f; }
.lxmc2folia button {
  position: relative;
  overflow: hidden;
  padding: 11px 20px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(180deg, color-mix(in srgb, var(--lx-fg) 14%, transparent), color-mix(in srgb, var(--lx-fg) 6%, transparent));
  color: var(--lx-fg);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 22px rgba(0, 0, 0, 0.22);
  transition: transform 0.12s ease, background 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}
.lxmc2folia button::after {
  content: '';
  position: absolute;
  inset: 1px 6% 52% 6%;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.26), transparent);
  pointer-events: none;
  opacity: 0.8;
}
.lxmc2folia button:hover {
  transform: translateY(-1px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26), 0 14px 30px rgba(0, 0, 0, 0.28);
}
.lxmc2folia button:active { transform: translateY(0); }
.lxmc2folia button:disabled { opacity: 0.42; cursor: default; transform: none; }
.lxmc2folia button.primary {
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: linear-gradient(140deg, color-mix(in srgb, var(--lx-accent) 92%, white), var(--lx-accent-strong));
  color: var(--lx-on-accent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    0 12px 30px color-mix(in srgb, var(--lx-accent) 34%, transparent);
}
.lxmc2folia button.primary:hover { filter: brightness(1.06); }
.lxmc2folia .opt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--lx-muted);
  font-size: 13px;
  cursor: pointer;
}
.lxmc2folia .opt input { accent-color: var(--lx-accent); margin: 0; }
.lxmc2folia .platlabel {
  color: var(--lx-faint);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lxmc2folia .msg { min-height: 16px; font-size: 13px; line-height: 1.55; color: var(--lx-muted); }
.lxmc2folia .msg.ok { color: var(--lx-ok); }
.lxmc2folia .msg.err { color: var(--lx-danger); }
.lxmc2folia .stats {
  padding: 13px 15px;
  border-radius: 16px;
  border: 1px solid var(--lx-border);
  background: var(--lx-card-strong);
  backdrop-filter: blur(10px);
  font-size: 12.5px;
  line-height: 1.6;
}
.lxmc2folia .path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--lx-muted);
  word-break: break-all;
  margin-top: 6px;
}
.lxmc2folia .warn { color: var(--lx-muted); font-size: 12.5px; line-height: 1.65; }
.lxmc2folia .warn + .warn { margin-top: 4px; }
.lxmc2folia ol { margin: 6px 0 0; padding-left: 20px; color: var(--lx-muted); font-size: 12.5px; line-height: 1.8; }
.lxmc2folia ::selection { background: color-mix(in srgb, var(--lx-accent) 35%, transparent); }
@media (max-width: 720px) {
  .lxmc2folia { padding: 20px 14px 120px; }
  .lxmc2folia .card { padding: 16px; border-radius: 20px; }
  .lxmc2folia .aura { filter: blur(70px); opacity: 0.4; }
}
`;

/** 读宿主背景亮度，决定用深色还是浅色配色（跟着 Folia 的主题走）。 */
function detectHostPalette() {
  try {
    const parse = (color) => {
      const match = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color || '');
      if (!match) return null;
      return (0.2126 * Number(match[1]) + 0.7152 * Number(match[2]) + 0.0722 * Number(match[3])) / 255;
    };
    for (const element of [document.body, document.documentElement]) {
      if (!element) continue;
      const luminance = parse(getComputedStyle(element).backgroundColor || '');
      if (luminance === null) continue;
      return luminance > 0.5 ? 'light' : 'dark';
    }
  } catch (error) { /* ignore */ }
  return 'dark';
}

function buildPage(folium, container, ctx) {
  const zh = String((ctx && ctx.locale) || navigator.language || '').toLowerCase().startsWith('zh');
  const t = (zhText, enText) => (zh ? zhText : enText);
  const rpc = folium.rpc;
  let pickedFiles = [];
  let lastResults = [];
  let converting = false;

  const style = document.createElement('style');
  style.textContent = CSS;

  const root = document.createElement('div');
  root.className = 'lxmc2folia';
  root.innerHTML = `
    <div class="aura aura-1"></div>
    <div class="aura aura-2"></div>
    <div class="aura aura-3"></div>
    <div class="wrap">
      <h1>${t('洛雪歌单转换', 'LX Music playlist converter')}</h1>
      <p class="sub">${t(
        '把洛雪（LX Music）导出的 .lxmc 歌单转换成 Folia 的歌单文件，再用 Folia 的「导入歌单」导入。纯本地转换，不联网、不下载音频。',
        'Convert LX Music .lxmc playlists into Folia playlist files, then import them with Folia\'s “Import playlist”. Local only: no network, no audio downloads.'
      )}</p>
      <div class="card">
        <div class="drop" id="drop">
          <b>${t('把 .lxmc 文件拖到这里', 'Drop .lxmc files here')}</b>
          <span>${t('或点击选择文件（可以一次选多个）', 'or click to choose files (multiple allowed)')}</span>
          <input type="file" id="picker" accept=".lxmc,.json,application/json,application/gzip" hidden multiple>
        </div>
        <div class="fileline" id="fileline">${t('还没有选择文件', 'No file selected yet')}</div>
        <div class="row">
          <input type="text" id="name" placeholder="${t('歌单名（留空自动命名）', 'Playlist name (leave empty to auto-name)')}">
        </div>
        <div class="row">
          <span class="platlabel">${t('导入方式：', 'Mode: ')}</span>
          <label class="opt"><input type="radio" name="mode" value="merge" checked> ${t('合并成一张歌单', 'Merge into one playlist')}</label>
          <label class="opt"><input type="radio" name="mode" value="separate"> ${t('分开，每张单独', 'Separate playlists')}</label>
        </div>
        <div class="row">
          <label class="opt"><input type="checkbox" id="fav" checked> ${t('标记为「我喜欢的音乐」', 'Mark as “Liked Songs”')}</label>
          <label class="opt"><input type="checkbox" id="local" checked> ${t('包含本地歌（只写文件名和时长线索）', 'Include local songs (file name + duration hint only)')}</label>
        </div>
        <div class="row">
          <span class="platlabel">${t('平台：', 'Platforms: ')}</span>
          <label class="opt"><input type="checkbox" id="p-wy" checked> ${t('网易云', 'NetEase')}</label>
          <label class="opt"><input type="checkbox" id="p-tx" checked> QQ</label>
          <label class="opt"><input type="checkbox" id="p-kg" checked> ${t('酷狗', 'Kugou')}</label>
          <label class="opt"><input type="checkbox" id="p-kw" checked> ${t('酷我', 'Kuwo')}</label>
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
          <li>${t('选择保存的 .folia-playlist.json，确认预览后导入', 'Pick the saved .folia-playlist.json and confirm the preview')}</li>
        </ol>
        <p class="warn">${t(
          '注意：Folia 的「导入歌单」一次只能选一个文件。合并模式只生成一个文件、导入一次；分开模式会生成多个文件，需要逐个导入。',
          'Note: Folia imports one file at a time. Merge mode produces a single file (one import); separate mode produces one file per playlist (import each).'
        )}</p>
        <p class="warn">${t(
          '转换后的歌指向 Folia 的「洛雪音源（lxmusic）」。能不能播放取决于你在 Folia 里启用的音源和导入的第三方脚本——这部分和本模组无关。',
          'Songs point at Folia\'s lxmusic source; playback depends on the sources and third-party scripts you enable — outside this mod.'
        )}</p>
      </div>
    </div>
  `;
  container.append(style, root);
  root.classList.add(detectHostPalette() === 'light' ? 'theme-light' : 'theme-dark');

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
  const setMsg = (text, kind) => {
    msg.textContent = text || '';
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  };

  const updateFileLine = () => {
    if (!pickedFiles.length) {
      fileline.textContent = t('还没有选择文件', 'No file selected yet');
      return;
    }
    const names = pickedFiles.slice(0, 3).map((file) => file.name).join('、');
    const more = pickedFiles.length > 3 ? ' …' : '';
    fileline.textContent = t('已选择 ', 'Selected ') + pickedFiles.length + t(' 个文件：', ' file(s): ') + names + more;
  };

  const chooseFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    pickedFiles = files;
    updateFileLine();
    convertBtn.disabled = false;
    saveBtn.disabled = true;
    lastResults = [];
    result.textContent = '';
    setMsg('');
  };

  // 点击拖拽区打开文件选择。input 在 drop 里面，程序化 click 的事件会冒泡回 drop，
  // 必须先把这类冒泡事件挡掉，否则会自己触发自己直到栈溢出（表现为“点了没反应/报错”）。
  drop.addEventListener('click', (event) => {
    if (event.target === picker) return;
    event.preventDefault();
    picker.value = '';
    picker.click();
  });
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('hover'));
  drop.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('hover');
    chooseFiles(event.dataTransfer && event.dataTransfer.files);
  });
  picker.addEventListener('change', () => chooseFiles(picker.files));

  const platformOptions = () => ['wy', 'tx', 'kg', 'kw'].filter((platform) => {
    const box = root.querySelector('#p-' + platform);
    return !box || box.checked;
  });

  const safeFileName = (name) => String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'lxmc';

  const mode = () => {
    const checked = root.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : 'merge';
  };

  const buildResults = (parsed) => {
    const baseOptions = {
      favorite: favInput.checked,
      includeLocal: localInput.checked,
      platforms: platformOptions(),
    };
    const typedName = nameInput.value.trim();
    const results = [];

    if (mode() === 'merge') {
      const songs = [];
      parsed.forEach((item) => { songs.push(...playlistOf(item.lxmc).songs); });
      const mergedName = typedName || (t('合并歌单', 'Merged playlist') + ' · ' + parsed.length + t(' 个文件', ' files'));
      const converted = convert({ data: { name: mergedName, list: songs } }, Object.assign({}, baseOptions, { name: mergedName }));
      if (!converted.stats.entries) throw new Error(t('这些歌单里没有能导入的歌。', 'Nothing in these playlists can be imported.'));
      results.push({
        label: t('合并歌单', 'Merged playlist'),
        fileName: safeFileName(mergedName) + '.folia-playlist.json',
        content: JSON.stringify(converted.file, null, 1) + '\n',
        stats: converted.stats,
        from: parsed.length + t(' 个文件', ' files'),
      });
      return results;
    }

    parsed.forEach((item) => {
      const autoName = typedName
        ? typedName + ' - ' + nameFromFileName(item.file.name)
        : nameFromFileName(item.file.name);
      const converted = convert(item.lxmc, Object.assign({}, baseOptions, { name: autoName }));
      if (!converted.stats.entries) return;
      results.push({
        label: item.file.name,
        fileName: safeFileName(autoName) + '.folia-playlist.json',
        content: JSON.stringify(converted.file, null, 1) + '\n',
        stats: converted.stats,
        from: '',
      });
    });
    if (!results.length) throw new Error(t('没有能导入的歌。', 'Nothing importable.'));
    return results;
  };

  const statsLine = (stats) => {
    const parts = [];
    parts.push(t('原文件 ', 'file ') + stats.total + t(' 首', ' songs'));
    parts.push(t('写入 ', 'imported ') + stats.entries + t(' 首', ' songs'));
    if (stats.online) parts.push(t('在线 ', 'online ') + stats.online);
    if (stats.local) parts.push(t('本地 ', 'local ') + stats.local);
    Object.entries(stats.platforms).forEach(([platform, count]) => parts.push((PLATFORM_LABELS[platform] || platform) + ' ' + count));
    const skipped = [];
    if (stats.skipped.local) skipped.push(t('本地 ', 'local ') + stats.skipped.local);
    if (stats.skipped.mg) skipped.push(t('咪咕 ', 'mg ') + stats.skipped.mg);
    if (stats.skipped.unsupported) skipped.push(t('无法识别 ', 'unrecognized ') + stats.skipped.unsupported);
    if (stats.skipped.duplicate) skipped.push(t('重复 ', 'duplicate ') + stats.skipped.duplicate);
    if (stats.skipped.invalid) skipped.push(t('无效 ', 'invalid ') + stats.skipped.invalid);
    Object.entries(stats.skipped.byPlatform || {}).forEach(([platform, count]) => {
      skipped.push(t('平台未选 ', 'platform off ') + (PLATFORM_LABELS[platform] || platform) + ' ' + count);
    });
    return { line: parts.join(' · '), skipped };
  };

  const renderResults = (results) => {
    result.textContent = '';
    results.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'stats';
      const head = document.createElement('div');
      head.innerHTML = '<b>' + escapeHtml(item.label) + '</b>' + (item.from ? ' · ' + escapeHtml(item.from) : '');
      card.append(head);
      const { line, skipped } = statsLine(item.stats);
      const body = document.createElement('div');
      body.textContent = line;
      card.append(body);
      if (skipped.length) {
        const skip = document.createElement('div');
        skip.className = 'warn';
        skip.textContent = t('跳过：', 'Skipped: ') + skipped.join(t('，', ', '));
        card.append(skip);
      }
      if (item.stats.warnings && item.stats.warnings.length) {
        const warn = document.createElement('div');
        warn.className = 'warn';
        warn.textContent = '⚠ ' + item.stats.warnings.slice(0, 4).join('\n⚠ ');
        card.append(warn);
      }
      result.append(card);
    });
  };

  convertBtn.addEventListener('click', async () => {
    if (!pickedFiles.length || converting) return;
    converting = true;
    convertBtn.disabled = true;
    saveBtn.disabled = true;
    setMsg(t('正在读取并转换…', 'Reading and converting…'));
    try {
      const parsed = [];
      for (const file of pickedFiles) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        parsed.push({ file, lxmc: await parseLxmcBytes(bytes) });
      }
      lastResults = buildResults(parsed);
      renderResults(lastResults);
      saveBtn.disabled = false;
      setMsg(
        lastResults.length === 1
          ? t('转换完成，可以保存了。', 'Converted — ready to save.')
          : t('转换完成，共 ' + lastResults.length + ' 个文件，可以保存了。', 'Converted ' + lastResults.length + ' files — ready to save.'),
        'ok'
      );
    } catch (error) {
      lastResults = [];
      saveBtn.disabled = true;
      setMsg((error && error.message) || String(error), 'err');
    } finally {
      converting = false;
      convertBtn.disabled = !pickedFiles.length;
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!lastResults.length) return;
    saveBtn.disabled = true;
    setMsg(t('正在保存…', 'Saving…'));
    try {
      const savedPaths = [];
      for (const item of lastResults) {
        const saved = await rpc.call('save-file', { fileName: item.fileName, content: item.content });
        savedPaths.push(saved && typeof saved.path === 'string' ? saved.path : '');
      }
      result.textContent = '';
      const title = document.createElement('div');
      title.className = 'stats';
      title.textContent = t('已保存 ' + savedPaths.length + ' 个文件：', 'Saved ' + savedPaths.length + ' file(s):');
      result.append(title);
      savedPaths.forEach((savedPath) => {
        const code = document.createElement('div');
        code.className = 'path';
        code.textContent = savedPath;
        result.append(code);
      });
      setMsg(
        lastResults.length === 1
          ? t('已生成 1 个 Folia 歌单文件，去「导入歌单」导入它。', 'Saved 1 Folia playlist — import it with “Import playlist”.')
          : t('已生成 ' + savedPaths.length + ' 个文件，需要在 Folia 里逐个导入。', 'Saved ' + savedPaths.length + ' files — import them one by one.'),
        'ok'
      );
      if (folium.ui && folium.ui.toast) {
        folium.ui.toast(t('已保存 ' + savedPaths.length + ' 个歌单文件', 'Saved ' + savedPaths.length + ' playlist file(s)'), { type: 'success' });
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
    label: { 'zh-CN': '洛雪歌单转换', 'zh-TW': '洛雪歌單轉換', en: 'LX playlist converter' },
    mount(container, ctx) {
      return buildPage(folium, container, ctx);
    },
  });

  const command = folium.registries.commands.register({
    id: 'open',
    label: { 'zh-CN': '打开洛雪歌单转换', 'zh-TW': '開啟洛雪歌單轉換', en: 'Open LX playlist converter' },
    description: { 'zh-CN': '把 .lxmc 歌单转换成 Folia 歌单文件', en: 'Convert an .lxmc playlist into a Folia playlist file' },
    keywords: ['lxmc', 'lx music', '洛雪', '歌单', 'playlist', 'convert'],
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
