// song-info/client.mjs — 歌曲资料 v2.5.3（多源检索与 AI 解析修复版）
// 播放页进度条右侧信息按钮 → 打开「歌曲资料」面板页签。
// 数据源（在模组管理设置中选择）：
//   默认「公开检索」：并发检索公开来源，按完成速度采用有效结果
//   「AI 检索」：把歌曲信息与公开检索片段发给 OpenAI 兼容接口（DeepSeek 等），返回结构化资料
// 仅在面板打开时查询；成功结果按歌曲+歌手+配置缓存。
const INFO_SVG =
  '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

const WIKI_ZH = "https://zh.wikipedia.org/w/api.php";
const WIKI_EN = "https://en.wikipedia.org/w/api.php";
const MB_API = "https://musicbrainz.org/ws/2/recording/?fmt=json&limit=3&query=";
const BAKE = "https://baike.baidu.com/item/";
const CACHE_KEY = "si-cache-v2";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 仅成功结果缓存 30 天
const API_KEY_STORAGE = "si-api-key";
const CACHE_MAX_BYTES = 420 * 1024; // 为宿主 1 MB storage 留出余量
const MB_USER_AGENT = "Folium-SongInfo/2.5.3 (https://github.com/folium-mods/song-info)";

// 网络请求：不伪装浏览器 UA/Referer（使用宿主默认真实请求头），同源限流防止高频抓取导致 IP 被封。
const RATE_MS = 600;
const lastReqAt = new Map();
function limitedFetch(folium, url, options) {
  let host = "";
  try { host = new URL(url).host; } catch (_) {}
  const opts = options || {};
  if (!host) return folium.net.fetch(url, opts);
  const now = Date.now();
  const last = lastReqAt.get(host) || 0;
  const wait = Math.max(0, last + RATE_MS - now);
  lastReqAt.set(host, now + wait);
  // 防止 map 无限增长（来源主机有限，但长期运行仍做上限保护，按插入顺序淘汰最旧项）
  if (lastReqAt.size > 64) { const oldest = lastReqAt.keys().next().value; lastReqAt.delete(oldest); }
  if (wait > 0) {
    return new Promise((resolve) => setTimeout(resolve, wait)).then(() => folium.net.fetch(url, opts));
  }
  return folium.net.fetch(url, opts);
}

// 诊断日志：公开检索每个来源的状态码/长度/解析结果，便于排查来源失效
const logDiag = (folium, msg) => {
  try {
    if (folium && folium.log) {
      if (typeof folium.log.info === "function") folium.log.info("[song-info] " + msg);
      else if (typeof folium.log.warn === "function") folium.log.warn("[song-info-diag] " + msg);
    }
  } catch (_) {}
};

const enc = encodeURIComponent;
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const unent = (s) =>
  String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

// 常用繁体 → 简体 映射（已去重并移除简繁同字，公开检索模式无 AI 时的离线简繁转换）
const T2S = {
  "這": "这", "說": "说", "話": "话", "們": "们", "國": "国", "為": "为", "麼": "么", "個": "个",
  "時": "时", "間": "间", "裡": "里", "嗎": "吗", "沒": "没", "對": "对", "來": "来", "從": "从",
  "後": "后", "發": "发", "會": "会", "學": "学", "東": "东", "車": "车", "電": "电", "點": "点",
  "開": "开", "關": "关", "門": "门", "問": "问", "題": "题", "還": "还", "過": "过", "當": "当",
  "應": "应", "樣": "样", "現": "现", "讓": "让", "誰": "谁", "聽": "听", "樂": "乐", "華": "华",
  "風": "风", "雲": "云", "馬": "马", "魚": "鱼", "鳥": "鸟", "龍": "龙", "萬": "万", "與": "与",
  "於": "于", "並": "并", "兩": "两", "幾": "几", "體": "体", "戰": "战", "師": "师", "軍": "军",
  "產": "产", "業": "业", "實": "实", "寶": "宝", "寫": "写", "讀": "读", "記": "记", "認": "认",
  "識": "识", "謝": "谢", "請": "请", "講": "讲", "論": "论", "議": "议", "評": "评", "詞": "词",
  "詩": "诗", "語": "语", "譯": "译", "試": "试", "設": "设", "計": "计", "許": "许", "證": "证",
  "訴": "诉", "調": "调", "訪": "访", "該": "该", "謂": "谓", "買": "买", "賣": "卖", "錢": "钱",
  "銀": "银", "鐵": "铁", "鋼": "钢", "銅": "铜", "鉛": "铅", "長": "长", "張": "张", "劉": "刘",
  "陳": "陈", "楊": "杨", "黃": "黄", "週": "周", "歲": "岁", "曆": "历", "歷": "历", "舊": "旧",
  "變": "变", "愛": "爱", "懷": "怀", "戀": "恋", "願": "愿", "驚": "惊", "歡": "欢", "慶": "庆",
  "廣": "广", "廟": "庙", "鄉": "乡", "縣": "县", "鎮": "镇", "陽": "阳", "陰": "阴", "隊": "队",
  "險": "险", "驗": "验", "觀": "观", "視": "视", "覺": "觉", "觸": "触", "課": "课", "習": "习",
  "練": "练", "劇": "剧", "戲": "戏", "臺": "台", "燈": "灯", "熱": "热", "煙": "烟", "燒": "烧",
  "畫": "画", "盡": "尽", "絕": "绝", "結": "结", "給": "给", "經": "经", "績": "绩", "繼": "继",
  "續": "续", "繩": "绳", "網": "网", "線": "线", "編": "编", "織": "织", "組": "组", "約": "约",
  "級": "级", "紀": "纪", "紅": "红", "綠": "绿", "藍": "蓝", "纖": "纤", "緻": "致", "純": "纯",
  "紙": "纸", "終": "终", "紹": "绍", "統": "统", "總": "总", "聯": "联", "聖": "圣", "聞": "闻",
  "職": "职", "聲": "声", "臉": "脸", "腳": "脚", "腦": "脑", "腸": "肠", "髒": "脏", "讚": "赞",
  "邊": "边", "達": "达", "遠": "远", "進": "进", "遷": "迁", "遲": "迟", "選": "选", "郵": "邮",
  "醫": "医", "釀": "酿", "釋": "释", "錄": "录", "鎖": "锁", "錯": "错", "鏡": "镜", "鐘": "钟",
  "鏈": "链", "閉": "闭", "閃": "闪", "閣": "阁", "閱": "阅", "隻": "只", "雙": "双", "難": "难",
  "離": "离", "雜": "杂", "靈": "灵", "靜": "静", "響": "响", "頭": "头", "類": "类", "顯": "显",
  "館": "馆", "餅": "饼", "飲": "饮", "飯": "饭", "餃": "饺", "飽": "饱", "餘": "余", "餓": "饿",
  "鳴": "鸣", "麥": "麦", "麵": "面", "齊": "齐", "齒": "齿", "齡": "龄", "龜": "龟", "黨": "党",
  "內": "内", "冊": "册", "刪": "删", "創": "创", "剛": "刚", "別": "别", "劍": "剑", "勵": "励",
  "動": "动", "務": "务", "勝": "胜", "勞": "劳", "勢": "势", "區": "区", "協": "协", "單": "单",
  "參": "参", "葉": "叶", "藝": "艺", "蘇": "苏", "蘭": "兰", "處": "处", "號": "号", "雖": "虽",
  "帶": "带", "幫": "帮", "幹": "干", "庫": "库", "廢": "废", "廠": "厂", "彈": "弹", "強": "强",
  "歸": "归", "複": "复", "復": "复", "機": "机", "權": "权", "樓": "楼", "標": "标", "樹": "树",
  "橋": "桥", "檢": "检", "槍": "枪", "槳": "桨", "欄": "栏", "欖": "榄", "殘": "残", "殺": "杀",
  "毀": "毁", "氣": "气", "氫": "氢", "遊": "游", "運": "运", "違": "违", "邏": "逻", "閒": "闲",
  "隨": "随", "霧": "雾", "頁": "页", "頂": "顶", "項": "项", "順": "顺", "須": "须", "預": "预",
  "頒": "颁", "頓": "顿", "頗": "颇", "領": "领", "顆": "颗", "額": "额", "颱": "台", "飛": "飞",
  "髮": "发", "鬥": "斗", "鬧": "闹", "鰻": "鳗", "鳳": "凤", "鴻": "鸿", "鵬": "鹏", "麗": "丽",
  "儂": "侬", "倫": "伦", "偉": "伟", "傳": "传", "傷": "伤", "傾": "倾", "僑": "侨", "價": "价",
  "儀": "仪", "億": "亿", "優": "优", "儲": "储", "兒": "儿", "兌": "兑",
};

for (const k of Object.keys(T2S)) if (T2S[k] === k) delete T2S[k];

// 繁体 → 简体（离线）
function tw2s(text) {
  let out = "";
  for (const ch of String(text || "")) out += T2S[ch] || ch;
  return out;
}

// 检测是否含繁体字（离线映射命中，且确认字符确实不同）
function hasTrad(text) {
  for (const ch of String(text || "")) if (T2S[ch] && T2S[ch] !== ch) return true;
  return false;
}

// 语言目标规范化：Folium 的 locale → 翻译目标语言码
function normTarget(locale) {
  const l = String(locale || "").toLowerCase();
  if (l.startsWith("zh")) return l.includes("tw") || l.includes("hant") ? "zh-TW" : "zh-CN";
  if (l.startsWith("en")) return "en";
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("ko")) return "ko";
  if (l.startsWith("id") || l.startsWith("in")) return "id";
  return l.slice(0, 2);
}

const SUPPORTED_TARGETS = new Set(["zh-CN", "zh-TW", "en", "ja", "ko", "id"]);

// 文本是否已是目标语言
function isTargetLang(text, target) {
  const t = String(text || "");
  const hasHan = /[\u4e00-\u9fff]/.test(t);
  const hasKana = /[\u3040-\u30ff]/.test(t);
  const hasHangul = /[\uac00-\ud7af]/.test(t);
  if (!SUPPORTED_TARGETS.has(target)) return false;
  if (target === "en") return !hasHan && !hasKana && !hasHangul;
  if (target === "ja") return hasKana && !hasHangul;
  if (target === "ko") return hasHangul && !hasHan && !hasKana;
  if (target === "zh-TW") return hasHan && hasTrad(t) && !hasKana && !hasHangul;
  if (target === "zh-CN") {
    if (!hasHan || hasTrad(t) || hasKana || hasHangul) return false;
    // 汉字为主体即视为中文：专名/术语里的少量拉丁字母不触发整段外文翻译
    const hanCount = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    const latinWords = (t.match(/[A-Za-z]{3,}/g) || []).length;
    return hanCount >= latinWords * 2;
  }
  // 注意：en 与 id 同为拉丁字母，无法靠字符集区分；目标为 id 时英文文本会被误判为已是目标语言。
  if (target === "id") return !hasHan && !hasKana && !hasHangul;
  return false;
}

// 粗略检测源语言（日文假名/韩文优先，避免混排文本被误判为中文）
function detectSrc(text) {
  const t = String(text || "");
  const hasHan = /[\u4e00-\u9fff]/.test(t);
  const hasKana = /[\u3040-\u30ff]/.test(t);
  const hasHangul = /[\uac00-\ud7af]/.test(t);
  const hasEn = /[A-Za-z]{3,}/.test(t);
  if (hasKana) return "ja";
  if (hasHangul && !hasHan) return "ko";
  if (hasHan) return hasTrad(t) ? "zh-TW" : "zh-CN";
  if (hasEn) return "en";
  return "zh-CN";
}

// 单段 MyMemory 翻译：返回译文或 null（失败）。
async function remoteTranslateOne(folium, text, tgt) {
  const src = detectSrc(text);
  if (src === tgt) return null;
  const pair = src + "|" + tgt;
  try {
    const r = await limitedFetch(
      folium,
      "https://api.mymemory.translated.net/get?q=" + enc(String(text || "").slice(0, 1800)) + "&langpair=" + enc(pair),
      { timeoutMs: 12000 }
    );
    if (r.ok) {
      const j = await r.json();
      const statusOk = j.responseStatus == null || Number(j.responseStatus) === 200;
      const tr = statusOk && j.responseData && j.responseData.translatedText;
      if (tr && String(tr).trim() && !/MYMEMORY WARNING|PLEASE SELECT|INVALID LANGUAGE/i.test(String(tr))) {
        return unent(String(tr));
      }
    }
  } catch (e) {
    folium.log.warn("translate failed", String((e && e.message) || e));
  }
  return null;
}

// 把文本按「外文串 / 其余」切段：外文串指假名/谚文连续串，或由拉丁字母开头、至少 3 个字符的
// 字母数字与常见符号串；其余（汉字、中文标点、数字、空白）归保留段。用于混排文本只翻译外文部分。
function splitForeignRuns(text) {
  const segments = [];
  const re = /[\u3040-\u30ff\uac00-\ud7af]+|[A-Za-z][A-Za-z0-9 '’&\-–—.,;:!?()]{2,}/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), foreign: false });
    segments.push({ text: m[0], foreign: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), foreign: false });
  return segments;
}

