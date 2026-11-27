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
const { readStatsProfileFrom } = require('./stats.cjs');

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

// ---------------------------------------------------------------- 验证模式

/* 工具定义：AI 唯一可用的是 search_songs——批量验证「歌手X是否真的唱过歌Y」。
 * checks 数组一次最多提 20 个候选，避免逐首搜索把轮数耗光。也兼容单个
 * title/artist 的旧写法（有的模型会无视数组）。 */
const SEARCH_TOOL = Object.freeze({
  type: 'function',
  function: {
    name: 'search_songs',
    description: '在用户的音乐音源里批量搜索歌曲。用途：推荐前验证「某歌手是否真的唱过某首歌」。**批量提交**：把你当前想推荐的所有候选（歌名+你打算写的歌手版本）放进 checks 数组一次性验证（最多 20 个），而不是逐首搜索——每首歌的验证结果会按相同顺序返回。只有验证结果里出现「该歌手演唱的该歌曲」的候选才允许写进最终结果，未验证通过的换歌或换歌手后再提交一轮验证。',
    parameters: {
      type: 'object',
      properties: {
        checks: {
          type: 'array',
          description: '要验证的候选列表，最多 20 项',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '歌名' },
              artist: { type: 'string', description: '你打算推荐这首歌的哪个歌手的版本' },
            },
            required: ['title', 'artist'],
          },
        },
        title: { type: 'string', description: '（单个候选的快捷写法，与 checks 二选一）歌名' },
        artist: { type: 'string', description: '（单个候选的快捷写法）你打算写的歌手版本' },
        limit: { type: 'integer', description: '每个候选的返回条数上限，默认8' },
      },
    },
  },
});

/* 验证模式的多轮循环。没有 response_format 梯子（工具循环里退避重试会让
 * 上下文混乱），失败直接抛；总轮数（用户可配）与总时长双重上限。 */
