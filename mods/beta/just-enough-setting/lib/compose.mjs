// mods/Just-Enough-Setting/lib/compose.mjs
// 把片段列表渲染成一行文本。
//
// 纯函数、无副作用：同一个编排规则同时服务系统媒体的三行、标签页标题与 Steam 的「正在玩」，
// 也同时服务面板里的预览与真正发出去的值，所以「预览看到什么」和「系统媒体收到什么」不可能不一致。
//
// 时间相关的两种片段（逐词歌词 word、播放时长 progress）也从这里出文本：它们只是
// 「需要 context 里多一个字段」的普通片段，排序、连接符、留空规则完全一样。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const {
  CUSTOM_TEXT_KINDS,
  PROGRESS_BAR_EMPTY,
  PROGRESS_BAR_FILLED,
  PROGRESS_BAR_LENGTH,
  PROGRESS_BAR_MAX_LENGTH,
  PROGRESS_DEFAULT_TEMPLATE,
} = await import(`./config.mjs${VERSION}`);

/**
 * 取一行的翻译：优先行自己的 translation，没有时退回宿主给的多份替代文本里 role 为
 * translation 的那一份（TTML 来源常把翻译放在那里）。
 *
 * 导出是因为诊断面板要显示同一份译文——面板说「没有翻译」而系统媒体上却有，
 * 是最难查的那种不一致。
 */
export const lineTranslation = (line) => {
  if (!line) return '';
  if (typeof line.translation === 'string' && line.translation) return line.translation;
  const alternate = Array.isArray(line.alternateTexts)
    ? line.alternateTexts.find((item) => item && item.role === 'translation')
    : null;
  return alternate && typeof alternate.text === 'string' ? alternate.text : '';
};

/** 秒 → `m:ss`。时长未知（不会走到这里）或负数一律按 0 处理。 */
export const formatClock = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
};

/**
 * 把一行的 words 对齐回 fullText，拿到每个词「之后」紧跟的空白与标点。
 *
 * 西文歌词的 words 通常不带空格（空格只留在 fullText 里），直接 join 会拼出 `HelloWorld`。
 * 宿主在导出增强 LRC 时踩过同一个坑（`src/utils/lyrics/enhancedLrcSerializer.ts` 的
 * `alignWordSegments`），这里用同一套对齐规则：先比「拼接是否恰好等于 fullText」，不等就按
 * `word.text.trim()` 顺序在 fullText 里定位，把中间的间隙补回前一个词的尾部；行首的空隙归到
 * 第一个词，行尾剩的归到最后一个词。
 *
 * 对不上时退回词自身的文本——宁可粘连，也不要显示一段位置错乱的内容。
 *
 * 导出是为了让检查脚本能直接拿宿主的序列化产物比分段（见 smoke 里那条 golden 断言）。
 */
export const alignWordsToLine = (words, fullText) => {
  const raw = words.map((word) => word.text);
  if (typeof fullText !== 'string' || raw.join('') === fullText) return raw;

  let cursor = 0;
  let leading = '';
  const aligned = [];
  for (const word of words) {
    const needle = word.text.trim();
    const index = needle === '' ? -1 : fullText.indexOf(needle, cursor);
    if (index < 0) return raw;
    const gap = fullText.slice(cursor, index);
    if (aligned.length === 0) leading = gap;
    else aligned[aligned.length - 1] += gap;
    aligned.push(needle);
    cursor = index + needle.length;
  }
  if (aligned.length === 0) return raw;
  aligned[0] = leading + aligned[0];
  aligned[aligned.length - 1] += fullText.slice(cursor);
  return aligned;
};

/** 当前唱到第几个词（返回已唱出的词数）。没有时间戳的词按「已经唱到」处理。 */
const revealedCountOf = (words, reference) => words
  .filter((word) => !Number.isFinite(word?.startTime) || word.startTime <= reference)
  .length;

/**
 * 逐词歌词：把「已经唱到」的词拼起来，得到这一句的进行时文本。
 *
 * 没带逐词时间的行（FoliumWord 里 words 只有一条、时间戳铺满整行）会整句一起出现——
 * 宿主对这类行本来也没有更细的信息，与其逐字猜，不如老实等整句。
 */
