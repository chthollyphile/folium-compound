'use strict';

/**
 * bili-mv-cinema — main 入口（Node / Electron 主进程）
 *
 * 交互设计上这个模组是「按需进影院」：不常驻、不自动播放，点按钮才去找 MV，
 * 所以这里只做四件事：
 *
 *   1. 拿歌名 + 歌手去 B 站搜，用打分挑出最像官方 MV 的那个（算法从 bili-mv-window 抄来，
 *      它已经在真实曲库上跑过一年）；
 *   2. 取播放地址。**和「小窗」那版的关键区别是这里有声音**：
 *      - 优先 DASH 的 video + audio 两条独立轨（能到 1080P / 1080P60 / 4K，但要客户端双元素同步）；
 *      - 只有当 DASH 拿不到更高的画质时，才退回 durl —— 那是一整段含音轨的 mp4，
 *        音画天生同步、最高 720P。
 *      两者取实际能拿到的更高画质，不为了「DASH」这个名字牺牲清晰度。
 *   3. 起一个 127.0.0.1 的只读代理，补上 B 站 CDN 要的 Referer / UA 并透传 Range
 *      （拖进度条靠 Range）。
 *   4. 扫码登录 / 读 secret 里的 Cookie，让画质能到 1080P 以上。
 *
 * 依赖只有 node 内置模块，没有第三方包。
 */

const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

const REFERER = 'https://www.bilibili.com/';
const SEARCH_REFERER = 'https://search.bilibili.com/';

/** B 站 wbi 签名的固定置换表（公开算法，长期不变）。 */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21,
  56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
];

/** 清晰度档位 → B 站 qn 值（只当上限用，实际拿得到哪一档看账号权益）。 */
const QUALITY_QN = Object.freeze({
  '4k': 120,
  '1080p60': 116,
  '1080p': 80,
  '720p': 64,
  '480p': 32,
});

/**
 * 一支 MV 至少得多长。
 *
 * B 站上「歌名 歌手」搜出来的头部经常混着十几秒的东西：分P视频的 P1 预告 / 切片、
 * 15 秒二创、试听片段、花絮前导。全屏看一支 15 秒的片子等于没看，所以这条线以下
 * 直接不算 MV —— 排序时沉底、取流时拒绝，resolve 会顺着候选往下找。
 */
const MIN_MV_SECONDS = 20;

const QN_LABEL = Object.freeze({
  127: '8K',
  126: '杜比视界',
  125: 'HDR',
  120: '4K',
  116: '1080P60',
  112: '1080P+',
  80: '1080P',
  74: '720P60',
  64: '720P',
  32: '480P',
  16: '360P',
});

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
 * 会话：buvid3 指纹 + wbi 密钥 + 登录态
 *
 * 没有 buvid3 时搜索接口会直接 -412（风控），所以先要一份指纹 cookie；
 * 用户自己带了 buvid3 就别动 —— 那个和账号是绑的。
 * ------------------------------------------------------------------ */

/** activate 里拿到的 api，用来读 secret。 */
let api = null;

let userCookie = '';
let userCookieAt = 0;
let knownCookie = '';
let session = null;
let sessionAt = 0;

