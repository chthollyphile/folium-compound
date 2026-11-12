// mods/Just-Enough-Setting/lib/config.mjs
// 配置模型：片段列表 + 选项。
//
// 片段是唯一可编排的单位，五个目标（系统媒体标题栏 / 歌手栏 / 专辑栏、标签页标题、Steam「正在玩」）共用同一套
// 片段类型与同一份编排规则——「翻译」和「连接符」不是特例，它们就是两种片段，放哪、和谁拼、
// 一栏里放几个都由列表顺序决定。
//
// 值的真源是宿主 settingsSections 分区的设置（注册回来的 handle.settings，见 SETTINGS_SCHEMA）：面板只负责画法，
// 校验、持久化和随「视觉配置」导入导出都交给宿主。片段列表体量小但结构复杂，因此压缩成一个 JSON 文本设置
// layoutJson 存档，本文件负责它的容错解析与规范化。

export const CONFIG_VERSION = 1;

/**
 * 模组自身版本，必须与 mod.json 的 version 一致（检查脚本会盯着这一点）。
 *
 * 它唯一的用途是**自报**：诊断面板会显示它。模组被加载的到底是哪一版，只有它自己说得出来——
 * 「更新完看不到新功能」这类问题一眼就能判定是旧代码还在跑，还是新代码本身没生效。
 */
export const MOD_VERSION = '1.3.1';

/** 每个目标最多几个片段：防止一段误粘贴的 JSON 把栏位撑爆。 */
export const MAX_FRAGMENTS_PER_TARGET = 12;
/** 自定义文本（网站名称 / 连接符）长度上限。 */
export const MAX_CUSTOM_TEXT_LENGTH = 64;

/**
 * Steam 账号名长度上限。
 *
 * 这里存的是**账号名，不是密码** —— 它会随宿主的「视觉配置」一起被导出，所以只能放
 * 非敏感的东西。密码和刷新令牌留在 main 入口那边，不进参数、不进导出。
 */
export const MAX_STEAM_ACCOUNT_LENGTH = 64;

/**
 * 片段类型。site 与 connector 只是默认文本不同的两种自定义文本片段，排序语义完全一样；
 * word 与 progress 是两种「跟着时间动的」片段（见 lib/compose.mjs 与 lib/clock.mjs）。
 */
export const FRAGMENT_KINDS = Object.freeze(['song', 'artist', 'album', 'lyric', 'translation', 'word', 'progress', 'site', 'connector']);
/**
 * 带自定义文本的片段类型。site / connector 的文本就是它输出的文本；
 * progress 的文本是**模板**（留空表示用 PROGRESS_DEFAULT_TEMPLATE）。
 */
export const CUSTOM_TEXT_KINDS = Object.freeze(['site', 'connector', 'progress']);
/** 文本留空时回落到默认模板的片段类型（而不是「输出空字符串」）。 */
export const TEMPLATE_KINDS = Object.freeze(['progress']);
/**
 * 编排目标。
 *
 * 前四个是系统媒体（三行）与标签页标题。第五个 steamText 是 Steam 好友列表里那句
 * 「正在玩」—— Steam 只有一行，所以它只有一个目标，而不是像系统媒体那样三行。
 */
export const LAYOUT_TARGETS = Object.freeze(['smtcTitle', 'smtcArtist', 'smtcAlbum', 'pageTitle', 'steamText']);

// ---------------------------------------------------------------- 播放时长片段
//
// 默认渲染成 `1:23 ##-------- 4:56`（已播放 + 进度条 + 总时长）。模板里可用的占位符：
//
//   {elapsed} 已播放   {total} 总时长   {remaining} 剩余   {percent} 整数百分比
//   {bar} 进度条 —— 可以带参数：{bar:20} 20 格、{bar:#-} 换字符、{bar:20:▓░} 20 格换字符
//
// 认不出来的占位符原样留着，方便用户对照自己的模板排查拼写。

export const PROGRESS_DEFAULT_TEMPLATE = '{elapsed} {bar} {total}';
export const PROGRESS_BAR_LENGTH = 10;
export const PROGRESS_BAR_FILLED = '#';
export const PROGRESS_BAR_EMPTY = '-';
/** 进度条格子数上限：防一段手写模板把系统媒体的标题撑爆。 */
export const PROGRESS_BAR_MAX_LENGTH = 60;

/**
 * 默认编排：与宿主原本的行为一致（标题 / 歌手 / 专辑三行各占一栏），标签页为「歌名 - 歌手」，
 * Steam 的「正在玩」同样是「歌名 - 歌手」。
 */