// 公开检索模式的翻译
async function translateForPublic(folium, text, target, keepOriginal, allowRemoteTranslation) {
  const orig = String(text || "").trim();
  if (!orig) return orig;
  const tgt = normTarget(target);
  if (isTargetLang(orig, tgt)) return orig;

  // 离线简繁转换（zh-CN 目标、无假名）：先把繁体转简体，外文保持不变。
  const canT2S = tgt === "zh-CN" && !/[\u3040-\u30ff]/.test(orig);
  const simplified = canT2S ? tw2s(orig) : orig;
  const didT2S = simplified !== orig;

  // 目标为繁体而原文是简体：离线表只做繁→简，反向转换不可靠；仅在允许远程翻译时整段送翻，否则保留原文
  if (tgt === "zh-TW" && !hasTrad(orig) && /[\u4e00-\u9fff]/.test(orig)) {
    if (allowRemoteTranslation === true) {
      const tr = await remoteTranslateOne(folium, orig, tgt);
      if (tr) return keepOriginal ? orig + "\n（繁体翻译：" + tr + "）" : tr;
    }
    return orig;
  }

  // 是否有外文片段需要远程翻译
  const segments = splitForeignRuns(simplified);
  const hasForeign = segments.some((s) => s.foreign);

  // 没有外文片段：只可能做了简繁转换。
  if (!hasForeign) {
    if (didT2S) return keepOriginal ? orig + "\n（简体翻译：" + simplified + "）" : simplified;
    return orig;
  }

  // 有外文片段但未开启远程翻译：退回（能简繁转换的部分仍做简繁转换，外文保留原文）。
  if (allowRemoteTranslation !== true) {
    if (didT2S) return keepOriginal ? orig + "\n（简体翻译：" + simplified + "）" : simplified;
    return orig;
  }

  // 开启远程翻译：逐段翻译外文片段、中文部分保持不动，再拼回。
  const parts = [];
  for (const seg of segments) {
    if (!seg.foreign) { parts.push(seg.text); continue; }
    const tr = await remoteTranslateOne(folium, seg.text, tgt);
    parts.push(tr || seg.text);
  }
  const out = parts.join("");
  if (out && out !== simplified) return keepOriginal ? orig + "\n（翻译：" + out + "）" : out;

  // 外文段全部翻译失败：退回（至少有简繁转换）。
  if (didT2S) return keepOriginal ? orig + "\n（简体翻译：" + simplified + "）" : simplified;
  return orig;
}

// ---------- 数据源 ----------

const AI_PRESETS = {
  deepseek: { base: "https://api.deepseek.com", model: "deepseek-chat" },
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  moonshot: { base: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  zhipu: { base: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  qwen: { base: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  doubao: { base: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-1-5-pro-32k-250115" },
  hunyuan: { base: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-lite" },
  ollama: { base: "http://localhost:11434/v1", model: "qwen2.5:7b" },
};
const resolveAI = (cfg) => {
  const p = cfg && cfg.aiPreset && AI_PRESETS[cfg.aiPreset];
  return {
    base: p ? p.base : String((cfg && cfg.aiBaseUrl) || ""),
    model: p ? p.model : String((cfg && cfg.aiModel) || ""),
  };
};

// AI 端点解析与校验：默认只允许 HTTPS；仅 localhost / 127.0.0.1 / ::1 允许 HTTP。
// 校验失败返回 { error }，调用方必须停止请求（不发送密钥）；成功返回解析后的完整 URL（自动拼接 /chat/completions）。
// 本机地址的判定基于解析后的 hostname，不再放行 0.0.0.0 与任意 127.x.x.x。
const parseAIEndpoint = (base) => {
  const raw = String(base || "").trim();
  if (!raw) return { error: "未配置 AI 接口地址" };
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return { error: "AI 接口地址无效，请检查设置中的接口地址（需为完整 URL）" };
  }
  if (url.username || url.password) {
    return { error: "接口地址不能包含用户名或密码" };
  }
  // IPv6 主机名在 URL 中带方括号（如 "[::1]"），比较前需去掉，否则 ::1 判定永远不成立
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLocal = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    return {
      error: "AI 接口地址必须使用 HTTPS；仅 localhost、127.0.0.1 和 ::1 允许 HTTP，未发送请求",
    };
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/chat/completions")) {
    url.pathname = path + "/chat/completions";
  }
  return { url: url.toString(), isLocal };
};

// AI 返回字段类型校验：字符串/数字转为展示文本；数组仅接受字符串或数字成员并安全连接；
// 对象、布尔值与其他意外类型返回空字符串，避免展示 [object Object]。
const toDisplayText = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join("、");
  }
  return "";
};

// 记忆补充时不得拼接的短字段：年份、日期、专辑名、风格只允许补空缺
const SHORT_FIELDS = new Set(["year", "releaseDate", "album", "genre"]);

function buildCacheKey(source, artist, title, cfg, locale) {
  const c = cfg || {};
  const parts = [source, artist, title, normTarget(locale), String(c.contentDetail || "balanced")];
  // AI 检索只显示软件语言，不受「保留原文」影响；「保留原文」仅作用于公开检索
  parts.push(source === "ai" || source === "ai-memory" ? "kt" : (c.keepOriginal !== false ? "ko" : "kt"));
  parts.push(c.useMyMemory === true ? "mm" : "nomm");
  if (source === "ai" || source === "ai-memory") {
    const ai = resolveAI(c);
    parts.push(String(ai.base || ""));
    parts.push(String(ai.model || ""));
    if (c.aiMemoryOnly) parts.push("mem");
  }
  return parts.join("\u0001");
}

// 百度百科词条摘要（meta description）
async function baikeIntro(folium, title) {
  if (!title) return null;
  try {
    const r = await limitedFetch(folium, BAKE + enc(title), { headers: { Accept: "text/html" }, timeoutMs: 20000 });
    logDiag(folium, "baike status=" + (r && r.status) + " q=" + title);
    if (!r.ok) return null;
    const html = await r.text();
    const m =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i);
    const d = m ? unent(m[1]) : "";
    logDiag(folium, "baike len=" + html.length + " parsed=" + d.length + " chars");
    return d.length >= 15 ? d : null;
  } catch (e) {
    folium.log.warn("baikeIntro failed", String((e && e.message) || e));
    return null;
  }
}

// 维基百科词条导言（AI 检索补充源）
async function wikiIntro(folium, title, api) {
  if (!title) return null;
  try {
    const r = await limitedFetch(
      folium,
      api + "?action=query&format=json&prop=extracts&explaintext=1&exintro=1&redirects=1&titles=" + enc(title),
      { timeoutMs: 12000 }
    );
    logDiag(folium, "wiki status=" + (r && r.status) + " q=" + title);
    if (!r.ok) return null;
    const j = await r.json();
    const pages = (j.query && j.query.pages) || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing) return null;
    return page.extract ? truncate(page.extract.replace(/\s+/g, " ").trim(), 650) : null;
  } catch (e) {
    folium.log.warn("wikiIntro failed", String((e && e.message) || e));
    return null;
  }
}

// MusicBrainz 录音：专辑 / 年份
async function mbRecording(folium, title, artist) {
  if (!title) return null;
  const clean = (s) => String(s || "").replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
  try {
    const q = 'recording:"' + clean(title) + '"' + (artist ? ' AND artist:"' + clean(artist) + '"' : "");
    const r = await limitedFetch(folium, MB_API + enc(q), {
      timeoutMs: 20000,
      headers: { "User-Agent": MB_USER_AGENT },
    });
    logDiag(folium, "musicbrainz status=" + (r && r.status) + " q=" + clean(title));
    if (!r.ok) return null;
    const j = await r.json();
    const norm = (v) => String(v || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const wantedTitle = norm(title);
    const wantedArtist = norm(artist);
    const candidates = (j.recordings || []).map((item) => {
      const gotTitle = norm(item.title);
      const gotArtist = norm((item["artist-credit"] || []).map((x) => x.name || (x.artist && x.artist.name) || "").join(" "));
      let score = 0;
      if (gotTitle === wantedTitle) score += 5;
      else if (gotTitle && (gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle))) score += 2;
      if (wantedArtist && gotArtist === wantedArtist) score += 5;
      else if (wantedArtist && gotArtist && (gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist))) score += 2;
      if (item["first-release-date"]) score += 0.25;
      return { item, score };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.score < (artist ? 7 : 4)) return null;
    const rec = best.item;
    const rels = rec.releases || [];
    const rel = rels.find((x) => x && x.title) || null;
    return {
      album: rel ? rel.title : null,
      year: (rec["first-release-date"] || (rel && rel.date) || "").slice(0, 4) || null,
      releaseDate: (rec["first-release-date"] || (rel && rel.date) || "") || null,
      sourceUrl: "https://musicbrainz.org/recording/" + encodeURIComponent(rec.id || ""),
    };
  } catch (e) {
    folium.log.warn("mbRecording failed", String((e && e.message) || e));
    return null;
  }
}

// 豆瓣音乐搜索
async function doubanIntro(folium, query) {
  if (!query) return null;
  try {
    const r = await limitedFetch(folium, "https://www.douban.com/search?cat=1003&q=" + enc(query), { headers: { Accept: "text/html" }, timeoutMs: 15000 });
    logDiag(folium, "douban status=" + (r && r.status) + " q=" + query);
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/<div class="result">[\s\S]*?<h3>[\s\S]*?<a[^>]*>([^<]*)<\/a>[\s\S]*?<span class="subject-cast">([^<]*)<\/span>[\s\S]*?<p>([\s\S]*?)<\/p>/);
    if (!m) { logDiag(folium, "douban len=" + html.length + " no result block matched"); return null; }
    const t = unent(m[1]);
    const cast = unent(m[2]);
    const intro = unent(m[3].replace(/<[^>]+>/g, ""));
    const s = [t, cast, intro].filter(Boolean).join("。").replace(/\s+/g, " ").trim();
    logDiag(folium, "douban len=" + html.length + " parsed=" + s.length + " chars");
    return s.length >= 10 ? truncate(s, 500) : null;
  } catch (e) {
    folium.log.warn("doubanIntro failed", String((e && e.message) || e));
    return null;
  }
}

// 萌娘百科词条摘要
async function moegirlIntro(folium, title) {
  if (!title) return null;
  try {
    const r = await limitedFetch(
      folium,
      "https://zh.moegirl.org.cn/api.php?action=query&prop=extracts&exintro&explaintext&format=json&titles=" + enc(title),
      { timeoutMs: 15000 }
    );
    logDiag(folium, "moegirl status=" + (r && r.status) + " q=" + title);
    if (!r.ok) return null;
    const j = await r.json();
    const pages = (j.query && j.query.pages) || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing || !page.extract) { logDiag(folium, "moegirl no extract for " + title); return null; }
    const s = page.extract.replace(/\s+/g, " ").trim();
    logDiag(folium, "moegirl parsed=" + s.length + " chars");
    return s.length >= 10 ? truncate(s, 500) : null;
  } catch (e) {
    folium.log.warn("moegirlIntro failed", String((e && e.message) || e));
    return null;
  }
}