/** 读用户填的 cookie。10 秒缓存，避免每次开影院都跨进程读一次凭证库。 */
async function readUserCookie(force = false) {
  if (!api || !api.secrets || typeof api.secrets.get !== 'function') return '';
  if (!force && Date.now() - userCookieAt < 10_000) return userCookie;

  userCookieAt = Date.now();
  let next = '';
  try {
    const value = await api.secrets.get('cookie');
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

async function buildSession() {
  const loginCookie = await readUserCookie();
  let cookie = loginCookie;

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
  if (fresh && !force) return session;
  session = await buildSession();
  sessionAt = Date.now();
  return session;
}

function getMixinKey(original) {
  return MIXIN_KEY_ENC_TAB.map((index) => original[index]).join('').slice(0, 32);
}

/** wbi 签名：参数按 key 排序 + 过滤特殊字符 + 拼 mixinKey 取 md5。 */
function signQuery(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey);
  const wts = Math.round(Date.now() / 1000);
  const merged = { ...params, wts };

  const query = Object.keys(merged)
    .sort()
    .map((key) => {
      const value = String(merged[key] ?? '').replace(/[!'()*]/g, '');
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  const w_rid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
  return `${query}&w_rid=${w_rid}`;
}

/* ------------------------------------------------------------------ *
 * 搜索与打分
 * ------------------------------------------------------------------ */

function stripTags(text) {
  return String(text ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 匹配用的归一化：去括号补充说明、去常见噪声词、去标点空白。 */
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

const NOISE =
  /(翻唱|翻自|cover|伴奏|karaoke|纯音乐|钢琴|piano|吉他|演奏|弹奏|教学|曲谱|鼓谱|乐谱|谱子|\btab\b|reaction|解说|直播|录播|合集|混剪|remix|鬼畜|搞笑|恶搞|整活|8d|环绕|日推)/i;

/**
 * 「官方号」的两种长相：
 *   · 名字里明写官方 / 工作室 / 唱片 —— UP 主自己起的，好伪造，只当弱信号；
 *   · 认证位（下面 getCard 查得到，type=1 是机构认证）—— 伪造不了，这才是主信号。
 */
const OFFICIAL_CHANNEL = /(官方|官频|official|工作室|studio|唱片|records|厂牌|音乐台|音乐频道|music\s*(?:channel|label))/i;

/** 已知的唱片公司 / 版权方账号名。命中了直接算官方候选，连认证都不用查。 */
const LABEL_CHANNEL =
  /(环球音乐|索尼音乐|华纳音乐|滚石|杰威尔|相信音乐|太合音乐|摩登天空|华研国际|福茂|avex|sony\s*music|universal\s*music|warner\s*music|columbia\s*records|republic\s*records|interscope)/i;

/** 现场向：能看，但不是 MV（全屏看一场 live 和看一支 MV 的期待不一样）。 */
const LIVE_VIDEO = /(\blive\b|现场|演唱会|concert|巡演|音乐节|festival|不插电|unplugged)/i;

/**
 * 「这就是 MV」的强信号。全屏看片和角落小窗是两回事：
 * 小窗只是「有点画面就行」，全屏占满屏幕之后，一个静态封面 + 滚动歌词的投稿会很难看。
 * 所以这里明确奖励 MV / 官方 / 中字这类字样。
 */
const MV_STRONG = /(\bmv\b|music\s*video|官方|official|正式版|中字|中文字幕)/i;

/** 画质标签，有是好事，但别喧宾夺主（「4K Hi-Res」这种多半是音频投稿）。 */
const QUALITY_TAG = /(1080|\b4k\b|\bhd\b|高清|修复)/i;

/** 明显是「音频向」的投稿：画面基本静止，全屏看没意义。 */
const AUDIO_ONLY =
  /(hi-?res|无损|音质|纯享|歌词|lyrics?|可视化|频谱|audio\s*only|试听|黑胶|动态歌词|歌单|琴谱|光遇|\bdj\b|慢摇|remix|mix)/i;

/**
 * 打分。拆成歌名 / 歌手 / 其它三块。
 *
 * 「歌手」那一块看的是 **UP 主名字**，不是视频标题 —— 标题里堆歌手名太容易，
 * 官方号 / 本人号的 UP 主名才是强信号。UP 主认证（机构认证 / 歌手本人号）要
 * 额外请求一次 card 接口，那一步在 applyVerify 里做，这里只留位置。
 */
function scoreCandidate(item, want) {
  const title = stripTags(item.title);
  const normalized = normalize(title);
  if (!normalized) return null;

  const name = normalize(want.title);
  const artist = normalize(want.artist);
  const uploader = normalize(item.author);
  const seconds = parseDuration(item.duration);
  const typename = String(item.typename || '');

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

  const ignoreCase = want.ignoreCase !== false;
  const uploaderRaw = String(item.author || '');

  const uploaderHit = ignoreCase
    ? Boolean(artist) && Boolean(uploader) && uploader.includes(artist)
    : Boolean(want.artist) && uploaderRaw.includes(String(want.artist));

  const titleArtistHit = ignoreCase
    ? Boolean(artist) && normalized.includes(artist)
    : Boolean(want.artist) && normalize(title, { keepCase: true }).includes(String(want.artist));

  const artistHit = uploaderHit || titleArtistHit;
  if (uploaderHit) artistScore += 34;
  else if (titleArtistHit) artistScore += 18;

  /* --- 官方/本人号：第一层是名字，第二层（认证）在 applyVerify 里补 --- */
  const officialName = OFFICIAL_CHANNEL.test(uploaderRaw);
  const labelName = LABEL_CHANNEL.test(uploaderRaw);
  const selfName = Boolean(artist) && Boolean(uploader) && uploader === artist;

  if (selfName) artistScore += 24; // UP 主名字就是歌手名：本人号 / 官方搬运
  if (officialName) otherScore += 12;
  if (labelName) otherScore += 18;
  if ((officialName || labelName) && uploaderHit && !selfName) artistScore += 8;

  /* --- 分区：193「MV」是投稿人自己选的分类，比标题里的 MV 可信 --- */
  if (typename === 'MV') otherScore += 30;
  else if (/音乐现场/.test(typename)) otherScore += 2;
  else if (/音乐/.test(typename)) otherScore += 4;
  else if (typename) otherScore -= 34; // 舞蹈 / 手机游戏 / 鬼畜，全屏看基本都是错的

  if (seconds >= 45 && seconds <= 900) otherScore += 12;
  if (seconds > 1800 || (seconds > 0 && seconds < 25)) otherScore -= 30;
  const plays = Number(item.play) || 0;
  otherScore += Math.min(30, Math.log10(plays + 1) * 6);

  // 点赞数比播放数难刷，给一点权重（最多 12 分）
  const likes = Number(item.like) || 0;
  if (likes > 0) otherScore += Math.min(12, Math.log10(likes + 1) * 3);

  const tags = normalize(item.tag);
  if (artist && tags && tags.includes(artist)) otherScore += 6;

  if (MV_STRONG.test(title)) otherScore += 26;
  if (QUALITY_TAG.test(title)) otherScore += 8;
  if (AUDIO_ONLY.test(title)) otherScore -= 20;
  if (LIVE_VIDEO.test(title)) otherScore -= 6;
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
    artistSource: uploaderHit ? 'uploader' : titleArtistHit ? 'title' : null,
    /** 搜索结果里自报的时长就不到 20 秒：大概率是片段，排到最后。 */
    short: seconds > 0 && seconds < MIN_MV_SECONDS,
    official: 0,
    verify: '',
  };
}

/**
 * 排序：不短的在前，短的整批沉底。
 *
 * 不在这一步直接删掉，是因为搜索结果里的 duration 是 **P1 的时长**：分P投稿
 * 可能 P1 是 15 秒预告、P2 才是正片，删了就白白丢掉一支真 MV。真正判断
 * 「这是不是片段」放在 getVideoMeta 里，那里能看到 pages。
 */
function rankCandidates(items, want) {
  return items
    .map((item) => ({ item, score: scoreCandidate(item, want) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => {
      const shortA = a.score.short ? 1 : 0;
      const shortB = b.score.short ? 1 : 0;
      if (shortA !== shortB) return shortA - shortB;
      return b.score.total - a.score.total;
    });
}

/* ------------------------------------------------------------------ *
 * UP 主认证（「官方 MV 频道 / 歌手本人号」的硬信号）
 *
 * 搜索结果里没有认证信息，得单独问 card 接口。一次 resolve 只查前几个候选，
 * 按 mid 缓存 6 小时 —— 常搜的那几个搬运号会立刻命中缓存，不再发请求。
 * ------------------------------------------------------------------ */

const cardCache = new Map();
const CARD_OK_TTL = 6 * 60 * 60 * 1000;
const CARD_FAIL_TTL = 60 * 60 * 1000;

function cardFrom(json) {
  const card = json && json.code === 0 && json.data && json.data.card;
  if (!card) return null;
  const official = card.Official && typeof card.Official === 'object' ? card.Official : null;
  return {
    name: String(card.name || ''),
    follower: Number(json.data.follower) || 0,
    official: official
      ? {
          // type: -1 无 / 0 个人认证 / 1 机构认证
          type: Number.isFinite(Number(official.type)) ? Number(official.type) : -1,
          title: String(official.title || ''),
          role: Number(official.role) || 0,
        }
      : null,
  };
}

async function getCard(mid) {
  const key = String(mid || '').trim();
  if (!key) return null;

  const now = Date.now();
  const hit = cardCache.get(key);
  if (hit && now - hit.at < (hit.data ? CARD_OK_TTL : CARD_FAIL_TTL)) return hit.data;

  let data = null;
  try {
    const current = await getSession();
    const json = await getJson(
      `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(key)}`,
      { Cookie: current.cookie, Referer: REFERER },
      6000,
    );
    data = cardFrom(json);
  } catch {
    data = null;
  }

  cardCache.set(key, { at: now, data });
  return data;
}

/**
 * 认证带来的加分。level 只用来给界面挂「官方」角标：
 *   2 = 真的官方（机构认证，或认证名里带歌手名，或歌手本人号）
 *   1 = 有认证（个人认证）
 */
function verifyBonus(card, want, item) {
  const official = card && card.official;
  const type = official ? official.type : -1;
  const verifyTitle = normalize(official ? official.title : '');
  const artist = normalize(want.artist);
  const uploader = normalize(item.author);

  let bonus = 0;
  let level = 0;

  if (type === 1) {
    bonus += 22; // 机构认证：唱片公司 / 官方频道
    level = 2;
  } else if (type === 0) {
    bonus += 6; // 个人认证
    level = 1;
  }

  if (type >= 0 && artist && verifyTitle && verifyTitle.includes(artist)) {
    bonus += 12; // 认证名里写着这个歌手 = 官方账号
    level = 2;
  }

  if (type === 0 && artist && uploader && uploader === artist) {
    bonus += 16; // 歌手本人的个人认证号
    level = 2;
  }

  if (card && card.follower >= 500000) bonus += 4;

  return { bonus, level, title: (official && official.title) || '' };
}

/** 查前 limit 个候选的认证，改分后再排一次。失败就当没认证，绝不阻断。 */
async function applyVerify(ranked, want, limit = 4) {
  if (!ranked.length) return ranked;

  const picks = [];
  const seen = new Set();
  for (const entry of ranked) {
    const mid = entry.item.mid;
    if (!mid || seen.has(String(mid))) continue;
    seen.add(String(mid));
    picks.push(entry);
    if (picks.length >= limit) break;
  }
  if (!picks.length) return ranked;

  const cards = await Promise.all(picks.map((entry) => getCard(entry.item.mid).catch(() => null)));

  picks.forEach((entry, index) => {
    const card = cards[index];
    if (!card) return;
    const result = verifyBonus(card, want, entry.item);
    entry.score.total += result.bonus;
    entry.score.official = Math.max(entry.score.official || 0, result.level);
    if (!entry.score.verify && result.level >= 2) entry.score.verify = result.title;
  });

  ranked.sort((a, b) => {
    const shortA = a.score.short ? 1 : 0;
    const shortB = b.score.short ? 1 : 0;
    if (shortA !== shortB) return shortA - shortB;
    return b.score.total - a.score.total;
  });
  return ranked;
}

function absoluteCover(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  if (text.startsWith('//')) return `https:${text}`;
  if (text.startsWith('http://')) return `https://${text.slice(7)}`;
  return text;
}

/**
 * 列表里的小图。
 *
 * 播放列表一格只有 78×44，封面原图却常常是 672×378 的 JPEG（几十 KB）。
 * B 站图床支持在地址后面挂一段图片处理参数现场裁一张：
 *   https://i0.hdslb.com/bfs/archive/xxx.jpg@176w_100h_1c.webp
 * 尺寸刚好对上 2 倍屏，体积小一个数量级 —— 十几张图一起加载也不会打堆。
 * 别家的图（或已经带过参数的老地址）原样返回，不硬套。
 */
function thumbCover(url, width = 176, height = 100) {
  const text = absoluteCover(url);
  if (!/^https?:\/\//i.test(text)) return text;
  const base = text.split('@')[0];
  if (!/(hdslb|biliimg)\.com\//i.test(base)) return base;
  return `${base}@${width}w_${height}h_1c.webp`;
}

function toCandidateDto(entry) {
  return {
    bvid: entry.item.bvid,
    title: entry.item.title,
    author: entry.item.author,
    cover: thumbCover(entry.item.pic),
    duration: entry.item.duration,
    durationSec: parseDuration(entry.item.duration),
    play: Number(entry.item.play) || 0,
    score: Math.round(entry.score.total),
    typename: entry.item.typename || '',
    official: entry.score.official || 0,
    verify: entry.score.verify || '',
    nameHit: entry.score.nameHit,
    artistHit: entry.score.artistHit,
    artistSource: entry.score.artistSource,
    /** 搜索结果自报不到 20 秒：界面上标一下，别让用户以为是一支短片 MV。 */
    short: Boolean(entry.score.short),
  };
}

/**
 * 同一个关键词的搜索结果缓存 8 分钟。
 *
 * 不只是省时间：补搜「歌名 歌手 MV」会让请求量翻倍，B 站对短时间内的重复搜索
 * 会**返回空列表**（不是报错，是 code 0 + 空），表现就是「搜不到这首歌」。
 */
const searchCache = new Map();
const SEARCH_TTL = 8 * 60 * 1000;
const SEARCH_MAX = 120;

async function searchVideos(keyword, retried = false) {
  const cacheKey = String(keyword || '').trim();
  const now = Date.now();
  const cached = searchCache.get(cacheKey);
  if (cached && now - cached.at < SEARCH_TTL) return cached.items;

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

  const json = await getJson(`https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`, {
    Cookie: current.cookie,
    Referer: SEARCH_REFERER,
  });

  // -412：被风控拦了。换一份新会话重试一次。
  if (json && json.code === -412 && !retried) {
    await getSession(true);
    return searchVideos(keyword, true);
  }

  if (!json || json.code !== 0) {
    throw new Error(`search-${json && json.code}: ${(json && json.message) || 'unknown'}`);
  }

  const list = json.data && Array.isArray(json.data.result) ? json.data.result : [];
  const items = list
    .filter((entry) => entry && entry.type === 'video' && entry.bvid)
    .map((entry) => ({
      bvid: String(entry.bvid),
      title: stripTags(entry.title),
      author: String(entry.author || ''),
      mid: String(entry.mid || ''),
      typename: String(entry.typename || ''),
      tag: String(entry.tag || ''),
      pic: String(entry.pic || ''),
      duration: entry.duration,
      play: entry.play,
      like: entry.like,
    }));

  searchCache.set(cacheKey, { at: now, items });
  if (searchCache.size > SEARCH_MAX) searchCache.delete(searchCache.keys().next().value);
  return items;
}

/* ------------------------------------------------------------------ *
 * 取播放地址
 * ------------------------------------------------------------------ */

/**
 * 分P视频挑「正片」那一 P。
 *
 * view 接口里的 `data.cid` 只指向 P1，而音乐区一堆投稿是 P1 放十几秒预告、
 * P2 才是整支 MV（或者 P1 是切片、P2 是完整版）。照着 data.cid 取流，播出来的
 * 就是那十几秒 —— 用户看到的现象是「点进去几秒就结束了」。
 *
 * 所以有 pages 时取**时长最长**的那一 P，它才是正片；只有一 P 时行为和以前一样。
 */
function pickPage(data) {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  let best = null;
  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i] || {};
    const cid = Number(page.cid) || 0;
    if (!cid) continue;
    const duration = Number(page.duration) || 0;
    if (!best || duration > best.durationSec) {
      best = {
        cid,
        durationSec: duration,
        page: Number(page.page) || i + 1,
        part: String(page.part || ''),
      };
    }
  }
  if (best) return best;

  return {
    cid: Number(data.cid) || 0,
    durationSec: Number(data.duration) || 0,
    page: 0,
    part: '',
  };
}

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
  const page = pickPage(data);
  if (!page.cid) throw new Error('view-no-cid');

  // 十几秒的片子不是 MV：让上层顺着候选往下换一个。
  if (page.durationSec > 0 && page.durationSec < MIN_MV_SECONDS) {
    throw new Error(`too-short: ${page.durationSec}s`);
  }

  return {
    cid: page.cid,
    page: page.page,
    part: page.part,
    pages: Array.isArray(data.pages) ? data.pages.length : 1,
    title: String(data.title || ''),
    author: String((data.owner && data.owner.name) || ''),
    durationSec: page.durationSec || Number(data.duration) || 0,
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
      bandwidth: Number(track.bandwidth) || 0,
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
    group.sort((a, b) => b.id - a.id || b.bandwidth - a.bandwidth);
    return group[0];
  }

  return null;
}

/**
 * 在 DASH 的音频轨里挑一条。
 *
 * 只要「普通 AAC」这几档：30280 (192k) > 30232 (132k) > 30216 (64k)。
 * 杜比 / Hi-Res 那几条（30250、30251）要大会员 + 特定设备标识，普通请求拿到了也放不出来，
 * 所以干脆不碰 —— 音轨挂掉比音质低一档糟得多。
 */
function pickAudioTrack(tracks) {
  const normalized = tracks
    .map((track) => ({
      url: track.baseUrl || track.base_url || '',
      backupUrl: track.backupUrl || track.backup_url || [],
      id: Number(track.id) || 0,
      bandwidth: Number(track.bandwidth) || 0,
    }))
    .filter((track) => track.url);

  if (!normalized.length) return null;

  const preferred = [30280, 30232, 30216];
  for (const id of preferred) {
    const hit = normalized.find((track) => track.id === id);
    if (hit) return hit;
  }
  normalized.sort((a, b) => b.bandwidth - a.bandwidth);
  return normalized[0];
}

/**
 * 一次 playurl 请求。
 * @param {'dash'|'durl'} kind
 */
async function requestPlayurl(bvid, cid, qn, kind) {
  const current = await getSession();
  const base = 'https://api.bilibili.com/x/player/playurl';
  const query =
    kind === 'dash'
      ? `bvid=${encodeURIComponent(bvid)}&cid=${cid}&fnval=4048&fnver=0&fourk=1&qn=${qn}&high_quality=1`
      : `bvid=${encodeURIComponent(bvid)}&cid=${cid}&fnval=1&fnver=0&qn=${qn}&platform=html5&high_quality=1`;

  const json = await getJson(`${base}?${query}`, { Cookie: current.cookie });
  const data = (json && json.data) || {};

  if (kind === 'dash') {
    const dash = data.dash || {};
    return {
      video: pickVideoTrack(dash.video || [], qn),
      audio: pickAudioTrack(dash.audio || []),
      quality: Number(data.quality) || 0,
      accept: data.accept_quality || [],
    };
  }

  const first = data.durl && data.durl[0];
  return {
    url: first ? String(first.url || '') : '',
    size: first ? Number(first.size) || 0 : 0,
    quality: Number(data.quality) || 0,
    accept: data.accept_quality || [],
  };
}

/**
 * 拿到「这次能放的最好的、而且有声音的」源。
 *
 * 判断顺序（很重要，别改成无脑 DASH）：
 *   1. 同时问 DASH 和 durl；
 *   2. durl 是整段 mp4，音画天生同步 —— 只要它的画质 >= DASH 实际拿到的画质，就用它；
 *   3. DASH 画质更高、而且有普通 AAC 音轨，才用双轨（客户端负责同步）；
 *   4. DASH 只有视频没音频 → 退回 durl（宁可低一档也要有声音）。
 *
 * 实测：未登录时 DASH 只给 480P，durl 反而给 720P，所以「无脑 DASH」会是个画质倒退。
 */
async function resolveStream(bvid, cid, qn) {
  const [dashResult, durlResult] = await Promise.all([
    requestPlayurl(bvid, cid, qn, 'dash').catch(() => ({ video: null, audio: null, quality: 0 })),
    requestPlayurl(bvid, cid, qn, 'durl').catch(() => ({ url: '', quality: 0 })),
  ]);

  const dashOk = Boolean(dashResult.video && dashResult.audio);
  const durlOk = Boolean(durlResult.url);

  if (dashOk && (!durlOk || dashResult.quality > durlResult.quality)) {
    return {
      mode: 'dash',
      videoUrl: dashResult.video.url,
      videoBackup: dashResult.video.backupUrl || [],
      audioUrl: dashResult.audio.url,
      audioBackup: dashResult.audio.backupUrl || [],
      quality: {
        id: dashResult.video.id,
        label: QN_LABEL[dashResult.video.id] || `${dashResult.video.height}P`,
        width: dashResult.video.width,
        height: dashResult.video.height,
        codecid: dashResult.video.codecid,
        codec: dashResult.video.codecid === 7 ? 'AVC' : dashResult.video.codecid === 13 ? 'AV1' : dashResult.video.codecid === 12 ? 'HEVC' : '',
      },
    };
  }

  if (durlOk) {
    return {
      mode: 'muxed',
      videoUrl: durlResult.url,
      videoBackup: [],
      audioUrl: '',
      audioBackup: [],
      quality: {
        id: durlResult.quality,
        label: QN_LABEL[durlResult.quality] || `${durlResult.quality}`,
        width: 0,
        height: 0,
        codecid: 0,
        codec: '',
      },
    };
  }

  // DASH 有视频没音频，也总比什么都没有强。
  if (dashResult.video) {
    return {
      mode: 'silent',
      videoUrl: dashResult.video.url,
      videoBackup: dashResult.video.backupUrl || [],
      audioUrl: '',
      audioBackup: [],
      quality: {
        id: dashResult.video.id,
        label: QN_LABEL[dashResult.video.id] || `${dashResult.video.height}P`,
        width: dashResult.video.width,
        height: dashResult.video.height,
        codecid: dashResult.video.codecid,
        codec: dashResult.video.codecid === 7 ? 'AVC' : dashResult.video.codecid === 13 ? 'AV1' : dashResult.video.codecid === 12 ? 'HEVC' : '',
      },
    };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * 本地代理（补 Referer / UA，透传 Range）
 *
 * B 站 CDN 会校验 Referer，http 的 PCDN 节点还会被 https 页面的混合内容规则掐掉，
 * 所以渲染进程里的 <video> / <audio> 统一走这条本地线路。token 只存在主进程。
 * ------------------------------------------------------------------ */

let proxyServer = null;
let proxyPort = 0;
const proxyTokens = new Map();

function registerToken(url, contentType, ttlMs = 3 * 60 * 60 * 1000) {
  const token = crypto.randomBytes(16).toString('hex');
  proxyTokens.set(token, { url, contentType, expiresAt: Date.now() + ttlMs });
  if (proxyTokens.size > 64) {
    const now = Date.now();
    for (const [key, value] of proxyTokens) if (value.expiresAt < now) proxyTokens.delete(key);
  }
  return token;
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
 * 扫码登录
 *
 *   1. generate 拿 url + qrcode_key
 *   2. poll 里 code: 86101 未扫码 / 86090 已扫未确认 / 0 成功 / 86038 失效
 *   3. 成功时从 Set-Cookie 与跳转 URL 里捞 SESSDATA 等字段拼成 cookie
 * ------------------------------------------------------------------ */

const LOGIN_COOKIE_KEYS = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid'];

async function qrGenerate() {
  const json = await getJson('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
    Referer: 'https://passport.bilibili.com/',
  });
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
 * 主流程
 * ------------------------------------------------------------------ */

/** 把直链换成代理地址；代理起不来就退回直链（可能被防盗链拦）。 */
function buildSources(stream) {
  const sources = [];
  const videoType = 'video/mp4';
  const audioType = 'audio/mp4';

  if (proxyServer) {
    sources.push({
      kind: 'proxy',
      video: `http://127.0.0.1:${proxyPort}/s/${registerToken(stream.videoUrl, videoType)}`,
      audio: stream.audioUrl
        ? `http://127.0.0.1:${proxyPort}/s/${registerToken(stream.audioUrl, audioType)}`
        : '',
    });
  }

  sources.push({ kind: 'direct', video: stream.videoUrl, audio: stream.audioUrl || '' });

  return sources;
}

/**
 * @param {object} input
 * @param {string} input.title      歌名
 * @param {string} input.artist     歌手
 * @param {number} input.durationMs 时长（毫秒，用于打分）
 * @param {string} input.quality    auto / 1080p60 / 1080p / 720p / 480p
 * @param {string} [input.bvid]     指定视频（候选里点选时带）
 * @param {string} [input.query]    指定关键词（用户改过搜索词）
 */
async function resolveMv(input) {
  const want = {
    title: String(input.title || '').trim(),
    artist: String(input.artist || '').trim(),
    durationMs: Number(input.durationMs) || 0,
    ignoreCase: true,
  };

  const bvidAsked = String(input.bvid || '').trim();
  const quality = String(input.quality || 'auto');

  if (!want.title && !bvidAsked && !input.query) return { ok: false, error: 'no-song-title' };

  // 「自动」按登录态挑上限：登录了才值得要 1080P，没登录要了也只有 480P。
  let qn;
  if (quality === 'auto') {
    const sess = await getSession().catch(() => null);
    qn = sess && sess.loggedIn ? QUALITY_QN['1080p'] : QUALITY_QN['720p'];
  } else {
    qn = QUALITY_QN[quality] || QUALITY_QN['720p'];
  }

  const keyword = String(input.query || '').trim() || [want.title, want.artist].filter(Boolean).join(' ');

  let best = null;
  let ranked = [];

  if (bvidAsked) {
    if (!/^BV[0-9A-Za-z]{8,12}$/.test(bvidAsked)) {
      return { ok: false, error: 'bad-bvid', bvid: bvidAsked };
    }
    best = { bvid: bvidAsked, title: '', author: '', pic: '', duration: '0:00', play: 0 };
  } else {
    const pool = new Map();
    const absorb = (list) => {
      for (const item of list || []) if (item && item.bvid && !pool.has(item.bvid)) pool.set(item.bvid, item);
    };

    let items;
    try {
      items = await searchVideos(keyword);
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), keyword };
    }
    absorb(items);

    if (!items.length && want.artist && !input.query) {
      // 歌名 + 歌手一起搜不到时，退一步只搜歌名。
      try {
        absorb(await searchVideos(want.title));
      } catch {
        /* 还是没有就算了 */
      }
    }

    ranked = rankCandidates([...pool.values()], want);

    /**
     * 常识：B 站上「歌名 歌手」搜出来的头部经常是音频投稿（4K Hi-Res / 无损），
     * 而「歌名 歌手 MV」能捞到另一批真投稿 —— 两批结果重合度并不高。
     * 所以只在头部不够像 MV 时才补搜一次（多花一次请求、约 400ms，不是每次都花）。
     */
    const weak = !ranked.length || ranked[0].item.typename !== 'MV' || ranked[0].score.total < 150;
    if (weak && !input.query) {
      try {
        absorb(await searchVideos(`${keyword} MV`));
      } catch {
        /* 补搜失败就用手上这批 */
      }
      ranked = rankCandidates([...pool.values()], want);
    }

    if (!ranked.length) return { ok: false, error: pool.size ? 'no-candidate' : 'search-empty', keyword };

    // 认证是「官方」的硬信号，排在标题和播放量后面查一遍，把官方号顶上去。
    await applyVerify(ranked, want);

    best = ranked[0].item;
  }

  /**
   * 顺着候选往下试，别把命押在第一名身上。
   *
   * 第一名可能是十几秒的片段（分P的预告、切片）、被版权/地区限制掐掉、或者干脆取不到流。
   * 以前这几种情况整次都失败，界面只能弹「没找到」。现在按分数依次试前 4 个，
   * 第一个能真正出流的就用它 —— 用户关心的是「有 MV 看」，不是「必须是最高分的那支」。
   * 只有 bvid 是明确指定的时候（换源里点的那支、手动挑过的），才只试这一个。
   */
  const attempts = bvidAsked ? [{ bvid: bvidAsked }] : ranked.slice(0, 4).map((entry) => entry.item);

  let picked = null;
  let meta = null;
  let stream = null;
  let lastError = '';
  let skippedShort = 0;

  for (const item of attempts) {
    if (!item || !item.bvid) continue;

    let candidateMeta;
    try {
      candidateMeta = await getVideoMeta(item.bvid);
    } catch (err) {
      lastError = String((err && err.message) || err);
      if (lastError.startsWith('too-short')) skippedShort += 1;
      continue;
    }

    let candidateStream;
    try {
      candidateStream = await resolveStream(item.bvid, candidateMeta.cid, qn);
    } catch (err) {
      lastError = String((err && err.message) || err);
      continue;
    }
    if (!candidateStream) {
      lastError = 'no-playable-url';
      continue;
    }

    picked = item;
    meta = candidateMeta;
    stream = candidateStream;
    break;
  }

  if (!picked) {
    return {
      ok: false,
      // 全是十几秒的片段时给个能读懂的原因：界面据此提示「这首歌只有片段」。
      error: skippedShort && skippedShort === attempts.length ? 'only-short-clips' : lastError || 'no-playable-video',
      bvid: best.bvid,
      keyword,
      skippedShort,
      candidates: ranked.slice(0, 6).map(toCandidateDto),
    };
  }

  const pickedEntry = ranked.find((entry) => entry.item.bvid === picked.bvid) || null;

  try {
    await ensureProxyServer();
  } catch {
    /* 代理起不来就只留直链 */
  }

  return {
    ok: true,
    bvid: picked.bvid,
    title: picked.title || meta.title,
    author: picked.author || meta.author,
    cover: thumbCover(picked.pic || meta.cover),
    durationSec: meta.durationSec || parseDuration(picked.duration),
    /** 分P投稿里挑中的是第几 P（1 = 没分P）。界面不显示，报错排查时有用。 */
    page: meta.page,
    score: pickedEntry ? Math.round(pickedEntry.score.total) : null,
    typename: picked.typename || '',
    official: pickedEntry ? pickedEntry.score.official || 0 : 0,
    verify: pickedEntry ? pickedEntry.score.verify || '' : '',
    keyword,
    mode: stream.mode,
    quality: stream.quality,
    sources: buildSources(stream),
    candidates: ranked.slice(0, 6).map(toCandidateDto),
    url: `https://www.bilibili.com/video/${picked.bvid}`,
  };
}

/** 只出候选列表，不取流。用户点「换一个」和改关键词重搜时用。 */
async function searchCandidates(input) {
  const query = String((input && input.query) || '').trim();
  if (!query) return { ok: false, error: 'empty-query' };

  const want = {
    title: query,
    artist: String((input && input.artist) || '').trim(),
    durationMs: 0,
    ignoreCase: true,
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

  await applyVerify(ranked, want);

  return {
    ok: true,
    keyword: query,
    candidates: ranked.slice(0, 8).map(toCandidateDto),
  };
}

/* ------------------------------------------------------------------ *
 * 播放列表缩略图
 *
 * 队列里十几首歌，全都取流既慢又浪费 —— 这里只做「搜一下、拿封面」，
 * 给右侧列表画缩略图用。并发 3，一次最多 8 首。
 * ------------------------------------------------------------------ */

async function previewOne(item) {
  const key = String(item.key || '');
  const want = {
    title: String(item.title || '').trim(),
    artist: String(item.artist || '').trim(),
    durationMs: 0,
    ignoreCase: true,
  };
  if (!want.title) return { key, ok: false, error: 'no-title' };

  const keyword = [want.title, want.artist].filter(Boolean).join(' ');
  let items;
  try {
    items = await searchVideos(keyword);
    // B 站对短时间内的重复搜索会回空列表：等一会儿再问一次，缩略图别留个灰块。
    if (!items.length) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      items = await searchVideos(`${keyword} MV`);
    }
  } catch (err) {
    return { key, ok: false, error: String((err && err.message) || err) };
  }
  if (!items.length) return { key, ok: false, error: 'search-empty' };

  const ranked = rankCandidates(items, want);
  if (!ranked.length) return { key, ok: false, error: 'no-candidate' };

  // 缩略图也要挑一支像样的：短片段沉底之后，优先用第一个「不短」的候选。
  const top = ranked.find((entry) => !entry.score.short) || ranked[0];
  return {
    key,
    ok: true,
    bvid: top.item.bvid,
    cover: thumbCover(top.item.pic),
    author: top.item.author,
    title: top.item.title,
    typename: top.item.typename || '',
    score: Math.round(top.score.total),
    short: Boolean(top.score.short),
  };
}

async function mvPreview(input) {
  const list = Array.isArray(input && input.items) ? input.items.slice(0, 8) : [];
  if (!list.length) return { ok: true, results: [] };

  const results = new Array(list.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      const entry = list[index];
      results[index] = await previewOne(entry || {}).catch((err) => ({
        key: String((entry && entry.key) || ''),
        ok: false,
        error: String((err && err.message) || err),
      }));
    }
  };

  // 4 路并发：8 首歌两轮就完，再多人家的风控会开始回空列表。
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ok: true, results };
}

/* ------------------------------------------------------------------ *
 * 入口
 * ------------------------------------------------------------------ */

module.exports = function activate(runtime) {
  api = runtime;
  const host = (runtime.host && runtime.host.folium) || { major: 1, minor: 0 };
  runtime.log.info(`MV 影院：main 入口已启动（Folium ${host.major}.${host.minor}）`);

  runtime.rpc.handle('resolveMv', async (input) => {
    try {
      return await resolveMv(input || {});
    } catch (err) {
      runtime.log.error('resolveMv 失败', String((err && err.stack) || err));
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  runtime.rpc.handle('searchCandidates', async (input) => {
    try {
      return await searchCandidates(input || {});
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  // 播放列表缩略图：只搜索不取流，快得多。
  runtime.rpc.handle('mvPreview', async (input) => {
    try {
      return await mvPreview(input || {});
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err), results: [] };
    }
  });

  runtime.rpc.handle('biliStatus', async () => {
    try {
      const sess = await getSession(true);
      return {
        ok: true,
        loggedIn: Boolean(sess && sess.loggedIn),
        uname: (sess && sess.uname) || '',
        vip: Boolean(sess && sess.vip),
        hasCookie: Boolean(sess && sess.hasUserCookie),
      };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  runtime.rpc.handle('qrGenerate', async () => {
    try {
      const result = await qrGenerate();
      return { ok: true, url: result.url, key: result.key };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  runtime.rpc.handle('qrPoll', async (key) => {
    try {
      return await qrPoll(String(key || ''));
    } catch (err) {
      return { ok: false, state: 'error', message: String((err && err.message) || err) };
    }
  });

  /** 登出：把 secret 里的 cookie 清掉。 */
  runtime.rpc.handle('signOut', async () => {
    try {
      if (api && api.secrets && typeof api.secrets.set === 'function') {
        await api.secrets.set('cookie', '');
      }
      userCookie = '';
      knownCookie = '';
      userCookieAt = 0;
      session = null;
      sessionAt = 0;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  runtime.onDispose(() => {
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
    session = null;
    sessionAt = 0;
    userCookie = '';
    userCookieAt = 0;
    knownCookie = '';
    api = null;
  });
};

/**
 * 给测试用的几个纯函数（不做网络请求，也不碰宿主）。
 * 宿主只认 module.exports 上的函数本身，多挂一个属性没有副作用。
 */
module.exports.__internal = {
  MIN_MV_SECONDS,
  pickPage,
  thumbCover,
  rankCandidates,
};