export const DEFAULT_LAYOUT = Object.freeze({
  smtcTitle: Object.freeze([{ kind: 'song' }]),
  smtcArtist: Object.freeze([{ kind: 'artist' }]),
  smtcAlbum: Object.freeze([{ kind: 'album' }]),
  pageTitle: Object.freeze([{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }]),
  steamText: Object.freeze([{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }]),
});

export const OPTION_DEFAULTS = Object.freeze({
  /** 总开关：关闭时不改写系统媒体，也不写标签页标题。 */
  enabled: true,
  /** 是否把封面图交给系统媒体。 */
  sendArtwork: true,
  /** 是否接管标签页 / 窗口标题。 */
  pageTitleEnabled: true,
  /** 播放页左上角的诊断 HUD。 */
  hudEnabled: false,
  /**
   * 是否把编排结果发到 Steam。
   *
   * 默认关闭，而且必须由用户自己打开：这一项要登录用户本人的 Steam 账号，装了模组就
   * 悄悄替人登录是说不过去的。
   */
  steamEnabled: false,
  /** Steam 账号名（只用于显示与预填，密码不落在这里）。 */
  steamAccountName: '',
  /** 'auto' 精确排期到行时间戳；'manual' 用 manualOffsetSeconds。 */
  lyricSyncMode: 'auto',
  /** 自动模式的基准微调，秒。 */
  autoBaselineSeconds: 0,
  /** 手动模式的延迟，秒。 */
  manualOffsetSeconds: 0,
});

export const OPTION_KEYS = Object.freeze(Object.keys(OPTION_DEFAULTS));
export const LAYOUT_PARAM_KEY = 'layoutJson';

export const OFFSET_LIMITS = Object.freeze({
  autoBaselineSeconds: Object.freeze({ min: -1, max: 1, step: 0.05 }),
  manualOffsetSeconds: Object.freeze({ min: -3, max: 3, step: 0.05 }),
});

/**
 * 宿主参数 schema。面板用 settingsPanel 自绘，所以这些字段平时不会以表单出现；
 * 它们的价值在于：宿主负责校验（数值夹到区间、select 只能是声明过的选项）、持久化，
 * 以及随「视觉配置」导入导出一起走。
 */