// AI 检索：OpenAI 兼容 chat/completions。
async function aiLookup(folium, cfg, artist, title, target, keepOriginal) {
  const ai = resolveAI(cfg);
  const base = String(ai.base || "").replace(/\/+$/, "");
  const model = String(ai.model || "");
  if (!base || !model) {
    return { error: "请先配置 AI 服务商和模型" };
  }
  // 发送密钥前先解析并校验端点协议/主机；校验失败立即停止，密钥不发送
  const endpointResult = parseAIEndpoint(base);
  if (endpointResult.error) {
    folium.log.warn("aiLookup blocked: " + endpointResult.error);
    return { error: endpointResult.error + "；请修正「接口地址（自定义）」后重试" };
  }
  const endpoint = endpointResult.url;
  const isLocalProvider = cfg.aiPreset === "ollama" || endpointResult.isLocal;
  if (!cfg.apiKey && !isLocalProvider) {
    return { error: "请先配置 AI 服务商和模型，并在「AI API 密钥」设置中保存密钥" };
  }

  // ---- RAG：AI 检索固定「详细」挡位，并发检索 5 个公开来源 + MusicBrainz，最多等 6 秒 ----
  let ctx = "";
  let aggregated = false;
  try {
    const parts = [];
    if (!(cfg && cfg.aiMemoryOnly)) {
      const allSources = [
        ["豆瓣音乐", (query) => doubanIntro(folium, query)],
        ["萌娘百科", (query) => moegirlIntro(folium, query)],
        ["维基百科（中文）", (query) => wikiIntro(folium, query, WIKI_ZH)],
        ["维基百科（英文）", (query) => wikiIntro(folium, query, WIKI_EN)],
        ["百度百科", (query) => baikeIntro(folium, query)],
      ];
      const query = [title, artist].filter(Boolean).join(" ");
      const jobs = [];
      if (query) {
        for (const [name, get] of allSources) {
          jobs.push(async () => {
            try {
              const value = await get(query);
              const text = String(value || "").replace(/\s+/g, " ").trim();
              if (text.length >= 10) return name + "（关键词：" + query + "）：" + truncate(text, 750);
            } catch (_) { /* 单源失败不阻塞其余来源 */ }
            return "";
          });
        }
      }
      jobs.push(async () => {
        try {
          const mb = title ? await mbRecording(folium, title, artist) : null;
          if (!mb) return "";
          return [mb.album && "MusicBrainz 专辑：" + mb.album, mb.year && "MusicBrainz 发行年份：" + mb.year, mb.releaseDate && "MusicBrainz 发行日期：" + mb.releaseDate].filter(Boolean).join("；");
        } catch (_) { return ""; }
      });
      const results = await raceWithDeadline(jobs, 6000);
      for (const result of results) if (result) parts.push(result);
    }
    ctx = [...new Set(parts)].join("\n\n").slice(0, 20000);
    aggregated = !!ctx;
  } catch (e) {
    folium.log.warn("rag fetch failed", String((e && e.message) || e));
  }

  const hasCtx = ctx.trim().length > 0;
  const tgtLang = normTarget(target);
  const langName = { "zh-CN": "简体中文", "zh-TW": "繁體中文", en: "English", ja: "日本語", ko: "한국어", id: "Bahasa Indonesia" }[tgtLang] || tgtLang;
  // AI 检索只显示软件使用语言：不保留原文（「保留原文」仅作用于公开检索到的真实资料）
  const effKeep = false;
  const keepTxt = effKeep
    ? "任何部分不是" + langName + "时（如繁体、英文、日文、粤语等），一律保留原文，并在原文下方另起一行附上" + langName + "翻译，格式为\"原文\"后换行\"（翻译：……）\"，逐条对应；"
    : "将内容统一翻译成" + langName + "，不保留原文；";
  let sys = hasCtx
    ? "你是音乐资料助手。下面提供【检索资料】片段（来自豆瓣音乐/萌娘百科/维基百科/百度百科，可能不完整或为空）。" +
      "回答规则：① 翻译规则是最重要的硬性要求：" + keepTxt +
      "② 严格核对歌曲名和歌手；资料可能对应同名歌曲、翻唱或其他版本，无法确认时相关字段留空。不得把搜索摘要当成已核实的歌曲背景；不得编造发行日期、创作人员、荣誉或作品故事。" +
      "③ 尽可能完整地填写所有有依据的字段；song.content 写 2-4 句作品介绍，song.origin 写有依据的创作/发行背景，song.listeningNotes 写 2-3 句并明确是主观解读；artist.bio 写 2-4 句，artist.representativeWorks 单独列出有依据的代表作，artist.career 单独列出演艺/创作经历。song.source 填写歌曲出处（影视、游戏、专辑、原声带等，仅在有依据时填写）。区分可核实事实与主观解读，不确定的具体日期、人员、荣誉必须留空，不得编造。" +
      "④ 只输出一个 JSON 对象，不要输出其他内容，不要用 markdown 代码块。字段：{song:{album, year, releaseDate, writers, composers, arranger, genre, origin, content, source, listeningNotes}, artist:{name, bio, representativeWorks, honors, career}}。" +
      "album 专辑名、year 年份、releaseDate 发行日期、writers 作词、composers 作曲、arranger 编曲、genre 风格、origin 创作与发行背景、content 歌曲简介、source 歌曲出处（影视/游戏/专辑/原声等，需有依据）、listeningNotes 聆听解读；bio 歌手简介、representativeWorks 歌手代表作、career 歌手经历、honors 可核验荣誉。无来源支持就留空。正文统一使用" + langName + "。"
    : "你是音乐资料助手。当前没有检索到该歌手/歌曲的公开资料。" +
      "回答规则：① 翻译规则是最重要的硬性要求：" + keepTxt +
      "② 不得把模型记忆描述为检索结果。" +
      (cfg && cfg.aiMemoryOnly ? "记忆补充模式允许凭模型已有记忆生成，内容不要求高准确率，所有生成内容标记为 AI 生成。" : "不得编造发行日期、专辑、创作人员、荣誉或故事背景。") +
      "详细挡位允许谨慎使用模型自身知识；将所有此类内容仅写入 memorySupplement 对象以区分来源，不确定的具体事实留空。" +
      "③ 只输出一个 JSON 对象，不要输出其他内容，不要用 markdown 代码块。字段：{song:{album, year, releaseDate, writers, composers, arranger, genre, origin, content, source, listeningNotes}, artist:{name, bio, representativeWorks, honors, career}, memorySupplement:{song:{origin,content,listeningNotes,source,album,year,releaseDate,writers,composers,arranger,genre},artist:{bio,representativeWorks,honors,career}}}。" +
      "正文统一使用" + langName + "。";
  sys += "详细挡位规则：先以检索资料为准；若重要字段仍缺失，可谨慎使用模型自身知识补充，但不得猜测。JSON 中额外输出 memorySupplement 对象，结构为 {song:{origin,content,listeningNotes,source,album,year,releaseDate,writers,composers,arranger,genre},artist:{bio,representativeWorks,honors,career}}。只有完全来自模型自身知识、未被检索来源支持的补充写入 memorySupplement 对应字段；这些字段不得重复写入普通 song/artist 字段。不得把 AI 记忆补充列入公开来源。";
  if (cfg && cfg.aiMemoryOnly) {
    sys += "这是【AI 记忆补充】任务，用户明确允许你凭模型自身记忆和常识生成内容，不要求高准确率，不要因为无法核实就留空。请尽可能为以下七个栏目生成有用内容：作曲作词（writers/composers/arranger）、歌手简介（artist.bio）、歌手代表作（artist.representativeWorks）、歌手经历（artist.career）、歌曲创作与发行背景（song.origin）、歌曲出处（song.source）、聆听解读（song.listeningNotes）。可以谨慎使用你对歌曲和歌手的记忆；不要声称这些内容已经检索核实。将生成内容放入 memorySupplement 对应字段，字段包括 song:{writers,composers,arranger,origin,content,source,listeningNotes,album,year,releaseDate,genre}, artist:{bio,representativeWorks,career,honors}。普通 song/artist 字段保持为空。补充内容的来源说明已写入模组介绍；正文与栏目名均不需要添加任何标记。输出完整 JSON。";
  }
  const user =
    (hasCtx ? "【检索资料】\n" + ctx + "\n\n请根据以上资料整理" : "请整理") +
    ' 歌曲《' + title + '》 - 歌手：' + artist + ' 的资料并输出 JSON。';
  try {
    const headers = { "Content-Type": "application/json" };
    if (cfg.apiKey) headers.Authorization = "Bearer " + cfg.apiKey;
    const r = await limitedFetch(folium, endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model,
        temperature: cfg && cfg.aiMemoryOnly ? (typeof cfg.aiTemperature === "number" ? cfg.aiTemperature : 0.7) : 0.25,
        max_tokens: 4000,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
      timeoutMs: 45000,
    });
    if (!r.ok) return { error: "AI 接口返回 " + r.status + "，请检查接口地址 / 密钥 / 配额" };
    const j = await r.json();
    const rawContent = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    const content = Array.isArray(rawContent)
      ? rawContent.map((part) => typeof part === "string" ? part : (part && (part.text || part.content)) || "").join("\n")
      : (typeof rawContent === "string" ? rawContent : "");
    const finishReason = j && j.choices && j.choices[0] && j.choices[0].finish_reason;
    if (!content.trim()) {
      return { error: "AI 返回了空内容" + (finishReason ? "（finish_reason: " + finishReason + "）" : "，请检查模型、配额或接口兼容性") };
    }
    // 输出被长度上限截断时 JSON 必然不完整：直接给出可执行提示，避免误判为模型不兼容
    if (finishReason === "length") {
      return { error: "AI 输出达到长度上限被截断，返回的 JSON 不完整。请改用输出上限更大的模型，或把内容长度调为「标准」后重试" };
    }
    const clean = content.replace(/```(?:json|javascript|js)?/gi, "").replace(/```/g, "").trim();
    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");
    if (first < 0 || last <= first) {
      folium.log.warn("AI response is not JSON", clean.slice(0, 500));
      return { error: "AI 返回内容不是有效 JSON；请检查自定义模型是否支持指令跟随，或点击重新生成" };
    }
    let obj;
    try { obj = JSON.parse(clean.slice(first, last + 1)); }
    catch (parseError) {
      folium.log.warn("AI JSON parse failed", String((parseError && parseError.message) || parseError), clean.slice(0, 500));
      return { error: "AI 返回的 JSON 格式不完整或有误，请点击重新生成；若持续出现，请检查模型的 JSON 输出兼容性" };
    }

    const tgt = normTarget(target);
    const looksTarget = (s, t) => {
      const x = String(s);
      if (!x.trim()) return true;
      if (t === "en") return !/[\u3040-\u30ff\u4e00-\u9fff]/.test(x);
      if (t === "ja") return /[\u3040-\u30ff]/.test(x);
      if (t === "ko") return /[\uac00-\ud7af]/.test(x);
      if (t === "zh-TW") return /[\u4e00-\u9fff]/.test(x) && hasTrad(x) && !/[\u3040-\u30ff]/.test(x);
      if (t === "zh-CN") return /[\u4e00-\u9fff]/.test(x) && !/[\u3040-\u30ff]/.test(x);
      return !/[\u3040-\u30ff\u4e00-\u9fff]/.test(x);
    };
    const fix = async (v) => {
      const s = toDisplayText(v); // 对象/布尔等意外类型在此归空，避免 [object Object]
      if (!s) return "";
      if (s === "未知" || s.toLowerCase() === "unknown") return "";
      if (looksTarget(s, tgt)) {
        if (tgt === "zh-CN" && hasTrad(s)) {
          return await translateForPublic(folium, s, tgt, effKeep, cfg.useMyMemory === true);
        }
        return s;
      }
      return await translateForPublic(folium, s, tgt, effKeep, cfg.useMyMemory === true);
    };

    const isMemOnly = !!(cfg && cfg.aiMemoryOnly);
    if (obj && typeof obj === "object") {
      const memory = obj.memorySupplement && typeof obj.memorySupplement === "object" ? obj.memorySupplement : {};
      obj.song = obj.song || {};
      obj.artist = obj.artist || {};
      // 记忆补充字段并入对应栏目（来源说明见模组介绍，界面不标注）
      const stageMemory = (targetObj, memoryObj) => {
        if (!targetObj || !memoryObj) return;
        for (const key of Object.keys(memoryObj)) {
          const value = toDisplayText(memoryObj[key]).replace(/^【(ai\s*生成|AI记忆补充·未经检索核实)】/i, "").trim();
          if (value && (isMemOnly || targetObj[key] == null || !String(targetObj[key] || "").trim())) {
            targetObj[key] = value;
          }
        }
      };
      stageMemory(obj.song, memory.song);
      stageMemory(obj.artist, memory.artist);
      delete obj.memorySupplement;
    }

    if (obj && typeof obj === "object") {
      const song = obj.song || {};
      const art = obj.artist || {};
      const [album, writers, composers, arranger, genre, origin, contentField, listeningNotes, sourceField] = await mapLimit([
        song.album, song.writers, song.composers, song.arranger,
        song.genre, song.origin, song.content, song.listeningNotes, song.source,
      ], 2, fix);
      const [artistName, bio, representativeWorks, honors, career] = await mapLimit([
        art.name, art.bio, art.representativeWorks, art.honors, art.career,
      ], 2, fix);
      obj.song = {
        album,
        year: toDisplayText(song.year),
        releaseDate: toDisplayText(song.releaseDate),
        writers, composers, arranger, genre, origin,
        content: contentField,
        listeningNotes,
        source: sourceField,
      };
      obj.artist = { name: artistName, bio, representativeWorks, honors, career };
    }

    const sourceMatches = ctx.match(/豆瓣音乐|萌娘百科|维基百科（中文）|维基百科（英文）|百度百科|MusicBrainz/g) || [];
    return { ai: obj, generatedByAi: !hasCtx, aiAggregated: !!hasCtx && aggregated, sources: [...new Set(sourceMatches)] };
  } catch (e) {
    folium.log.warn("aiLookup failed", String((e && e.message) || e));
    return { error: "AI 查询失败：" + String((e && e.message) || e || "未知错误") + "。请检查接口地址、密钥、模型、配额和响应格式；此错误不一定表示设备断网。" };
  }
}

