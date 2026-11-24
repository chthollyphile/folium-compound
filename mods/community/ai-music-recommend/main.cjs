// mods/ai-music-recommend/main.cjs
//
// Node half of "AI 推荐音乐"。渲染进程决定「推荐什么场景、要几首、拿到歌怎么处理」；
// 这里只负责一件事情：拿着听歌档案去 OpenAI 兼容接口要一份推荐清单。
//
// 这个模组自己拥有 AI 连接，不读宿主的配置，也不加载宿主的私有模块：
//
//   - 接口地址、模型、温度由渲染进程随每次请求一并带来（模组自己的设置）。
//   - API 密钥放在 Folium 1.7 的 secret 设置字段里，由宿主用 safeStorage 加密保管，
//     这里按需解密读取，密钥本身从不经过 IPC 往返。
//   - 请求走 Electron 的 net.fetch（Chromium 网络栈，跟随系统代理；Node 的全局
//     fetch 会无视它）。主进程发请求也不受渲染进程 CORS 的限制。
//
// 与 lyric-ai-director 相同的传输层结论：这套组合在 Folia 0.7.x 上是被验证过的。

'use strict';

const fs = require('fs');
const path = require('path');

const { readArchiveProfileFrom } = require('./archive.cjs');

const REQUEST_TIMEOUT_MS = 90000;
const MAX_TOKENS = 4096;
const DEFAULT_MODEL = 'gpt-4o-mini';
const MIN_WANT = 1;
const MAX_WANT = 30;
const DEFAULT_WANT = 8;

// 一条推荐在落地前的上限：控制住坏输出不会把 IPC 载荷撑爆。
const MAX_TITLE_CHARS = 120;
const MAX_ARTIST_CHARS = 120;
const MAX_REASON_CHARS = 120;

/* 输出契约写在提示里。刻意不用严格的 JSON Schema：OpenAI 兼容生态的长尾网关
 * 遇到 response_format / 严格 schema 常整单拒绝，所以传输层按需退让（见下面
 * requestCompletion 的重试梯子），这里只靠提示词+宽容解析。 */
const SYSTEM_PROMPT = [
  '你是一位私人音乐推荐助手。用户会给你一份听歌档案：常听歌手、常听歌曲、最近播放（新在前）、跳过记录。',
  '请根据这份档案为用户推荐音乐。',
  '',
  '输出要求：只输出一个 JSON 对象，不要任何解释文字、不要 Markdown 代码块。格式：',
  '{"songs":[{"title":"歌曲名","artist":"歌手名","reason":"推荐理由，20字以内"}]}',
  '',
  '规则：',
  '1. songs 数组的歌曲数量必须等于用户要求的首数，不多不少。',
  '2. title 与 artist 使用官方发布名：中文歌用中文名，外语歌用官方原名；不要带 feat.、/、& 等附加信息。',
  '3. 以用户的口味为基底：优先推荐与常听歌手风格、年代或气质相近的作品，但大多数歌曲应当是用户没听过的探索性推荐；少量（约三分之一）可以是他喜欢歌手的其它作品。',
  '4. 不要推荐「跳过记录」里出现过的歌手的歌，也不要重复「常听歌曲」与「最近播放」里已有的歌。',
  '5. 只推荐能在主流音乐平台搜到的正式发行录音室版本；不要现场版、翻唱、remix、纯音乐 BGM、伴奏。',
  '6. 避开过冷门的网络歌曲和小时长的单曲。',
  '7. reason 用中文，说明这首歌为什么适合这位用户（关联到他档案里的哪个歌手/情绪/场景）。',
  '8. 「用户排除清单」里的歌手和歌曲是用户明确表示不喜欢的，一律不要推荐，也不要推荐与它们高度相似的翻唱/合集版本；清单里的次数是负面反馈的强度，次数多的要特别注意。',
  '9. 「版本偏好」：常听歌曲与常听歌手反映了用户对不同歌手的偏好。同一首歌存在多个歌手的版本（原唱/翻唱/女声版等）时，不要默认推原唱——**在 artist 里明确写上用户更常听的那位歌手**（从常听歌手和常听歌曲里找依据；找不到依据时再考虑原唱）。例如用户常听旺仔小乔，推《沦陷》就写 artist="旺仔小乔" 而不是原唱。这直接影响音源匹配，写错歌手就会放错版本。',
].join('\n');