export const SETTINGS_SCHEMA = Object.freeze([
  {
    key: 'enabled',
    type: 'boolean',
    group: { 'zh-CN': '开关', en: 'Switches' },
    label: { 'zh-CN': '启用 SMTC 自定义', en: 'Customize the system media panel' },
    description: { 'zh-CN': '关闭后系统媒体恢复宿主原本的标题、歌手与专辑。', en: 'Off restores the host title, artist and album.' },
    defaultValue: OPTION_DEFAULTS.enabled,
  },
  {
    key: 'sendArtwork',
    type: 'boolean',
    group: { 'zh-CN': '开关', en: 'Switches' },
    label: { 'zh-CN': '向系统媒体发送封面', en: 'Send cover art to the system media panel' },
    description: { 'zh-CN': '关闭后媒体浮窗只显示文字，不发送专辑图。', en: 'Off sends text only, without the album thumbnail.' },
    defaultValue: OPTION_DEFAULTS.sendArtwork,
  },
  {
    key: 'pageTitleEnabled',
    type: 'boolean',
    group: { 'zh-CN': '开关', en: 'Switches' },
    label: { 'zh-CN': '自定义标签页标题', en: 'Customize the tab title' },
    description: { 'zh-CN': '关闭后恢复 Folia 原本的窗口标题。', en: 'Off restores the plain Folia window title.' },
    defaultValue: OPTION_DEFAULTS.pageTitleEnabled,
  },
  {
    key: 'hudEnabled',
    type: 'boolean',
    group: { 'zh-CN': '开关', en: 'Switches' },
    label: { 'zh-CN': '播放页诊断 HUD', en: 'Diagnostics HUD on the player page' },
    description: { 'zh-CN': '在播放页左上角叠加实时诊断。', en: 'Overlays live diagnostics in the top-left corner of the player page.' },
    defaultValue: OPTION_DEFAULTS.hudEnabled,
  },
  {
    key: 'steamEnabled',
    type: 'boolean',
    group: { 'zh-CN': 'Steam', en: 'Steam' },
    label: { 'zh-CN': '把播放状态发到 Steam', en: 'Report playback to Steam' },
    description: {
      'zh-CN': '登录你自己的 Steam 账号，把下面的编排发成「正在玩」。默认关闭：这一项要连的是你的账号，得你自己开。',
      en: 'Logs into your own Steam account and reports the layout below as “playing”. Off by default — it uses your account, so it is your call.',
    },
    defaultValue: OPTION_DEFAULTS.steamEnabled,
  },
  {
    key: 'steamAccountName',
    type: 'text',
    group: { 'zh-CN': 'Steam', en: 'Steam' },
    label: { 'zh-CN': 'Steam 账号名', en: 'Steam account name' },
    description: {
      'zh-CN': '只用来预填登录框。密码和登录令牌存在模组数据里，不会写进这个参数，也不会随配置导出。',
      en: 'Only pre-fills the sign-in box. The password and refresh token live in the mod’s data, not in this parameter, so they are never exported with your config.',
    },
    defaultValue: OPTION_DEFAULTS.steamAccountName,
  },
  {
    key: 'lyricSyncMode',
    type: 'select',
    group: { 'zh-CN': '歌词同步', en: 'Lyric sync' },
    label: { 'zh-CN': '歌词延迟', en: 'Lyric delay' },
    description: {
      'zh-CN': '自动按歌词行时间戳精确排期；手动用下面的 ±3 秒滑杆。',
      en: 'Auto schedules to the lyric line timestamps; manual uses the ±3 s slider below.',
    },
    options: [
      { value: 'auto', label: { 'zh-CN': '自动（精确排期到行时间戳）', en: 'Auto (scheduled to line timestamps)' } },
      { value: 'manual', label: { 'zh-CN': '手动（±3 秒）', en: 'Manual (±3 s)' } },
    ],
    defaultValue: OPTION_DEFAULTS.lyricSyncMode,
  },
  {
    key: 'autoBaselineSeconds',
    type: 'number',
    group: { 'zh-CN': '歌词同步', en: 'Lyric sync' },
    label: { 'zh-CN': '页面歌词基准微调（秒）', en: 'Page lyric baseline fine-tune (s)' },
    description: {
      'zh-CN': '自动模式下换算歌词时间的基准偏移；只有宿主歌词时钟不可用时才会用上。',
      en: 'Base offset turning playback time into lyric time; only used when the host lyric clock is unavailable.',
    },
    min: OFFSET_LIMITS.autoBaselineSeconds.min,
    max: OFFSET_LIMITS.autoBaselineSeconds.max,
    step: OFFSET_LIMITS.autoBaselineSeconds.step,
    defaultValue: OPTION_DEFAULTS.autoBaselineSeconds,
  },
  {
    key: 'manualOffsetSeconds',
    type: 'number',
    group: { 'zh-CN': '歌词同步', en: 'Lyric sync' },
    label: { 'zh-CN': '手动延迟（秒）', en: 'Manual delay (s)' },
    description: {
      'zh-CN': '整体推迟（正值）或提前（负值）系统媒体里的歌词。',
      en: 'Delays (positive) or advances (negative) the lyric shown in the system media panel.',
    },
    min: OFFSET_LIMITS.manualOffsetSeconds.min,
    max: OFFSET_LIMITS.manualOffsetSeconds.max,
    step: OFFSET_LIMITS.manualOffsetSeconds.step,
    defaultValue: OPTION_DEFAULTS.manualOffsetSeconds,
  },
  {
    key: LAYOUT_PARAM_KEY,
    type: 'text',
    group: { 'zh-CN': '片段编排', en: 'Fragment layout' },
    label: { 'zh-CN': '片段编排（JSON）', en: 'Fragment layout (JSON)' },
    description: {
      'zh-CN': '面板的拖拽编辑器会写这里；一般不用手改。',
      en: 'Written by the panel’s drag-and-drop editor; no need to edit by hand.',
    },
    defaultValue: '',
  },
]);

// ---------------------------------------------------------------- 规范化

const clampNumber = (value, fallback, { min, max, step }) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const clamped = Math.min(Math.max(numeric, min), max);
  return step > 0 ? Math.round(clamped / step) * step : clamped;
};

const normalizeFragment = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const kind = FRAGMENT_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  if (!CUSTOM_TEXT_KINDS.includes(kind)) return { kind };
  const custom = typeof raw.text === 'string' ? raw.text.slice(0, MAX_CUSTOM_TEXT_LENGTH) : '';
  return { kind, text: custom };
};

