// client.mjs — AI 智能 EQ（Folium 1.7+）
// 单文件构建产物：由 _tools/build-mod.mjs 从 _src/client.mjs + _src/eq.mjs 生成，请勿直接编辑。
// 单文件是为了避开宿主只给入口 URL 加 ?v= 指纹、相对导入被浏览器按 URL 缓存旧模块的问题。

// ======================================================================
// 纯逻辑（源自 _src/eq.mjs）
// ======================================================================
// eq.mjs — AI 智能 EQ 的纯逻辑：供应商预设、端点校验、提示词、解析与曲线归一化。
// 不依赖 DOM / 宿主 API，可以被 client.mjs 和测试脚本直接导入。

/** OpenAI 兼容供应商预设（base 留空时用这里的默认值）。 */
const PRESETS = {
    deepseek: { base: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'DeepSeek' },
    openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI' },
    moonshot: { base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', label: 'Kimi' },
    zhipu: { base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', label: '智谱 GLM' },
    qwen: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', label: '通义千问' },
    doubao: { base: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115', label: '豆包' },
    ollama: { base: 'http://localhost:11434/v1', model: 'qwen2.5:7b', label: 'Ollama（本地）' },
    custom: { base: '', model: '', label: '自定义' },
};

/** strength 档位对应的单段最大增益（dB）。 */
const STRENGTH = { gentle: 3, standard: 6, bold: 9 };

/** 歌词发给模型的字符上限（整首，超出部分截断）。 */
const LYRICS_CHAR_LIMIT = 6000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function presetOf(id) {
    return Object.prototype.hasOwnProperty.call(PRESETS, id) ? PRESETS[id] : PRESETS.custom;
}

/** 合并预设与用户手填：「接口地址 / 模型」留空时用预设值。 */
function resolveProvider(cfg) {
    const preset = presetOf(String((cfg && cfg.provider) || 'custom'));
    const base = String((cfg && cfg.baseUrl) || '').trim() || preset.base;
    const model = String((cfg && cfg.model) || '').trim() || preset.model;
    return { base, model, presetId: String((cfg && cfg.provider) || 'custom') };
}

/**
 * 校验并补全 OpenAI 兼容接口地址。
 * 只允许 HTTPS；localhost / 127.0.0.1 / ::1 允许 HTTP（本地 Ollama 之类）。
 * 返回 { url, isLocal } 或 { error }；有 error 时调用方必须停止请求，不发送密钥。
 */
function validateEndpoint(base) {
    const raw = String(base || '').trim();
    if (!raw) return { error: '未配置接口地址，请选择服务商预设或手填地址' };
    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        return { error: '接口地址不是合法的 URL，请填写完整地址（如 https://api.deepseek.com）' };
    }
    if (url.username || url.password) return { error: '接口地址不能包含用户名或密码' };
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLocal = LOCAL_HOSTS.has(hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
        return { error: '接口地址必须使用 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP，未发送请求' };
    }
    url.search = '';
    url.hash = '';
    const path = url.pathname.replace(/\/+$/, '');
    if (!path.endsWith('/chat/completions')) url.pathname = `${path}/chat/completions`;
    return { url: url.toString(), isLocal };
}

function frequencyText(hz) {
    const f = Number(hz);
    if (!Number.isFinite(f)) return '?';
    if (f >= 1000) {
        const k = f / 1000;
        return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
    }
    return String(Math.round(f));
}

/** 频段在听感上大致对应什么，写进提示词也用于界面展示。 */
function bandLabel(hz, shape) {
    const f = Number(hz);
    if (shape === 'lowshelf') return '超低频 / 低频下潜';
    if (shape === 'highshelf') return '超高频 / 空气感';
    if (!Number.isFinite(f)) return '未知频段';
    if (f < 100) return '低频（鼓、贝斯）';
    if (f < 300) return '中低频（厚度）';
    if (f < 900) return '中频（人声基音）';
    if (f < 3000) return '中高频（人声清晰度）';
    if (f < 6000) return '高频（齿音）';
    if (f < 12000) return '高频（亮度）';
    return '超高频（空气感）';
}

/** 把宿主均衡器的 bands 变成提示词里的频段表。 */
function bandTable(bands) {
    return (Array.isArray(bands) ? bands : [])
        .map((band, index) => {
            const hz = frequencyText(band && band.frequency);
            return `${index + 1}. ${hz}Hz（${bandLabel(band && band.frequency, band && band.shape)}）`;
        })
        .join('\n');
}

function maxAbsFor(strength) {
    return STRENGTH[String(strength)] || STRENGTH.standard;
}

function strengthAdvice(maxAbs) {
    if (maxAbs <= 3) return '本次要求非常克制：只做微调，单段不要超过 ±3 dB，多数频段应为 0。';
    if (maxAbs >= 9) return '本次允许明显调整：单段可以到 ±9 dB，但仍然要避免把相邻频段拉成锯齿。';
    return '本次要求适度：单段不要超过 ±6 dB，优先处理最影响听感的 1–2 个问题。';
}

function trimChars(value, max) {
    return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

/** 容忍模型把数组写成「A、B、C」字符串。 */
function toTextList(value, maxItems, maxCharsPerItem) {
    let items = [];
    if (Array.isArray(value)) {
        items = value;
    } else if (typeof value === 'string') {
        items = value.split(/[,，、/|；;]+/);
    }
    const out = [];
    for (const item of items) {
        if (typeof item !== 'string' && typeof item !== 'number') continue;
        const text = String(item).trim().slice(0, maxCharsPerItem);
        if (text && !out.includes(text)) out.push(text);
        if (out.length >= maxItems) break;
    }
    return out;
}

function toNumberList(value, maxItems) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
        const number = Number(item);
        if (!Number.isFinite(number)) continue;
        out.push(Math.min(1, Math.max(0, round2(number))));
        if (out.length >= maxItems) break;
    }
    return out;
}

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function tasteLines(profile) {
    if (!profile) return [];
    const lines = [];
    const up = Array.isArray(profile.up) ? profile.up : [];
    const down = Array.isArray(profile.down) ? profile.down : [];
    const modes = Array.isArray(profile.modes) ? profile.modes : [];
    const similar = Array.isArray(profile.similar) ? profile.similar : [];
    if (up.length) lines.push(`用户喜欢的标签：${up.map((item) => `${item.tag}×${item.count}`).join('、')}`);
    if (down.length) lines.push(`用户不喜欢的标签：${down.map((item) => `${item.tag}×${item.count}`).join('、')}`);
    if (modes.length) lines.push(`用户常手动切到的音效：${modes.map((item) => `${item.label}×${item.count}`).join('、')}`);
    if (similar.length) {
        lines.push(`气质相近歌曲的反馈：${similar.map((item) => {
            const tags = Array.isArray(item.tags) && item.tags.length ? `（${item.tags.join('、')}）` : '';
            return `《${item.title}》${item.value > 0 ? '👍' : '👎'}${tags}`;
        }).join('；')}`);
    }
    return lines;
}

/**
 * 组装 chat/completions 的 system / user 消息。
 * bands 直接来自宿主均衡器，保证频段表与实际听到的一致（未来段数变化也兼容）。
 * lyrics 是整首歌词（调用方已按字符上限截断）；profile 是历史口味与相似歌曲反馈。
 */
function buildMessages({ song, bands, strength, taste, lyrics, genre, profile }) {
    const list = Array.isArray(bands) && bands.length ? bands : [];
    const count = list.length || 10;
    const maxAbs = maxAbsFor(strength);
    const title = String((song && song.title) || '未知歌曲');
    const artist = String((song && song.artist) || '未知歌手');
    const album = song && song.album ? String(song.album) : '';
    const tasteText = String(taste || '').trim();
    const genreText = String(genre || '').trim().slice(0, 40);
    const lyricText = String(lyrics || '').trim().slice(0, LYRICS_CHAR_LIMIT);
    const profileText = tasteLines(profile);

    const system = [
        '你是一位同时做音乐企划与母带调音的资深制作人：既能为歌曲写出简洁的资料简报，也能给出适合这首歌的 EQ 曲线。',
        '用户会给你歌曲信息、整首歌词（可能为空）以及他的听感偏好和历史反馈。',
        '',
        '只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释文字。JSON 格式：',
        '{"genre":"曲风","summary":"一句话概括","emotion":["情绪"],"tags":["风格标签"],"imagery":["意象"],"energy":[0.2,0.5,0.8,0.4],"reason":"不超过30个字的EQ说明","curve":[0,0,0,0,0,0,0,0,0,0],"confidence":0.8}',
        '',
        '规则：',
        `1) 先读完整首歌的歌词，再写简报：summary 用一句话概括这首歌在唱什么、什么气质（不超过 40 字）；emotion 是 1–4 个情绪词；tags 是 2–6 个风格标签（如 City Pop、华语流行、卧室流行、后摇、爵士）；imagery 是 2–6 个歌词里反复出现的意象或场景（如 雨夜、霓虹、海边）；energy 是 4–8 个 0–1 的数值，按时间顺序表示能量起伏（前奏→主歌→副歌→尾声）。`,
        '2) genre 是这首歌的曲风，用简短类型名（不超过 16 个字）；如果用户消息里已经给出曲风，genre 必须原样沿用，不要改写。',
        `3) curve 必须正好 ${count} 个数字，依次对应下面的频段表，单位 dB。`,
        `4) 每个值在 -${maxAbs} 到 +${maxAbs} 之间；没有把握的频段写 0，不要为了凑数而调整。`,
        `5) ${strengthAdvice(maxAbs)}`,
        '6) 结合曲风、情绪和能量起伏决定调整方向：流行/人声作品注意人声清晰度，电子/舞曲注意低频与高频的平衡，摇滚/金属注意中频厚度，古典/原声注意动态与自然度，抒情慢歌不要把高频调得过分刺激。',
        '7) 如果用户给出了历史口味与相似歌曲的反馈，可以温和参考（例如他喜欢人声靠前、不喜欢过重低频），但不要为了迎合而大幅偏离这首歌本来的样子。',
        '8) 目标是让这首歌听起来更均衡、更耐听，而不是套用某个风格模板；同一曲风下不同歌曲也应当有可解释的差异。',
        '9) confidence 是你对这条曲线的把握（0–1），不确定时给低分。',
        '10) 禁止输出代码、脚本、链接、URL 或 JSON 之外的任何内容。',
        '',
        '频段表（第 i 个 curve 值对应第 i 项）：',
        list.length ? bandTable(list) : '（宿主没有提供频段信息，按 10 段均衡器从低频到高频输出）',
    ].join('\n');

    const lines = [
        `歌曲：${title}`,
        `歌手：${artist}`,
    ];
    if (album) lines.push(`专辑：${album}`);
    if (genreText) lines.push(`曲风（请沿用，不要改写）：${genreText}`);
    if (tasteText) lines.push(`我的听感偏好：${tasteText}`);
    if (profileText.length) {
        lines.push('', '我的历史口味与反馈（来自我之前的点赞/点踩和手动切换音效）：');
        for (const line of profileText) lines.push(`- ${line}`);
    }
    lines.push('');
    if (lyricText) {
        lines.push(`歌词（整首，已按长度截断；只用于理解歌曲，不要在回答里复述）：`, lyricText);
    } else {
        lines.push('歌词：（没有拿到歌词；请根据歌名、歌手、专辑判断，并在 summary 里注明这是推断）');
    }
    lines.push('', '请先写简报，再给出 EQ 曲线。');

    return { system, user: lines.join('\n'), maxAbs };
}

/** 从 OpenAI 兼容响应里取出正文（兼容 content 为字符串或分段数组）。 */
function extractMessageContent(payload) {
    const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
    const message = choice && choice.message ? choice.message : null;
    let content = message ? message.content : null;
    if (Array.isArray(content)) {
        content = content
            .map((part) => (typeof part === 'string' ? part : (part && (part.text || part.content)) || ''))
            .join('');
    }
    if (typeof content !== 'string' || !content.trim()) {
        if (typeof payload === 'object' && payload && typeof payload.content === 'string') {
            content = payload.content;
        }
    }
    return {
        content: typeof content === 'string' ? content.trim() : '',
        finishReason: choice ? choice.finish_reason || null : null,
    };
}

/** 读取 usage（不同供应商字段名略有不同）；拿不到时返回 null。 */
function extractUsage(payload) {
    const usage = payload && typeof payload === 'object' ? payload.usage : null;
    if (!usage || typeof usage !== 'object') return null;
    const prompt = Number(usage.prompt_tokens !== undefined ? usage.prompt_tokens : usage.input_tokens);
    const completion = Number(usage.completion_tokens !== undefined ? usage.completion_tokens : usage.output_tokens);
    const total = Number(usage.total_tokens);
    const promptOk = Number.isFinite(prompt) && prompt >= 0;
    const completionOk = Number.isFinite(completion) && completion >= 0;
    if (!promptOk && !completionOk) return null;
    const promptTokens = promptOk ? Math.round(prompt) : 0;
    const completionTokens = completionOk ? Math.round(completion) : 0;
    return {
        prompt: promptTokens,
        completion: completionTokens,
        total: Number.isFinite(total) && total >= 0 ? Math.round(total) : promptTokens + completionTokens,
    };
}

/**
 * 解析模型输出为 { genre, brief, reason, curve, confidence } 或 { error }。
 * brief 允许缺字段（模型偶尔会漏），缺到没有内容时返回 null，但不影响 EQ 曲线。
 */
function parseCurvePayload(content) {
    const text = String(content || '').trim();
    if (!text) return { error: '模型返回了空内容' };
    const clean = text.replace(/```[a-zA-Z]*/g, '').replace(/```/g, '').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first < 0 || last <= first) return { error: '模型返回的内容不是 JSON' };
    let obj;
    try {
        obj = JSON.parse(clean.slice(first, last + 1));
    } catch (_) {
        return { error: '模型返回的 JSON 解析失败' };
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: '模型返回的 JSON 顶层不是对象' };
    const raw = obj.curve !== undefined ? obj.curve
        : obj.gains !== undefined ? obj.gains
            : obj.eq !== undefined ? obj.eq : obj.bands;
    if (!Array.isArray(raw)) return { error: '模型返回里缺少 curve 数组' };
    const reason = typeof obj.reason === 'string' ? obj.reason.trim().slice(0, 120) : '';
    const genre = trimChars(typeof obj.genre === 'string' ? obj.genre : obj.style, 32);
    const summaryRaw = obj.summary !== undefined ? obj.summary : obj.oneLine;
    const summary = Array.isArray(summaryRaw)
        ? toTextList(summaryRaw, 1, 80).join('')
        : trimChars(summaryRaw, 80);
    const brief = {
        summary,
        emotion: toTextList(obj.emotion !== undefined ? obj.emotion : obj.emotions, 6, 12),
        tags: toTextList(obj.tags !== undefined ? obj.tags : obj.styleTags, 8, 20),
        imagery: toTextList(obj.imagery !== undefined ? obj.imagery : obj.images, 8, 20),
        energy: toNumberList(obj.energy !== undefined ? obj.energy : obj.energyCurve, 12),
    };
    const hasBrief = !!(brief.summary || brief.emotion.length || brief.tags.length || brief.imagery.length || brief.energy.length >= 2);
    let confidence = Number(obj.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.6;
    if (confidence < 0) confidence = 0;
    if (confidence > 1) confidence = 1;
    return { genre, brief: hasBrief ? brief : null, reason, curve: raw, confidence };
}

/**
 * 把模型给的曲线变成可以安全交给宿主的值：段数对齐、限幅、限斜率、保留 0.1 dB。
 * 返回 { curve, peak, clamped, smoothed, noop } 或 { error }。
 */
function normalizeCurve(raw, { bands, minGain, maxGain, maxAbs } = {}) {
    const list = Array.isArray(bands) && bands.length ? bands : null;
    const count = list ? list.length : 10;
    const src = Array.isArray(raw) ? raw : (raw === null || raw === undefined ? [] : [raw]);
    if (!src.length) return { error: '模型给的 curve 是空的' };
    if (src.length > count) return { error: `模型给了 ${src.length} 段，超过均衡器的 ${count} 段` };

    const max = Number.isFinite(maxAbs) && maxAbs > 0 ? maxAbs : 6;
    const hostMin = Number.isFinite(minGain) ? minGain : -12;
    const hostMax = Number.isFinite(maxGain) ? maxGain : 12;
    const lo = Math.max(hostMin, -max);
    const hi = Math.min(hostMax, max);

    const curve = [];
    for (let i = 0; i < count; i += 1) {
        const value = Number(src[i] === undefined ? 0 : src[i]);
        if (!Number.isFinite(value)) return { error: `第 ${i + 1} 段不是有效数字` };
        curve.push(value);
    }

    let clamped = false;
    let work = curve.map((value) => {
        const next = Math.min(hi, Math.max(lo, value));
        if (Math.abs(next - value) > 1e-6) clamped = true;
        return round1(next);
    });

    // 相邻段落差过大听起来像“锯齿”：限制到每步 3 dB，再限幅一次。
    let smoothed = false;
    const maxStep = 3;
    for (let pass = 0; pass < 2; pass += 1) {
        let changed = false;
        for (let i = 1; i < work.length; i += 1) {
            const prev = work[i - 1];
            const limitHi = prev + maxStep;
            const limitLo = prev - maxStep;
            if (work[i] > limitHi) { work[i] = round1(limitHi); changed = true; }
            else if (work[i] < limitLo) { work[i] = round1(limitLo); changed = true; }
        }
        if (changed) {
            smoothed = true;
            work = work.map((value) => round1(Math.min(hi, Math.max(lo, value))));
        } else {
            break;
        }
    }

    const peak = work.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
    return { curve: work, peak, clamped, smoothed, noop: peak < 0.2 };
}

function round1(value) {
    const number = Number(value) || 0;
    const sign = number < 0 ? -1 : 1;
    return (sign * Math.round(Math.abs(number) * 10)) / 10;
}

function formatDb(value) {
    const v = round1(Number(value) || 0);
    if (v === 0) return '0';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}

function hash32(input) {
    const text = String(input || '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** 配置指纹：换模型 / 强度 / 偏好 / 歌词开关后缓存自动失效。 */
function settingsFingerprint(cfg, bandCount) {
    const c = cfg || {};
    const parts = [
        String(c.provider || ''),
        String(c.baseUrl || ''),
        String(c.model || ''),
        String(c.strength || ''),
        String(c.taste || ''),
        c.useLyrics === false ? 'no-lyrics' : 'lyrics',
        String(bandCount || ''),
    ];
    return hash32(parts.join('\u0001'));
}

/**
 * 歌曲的稳定身份（不含配置指纹）：用于保存「这首歌的曲风/简报/反馈/统计」这类跨配置复用的数据。
 * 有 id 时用 source + id，没有 id 时退回标题 + 歌手。
 */
function songIdentity(song) {
    if (!song) return '';
    if (song.id) return `${normalizeText(song.source)}:${normalizeText(song.id)}`;
    return `t:${normalizeText(song.title)}|${normalizeText(song.artist)}`;
}

/** 歌曲缓存键：歌曲身份前面加上配置指纹，换模型 / 强度 / 偏好后自动失效。 */
function cacheKeyFor(song, fingerprint) {
    if (!song) return '';
    return `${String(fingerprint || '')}|${songIdentity(song)}`;
}

function songTitle(song) {
    if (!song) return '';
    const title = String(song.title || '').trim();
    const artist = String(song.artist || '').trim();
    if (!title) return artist;
    return artist ? `${title} — ${artist}` : title;
}

// ======================================================================
// 宿主交互（源自 _src/client.mjs）
// ======================================================================
// client.mjs — AI 智能 EQ（Folium 1.7+）
// 换歌时把歌名/歌手/整首歌词发给云端大模型，拿回「歌曲简报」（一句话、情绪、风格标签、意象、能量起伏）
// 和一条 10 段 EQ 曲线，经校验、限幅、限斜率后写入宿主均衡器；失败静默、用户改过音效就让位。
// 记忆：每首歌的简报/曲线/调用量按歌缓存，听过的歌直接套用、不再请求；口味学习参考你的 👍/👎 与手动切换。
//
// 宿主接口：folium.equalizer（写需 equalizer.control）、folium.secrets（API 密钥）、
// folium.net.fetch（需 net.fetch）、folium.storage（缓存/口味/统计，需 filesystem.data）、folium.lyrics。

const CACHE_STORAGE_KEY = 'aieq-cache-v1';
const GENRES_STORAGE_KEY = 'aieq-genres-v1';
const TASTE_STORAGE_KEY = 'aieq-taste-v1';
const STATS_STORAGE_KEY = 'aieq-stats-v1';
const CACHE_MAX_ENTRIES = 400;
const CACHE_MAX_CHARS = 420000;
const GENRE_MAX_ENTRIES = 800;
const TASTE_MAX_RATINGS = 500;
const STATS_MAX_SONGS = 500;
const REQUEST_TIMEOUT_MS = 45000;

/**
 * 时间参数集中在这里：正式运行时用默认值；测试会把它调小以加快用例。
 * （导出只是为了测试可以注入，正常运行时不应修改。）
 */
export const TUNING = {
    requestGap: 1500,
    writeGap: 1100,
    saveDebounce: 1200,
    bootDelay: 700,
    generateDelay: 400,
};

const FALLBACK_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map((frequency, index, all) => ({
    frequency,
    shape: index === 0 ? 'lowshelf' : index === all.length - 1 ? 'highshelf' : 'peaking',
}));

const PRESET_NAMES = { flat: '水平', lofi: 'Lo-Fi', radio: '收音机', hall: '大厅', vocal: '人声', bass: '低音增强' };

const SETTINGS = [
    {
        key: 'apiKey',
        type: 'secret',
        label: { 'zh-CN': 'API 密钥', en: 'API key' },
        description: {
            'zh-CN': '只保存在本机系统凭据库里（Windows 走 DPAPI），不进入日志、设置值或视觉配置导出。',
            en: 'Kept in the OS credential store only; never logged or exported.',
        },
    },
    {
        key: 'provider',
        type: 'select',
        label: { 'zh-CN': '服务商', en: 'Provider' },
        defaultValue: 'deepseek',
        options: Object.keys(PRESETS).map((id) => ({ value: id, label: { 'zh-CN': PRESETS[id].label, en: PRESETS[id].label } })),
    },
    {
        key: 'baseUrl',
        type: 'text',
        label: { 'zh-CN': '接口地址（可留空）', en: 'Base URL (optional)' },
        description: {
            'zh-CN': '留空用服务商预设；只允许 HTTPS，localhost / 127.0.0.1 / ::1 允许 HTTP。会自动补 /chat/completions。',
            en: 'Empty uses the provider preset. HTTPS only; localhost may use HTTP. /chat/completions is appended automatically.',
        },
        defaultValue: '',
        placeholder: 'https://api.deepseek.com',
    },
    {
        key: 'model',
        type: 'text',
        label: { 'zh-CN': '模型（可留空）', en: 'Model (optional)' },
        description: { 'zh-CN': '留空用服务商预设模型，例如 deepseek-chat。', en: 'Empty uses the provider preset model.' },
        defaultValue: '',
        placeholder: 'deepseek-chat',
    },
    {
        key: 'jsonMode',
        type: 'boolean',
        label: { 'zh-CN': '要求 JSON 输出', en: 'Request JSON output' },
        description: {
            'zh-CN': '开启后请求 response_format=json_object；不支持的服务商会自动回退重试一次。',
            en: 'Sends response_format=json_object; providers that reject it are retried once without it.',
        },
        defaultValue: true,
    },
    {
        key: 'strength',
        type: 'select',
        label: { 'zh-CN': '调整强度', en: 'Strength' },
        defaultValue: 'standard',
        options: [
            { value: 'gentle', label: { 'zh-CN': '温和（±3 dB）', en: 'Gentle (±3 dB)' } },
            { value: 'standard', label: { 'zh-CN': '标准（±6 dB）', en: 'Standard (±6 dB)' } },
            { value: 'bold', label: { 'zh-CN': '明显（±9 dB）', en: 'Bold (±9 dB)' } },
        ],
    },
    {
        key: 'taste',
        type: 'text',
        label: { 'zh-CN': '我的听感偏好（可选）', en: 'My taste (optional)' },
        description: {
            'zh-CN': '例如「耳机偏低频，希望人声靠前一点」，会一起发给模型。',
            en: 'E.g. “my headphones are bass-heavy, bring vocals forward”. Sent to the model.',
        },
        defaultValue: '',
        placeholder: '耳机偏低频，希望人声靠前',
    },
    {
        key: 'useLyrics',
        type: 'boolean',
        label: { 'zh-CN': '发送整首歌词', en: 'Send full lyrics' },
        description: {
            'zh-CN': '默认开启：把当前歌词（最多 6000 字）用于生成简报。关闭后只用歌名/歌手/专辑，简报会粗糙一些。',
            en: 'On by default: up to 6,000 characters of lyrics are sent to write the brief. Off sends metadata only.',
        },
        defaultValue: true,
    },
    {
        key: 'priceIn',
        type: 'number',
        label: { 'zh-CN': '输入价格（元 / 百万 tokens）', en: 'Input price (CNY / 1M tokens)' },
        description: { 'zh-CN': '只用于估算花费，按你的服务商价目填写。', en: 'Used only to estimate cost.' },
        defaultValue: 2,
        min: 0,
        max: 10000,
        step: 0.01,
    },
    {
        key: 'priceOut',
        type: 'number',
        label: { 'zh-CN': '输出价格（元 / 百万 tokens）', en: 'Output price (CNY / 1M tokens)' },
        description: { 'zh-CN': '只用于估算花费，按你的服务商价目填写。', en: 'Used only to estimate cost.' },
        defaultValue: 8,
        min: 0,
        max: 10000,
        step: 0.01,
    },
    {
        key: 'autoApply',
        type: 'boolean',
        label: { 'zh-CN': '换歌时自动施加', en: 'Apply on song change' },
        description: {
            'zh-CN': '关闭后只在你点击「生成」时请求。你自己在音效面板改过音效后，这里会自动关闭。',
            en: 'When off, curves are requested only from the Generate button.',
        },
        defaultValue: true,
    },
    {
        key: 'notify',
        type: 'boolean',
        label: { 'zh-CN': '施加后提示', en: 'Toast when applied' },
        defaultValue: true,
    },
    {
        key: 'cacheDays',
        type: 'select',
        label: { 'zh-CN': '记忆有效期', en: 'Memory TTL' },
        description: { 'zh-CN': '听过的歌在这个期限内直接套用，不再调用 AI。', en: 'Songs are reused from memory within this window.' },
        defaultValue: '30',
        options: [
            { value: '7', label: { 'zh-CN': '7 天', en: '7 days' } },
            { value: '30', label: { 'zh-CN': '30 天', en: '30 days' } },
            { value: '90', label: { 'zh-CN': '90 天', en: '90 days' } },
            { value: '3650', label: { 'zh-CN': '长期', en: 'Long' } },
        ],
    },
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function activate(folium) {
    const minor = Number(folium && folium.host && folium.host.folium && folium.host.folium.minor) || 0;
    if (minor < 7) {
        folium.log.warn('AI 智能 EQ 需要 Folium 1.7 及以上（folium.equalizer / 密钥字段）');
        return undefined;
    }
    if (!folium.env || folium.env.context !== 'main') return undefined;

    let uiEn = false;
    const tr = (zh, enText) => (uiEn ? enText : zh);

    const state = {
        disposed: false,
        cache: new Map(),
        cacheLoaded: false,
        saveTimer: null,
        genres: new Map(),
        genresSaveTimer: null,
        taste: { ratings: {}, tags: {}, modes: {}, up: 0, down: 0, takeovers: 0 },
        tasteSaveTimer: null,
        stats: { calls: 0, promptTokens: 0, completionTokens: 0, cost: 0, bySong: {} },
        statsSaveTimer: null,
        song: null,
        key: '',
        last: null,
        error: '',
        inflight: new Map(),
        pendingApply: null,
        retryTimer: null,
        generateTimer: null,
        userTookOver: false,
        hintedDisabled: false,
        lastWriteAt: 0,
        lastRequestAt: 0,
        apiKeyPresent: null,
        busy: false,
        renderers: new Set(),
    };

    const section = folium.registries.settingsSections.register({
        id: 'eq',
        label: { 'zh-CN': 'AI 智能 EQ', en: 'AI EQ' },
        description: {
            'zh-CN': '播放歌曲时把歌名、歌手和整首歌词发给大模型，生成「歌曲简报」（一句话、情绪、风格标签、意象、能量起伏）和一条 10 段均衡器曲线；听过的歌直接套用不再调用 AI。你在面板里的 👍/👎 和手动切换音效会被记成口味，之后的请求会参考。API 密钥用系统凭据库保存。',
            en: 'Song metadata and full lyrics go to your AI provider to write a brief (summary, emotion, tags, imagery, energy arc) and a 10-band EQ curve. Songs already analysed are reused without a new call; your 👍/👎 and manual sound changes teach the taste profile.',
        },
        settings: SETTINGS,
        settingsPanel: (container, ctx) => mountPanel(container, ctx),
    });

    function cfg() {
        try {
            return section.settings.get() || {};
        } catch (error) {
            folium.log.warn('[ai-eq] 读取设置失败', String((error && error.message) || error));
            return {};
        }
    }

    function refreshKeyState() {
        Promise.resolve()
            .then(() => folium.secrets.has('apiKey'))
            .then((has) => {
                state.apiKeyPresent = has === true;
                renderAll();
            })
            .catch(() => { /* 密钥存储不可用时按「没有密钥」处理 */ });
    }

    refreshKeyState();
    try {
        folium.secrets.subscribe((key) => {
            if (!key || key === 'apiKey') refreshKeyState();
        });
    } catch (_) { /* 旧宿主没有 subscribe */ }
    try {
        section.settings.onChange(() => {
            if (state.song) state.key = keyFor(state.song);
            renderAll();
        });
    } catch (_) { /* 忽略 */ }

    function eqState() {
        try {
            return folium.equalizer.getState();
        } catch (error) {
            folium.log.warn('[ai-eq] 读取均衡器失败', String((error && error.message) || error));
            return null;
        }
    }

    function bands() {
        const snapshot = eqState();
        if (snapshot && Array.isArray(snapshot.bands) && snapshot.bands.length) return snapshot.bands;
        return FALLBACK_BANDS;
    }

    function keyFor(song) {
        return cacheKeyFor(song, settingsFingerprint(cfg(), bands().length));
    }

    function toast(message, type) {
        try {
            folium.ui.toast(String(message), { type: type || 'info', durationMs: 3600 });
        } catch (_) {
            folium.log.info('[ai-eq] ' + message);
        }
    }

    function renderAll() {
        for (const render of [...state.renderers]) {
            try {
                render();
            } catch (error) {
                folium.log.warn('[ai-eq] 界面刷新失败', String((error && error.message) || error));
            }
        }
    }

    // ---------------------------------------------------------------- 缓存（每首歌的简报 + 曲线）

    function ttlMs() {
        const days = Number(cfg().cacheDays);
        return (Number.isFinite(days) ? days : 30) * 86400000;
    }

    function cacheGet(key) {
        if (!key) return null;
        const entry = state.cache.get(key);
        if (!entry) return null;
        if (entry.at && Date.now() - entry.at > ttlMs()) {
            state.cache.delete(key);
            saveCacheSoon();
            return null;
        }
        return entry;
    }

    function cacheSet(key, entry) {
        if (!key) return;
        state.cache.set(key, {
            curve: Array.isArray(entry.curve) ? entry.curve.slice() : [],
            reason: String(entry.reason || ''),
            confidence: Number(entry.confidence) || 0.6,
            model: String(entry.model || ''),
            genre: String(entry.genre || '').slice(0, 32),
            brief: entry.brief || null,
            usage: entry.usage || null,
            at: Number(entry.at) || Date.now(),
        });
        trimCache();
        saveCacheSoon();
    }

    function trimCache() {
        if (state.cache.size <= CACHE_MAX_ENTRIES) return;
        const kept = [...state.cache.entries()]
            .sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0))
            .slice(0, CACHE_MAX_ENTRIES);
        state.cache = new Map(kept);
    }

    async function loadCache() {
        try {
            const raw = await folium.storage.get(CACHE_STORAGE_KEY);
            const entries = raw && raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
            for (const [key, value] of Object.entries(entries)) {
                if (!value || !Array.isArray(value.curve)) continue;
                const curve = value.curve.map((item) => Number(item));
                if (!curve.length || curve.some((item) => !Number.isFinite(item))) continue;
                state.cache.set(key, {
                    curve,
                    reason: String(value.reason || ''),
                    confidence: Number(value.confidence) || 0.6,
                    model: String(value.model || ''),
                    genre: String(value.genre || '').slice(0, 32),
                    brief: value.brief && typeof value.brief === 'object' ? value.brief : null,
                    usage: value.usage && typeof value.usage === 'object' ? value.usage : null,
                    at: Number(value.at) || 0,
                });
                // 旧缓存里带的曲风也回填到曲风表，下一次请求直接当已知曲风发出去。
                const split = key.indexOf('|');
                const identity = split >= 0 ? key.slice(split + 1) : '';
                if (identity && value.genre && !state.genres.has(identity)) {
                    state.genres.set(identity, String(value.genre).trim().slice(0, 32));
                }
            }
            trimCache();
        } catch (error) {
            folium.log.warn('[ai-eq] 读取缓存失败', String((error && error.message) || error));
        }
        state.cacheLoaded = true;
        renderAll();
    }

    function saveCacheSoon() {
        if (state.disposed || state.saveTimer) return;
        state.saveTimer = setTimeout(() => {
            state.saveTimer = null;
            void persistCache();
        }, TUNING.saveDebounce);
    }

    async function persistCache() {
        try {
            let entries = Object.fromEntries(state.cache);
            let payload = { v: 2, entries };
            let text = JSON.stringify(payload);
            if (text.length > CACHE_MAX_CHARS) {
                const kept = [...state.cache.entries()]
                    .sort((a, b) => (Number(b[1].at) || 0) - (Number(a[1].at) || 0))
                    .slice(0, 120);
                state.cache = new Map(kept);
                entries = Object.fromEntries(kept);
                payload = { v: 2, entries };
                text = JSON.stringify(payload);
            }
            await folium.storage.set(CACHE_STORAGE_KEY, payload);
        } catch (error) {
            folium.log.warn('[ai-eq] 写入缓存失败', String((error && error.message) || error));
        }
    }

    // ---------------------------------------------------------------- 曲风

    function trimGenres() {
        if (state.genres.size <= GENRE_MAX_ENTRIES) return;
        state.genres = new Map([...state.genres.entries()].slice(-GENRE_MAX_ENTRIES));
    }

    async function loadGenres() {
        try {
            const raw = await folium.storage.get(GENRES_STORAGE_KEY);
            const entries = raw && raw.entries && typeof raw.entries === 'object' ? raw.entries : {};
            for (const [identity, value] of Object.entries(entries)) {
                const text = String(value || '').trim().slice(0, 32);
                if (identity && text) state.genres.set(identity, text);
            }
            trimGenres();
        } catch (error) {
            folium.log.warn('[ai-eq] 读取曲风记录失败', String((error && error.message) || error));
        }
    }

    function saveGenresSoon() {
        if (state.disposed || state.genresSaveTimer) return;
        state.genresSaveTimer = setTimeout(() => {
            state.genresSaveTimer = null;
            void persistGenres();
        }, TUNING.saveDebounce);
    }

    async function persistGenres() {
        try {
            await folium.storage.set(GENRES_STORAGE_KEY, { v: 1, entries: Object.fromEntries(state.genres) });
        } catch (error) {
            folium.log.warn('[ai-eq] 写入曲风记录失败', String((error && error.message) || error));
        }
    }

    /** 这首歌已知的曲风：用户指定 > 缓存里模型判断过 > 当前结果。 */
    function genreFor(song, key) {
        const identity = songIdentity(song);
        if (!identity) return '';
        const stored = state.genres.get(identity);
        if (stored) return stored;
        const cacheKey = key || keyFor(song);
        const entry = cacheGet(cacheKey);
        if (entry && entry.genre) return entry.genre;
        if (state.last && state.last.key === cacheKey && state.last.genre) return state.last.genre;
        return '';
    }

    /** 记住模型判断出的曲风（不覆盖用户已指定的值）。 */
    function rememberGenre(song, genre) {
        const identity = songIdentity(song);
        const text = String(genre || '').trim().slice(0, 32);
        if (!identity || !text) return;
        if (state.genres.has(identity)) return;
        state.genres.set(identity, text);
        trimGenres();
        saveGenresSoon();
    }

    /** 用户手动指定 / 清除当前歌曲的曲风；同时让这首歌的旧曲线缓存失效。 */
    function setUserGenre(song, value) {
        if (!song) return '';
        const identity = songIdentity(song);
        if (!identity) return '';
        const text = String(value || '').trim().slice(0, 32);
        if (text) state.genres.set(identity, text);
        else state.genres.delete(identity);
        trimGenres();
        saveGenresSoon();
        const key = keyFor(song);
        if (state.cache.has(key)) {
            state.cache.delete(key);
            saveCacheSoon();
        }
        if (state.last && state.last.key === key) state.last = null;
        renderAll();
        return text;
    }

    // ---------------------------------------------------------------- 口味学习

    function rebuildTasteTotals() {
        const tags = {};
        let up = 0;
        let down = 0;
        for (const rating of Object.values(state.taste.ratings)) {
            if (!rating || typeof rating !== 'object') continue;
            const value = Number(rating.value);
            if (value === 1) up += 1;
            else if (value === -1) down += 1;
            else continue;
            for (const tag of Array.isArray(rating.tags) ? rating.tags : []) {
                const key = String(tag || '').trim();
                if (!key) continue;
                if (!tags[key]) tags[key] = { up: 0, down: 0 };
                if (value === 1) tags[key].up += 1;
                else tags[key].down += 1;
            }
        }
        state.taste.tags = tags;
        state.taste.up = up;
        state.taste.down = down;
    }

    async function loadTaste() {
        try {
            const raw = await folium.storage.get(TASTE_STORAGE_KEY);
            if (raw && typeof raw === 'object') {
                state.taste.ratings = raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {};
                state.taste.modes = raw.modes && typeof raw.modes === 'object' ? raw.modes : {};
                state.taste.up = Number(raw.up) || 0;
                state.taste.down = Number(raw.down) || 0;
                state.taste.takeovers = Number(raw.takeovers) || 0;
            }
        } catch (error) {
            folium.log.warn('[ai-eq] 读取口味记录失败', String((error && error.message) || error));
        }
        rebuildTasteTotals();
    }

    function saveTasteSoon() {
        if (state.disposed || state.tasteSaveTimer) return;
        state.tasteSaveTimer = setTimeout(() => {
            state.tasteSaveTimer = null;
            void persistTaste();
        }, TUNING.saveDebounce);
    }

    async function persistTaste() {
        try {
            await folium.storage.set(TASTE_STORAGE_KEY, { v: 1, ...state.taste });
        } catch (error) {
            folium.log.warn('[ai-eq] 写入口味记录失败', String((error && error.message) || error));
        }
    }

    function trimTaste() {
        const entries = Object.entries(state.taste.ratings);
        if (entries.length <= TASTE_MAX_RATINGS) return;
        const kept = entries
            .sort((a, b) => (Number(b[1] && b[1].at) || 0) - (Number(a[1] && a[1].at) || 0))
            .slice(0, TASTE_MAX_RATINGS);
        state.taste.ratings = Object.fromEntries(kept);
    }

    /** 你在音效面板手动切到的音效：记为口味信号。 */
    function recordModeChange(mode) {
        if (!mode || !mode.kind) return;
        let key = null;
        if (mode.kind === 'preset') key = `preset:${mode.id}`;
        else if (mode.kind === 'custom') key = `custom:${mode.id}`;
        if (!key) return;
        state.taste.modes[key] = (Number(state.taste.modes[key]) || 0) + 1;
        state.taste.takeovers = (Number(state.taste.takeovers) || 0) + 1;
        saveTasteSoon();
        renderAll();
    }

    function currentEntry() {
        if (!state.song) return null;
        if (state.last && state.last.key === state.key) return state.last;
        return cacheGet(state.key);
    }

    /** 👍 / 👎：同一首歌再点一次同一个按钮会取消。 */
    function rateSong(song, value) {
        if (!song) return 0;
        const identity = songIdentity(song);
        if (!identity) return 0;
        const previous = state.taste.ratings[identity];
        const next = previous && Number(previous.value) === value ? 0 : value;
        if (next === 0) {
            delete state.taste.ratings[identity];
        } else {
            const entry = currentEntry();
            const brief = entry && entry.brief ? entry.brief : null;
            state.taste.ratings[identity] = {
                value: next,
                at: Date.now(),
                title: String(song.title || ''),
                artist: String(song.artist || ''),
                genre: genreFor(song),
                tags: brief && Array.isArray(brief.tags) ? brief.tags.slice(0, 6) : [],
                emotion: brief && Array.isArray(brief.emotion) ? brief.emotion.slice(0, 4) : [],
            };
        }
        trimTaste();
        rebuildTasteTotals();
        saveTasteSoon();
        renderAll();
        if (next > 0) toast(tr('已记下：喜欢这种调音', 'Noted: you like this tuning'), 'success');
        else if (next < 0) toast(tr('已记下：不喜欢这种调音', 'Noted: you dislike this tuning'));
        else toast(tr('已取消评价', 'Rating cleared'));
        return next;
    }

    function modeKeyLabel(key) {
        const text = String(key || '');
        if (text.startsWith('preset:')) return PRESET_NAMES[text.slice(7)] || text.slice(7);
        if (text.startsWith('custom:')) return `${tr('自定义', 'Custom')} ${text.slice(7) === 'custom1' ? '1' : '2'}`;
        return text;
    }

    function overlapCount(a, b) {
        const set = new Set((Array.isArray(a) ? a : []).map((item) => String(item).toLowerCase()));
        let count = 0;
        for (const item of Array.isArray(b) ? b : []) if (set.has(String(item).toLowerCase())) count += 1;
        return count;
    }

    /** 生成提示词用的历史口味：喜欢的标签、常切音效、气质相近歌曲的反馈。 */
    function tasteProfileFor(knownBrief, genre) {
        const up = Object.entries(state.taste.tags)
            .map(([tag, stat]) => ({ tag, count: (Number(stat.up) || 0) - (Number(stat.down) || 0) }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
        const down = Object.entries(state.taste.tags)
            .map(([tag, stat]) => ({ tag, count: (Number(stat.down) || 0) - (Number(stat.up) || 0) }))
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);
        const modes = Object.entries(state.taste.modes)
            .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
            .slice(0, 3)
            .map(([key, count]) => ({ key, count: Number(count) || 0, label: modeKeyLabel(key) }));
        const rated = Object.entries(state.taste.ratings)
            .map(([identity, rating]) => ({ identity, ...(rating || {}) }))
            .filter((item) => Number(item.value) === 1 || Number(item.value) === -1);
        const currentTags = knownBrief && Array.isArray(knownBrief.tags) ? knownBrief.tags : [];
        let similar = [];
        if (currentTags.length) {
            similar = rated
                .map((item) => ({ ...item, overlap: overlapCount(currentTags, item.tags) }))
                .filter((item) => item.overlap > 0)
                .sort((a, b) => b.overlap - a.overlap || (Number(b.at) || 0) - (Number(a.at) || 0))
                .slice(0, 3);
        } else if (genre) {
            similar = rated
                .filter((item) => item.genre && String(item.genre).toLowerCase() === String(genre).toLowerCase())
                .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))
                .slice(0, 3);
        }
        return {
            up,
            down,
            modes,
            similar: similar.map((item) => ({ title: item.title, value: Number(item.value), tags: (item.tags || []).slice(0, 3) })),
        };
    }

    // ---------------------------------------------------------------- 调用统计（次数 / token / 花费）

    function priceSettings() {
        const conf = cfg();
        const priceIn = Number(conf.priceIn);
        const priceOut = Number(conf.priceOut);
        return {
            priceIn: Number.isFinite(priceIn) ? priceIn : 0,
            priceOut: Number.isFinite(priceOut) ? priceOut : 0,
        };
    }

    function costOf(usage) {
        if (!usage) return 0;
        const { priceIn, priceOut } = priceSettings();
        return ((Number(usage.prompt) || 0) / 1e6) * priceIn + ((Number(usage.completion) || 0) / 1e6) * priceOut;
    }

    /** 每次真正发出的请求都记一次调用；token 与花费只在服务商返回 usage 时统计。 */
    function recordCall(song, usage) {
        const identity = songIdentity(song);
        const cost = costOf(usage);
        const promptTokens = usage ? Number(usage.prompt) || 0 : 0;
        const completionTokens = usage ? Number(usage.completion) || 0 : 0;
        state.stats.calls += 1;
        state.stats.promptTokens += promptTokens;
        state.stats.completionTokens += completionTokens;
        state.stats.cost += cost;
        if (identity) {
            const previous = state.stats.bySong[identity] || {
                calls: 0, promptTokens: 0, completionTokens: 0, cost: 0, title: '', artist: '', at: 0,
            };
            previous.calls += 1;
            previous.promptTokens += promptTokens;
            previous.completionTokens += completionTokens;
            previous.cost += cost;
            previous.title = String(song.title || '');
            previous.artist = String(song.artist || '');
            previous.at = Date.now();
            state.stats.bySong[identity] = previous;
            trimStats();
        }
        saveStatsSoon();
        return { ...(usage || { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens }), cost };
    }

    function trimStats() {
        const entries = Object.entries(state.stats.bySong);
        if (entries.length <= STATS_MAX_SONGS) return;
        const kept = entries
            .sort((a, b) => (Number(b[1] && b[1].at) || 0) - (Number(a[1] && a[1].at) || 0))
            .slice(0, STATS_MAX_SONGS);
        state.stats.bySong = Object.fromEntries(kept);
    }

    function songStats(identity) {
        return (identity && state.stats.bySong[identity]) || { calls: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
    }

    async function loadStats() {
        try {
            const raw = await folium.storage.get(STATS_STORAGE_KEY);
            if (raw && typeof raw === 'object') {
                state.stats.calls = Number(raw.calls) || 0;
                state.stats.promptTokens = Number(raw.promptTokens) || 0;
                state.stats.completionTokens = Number(raw.completionTokens) || 0;
                state.stats.cost = Number(raw.cost) || 0;
                state.stats.bySong = raw.bySong && typeof raw.bySong === 'object' ? raw.bySong : {};
            }
        } catch (error) {
            folium.log.warn('[ai-eq] 读取调用统计失败', String((error && error.message) || error));
        }
    }

    function saveStatsSoon() {
        if (state.disposed || state.statsSaveTimer) return;
        state.statsSaveTimer = setTimeout(() => {
            state.statsSaveTimer = null;
            void persistStats();
        }, TUNING.saveDebounce);
    }

    async function persistStats() {
        try {
            await folium.storage.set(STATS_STORAGE_KEY, { v: 1, ...state.stats });
        } catch (error) {
            folium.log.warn('[ai-eq] 写入调用统计失败', String((error && error.message) || error));
        }
    }

    // ---------------------------------------------------------------- 请求

    function friendlyError(error) {
        const name = String((error && error.name) || '');
        const message = String((error && error.message) || error || '未知错误');
        if (name === 'AbortError' || /timeout|timed out|aborted/i.test(message)) {
            return '请求超时，请检查网络或接口地址';
        }
        if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(message)) {
            return '网络请求失败，请检查网络或接口地址';
        }
        return message;
    }

    function httpError(status, text) {
        if (status === 401 || status === 403) return `接口拒绝了请求（${status}），请检查 API 密钥是否正确、是否有该模型权限`;
        if (status === 404) return '接口地址或模型不存在（404），请检查接口地址与模型名';
        if (status === 413) return '请求太大（413）：歌词过长，试着关闭「发送整首歌词」';
        if (status === 429) return '请求过于频繁或额度不足（429），请稍后再试或检查账户余额';
        if (status >= 500) return `AI 服务端错误（${status}），请稍后再试`;
        const detail = text ? `：${String(text).slice(0, 120)}` : '';
        return `接口返回 ${status}${detail}`;
    }

    async function readApiKey() {
        try {
            return await folium.secrets.get('apiKey');
        } catch (error) {
            folium.log.warn('[ai-eq] 读取密钥失败', String((error && error.message) || error));
            return null;
        }
    }

    /** 当前歌曲的整首歌词（最多 LYRICS_CHAR_LIMIT 字）；拿不到或用户关掉时返回空。 */
    function lyricsText() {
        if (cfg().useLyrics === false) return '';
        try {
            const lines = folium.lyrics && typeof folium.lyrics.getLines === 'function' ? folium.lyrics.getLines() : [];
            if (!Array.isArray(lines) || !lines.length) return '';
            const text = lines
                .map((line) => String((line && line.fullText) || '').trim())
                .filter(Boolean)
                .join('\n');
            return text.slice(0, LYRICS_CHAR_LIMIT);
        } catch (_) {
            return '';
        }
    }

    async function requestCurve({ song, bandList, conf, snapshot, genre, profile, lyrics }) {
        const resolved = resolveProvider(conf);
        if (!resolved.model) throw new Error('请先在设置里填写模型名');
        const endpoint = validateEndpoint(resolved.base);
        if (endpoint.error) throw new Error(endpoint.error);
        const apiKey = await readApiKey();
        if (!apiKey && !endpoint.isLocal) throw new Error('请先在设置里保存 API 密钥');

        const { system, user } = buildMessages({
            song,
            bands: bandList,
            strength: conf.strength,
            taste: conf.taste,
            lyrics,
            genre,
            profile,
        });
        const body = {
            model: resolved.model,
            temperature: 0.4,
            max_tokens: 900,
            stream: false,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        };
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

        const send = () => folium.net.fetch(endpoint.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            timeoutMs: REQUEST_TIMEOUT_MS,
        });

        if (conf.jsonMode !== false) body.response_format = { type: 'json_object' };
        let response = null;
        let fallbacks = 0;
        for (;;) {
            try {
                response = await send();
            } catch (error) {
                throw new Error(friendlyError(error));
            }
            if (response.ok) break;
            let text = '';
            try { text = String(response.text() || ''); } catch (_) { text = ''; }
            if (response.status === 400 && fallbacks < 2) {
                if (body.response_format && /response_format|json_object/i.test(text)) {
                    folium.log.info('[ai-eq] 服务商不支持 response_format，回退为纯提示词 JSON');
                    delete body.response_format;
                    fallbacks += 1;
                    continue;
                }
                if (body.temperature !== undefined && /temperature|unsupported[_ ]value/i.test(text)) {
                    folium.log.info('[ai-eq] 服务商不接受 temperature，去掉后重试');
                    delete body.temperature;
                    fallbacks += 1;
                    continue;
                }
            }
            throw new Error(httpError(response.status, text));
        }

        let payload;
        try {
            payload = response.json();
        } catch (_) {
            throw new Error('接口返回的不是 JSON，请检查接口地址是否指向 chat/completions');
        }
        const { content, finishReason } = extractMessageContent(payload);
        const usage = extractUsage(payload);
        if (finishReason === 'length') throw new Error('模型输出被截断（finish_reason=length），请换输出更长的模型或降低强度');
        if (!content) throw new Error('模型返回了空内容，请检查模型与配额');
        const parsed = parseCurvePayload(content);
        if (parsed.error) throw new Error(parsed.error);

        const normalized = normalizeCurve(parsed.curve, {
            bands: bandList,
            minGain: snapshot ? snapshot.minGain : -12,
            maxGain: snapshot ? snapshot.maxGain : 12,
            maxAbs: maxAbsFor(conf.strength),
        });
        if (normalized.error) throw new Error(normalized.error);
        if (parsed.confidence < 0.35) {
            throw new Error(`模型对这首歌的把握不足（置信度 ${Math.round(parsed.confidence * 100)}%），本次未施加；可再试一次或调高强度`);
        }

        return {
            curve: normalized.curve,
            reason: parsed.reason,
            genre: parsed.genre,
            brief: parsed.brief,
            confidence: parsed.confidence,
            model: resolved.model,
            usage,
            adjusted: normalized.clamped || normalized.smoothed,
            noop: normalized.noop,
        };
    }

    async function generate(song, options) {
        const opts = options || {};
        if (!song) {
            if (opts.manual) toast(tr('当前没有播放歌曲', 'No song is playing'), 'error');
            return { error: '没有播放歌曲' };
        }
        const key = keyFor(song);
        if (state.inflight.has(key)) return state.inflight.get(key);
        if (!opts.force) {
            const hit = cacheGet(key);
            if (hit) {
                if (opts.applyWhenDone !== false && state.key === key) applyCurve(hit.curve, { silent: true, key, source: 'cache' });
                return { cached: true };
            }
        }
        const conf = cfg();
        if (state.apiKeyPresent === false) {
            const resolved = resolveProvider(conf);
            const endpoint = validateEndpoint(resolved.base);
            if (!endpoint.isLocal) {
                const message = '请先在设置里保存 API 密钥';
                state.error = message;
                if (opts.manual) toast(message, 'error');
                renderAll();
                return { error: message };
            }
        }
        const bandList = bands();
        const snapshot = eqState();
        const knownGenre = genreFor(song, key);
        const cachedEntry = cacheGet(key);
        const knownBrief = cachedEntry ? cachedEntry.brief : null;
        const profile = tasteProfileFor(knownBrief, knownGenre);
        const lyrics = lyricsText();

        const promise = (async () => {
            state.busy = true;
            state.error = '';
            renderAll();
            try {
                const wait = Math.max(0, TUNING.requestGap - (Date.now() - state.lastRequestAt));
                if (wait) await sleep(wait);
                state.lastRequestAt = Date.now();
                const result = await requestCurve({
                    song, bandList, conf, snapshot, genre: knownGenre, profile, lyrics,
                });
                if (state.disposed) return null;
                if (result.genre) rememberGenre(song, result.genre);
                const usage = recordCall(song, result.usage);
                const entry = {
                    curve: result.curve,
                    reason: result.reason,
                    confidence: result.confidence,
                    model: result.model,
                    genre: result.genre || knownGenre,
                    brief: result.brief,
                    usage,
                    at: Date.now(),
                };
                cacheSet(key, entry);
                if (state.key === key) {
                    state.last = { ...entry, key, source: 'ai', adjusted: result.adjusted, noop: result.noop };
                    renderAll();
                    if (result.noop) {
                        if (currentModeIsOurs()) folium.equalizer.releaseCurve();
                        if (opts.manual || cfg().notify !== false) toast(tr('模型认为这首歌不需要调整', 'The model suggests no change'));
                    } else if (opts.manual || (cfg().autoApply && !state.userTookOver)) {
                        applyCurve(entry.curve, { silent: !cfg().notify, key, source: 'ai' });
                    }
                }
                return result;
            } catch (error) {
                const message = friendlyError(error);
                state.error = message;
                folium.log.warn('[ai-eq] 生成失败：' + message);
                if (opts.manual) toast(message, 'error');
                return { error: message };
            } finally {
                state.inflight.delete(key);
                state.busy = false;
                renderAll();
            }
        })();
        state.inflight.set(key, promise);
        return promise;
    }

    function scheduleGenerate(delay) {
        if (state.generateTimer) clearTimeout(state.generateTimer);
        state.generateTimer = setTimeout(() => {
            state.generateTimer = null;
            if (state.disposed || !state.song) return;
            const conf = cfg();
            if (!conf.autoApply || state.userTookOver) return;
            const hit = cacheGet(state.key);
            if (hit && Array.isArray(hit.curve) && hit.curve.length) {
                applyCurve(hit.curve, { silent: true, key: state.key, source: 'cache' });
                return;
            }
            void generate(state.song, { force: false });
        }, Math.max(0, Number(delay) || 0));
    }

    // ---------------------------------------------------------------- 施加

    function currentModeIsOurs() {
        const snapshot = eqState();
        return !!(snapshot && snapshot.mode && snapshot.mode.kind === 'mod' && snapshot.mode.modId === folium.modId);
    }

    function currentCurve() {
        if (state.last && state.last.key === state.key && Array.isArray(state.last.curve)) return state.last.curve;
        const hit = cacheGet(state.key);
        return hit ? hit.curve : null;
    }

    function scheduleApply(curve, options, delay) {
        if (state.retryTimer) return;
        const wait = Math.max(0, Number(delay) || 0);
        state.retryTimer = setTimeout(() => {
            state.retryTimer = null;
            if (state.disposed) return;
            if (options && options.key && options.key !== state.key) return;
            applyCurve(curve, options);
        }, wait + 30);
    }

    function applyCurve(curve, options) {
        const opts = options || {};
        if (!Array.isArray(curve) || !curve.length) return false;
        const snapshot = eqState();
        if (!snapshot) return false;
        if (!snapshot.hostPlaysAudio) {
            state.error = '当前是外部 Stage 播放，均衡器不作用；曲线已保留，回到宿主播放后生效';
            renderAll();
            return false;
        }
        const wait = TUNING.writeGap - (Date.now() - state.lastWriteAt);
        if (wait > 0) {
            scheduleApply(curve, opts, wait);
            return false;
        }
        let result;
        try {
            result = folium.equalizer.applyCurve(curve);
        } catch (error) {
            state.error = friendlyError(error);
            folium.log.warn('[ai-eq] 施加曲线失败：' + state.error);
            renderAll();
            return false;
        }
        state.lastWriteAt = Date.now();
        if (result && result.ok) {
            state.pendingApply = null;
            state.error = '';
            const after = eqState();
            if (after && after.enabled === false && !state.hintedDisabled) {
                state.hintedDisabled = true;
                toast(tr('曲线已写入，但均衡器总开关是关的：到「音效」里打开才能听到', 'Curve written, but the equalizer master switch is off'));
            }
            if (!opts.silent && opts.source !== 'cache') toast(tr('已应用 AI 曲线', 'AI curve applied'));
            renderAll();
            return true;
        }
        const reason = result && result.reason;
        if (reason === 'panel-open') {
            state.pendingApply = { curve: curve.slice(), key: opts.key || state.key, silent: true, source: opts.source || 'ai' };
            renderAll();
            return false;
        }
        if (reason === 'rate-limited') {
            scheduleApply(curve, opts, 2200);
            return false;
        }
        folium.log.warn('[ai-eq] applyCurve 被拒绝：' + String(reason || 'unknown'));
        renderAll();
        return false;
    }

    // ---------------------------------------------------------------- 事件

    function onSong(song) {
        state.song = song || null;
        state.key = song ? keyFor(song) : '';
        state.error = '';
        state.pendingApply = null;
        state.last = null;
        if (!song) {
            renderAll();
            return;
        }
        const conf = cfg();
        const hit = cacheGet(state.key);
        if (hit) {
            state.last = { ...hit, key: state.key, source: 'cache', adjusted: false, noop: false };
        }
        renderAll();
        if (!conf.autoApply || state.userTookOver) return;
        if (hit) {
            applyCurve(hit.curve, { silent: true, key: state.key, source: 'cache' });
            return;
        }
        scheduleGenerate(TUNING.generateDelay);
    }

    function onEqualizer(snapshot, origin) {
        renderAll();
        const kind = origin && origin.kind;
        const isOurs = kind === 'mod' && origin.modId === folium.modId;
        const isOtherMod = kind === 'mod' && origin.modId !== folium.modId;
        const userAction = kind === 'user' || kind === 'command';
        const takeOver = userAction || isOtherMod;
        if (userAction && snapshot && snapshot.mode) recordModeChange(snapshot.mode);
        if (takeOver && !state.userTookOver) {
            state.userTookOver = true;
            state.pendingApply = null;
            if (cfg().autoApply) {
                try {
                    section.settings.set({ autoApply: false });
                } catch (error) {
                    folium.log.warn('[ai-eq] 关闭自动施加失败', String((error && error.message) || error));
                }
            }
            if (cfg().notify !== false) toast(tr('检测到你调整了音效，AI 自动施加已暂停（可在设置里重新开启）', 'You changed the sound, so AI auto-apply is paused'));
            renderAll();
            return;
        }
        if (isOurs) return;
        if (snapshot && snapshot.writable && state.pendingApply) {
            const pending = state.pendingApply;
            state.pendingApply = null;
            applyCurve(pending.curve, { silent: true, key: pending.key, source: pending.source });
        }
    }

    async function toggleAb() {
        const snapshot = eqState();
        if (!snapshot) return { message: tr('均衡器不可用', 'Equalizer unavailable') };
        if (currentModeIsOurs()) {
            let done = false;
            try { done = folium.equalizer.releaseCurve(); } catch (_) { done = false; }
            toast(done ? tr('已切回你的音效', 'Back to your sound') : tr('当前不是本模组的曲线', 'The curve in place is not this mod’s'));
            renderAll();
            return { message: done ? '已切回你的音效' : '当前不是本模组的曲线' };
        }
        const curve = currentCurve();
        if (!curve) {
            toast(tr('这首歌还没有 AI 曲线，请先生成', 'No AI curve for this song yet'), 'error');
            return { message: '这首歌还没有 AI 曲线' };
        }
        applyCurve(curve, { silent: false, key: state.key, source: 'manual' });
        return { message: '已切回 AI 曲线' };
    }

    async function testConnection() {
        const conf = cfg();
        const resolved = resolveProvider(conf);
        if (!resolved.model) throw new Error('请先在设置里填写模型名');
        const endpoint = validateEndpoint(resolved.base);
        if (endpoint.error) throw new Error(endpoint.error);
        const apiKey = await readApiKey();
        if (!apiKey && !endpoint.isLocal) throw new Error('请先在设置里保存 API 密钥');
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
        const started = Date.now();
        let response;
        try {
            response = await folium.net.fetch(endpoint.url, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: resolved.model,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 8,
                    temperature: 0,
                }),
                timeoutMs: 20000,
            });
        } catch (error) {
            throw new Error(friendlyError(error));
        }
        if (!response.ok) {
            let text = '';
            try { text = String(response.text() || ''); } catch (_) { text = ''; }
            throw new Error(httpError(response.status, text));
        }
        let size = 0;
        try {
            const payload = response.json();
            size = extractMessageContent(payload).content.length;
        } catch (_) {
            throw new Error('接口返回的不是 JSON');
        }
        const ms = Date.now() - started;
        return { message: `连接成功：${resolved.model}，${ms} ms，返回 ${size} 字符` };
    }

    // ---------------------------------------------------------------- 命令入口

    async function runGenerateCommand() {
        if (!state.song) return '当前没有播放歌曲';
        const result = await generate(state.song, { force: true, manual: true });
        if (!result) return '没有结果';
        if (result.error) return `失败：${result.error}`;
        if (result.noop) return '模型认为这首歌不需要调整';
        const brief = result.brief ? `简报：${result.brief.summary || '（无）'}` : '简报：模型没有返回';
        return `已生成并施加：${brief}｜${result.reason || '（无 EQ 说明）'}（置信度 ${Math.round(result.confidence * 100)}%）`;
    }

    async function runToggleCommand() {
        const result = await toggleAb();
        return result.message;
    }

    async function runReleaseCommand() {
        let done = false;
        try { done = folium.equalizer.releaseCurve(); } catch (_) { done = false; }
        renderAll();
        return done ? '已撤销本模组的曲线，回到你自己的音效' : '当前在位的不是本模组的曲线';
    }

    async function runTestCommand() {
        try {
            const result = await testConnection();
            return result.message;
        } catch (error) {
            const message = friendlyError(error);
            toast(message, 'error');
            return `失败：${message}`;
        }
    }

    async function runClearCacheCommand() {
        const count = state.cache.size;
        const genreCount = state.genres.size;
        state.cache.clear();
        state.genres.clear();
        state.last = null;
        try {
            await folium.storage.set(CACHE_STORAGE_KEY, { v: 2, entries: {} });
            await folium.storage.set(GENRES_STORAGE_KEY, { v: 1, entries: {} });
        } catch (error) {
            folium.log.warn('[ai-eq] 清除缓存失败', String((error && error.message) || error));
        }
        renderAll();
        return `已清除 ${count} 首曲子的简报/曲线记忆与 ${genreCount} 条曲风记录（口味与统计保留）`;
    }

    async function runResetTasteCommand() {
        const ratings = Object.keys(state.taste.ratings).length;
        const modes = Object.values(state.taste.modes).reduce((sum, value) => sum + (Number(value) || 0), 0);
        state.taste = { ratings: {}, tags: {}, modes: {}, up: 0, down: 0, takeovers: 0 };
        try {
            await folium.storage.set(TASTE_STORAGE_KEY, { v: 1, ...state.taste });
        } catch (error) {
            folium.log.warn('[ai-eq] 重置口味失败', String((error && error.message) || error));
        }
        renderAll();
        return `已重置口味学习：清除 ${ratings} 条评价与 ${modes} 次手动切换记录`;
    }

    async function runResetStatsCommand() {
        const calls = state.stats.calls;
        state.stats = { calls: 0, promptTokens: 0, completionTokens: 0, cost: 0, bySong: {} };
        try {
            await folium.storage.set(STATS_STORAGE_KEY, { v: 1, ...state.stats });
        } catch (error) {
            folium.log.warn('[ai-eq] 重置统计失败', String((error && error.message) || error));
        }
        renderAll();
        return `已重置调用统计（原 ${calls} 次调用）`;
    }

    // ---------------------------------------------------------------- 界面

    function money(value) {
        const number = Number(value) || 0;
        if (number === 0) return '¥0';
        if (number >= 1) return `¥${number.toFixed(2)}`;
        if (number >= 0.01) return `¥${number.toFixed(3)}`;
        return `¥${number.toFixed(5)}`;
    }

    function fmtInt(value) {
        return Math.round(Number(value) || 0).toLocaleString('zh-CN');
    }

    const CSS = `
.aieq { display:flex; flex-direction:column; gap:16px; font:13px/1.55 var(--folium-font, sans-serif); color: var(--folium-primary, CanvasText); }
.aieq-head { display:flex; flex-direction:column; gap:6px; }
.aieq-title { font-size:16px; font-weight:700; }
.aieq-song { opacity:.75; }
.aieq-pills { display:flex; flex-wrap:wrap; gap:6px; }
.aieq-pill { border:1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius:999px; padding:2px 10px; font-size:12px; }
.aieq-pill.warn { border-color: color-mix(in srgb, #e2a03f 60%, transparent); color: color-mix(in srgb, #e2a03f 85%, currentColor); }
.aieq-card { border:1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
.aieq-h3 { margin:0; font-size:12px; font-weight:600; letter-spacing:.02em; opacity:.85; }
.aieq-graph { display:grid; gap:6px; }
.aieq-band { display:flex; flex-direction:column; align-items:center; gap:4px; font-variant-numeric: tabular-nums; }
.aieq-track { display:flex; flex-direction:column; justify-content:flex-end; height:72px; width:100%; border-radius:6px; background: color-mix(in srgb, currentColor 7%, transparent); overflow:hidden; }
.aieq-bar { width:100%; background: var(--folium-accent, #6b8afd); border-radius:4px 4px 0 0; min-height:2px; }
.aieq-bar.neg { background: color-mix(in srgb, var(--folium-accent, #6b8afd) 55%, transparent); }
.aieq-db { font-size:11px; }
.aieq-hz { font-size:10px; opacity:.55; }
.aieq-row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.aieq-btn { font:inherit; color:inherit; background:transparent; border:1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius:999px; padding:5px 14px; cursor:pointer; }
.aieq-btn:hover:not(:disabled) { background: color-mix(in srgb, currentColor 8%, transparent); }
.aieq-btn:disabled { opacity:.4; cursor:default; }
.aieq-btn.primary { border-color: var(--folium-accent, #6b8afd); background: color-mix(in srgb, var(--folium-accent, #6b8afd) 18%, transparent); }
.aieq-btn.active { border-color: var(--folium-accent, #6b8afd); background: color-mix(in srgb, var(--folium-accent, #6b8afd) 28%, transparent); }
.aieq-field { display:flex; flex-direction:column; gap:6px; }
.aieq-label { font-weight:600; }
.aieq-desc { opacity:.62; font-size:12px; }
.aieq-input, .aieq-select { font:inherit; color:inherit; background: color-mix(in srgb, currentColor 4%, transparent); border:1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius:8px; padding:7px 10px; width:100%; box-sizing:border-box; }
.aieq-check { display:flex; align-items:center; gap:8px; cursor:pointer; }
.aieq-hint { display:none; border-radius:10px; padding:10px 12px; background: color-mix(in srgb, #e2a03f 16%, transparent); font-size:12px; }
.aieq-hint.show { display:block; }
.aieq-note { opacity:.62; font-size:12px; margin:0; line-height:1.65; }
.aieq-group { display:flex; flex-direction:column; gap:14px; }
.aieq-sep { border-top:1px solid color-mix(in srgb, currentColor 14%, transparent); }
.aieq-inline { display:flex; gap:8px; align-items:center; }
.aieq-inline .aieq-input { flex:1; }
.aieq-err { color: color-mix(in srgb, #e26d6d 85%, currentColor); }
.aieq-summary { font-size:14px; line-height:1.6; font-weight:600; }
.aieq-chips { display:flex; flex-wrap:wrap; gap:6px; }
.aieq-chip { font-size:12px; padding:1px 9px; border-radius:999px; background: color-mix(in srgb, currentColor 8%, transparent); border:1px solid color-mix(in srgb, currentColor 14%, transparent); }
.aieq-chip.dim { opacity:.65; }
.aieq-energy { display:flex; align-items:flex-end; gap:4px; height:44px; }
.aieq-energy i { flex:1; background: var(--folium-accent, #6b8afd); border-radius:3px 3px 0 0; min-height:2px; opacity:.85; }
.aieq-kv { display:flex; justify-content:space-between; gap:12px; font-variant-numeric: tabular-nums; }
.aieq-kv span:last-child { opacity:.85; }
`;

    function presetName(id) {
        return PRESET_NAMES[id] || id;
    }

    function modeText(mode) {
        if (!mode) return tr('未知', 'Unknown');
        if (mode.kind === 'preset') return `${tr('内置音效', 'Built-in sound')}：${presetName(mode.id)}`;
        if (mode.kind === 'custom') return `${tr('你的自定义音效', 'Your custom sound')} ${mode.id === 'custom1' ? '1' : '2'}`;
        if (mode.kind === 'mod') {
            return mode.modId === folium.modId
                ? tr('本模组的曲线', 'This mod’s curve')
                : `${tr('模组', 'Mod')} ${mode.modId} ${tr('的曲线', 'curve')}`;
        }
        return tr('你的音效', 'Your sound');
    }

    function mountPanel(container, ctx) {
        const locale = String((ctx && ctx.locale) || 'zh-CN');
        uiEn = locale.toLowerCase().startsWith('en');
        const en = uiEn;
        const L = (zh, enText) => (en ? enText : zh);

        const focusedNodes = new Set();
        const bindFocus = (node) => {
            try {
                node.addEventListener('focus', () => focusedNodes.add(node));
                node.addEventListener('blur', () => focusedNodes.delete(node));
            } catch (_) { /* 忽略 */ }
        };
        const isEditing = (node) => focusedNodes.has(node) || document.activeElement === node;

        const style = document.createElement('style');
        style.textContent = CSS;
        const root = document.createElement('div');
        root.className = 'aieq';

        const head = document.createElement('div');
        head.className = 'aieq-head';
        const title = document.createElement('div');
        title.className = 'aieq-title';
        title.textContent = L('AI 智能 EQ', 'AI EQ');
        const songLine = document.createElement('div');
        songLine.className = 'aieq-song';
        const pills = document.createElement('div');
        pills.className = 'aieq-pills';
        head.append(title, songLine, pills);

        // ---- 歌曲简报（一句话 / 情绪 / 标签 / 意象 / 能量 / 曲风）
        const briefCard = document.createElement('section');
        briefCard.className = 'aieq-card';
        const briefTitle = document.createElement('h3');
        briefTitle.className = 'aieq-h3';
        briefTitle.textContent = L('歌曲简报', 'Song brief');
        const briefSummary = document.createElement('div');
        briefSummary.className = 'aieq-summary';
        const briefMeta = document.createElement('div');
        briefMeta.style.display = 'flex';
        briefMeta.style.flexDirection = 'column';
        briefMeta.style.gap = '8px';
        const energyBox = document.createElement('div');
        energyBox.className = 'aieq-energy';
        const energyLabel = document.createElement('div');
        energyLabel.className = 'aieq-desc';
        energyLabel.textContent = L('能量起伏', 'Energy arc');
        const energyWrap = document.createElement('div');
        energyWrap.style.display = 'flex';
        energyWrap.style.flexDirection = 'column';
        energyWrap.style.gap = '4px';
        energyWrap.append(energyLabel, energyBox);

        const genreRow = document.createElement('div');
        genreRow.className = 'aieq-row';
        const genreInput = document.createElement('input');
        genreInput.type = 'text';
        genreInput.className = 'aieq-input';
        genreInput.placeholder = L('例如 City Pop、华语流行', 'e.g. City Pop');
        genreInput.style.flex = '1';
        const genreText = document.createElement('div');
        genreText.className = 'aieq-desc';
        bindFocus(genreInput);
        const genreSave = document.createElement('button');
        genreSave.type = 'button';
        genreSave.className = 'aieq-btn';
        genreSave.textContent = L('保存曲风', 'Save genre');
        genreSave.addEventListener('click', () => {
            if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
            const text = setUserGenre(state.song, genreInput.value);
            toast(text ? L(`曲风已保存：${text}`, `Genre saved: ${text}`) : L('已清除曲风', 'Genre cleared'), 'success');
        });
        const genreRegen = document.createElement('button');
        genreRegen.type = 'button';
        genreRegen.className = 'aieq-btn';
        genreRegen.textContent = L('保存并重新生成', 'Save & regenerate');
        genreRegen.addEventListener('click', async () => {
            if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
            setUserGenre(state.song, genreInput.value);
            await generate(state.song, { force: true, manual: true });
        });
        genreRow.append(genreInput, genreSave, genreRegen);
        briefCard.append(briefTitle, briefSummary, briefMeta, energyWrap, genreText, genreRow);

        // ---- 当前均衡器
        const graphCard = document.createElement('section');
        graphCard.className = 'aieq-card';
        const graphTitle = document.createElement('h3');
        graphTitle.className = 'aieq-h3';
        graphTitle.textContent = L('当前均衡器', 'Current equalizer');
        const graph = document.createElement('div');
        graph.className = 'aieq-graph';
        graphCard.append(graphTitle, graph);

        // ---- 本次 AI 结果 + 反馈
        const resultCard = document.createElement('section');
        resultCard.className = 'aieq-card';
        const resultTitle = document.createElement('h3');
        resultTitle.className = 'aieq-h3';
        resultTitle.textContent = L('本次 AI 结果', 'Latest AI result');
        const resultBody = document.createElement('div');
        resultBody.style.display = 'flex';
        resultBody.style.flexDirection = 'column';
        resultBody.style.gap = '6px';
        const feedbackRow = document.createElement('div');
        feedbackRow.className = 'aieq-row';
        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.className = 'aieq-btn';
        upButton.textContent = L('👍 喜欢这种调音', '👍 Like this tuning');
        upButton.addEventListener('click', () => {
            if (!state.song) return;
            rateSong(state.song, 1);
        });
        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.className = 'aieq-btn';
        downButton.textContent = L('👎 不喜欢', '👎 Dislike');
        downButton.addEventListener('click', () => {
            if (!state.song) return;
            rateSong(state.song, -1);
        });
        feedbackRow.append(upButton, downButton);
        resultCard.append(resultTitle, resultBody, feedbackRow);

        const hint = document.createElement('div');
        hint.className = 'aieq-hint';

        // ---- 操作
        const actions = document.createElement('div');
        actions.className = 'aieq-row';
        const buttons = {};
        const mkButton = (key, label, handler, primary) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `aieq-btn${primary ? ' primary' : ''}`;
            button.textContent = label;
            button.addEventListener('click', () => {
                void Promise.resolve()
                    .then(handler)
                    .catch((error) => toast(friendlyError(error), 'error'));
            });
            buttons[key] = { node: button, label };
            return button;
        };
        actions.append(
            mkButton('generate', L('为当前歌曲生成', 'Generate for this song'), async () => {
                if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
                await generate(state.song, { force: true, manual: true });
            }, true),
            mkButton('toggle', L('A/B 对比', 'A/B compare'), () => toggleAb()),
            mkButton('release', L('撤销 AI 曲线', 'Remove curve'), async () => {
                try { folium.equalizer.releaseCurve(); } catch (_) { /* 忽略 */ }
                renderAll();
            }),
            mkButton('test', L('测试连接', 'Test connection'), async () => {
                const result = await testConnection();
                toast(result.message, 'success');
            }),
            mkButton('clearCurrent', L('清除本曲记忆', 'Forget this song'), async () => {
                if (!state.key) return;
                state.cache.delete(state.key);
                state.last = null;
                await persistCache();
                renderAll();
                toast(L('已清除本曲的简报与曲线记忆', 'Removed this song from memory'));
            }),
            mkButton('clearAll', L('清除全部记忆', 'Clear memory'), () => runClearCacheCommand().then((message) => toast(message))),
        );

        // ---- 调用与花费
        const statsCard = document.createElement('section');
        statsCard.className = 'aieq-card';
        const statsTitle = document.createElement('h3');
        statsTitle.className = 'aieq-h3';
        statsTitle.textContent = L('调用与花费', 'Calls & cost');
        const statsSongLine = document.createElement('div');
        const statsTotalLine = document.createElement('div');
        const statsNote = document.createElement('div');
        statsNote.className = 'aieq-desc';
        statsNote.textContent = L(
            '只统计本模组发出的请求；花费按设置里的单价估算，缓存命中不算调用。',
            'Counts this mod’s requests only; cost is estimated from the prices in settings. Cache hits are free.',
        );
        statsCard.append(statsTitle, statsSongLine, statsTotalLine, statsNote);

        // ---- 口味学习
        const tasteCard = document.createElement('section');
        tasteCard.className = 'aieq-card';
        const tasteTitle = document.createElement('h3');
        tasteTitle.className = 'aieq-h3';
        tasteTitle.textContent = L('口味学习', 'Taste learning');
        const tasteBody = document.createElement('div');
        tasteBody.style.display = 'flex';
        tasteBody.style.flexDirection = 'column';
        tasteBody.style.gap = '6px';
        const tasteNote = document.createElement('div');
        tasteNote.className = 'aieq-desc';
        tasteNote.textContent = L(
            '你在上面的 👍/👎、以及在「音效」面板里手动切换音效，都会被记下来；之后遇到气质相近的歌会参考。',
            'Your 👍/👎 and manual sound changes are remembered and used for similar songs later.',
        );
        tasteCard.append(tasteTitle, tasteBody, tasteNote);

        // ---- 设置
        const settingsCard = document.createElement('section');
        settingsCard.className = 'aieq-card';
        const settingsTitle = document.createElement('h3');
        settingsTitle.className = 'aieq-h3';
        settingsTitle.textContent = L('设置', 'Settings');
        settingsCard.append(settingsTitle);
        const endpointLine = document.createElement('div');
        endpointLine.className = 'aieq-note';

        const controls = new Map();
        const secret = { input: null, stateText: null };

        const makeField = (def) => {
            const field = document.createElement('div');
            field.className = 'aieq-field';
            const label = document.createElement('div');
            label.className = 'aieq-label';
            label.textContent = String((def.label && (def.label[locale] || def.label['zh-CN'] || def.label.en)) || def.key);
            field.append(label);
            if (def.description) {
                const desc = document.createElement('div');
                desc.className = 'aieq-desc';
                desc.textContent = String(def.description[locale] || def.description['zh-CN'] || def.description.en || '');
                field.append(desc);
            }
            if (def.type === 'secret') {
                const row = document.createElement('div');
                row.className = 'aieq-inline';
                const input = document.createElement('input');
                input.type = 'password';
                input.className = 'aieq-input';
                input.autocomplete = 'off';
                input.spellcheck = false;
                bindFocus(input);
                const save = document.createElement('button');
                save.type = 'button';
                save.className = 'aieq-btn';
                save.textContent = L('保存', 'Save');
                save.addEventListener('click', async () => {
                    const value = input.value.trim();
                    if (!value) return toast(L('请先粘贴 API 密钥', 'Paste an API key first'), 'error');
                    save.disabled = true;
                    try {
                        await folium.secrets.set('apiKey', value);
                        input.value = '';
                        toast(L('API 密钥已保存', 'API key saved'), 'success');
                        await refreshSecret();
                    } catch (error) {
                        toast(friendlyError(error), 'error');
                    } finally {
                        save.disabled = false;
                    }
                });
                const clear = document.createElement('button');
                clear.type = 'button';
                clear.className = 'aieq-btn';
                clear.textContent = L('清除', 'Clear');
                clear.addEventListener('click', async () => {
                    try {
                        await folium.secrets.set('apiKey', null);
                        toast(L('已清除 API 密钥', 'API key cleared'));
                        await refreshSecret();
                    } catch (error) {
                        toast(friendlyError(error), 'error');
                    }
                });
                row.append(input, save, clear);
                field.append(row);
                const stateText = document.createElement('div');
                stateText.className = 'aieq-desc';
                field.append(stateText);
                secret.input = input;
                secret.stateText = stateText;
                return field;
            }
            if (def.type === 'select') {
                const select = document.createElement('select');
                select.className = 'aieq-select';
                for (const option of def.options || []) {
                    const node = document.createElement('option');
                    node.value = option.value;
                    node.textContent = String(option.label[locale] || option.label['zh-CN'] || option.label.en || option.value);
                    select.append(node);
                }
                select.addEventListener('change', () => {
                    try { section.settings.set({ [def.key]: select.value }); } catch (error) { toast(friendlyError(error), 'error'); }
                    renderAll();
                });
                field.append(select);
                bindFocus(select);
                controls.set(def.key, {
                    node: select,
                    set: (value) => { if (!isEditing(select)) select.value = String(value); },
                });
                return field;
            }
            if (def.type === 'boolean') {
                const row = document.createElement('label');
                row.className = 'aieq-check';
                const box = document.createElement('input');
                box.type = 'checkbox';
                const text = document.createElement('span');
                text.textContent = L('开启', 'On');
                row.append(box, text);
                box.addEventListener('change', () => {
                    try {
                        section.settings.set({ [def.key]: box.checked });
                        if (def.key === 'autoApply' && box.checked) {
                            state.userTookOver = false;
                            if (state.song) void generate(state.song, { force: false });
                        }
                    } catch (error) {
                        toast(friendlyError(error), 'error');
                    }
                    renderAll();
                });
                field.append(row);
                bindFocus(box);
                controls.set(def.key, {
                    node: box,
                    set: (value) => { if (!isEditing(box)) box.checked = value === true; },
                });
                return field;
            }
            if (def.type === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'aieq-input';
                if (def.min !== undefined) input.min = String(def.min);
                if (def.max !== undefined) input.max = String(def.max);
                if (def.step !== undefined) input.step = String(def.step);
                bindFocus(input);
                input.addEventListener('change', () => {
                    const number = Number(input.value);
                    if (!Number.isFinite(number)) return;
                    try { section.settings.set({ [def.key]: number }); } catch (error) { toast(friendlyError(error), 'error'); }
                    renderAll();
                });
                field.append(input);
                controls.set(def.key, {
                    node: input,
                    set: (value) => { if (!isEditing(input)) input.value = String(value === undefined ? '' : value); },
                });
                return field;
            }
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'aieq-input';
            if (def.placeholder) input.placeholder = def.placeholder;
            bindFocus(input);
            let timer = null;
            input.addEventListener('input', () => {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => {
                    timer = null;
                    try { section.settings.set({ [def.key]: input.value.trim() }); } catch (error) { toast(friendlyError(error), 'error'); }
                    renderAll();
                }, 500);
            });
            field.append(input);
            controls.set(def.key, {
                node: input,
                set: (value) => { if (!isEditing(input)) input.value = String(value === undefined || value === null ? '' : value); },
            });
            return field;
        };

        const findDef = (key) => SETTINGS.find((def) => def.key === key);
        const groups = [
            { title: L('连接', 'Connection'), keys: ['provider', 'baseUrl', 'model', 'apiKey', 'jsonMode'] },
            { title: L('调节与花费', 'Tuning & cost'), keys: ['strength', 'taste', 'useLyrics', 'priceIn', 'priceOut'] },
            { title: L('自动化', 'Automation'), keys: ['autoApply', 'notify', 'cacheDays'] },
        ];
        for (const group of groups) {
            const box = document.createElement('div');
            box.className = 'aieq-group';
            const groupTitle = document.createElement('div');
            groupTitle.className = 'aieq-label';
            groupTitle.textContent = group.title;
            box.append(groupTitle);
            for (const key of group.keys) {
                const def = findDef(key);
                if (def) box.append(makeField(def));
            }
            if (group === groups[0]) box.append(endpointLine);
            settingsCard.append(box);
            if (group !== groups[groups.length - 1]) {
                const sep = document.createElement('div');
                sep.className = 'aieq-sep';
                settingsCard.append(sep);
            }
        }

        const note = document.createElement('p');
        note.className = 'aieq-note';
        note.textContent = L(
            '启用后播放歌曲时，歌名、歌手、专辑、整首歌词（最多 6000 字）与你的历史口味会发送到你配置的 AI 服务商，可能产生费用。API 密钥只存在本机系统凭据库，不写日志、不进入配置导出。不会上传音频、账号或设备信息。',
            'While enabled, song title/artist/album, full lyrics (up to 6,000 chars) and your taste profile are sent to your AI provider and may incur cost. Your API key stays in the OS credential store; audio, account and device data are never sent.',
        );

        root.append(head, briefCard, graphCard, resultCard, hint, actions, statsCard, tasteCard, settingsCard, note);
        container.append(style, root);

        async function refreshSecret() {
            let has = false;
            try { has = await folium.secrets.has('apiKey'); } catch (_) { has = false; }
            if (!secret.stateText) return;
            secret.stateText.textContent = has ? L('已保存密钥', 'A key is saved') : L('尚未保存密钥', 'No key saved');
            if (secret.input) secret.input.placeholder = has ? '••••••••' : L('粘贴 API Key', 'Paste API key');
        }

        function chips(values, className) {
            return values.map((value) => {
                const node = document.createElement('span');
                node.className = `aieq-chip${className ? ` ${className}` : ''}`;
                node.textContent = String(value);
                return node;
            });
        }

        function renderBrief(entry) {
            const brief = entry && entry.brief ? entry.brief : null;
            if (!state.song) {
                briefSummary.textContent = L('播放一首歌后，这里会显示它的简报。', 'Play a song to see its brief here.');
                briefMeta.replaceChildren();
                energyWrap.style.display = 'none';
                return;
            }
            if (!brief) {
                briefSummary.textContent = entry
                    ? L('模型这次没有返回简报，只给了 EQ 曲线。', 'The model returned no brief this time.')
                    : L('还没有简报：点「为当前歌曲生成」。', 'No brief yet — press Generate.');
                briefMeta.replaceChildren();
                energyWrap.style.display = 'none';
                return;
            }
            briefSummary.textContent = brief.summary || L('（没有一句话概括）', '(no summary)');
            const rows = [];
            const addRow = (label, values, dim) => {
                if (!Array.isArray(values) || !values.length) return;
                const row = document.createElement('div');
                row.className = 'aieq-row';
                const tag = document.createElement('span');
                tag.className = 'aieq-desc';
                tag.textContent = label;
                row.append(tag, ...chips(values, dim ? 'dim' : ''));
                rows.push(row);
            };
            addRow(L('曲风', 'Genre'), entry.genre ? [entry.genre] : [], false);
            addRow(L('情绪', 'Emotion'), brief.emotion, false);
            addRow(L('风格标签', 'Tags'), brief.tags, false);
            addRow(L('意象', 'Imagery'), brief.imagery, true);
            briefMeta.replaceChildren(...rows);
            const energy = Array.isArray(brief.energy) ? brief.energy : [];
            energyWrap.style.display = energy.length >= 2 ? '' : 'none';
            energyBox.replaceChildren(...energy.map((value) => {
                const bar = document.createElement('i');
                bar.style.height = `${Math.max(6, Math.round((Number(value) || 0) * 100))}%`;
                return bar;
            }));
        }

        function render() {
            const snapshot = eqState();
            const conf = cfg();
            const entry = state.last && state.last.key === state.key ? state.last : (state.key ? getEntryForPanel() : null);
            songLine.textContent = state.song ? songTitle(state.song) : L('当前没有播放歌曲', 'No song is playing');

            const pillNodes = [];
            const addPill = (text, warn) => {
                const node = document.createElement('span');
                node.className = `aieq-pill${warn ? ' warn' : ''}`;
                node.textContent = text;
                pillNodes.push(node);
            };
            if (snapshot) {
                addPill(modeText(snapshot.mode));
                addPill(snapshot.enabled ? L('均衡器总开关：开', 'Processing: on') : L('均衡器总开关：关', 'Processing: off'), !snapshot.enabled);
                if (!snapshot.writable) addPill(L('音频效果器窗口打开中', 'Audio effects window open'), true);
                if (!snapshot.hostPlaysAudio) addPill(L('外部 Stage 播放：均衡器不作用', 'External Stage playback'), true);
            } else {
                addPill(L('均衡器不可用', 'Equalizer unavailable'), true);
            }
            if (state.userTookOver) addPill(L('已让位给你：自动施加暂停', 'Paused after your change'), true);
            if (state.pendingApply) addPill(L('曲线待写入（等窗口关闭）', 'Waiting to write'), true);
            if (state.busy) addPill(L('正在请求大模型…', 'Asking the model…'));
            addPill(L(`记忆 ${state.cache.size} 首`, `${state.cache.size} remembered`));
            pills.replaceChildren(...pillNodes);

            renderBrief(entry);

            const genreValue = state.song ? genreFor(state.song) : '';
            if (!isEditing(genreInput)) genreInput.value = genreValue;
            genreText.textContent = state.song
                ? (genreValue ? L('当前曲风：' + genreValue, `Genre: ${genreValue}`) : L('曲风未知，保存后会随请求发给模型', 'Genre unknown; a saved value is sent with requests'))
                : '';
            genreSave.disabled = !state.song;
            genreRegen.disabled = !state.song || state.busy;

            const bandList = snapshot && Array.isArray(snapshot.bands) && snapshot.bands.length ? snapshot.bands : FALLBACK_BANDS;
            const gains = snapshot && Array.isArray(snapshot.gains) ? snapshot.gains : [];
            const extreme = Math.max(1, Math.abs(Number(snapshot && snapshot.minGain) || 12), Math.abs(Number(snapshot && snapshot.maxGain) || 12));
            graph.style.gridTemplateColumns = `repeat(${bandList.length}, minmax(0, 1fr))`;
            graph.replaceChildren(...bandList.map((band, index) => {
                const db = Number(gains[index]) || 0;
                const cell = document.createElement('div');
                cell.className = 'aieq-band';
                const track = document.createElement('div');
                track.className = 'aieq-track';
                const bar = document.createElement('div');
                bar.className = `aieq-bar${db < 0 ? ' neg' : ''}`;
                bar.style.height = `${Math.max(2, Math.round((Math.abs(db) / extreme) * 100))}%`;
                track.append(bar);
                const value = document.createElement('div');
                value.className = 'aieq-db';
                value.textContent = formatDb(db);
                const hz = document.createElement('div');
                hz.className = 'aieq-hz';
                hz.textContent = frequencyText(band.frequency);
                cell.append(track, value, hz);
                return cell;
            }));

            const resultNodes = [];
            const line = (text, className) => {
                const node = document.createElement('div');
                if (className) node.className = className;
                node.textContent = text;
                resultNodes.push(node);
            };
            if (entry) {
                const source = entry.source === 'cache' ? L('记忆', 'memory') : entry.source === 'manual' ? L('手动', 'manual') : L('AI 生成', 'AI');
                line(`${L('来源', 'Source')}：${source}${entry.model ? ` · ${entry.model}` : ''}`);
                line(`${L('EQ 说明', 'EQ note')}：${entry.reason || L('（模型没有给出说明）', '(no reason given)')}`);
                line(`${L('置信度', 'Confidence')}：${Math.round((Number(entry.confidence) || 0) * 100)}%${entry.adjusted ? L('（已限幅/平滑）', ' (clamped/smoothed)') : ''}`);
                if (entry.curve) line(`${L('曲线', 'Curve')}：${entry.curve.map((item) => formatDb(item)).join('  ')}`);
            } else if (state.song) {
                line(L('这首歌还没有 AI 记忆，点「为当前歌曲生成」。', 'No memory for this song yet — press Generate.'));
            } else {
                line(L('播放一首歌后自动生成。', 'Play a song to generate.'));
            }
            if (state.error) line(`${L('最近错误', 'Last error')}：${state.error}`, 'aieq-err');
            resultBody.replaceChildren(...resultNodes);

            const identity = state.song ? songIdentity(state.song) : '';
            const rating = identity && state.taste.ratings[identity] ? Number(state.taste.ratings[identity].value) : 0;
            upButton.className = `aieq-btn${rating === 1 ? ' active' : ''}`;
            downButton.className = `aieq-btn${rating === -1 ? ' active' : ''}`;
            upButton.disabled = !state.song;
            downButton.disabled = !state.song;

            let hintText = '';
            if (!state.cacheLoaded) hintText = L('正在读取记忆…', 'Loading memory…');
            else if (state.userTookOver) hintText = L('你在音效面板里改过音效，自动施加已暂停。重新打开上面的「换歌时自动施加」即可恢复。', 'You changed the sound manually, so auto-apply is paused. Turn “Apply on song change” back on to resume.');
            else if (snapshot && snapshot.enabled === false) hintText = L('均衡器总开关是关的：曲线会被保存但听不到，请到「音效」里打开。', 'The equalizer master switch is off, so curves are saved but inaudible.');
            else if (state.pendingApply) hintText = L('音频效果器窗口开着，曲线等窗口关闭后自动写入。', 'The audio effects window is open; the curve is written once it closes.');
            hint.textContent = hintText;
            hint.className = `aieq-hint${hintText ? ' show' : ''}`;

            buttons.generate.node.disabled = state.busy || !state.song;
            buttons.toggle.node.disabled = state.busy || !state.song;
            buttons.release.node.disabled = !snapshot;
            buttons.test.node.disabled = state.busy;
            buttons.clearCurrent.node.disabled = !state.key;
            buttons.clearAll.node.disabled = state.busy || state.cache.size === 0;

            const perSong = songStats(identity);
            const perSongTokens = (Number(perSong.promptTokens) || 0) + (Number(perSong.completionTokens) || 0);
            statsSongLine.className = 'aieq-kv';
            statsSongLine.replaceChildren(
                (() => { const s = document.createElement('span'); s.textContent = L('本曲', 'This song'); return s; })(),
                (() => {
                    const s = document.createElement('span');
                    s.textContent = perSong.calls
                        ? L(`${perSong.calls} 次 · ${fmtInt(perSongTokens)} tokens · ${money(perSong.cost)}`, `${perSong.calls} calls · ${fmtInt(perSongTokens)} tokens · ${money(perSong.cost)}`)
                        : L('还没有调用', 'no calls yet');
                    return s;
                })(),
            );
            const totalTokens = (Number(state.stats.promptTokens) || 0) + (Number(state.stats.completionTokens) || 0);
            statsTotalLine.className = 'aieq-kv';
            statsTotalLine.replaceChildren(
                (() => { const s = document.createElement('span'); s.textContent = L('累计', 'Total'); return s; })(),
                (() => {
                    const s = document.createElement('span');
                    s.textContent = L(
                        `${state.stats.calls} 次 · ${fmtInt(totalTokens)} tokens · ${money(state.stats.cost)}`,
                        `${state.stats.calls} calls · ${fmtInt(totalTokens)} tokens · ${money(state.stats.cost)}`,
                    );
                    return s;
                })(),
            );

            const tasteRows = [];
            const tasteLine = (text) => {
                const node = document.createElement('div');
                node.className = 'aieq-kv';
                node.textContent = text;
                tasteRows.push(node);
            };
            tasteLine(L(`评价：👍 ${state.taste.up} · 👎 ${state.taste.down} · 手动切换音效 ${state.taste.takeovers} 次`,
                `Ratings: 👍 ${state.taste.up} · 👎 ${state.taste.down} · ${state.taste.takeovers} manual switches`));
            const likedTags = Object.entries(state.taste.tags)
                .map(([tag, stat]) => ({ tag, net: (Number(stat.up) || 0) - (Number(stat.down) || 0) }))
                .filter((item) => item.net > 0)
                .sort((a, b) => b.net - a.net)
                .slice(0, 5)
                .map((item) => item.tag);
            if (likedTags.length) tasteLine(L(`你喜欢的标签：${likedTags.join('、')}`, `Liked tags: ${likedTags.join(', ')}`));
            const modes = Object.entries(state.taste.modes)
                .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
                .slice(0, 3)
                .map(([key, count]) => `${modeKeyLabel(key)}×${count}`);
            if (modes.length) tasteLine(L(`常手动切到：${modes.join('、')}`, `Often switches to: ${modes.join(', ')}`));
            if (!tasteRows.length) {
                const empty = document.createElement('div');
                empty.className = 'aieq-desc';
                empty.textContent = L('还没有记录。给几首歌点点 👍/👎，或在音效里手动切换几次。', 'Nothing recorded yet.');
                tasteRows.push(empty);
            }
            tasteBody.replaceChildren(...tasteRows);

            for (const [key, control] of controls) control.set(conf[key]);
            const resolved = resolveProvider(conf);
            const endpoint = validateEndpoint(resolved.base);
            endpointLine.textContent = endpoint.error
                ? `${L('当前接口', 'Endpoint')}：${endpoint.error}`
                : `${L('当前接口', 'Endpoint')}：${endpoint.url} · ${resolved.model || L('（未填模型）', '(no model)')} · ${bandList.length} 段`;
            void refreshSecret();
        }

        // 面板里读取当前歌曲的缓存条目（简报/花费展示用；不触发网络）。
        function getEntryForPanel() {
            return state.key ? cacheGet(state.key) : null;
        }

        render();
        state.renderers.add(render);
        const offSettings = (() => {
            try { return section.settings.onChange(() => renderAll()); } catch (_) { return () => {}; }
        })();
        const offCtx = (() => {
            try { return ctx.onChange(() => renderAll()); } catch (_) { return () => {}; }
        })();

        return () => {
            state.renderers.delete(render);
            try { offSettings(); } catch (_) { /* 忽略 */ }
            try { offCtx(); } catch (_) { /* 忽略 */ }
            style.remove();
            root.remove();
        };
    }

    // ---------------------------------------------------------------- 播放页入口（进度条按钮 + AI EQ 面板）

    /**
     * 播放页进度条右侧的小按钮：点它打开播放器面板里的「AI EQ」标签页。
     * 当前在位的如果是本模组的曲线，按钮会高亮。
     */
    function mountProgressButton(container, ctx) {
        const style = document.createElement('style');
        style.textContent = `
.aieq-prog-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; padding:0; border:0; border-radius:6px; background:transparent; color:inherit; cursor:pointer; opacity:.72; transition:opacity .15s, background .15s; }
.aieq-prog-btn:hover { opacity:1; background: color-mix(in srgb, currentColor 12%, transparent); }
.aieq-prog-btn:focus-visible { outline:2px solid var(--folium-accent, #6b8afd); outline-offset:2px; }
.aieq-prog-btn.active { opacity:1; color: var(--folium-accent, #6b8afd); }
.aieq-prog-btn svg { width:17px; height:17px; }
`;
        // 和参考模组 song-info 一样用内联 SVG：不依赖宿主的图标集合，颜色跟随进度条文字色。
        const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="4" x2="14" y2="4"></line><line x1="10" y1="4" x2="3" y2="4"></line><line x1="21" y1="12" x2="12" y2="12"></line><line x1="8" y1="12" x2="3" y2="12"></line><line x1="21" y1="20" x2="16" y2="20"></line><line x1="12" y1="20" x2="3" y2="20"></line><line x1="14" y1="2" x2="14" y2="6"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="16" y1="18" x2="16" y2="22"></line></svg>';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'aieq-prog-btn';
        try { button.innerHTML = ICON; } catch (_) { button.textContent = 'EQ'; }

        const setLabel = (ours) => {
            const text = ours
                ? tr('AI 智能 EQ（正在使用 AI 曲线）：打开面板', 'AI EQ (AI curve active): open panel')
                : tr('AI 智能 EQ：打开面板', 'AI EQ: open panel');
            button.title = text;
            try { button.setAttribute('aria-label', text); } catch (_) { /* 忽略 */ }
            button.className = `aieq-prog-btn${ours ? ' active' : ''}`;
        };

        button.addEventListener('click', () => {
            try {
                folium.ui.openPlayerPanel('eq');
            } catch (error) {
                toast(friendlyError(error), 'error');
            }
        });

        const safeOn = (type, handler) => {
            try { return folium.events.on(type, handler); } catch (_) { return () => {}; }
        };
        const update = () => {
            const snapshot = eqState();
            const ours = !!(snapshot && snapshot.mode && snapshot.mode.kind === 'mod' && snapshot.mode.modId === folium.modId);
            setLabel(ours);
        };

        // 参考 song-info 的做法：窗口极小（迷你播放条）时先藏起来，给进度条留空间。
        const isMini = () => (typeof window !== 'undefined')
            && (window.innerWidth < 600 || window.innerHeight < 220);
        const applyMini = () => {
            button.style.display = isMini() ? 'none' : '';
        };
        const onResize = () => applyMini();
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('resize', onResize);
        }

        const offEqualizer = safeOn('equalizer.changed', update);
        const offSong = safeOn('playback.songChanged', update);

        container.append(style, button);
        applyMini();
        update();

        const dispose = () => {
            try { offEqualizer(); } catch (_) { /* 忽略 */ }
            try { offSong(); } catch (_) { /* 忽略 */ }
            if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
                window.removeEventListener('resize', onResize);
            }
            style.remove();
            button.remove();
        };
        try { ctx.onDispose(dispose); } catch (_) { /* 忽略 */ }
        return dispose;
    }

    /**
     * 播放器面板里的「AI EQ」标签页：当前 EQ、歌曲标签、我的评价、快捷操作与花费。
     */
    function mountPlayerPanel(container, ctx) {
        const locale = String((ctx && ctx.locale) || 'zh-CN');
        const en = locale.toLowerCase().startsWith('en');
        const L = (zh, enText) => (en ? enText : zh);

        const style = document.createElement('style');
        style.textContent = `${CSS}\n.aieq-mini .aieq-track { height:56px; }\n.aieq-mini { padding:2px 2px 8px; }`;
        const root = document.createElement('div');
        root.className = 'aieq aieq-mini';
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        root.style.gap = '14px';

        const head = document.createElement('div');
        head.className = 'aieq-head';
        const title = document.createElement('div');
        title.className = 'aieq-title';
        title.textContent = L('AI 智能 EQ', 'AI EQ');
        const songLine = document.createElement('div');
        songLine.className = 'aieq-song';
        head.append(title, songLine);

        const eqCard = document.createElement('section');
        eqCard.className = 'aieq-card';
        const eqTitle = document.createElement('h3');
        eqTitle.className = 'aieq-h3';
        eqTitle.textContent = L('当前 EQ', 'Current EQ');
        const eqPills = document.createElement('div');
        eqPills.className = 'aieq-pills';
        const graph = document.createElement('div');
        graph.className = 'aieq-graph';
        eqCard.append(eqTitle, eqPills, graph);

        const tagsCard = document.createElement('section');
        tagsCard.className = 'aieq-card';
        const tagsTitle = document.createElement('h3');
        tagsTitle.className = 'aieq-h3';
        tagsTitle.textContent = L('歌曲标签', 'Song tags');
        const tagsBody = document.createElement('div');
        tagsBody.style.display = 'flex';
        tagsBody.style.flexDirection = 'column';
        tagsBody.style.gap = '8px';
        tagsCard.append(tagsTitle, tagsBody);

        const ratingCard = document.createElement('section');
        ratingCard.className = 'aieq-card';
        const ratingTitle = document.createElement('h3');
        ratingTitle.className = 'aieq-h3';
        ratingTitle.textContent = L('我的评价', 'My rating');
        const ratingLine = document.createElement('div');
        const ratingRow = document.createElement('div');
        ratingRow.className = 'aieq-row';
        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.className = 'aieq-btn';
        upButton.textContent = L('👍 喜欢这种调音', '👍 Like this tuning');
        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.className = 'aieq-btn';
        downButton.textContent = L('👎 不喜欢', '👎 Dislike');
        ratingRow.append(upButton, downButton);
        const ratingNote = document.createElement('div');
        ratingNote.className = 'aieq-desc';
        ratingNote.textContent = L(
            '评价会影响之后气质相近歌曲的调音；你在「音效」里手动切换也会被记录。',
            'Ratings shape later similar songs; manual sound changes are recorded too.',
        );
        ratingCard.append(ratingTitle, ratingLine, ratingRow, ratingNote);

        upButton.addEventListener('click', () => {
            if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
            rateSong(state.song, 1);
        });
        downButton.addEventListener('click', () => {
            if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
            rateSong(state.song, -1);
        });

        const actions = document.createElement('div');
        actions.className = 'aieq-row';
        const makeAction = (label, handler, primary) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `aieq-btn${primary ? ' primary' : ''}`;
            button.textContent = label;
            button.addEventListener('click', () => {
                void Promise.resolve().then(handler).catch((error) => toast(friendlyError(error), 'error'));
            });
            return button;
        };
        const generateButton = makeAction(L('生成简报与曲线', 'Generate brief & curve'), async () => {
            if (!state.song) return toast(L('先播放一首歌', 'Play a song first'), 'error');
            await generate(state.song, { force: true, manual: true });
        }, true);
        const abButton = makeAction(L('A/B 对比', 'A/B compare'), () => toggleAb());
        const releaseButton = makeAction(L('撤销 AI 曲线', 'Remove curve'), async () => {
            try { folium.equalizer.releaseCurve(); } catch (_) { /* 忽略 */ }
            renderAll();
        });
        actions.append(generateButton, abButton, releaseButton);

        const statsLine = document.createElement('div');
        statsLine.className = 'aieq-note';

        root.append(head, eqCard, tagsCard, ratingCard, actions, statsLine);
        container.append(style, root);

        function chips(values, dim) {
            return (Array.isArray(values) ? values : []).map((value) => {
                const node = document.createElement('span');
                node.className = `aieq-chip${dim ? ' dim' : ''}`;
                node.textContent = String(value);
                return node;
            });
        }

        function renderGraph(snapshot) {
            const bandList = snapshot && Array.isArray(snapshot.bands) && snapshot.bands.length ? snapshot.bands : FALLBACK_BANDS;
            const gains = snapshot && Array.isArray(snapshot.gains) ? snapshot.gains : [];
            const extreme = Math.max(1, Math.abs(Number(snapshot && snapshot.minGain) || 12), Math.abs(Number(snapshot && snapshot.maxGain) || 12));
            graph.style.gridTemplateColumns = `repeat(${bandList.length}, minmax(0, 1fr))`;
            graph.replaceChildren(...bandList.map((band, index) => {
                const db = Number(gains[index]) || 0;
                const cell = document.createElement('div');
                cell.className = 'aieq-band';
                const track = document.createElement('div');
                track.className = 'aieq-track';
                const bar = document.createElement('div');
                bar.className = `aieq-bar${db < 0 ? ' neg' : ''}`;
                bar.style.height = `${Math.max(2, Math.round((Math.abs(db) / extreme) * 100))}%`;
                track.append(bar);
                const value = document.createElement('div');
                value.className = 'aieq-db';
                value.textContent = formatDb(db);
                const hz = document.createElement('div');
                hz.className = 'aieq-hz';
                hz.textContent = frequencyText(band.frequency);
                cell.append(track, value, hz);
                return cell;
            }));
        }

        function renderTags(entry) {
            const brief = entry && entry.brief ? entry.brief : null;
            const rows = [];
            const addRow = (label, values, dim) => {
                if (!Array.isArray(values) || !values.length) return;
                const row = document.createElement('div');
                row.className = 'aieq-row';
                const tag = document.createElement('span');
                tag.className = 'aieq-desc';
                tag.textContent = label;
                row.append(tag, ...chips(values, dim));
                rows.push(row);
            };
            if (!state.song) {
                const empty = document.createElement('div');
                empty.className = 'aieq-desc';
                empty.textContent = L('播放一首歌后这里显示它的曲风、情绪、标签与意象。', 'Play a song to see its genre, mood, tags and imagery.');
                rows.push(empty);
            } else if (!brief) {
                const empty = document.createElement('div');
                empty.className = 'aieq-desc';
                empty.textContent = L('还没有简报：点下面的「生成简报与曲线」。', 'No brief yet — press Generate below.');
                rows.push(empty);
            } else {
                addRow(L('曲风', 'Genre'), entry.genre ? [entry.genre] : [], false);
                addRow(L('情绪', 'Emotion'), brief.emotion, false);
                addRow(L('标签', 'Tags'), brief.tags, false);
                addRow(L('意象', 'Imagery'), brief.imagery, true);
                const energy = Array.isArray(brief.energy) ? brief.energy : [];
                if (energy.length >= 2) {
                    const wrap = document.createElement('div');
                    wrap.style.display = 'flex';
                    wrap.style.flexDirection = 'column';
                    wrap.style.gap = '4px';
                    const label = document.createElement('div');
                    label.className = 'aieq-desc';
                    label.textContent = L('能量起伏', 'Energy arc');
                    const box = document.createElement('div');
                    box.className = 'aieq-energy';
                    box.replaceChildren(...energy.map((value) => {
                        const bar = document.createElement('i');
                        bar.style.height = `${Math.max(6, Math.round((Number(value) || 0) * 100))}%`;
                        return bar;
                    }));
                    wrap.append(label, box);
                    rows.push(wrap);
                }
            }
            tagsBody.replaceChildren(...rows);
        }

        function render() {
            const snapshot = eqState();
            songLine.textContent = state.song
                ? songTitle(state.song)
                : L('当前没有播放歌曲', 'No song is playing');

            const pillNodes = [];
            const addPill = (text, warn) => {
                const node = document.createElement('span');
                node.className = `aieq-pill${warn ? ' warn' : ''}`;
                node.textContent = text;
                pillNodes.push(node);
            };
            if (snapshot) {
                addPill(modeText(snapshot.mode));
                addPill(snapshot.enabled ? L('总开关：开', 'Processing: on') : L('总开关：关', 'Processing: off'), !snapshot.enabled);
                if (!snapshot.hostPlaysAudio) addPill(L('外部 Stage：不作用', 'External stage'), true);
                if (!snapshot.writable) addPill(L('音频效果器开着', 'Effects panel open'), true);
            } else {
                addPill(L('均衡器不可用', 'Equalizer unavailable'), true);
            }
            eqPills.replaceChildren(...pillNodes);
            renderGraph(snapshot);

            const entry = currentEntry();
            renderTags(entry);

            const identity = state.song ? songIdentity(state.song) : '';
            const rating = identity && state.taste.ratings[identity] ? Number(state.taste.ratings[identity].value) : 0;
            ratingLine.textContent = rating === 1
                ? L('你喜欢这种调音 👍', 'You like this tuning 👍')
                : rating === -1
                    ? L('你不喜欢这种调音 👎', 'You dislike this tuning 👎')
                    : L('还没评价', 'No rating yet');
            upButton.className = `aieq-btn${rating === 1 ? ' active' : ''}`;
            downButton.className = `aieq-btn${rating === -1 ? ' active' : ''}`;
            upButton.disabled = !state.song;
            downButton.disabled = !state.song;
            generateButton.disabled = !state.song || state.busy;
            abButton.disabled = !state.song || state.busy;
            releaseButton.disabled = !snapshot;

            const perSong = songStats(identity);
            const perSongTokens = (Number(perSong.promptTokens) || 0) + (Number(perSong.completionTokens) || 0);
            const totalTokens = (Number(state.stats.promptTokens) || 0) + (Number(state.stats.completionTokens) || 0);
            statsLine.textContent = L(
                `本曲 ${perSong.calls} 次 · ${fmtInt(perSongTokens)} tokens · ${money(perSong.cost)}　｜　累计 ${state.stats.calls} 次 · ${fmtInt(totalTokens)} tokens · ${money(state.stats.cost)}`,
                `This song: ${perSong.calls} calls · ${fmtInt(perSongTokens)} tokens · ${money(perSong.cost)} | Total: ${state.stats.calls} calls · ${fmtInt(totalTokens)} tokens · ${money(state.stats.cost)}`,
            );
        }

        render();
        state.renderers.add(render);
        const offCtx = (() => {
            try { return ctx.onChange(() => renderAll()); } catch (_) { return () => {}; }
        })();
        const dispose = () => {
            state.renderers.delete(render);
            try { offCtx(); } catch (_) { /* 忽略 */ }
            style.remove();
            root.remove();
        };
        try { ctx.onDispose(dispose); } catch (_) { /* 忽略 */ }
        return dispose;
    }

    // ---------------------------------------------------------------- 启动

    const commands = [
        {
            id: 'generate',
            label: { 'zh-CN': 'AI EQ：为当前歌曲生成简报与曲线', en: 'AI EQ: brief & curve' },
            description: { 'zh-CN': '忽略记忆，重新让模型读整首歌词、写简报并施加曲线。', en: 'Ask the model again, ignoring memory.' },
            run: () => runGenerateCommand(),
        },
        {
            id: 'toggle-ab',
            label: { 'zh-CN': 'AI EQ：A/B 对比（AI 曲线 / 我的音效）', en: 'AI EQ: A/B compare' },
            description: { 'zh-CN': '在 AI 曲线和你自己的音效之间来回切换。', en: 'Switch between the AI curve and your own sound.' },
            run: () => runToggleCommand(),
        },
        {
            id: 'release',
            label: { 'zh-CN': 'AI EQ：撤销 AI 曲线', en: 'AI EQ: remove curve' },
            description: { 'zh-CN': '撤下本模组的曲线，回到你自己的音效。', en: 'Take this mod’s curve off.' },
            run: () => runReleaseCommand(),
        },
        {
            id: 'test',
            label: { 'zh-CN': 'AI EQ：测试 API 连接', en: 'AI EQ: test connection' },
            description: { 'zh-CN': '用当前接口和密钥发一个最小请求。', en: 'Send a minimal request to check endpoint, key and model.' },
            run: () => runTestCommand(),
        },
        {
            id: 'clear-cache',
            label: { 'zh-CN': 'AI EQ：清除歌曲记忆', en: 'AI EQ: clear song memory' },
            description: { 'zh-CN': '删除缓存的简报/曲线与曲风记录（口味与统计保留）。', en: 'Delete cached briefs, curves and genres; taste and stats are kept.' },
            run: () => runClearCacheCommand(),
        },
        {
            id: 'reset-taste',
            label: { 'zh-CN': 'AI EQ：重置口味学习', en: 'AI EQ: reset taste learning' },
            description: { 'zh-CN': '清除 👍/👎 与手动切换音效的记录。', en: 'Clear ratings and manual switch records.' },
            run: () => runResetTasteCommand(),
        },
        {
            id: 'reset-stats',
            label: { 'zh-CN': 'AI EQ：重置调用统计', en: 'AI EQ: reset call stats' },
            description: { 'zh-CN': '清除调用次数、token 与花费统计。', en: 'Clear call/token/cost stats.' },
            run: () => runResetStatsCommand(),
        },
    ];

    for (const def of commands) {
        try {
            folium.registries.commands.register(def);
        } catch (error) {
            folium.log.warn('[ai-eq] 注册命令失败：' + def.id, String((error && error.message) || error));
        }
    }

    // 播放页进度条右侧的信息按钮：点它打开播放器面板里的「AI EQ」标签页。
    try {
        folium.registries.progressButtons.register({
            id: 'open-panel',
            slot: 'progress.trailing',
            order: 120,
            mount: (container, ctx) => mountProgressButton(container, ctx),
        });
    } catch (error) {
        folium.log.warn('[ai-eq] 注册进度条按钮失败', String((error && error.message) || error));
    }

    // 播放器面板里的「AI EQ」标签页：当前 EQ / 歌曲标签 / 我的评价 / 花费。
    try {
        folium.registries.playerPanelTabs.register({
            id: 'eq',
            label: { 'zh-CN': 'AI EQ', en: 'AI EQ' },
            order: 400,
            mount: (container, ctx) => mountPlayerPanel(container, ctx),
        });
    } catch (error) {
        folium.log.warn('[ai-eq] 注册播放器面板标签页失败', String((error && error.message) || error));
    }

    try {
        folium.events.on('playback.songChanged', (event) => {
            try {
                onSong(event && event.song ? event.song : null);
            } catch (error) {
                folium.log.warn('[ai-eq] 处理换歌事件失败', String((error && error.message) || error));
            }
        });
    } catch (error) {
        folium.log.error('[ai-eq] 订阅换歌事件失败', String((error && error.message) || error));
    }

    try {
        folium.events.on('equalizer.changed', (event) => {
            try {
                onEqualizer(event && event.state ? event.state : null, event && event.origin ? event.origin : null);
            } catch (error) {
                folium.log.warn('[ai-eq] 处理均衡器事件失败', String((error && error.message) || error));
            }
        });
    } catch (error) {
        folium.log.error('[ai-eq] 订阅均衡器事件失败', String((error && error.message) || error));
    }

    const bootTimer = setTimeout(() => {
        if (state.disposed) return;
        let current = null;
        try {
            const playback = folium.playback.getState();
            current = playback && playback.song ? playback.song : null;
        } catch (error) {
            folium.log.warn('[ai-eq] 读取当前歌曲失败', String((error && error.message) || error));
        }
        void (async () => {
            await loadCache();
            await loadGenres();
            await loadTaste();
            await loadStats();
            if (state.disposed) return;
            if (current) onSong(current);
            renderAll();
        })();
    }, TUNING.bootDelay);

    function dispose() {
        if (state.disposed) return;
        state.disposed = true;
        clearTimeout(bootTimer);
        if (state.generateTimer) clearTimeout(state.generateTimer);
        if (state.retryTimer) clearTimeout(state.retryTimer);
        if (state.saveTimer) clearTimeout(state.saveTimer);
        if (state.genresSaveTimer) clearTimeout(state.genresSaveTimer);
        if (state.tasteSaveTimer) clearTimeout(state.tasteSaveTimer);
        if (state.statsSaveTimer) clearTimeout(state.statsSaveTimer);
        state.renderers.clear();
    }

    try { folium.onDispose(dispose); } catch (_) { /* 忽略 */ }
    return dispose;
}