// ---------------------------------------------------------------- 小工具

const normalizeTemperature = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.8;
  return Math.min(2, Math.max(0, numeric));
};

const clampInt = (value, min, max, fallback) => {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
};

const clip = (text, limit) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
};

const describeFailure = (error, timeoutMs) => {
  const name = String(error?.name ?? '');
  const message = String(error?.message ?? error);
  if (name === 'AbortError' || /abort/i.test(message)) return `请求超时（${Math.round(timeoutMs / 1000)} 秒）`;
  return message;
};

/* `https://host`、`https://host/v1` 与完整端点都归一到 chat/completions。 */
const normalizeChatUrl = (raw) => {
  let url = String(raw ?? '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  /* 先把 query/fragment 切下来再补路径：直接往整串后面接会把
   * `https://host/v1?api-version=x` 变成 `...?api-version=x/v1/chat/completions`
   * （Azure 风格或自建网关常见写法）。 */
  const cut = url.search(/[?#]/);
  const suffix = cut === -1 ? '' : url.slice(cut);
  let path = (cut === -1 ? url : url.slice(0, cut)).replace(/\/+$/, '');
  if (!/\/chat\/completions$/i.test(path)) {
    path = /\/v\d+$/i.test(path) ? `${path}/chat/completions` : `${path}/v1/chat/completions`;
  }
  return `${path}${suffix}`;
};

const extractContentText = (message) => {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  // 有的网关用 content parts 代替字符串回答。
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text ?? ''))
      .filter(Boolean)
      .join('');
  }
  return '';
};

const extractJsonText = (raw) => {
  let text = String(raw ?? '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }
  if (text.startsWith('{') || text.startsWith('[')) return text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text;
};

// ---------------------------------------------------------------- 传输

/* Chromium 的网络栈，用户的系统代理设置对它生效（Node 的全局 fetch 会绕过它）。 */
const httpFetchOf = () => {
  let electron = null;
  try {
    electron = require('electron');
  } catch {
    electron = null;
  }
  if (typeof electron?.net?.fetch === 'function') return electron.net.fetch;
  return typeof fetch === 'function' ? fetch : null;
};

/*
 * 单次请求，带一个为 OpenAI 兼容端点的小怪癖准备的梯子：
 * `response_format` 与 `max_tokens` 都是可选扩展，所以「非鉴权/限额类」的 4xx
 * 会逐个去掉它们重试，而不是让整次推荐失败。
 */
const requestCompletion = async ({ url, apiKey, model, temperature, systemPrompt, sourcePrompt, signal, log, isDisposed, timeoutMs }) => {
  const fetchImpl = httpFetchOf();
  if (!fetchImpl) throw new Error('无法发起网络请求：Electron 的 net.fetch 与全局 fetch 都不可用。');

  /* 停用模组与超时的表现一样（abort），在这里区分开，避免对刚关掉模组的用户
   * 报一句「请求超时」。 */
  const failureOf = (error) => new Error(
    isDisposed?.() ? '模组已停用' : describeFailure(error, timeoutMs),
  );

  const base = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: sourcePrompt },
    ],
    temperature,
    stream: false,
  };

  const attempts = [
    { ...base, response_format: { type: 'json_object' }, max_tokens: MAX_TOKENS },
    { ...base, max_tokens: MAX_TOKENS },
    { ...base },
  ];

  let lastError = null;
  for (let index = 0; index < attempts.length; index += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(attempts[index]),
        signal,
      });
    } catch (error) {
      throw failureOf(error);
    }

    if (response.ok) {
      let data;
      try {
        data = await response.json();
      } catch (error) {
        throw new Error(`AI 返回的不是合法 JSON：${describeFailure(error, timeoutMs)}`);
      }
      const text = extractContentText(data?.choices?.[0]?.message);
      if (!text) {
        const finish = data?.choices?.[0]?.finish_reason;
        throw new Error(
          finish === 'length'
            ? 'AI 的回答被长度上限截断，没留下内容。请换一个更听话的模型。'
            : 'AI 返回的内容是空的。',
        );
      }
      return text;
    }

    const bodyText = await response.text().catch(() => '');
    /* 服务商的错误体会展示给用户，所以不能让它把凭据回显出来。网关有时会在
     * 错误载荷里复读请求头；把密钥（和任何 Bearer token）剥掉再进消息、toast
     * 或日志。 */
    const redact = (text) => String(text)
      .split(apiKey).join('[已隐藏]')
      .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[已隐藏]')
      .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*"?)[^"\s,}]{8,}/gi, '$1[已隐藏]');
    lastError = new Error(`接口返回 ${response.status}：${redact(bodyText).slice(0, 300) || response.statusText}`);
    // 只有那两个可选字段值得退化重试；其余（密钥错、URL 错、限额…）是用户必须看到的真错误。
    const retryable = index < attempts.length - 1 && response.status >= 400 && response.status < 500
      && ![401, 403, 404, 429].includes(response.status);
    if (!retryable) throw lastError;
    log?.warn?.(`接口拒绝了第 ${index + 1} 种请求形态，改用更保守的参数重试`, { status: response.status });
  }
  throw lastError ?? new Error('请求失败');
};