/**
 * 容错版编排解析：缺的目标补默认，未知片段类型丢弃，自定义文本截断，单个目标超量裁掉。
 * 空数组是合法值（表示这一栏留空），只有整个目标字段缺失才回落到默认编排。
 */
export const normalizeLayout = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const layout = {};
  LAYOUT_TARGETS.forEach((target) => {
    const list = Array.isArray(source[target]) ? source[target] : DEFAULT_LAYOUT[target];
    layout[target] = list
      .map(normalizeFragment)
      .filter(Boolean)
      .slice(0, MAX_FRAGMENTS_PER_TARGET);
  });
  return layout;
};

/**
 * 容错版选项解析：`fallback` 是缺字段时的取用值（导入片段配置时不覆盖用户已有选项）。
 */
export const normalizeOptions = (raw, fallback = OPTION_DEFAULTS) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const mode = source.lyricSyncMode === 'manual' || source.lyricSyncMode === 'auto'
    ? source.lyricSyncMode
    : (fallback.lyricSyncMode ?? OPTION_DEFAULTS.lyricSyncMode);
  const steamAccount = typeof source.steamAccountName === 'string'
    ? source.steamAccountName.slice(0, MAX_STEAM_ACCOUNT_LENGTH)
    : (fallback.steamAccountName ?? OPTION_DEFAULTS.steamAccountName);
  return {
    enabled: source.enabled === undefined ? (fallback.enabled ?? OPTION_DEFAULTS.enabled) : source.enabled !== false,
    sendArtwork: source.sendArtwork === undefined ? (fallback.sendArtwork ?? OPTION_DEFAULTS.sendArtwork) : source.sendArtwork !== false,
    pageTitleEnabled: source.pageTitleEnabled === undefined
      ? (fallback.pageTitleEnabled ?? OPTION_DEFAULTS.pageTitleEnabled)
      : source.pageTitleEnabled !== false,
    hudEnabled: source.hudEnabled === undefined ? (fallback.hudEnabled ?? OPTION_DEFAULTS.hudEnabled) : source.hudEnabled !== false,
    steamEnabled: source.steamEnabled === undefined
      ? (fallback.steamEnabled ?? OPTION_DEFAULTS.steamEnabled)
      : source.steamEnabled === true,
    steamAccountName: steamAccount,
    lyricSyncMode: mode,
    autoBaselineSeconds: clampNumber(
      source.autoBaselineSeconds,
      fallback.autoBaselineSeconds ?? OPTION_DEFAULTS.autoBaselineSeconds,
      OFFSET_LIMITS.autoBaselineSeconds,
    ),
    manualOffsetSeconds: clampNumber(
      source.manualOffsetSeconds,
      fallback.manualOffsetSeconds ?? OPTION_DEFAULTS.manualOffsetSeconds,
      OFFSET_LIMITS.manualOffsetSeconds,
    ),
  };
};

/** 从宿主参数值读出完整配置。 */
export const readConfig = (values) => {
  const source = values && typeof values === 'object' ? values : {};
  return {
    layout: parseLayoutParam(source[LAYOUT_PARAM_KEY]),
    options: normalizeOptions(source, OPTION_DEFAULTS),
  };
};

/** 参数里的编排字符串 → 编排对象；坏了就当默认，不让一次手改的 JSON 毁掉模组。 */
export const parseLayoutParam = (text) => {
  if (typeof text !== 'string' || text.trim() === '') return normalizeLayout(null);
  try {
    return normalizeLayout(JSON.parse(text));
  } catch {
    return normalizeLayout(null);
  }
};

/** 编排对象 → 参数值。存紧凑 JSON：它会随宿主「视觉配置」一起被打包导出。 */
export const stringifyLayoutParam = (layout) => JSON.stringify(normalizeLayout(layout));

/** 编排 + 选项 → 一个可直接写回参数的 patch。 */
export const toParamPatch = (config) => {
  const patch = { [LAYOUT_PARAM_KEY]: stringifyLayoutParam(config.layout) };
  OPTION_KEYS.forEach((key) => { patch[key] = config.options[key]; });
  return patch;
};

/** 当前歌词延迟偏移（秒）。自动模式用基准微调，手动模式用滑杆值。 */
export const offsetSeconds = (options) => (
  options.lyricSyncMode === 'manual' ? options.manualOffsetSeconds : options.autoBaselineSeconds
);

// ---------------------------------------------------------------- 导入 / 导出

export const CONFIG_FILE_NAME = 'smtc-settings.json';

