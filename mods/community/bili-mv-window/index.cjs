'use strict';

/**
 * bili-mv-window — main 入口（Node / Electron 主进程）
 *
 * 干的事只有三件：
 *   1. 拿歌名去 B 站搜视频，挑最像 MV 的那个；
 *   2. 取这个视频的播放地址 —— 优先 DASH 的 video 轨（B 站音视频本来就是分开的两个文件，
 *      只取 video 那一份，播出来天然没有音轨，这才是「纯视频流」）；
 *   3. 起一个本地 127.0.0.1 的只读代理，把 B 站 CDN 的防盗链（Referer / UA）补上，
 *      渲染进程的 <video> 走这条兜底线路时也能拿到字节。
 *
 * 没有依赖：只用 node:http / node:https / node:crypto / node:fs / node:path。
 */

const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const nodePath = require('node:path');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

const REFERER = 'https://www.bilibili.com/';
const SEARCH_REFERER = 'https://search.bilibili.com/';

/** B 站 wbi 签名的固定置换表（公开算法，长期不变）。 */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

/** 清晰度档位 → B 站 qn 值。 */
/** 清晰度档位 → B 站 qn 值（只当「上限」用，实际拿得到哪一档看账号权益）。 */
const QUALITY_QN = Object.freeze({
  '4k': 120,
  '1080p60': 116,
  '1080p': 80,
  '720p': 64,
  '480p': 32,
});

const md5 = (text) => crypto.createHash('md5').update(text, 'utf8').digest('hex');

/* ------------------------------------------------------------------ *
 * 基础 HTTP
 * ------------------------------------------------------------------ */

/**
 * 一次 GET，把 body 整个收下来。
 * @returns {Promise<{status:number, headers:Record<string,string>, body:Buffer}>}
 */
function httpGet(url, headers = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }

    const secure = parsed.protocol === 'https:';
    const transport = secure ? https : http;

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (secure ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers: { 'User-Agent': UA, Referer: REFERER, ...headers },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode || 0,
            headers: res.headers || {},
            body: Buffer.concat(chunks),
          }),
        );
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('bili-timeout')));
    req.end();
  });
}

async function getJson(url, headers = {}, timeoutMs) {
  const res = await httpGet(url, headers, timeoutMs);
  const text = res.body.toString('utf8');
  if (res.status >= 400) throw new Error(`http-${res.status}: ${text.slice(0, 160)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`bad-json: ${text.slice(0, 160)}`);
  }
}

/* ------------------------------------------------------------------ *
 * 会话：buvid3 cookie + wbi 密钥
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 账号：用户粘贴的 B 站 cookie（走 Folium 的 secret 字段，系统凭证库加密）
 * ------------------------------------------------------------------ */

/** activate 里拿到的 api，用来读 secret。 */
let secretsApi = null;

let userCookie = '';
let userCookieAt = 0;
let knownCookie = '';

/**
 * 读用户填的 cookie。10 秒缓存，避免每首歌都跨进程读一次凭证库。
 * 值一变就作废旧会话（wbi 密钥、登录态都要重算）。
 */
async function readUserCookie(force = false) {
  if (!secretsApi || !secretsApi.secrets || typeof secretsApi.secrets.get !== 'function') return '';
  if (!force && Date.now() - userCookieAt < 10_000) return userCookie;

  userCookieAt = Date.now();
  let next = '';
  try {
    const value = await secretsApi.secrets.get('cookie');
    next = String(value || '').trim();
  } catch {
    // 还没注册分区（启动早期），或这台机器读不到凭证库。
    next = '';
  }

  if (next !== knownCookie) {
    knownCookie = next;
    session = null;
    sessionAt = 0;
  }
  userCookie = next;
  return userCookie;
}

/** 从整段 cookie 里挑一个字段，只用来判断「有没有登录」，不做别的。 */
function cookieValue(raw, name) {
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`, 'i');
  const match = String(raw || '').match(pattern);
  return match ? match[1].trim() : '';
}

/* ------------------------------------------------------------------ *
 * 会话：buvid3 cookie + wbi 密钥 + 登录态
 * ------------------------------------------------------------------ */

let session = null;
let sessionAt = 0;

async function buildSession(force = false) {
  const loginCookie = await readUserCookie(force);
  let cookie = loginCookie;

  // 没有 buvid3 时搜索接口会直接 -412（风控），先找一份指纹 cookie。
  // 用户自己带了 buvid3 就别动 —— 那个和账号是绑的。
  if (!cookieValue(cookie, 'buvid3')) {
    try {
      const spi = await getJson('https://api.bilibili.com/x/frontend/finger/spi');
      const data = spi && spi.data ? spi.data : {};
      if (data.b_3) cookie += `${cookie ? '; ' : ''}buvid3=${data.b_3}`;
      if (data.b_4) cookie += `${cookie ? '; ' : ''}buvid4=${data.b_4}`;
    } catch {
      /* 拿不到也继续，后面可能仍然能搜 */
    }
  }

  let imgKey = '';
  let subKey = '';
  let loggedIn = false;
  let uname = '';
  let vip = false;

  try {
    const nav = await getJson(
      'https://api.bilibili.com/x/web-interface/nav',
      cookie ? { Cookie: cookie } : {},
    );
    const data = (nav && nav.data) || {};
    loggedIn = Boolean(data.isLogin);
    uname = String(data.uname || '');
    vip = Number(data.vipStatus) === 1 || Number(data.vipType) === 2;
    const wbi = data.wbi_img || {};
    imgKey = String(wbi.img_url || '').split('/').pop().split('.')[0];
    subKey = String(wbi.sub_url || '').split('/').pop().split('.')[0];
  } catch {
    /* 同上 */
  }

  return { cookie, imgKey, subKey, loggedIn, uname, vip, hasUserCookie: Boolean(loginCookie) };
}

async function getSession(force = false) {
  const fresh = session && Date.now() - sessionAt < 30 * 60 * 1000;
  if (!force && fresh) return session;
  session = await buildSession(force);
  sessionAt = Date.now();
  return session;
}