// 公开源查询（提速版）
async function publicLookup(folium, artist, title, cfg, target, keepOriginal) {
  const detailMode = String((cfg && cfg.contentDetail) || "balanced");
  const wanted = detailMode === "compact" ? 1 : detailMode === "detailed" ? 4 : 2;
  const SOURCES = [
    ["豆瓣音乐", (q) => doubanIntro(folium, q)],
    ["萌娘百科", (q) => moegirlIntro(folium, q)],
    ["百度百科", (q) => baikeIntro(folium, q)],
  ];
  const collect = async (query, includeMb) => {
    if (!query) return [];
    const jobs = SOURCES.map(([name, get]) => async () => {
      try {
        const text = String((await get(query)) || "").replace(/\s+/g, " ").trim();
        if (text.length < 10) return null;
        return { source: name, text };
      } catch (_) { return null; }
    });
    if (includeMb) {
      jobs.push(async () => {
        try {
          const mb = title ? await mbRecording(folium, title, artist) : null;
          if (!(mb && (mb.album || mb.year || mb.releaseDate))) return null;
          return {
            source: "MusicBrainz",
            mb,
            text: [mb.album && "专辑：" + mb.album, mb.year && "发行年份：" + mb.year, mb.releaseDate && "发行日期：" + mb.releaseDate].filter(Boolean).join("；"),
          };
        } catch (_) { return null; }
      });
    }
    return collectFast(jobs, wanted);
  };
  const [artistHits, songHits] = await Promise.all([collect(artist, false), collect(title, true)]);
  const translate = (text) => (text ? translateForPublic(folium, text, target, keepOriginal, cfg && cfg.useMyMemory === true) : null);
  const textHits = (hits) => hits.filter((h) => h.source !== "MusicBrainz");
  const artistIntro = artistHits.length ? await translate(artistHits.map((h) => h.text).join("\n\n")) : null;
  const songIntro = textHits(songHits).length ? await translate(textHits(songHits).map((h) => h.text).join("\n\n")) : null;
  const mbHit = songHits.find((h) => h.source === "MusicBrainz");
  const mb = (mbHit && mbHit.mb) || null;
  const empty = !artistIntro && !songIntro && !mbHit;
  // 公开检索只显示真实检索到的数据：不调用任何 AI 资源兜底，检索不到就不显示
  if (empty) return { error: "未找到相关资料。公开检索不调用 AI，仅显示真实检索数据；网络不可用或来源未收录时不会缓存失败结果。" };
  return {
    artistIntro, songIntro, mb, ai: null, error: null, generatedByAi: false,
    artistSource: artistHits.map((h) => h.source).join("、") || null,
    songSource: textHits(songHits).map((h) => h.source).join("、") || null,
    sources: [...new Set([...artistHits.map((h) => h.source), ...songHits.map((h) => h.source)].filter(Boolean))],
  };
}

// ---------- 缓存 ----------