export const wordsRevealed = (line, time) => {
  if (!line) return '';
  const words = Array.isArray(line.words)
    ? line.words.filter((word) => word && typeof word.text === 'string')
    : [];
  if (words.length === 0) return line.fullText ?? '';

  const at = Number(time);
  const revealed = revealedCountOf(words, Number.isFinite(at) ? at : 0);
  if (revealed === 0) return '';
  // 先按整行对齐，再取「已唱出」的那个前缀：只拿已唱出的词去对齐，末尾那段
  // `fullText.slice(cursor)` 会把还没唱到的词一并带出来。
  return alignWordsToLine(words, line.fullText)
    .slice(0, revealed)
    .join('')
    .replace(/\s+$/u, '');
};

/** 已经有了逐词时间的行里，当前唱到第几个词（0 基计数 → 返回已唱出的词数）。 */
export const revealedWordCount = (line, time) => {
  if (!line || !Array.isArray(line.words) || line.words.length === 0) return 0;
  const at = Number(time);
  return revealedCountOf(line.words, Number.isFinite(at) ? at : 0);
};

// ---------------------------------------------------------------- 播放时长模板

const positiveInteger = (raw, fallback) => {
  const value = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(value, PROGRESS_BAR_MAX_LENGTH);
};

/** `{bar}` 的参数 → 进度条字符串。长度、已播字符、未播字符都可换。 */
const buildBar = (rawSpec, ratio) => {
  const spec = String(rawSpec ?? '').trim();
  const tokens = spec === '' ? [] : spec.split(':');
  const headIsLength = tokens.length > 0 && /^\d+$/u.test(tokens[0]);
  const length = headIsLength ? positiveInteger(tokens[0], PROGRESS_BAR_LENGTH) : PROGRESS_BAR_LENGTH;
  const glyphs = headIsLength ? tokens.slice(1) : tokens;

  let filled = PROGRESS_BAR_FILLED;
  let empty = PROGRESS_BAR_EMPTY;
  if (glyphs.length === 1) {
    // `{bar:#-}`：一个 token 里写两个字符，分别为已播 / 未播。
    const pair = [...glyphs[0]];
    filled = pair[0] || filled;
    if (pair.length > 1) empty = pair[1] ?? empty;
  } else if (glyphs.length >= 2) {
    filled = glyphs[0] || filled;
    empty = glyphs[1] || empty;
  }
  if (filled === empty) empty = filled === '-' ? '·' : '-';

  const clamped = Math.min(Math.max(ratio, 0), 1);
  const filledCount = clamped >= 1 ? length : Math.floor(clamped * length);
  return filled.repeat(filledCount) + empty.repeat(length - filledCount);
};

/**
 * 播放时长片段。默认模板 `{elapsed} {bar} {total}` → `1:23 ##-------- 4:56`。
 *
 * 总时长未知（直播、还没解析出时长）时整项不输出：一个没有总长的进度条是没有意义的，
 * 与其画一排空格不如让它按「空片段」被丢掉。
 */