const runVerifiedCompletion = async ({ url, apiKey, model, temperature, systemPrompt, sourcePrompt, want, signal, log, isDisposed, search, emit, maxRounds }) => {
  const messages = [
    { role: 'system', content: `${systemPrompt}\n\n【验证模式】你可以使用 search_songs 工具。硬性要求：最终 JSON 里的每一首歌，都必须在早前的工具调用中确认过「该歌手确实唱过这首歌」。没有验证过的歌不允许出现在结果里。如果连续搜索都找不到某歌手的版本，换别的歌手或别的歌。` },
    { role: 'user', content: sourcePrompt },
  ];
  const MAX_ROUNDS = clampInt(maxRounds, 2, 24, 8);
  const say = (text) => { try { emit?.(text); } catch { /* 推送失败不影响生成 */ } log?.info?.(text); };
  say(`开始生成（验证模式，最多 ${MAX_ROUNDS} 轮）`);
  const TOTAL_MS = Math.max(60000, MAX_ROUNDS * 25000);   // 轮数越多总时长越宽
  const startedAt = Date.now();

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (isDisposed?.()) throw new Error('模组已停用');
    if (Date.now() - startedAt > TOTAL_MS) throw new Error(`验证超时（${Math.round(TOTAL_MS / 1000)} 秒内没有完成推荐），请关闭验证模式或减少推荐数量`);
    if (signal?.aborted) throw new Error('模组已停用');
    say(`第 ${round + 1}/${MAX_ROUNDS} 轮：正在思考…`);

    let response;
    try {
      response = await httpFetchOf()(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature, stream: false, tools: [SEARCH_TOOL], tool_choice: 'auto' }),
        signal,
      });
    } catch (error) {
      const name = String(error?.name ?? '');
      const msg = String(error?.message ?? error);
      throw new Error(
        isDisposed?.() ? '模组已停用'
          : (name === 'AbortError' || /abort/i.test(msg)) ? `请求超时（${Math.round(TOTAL_MS / 1000)} 秒上限）`
            : msg,
      );
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      const redact = (t) => String(t).split(apiKey).join('[已隐藏]');
      throw new Error(`接口返回 ${response.status}：${redact(bodyText).slice(0, 300) || response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`AI 返回的不是合法 JSON：${describeFailure(error, 15000)}`);
    }
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];

    if (toolCalls.length === 0) {
      // 收尾：模型给出最终答案
      const text = extractContentText(message);
      if (!text) {
        throw new Error('AI 返回的内容是空的。');
      }
      say(`完成：共 ${Math.round((Date.now() - startedAt) / 1000)} 秒`);
      return text;
    }

    // 工具轮：把每个 tool_call 里的候选展开成搜索任务，并发执行后按原顺序回灌
    messages.push(message);
    for (const call of toolCalls) {
      const fnName = call?.function?.name;
      let args = {};
      try {
        args = JSON.parse(call?.function?.arguments ?? '{}');
      } catch { args = {}; }
      if (fnName !== 'search_songs') {
        messages.push({ role: 'tool', tool_call_id: call?.id ?? '', content: JSON.stringify({ error: '未知工具' }) });
        continue;
      }
      // 候选展开：checks 数组（批量）或单个 title/artist（旧写法兼容）
      let checks = Array.isArray(args?.checks)
        ? args.checks
            .filter((c) => c && typeof c.title === 'string' && c.title.trim())
            .slice(0, 20)
            .map((c) => ({ title: clip(c.title, 120), artist: clip(c.artist, 120) }))
        : [];
      if (checks.length === 0 && typeof args?.title === 'string' && args.title.trim()) {
        checks = [{ title: clip(args.title, 120), artist: clip(args.artist, 120) }];
      }
      if (checks.length === 0) {
        messages.push({ role: 'tool', tool_call_id: call?.id ?? '', content: JSON.stringify({ error: '没有可验证的候选：请传 checks 数组或 title/artist' }) });
        continue;
      }
      const perLimit = clampInt(args?.limit, 1, 12, 8);
      say(`批量验证 ${checks.length} 个候选…`);
      const tSearch = Date.now();
      // 并发搜索（复用渲染进程的并发池语义：这里用简单的分批 Promise）
      const searchOne = async (cand) => {
        const query = cand.artist ? `${cand.title} ${cand.artist}` : cand.title;
        try {
          const items = await search(query, perLimit);
          const slim = (Array.isArray(items) ? items : []).slice(0, 12).map((item) => ({
            title: clip(item?.title, 100),
            artist: clip(item?.artist, 100),
          }));
          say(`「${cand.title}」${slim.length > 0 ? `搜到 ${slim.length} 条` : '没有该歌手的版本'}（${Date.now() - tSearch}ms）`);
          return { query, results: slim, note: slim.length === 0 ? '没有搜到结果：该歌手可能没唱过这首歌，或音源未收录' : '' };
        } catch (error) {
          say(`「${cand.title}」搜索失败：${String(error?.message ?? error).slice(0, 60)}`);
          return { query, results: [], note: '搜索失败，按「未验证通过」处理' };
        }
      };
      // 分 4 路并发，压住 omni 的并发闸门
      const resultsByIndex = new Array(checks.length);
      let nextIdx = 0;
      const worker = async () => {
        while (nextIdx < checks.length) {
          const idx = nextIdx++;
          resultsByIndex[idx] = await searchOne(checks[idx]);
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, checks.length) }, worker));
      // 按候选顺序逐个回灌（每个 tool_call 一条 tool 消息）
      messages.push({
        role: 'tool',
        tool_call_id: call?.id ?? '',
        content: JSON.stringify({ verified: checks.map((c, i) => ({ title: c.title, artist: c.artist, ...resultsByIndex[i] })) }),
      });
    }
  }
  throw new Error(`工具调用轮数达到上限（${MAX_ROUNDS} 轮）还没拿到验证过的推荐；请增加轮数上限或减少推荐数量`);
};

// ---------------------------------------------------------------- 提示词
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

// ---------------------------------------------------------------- 本地听歌统计联动

// 官方（社区）模组 listening-stats 的聚合位置：<userData>/mod-data/listening-stats/
// 只读；文件 mtime 没变就直接用上次的聚合结果。
const STATS_DATA_DIR = ['mod-data', 'listening-stats'];

const statsCache = { signature: null, profile: null };

const statsSignatureOf = (root) => {
  let signature = '';
  let latest = 0;
  let found = 0;
  const inspect = (rel) => {
    try {
      const st = fs.statSync(path.join(root, ...rel));
      found += 1;
      latest = Math.max(latest, Math.round(st.mtimeMs));
    } catch { /* 文件不在：nothing to add */ }
  };
  inspect(['agg.json']);
  inspect(['songs.json']);
  try {
    const eventsDir = path.join(root, 'events');
    for (const name of fs.readdirSync(eventsDir)) {
      if (!name.toLowerCase().endsWith('.ndjson')) continue;
      found += 1;
      try {
        const st = fs.statSync(path.join(eventsDir, name));
        latest = Math.max(latest, Math.round(st.mtimeMs));
      } catch { /* raced */ }
    }
  } catch { /* no events dir */ }
  signature = `${found}@${latest}`;
  return found > 0 ? signature : null;
};

const readStatsProfile = () => {
  const app = electronAppOf();
  const userData = app?.getPath?.('userData');
  if (!userData) return { status: 'unavailable', sessions: 0, songs: 0, plays: 0, topArtists: [], topSongs: [], recent: [], skips: [] };
  const root = path.join(userData, ...STATS_DATA_DIR);
  const signature = statsSignatureOf(root);
  if (signature && statsCache.signature === signature && statsCache.profile) {
    return statsCache.profile;
  }
  const profile = readStatsProfileFrom(userData);
  if (profile.status === 'linked' && signature) {
    statsCache.signature = signature;
    statsCache.profile = profile;
  } else {
    statsCache.signature = null;
    statsCache.profile = null;
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
  api.rpc.handle('statsProfile', () => readStatsProfile());

  // ---------------------------------------------------------------- 工具调用

  /* 「验证后再推」模式（用户可选开启）：AI 用 search_songs 工具在音源里
   * 确认“歌手X真的唱过歌Y”后才采纳，从根上消灭幻觉推荐。
   * 搜索本身只有渲染进程能做（omni 是 client API），所以这里是 main ↔
   * client 的往返：main 经 rpc.send 发搜索请求 → client 执行 omni 搜索 →
   * client 经 rpc.call(tool-search-result) 回填；main 的循环以 Map 挂起等
   * 候。轮数与总时长都有上限，防失控烧 token。 */
  const TOOL_SEARCH_TIMEOUT_MS = 15000;
  const pendingSearches = new Map(); // callId -> { resolve }
  let searchCallSeq = 0;

  api.rpc.handle('tool-search-result', (payload) => {
    const callId = String(payload?.callId ?? '');
    const pending = pendingSearches.get(callId);
    if (!pending) return { ok: false };
    pendingSearches.delete(callId);
    clearTimeout(pending.timer);
    pending.resolve(Array.isArray(payload?.items) ? payload.items : []);
    return { ok: true };
  });

  const askClientSearch = (query, limit) => new Promise((resolve) => {
    if (disposed) { resolve([]); return; }
    const callId = `s${++searchCallSeq}-${Date.now().toString(36)}`;
    const timer = setTimeout(() => {
      pendingSearches.delete(callId);
      resolve([]);
    }, TOOL_SEARCH_TIMEOUT_MS);
    pendingSearches.set(callId, { resolve, timer });
    try {
      api.rpc.send('tool-search-request', { callId, query: String(query ?? '').slice(0, 160), limit: clampInt(limit, 1, 12, 8) });
    } catch {
      clearTimeout(timer);
      pendingSearches.delete(callId);
      resolve([]);
    }
  });

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

    api.log.info(`请求 AI 推荐（${model}，要 ${want} 首${config.useToolCalls ? '，验证模式' : ''}）`);

    const controller = new AbortController();
    inFlight.add(controller);
    let raw;
    try {
      if (config.useToolCalls === true) {
        raw = await runVerifiedCompletion({
          url,
          apiKey,
          model,
          temperature,
          systemPrompt: SYSTEM_PROMPT,
          sourcePrompt,
          want,
          signal: controller.signal,
          log: api.log,
          isDisposed: () => disposed,
          search: askClientSearch,
          maxRounds: config.maxRounds,
          emit: (text) => { try { api.rpc.send('activity-log', { text: String(text).slice(0, 200), at: Date.now() }); } catch { /* 窗口不在了 */ } },
        });
      } else {
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
        }
      }
    } finally {
      inFlight.delete(controller);
    }

    const songs = parseSongs(raw);
    if (songs.length === 0) throw new Error('AI 返回的推荐列表是空的。');

    api.log.info(`AI 推荐返回 ${songs.length} 首（要求 ${want} 首）`);
    return { songs };
  });

  api.log.info('AI 推荐音乐：main 入口就绪（secret 设置存密钥，Electron net.fetch 传输）');
};