function getMixinKey(original) {
  let out = '';
  for (const index of MIXIN_KEY_ENC_TAB) out += original[index] || '';
  return out.slice(0, 32);
}

/** 给 wbi 接口的查询串补上 wts 与 w_rid。 */
function signQuery(params, imgKey, subKey) {
  const mixinKey = getMixinKey(`${imgKey}${subKey}`);
  const wts = Math.floor(Date.now() / 1000);
  const all = { ...params, wts };

  const query = Object.keys(all)
    .sort()
    .map((key) => {
      const value = String(all[key] ?? '').replace(/[!'()*]/g, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  return `${query}&w_rid=${md5(query + mixinKey)}`;
}

/* ------------------------------------------------------------------ *
 * 搜索与打分
 * ------------------------------------------------------------------ */

function stripTags(text) {
  return String(text ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** 匹配用的归一化：去括号补充说明、去常见噪声词、去标点空白。 */
/** 匹配用的归一化：去括号补充说明、去常见噪声词、去标点空白。keepCase 时保留大小写。 */
function normalize(text, options = {}) {
  const base = String(text ?? '');
  const lowered = options.keepCase ? base : base.toLowerCase();
  return lowered
    .replace(/[（(\[【{][^）)\]】}]*[）)\]】}]/g, ' ')
    .replace(/\b(feat|ft|prod|remix|official|mv|music\s*video|lyrics?|video|hd|4k)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parts = String(value ?? '')
    .split(':')
    .map((piece) => Number(piece.trim()));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

const NOISE = /(翻唱|翻自|cover|伴奏|karaoke|纯音乐|钢琴|吉他|演奏|弹奏|教学|曲谱|reaction|解说|直播|录播|合集|混剪|remix|鬼畜|搞笑|恶搞)/i;
const GOOD = /(\bmv\b|music\s*video|官方|official|1080|4k|中字|字幕|完整版|\bhd\b)/i;

/**
 * 打分。拆成歌名 / 歌手 / 其它三块，好让界面上显示「匹配度」时说得清是哪一项命中了。
 *
 * 「歌手」那一块看的是**UP 主名字**，不是视频标题 —— 标题里堆歌手名太容易，
 * 官方号 / 本人号的 UP 主名才是强信号。
 *
 * @returns {{ total:number, name:number, artist:number, other:number, nameHit:boolean, artistHit:boolean } | null}
 */
function scoreCandidate(item, want) {
  const title = stripTags(item.title);
  const normalized = normalize(title);
  if (!normalized) return null;

  const name = normalize(want.title);
  const artist = normalize(want.artist);
  const uploader = normalize(item.author);
  const seconds = parseDuration(item.duration);

  let nameScore = 0;
  let artistScore = 0;
  let otherScore = 0;
  let nameHit = false;

  if (name) {
    if (normalized.includes(name)) {
      nameScore += 62;
      nameHit = true;
    } else {
      const head = name.slice(0, Math.min(6, name.length));
      if (head && normalized.includes(head)) nameScore += 16;
      else nameScore -= 26;
    }
  }

  // 歌手匹配：UP 主名字里带歌手名是强信号（官方号 / 本人号），权重最高；
  // 标题里带歌手名算次级信号。纯 UP 主匹配在搬运号横行的歌上会让这一维全是 0，反而没区分度。
  //
  // 大小写策略由 want.ignoreCase 决定：
  //   开（默认）→ 两边都归一化（小写 + 去标点），"周杰伦" 能匹配 "ZhouJielun" / "周 杰 伦"；
  //   关         → 原文逐字比较，只认一模一样的写法。
  const ignoreCase = want.ignoreCase !== false;
  const uploaderRaw = String(item.author || '');

  const uploaderHit = ignoreCase
    ? Boolean(artist) && Boolean(uploader) && uploader.includes(artist)
    : Boolean(want.artist) && uploaderRaw.includes(String(want.artist));

  const titleArtistHit = ignoreCase
    ? Boolean(artist) && normalized.includes(artist)
    : Boolean(want.artist) &&
      normalize(title, { keepCase: true }).includes(String(want.artist));

  const artistHit = uploaderHit || titleArtistHit;
  if (uploaderHit) artistScore += 34;
  else if (titleArtistHit) artistScore += 18;

  if (seconds >= 45 && seconds <= 900) otherScore += 12;
  if (seconds > 1800 || (seconds > 0 && seconds < 25)) otherScore -= 30;

  const plays = Number(item.play) || 0;
  otherScore += Math.min(30, Math.log10(plays + 1) * 6);

  if (GOOD.test(title)) otherScore += 14;
  if (NOISE.test(title)) otherScore -= 55;

  if (want.durationMs > 0 && seconds > 0) {
    const delta = Math.abs(seconds - want.durationMs / 1000);
    if (delta < 10) otherScore += 22;
    else if (delta < 35) otherScore += 9;
    else if (delta > 240) otherScore -= 14;
  }

  return {
    total: nameScore + artistScore + otherScore,
    name: nameScore,
    artist: artistScore,
    other: otherScore,
    nameHit,
    artistHit,
    // 是哪一项命中的：'uploader'（UP 主名）/ 'title'（标题里的歌手名）/ null
    artistSource: uploaderHit ? 'uploader' : titleArtistHit ? 'title' : null,
  };
}

/** 打分排序，resolveMv 和「自由搜索」共用。 */
function rankCandidates(items, want) {
  return items
    .map((item) => ({ item, score: scoreCandidate(item, want) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => b.score.total - a.score.total);
}

/** 把一条排名结果转成给界面用的候选。 */
function toCandidateDto(entry) {
  return {
    bvid: entry.item.bvid,
    title: entry.item.title,
    author: entry.item.author,
    cover: absoluteCover(entry.item.pic),
    durationSec: parseDuration(entry.item.duration),
    score: Math.round(entry.score.total),
    nameScore: Math.round(entry.score.name),
    artistScore: Math.round(entry.score.artist),
    nameHit: entry.score.nameHit,
    artistHit: entry.score.artistHit,
    artistSource: entry.score.artistSource,
  };
}

async function searchVideos(keyword, retried = false) {
  const current = await getSession();
  const params = {
    search_type: 'video',
    keyword,
    page: 1,
    page_size: 24,
    order: 'totalrank',
  };

  const query =
    current.imgKey && current.subKey
      ? signQuery(params, current.imgKey, current.subKey)
      : new URLSearchParams(params).toString();

  const json = await getJson(
    `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`,
    { Cookie: current.cookie, Referer: SEARCH_REFERER },
  );

  // -412：被风控拦了。换一份新会话重试一次。
  if (json && json.code === -412 && !retried) {
    await getSession(true);
    return searchVideos(keyword, true);
  }

  if (!json || json.code !== 0) {
    throw new Error(`search-${json && json.code}: ${(json && json.message) || 'unknown'}`);
  }

  const list = json.data && Array.isArray(json.data.result) ? json.data.result : [];
  return list
    .filter((entry) => entry && entry.type === 'video' && entry.bvid)
    .map((entry) => ({
      bvid: String(entry.bvid),
      title: stripTags(entry.title),
      author: String(entry.author || ''),
      pic: String(entry.pic || ''),
      duration: entry.duration,
      play: entry.play,
    }));
}

/* ------------------------------------------------------------------ *
 * 取播放地址
 * ------------------------------------------------------------------ */

async function getVideoMeta(bvid) {
  const current = await getSession();
  const json = await getJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
    { Cookie: current.cookie },
  );

  if (!json || json.code !== 0) {
    throw new Error(`view-${(json && json.code) || '?'}: ${(json && json.message) || 'unknown'}`);
  }

  const data = json.data || {};
  const cid = data.cid || (Array.isArray(data.pages) && data.pages[0] && data.pages[0].cid);
  if (!cid) throw new Error('view-no-cid');

  return {
    cid: Number(cid),
    title: String(data.title || ''),
    author: String((data.owner && data.owner.name) || ''),
    durationSec: Number(data.duration) || 0,
    cover: String(data.pic || ''),
  };
}

/**
 * 在 DASH 的视频轨里挑一条。
 *
 * `qn` 只是上限，真正的选择规则是「编码器兼容性优先，同编码器里取不超过上限的最高档」：
 *   AVC(H.264)  →  Chromium 一定吃得下，优先
 *   AV1         →  Chromium 自带解码器，次选
 *   HEVC(H.265) →  要看系统有没有装解码器，最后
 *
 * 这样选 4K 时（B 站 4K 没有 AVC）会自动落到 AV1，而不是拿一条放不出来的 HEVC 干瞪眼。
 */
function pickVideoTrack(tracks, qn) {
  const usable = tracks
    .map((track) => ({
      url: track.baseUrl || track.base_url || '',
      backupUrl: track.backupUrl || track.backup_url || [],
      id: Number(track.id) || 0,
      codecid: Number(track.codecid) || 0,
      width: Number(track.width) || 0,
      height: Number(track.height) || 0,
    }))
    .filter((track) => track.url);

  if (!usable.length) return null;

  const underCap = usable.filter((track) => track.id <= qn);
  const pool = underCap.length ? underCap : usable;

  const groups = [
    pool.filter((track) => track.codecid === 7), // AVC
    pool.filter((track) => track.codecid === 13), // AV1
    pool.filter((track) => track.codecid === 12), // HEVC
    pool.filter((track) => ![7, 12, 13].includes(track.codecid)),
  ];

  for (const group of groups) {
    if (!group.length) continue;
    group.sort((a, b) => b.id - a.id);
    return group[0];
  }

  return null;
}

async function getPlayUrls(bvid, cid, qn, options = {}) {
  const current = await getSession();
  const base = 'https://api.bilibili.com/x/player/playurl';
  const out = { video: null, durl: null };

  // 首选：DASH。video 轨和 audio 轨是两个独立文件，只取 video。
  if (!options.durlOnly) {
    try {
      const query =
        `bvid=${encodeURIComponent(bvid)}&cid=${cid}` +
        `&fnval=16&fnver=0&fourk=1&qn=${qn}&high_quality=1`;
      const json = await getJson(`${base}?${query}`, { Cookie: current.cookie });
      const tracks = (json && json.data && json.data.dash && json.data.dash.video) || [];
      if (tracks.length) out.video = pickVideoTrack(tracks, qn);
    } catch {
      /* 落到 durl */
    }
  }

  // 兜底：durl 是含音轨的整段 mp4，播放时会被强制静音。
  if (options.durlOnly || !out.video) {
    try {
      const query =
        `bvid=${encodeURIComponent(bvid)}&cid=${cid}` +
        `&fnval=1&fnver=0&qn=${qn}&platform=html5&high_quality=1`;
      const json = await getJson(`${base}?${query}`, { Cookie: current.cookie });
      const durl = json && json.data && json.data.durl && json.data.durl[0] && json.data.durl[0].url;
      if (durl) out.durl = String(durl);
    } catch {
      /* 什么都没有 */
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * 本地代理（补 Referer / UA，透传 Range）
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 本地视频缓存：<paths.cache>/mv/<bvid>.m4s
 *
 * 存的是 DASH 的视频轨，所以落盘的本来就是无音轨的纯视频。
 * 有了它，同一首 MV 第二次播放直接从磁盘读，B 站 CDN 挂了也不影响。
 * ------------------------------------------------------------------ */

let resolvedCacheDir = null;
let resolvedCacheKey = '';

/** 当前这次调用要用的缓存位置。每次 resolveMv / cacheVideo 前由 client 传进来。 */
let activeCacheSpec = { mode: 'auto', path: '' };

function setCacheSpec(input) {
  activeCacheSpec = {
    mode: String((input && input.mode) || 'auto'),
    path: String((input && input.path) || '').trim(),
  };
}

function computeCacheDir(spec) {
  if (!secretsApi) throw new Error('no-api');

  if (spec.mode === 'custom') {
    if (!spec.path) throw new Error('no-custom-path');
    if (!nodePath.isAbsolute(spec.path)) throw new Error('path-not-absolute');
    return spec.path;
  }

  const paths = secretsApi.paths || {};
  if (spec.mode === 'videos' && paths.videos) return nodePath.join(paths.videos, 'Folia MV');
  if (spec.mode === 'downloads' && paths.downloads) return nodePath.join(paths.downloads, 'Folia MV');
  if (spec.mode === 'music' && paths.music) return nodePath.join(paths.music, 'Folia MV');

  if (!secretsApi.storage || !secretsApi.storage.paths) throw new Error('no-cache-paths');
  return nodePath.join(secretsApi.storage.paths.cache, 'mv');
}

function getCacheDir() {
  const key = `${activeCacheSpec.mode}|${activeCacheSpec.path}`;
  if (resolvedCacheDir && resolvedCacheKey === key) return resolvedCacheDir;

  const dir = computeCacheDir(activeCacheSpec);
  fs.mkdirSync(dir, { recursive: true });

  resolvedCacheDir = dir;
  resolvedCacheKey = key;
  return dir;
}

/** 去掉跨平台都不允许的字符，做文件名。 */
function slugify(text) {
  return String(text || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

/** 缓存文件主名：`歌名 - 歌手`。没有歌手就只用歌名。 */
function songSlug(title, artist) {
  const name = slugify(title) || 'unknown';
  const singer = slugify(artist);
  return singer ? `${name} - ${singer}` : name;
}

function videoPathOf(slug) {
  return nodePath.join(getCacheDir(), `${slug}.m4s`);
}

function metaPathOf(slug) {
  return nodePath.join(getCacheDir(), `${slug}.json`);
}

function writeCacheMeta(slug, meta) {
  try {
    fs.writeFileSync(metaPathOf(slug), JSON.stringify(meta), 'utf8');
  } catch {
    /* 写不了就只留视频 */
  }
}

let cacheIndex = null;
let cacheIndexKey = '';
let cacheIndexBuilding = null;

function invalidateCacheIndex() {
  cacheIndex = null;
  cacheIndexKey = '';
  cacheIndexBuilding = null;
}

/**
 * 扫目录建索引：slug → 记录、bvid → 记录。写盘后置空失效。
 *
 * 全用 fs.promises：缓存多了也不会把 main 进程同步卡住（审查意见）。
 */
async function ensureCacheIndex() {
  const dir = getCacheDir();
  if (cacheIndex && cacheIndexKey === dir) return cacheIndex;
  if (cacheIndexBuilding) return cacheIndexBuilding;

  cacheIndexBuilding = (async () => {
    const bySlug = new Map();
    const byBvid = new Map();

    let entries = [];
    try {
      entries = await fs.promises.readdir(dir);
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;

      const slug = entry.slice(0, -5);
      const video = nodePath.join(dir, `${slug}.m4s`);

      let stat;
      try {
        stat = await fs.promises.stat(video);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size <= 1024) continue;

      let meta = {};
      try {
        meta = JSON.parse(await fs.promises.readFile(nodePath.join(dir, entry), 'utf8')) || {};
      } catch {
        meta = {};
      }

      const record = {
        slug,
        bvid: String(meta.bvid || ''),
        title: String(meta.title || slug),
        artist: String(meta.artist || ''),
        author: String(meta.author || ''),
        cover: String(meta.cover || ''),
        durationSec: Number(meta.durationSec) || 0,
        quality: meta.quality || null,
        size: stat.size,
        at: stat.mtimeMs,
      };

      bySlug.set(slug, record);
      if (record.bvid) byBvid.set(record.bvid, record);
    }

    cacheIndex = { bySlug, byBvid };
    cacheIndexKey = dir;
    cacheIndexBuilding = null;
    return cacheIndex;
  })();

  return cacheIndexBuilding;
}

async function findCachedByBvid(bvid) {
  try {
    return (await ensureCacheIndex()).byBvid.get(String(bvid)) || null;
  } catch {
    return null;
  }
}

/** 按「歌名 - 歌手」找本地文件 —— 优先本地播放就靠它。 */
async function findCachedBySong(title, artist) {
  if (!title) return null;
  try {
    return (await ensureCacheIndex()).bySlug.get(songSlug(title, artist)) || null;
  } catch {
    return null;
  }
}

async function hasCachedVideo(bvid) {
  return Boolean(await findCachedByBvid(bvid));
}
async function listCachedVideos() {
  try {
    return [...(await ensureCacheIndex()).bySlug.values()].sort((a, b) => a.at - b.at);
  } catch {
    return [];
  }
}

async function cacheStats() {
  const dir = getCacheDir();
  const files = await listCachedVideos();
  return {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    dir,
    mode: activeCacheSpec.mode,
  };
}

function removeCachedBySlug(slug) {
  try {
    fs.rmSync(videoPathOf(slug), { force: true });
    fs.rmSync(metaPathOf(slug), { force: true });
    invalidateCacheIndex();
    return true;
  } catch {
    return false;
  }
}

async function removeCachedVideo(bvid) {
  const record = await findCachedByBvid(bvid);
  return record ? removeCachedBySlug(record.slug) : false;
}

async function clearCacheDir() {
  let removed = 0;
  for (const file of await listCachedVideos()) {
    if (removeCachedBySlug(file.slug)) removed += 1;
  }
  invalidateCacheIndex();
  return removed;
}

async function pruneCache(limitBytes) {
  const limit = Number(limitBytes) > 0 ? Number(limitBytes) : 1024 * 1024 * 1024;
  const files = await listCachedVideos();
  let total = files.reduce((sum, file) => sum + file.size, 0);
  let removed = 0;

  for (const file of files) {
    if (total <= limit) break;
    if (removeCachedBySlug(file.slug)) {
      total -= file.size;
      removed += 1;
    }
  }

  return { removed, total };
}
/** 下载视频轨到 `<歌名 - 歌手>.m4s`，并写同名 .json。CDN 偶尔 5xx，自动重试两次。 */
async function downloadToCache(slug, remoteUrl, meta, attempt = 0) {
  try {
    return await downloadOnce(slug, remoteUrl, meta);
  } catch (err) {
    const message = String((err && err.message) || err);
    const retryable = /download-5\d\d|download-timeout|ECONNRESET|socket hang up/i.test(message);
    if (attempt < 2 && retryable) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      return downloadToCache(slug, remoteUrl, meta, attempt + 1);
    }
    throw err;
  }
}

function downloadOnce(slug, remoteUrl, meta) {
  const file = videoPathOf(slug);
  const part = `${file}.part`;

  return new Promise((resolve, reject) => {
    const target = new URL(remoteUrl);
    const secure = target.protocol === 'https:';
    const transport = secure ? https : http;

    const request = transport.get(
      {
        hostname: target.hostname,
        port: target.port || (secure ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        headers: {
          'User-Agent': UA,
          Referer: REFERER,
          Origin: 'https://www.bilibili.com',
          Accept: '*/*',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`download-${res.statusCode}`));
          return;
        }
        const out = fs.createWriteStream(part);
        res.pipe(out);
        out.on('error', reject);
        out.on('finish', () => {
          out.close(() => {
            try {
              fs.renameSync(part, file);
              writeCacheMeta(slug, meta || {});
              invalidateCacheIndex();
              resolve(file);
            } catch (err) {
              reject(err);
            }
          });
        });
      },
    );

    request.on('error', reject);
    request.setTimeout(120000, () => request.destroy(new Error('download-timeout')));
  });
}
const proxyTokens = new Map();
let proxyServer = null;
let proxyPort = 0;

function registerToken(url, contentType = 'video/mp4', ttlMs = 2 * 60 * 60 * 1000) {
  const token = crypto.randomBytes(16).toString('hex');
  proxyTokens.set(token, { url, contentType, expiresAt: Date.now() + ttlMs });
  if (proxyTokens.size > 128) {
    const now = Date.now();
    for (const [key, value] of proxyTokens) if (value.expiresAt < now) proxyTokens.delete(key);
  }
  return token;
}

/* ------------------------------------------------------------------ *
 * 本地文件的访问凭据
 *
 * /f/<token>，token → slug 只存在 main 进程里。URI 里不出现文件名，
 * 所以任何网页就算扫到端口，也只能拿到 404 —— 探不出用户缓存了哪些歌。
 * ------------------------------------------------------------------ */

const localTokens = new Map();

function registerLocalToken(slug, ttlMs = 2 * 60 * 60 * 1000) {
  const token = crypto.randomBytes(16).toString('hex');
  localTokens.set(token, { slug, expiresAt: Date.now() + ttlMs });
  if (localTokens.size > 128) {
    const now = Date.now();
    for (const [key, value] of localTokens) if (value.expiresAt < now) localTokens.delete(key);
  }
  return token;
}

function resolveLocalToken(token) {
  const entry = localTokens.get(String(token));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    localTokens.delete(String(token));
    return null;
  }
  return entry.slug;
}

/** 从磁盘读缓存好的视频，支持 Range —— 拖进度条要靠它。只认 token。 */
async function serveLocal(rawToken, req, res) {
  const slug = resolveLocalToken(rawToken);
  if (!slug) {
    res.writeHead(404);
    res.end();
    return;
  }

  let file;
  try {
    file = videoPathOf(slug);
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }

  let size;
  try {
    size = (await fs.promises.stat(file)).size;
  } catch {
    res.writeHead(404);
    res.end();
    return;
  }

  const range = req.headers.range;
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(String(range));
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'Content-Type': 'video/mp4',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Content-Length': size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}
function handleProxy(req, res) {
  // 只接受打到本机端口的请求。防 DNS rebinding：别的域名解析到 127.0.0.1 时，
  // Host 头不是 127.0.0.1:<port> / localhost:<port>，直接拒。
  const host = String(req.headers.host || '').toLowerCase();
  const allowedHosts = [`127.0.0.1:${proxyPort}`, `localhost:${proxyPort}`];
  if (!allowedHosts.includes(host)) {
    res.writeHead(403);
    res.end();
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }

  if (requestUrl.pathname.startsWith('/f/')) {
    // token → slug 的映射只在 main 里，URI 不含文件名
    serveLocal(requestUrl.pathname.slice(3), req, res).catch(() => {
      try {
        res.destroy();
      } catch {
        /* 已经结束了 */
      }
    });
    return;
  }

  if (!requestUrl.pathname.startsWith('/s/')) {
    res.writeHead(404);
    res.end();
    return;
  }

  const token = requestUrl.pathname.slice(3);
  const entry = proxyTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    proxyTokens.delete(token);
    res.writeHead(404);
    res.end();
    return;
  }

  const target = new URL(entry.url);
  const secure = target.protocol === 'https:';
  const headers = {
    'User-Agent': UA,
    Referer: REFERER,
    Origin: 'https://www.bilibili.com',
    Accept: '*/*',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  // B 站的 CDN 有的是 https，有的是 http 的 PCDN 节点（还带端口），必须照着 URL 来。
  const transport = secure ? https : http;
  const upstream = transport.request(
    {
      hostname: target.hostname,
      port: target.port || (secure ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'GET',
      headers,
    },
    (upstreamRes) => {
      const outHeaders = {
        'Content-Type': entry.contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      };
      if (upstreamRes.headers['content-length']) {
        outHeaders['Content-Length'] = upstreamRes.headers['content-length'];
      }
      if (upstreamRes.headers['content-range']) {
        outHeaders['Content-Range'] = upstreamRes.headers['content-range'];
      }

      res.writeHead(upstreamRes.statusCode || 200, outHeaders);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', () => {
    try {
      res.writeHead(502);
      res.end();
    } catch {
      /* 已经发过响应头了 */
    }
  });

  upstream.end();
}

function ensureProxyServer() {
  if (proxyServer) return Promise.resolve(proxyPort);

  return new Promise((resolve, reject) => {
    const server = http.createServer(handleProxy);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      proxyServer = server;
      proxyPort = server.address().port;
      resolve(proxyPort);
    });
  });
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function absoluteCover(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  if (text.startsWith('//')) return `https:${text}`;
  if (text.startsWith('http://')) return `https://${text.slice(7)}`;
  return text;
}

/** 本地已有这个视频时，直接组一个「不用联网」的结果。 */
function buildLocalResult(record) {
  if (!record || !proxyServer) return null;

  // 发一个一次性 token 而不是文件名：URI 里看不出是哪首歌
  const token = registerLocalToken(record.slug);

  return {
    ok: true,
    bvid: record.bvid || record.slug,
    title: record.title,
    author: record.author,
    cover: record.cover,
    durationSec: record.durationSec,
    score: null,
    sources: [
      {
        url: `http://127.0.0.1:${proxyPort}/f/${token}`,
        kind: 'local',
        videoOnly: true,
      },
    ],
    quality: record.quality || null,
    login: { loggedIn: false, uname: '', vip: false },
    candidates: [],
    fromCache: true,
    cacheFile: record.slug,
  };
}

/* ------------------------------------------------------------------ *
 * 自由搜索：只出候选，不取流
 * ------------------------------------------------------------------ */

async function searchCandidates(input) {
  setCacheSpec(input && input.cacheDir);

  const query = String((input && input.query) || '').trim();
  if (!query) return { ok: false, error: 'empty-query' };

  const want = {
    title: query,
    artist: String((input && input.artist) || '').trim(),
    durationMs: 0,
    ignoreCase: !input || input.matchIgnoreCase !== false,
  };

  let items;
  try {
    items = await searchVideos(query);
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), keyword: query };
  }

  if (!items.length) return { ok: false, error: 'search-empty', keyword: query };

  const ranked = rankCandidates(items, want);
  if (!ranked.length) return { ok: false, error: 'no-candidate', keyword: query };

  return {
    ok: true,
    keyword: query,
    candidates: ranked.slice(0, 5).map(toCandidateDto),
  };
}

async function resolveMv(input) {
  setCacheSpec(input && input.cacheDir);

  const want = {
    title: String((input && input.title) ?? '').trim(),
    artist: String((input && input.artist) ?? '').trim(),
    durationMs: Number(input && input.durationMs) || 0,
    // 歌手 / UP 主匹配是否忽略大小写，默认忽略
    ignoreCase: !input || input.matchIgnoreCase !== false,
  };

  const bvidAsked = String((input && input.bvid) || '').trim();

  // 指定了 BV 就直接取那个视频，不需要歌名（用户是在候选列表里点的）。
  if (!want.title && !bvidAsked) return { ok: false, error: 'no-song-title' };

  // 本地优先：
  //   指定了某个 BV 时 **只认这一个** 的缓存 —— 不能因为本地有「歌名 - 歌手」的旧文件
  //   就把用户刚选的另一个视频顶掉（那会导致「选过一次之后就再也换不了」）。
  //   没指定 BV 时，才按歌名去猜。
  const caching = Boolean(input && input.cache && input.cache !== 'off');
  const preferLocal = !input || input.preferLocal !== false;

  const localHit = bvidAsked
    ? await findCachedByBvid(bvidAsked)
    : caching && preferLocal && want.title
      ? await findCachedBySong(want.title, want.artist)
      : null;

  if (localHit) {
    try {
      await ensureProxyServer();
      const cached = buildLocalResult(localHit);
      if (cached) return cached;
    } catch {
      /* 代理起不来就退到远程 */
    }
  }

  const qn = QUALITY_QN[input && input.quality] || QUALITY_QN['1080p'];
  const keyword = [want.title, want.artist].filter(Boolean).join(' ');

  let sess = null;
  try {
    sess = await getSession();
  } catch {
    /* 拿不到会话也照常搜，只是画质会低 */
  }

  // 用户在候选列表里点了一个具体的 BV：跳过搜索，直接取它的流。
  let best = null;
  let ranked = [];

  if (bvidAsked) {
    if (!/^BV[0-9A-Za-z]{8,12}$/.test(bvidAsked)) {
      return { ok: false, error: 'bad-bvid', bvid: bvidAsked };
    }
    best = { bvid: bvidAsked, title: '', author: '', pic: '', duration: '0:00', play: 0 };
  } else {
    let items;
    try {
      items = await searchVideos(keyword);
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), keyword };
    }

    if (!items.length) {
      // 歌名 + 歌手一起搜不到时，退一步只搜歌名。
      if (want.artist) {
        try {
          items = await searchVideos(want.title);
        } catch {
          items = [];
        }
      }
      if (!items.length) return { ok: false, error: 'search-empty', keyword };
    }

    ranked = rankCandidates(items, want);

    if (!ranked.length) return { ok: false, error: 'no-candidate', keyword };
    best = ranked[0].item;
  }

  let meta;
  try {
    meta = await getVideoMeta(best.bvid);
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), bvid: best.bvid, keyword };
  }

  let urls;
  try {
    urls = await getPlayUrls(best.bvid, meta.cid, qn, {
      durlOnly: Boolean(input && input.durlOnly),
    });
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), bvid: best.bvid, keyword };
  }

  const sources = [];

  if (urls.video) {
    // 1) 本地代理优先：补上 Referer，B 站 CDN（尤其带端口的 PCDN 节点）的防盗链拦不住，
    //    而且 http 的 CDN 走同源代理后也不会被 https 页面的混合内容规则掐掉。
    try {
      await ensureProxyServer();
      const token = registerToken(urls.video.url);
      sources.push({
        url: `http://127.0.0.1:${proxyPort}/s/${token}`,
        kind: 'dash-proxy',
        videoOnly: true,
        height: urls.video.height,
        width: urls.video.width,
      });
    } catch {
      /* 代理起不来就只留直链 */
    }

    // 2) 直链：<video> 直接吃 B 站 CDN 的 m4s，成不成看防盗链。
    sources.push({ url: urls.video.url, kind: 'dash-direct', videoOnly: true });
  }

  if (urls.durl) {
    if (proxyServer) {
      const token = registerToken(urls.durl);
      sources.push({
        url: `http://127.0.0.1:${proxyPort}/s/${token}`,
        kind: 'durl-proxy',
        videoOnly: false,
      });
    }
    sources.push({ url: urls.durl, kind: 'durl-direct', videoOnly: false });
  }

  if (!sources.length) {
    return { ok: false, error: 'no-playable-url', bvid: best.bvid, keyword };
  }

  // 「自动保存匹配度最高的」：后台把这条视频轨落盘，不阻塞这次播放。
  // 文件名用「歌名 - 歌手」，所以下次同一首歌能直接按名字找到它。
  if (input && input.cache === 'best' && urls.video) {
    const cacheTitle = want.title || best.title || meta.title || '';
    const cacheArtist = want.artist || '';
    const slug = songSlug(cacheTitle, cacheArtist);

    if (!(await findCachedBySong(cacheTitle, cacheArtist))) {
      const cacheUrl = urls.video.url;
      const limitBytes =
        Number(input.cacheLimitMb) > 0 ? Number(input.cacheLimitMb) * 1024 * 1024 : undefined;

      void (async () => {
        try {
          await downloadToCache(slug, cacheUrl, {
            bvid: best.bvid,
            title: cacheTitle,
            artist: cacheArtist,
            author: best.author || meta.author || '',
            cover: absoluteCover(best.pic || meta.cover),
            durationSec: meta.durationSec || 0,
            quality: {
              id: urls.video.id,
              width: urls.video.width,
              height: urls.video.height,
              codecid: urls.video.codecid,
            },
          });
          await pruneCache(limitBytes);
        } catch {
          /* 后台存失败就算了，下次播放还是走远程 */
        }
      })();
    }
  }

  return {
    ok: true,
    bvid: best.bvid,
    title: best.title || meta.title,
    author: best.author || meta.author,
    cover: absoluteCover(best.pic || meta.cover),
    durationSec: meta.durationSec || parseDuration(best.duration),
    score: ranked.length ? Math.round(ranked[0].score.total) : null,
    sources,
    quality: urls.video
      ? {
          id: urls.video.id,
          width: urls.video.width,
          height: urls.video.height,
          codecid: urls.video.codecid,
          codec:
            urls.video.codecid === 7
              ? 'AVC'
              : urls.video.codecid === 13
                ? 'AV1'
                : urls.video.codecid === 12
                  ? 'HEVC'
                  : '?',
        }
      : null,
    login: {
      loggedIn: Boolean(sess && sess.loggedIn),
      uname: (sess && sess.uname) || '',
      vip: Boolean(sess && sess.vip),
    },
    // 前 5 个候选，带「歌名 / 歌手」各自的命中情况，让用户自己挑。
    candidates: ranked.slice(0, 5).map(toCandidateDto),
    embedUrl:
      `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(best.bvid)}` +
      '&page=1&autoplay=0&danmaku=0&high_quality=1&as_wide=1',
  };
}

/* ------------------------------------------------------------------ *
 * 扫码登录
 *
 *   1. GET passport.bilibili.com/x/passport-login/web/qrcode/generate
 *      → { url: 二维码内容, qrcode_key: 轮询用的 key }
 *   2. 客户端画二维码，用户用 B 站 App 扫
 *   3. 轮询 .../qrcode/poll?qrcode_key=…，data.code：
 *        86101 未扫码 / 86090 已扫未确认 / 0 成功 / 86038 失效
 *   4. 成功时从 Set-Cookie 与跳转 URL 里捞 SESSDATA 等字段，拼成 cookie
 * ------------------------------------------------------------------ */

const LOGIN_COOKIE_KEYS = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'];

async function qrGenerate() {
  const json = await getJson(
    'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
    { Referer: 'https://passport.bilibili.com/' },
  );
  if (!json || json.code !== 0) throw new Error(`qr-generate-${(json && json.code) || '?'}`);

  const data = json.data || {};
  const url = String(data.url || '');
  const key = String(data.qrcode_key || '');
  if (!url || !key) throw new Error('qr-generate-empty');

  return { url, key };
}

/**
 * 从查询串里原样取值。**不能 URL 解码** —— SESSDATA 里的 %2C 是它本身的一部分，
 * 解成逗号再塞回 Cookie 头，B 站就不认了。
 */
function rawQueryValue(url, key) {
  const match = String(url || '').match(new RegExp(`[?&]${key}=([^&]*)`));
  return match ? match[1] : '';
}

function cookieFromSetCookie(headers) {
  const out = new Map();
  const raw = headers ? headers['set-cookie'] : null;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

  for (const entry of list) {
    const first = String(entry).split(';')[0];
    const eq = first.indexOf('=');
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    if (LOGIN_COOKIE_KEYS.includes(name) || name === 'buvid3') out.set(name, value);
  }
  return out;
}

async function qrPoll(key) {
  const res = await httpGet(
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`,
    { Referer: 'https://passport.bilibili.com/' },
    10000,
  );

  let json;
  try {
    json = JSON.parse(res.body.toString('utf8'));
  } catch {
    return { ok: false, state: 'error', message: '二维码状态返回的不是 JSON' };
  }

  if (!json || json.code !== 0) {
    return { ok: false, state: 'error', message: `poll-${(json && json.code) || '?'}` };
  }

  const data = json.data || {};
  const code = Number(data.code);

  if (code === 86101) return { ok: true, state: 'waiting', message: '用 B 站 App 扫一下' };
  if (code === 86090) return { ok: true, state: 'scanned', message: '扫到了，在手机上点确认' };
  if (code === 86038) return { ok: true, state: 'expired', message: '二维码过期了，刷新一下' };
  if (code !== 0) return { ok: true, state: 'error', message: `未知状态 ${code}` };

  const fields = cookieFromSetCookie(res.headers);
  for (const name of LOGIN_COOKIE_KEYS) {
    if (fields.has(name)) continue;
    const fromUrl = rawQueryValue(data.url, name);
    if (fromUrl) fields.set(name, fromUrl);
  }

  if (!fields.has('SESSDATA')) {
    return { ok: false, state: 'error', message: '登录成功了，但没拿到 SESSDATA' };
  }

  // 把当前会话的指纹带过去，免得登录前后被当成两台设备。
  const buvid = cookieValue(session && session.cookie, 'buvid3');
  if (buvid && !fields.has('buvid3')) fields.set('buvid3', buvid);

  const cookie = [...fields.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

  return { ok: true, state: 'confirmed', message: '登录成功', cookie };
}

/* ------------------------------------------------------------------ *
 * 入口
 * ------------------------------------------------------------------ */

module.exports = function activate(api) {
  const host = (api.host && api.host.folium) || { major: 1, minor: 0 };
  api.log.info(`bili-mv-window：main 入口已启动（Folium ${host.major}.${host.minor}）`);

  // 读 secret 要等 client 注册过设置分区，所以这里只把 api 存着，用到时再读。
  secretsApi = api;

  api.rpc.handle('resolveMv', async (input) => {
    try {
      return await resolveMv(input || {});
    } catch (err) {
      api.log.error('resolveMv 失败', String((err && err.stack) || err));
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /** 自由搜索：给候选面板里的那个输入框用，只出列表不取流。 */
  api.rpc.handle('searchCandidates', async (input) => {
    try {
      return await searchCandidates(input || {});
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /** 把某个 BV 的视频轨存到本地（「只存用户挑过的」那条路）。文件名用「歌名 - 歌手」。 */
  api.rpc.handle('cacheVideo', async (input) => {
    const bvid = String((input && input.bvid) || '').trim();
    if (!/^BV[0-9A-Za-z]{8,12}$/.test(bvid)) return { ok: false, error: 'bad-bvid' };
    setCacheSpec(input && input.cacheDir);

    const wantedTitle = String((input && input.title) || '').trim();
    const wantedArtist = String((input && input.artist) || '').trim();

    if (await hasCachedVideo(bvid)) return { ok: true, cached: true, already: true };

    try {
      const meta = await getVideoMeta(bvid);
      const urls = await getPlayUrls(bvid, meta.cid, QUALITY_QN['1080p']);
      if (!urls.video) return { ok: false, error: 'no-video-track' };

      const cacheTitle = wantedTitle || meta.title || '';
      const slug = songSlug(cacheTitle, wantedArtist);

      await downloadToCache(slug, urls.video.url, {
        bvid,
        title: cacheTitle,
        artist: wantedArtist,
        author: meta.author,
        cover: absoluteCover(meta.cover),
        durationSec: meta.durationSec,
        quality: {
          id: urls.video.id,
          width: urls.video.width,
          height: urls.video.height,
          codecid: urls.video.codecid,
        },
      });

      const limitBytes =
        Number(input && input.cacheLimitMb) > 0
          ? Number(input.cacheLimitMb) * 1024 * 1024
          : undefined;
      await pruneCache(limitBytes);

      return { ok: true, cached: true, slug, stats: await cacheStats() };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  api.rpc.handle('cacheStats', async (input) => {
    if (input && input.cacheDir) setCacheSpec(input.cacheDir);
    try {
      return { ok: true, ...(await cacheStats()) };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), count: 0, bytes: 0, dir: '' };
    }
  });

  api.rpc.handle('clearCache', async (input) => {
    if (input && input.cacheDir) setCacheSpec(input.cacheDir);
    try {
      const removed = await clearCacheDir();
      return { ok: true, removed, ...(await cacheStats()) };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), removed: 0 };
    }
  });

  /** 只删当前这首歌（这一个视频）的缓存，别的留着。 */
  api.rpc.handle('removeCache', async (input) => {
    setCacheSpec(input && input.cacheDir);

    const bvid = String((input && input.bvid) || '').trim();
    const title = String((input && input.title) || '').trim();
    const artist = String((input && input.artist) || '').trim();

    try {
      let record = bvid ? await findCachedByBvid(bvid) : null;
      if (!record && title) record = await findCachedBySong(title, artist);
      if (!record) return { ok: false, error: 'not-cached' };

      const removed = removeCachedBySlug(record.slug);
      if (!removed) return { ok: false, error: 'remove-failed', slug: record.slug };

      return { ok: true, slug: record.slug, ...(await cacheStats()) };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /** 检查 B 站登录态：刚粘完 cookie 时用来确认到底成没成。 */
  api.rpc.handle('biliStatus', async () => {    try {
      const sess = await getSession(true);
      return {
        ok: true,
        loggedIn: Boolean(sess && sess.loggedIn),
        uname: (sess && sess.uname) || '',
        vip: Boolean(sess && sess.vip),
        hasCookie: Boolean(sess && sess.hasUserCookie),
        hasBuvid: Boolean(sess && cookieValue(sess.cookie, 'buvid3')),
      };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /** 清掉会话缓存，让下一次请求重新读 cookie 和 wbi 密钥。 */
  api.rpc.handle('refreshSession', async () => {
    await readUserCookie(true);
    session = null;
    sessionAt = 0;
    return { ok: true };
  });

  /** 扫码登录第一步：要一张二维码。 */
  api.rpc.handle('qrGenerate', async () => {
    try {
      const result = await qrGenerate();
      return { ok: true, url: result.url, key: result.key };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  /** 扫码登录第二步：轮询。confirmed 时多给一个 cookie 字段。 */
  api.rpc.handle('qrPoll', async (key) => {
    try {
      return await qrPoll(String(key || ''));
    } catch (err) {
      return { ok: false, state: 'error', message: String((err && err.message) || err) };
    }
  });

  api.rpc.handle('ping', async () => ({
    ok: true,
    proxy: proxyPort || null,
    loggedIn: Boolean(session && session.loggedIn),
  }));

  api.onDispose(() => {
    if (proxyServer) {
      try {
        proxyServer.close();
      } catch {
        /* ignore */
      }
      proxyServer = null;
      proxyPort = 0;
    }
    proxyTokens.clear();
    localTokens.clear();
    session = null;
    sessionAt = 0;
    secretsApi = null;
    userCookie = '';
    userCookieAt = 0;
    knownCookie = '';
  });
};