async function loadCache(folium) {
  try {
    const v = await folium.storage.get(CACHE_KEY);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

async function saveCache(folium, cache) {
  try {
    // 序列化一次得到初始估算，裁剪时按被删条目增量递减，避免每轮循环重复序列化整个缓存
    const keys = Object.keys(cache).sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
    const sizeOf = (k) => JSON.stringify(cache[k] || "").length * 3 + k.length * 3;
    let sizeEst = JSON.stringify(cache).length * 3;
    let idx = 0;
    // 始终保留最近写入的一条：以前删到一条不剩再把空表写回去，表现为缓存突然全丢
    while ((keys.length - idx > 120 || sizeEst > CACHE_MAX_BYTES) && keys.length - idx > 1) {
      const victim = keys[idx++];
      sizeEst -= sizeOf(victim);
      delete cache[victim];
    }
    // 单条就超过上限时放弃本次写入，保住磁盘上已有的旧缓存，而不是用空表覆盖
    if (sizeEst > CACHE_MAX_BYTES) {
      folium.log.warn("cache entry exceeds limit, save skipped (kept previous cache)");
      return false;
    }
    await folium.storage.set(CACHE_KEY, cache);
    return true;
  } catch (e) {
    folium.log.warn("cache save failed", String((e && e.message) || e));
    return false;
  }
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

// 限并发映射：保持结果顺序，避免十几路网络请求同时压向同一翻译接口被限流
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

// 缓存写入串行化：loadCache → 修改 → saveCache 必须整体执行，
// 否则两首并发查询各自读到旧缓存、先后落盘，后写的一方覆盖前者刚写入的条目。
let cacheWriteChain = Promise.resolve();
function updateCache(folium, mutate) {
  const run = cacheWriteChain.then(async () => {
    const cache = await loadCache(folium);
    await mutate(cache);
    return saveCache(folium, cache);
  });
  cacheWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

// 竞速收集：同时发起 jobs（支持函数或 Promise），按完成顺序收集非空结果，集满 wanted 个即停。
// 修复：按 idx 定位完成项并从待查列表移除（旧实现用完成值在 promise 数组中 indexOf，永远匹配不到，
// 全部失败时 wraps 永不减少、done 永不增长，造成公开检索死循环卡死）；另有总时限兜底防个别请求不返回。
// 注意：net.fetch 不支持中途取消（FoliumFetchInit 无 signal），达到 wanted 或超时后其余请求仍会在后台
// 各自跑完（受各自 timeoutMs 约束），此处只停止收集结果，不再等待未完成的请求。
async function collectFast(jobs, wanted) {
  const pend = jobs.map((job, idx) => ({
    idx,
    promise: (typeof job === "function" ? job() : Promise.resolve(job))
      .then((r) => ({ idx, r: r || null }))
      .catch(() => ({ idx, r: null })),
  }));
  const done = [];
  let timer = null;
  const deadlineP = new Promise((resolve) => { timer = setTimeout(() => resolve("__deadline__"), 20000); });
  try {
    while (pend.length && done.length < wanted) {
      const won = await Promise.race([...pend.map((x) => x.promise), deadlineP]);
      if (won === "__deadline__") break;
      const i = pend.findIndex((x) => x.idx === won.idx);
      if (i >= 0) pend.splice(i, 1);
      if (won.r) done.push(won.r);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  return done;
}

// 限时收集：同时发起 jobs（支持函数或 Promise），在 ms 毫秒内按完成顺序收集结果；结束后清理定时器
async function raceWithDeadline(jobs, ms) {
  const pend = jobs.map((job, idx) => ({
    idx,
    promise: (typeof job === "function" ? job() : Promise.resolve(job))
      .then((r) => ({ idx, r: r || "" }))
      .catch(() => ({ idx, r: "" })),
  }));
  const done = [];
  let timer = null;
  const deadlineP = new Promise((resolve) => {
    timer = setTimeout(() => resolve("__deadline__"), ms);
  });
  try {
    while (pend.length) {
      const won = await Promise.race([...pend.map((x) => x.promise), deadlineP]);
      if (won === "__deadline__") break;
      const i = pend.findIndex((x) => x.idx === won.idx);
      if (i < 0) break;
      pend.splice(i, 1);
      if (won.r) done.push(won.r);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  return done;
}

function sourceSearchUrl(name, query) {
  const q = encodeURIComponent(String(query || "").trim());
  if (!q) return "";
  if (name.includes("MusicBrainz")) return "https://musicbrainz.org/search?query=" + q + "&type=recording";
  if (name.includes("豆瓣")) return "https://www.douban.com/search?cat=1003&q=" + q;
  if (name.includes("萌娘")) return "https://zh.moegirl.org.cn/index.php?search=" + q;
  if (name.includes("维基百科（英文）")) return "https://en.wikipedia.org/w/index.php?search=" + q;
  if (name.includes("维基百科")) return "https://zh.wikipedia.org/w/index.php?search=" + q;
  if (name.includes("百度百科")) return "https://baike.baidu.com/search/word?word=" + q;
  return "";
}
function sourceLinksHtml(names, query) {
  return [...new Set(names || [])].map((name) => {
    const url = sourceSearchUrl(name, query);
    return url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>' : esc(name);
  }).join(' · ');
}

const CSS_TEXT = `
.si-root{color:var(--folium-primary,#e8e8ec);font-family:var(--folium-font,system-ui);min-width:0;}.si-root .si-body{display:flex;flex-direction:column;gap:10px;}
.si-root .si-load{font-size:12px;opacity:.6;padding:16px 0;text-align:center;}
.si-root .si-none{font-size:12px;opacity:.55;padding:10px 0;line-height:1.5;}
.si-root .si-err{font-size:12px;color:#f87171;padding:10px 0;line-height:1.5;}
.si-root .si-warn{font-size:11px;color:#fbbf24;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.32);border-radius:8px;padding:7px 10px;line-height:1.5;}
.si-root .si-head{border-bottom:1px solid rgba(128,128,128,.16);padding-bottom:8px;}
.si-root .si-song{font-size:16px;font-weight:700;word-break:break-word;line-height:1.3;}
.si-root .si-artist{font-size:12px;opacity:.65;margin-top:3px;word-break:break-word;line-height:1.4;}
.si-root .si-src{font-size:10px;opacity:.45;margin-top:4px;}
.si-root .si-meta{font-size:11px;opacity:.75;padding:6px 10px;background:rgba(128,128,128,.09);border-radius:8px;line-height:1.5;word-break:break-word;}
.si-root .si-sec{background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.13);border-radius:10px;padding:9px 11px;min-width:0;}
.si-root .si-sec-t{font-size:11px;opacity:.55;font-weight:700;letter-spacing:.03em;margin-bottom:5px;}
.si-root .si-sec-b{font-size:12px;line-height:1.6;word-break:break-word;}
.si-root .si-foot{font-size:10px;opacity:.55;text-align:center;line-height:1.6;}.si-root .si-foot a{color:inherit;text-decoration:underline;text-underline-offset:2px;}.si-root .si-credits{font-size:11px;line-height:1.5;opacity:.8;}.si-root .si-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}.si-root .si-tag{font-size:10px;border:1px solid rgba(128,128,128,.22);border-radius:999px;padding:2px 7px;opacity:.8;}
.si-root .si-regen{margin-top:2px;align-self:center;border:1px solid rgba(139,92,246,.45);background:rgba(139,92,246,.14);color:inherit;border-radius:8px;padding:6px 16px;font-size:12px;cursor:pointer;}
.si-root .si-regen:hover,.si-root .si-memory-supplement:hover{background:rgba(139,92,246,.28);}
.si-root .si-memory-supplement{margin-top:2px;align-self:center;border:1px solid rgba(139,92,246,.45);background:rgba(139,92,246,.14);color:inherit;border-radius:8px;padding:6px 16px;font-size:12px;cursor:pointer;}
`;

export default function activate(folium) {
  if (folium.env.context !== "main") return undefined;

  let curLocale = "zh-CN";

  const settingsSchema = [
    { key: "source", type: "select", label: { "zh-CN": "数据源", en: "Source" }, defaultValue: "baike", options: [
      { value: "baike", label: { "zh-CN": "公开检索", en: "Public lookup" } },
      { value: "ai", label: { "zh-CN": "AI 检索", en: "AI lookup" } },
    ]},
    { key: "aiPreset", type: "select", label: { "zh-CN": "AI 服务商", en: "AI provider" }, defaultValue: "custom", options: [
      { value: "deepseek", label: { "zh-CN": "DeepSeek 深度求索", en: "DeepSeek" } },
      { value: "openai", label: { "zh-CN": "OpenAI（GPT）", en: "OpenAI (GPT)" } },
      { value: "moonshot", label: { "zh-CN": "Kimi 月之暗面", en: "Kimi (Moonshot)" } },
      { value: "zhipu", label: { "zh-CN": "智谱 GLM", en: "Zhipu GLM" } },
      { value: "qwen", label: { "zh-CN": "通义千问（阿里）", en: "Qwen (Alibaba)" } },
      { value: "doubao", label: { "zh-CN": "豆包（火山方舟）", en: "Doubao (Volcengine)" } },
      { value: "hunyuan", label: { "zh-CN": "腾讯混元", en: "Tencent Hunyuan" } },
      { value: "ollama", label: { "zh-CN": "Ollama（本地）", en: "Ollama (local)" } },
      { value: "custom", label: { "zh-CN": "自定义（手动填接口/模型）", en: "Custom (manual)" } },
    ]},
    { key: "contentDetail", type: "select", label: { "zh-CN": "内容长度", en: "Content length" }, defaultValue: "balanced", options: [
      { value: "compact", label: { "zh-CN": "简洁", en: "Compact" } },
      { value: "balanced", label: { "zh-CN": "标准", en: "Balanced" } },
      { value: "detailed", label: { "zh-CN": "详细", en: "Detailed" } },
    ]},
    { key: "showCredits", type: "boolean", label: { "zh-CN": "显示创作人员", en: "Show credits" }, defaultValue: true },
    { key: "showListeningNotes", type: "boolean", label: { "zh-CN": "显示聆听提示（AI 解读）", en: "Show listening notes (AI interpretation)" }, defaultValue: true },
    { key: "showArtistDetails", type: "boolean", label: { "zh-CN": "显示歌手经历与荣誉", en: "Show artist career and honors" }, defaultValue: true },
    { key: "autoAiMemorySupplement", type: "boolean", label: { "zh-CN": "自动 AI 记忆补充", en: "Auto AI memory supplement" }, description: { "zh-CN": "开启后，当抓取到的栏目不齐全或信息过少时自动调用 AI 记忆补充并刷新缓存；栏目齐全且信息充足时不自动触发（此时可手动点击「AI 记忆补充」刷新）。切换到其他标签页再切回时也会自动复查一次。补充内容来自模型自身知识、未经检索核实（说明见模组介绍），可能增加 AI 调用次数和费用。", en: "When enabled, missing sections or too-little content trigger an AI-memory completion automatically; complete data is left untouched until you click the button. Switching away and back also re-checks once. Supplemented text comes from the model's own knowledge (unverified); may incur extra AI usage costs." }, defaultValue: false },
    { key: "preloadNext", type: "boolean", label: { "zh-CN": "预加载播放列表下一首（AI 检索）", en: "Preload next playlist track (AI lookup)" }, description: { "zh-CN": "开启后，歌曲切换时会尝试提前查询下一首歌曲并缓存结果；仅在数据源为 AI 检索且能从播放状态识别下一首时生效，可能提前向 AI 服务商发送歌曲信息并产生费用。", en: "When enabled, attempts to fetch and cache the next playlist track when the song changes. Only works for AI lookup when the next track can be identified; may send track details to your AI provider and incur costs." }, defaultValue: false },
    { key: "keepOriginal", type: "boolean", label: { "zh-CN": "保留原文", en: "Keep original" }, description: { "zh-CN": "开启时同时显示原文与译文；关闭时只显示译文。仅作用于公开检索到的真实资料；AI 检索始终只显示软件使用语言，此开关在 AI 检索模式下不可用。", en: "Show source text alongside translation for public-lookup results only. AI lookup always shows only the UI language; this switch is disabled in AI mode." }, defaultValue: true },
    { key: "useMyMemory", type: "boolean", label: { "zh-CN": "启用 MyMemory 在线翻译（会发送资料文本）", en: "Enable MyMemory translation (sends source text)" }, description: { "zh-CN": "默认关闭。开启后，非简繁转换的资料文本最多 1800 字会发送至 MyMemory。", en: "Off by default. Up to 1,800 characters may be sent to MyMemory." }, defaultValue: false },
    { key: "aiBaseUrl", type: "text", label: { "zh-CN": "接口地址（自定义）", en: "API base URL (custom)" }, placeholder: "选预设后可留空；自定义填 OpenAI 兼容地址", defaultValue: "" },
    { key: "aiModel", type: "text", label: { "zh-CN": "模型（自定义）", en: "Model (custom)" }, placeholder: "选预设已带默认模型；自定义时填模型名", defaultValue: "" },
    { key: "aiTemperature", type: "number", label: { "zh-CN": "温度", en: "Temperature" }, defaultValue: 0.7, min: 0, max: 2, step: 0.1 },
  ];

  // 设置持久化：面板与查询统一读写模组存储中的同一份设置（si-settings-v2），
  // 不再依赖宿主 settings 对象，从根上避免「设置不保存 / 面板改了查询读不到」。
  const SETTINGS_KEY = "si-settings-v2";
  let settingsMem = null;
  let settingsLoadPromise = null;
  const DEFAULT_SETTINGS = (() => {
    const d = {};
    for (const def of settingsSchema) d[def.key] = def.defaultValue;
    return d;
  })();
  // 加载以持久化配置为准：仅把加载期间用户实际改动的键（pendingSettings）合并进去，
  // 内存默认值不会覆盖其他已保存设置。
  let pendingSettings = {};
  const ensureSettingsLoaded = () => {
    if (!settingsLoadPromise) {
      settingsLoadPromise = (async () => {
        try {
          const v = await folium.storage.get(SETTINGS_KEY);
          const stored = v && typeof v === "object" ? v : {};
          settingsMem = {
            ...DEFAULT_SETTINGS,
            ...stored,
            ...pendingSettings,
          };
        } catch (_) {
          settingsMem = {
            ...DEFAULT_SETTINGS,
            ...pendingSettings,
          };
        }
      })();
    }
    return settingsLoadPromise;
  };
  const getCfg = () => (settingsMem ? settingsMem : { ...DEFAULT_SETTINGS });
  // 保存串行化：连续写入按顺序落盘，后写的永远最后完成，避免旧写入覆盖新值；
  // 支持一次提交多个改动（传对象 patch）
  let settingsWriteChain = Promise.resolve();
  const writeCfg = (keyOrPatch, value) => {
    const patch = typeof keyOrPatch === "string"
      ? { [keyOrPatch]: value }
      : keyOrPatch;
    Object.assign(pendingSettings, patch);
    settingsMem = { ...getCfg(), ...patch };
    const run = settingsWriteChain
      .then(() => ensureSettingsLoaded())
      .then(async () => {
        settingsMem = { ...settingsMem, ...pendingSettings };
        const snapshot = { ...pendingSettings };
        try {
          await folium.storage.set(SETTINGS_KEY, settingsMem);
        } catch (e) {
          // 写入失败：本轮未落盘的键放回待写区，避免用户改动静默丢失
          Object.assign(pendingSettings, snapshot);
          throw e;
        }
        // 只移除本轮已落盘的键，保存期间产生的新改动继续保留
        for (const k of Object.keys(snapshot)) delete pendingSettings[k];
      });
    // 队列本身不因单次失败中断；失败通过 run 交给调用方
    settingsWriteChain = run.catch(() => undefined);
    return run;
  };

  try {
    const settingsHandle = folium.registries.settingsSections.register({
      id: "ai-config",
      label: { "zh-CN": "资料查询", en: "Info lookup" },
      description: {
        "zh-CN": "公开检索：豆瓣音乐、萌娘百科、百度百科、MusicBrainz 四个来源同时查询，按返回速度取用（简洁取第 1 个、标准取前 2 个、详细取全部 4 个有效来源），维基不参与公开检索。AI 检索固定使用「详细」挡位：豆瓣、萌娘、维基（中/英）、百度、MusicBrainz，公开片段最多等 6 秒。只有打开歌曲资料面板时才发起查询。AI 功能关闭时不会调用 AI。开启 MyMemory 翻译后，最多 1800 字资料原文（可能含歌名/歌手等内容）会发送给 api.mymemory.translated.net；默认关闭。AI 查询会把歌曲/歌手信息及检索到的资料发送到你选择的 AI 服务商，请只使用你信任的服务商；自定义接口地址会收到 API 密钥与歌曲资料，仅允许 HTTPS 或本机地址（localhost/127.x），校验不通过不会发送请求。API 密钥单独保存在本机模组存储，不进入视觉配置导出。",
        en: "Sources are queried on demand only while the Song Info panel is open. MyMemory translation is off by default; when enabled, up to 1,800 characters of source text may be sent to api.mymemory.translated.net. AI queries send song/artist details and retrieved excerpts to your selected provider; a custom endpoint also receives your API key and is restricted to HTTPS or a local address. The API key is stored separately in local mod storage and excluded from visual-config exports."
      },
      settings: settingsSchema,
      settingsPanel: (container, ctx) => {
        // 与查询共用同一份设置存储（si-settings-v2）：面板写入 = 查询读取，天然一致
        const locale = String((ctx && ctx.locale) || "zh-CN");
        const en = locale.toLowerCase().startsWith("en");
        const labelText = (v) => typeof v === "string" ? v : (v && (v[locale] || v[locale.split("-")[0]] || v["zh-CN"] || v.en)) || "";
        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:28px;padding:12px 0;";
        const controls = new Map();
        const getValues = () => getCfg();
        // 改动先进入暂存区，点击「保存设置」后才统一写入并生效
        let pending = {};
        const setPending = (key, value) => { pending[key] = value; };

        // 顶部分组标签：公开检索 / AI 检索（类似浏览器标签，点击即切换数据源）
        const tabs = document.createElement("div");
        tabs.style.cssText = "display:flex;gap:10px;margin-bottom:12px;";
        const switchTab = (src) => {
          const isPublic = String(src || "baike") === "baike";
          groupPublic.style.display = isPublic ? "" : "none";
          groupAI.style.display = isPublic ? "none" : "";
          tabPublic.style.fontWeight = isPublic ? "600" : "";
          tabPublic.style.boxShadow = isPublic ? "inset 0 0 0 1px var(--folium-primary,rgba(120,140,180,.65))" : "";
          tabAI.style.fontWeight = isPublic ? "" : "600";
          tabAI.style.boxShadow = isPublic ? "" : "inset 0 0 0 1px var(--folium-primary,rgba(120,140,180,.65))";
        };
        const makeTab = (key, text) => {
          const t = document.createElement("button");
          t.type = "button";
          t.textContent = text;
          t.style.cssText = "flex:1;padding:10px 12px;font-size:13px;border:1px solid var(--folium-border,rgba(128,128,128,.35));border-radius:8px;background:transparent;color:inherit;cursor:pointer;";
          t.addEventListener("click", () => { setPending("source", key); switchTab(key); });
          return t;
        };
        const tabPublic = makeTab("baike", en ? "Public search" : "公开检索");
        const tabAI = makeTab("ai", en ? "AI search" : "AI 检索");
        tabs.append(tabPublic, tabAI);
        wrap.appendChild(tabs);

        // 分组容器：公开检索 / AI 检索 独有项 + 两 tab 共通的底部公共区
        const groupPublic = document.createElement("div");
        groupPublic.style.cssText = "display:flex;flex-direction:column;gap:26px;";
        const groupAI = document.createElement("div");
        groupAI.style.cssText = "display:flex;flex-direction:column;gap:32px;";
        const groupCommon = document.createElement("div");
        groupCommon.style.cssText = "display:flex;flex-direction:column;gap:26px;border-top:1px solid var(--folium-border,rgba(128,128,128,.25));padding-top:22px;";
        const groupTitle = (t) => {
          const d = document.createElement("div");
          d.textContent = t;
          d.style.cssText = "font-size:14px;font-weight:700;margin:0;";
          return d;
        };
        groupPublic.appendChild(groupTitle(en ? "Public search settings" : "公开检索设置"));
        groupAI.appendChild(groupTitle(en ? "AI search settings" : "AI 检索设置"));
        groupCommon.appendChild(groupTitle(en ? "Common settings (both modes)" : "通用设置（两种模式共用）"));
        // AI 检索固定使用「详细」挡位：不再提供内容长度选项（简洁/标准已移除）
        const PUBLIC_KEYS = ["contentDetail", "keepOriginal"];
        const AI_KEYS = ["aiPreset", "aiBaseUrl", "aiModel", "aiTemperature", "preloadNext", "autoAiMemorySupplement"];
        const COMMON_KEYS = ["useMyMemory", "showCredits", "showListeningNotes", "showArtistDetails"];
        const GROUP_OF = (key) => PUBLIC_KEYS.includes(key) ? groupPublic : AI_KEYS.includes(key) ? groupAI : groupCommon;

        for (const def of settingsSchema) {
          if (def.key === "source") continue; // 数据源由顶部标签代替
          const row = document.createElement("label");
          row.style.cssText = "display:flex;flex-direction:column;gap:14px;font-size:13px;color:inherit;";
          const title = document.createElement("span");
          title.textContent = labelText(def.label);
          const hoverHelp = ["preloadNext", "keepOriginal", "useMyMemory", "autoAiMemorySupplement"].includes(def.key);
          if (hoverHelp && def.description) {
            row.title = labelText(def.description);
            row.setAttribute("aria-label", labelText(def.label) + "。" + labelText(def.description));
            title.style.cssText = "text-decoration:underline dotted;text-underline-offset:3px;cursor:help;";
            title.setAttribute("tabindex", "0");
            title.title = labelText(def.description);
          }
          row.appendChild(title);
          if (def.description && !hoverHelp) {
            const help = document.createElement("small");
            help.textContent = labelText(def.description);
            help.style.cssText = "opacity:.72;line-height:1.4;";
            row.appendChild(help);
          }
          let input;
          if (def.type === "select") {
            input = document.createElement("select");
            input.style.cssText = "box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid var(--folium-border,rgba(128,128,128,.35));border-radius:8px;background:var(--folium-background,var(--folium-surface,Canvas));color:var(--folium-button-text,var(--folium-primary-foreground,ButtonText));color-scheme:inherit;";
            for (const opt of (def.options || [])) {
              const option = document.createElement("option");
              option.value = opt.value;
              option.textContent = labelText(opt.label);
              option.style.color = "var(--folium-button-text, var(--folium-primary-foreground, ButtonText))";
              option.style.backgroundColor = "var(--folium-background, var(--folium-surface, Canvas))";
              input.appendChild(option);
            }
            input.addEventListener("change", () => setPending(def.key, input.value));
          } else if (def.type === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.addEventListener("change", () => setPending(def.key, input.checked));
            row.style.flexDirection = "row";
            row.style.alignItems = "center";
            row.style.gap = "14px";
            input.style.width = "17px";
            input.style.height = "17px";
            row.insertBefore(input, title);
            title.style.order = "1";
          } else {
            input = document.createElement("input");
            input.type = def.type === "number" ? "number" : "text";
            if (def.placeholder) input.placeholder = def.placeholder;
            if (def.min != null) input.min = String(def.min);
            if (def.max != null) input.max = String(def.max);
            if (def.step != null) input.step = String(def.step);
            input.style.cssText = "box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid var(--folium-border,rgba(128,128,128,.35));border-radius:8px;background:var(--folium-background,var(--folium-surface,transparent));color:inherit;color-scheme:inherit;";
            const commit = () => {
              const value = def.type === "number" ? Number(input.value) : input.value;
              if (def.type !== "number" || input.value.trim() !== "") setPending(def.key, value);
            };
            input.addEventListener("change", commit);
            input.addEventListener("blur", commit);
          }
          controls.set(def.key, { input, type: def.type });
          if (def.type !== "boolean") row.appendChild(input);
          GROUP_OF(def.key).appendChild(row);
        }
        const keyTitle = document.createElement("div");
        keyTitle.textContent = en ? "AI API key (stored locally)" : "AI API 密钥（本机保存）";
        keyTitle.style.cssText = "font-size:13px;font-weight:600;margin-top:20px;";
        groupAI.appendChild(keyTitle);
        const keyHelp = document.createElement("small");
        keyHelp.textContent = en ? "Not included in visual-config exports. Local storage is not an OS-encrypted keychain." : "密钥不会写入视觉配置导出；本地存储并非操作系统加密密钥库。";
        keyHelp.style.cssText = "opacity:.65;line-height:1.4;";
        groupAI.appendChild(keyHelp);
        const input = document.createElement("input");
        input.type = "password";
        input.autocomplete = "new-password";
        input.spellcheck = false;
        input.placeholder = en ? "Paste API key, then Save" : "粘贴 API 密钥后点击保存";
        input.style.cssText = "box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid var(--folium-border,#777);border-radius:8px;background:var(--folium-surface,transparent);color:inherit;";
        groupAI.appendChild(input);
        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
        const makeButton = (text) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = text;
          b.style.cssText = "padding:9px 16px;border:1px solid var(--folium-border,#777);border-radius:8px;background:transparent;color:inherit;cursor:pointer;";
          return b;
        };
        const save = makeButton(en ? "Save key" : "保存密钥");
        const clear = makeButton(en ? "Delete key" : "删除密钥");
        const status = document.createElement("div");
        status.style.cssText = "font-size:12px;opacity:.7;";
        save.addEventListener("click", async () => {
          const key = input.value.trim();
          if (!key) {
            status.textContent = en ? "Enter a key first; empty input will not overwrite it." : "请先输入密钥；留空不会覆盖现有密钥。";
            return;
          }
          try {
            await folium.storage.set(API_KEY_STORAGE, key);
            input.value = "";
            status.textContent = en ? "Key saved locally (not displayed)." : "密钥已保存到本机模组存储（不会回显）。";
          } catch (e) {
            status.textContent = en ? "Save failed; check mod storage permissions." : "保存失败，请检查模组存储权限。";
            folium.log.warn("API key save failed", String((e && e.message) || e));
          }
        });
        clear.addEventListener("click", async () => {
          try {
            await folium.storage.delete(API_KEY_STORAGE);
            input.value = "";
            status.textContent = en ? "Local key deleted." : "已删除本机保存的密钥。";
          } catch (e) {
            status.textContent = en ? "Delete failed." : "删除失败。";
            folium.log.warn("API key delete failed", String((e && e.message) || e));
          }
        });
        buttons.append(save, clear);
        groupAI.append(buttons, status);
        // AI 检索固定「详细」的说明（内容长度选项已不在 AI tab 提供）
        const aiFixedNote = document.createElement("small");
        aiFixedNote.textContent = en
          ? "AI lookup always uses the Detailed level; the content-length option applies to public search only. A custom endpoint receives your API key and song/artist data; only HTTPS or a local address is allowed."
          : "AI 检索固定使用「详细」挡位；内容长度选项仅用于公开检索。自定义接口地址会收到你的 API 密钥与歌曲资料；仅允许 HTTPS 或本机地址（localhost/127.x），其他协议不会发送请求。";
        aiFixedNote.style.cssText = "opacity:.65;line-height:1.4;";
        groupAI.appendChild(aiFixedNote);
        // 保存设置：统一写入暂存的全部改动后生效（API 密钥仍即时保存）
        const saveRow = document.createElement("div");
        saveRow.style.cssText = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--folium-border,rgba(128,128,128,.25));padding-top:22px;";
        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.textContent = en ? "Save settings" : "保存设置";
        saveBtn.style.cssText = "padding:10px 20px;border:1px solid rgba(139,92,246,.55);background:rgba(139,92,246,.16);color:inherit;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;";
        const saveStatus = document.createElement("div");
        saveStatus.style.cssText = "font-size:12px;opacity:.72;";
        saveStatus.textContent = en ? "Changes apply only after you click Save." : "改动仅在点击「保存设置」后生效。";
        saveBtn.addEventListener("click", async () => {
          const keys = Object.keys(pending);
          if (!keys.length) {
            saveStatus.textContent = en ? "No unsaved changes." : "没有需要保存的改动。";
            return;
          }
          const patch = { ...pending };
          saveBtn.disabled = true;
          try {
            await writeCfg(patch);
            for (const k of Object.keys(patch)) delete pending[k];
            refresh();
            saveStatus.textContent = en ? "Saved — changes are now active." : "已保存，改动已生效。";
          } catch (e) {
            saveStatus.textContent = en ? "Save failed; changes kept for retry." : "保存失败，改动已保留，可再次点击保存。";
            folium.log.warn("settings save failed", String((e && e.message) || e));
          } finally {
            saveBtn.disabled = false;
          }
        });
        saveRow.append(saveBtn, saveStatus);
        // 详细说明：以统一文段介绍模组基本行为（不采用版本更新记录格式）
        const detailRow = document.createElement("div");
        detailRow.style.cssText = "display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--folium-border,rgba(128,128,128,.25));padding-top:18px;";
        const detailBtn = document.createElement("button");
        detailBtn.type = "button";
        detailBtn.textContent = en ? "Detailed description" : "详细说明";
        detailBtn.style.cssText = "align-self:flex-start;padding:9px 16px;border:1px solid var(--folium-border,rgba(128,128,128,.35));border-radius:8px;background:transparent;color:inherit;cursor:pointer;font-size:13px;";
        const detailBody = document.createElement("div");
        detailBody.style.cssText = "display:none;font-size:13px;line-height:1.8;opacity:.94;color:inherit;";
        detailBody.innerHTML =
          (en ? "<b>Basic behavior</b>" : "<b>基本行为</b>") + "<p>" +
          (en
            ? "This mod shows song and artist info on the playback page: click the info button on the right of the progress bar to open the Song info panel for the current track."
            : "本模组在播放页展示歌曲与歌手资料：点击播放进度条右侧的信息按钮，即可打开「歌曲资料」面板查看当前曲目的相关信息。") +
          "</p><b>" + (en ? "Search behavior" : "检索行为") + "</b><p>" +
          (en
            ? "Public search queries Douban Music, Moegirlpedia, Baidu Baike and MusicBrainz at the same time and prefers whichever returns valid content first; the content-length level decides how many entries are used (Concise=1, Standard=2, Detailed=4). Public search only shows real retrieved data and never calls AI. AI search fills gaps on top of public results and may generate content from the model's own knowledge, always shown at the Detailed level. AI generation and AI memory supplement share the same AI endpoint and merge logic."
            : "公开检索会同时向豆瓣音乐、萌娘百科、百度百科和 MusicBrainz 四个来源发起查询，哪个来源先返回有效内容就优先采用；内容长度挡位决定采用条数（简洁 1 条、标准 2 条、详细 4 条）。公开检索只显示真实检索到的数据，不调用任何 AI。AI 检索在公开检索结果基础上补足缺口，必要时使用模型自身知识生成内容，固定按「详细」挡位展示。AI 生成与 AI 记忆补充共用同一个 AI 接口与查询合并逻辑。") +
          "</p><b>" + (en ? "AI memory supplement" : "AI 记忆补充") + "</b><p>" +
          (en
            ? "If the AI result has missing sections or too little content, the mod automatically (or when you click the button) calls AI memory supplement to fill the seven sections (credits, artist bio, representative works, artist career, background, source, listening notes) from the model's own knowledge. When sections are complete and content is sufficient it does not trigger automatically, avoiding unnecessary cost. With auto-supplement enabled, switching away and back to the tab re-checks once."
            : "AI 检索结果若有栏目缺失或内容过少，会自动（或由你点击按钮）调用 AI 记忆补充，凭模型自身知识补全作曲作词、歌手简介、歌手代表作、歌手经历、创作与发行背景、歌曲出处、聆听解读七个栏目；栏目齐全且内容充足时不自动触发，避免产生不必要的费用。开启自动补充后，切换到其他标签页再切回时也会自动复查一次。") +
          "</p><b>" + (en ? "Cache and queries" : "缓存与查询") + "</b><p>" +
          (en
            ? "Successful results are cached for 30 days; failed results are never cached. AI search waits at most 6 seconds for public fragments. Click Regenerate anytime to clear the cache and query again. Queries run only while the panel is open; same-host requests are rate-limited and stop once enough results are found. The optional Preload-next feature queries and caches the next track ahead of time (AI search only, may incur extra cost, off by default)."
            : "成功的查询结果会缓存 30 天，失败结果不会缓存；AI 检索的公开片段最多等待 6 秒。可随时点击「重新生成」清除缓存重新查询。面板打开时才发起查询；同源请求有间隔限流，命中足够结果即停止，避免高频抓取。可选的「预加载下一首」会在切歌时提前查询并缓存下一首资料（仅 AI 检索模式、可能产生额外调用费用，默认关闭）。") +
          "</p><b>" + (en ? "Translation" : "翻译") + "</b><p>" +
          (en
            ? "The translation target follows the app language: AI search only shows the app language. Keep original text applies to real public-search data only. MyMemory online translation is off by default; when enabled, up to 1800 characters of the text may be sent to the translation service."
            : "翻译目标跟随软件语言：AI 检索只显示软件使用语言；「保留原文」仅作用于公开检索到的真实资料。MyMemory 在线翻译默认关闭，开启后最多可能发送 1800 字资料文本至该翻译服务。") +
          "</p><b>" + (en ? "Keys and privacy" : "密钥与隐私") + "</b><p>" +
          (en
            ? "The AI provider API key is stored in local mod storage and is not exported with visual-config exports; local storage is not OS-level encryption. With AI enabled, song/artist names and retrieved fragments are sent to the AI provider you chose and may incur cost; please read its privacy policy. AI-generated and AI-supplemented content comes from the model's own knowledge and is not verified. Public data may be outdated or mismatched; please follow the source pages' copyright, attribution and license terms."
            : "AI 服务商的 API 密钥保存在本机模组存储中，不作为普通设置随视觉配置导出；本地存储并非操作系统级加密。启用 AI 后，歌曲名、歌手名与检索片段会发送至你选择的 AI 服务商，并可能产生费用，请阅读其隐私政策。AI 生成与 AI 记忆补充的内容均来自模型自身知识、未经检索核实，仅供阅读参考。公开资料可能过时、缺失或匹配错误；请遵守来源页面适用的版权、署名与许可要求。") +
          "</p>";
        detailBtn.addEventListener("click", () => {
          const show = detailBody.style.display === "none";
          detailBody.style.display = show ? "" : "none";
          detailBtn.textContent = show ? (en ? "Hide details" : "收起说明") : (en ? "Detailed description" : "详细说明");
        });
        detailRow.append(detailBtn, detailBody);
        wrap.append(groupPublic, groupAI, groupCommon, saveRow, detailRow);
        container.appendChild(wrap);

        const refresh = () => {
          const values = getValues();
          for (const def of settingsSchema) {
            if (def.key === "source") continue;
            const item = controls.get(def.key);
            if (!item) continue;
            const value = values[def.key] ?? def.defaultValue;
            if (item.type === "boolean") item.input.checked = Boolean(value);
            else item.input.value = value == null ? "" : String(value);
          }
          switchTab(values.source || "baike");
        };
        refresh();
        // 存储加载完成后刷新一次控件（避免持久化旧值未加载时被默认值顶替）
        ensureSettingsLoaded().then(() => { if (wrap.isConnected) refresh(); }).catch(() => {});
        return () => { wrap.remove(); };
      }
    });
  } catch (e) {
    folium.log.warn("settings register failed", String((e && e.message) || e));
  }

  const inflight = new Map();
  const getApiKey = async () => {
    try { return String((await folium.storage.get(API_KEY_STORAGE)) || ""); }
    catch (e) { folium.log.warn("API key read failed", String((e && e.message) || e)); return ""; }
  };
  let cacheMigrationPromise = null;
  const migrateLegacyCache = () => {
    if (!cacheMigrationPromise) cacheMigrationPromise = (async () => {
      try {
        const legacy = await folium.storage.get("si-cache");
        if (legacy && typeof legacy === "object") {
          const ok = await updateCache(folium, async (current) => {
            for (const [key, entry] of Object.entries(legacy)) {
              const d = entry && entry.data;
              const useful = d && !d.error && (d.ai || d.artistIntro || d.songIntro || (d.mb && (d.mb.album || d.mb.year || d.mb.releaseDate)));
              if (useful && !current[key]) current[key] = entry;
            }
          });
          if (ok) await folium.storage.delete("si-cache");
        }
      } catch (e) { folium.log.warn("legacy cache migration failed", String((e && e.message) || e)); }
    })();
    return cacheMigrationPromise;
  };
  const lookupAndCache = async (cfg, artist, title, source, force) => {
    const cacheKey = buildCacheKey(source, artist, title, cfg || {}, curLocale);
    if (!force && inflight.has(cacheKey)) return inflight.get(cacheKey);
    const p = (async () => {
      await migrateLegacyCache();
      const cache = await loadCache(folium);
      const hit = cache[cacheKey];
      const usefulHit = hit && hit.data && !hit.data.error && (hit.data.ai || hit.data.artistIntro || hit.data.songIntro || (hit.data.mb && (hit.data.mb.album || hit.data.mb.year || hit.data.mb.releaseDate)));
      if (!force && usefulHit && Date.now() - hit.ts < CACHE_TTL) return hit.data;
      const effectiveCfg = { ...(cfg || {}), apiKey: await getApiKey() };
      let data = null;
      if (effectiveCfg.source === "ai") data = await aiLookup(folium, effectiveCfg, artist, title, curLocale, effectiveCfg.keepOriginal);
      else data = await publicLookup(folium, artist, title, effectiveCfg, curLocale, effectiveCfg.keepOriginal);
      if (data && !data.error) {
        await updateCache(folium, (c) => { c[cacheKey] = { ts: Date.now(), data, source }; });
      }
      return data;
    })().catch((e) => {
      folium.log.warn("lookup failed", String((e && e.message) || e));
      return { error: "查询失败：" + String((e && e.message) || e || "未知错误") + "。这不一定代表设备断网；请检查接口地址、服务商状态、访问权限及控制台日志。失败结果不会缓存。" };
    }).finally(() => {
      // 仅当 Map 中保存的仍是对应当前请求的 Promise 时才清理，避免旧请求结束误删新请求的进行中标记
      if (inflight.get(cacheKey) === p) inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, p);
    return p;
  };

  let preloadLastKey = "";
  const preloadNextTrack = async () => {
    try {
      await ensureSettingsLoaded();
      const cfg = getCfg();
      if (!cfg.preloadNext || String(cfg.source || "baike") !== "ai") {
        logDiag(folium, "preload skip: preloadNext=" + !!cfg.preloadNext + " source=" + cfg.source);
        return;
      }
      // 下一首从播放队列读取（getState() 只返回当前歌曲，不含队列/下一首信息）
      const q = folium.playback.getQueue();
      if (!q || q.kind === "stage") { logDiag(folium, "preload skip: no queue (stage/external playback)"); return; }
      const nextItem = q.items.find((it) => it.index === q.currentIndex + 1);
      if (!nextItem || !nextItem.song) { logDiag(folium, "preload skip: no next song in queue"); return; }
      const title = String(nextItem.song.title || "").trim();
      const artist = String(nextItem.song.artist || "").trim();
      if (!title) { logDiag(folium, "preload skip: next song has no title"); return; }
      const key = artist + "\u0001" + title;
      if (key === preloadLastKey) return;
      preloadLastKey = key;
      logDiag(folium, "preload next: " + artist + " - " + title);
      // 预加载 = 完整的 AI 检索（固定详细挡位），与面板打开时的 AI 查询一致
      const preCfg = { ...cfg, source: "ai", aiMemoryOnly: false, contentDetail: "detailed" };
      const result = await lookupAndCache(preCfg, artist, title, "ai", false);
      if (result && result.error) folium.log.warn("next-track preload failed", result.error);
    } catch (e) { folium.log.warn("next-track preload failed", String((e && e.message) || e)); }
  };

  let preloadEventOff = null;
  try {
    preloadEventOff = folium.events.on("playback.songChanged", () => {
      setTimeout(() => { preloadNextTrack(); }, 600);
    });
  } catch (e) { folium.log.warn("next-track preload event registration failed", String((e && e.message) || e)); }

  folium.registries.progressButtons.register({
    id: "song-info-btn",
    slot: "progress.trailing",
    order: 400,
    hideWhenCollapsed: true,
    mount: (container, ctx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = "查看歌曲资料";
      btn.style.cssText =
        "display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;background:transparent;color:" +
        (ctx.getColors ? ctx.getColors().text : "inherit") +
        ";cursor:pointer;border-radius:6px;padding:0;";
      btn.innerHTML = INFO_SVG;
      btn.addEventListener("click", () => {
        folium.ui.openPlayerPanel("song-info");
      });
      container.appendChild(btn);

      const isMini = () => window.innerWidth < 600 || window.innerHeight < 220;
      const applyMini = () => { btn.style.display = isMini() ? "none" : ""; };
      applyMini();
      window.addEventListener("resize", applyMini);

      return () => {
        window.removeEventListener("resize", applyMini);
        btn.remove();
      };
    },
  });

  let lastPanelH = 0;
  folium.registries.playerPanelTabs.register({
    id: "song-info",
    label: { "zh-CN": "歌曲资料", en: "Song info" },
    order: 100,
    mount: (container, ctx) => {
      curLocale = (ctx && ctx.locale) || navigator.language || curLocale;
      const hPrev = container.offsetHeight || lastPanelH || 0;
      const root = document.createElement("div");
      root.className = "si-root";
      const style = document.createElement("style");
      style.textContent = CSS_TEXT;
      root.appendChild(style);
      const body = document.createElement("div");
      body.className = "si-body";
      root.appendChild(body);
      container.appendChild(root);
      if (hPrev > 0) root.style.height = hPrev + "px";
      body.style.opacity = "0";
      body.innerHTML = '<div class="si-load">正在查询资料…</div>';

      let curKey = null;
      let curCacheKey = null;
      let disposed = false;

      // 自动 AI 记忆补充的触发判定：
      // 1) 7 个栏目（作曲作词、歌手简介、歌手代表作、歌手经历、创作与发行背景、歌曲出处、聆听解读）不齐全 → 自动补充
      // 2) 栏目齐全但内容总量过少（总字符 < 120）→ 自动补充
      // 3) 栏目齐全且内容充足 → 不自动触发，仅用户点击「AI 记忆补充」时刷新
      const needsAutoSupplement = (data) => {
        if (!data || !data.ai) return false;
        const a = data.ai;
        const s = a.song || {}, ar = a.artist || {};
        const credits = [s.writers, s.composers, s.arranger].map((v) => String(v || "").trim()).filter(Boolean).join("；");
        const vals = [
          credits,
          String(ar.bio || "").trim(),
          String(ar.representativeWorks || "").trim(),
          String(ar.career || "").trim(),
          String(s.origin || "").trim(),
          String(s.source || "").trim(),
          String(s.listeningNotes || "").trim(),
        ];
        const filled = vals.filter((v) => v.length > 0).length;
        if (filled < 7) return true; // 栏目不齐全
        const total = vals.reduce((n, v) => n + v.length, 0);
        return total < 120; // 栏目齐全但信息过少
      };
      const memoryCfgOf = (cfg) => ({ ...(cfg || {}), source: "ai", aiMemoryOnly: true, contentDetail: "detailed" });
      // 统一的记忆补充合并：AI 记忆补充与 AI 生成来自同一个 AI 接口，此处只保留一份合并逻辑
      const mergeMemoryInto = (data, memData) => {
        if (!data || !data.ai || !memData || !memData.ai) return data;
        const out = JSON.parse(JSON.stringify(data));
        const merge = (dst, src) => {
          for (const [k, v] of Object.entries(src || {})) {
            if (v && typeof v === "object" && !Array.isArray(v)) { dst[k] = dst[k] || {}; merge(dst[k], v); continue; }
            const generated = String(v || "").trim();
            if (!generated) continue;
            const existing = String((dst && dst[k]) || "").trim();
            if (!existing) { dst[k] = generated; continue; }
            // 短字段（年份、日期、专辑、风格）只补空缺，不拼接，避免出现「2003\n\n2004」
            if (SHORT_FIELDS.has(k)) continue;
            if (!existing.includes(generated)) dst[k] = existing + "\n\n" + generated;
          }
        };
        merge(out.ai.song || (out.ai.song = {}), (memData.ai.song || {}));
        merge(out.ai.artist || (out.ai.artist = {}), (memData.ai.artist || {}));
        out.memorySupplementAdded = true;
        return out;
      };
      // 记忆补充统一入口：查询（支持传入并行中的 promise）→ 合并 → 写缓存 → 返回
      const runMemorySupplement = async (artist, title, baseData, memPromise) => {
        await ensureSettingsLoaded();
        const cfg = getCfg();
        const memResult = memPromise || await lookupAndCache(memoryCfgOf(cfg), artist, title, "ai-memory", false);
        if (!memResult || memResult.error || !memResult.ai) {
          return { ok: false, error: (memResult && memResult.error) || "AI 记忆补充失败" };
        }
        const ck = buildCacheKey("ai", artist, title, cfg, curLocale);
        if (!baseData || !baseData.ai) {
          // 当前没有 AI 基础数据：直接以记忆补充结果展示并写入缓存
          await updateCache(folium, (cache) => { cache[ck] = { ts: Date.now(), data: memResult, source: "ai" }; });
          return { ok: true, data: memResult };
        }
        const merged = mergeMemoryInto(baseData, memResult);
        if (merged !== baseData && !merged.error) {
          await updateCache(folium, (cache) => { cache[ck] = { ts: Date.now(), data: merged, source: "ai" }; });
        }
        return { ok: true, data: merged };
      };

      let animSeq = 0;
      let animTimer = null;
      const applyContent = (html) => {
        if (disposed) return;
        animSeq += 1;
        if (animTimer) { clearTimeout(animTimer); animTimer = null; }
        const mySeq = animSeq;
        let ran = false;
        const settle = (fn) => {
          if (disposed || ran || animSeq !== mySeq) return;
          ran = true;
          if (animTimer) { clearTimeout(animTimer); animTimer = null; }
          fn();
        };
        const h0 = root.offsetHeight || 0;
        root.style.transition = "none";
        root.style.height = h0 + "px";
        body.style.transition = "none";
        body.style.opacity = "0";
        body.style.overflow = "hidden";
        body.innerHTML = html;
        const h1 = body.offsetHeight;
        const show = () => {
          body.style.transition = "opacity .18s ease";
          body.style.opacity = "1";
          const done = () => settle(() => {
            body.style.transition = "";
            body.style.opacity = "";
            body.style.overflow = "";
            root.style.height = "";
            root.style.transition = "";
            lastPanelH = root.offsetHeight;
          });
          body.addEventListener("transitionend", done, { once: true });
          animTimer = setTimeout(done, 320);
        };
        const finish = () => settle(() => {
          root.style.height = "";
          root.style.transition = "";
          show();
        });
        if (Math.abs(h1 - h0) > 2) {
          const diff = Math.abs(h1 - h0);
          const dur = Math.min(0.5, Math.max(0.12, diff / 800));
          void root.offsetWidth;
          root.style.transition = `height ${dur}s ease`;
          root.style.height = h1 + "px";
          root.addEventListener("transitionend", finish, { once: true });
          animTimer = setTimeout(finish, dur * 1000 + 100);
        } else {
          finish();
        }
      };

      // 缓存数据触发自动补充（栏目不齐全或信息过少时），渲染与标签页切回共用
      const autoSupplement = async (song, key, hit, cacheKey) => {
        if (disposed || curKey !== key || !hit || !hit.data || hit.data.error) return false;
        if (!(getCfg().autoAiMemorySupplement && needsAutoSupplement(hit.data))) return false;
        applyContent('<div class="si-load">正在自动补充资料…</div>');
        logDiag(folium, "auto supplement: data needs supplement -> run for " + (song.artist || "") + " - " + song.title);
        const mem = await runMemorySupplement(song.artist || "", song.title, hit.data);
        if (disposed || curKey !== key) return true;
        logDiag(folium, "auto supplement done: ok=" + mem.ok + (mem.error ? " err=" + mem.error : ""));
        // 补充结果必须写回缓存，否则下次打开仍判定「资料不全」，同一首会重复付费查询
        if (mem.ok && mem.data && cacheKey) {
          await updateCache(folium, (c) => { c[cacheKey] = { ts: Date.now(), data: mem.data, source: "ai" }; });
        }
        applyContent(renderCard(song, mem.ok ? mem.data : hit.data, "ai", true));
        bindRegen(); bindMemorySupplement();
        return true;
      };

      const render = async (force) => {
        if (disposed) return;
        await ensureSettingsLoaded(); // 查询前先等待设置加载完成，未打开设置面板也使用已保存配置
        if (disposed) return;
        const st = folium.playback.getState();
        const song = st && st.song;
        if (!song) {
          curKey = null;
          curCacheKey = null;
          applyContent('<div class="si-none">当前没有播放中的歌曲</div>');
          return;
        }
        const key = [song.id || "", song.artist || "", song.title || ""].join("\u0001");
        if (!force && curKey === key) return;
        curKey = key;

        const cfg = getCfg();
        logDiag(folium, "render: source=" + cfg.source + " autoMem=" + !!cfg.autoAiMemorySupplement + " preload=" + !!cfg.preloadNext + " detail=" + cfg.contentDetail);
        const artist = song.artist || "";
        const title = song.title || "";
        const cacheKey = buildCacheKey(cfg.source || "baike", artist, title, cfg, curLocale);
        curCacheKey = cacheKey;
        const autoEnabled = String(cfg.source || "baike") === "ai" && !!(cfg && cfg.autoAiMemorySupplement);
        if (disposed || curKey !== key) return;

        // 先迁移旧版缓存，否则升级后首次渲染读不到已有数据，每首都要白查一遍
        await migrateLegacyCache();
        const cache = await loadCache(folium);
        if (disposed || curKey !== key) return;
        const hit = cache[cacheKey];
        const usefulCachedData = hit && hit.data && !hit.data.error &&
          (hit.data.ai || hit.data.artistIntro || hit.data.songIntro || (hit.data.mb && (hit.data.mb.album || hit.data.mb.year || hit.data.mb.releaseDate)));
        if (!force && usefulCachedData && Date.now() - hit.ts < CACHE_TTL) {
          if (await autoSupplement(song, key, hit, cacheKey)) return;
          applyContent(renderCard(song, hit.data, hit.source || cfg.source || "baike", true));
          bindRegen(); bindMemorySupplement();
          return;
        }

        applyContent('<div class="si-load">正在查询资料…</div>');
        // 主查询完成后按触发条件判定：栏目不齐全或信息过少才发起记忆补充（信息充足时不自动调用 AI）
        const data = await lookupAndCache(cfg, artist, title, cfg.source || "baike", !!force);
        if (disposed || curKey !== key) return;
        let finalData = data;
        if (autoEnabled && data && data.ai && needsAutoSupplement(data)) {
          logDiag(folium, "auto supplement: needs supplement -> run for " + artist + " - " + title);
          const mem = await runMemorySupplement(artist, title, data);
          if (disposed || curKey !== key) return;
          if (mem.ok) {
            finalData = mem.data;
            logDiag(folium, "auto supplement merged into result");
          } else {
            logDiag(folium, "auto supplement skipped: " + (mem.error || "no ai data"));
          }
        }
        if (disposed || curKey !== key) return;
        applyContent(renderCard(song, finalData, cfg.source || "baike", false));
        bindRegen(); bindMemorySupplement();
      };

      const bindRegen = () => {
        const b = body.querySelector(".si-regen:not(.si-memory-supplement)");
        if (!b) return;
        b.addEventListener("click", async () => {
          const key = curCacheKey;
          if (key) await updateCache(folium, (cache) => { delete cache[key]; });
          render(true);
        });
      };

      const bindMemorySupplement = () => {
        const b = body.querySelector(".si-memory-supplement");
        if (!b) return;
        b.addEventListener("click", async () => {
          const st = folium.playback.getState();
          const song = st && st.song;
          if (!song || !song.title) return;
          b.disabled = true;
          b.textContent = "AI 记忆补充中…";
          try {
            // 与自动补充共用同一查询/合并入口，不留第二套合并逻辑
            const cache = await loadCache(folium);
            const base = (curCacheKey && cache[curCacheKey] && cache[curCacheKey].data) || null;
            const r = await runMemorySupplement(song.artist || "", song.title, base);
            if (disposed) return;
            if (r.ok) {
              curKey = null;
              const st2 = folium.playback.getState();
              const song2 = st2 && st2.song;
              if (song2 && song2.title) {
                applyContent(renderCard(song2, r.data, "ai", true));
                bindRegen(); bindMemorySupplement();
              }
            } else {
              b.disabled = false;
              b.textContent = "AI 记忆补充";
              b.title = r.error || "补充失败，请检查 AI 设置";
            }
          } catch (e) {
            if (!disposed) {
              b.disabled = false;
              b.textContent = "AI 记忆补充";
            }
            folium.log.warn("AI memory supplement failed", String((e && e.message) || e));
          }
        });
      };

      const regenBtn = (aiDisabled) => '<button type="button" class="si-regen">重新生成</button><button type="button" class="si-regen si-memory-supplement"' + (aiDisabled ? ' disabled title="需切换到 AI 检索后可用"' : '') + '>AI 记忆补充</button>';
      const renderCard = (song, data, source, fromCache) => {
        const cfgNow = getCfg();
        const aiDisabled = String(cfgNow.source || "baike") !== "ai" && !(data && data.ai);
        const srcLabel = source === "ai" || (data && data.ai) ? (data && data.generatedByAi ? (data.aiAggregated ? "AI 参考检索生成" : "AI 生成，未经检索") : "AI 整理") : ((data && data.sources && data.sources.length) ? data.sources.join("、") : "公开检索");
        const sourceQuery = String(song.title || "") + (song.artist ? " " + song.artist : "");
        // AI 数据固定按「详细」显示；公开检索按设置的内容长度挡位
        const detailMode = (data && data.ai) ? "detailed" : (getCfg().contentDetail || "balanced");
        const textLimit = detailMode === "compact" ? 260 : detailMode === "detailed" ? 1200 : 600;
        const section = (title, value, limit) => value ? '<div class="si-sec"><div class="si-sec-t">' + esc(title) + '</div><div class="si-sec-b">' + esc(truncate(String(value), limit || textLimit)) + '</div></div>' : "";
        let html =
          '<div class="si-head">' +
          '<div class="si-song">' + esc(song.title) + '</div>' +
          '<div class="si-artist">' + esc(song.artist || "未知歌手") + "</div>" +
          '<div class="si-src">来源：' + esc(srcLabel) + (fromCache ? " · 已缓存" : "") + "</div></div>";

        if (data && data.generatedByAi) {
          html += data.aiAggregated ? '<div class="si-warn">AI 参考了公开检索结果并生成内容，请核对准确性。</div>' : '<div class="si-warn">AI 生成，未经检索；内容可能不准确，请自行核实。</div>';
        }
        if (data && data.memorySupplementAdded) {
          html += '<div class="si-warn">部分内容由 AI 记忆补充，未经检索核实，请自行核对。</div>';
        }

        if (!data) {
          html += '<div class="si-none">未找到相关资料</div>';
          html += regenBtn(aiDisabled);
          html += '<div class="si-foot">暂无可用资料。你可以稍后重试。</div>';
          return html;
        }
        if (data.error) {
          html += '<div class="si-err">' + esc(data.error) + "</div>";
          html += regenBtn(aiDisabled);
          html += '<div class="si-foot">可在模组管理的「资料查询」中修改设置</div>';
          return html;
        }

        if (data.ai) {
          const a = data.ai;
          const s = a.song || {};
          const ar = a.artist || {};
          const cl = (v) => String(v || "").replace(/检索资料未收录/g, "").replace(/未收录/g, "").trim();
          // AI 记忆补充的来源说明统一写在模组介绍（mod.json）中，不在资料正文或栏目名后标注，保证阅读连贯
          const meta = [];
          const album = cl(s.album);
          const year = cl(s.year);
          if (album) meta.push("专辑 " + esc(album));
          if (year) meta.push(esc(year) + " 年");
          if (s.releaseDate) meta.push("发行日期 " + esc(s.releaseDate));
          if (song.source) meta.push(esc(song.source === "local" ? "本地" : song.source));
          if (meta.length) html += '<div class="si-meta">' + meta.join(" · ") + "</div>";
          const bio = cl(ar.bio);
          const honors = cl(ar.honors);
          const career = cl(ar.career);
          const representativeWorks = cl(ar.representativeWorks);
          const songSource = cl(s.source);
          const content = cl(s.content);
          const origin = cl(s.origin);
          const credits = [s.writers && "作词：" + s.writers, s.composers && "作曲：" + s.composers, s.arranger && "编曲：" + s.arranger].filter(Boolean).join("；");
          const genres = String(s.genre || "").split(/[、,，/]/).map((x) => x.trim()).filter(Boolean).slice(0, 5);
          if (genres.length) html += '<div class="si-tags">' + genres.map((g) => '<span class="si-tag">' + esc(g) + '</span>').join("") + '</div>';
          html += section("歌曲简介", content);
          html += section("歌曲创作与发行背景", origin);
          html += section("歌曲出处", songSource);
          if (getCfg().showCredits !== false) html += section("作曲作词", credits, 360);
          if (getCfg().showListeningNotes !== false) html += section("聆听提示 · AI 解读", s.listeningNotes, 420);
          html += section("歌手简介", bio);
          if (getCfg().showArtistDetails !== false) {
            html += section("歌手代表作", representativeWorks);
            html += section("歌手经历", career);
            html += section("主要荣誉", honors, 420);
          }
          if (!bio && !honors && !career && !representativeWorks && !songSource && !origin && !content && !credits && !s.listeningNotes) html += '<div class="si-none">AI 未返回有效内容，可点「重新生成」重试</div>';
          html += regenBtn(aiDisabled);
          html += '<div class="si-foot">' + (data.generatedByAi ? (data.aiAggregated ? "AI 参考公开检索后生成；内容未逐项核实" : "AI 生成，未经检索；内容未核实") : "AI 整理内容仅供参考；来源：" + sourceLinksHtml(data.sources || [], sourceQuery)) + '</div>';
          return html;
        }

        const meta = [];
        if (data.mb && data.mb.album) meta.push("专辑 " + esc(data.mb.album));
        if (data.mb && data.mb.year) meta.push(esc(data.mb.year) + " 年");
        if (data.mb && data.mb.releaseDate && data.mb.releaseDate.length > 4) meta.push("发行日期 " + esc(data.mb.releaseDate));
        if (song.album) meta.push("唱片 " + esc(song.album));
        if (song.source) meta.push(esc(song.source === "local" ? "本地" : song.source));
        if (meta.length) html += '<div class="si-meta">' + meta.join(" · ") + "</div>";
        if (data.songIntro) html += section("歌曲介绍" + (data.songSource ? " · " + data.songSource : ""), data.songIntro, textLimit);
        if (data.artistIntro) html += section("歌手简介" + (data.artistSource ? " · " + data.artistSource : ""), data.artistIntro, textLimit);
        if (!data.artistIntro && !data.songIntro && !(data.mb && (data.mb.album || data.mb.year || data.mb.releaseDate))) {
          html += '<div class="si-none">未找到相关资料；失败结果不会缓存，可点击重新生成重试</div>';
        }
        html += regenBtn(aiDisabled);
        html += '<div class="si-foot">来源：' + sourceLinksHtml(data.sources || [], sourceQuery) + '。请查看原页面的署名与许可要求。</div>';
        return html;
      };

      render();
      setTimeout(() => { preloadNextTrack(); }, 800);
      const off = folium.events.on("playback.songChanged", () => {
        render();
      });

      // 标签页切回检测：面板从隐藏变为可见时，若自动补充开启且当前数据需要补充，则自动刷新一次
      let panelWasVisible = root.offsetWidth > 0 || root.offsetHeight > 0 || root.getClientRects().length > 0;
      const visTimer = setInterval(() => {
        if (disposed) return;
        const vis = root.offsetWidth > 0 || root.offsetHeight > 0 || root.getClientRects().length > 0;
        if (vis && !panelWasVisible) {
          panelWasVisible = true;
          (async () => {
            const st = folium.playback.getState();
            const song = st && st.song;
            if (!song || !song.title) return;
            const key = [song.id || "", song.artist || "", song.title || ""].join("\u0001");
            if (curKey !== key) return;
            const cache = await loadCache(folium);
            if (curCacheKey && cache[curCacheKey]) await autoSupplement(song, key, cache[curCacheKey], curCacheKey);
          })();
        } else if (!vis) {
          panelWasVisible = false;
        }
      }, 1500);

      return () => {
        disposed = true;
        if (animTimer) { clearTimeout(animTimer); animTimer = null; }
        clearInterval(visTimer);
        off();
        lastPanelH = root.offsetHeight || container.offsetHeight || lastPanelH;
        root.remove();
      };
    },
  });

  return () => {
    if (typeof preloadEventOff === "function") preloadEventOff();
  };
}