// ---------------------------------------------------------------- 提示词

/* 听歌档案的紧凑摘要：AI 只需要判断口味，不需要完整数据库。 */
const buildSourcePrompt = (digest, want, userNote, dislikes, playlists) => {
  const safe = digest && typeof digest === 'object' ? digest : {};
  const lines = [];

  if (safe.empty) {
    lines.push('（这位用户的听歌档案还是空的。请推荐大众口碑好、接受度高的经典曲目，覆盖几类不同风格。）');
  } else {
    const artists = Array.isArray(safe.topArtists) ? safe.topArtists : [];
    if (artists.length > 0) {
      lines.push('常听歌手（按播放次数，新→旧无关）：');
      artists.forEach((a) => lines.push(`- ${a.name}（${a.plays} 次）`));
    }
    const topSongs = Array.isArray(safe.topSongs) ? safe.topSongs : [];
    if (topSongs.length > 0) {
      lines.push('', '常听歌曲（按播放次数；注意其中的歌手——同一首歌用户反复听哪个版本，就是用户的版本偏好）：');
      topSongs.forEach((s) => lines.push(`- ${s.a ? `${s.a}《${s.t}》` : `《${s.t}》`}${s.p ? `（${s.p} 次）` : ''}`));
    }
    const recent = Array.isArray(safe.recent) ? safe.recent : [];
    if (recent.length > 0) {
      lines.push('', '最近播放（新→旧）：');
      recent.forEach((s) => lines.push(`- ${s.a ? `${s.a}《${s.t}》` : `《${s.t}》`}`));
    }
    const skips = Array.isArray(safe.skips) ? safe.skips : [];
    if (skips.length > 0) {
      lines.push('', '跳过记录（用户快速切掉的歌，是负面信号）：');
      skips.forEach((s) => lines.push(`- ${s.a ? `${s.a}《${s.t}》` : `《${s.t}》`}${s.q ? `（跳过 ${s.q} 次）` : ''}`));
    }
    const tracked = Number(safe.trackedSongs);
    if (Number.isFinite(tracked) && tracked > 0) {
      lines.push('', `档案规模：共记录 ${tracked} 首歌、约 ${safe.totalPlays ?? '?'} 次播放。`);
    }
  }

  if (userNote) lines.push('', `用户的额外偏好（优先满足）：${clip(userNote, 200)}`);

  /* 账号歌单：用户自己整理的收藏，是比外部推荐更强的主动信号。 */
  const playlistSongs = Array.isArray(playlists?.songs) ? playlists.songs.slice(0, 120) : [];
  const playlistNames = Array.isArray(playlists?.names) ? playlists.names.slice(0, 6) : [];
  if (playlistSongs.length > 0) {
    lines.push('', `账号歌单（用户自己收藏的歌${playlistNames.length > 0 ? `，包括「${playlistNames.join('」「')}」` : ''}）：`);
    playlistSongs.forEach((song) => lines.push(`- ${song.artist ? `${clip(song.artist, 120)}《${clip(song.title, 120)}》` : `《${clip(song.title, 120)}》`}`));
    lines.push('', '上面的歌单是用户亲口点过头的口味样本：推荐时优先贴合歌单里出现的歌手和曲风；歌单歌手的其它作品（用户还没听过的）是安全的推荐来源。');
  }

  /* 「不感兴趣」清单：显式排除项，优先级高于口味相似性。 */
  const dislikeList = Array.isArray(dislikes) ? dislikes : [];
  const dislikedArtists = dislikeList.filter((d) => d?.name);
  const dislikedSongs = dislikeList.filter((d) => d?.title);
  if (dislikedArtists.length > 0 || dislikedSongs.length > 0) {
    lines.push('', '用户排除清单（用户明确不喜欢，一律不要推荐，也不要推它们的翻唱/合集版本）：');
    for (const d of dislikedArtists) lines.push(`- 歌手：${clip(d.name, 120)}（标记 ${Number(d.count) || 1} 次）`);
    for (const d of dislikedSongs) lines.push(`- 歌曲：${clip(d.artist, 120)}《${clip(d.title, 120)}》`);
  }

  lines.push('', `请推荐 ${want} 首歌。`);
  return lines.join('\n');
};