const progressText = (fragment, context) => {
  const duration = Number(context.duration);
  const position = Number(context.position);
  if (!Number.isFinite(duration) || duration <= 0) return '';
  if (!Number.isFinite(position) || position < 0) return '';
  const ratio = Math.min(position / duration, 1);
  const template = typeof fragment.text === 'string' && fragment.text.trim() !== ''
    ? fragment.text
    : PROGRESS_DEFAULT_TEMPLATE;

  const values = {
    elapsed: formatClock(position),
    total: formatClock(duration),
    remaining: formatClock(Math.max(duration - position, 0)),
    percent: String(Math.round(ratio * 100)),
  };

  // 认不出的占位符原样保留：模板是用户手写的，静默吞掉最难查。
  return template.replace(/\{([a-z]+)(?::([^}]*))?\}/giu, (match, name, args) => {
    const key = String(name).toLowerCase();
    if (key === 'bar') return buildBar(args, ratio);
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
};

/** 单个片段 → 文本。没有当前歌词 / 没有正在播放的歌时一律出空串，由编排自己决定留不留空位。 */
const resolveFragment = (fragment, context) => {
  switch (fragment.kind) {
    case 'song': return context.song?.title ?? '';
    case 'artist': return context.song?.artist ?? '';
    case 'album': return context.song?.album ?? '';
    case 'lyric': return context.line?.fullText ?? '';
    case 'translation': return lineTranslation(context.line);
    case 'word': return wordsRevealed(context.line, context.wordTime);
    case 'progress': return progressText(fragment, context);
    default:
      return CUSTOM_TEXT_KINDS.includes(fragment.kind) ? (fragment.text ?? '') : '';
  }
};

/**
 * 渲染一个目标栏。三步：
 *
 *   1. 丢掉渲染为空的片段——没有在播的歌时「歌手」片段就是空的，它不该占位。
 *      **空白不算空**：一个空格连接符是有意义的内容，不能在这里被吃掉；
 *   2. 丢掉落在两端的「有字连接符」——`歌名 - 歌手` 在没有歌手时应该只剩「歌名」，
 *      而不是留一个孤儿连字符。只由空白组成的连接符是用户有意留的间距，两端也保留；
 *   3. 依次拼接。**结尾不再统一 trim**——正是它把「连接符做成空格」这件事悄悄抹掉的。
 *
 * 一栏里可以放任意多个连接符、文本各不相同，中间位置的都原样保留。
 */
export const composeTarget = (fragments, context) => {
  const resolved = (Array.isArray(fragments) ? fragments : [])
    .filter((fragment) => fragment && fragment.kind)
    .map((fragment) => ({ fragment, value: resolveFragment(fragment, context) }))
    .filter((item) => item.value !== '');

  const orphanAtEdge = (item) => item.fragment.kind === 'connector' && item.value.trim() !== '';
  while (resolved.length > 0 && orphanAtEdge(resolved[0])) resolved.shift();
  while (resolved.length > 0 && orphanAtEdge(resolved[resolved.length - 1])) resolved.pop();

  return resolved.map((item) => item.value).join('');
};

/**
 * 一次算出所有目标的文本。
 *
 * 这里逐个列出来而不是遍历 config 的 LAYOUT_TARGETS：这份列表和 DEFAULT_LAYOUT 必须
 * 一一对应，漏一个的后果是那个目标永远渲染成 undefined。检查脚本会拿 LAYOUT_TARGETS
 * 跟这里的键比对，漏了就报错。
 */
export const composeAll = (layout, context) => ({
  smtcTitle: composeTarget(layout?.smtcTitle, context),
  smtcArtist: composeTarget(layout?.smtcArtist, context),
  smtcAlbum: composeTarget(layout?.smtcAlbum, context),
  pageTitle: composeTarget(layout?.pageTitle, context),
  steamText: composeTarget(layout?.steamText, context),
});

/**
 * 一段文本里有没有真正的内容（不是只有空白）。三行全空时不接管平台媒体信息——一次把片段
 * 全删掉的误操作不应该把媒体浮窗清空；三行只剩空格时同理。
 */
export const hasText = (value) => typeof value === 'string' && value.trim() !== '';

/** 系统媒体三行的组合是否还有内容。 */
export const hasSmtcContent = (composed) => Boolean(composed
  && (hasText(composed.smtcTitle) || hasText(composed.smtcArtist) || hasText(composed.smtcAlbum)));

/** 把空白画出来，便于在诊断里看清「一个空格」到底存不存在。 */
export const visualizeSpaces = (text) => String(text ?? '').replace(/[ \t]/gu, '␣');

/**
 * 编排的一句话描述，用于诊断与命令面板结果：`歌曲名 + “ - ” + 歌手`。
 * kinds 是片段类型 → 文案的查表函数（由调用方注入翻译）。
 */
export const describeFragments = (fragments, labelOf) => {
  const parts = Array.isArray(fragments) ? fragments : [];
  if (parts.length === 0) return '';
  return parts
    .map((fragment) => {
      // 进度条片段的文本是模板，直接展示模板本身比展示它的渲染结果更有用。
      if (fragment.kind === 'progress') {
        const template = typeof fragment.text === 'string' && fragment.text.trim() !== ''
          ? fragment.text
          : PROGRESS_DEFAULT_TEMPLATE;
        return `“${template}”`;
      }
      if (CUSTOM_TEXT_KINDS.includes(fragment.kind)) return `“${visualizeSpaces(fragment.text ?? '')}”`;
      return labelOf(fragment.kind);
    })
    .join(' + ');
};