/** 导出文档：编排与选项都在里面，导回去即可完整还原。 */
export const serializeConfig = (config) => JSON.stringify({
  folium: 1,
  mod: 'just-enough-setting',
  configVersion: CONFIG_VERSION,
  layout: normalizeLayout(config.layout),
  options: normalizeOptions(config.options),
}, null, 2);

/**
 * 导入文档解析。既接受完整文档，也接受只带五个编排目标的裸对象。
 * 裸对象里没有 options 时返回 `options: null`，表示「保留当前选项」而不是把它们重置成默认。
 */
export const parseConfig = (text) => {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('config-root');
  }
  const layoutSource = raw.layout && typeof raw.layout === 'object' ? raw.layout : raw;
  return {
    layout: normalizeLayout(layoutSource),
    options: raw.options && typeof raw.options === 'object' ? normalizeOptions(raw.options) : null,
  };
};

// ---------------------------------------------------------------- 快速预设
//
// 每个预设是一整套配置（编排 + 相关选项），一键套用。

export const PRESETS = Object.freeze([
  {
    id: 'native',
    label: { 'zh-CN': '原版', en: 'Native' },
    description: { 'zh-CN': '宿主原本的三行：歌曲名 / 歌手 / 专辑。', en: 'The host’s own rows: song / artist / album.' },
    layout: DEFAULT_LAYOUT,
    options: {},
  },
  {
    id: 'lyric-on-artist',
    label: { 'zh-CN': '歌词上镜', en: 'Lyrics on screen' },
    description: { 'zh-CN': '标题栏显示当前歌词，歌手栏显示「歌名 · 歌手」。', en: 'Title row shows the current lyric; artist row shows “song · artist”.' },
    layout: {
      smtcTitle: [{ kind: 'lyric' }],
      smtcArtist: [{ kind: 'song' }, { kind: 'connector', text: ' · ' }, { kind: 'artist' }],
      smtcAlbum: [{ kind: 'album' }],
      pageTitle: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
      steamText: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
    },
    options: { lyricSyncMode: 'auto' },
  },
  {
    id: 'bilingual',
    label: { 'zh-CN': '双语歌词', en: 'Bilingual lyrics' },
    description: { 'zh-CN': '标题栏歌词、歌手栏翻译，专辑栏放歌名与歌手。', en: 'Lyric in the title row, translation in the artist row, song and artist in the album row.' },
    layout: {
      smtcTitle: [{ kind: 'lyric' }],
      smtcArtist: [{ kind: 'translation' }],
      smtcAlbum: [{ kind: 'song' }, { kind: 'connector', text: ' — ' }, { kind: 'artist' }],
      pageTitle: [{ kind: 'lyric' }],
      steamText: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
    },
    options: { lyricSyncMode: 'auto' },
  },
  {
    id: 'compact',
    label: { 'zh-CN': '紧凑', en: 'Compact' },
    description: { 'zh-CN': '三行压成两行：标题栏「歌名 - 歌手」，歌手栏专辑。', en: 'Three rows into two: title row “song - artist”, artist row the album.' },
    layout: {
      smtcTitle: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
      smtcArtist: [{ kind: 'album' }],
      smtcAlbum: [],
      pageTitle: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
      steamText: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
    },
    options: {},
  },
  {
    id: 'karaoke',
    label: { 'zh-CN': '逐词 + 进度', en: 'Word-by-word + progress' },
    description: {
      'zh-CN': '标题栏随播放逐词显示歌词，专辑栏显示「已播放 + 进度条 + 总时长」。',
      en: 'The title row reveals the lyric word by word; the album row shows “elapsed + bar + total”.',
    },
    layout: {
      smtcTitle: [{ kind: 'word' }],
      smtcArtist: [{ kind: 'song' }],
      smtcAlbum: [{ kind: 'progress' }],
      pageTitle: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
      steamText: [{ kind: 'song' }, { kind: 'connector', text: ' - ' }, { kind: 'artist' }],
    },
    options: { lyricSyncMode: 'auto' },
  },
  {
    id: 'minimal',
    label: { 'zh-CN': '极简', en: 'Minimal' },
    description: { 'zh-CN': '只留歌曲名，其余两栏留空。', en: 'Only the song title; the other two rows stay empty.' },
    layout: {
      smtcTitle: [{ kind: 'song' }],
      smtcArtist: [],
      smtcAlbum: [],
      pageTitle: [{ kind: 'song' }],
      steamText: [{ kind: 'song' }],
    },
    options: {},
  },
]);

export const findPreset = (id) => PRESETS.find((preset) => preset.id === id) ?? null;