/* 解析 AI 的回答：接受 {"songs":[...]} 或裸数组；title 为空的条目丢弃，
 * 字段截断到安全长度。数量交给渲染进程按需截取，这里只做粗筛。 */
const parseSongs = (raw) => {
  let parsed;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch (error) {
    throw new Error(`AI 返回的内容无法解析为 JSON：${String(error?.message || error)}`);
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.songs) ? parsed.songs : null;
  if (!list) throw new Error('AI 返回的 JSON 里没有 songs 列表。');

  const songs = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const title = clip(entry.title ?? entry.name ?? entry.song ?? '', MAX_TITLE_CHARS);
    if (!title) continue;
    songs.push({
      title,
      artist: clip(entry.artist ?? entry.singer ?? '', MAX_ARTIST_CHARS),
      reason: clip(entry.reason ?? '', MAX_REASON_CHARS),
    });
  }
  return songs;
};

// ---------------------------------------------------------------- 听歌档案联动

// 官方模组 listening-archive 的落盘位置：<userData>/mods-data/<id>/files/*.jsonl
// 与安装位置：<userData>/mods/<id>/。只读，不写；文件没变（mtime 没动）就直接
// 用上次的聚合结果。
const ARCHIVE_DATA_DIR = ['mods-data', 'listening-archive', 'files'];
const ARCHIVE_MODS_DIR = ['mods', 'listening-archive'];

const electronAppOf = () => {
  try {
    return require('electron')?.app ?? null;
  } catch {
    return null;
  }
};

const archiveCache = { signature: null, profile: null };

/** 当前日志文件的 mtime 签名；读不到任何文件时返回 null。 */
const archiveSignatureOf = (filesDir) => {
  let names;
  try {
    names = fs.readdirSync(filesDir).filter((name) => name.toLowerCase().endsWith('.jsonl')).sort();
  } catch {
    return null;
  }
  let signature = `${names.length}`;
  let latest = 0;
  for (const name of names) {
    try {
      const mtime = fs.statSync(path.join(filesDir, name)).mtimeMs;
      latest = Math.max(latest, mtime);
    } catch { /* 文件刚好被移走：下一次再见 */ }
  }
  signature += `@${Math.round(latest)}`;
  return signature;
};

const readArchiveProfile = () => {
  const app = electronAppOf();
  const userData = app?.getPath?.('userData');
  if (!userData) return { status: 'unavailable', sessions: 0, songs: 0, plays: 0, topArtists: [], topSongs: [], recent: [], skips: [] };
  const filesDir = path.join(userData, ...ARCHIVE_DATA_DIR);
  const modsDir = path.join(userData, ...ARCHIVE_MODS_DIR);
  const signature = archiveSignatureOf(filesDir);
  if (signature && archiveCache.signature === signature && archiveCache.profile) {
    return archiveCache.profile;
  }
  const profile = readArchiveProfileFrom({ filesDir, modsDir });
  if (profile.status === 'linked' && signature) {
    archiveCache.signature = signature;
    archiveCache.profile = profile;
  } else {
    archiveCache.signature = null;
    archiveCache.profile = null;
  }
  return profile;
};

// ---------------------------------------------------------------- 激活

module.exports = function activate(api) {
  let disposed = false;
  /* 每个还在网络上的请求都挂在集合里：停用/重载时统一掐断，迟到的答案不能
   * 递给已经不在的渲染进程（也省得占着 90 秒的超时窗口）。 */
  const inFlight = new Set();
  api.onDispose(() => {
    disposed = true;
    inFlight.forEach((controller) => {
      try { controller.abort(); } catch { /* 已经 settled */ }
    });
    inFlight.clear();
  });

  const SECRET_KEY = 'apiKey';

  /* 「听歌档案」联动：渲染进程要摘要时实时来读（mtime 缓存兜底），
   * 不在 activate 时就读——安装与否、有没有记录都可能随时变化。 */
  api.rpc.handle('archiveProfile', () => readArchiveProfile());

  api.rpc.handle('recommend', async (payload) => {
    if (disposed) throw new Error('模组已停用');

    const config = payload?.config && typeof payload.config === 'object' ? payload.config : {};
    const url = normalizeChatUrl(config.apiUrl);
    if (!url) {
      throw new Error('还没配置接口地址：请在「模组面板 → AI 推荐音乐」里填写（例如 https://api.openai.com/v1）。');
    }
    const model = String(config.model ?? '').trim() || DEFAULT_MODEL;
    const temperature = normalizeTemperature(config.temperature);
    const want = clampInt(config.want, MIN_WANT, MAX_WANT, DEFAULT_WANT);

    const apiKey = await api.secrets.get(SECRET_KEY);
    if (!apiKey) {
      throw new Error('还没配置密钥：请在「模组面板 → AI 推荐音乐」的「API 密钥」里填写（只保存在本机，加密存放）。');
    }

    const sourcePrompt = buildSourcePrompt(
      payload?.digest,
      want,
      payload?.userNote ?? config.userNote,
      payload?.dislikes,
      { songs: payload?.playlistSongs, names: payload?.playlistNames },
    );

    api.log.info(`请求 AI 推荐（${model}，要 ${want} 首）`);

    const controller = new AbortController();
    inFlight.add(controller);
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let raw;
    try {
      raw = await requestCompletion({
        url,
        apiKey,
        model,
        temperature,
        systemPrompt: SYSTEM_PROMPT,
        sourcePrompt,
        signal: controller.signal,
        log: api.log,
        isDisposed: () => disposed,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
    } finally {
      clearTimeout(timer);
      inFlight.delete(controller);
    }

    const songs = parseSongs(raw);
    if (songs.length === 0) throw new Error('AI 返回的推荐列表是空的。');

    api.log.info(`AI 推荐返回 ${songs.length} 首（要求 ${want} 首）`);
    return { songs };
  });

  api.log.info('AI 推荐音乐：main 入口就绪（secret 设置存密钥，Electron net.fetch 传输）');
};
