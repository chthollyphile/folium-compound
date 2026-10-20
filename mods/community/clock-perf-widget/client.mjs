/**
 * mods/clock-perf-widget/client.mjs — Folium 1.x 客户端入口（v2）。
 *
 * 三个互相独立的组件：时钟 / FPS / 性能监测。每个组件各自注册到两个 slot
 * （`app.overlay` 与 `player.stage.front`），共 6 个 stage layer；`placement`
 * 决定两层里哪一层真的显示。每个组件有独立的显示开关、位置、样式与大小。
 *
 * 卡片 DOM 每个 layer 只建一次；刷新只写 textContent / style / transform。
 *
 * 设置变更由设置句柄的 `subscribe`（0.7.20 起）推给层，回调里自己再 get()
 * 一次并重跑 apply()。只有拿不到 `subscribe` 的老宿主才退回每秒轮询
 * settings.get()。轮询本身不算组件循环：组件不可见或关闭时组件自己的
 * rAF/interval 一律停掉（syncLoops）。
 */

/* ------------------------------------------------------------------ 常量 */

/** 拿不到 `subscribe` 时的兜底轮询间隔；0.7.20 以前的宿主只有这条路。 */
const FALLBACK_POLL_MS = 1000;
const CORNER_MARGIN = 16;

/** 时钟停靠左侧时再让开的距离：窗口左上角有返回/菜单按钮。 */
const CLOCK_LEFT_SAFE = 96;
const MIN_METRICS_MS = 250;
const BLINK_MS = 500;

/** 性能卡的基准宽度：横排三条指标比竖排需要更宽的行。 */
const PERF_WIDTH = 214;
const PERF_HORIZONTAL_WIDTH = 288;

/** 三个组件各自的位置存储 key（按视口比例存）；改动布局语义时换 key，旧存档不再喂给新布局。 */
const STORE_KEYS = {
  clock: 'pos-clock-v2',
  fps: 'pos-fps-v2',
  perf: 'pos-perf-v2',
};

const CLOCK_STYLES = ['minimal', 'terminal', 'stacked', 'outline'];

/** v2 存下来的 `mono` / `glow` / `neon` 对应现在的 `terminal` / `outline`。 */
const CLOCK_STYLE_ALIASES = { mono: 'terminal', glow: 'outline', neon: 'outline' };
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
const PLACEMENTS = ['global', 'player', 'off'];

const SLOT_OVERLAY = 'app.overlay';
const SLOT_PLAYER = 'player.stage.front';

const MONO_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace';
const UI_FAMILY = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

const BARE_TEXT_SHADOW = '0 1px 4px rgba(0, 0, 0, 0.92), 1px 1px 0 rgba(0, 0, 0, 0.75), -1px -1px 0 rgba(0, 0, 0, 0.75)';

const CARD_SHELL_CSS = [
  'position:fixed',
  'left:0',
  'top:0',
  'box-sizing:border-box',
  'display:none',
  'flex-direction:column',
  'gap:2px',
  'border:1px solid transparent',
  'font-family:' + UI_FAMILY,
  'font-variant-numeric:tabular-nums',
  'line-height:1.2',
  'cursor:grab',
  'user-select:none',
  '-webkit-user-select:none',
  'will-change:transform',
  'transform:translate3d(0, 0, 0)',
  'contain:layout style',
].join(';') + ';';

/* ------------------------------------------------------------------ 设置 */

const label = (zh, en) => ({ 'zh-CN': zh, en });

const GROUP_GENERAL = label('通用', 'General');
const GROUP_CLOCK = label('时钟', 'Clock');
const GROUP_FPS = label('FPS', 'FPS');
const GROUP_PERF = label('性能监测', 'Performance');
const GROUP_STYLE = label('外观与大小', 'Appearance');

const CORNER_OPTIONS = [
  { value: 'top-left', label: label('左上', 'Top left') },
  { value: 'top-right', label: label('右上', 'Top right') },
  { value: 'bottom-left', label: label('左下', 'Bottom left') },
  { value: 'bottom-right', label: label('右下', 'Bottom right') },
];

/* 宿主设置面板只有开关 / 下拉 / 滑条三类控件，颜色因此以下拉预设的形式给出。 */
const COLOR_OPTIONS = [
  { value: '#f4f4f6', label: label('白', 'White') },
  { value: '#9aa4b2', label: label('银灰', 'Silver') },
  { value: '#5ac8fa', label: label('天蓝', 'Sky blue') },
  { value: '#64d2ff', label: label('青', 'Cyan') },
  { value: '#39c5bb', label: label('葱绿', 'Spring onion') },
  { value: '#34c759', label: label('薄荷绿', 'Mint') },
  { value: '#ffd60a', label: label('柠檬黄', 'Lemon') },
  { value: '#ff9f0a', label: label('琥珀', 'Amber') },
  { value: '#ff375f', label: label('珊瑚红', 'Coral') },
  { value: '#bf5af2', label: label('紫', 'Violet') },
];

const SETTINGS = [
  {
    key: 'placement',
    type: 'select',
    label: label('舞台层', 'Stage layer'),
    group: GROUP_GENERAL,
    description: label(
      'global 用 app.overlay，player 用 player.stage.front，off 两个 slot 都不渲染。三个组件共用。',
      'global uses app.overlay, player uses player.stage.front, off hides both slots.',
    ),
    defaultValue: 'global',
    options: [
      { value: 'global', label: label('全局（app.overlay）', 'Global (app.overlay)') },
      { value: 'player', label: label('播放器舞台（player.stage.front）', 'Player stage') },
      { value: 'off', label: label('关闭', 'Off') },
    ],
  },
  {
    key: 'clockShow',
    type: 'boolean',
    label: label('显示时钟', 'Show clock'),
    group: GROUP_CLOCK,
    description: label('关掉后时钟两层都不渲染。', 'Off hides the clock on both slots.'),
    defaultValue: true,
  },
  {
    key: 'clockStyle',
    type: 'select',
    label: label('时钟样式', 'Clock style'),
    group: GROUP_CLOCK,
    description: label(
      '四种样式是四套排版：极简（时间右侧贴日期）/ 终端（>_ + ISO 日期 + 闪烁光标）/ 上下堆叠（日期在顶、时·分两行夹细线）/ 轮廓（描边实心字，忽略卡片底色）。',
      'Four layouts: minimal (date beside the time), terminal (>_ + ISO date + blinking cursor), stacked (date header over hours and minutes separated by a rule), outline (stroked solid type that ignores the card fill).',
    ),
    defaultValue: 'minimal',
    options: [
      { value: 'minimal', label: label('极简', 'Minimal') },
      { value: 'terminal', label: label('终端', 'Terminal') },
      { value: 'stacked', label: label('上下堆叠', 'Stacked') },
      { value: 'outline', label: label('轮廓', 'Outline') },
    ],
  },
  {
    key: 'clockShowDate',
    type: 'boolean',
    label: label('显示日期', 'Show date'),
    group: GROUP_CLOCK,
    defaultValue: true,
  },
  {
    key: 'clockShowWeekday',
    type: 'boolean',
    label: label('显示星期', 'Show weekday'),
    group: GROUP_CLOCK,
    defaultValue: true,
  },
  {
    key: 'clock24',
    type: 'boolean',
    label: label('24 小时制', '24-hour clock'),
    group: GROUP_CLOCK,
    description: label('关掉后用 12 小时制并带上午/下午。', 'Off switches to 12-hour with an am/pm marker.'),
    defaultValue: true,
  },
  {
    key: 'clockColor',
    type: 'select',
    label: label('时钟文字颜色', 'Clock color'),
    group: GROUP_CLOCK,
    defaultValue: '#f4f4f6',
    options: COLOR_OPTIONS,
  },
  {
    key: 'cornerClock',
    type: 'select',
    label: label('时钟默认角', 'Clock default corner'),
    group: GROUP_CLOCK,
    description: label('双击卡片回到这个角。', 'Double-click the card to return here.'),
    defaultValue: 'top-left',
    options: CORNER_OPTIONS,
  },
  {
    key: 'clockClickThrough',
    type: 'boolean',
    label: label('时钟鼠标穿透', 'Clock click-through'),
    group: GROUP_CLOCK,
    description: label('打开后卡片不响应鼠标，也就不能拖动。', 'On makes the card ignore the pointer, so it cannot be dragged either.'),
    defaultValue: false,
  },

  {
    key: 'fpsShow',
    type: 'boolean',
    label: label('显示 FPS', 'Show FPS'),
    group: GROUP_FPS,
    description: label('关掉后 FPS 两层都不渲染。', 'Off hides FPS on both slots.'),
    defaultValue: true,
  },
  {
    key: 'fpsShowLabel',
    type: 'boolean',
    label: label('显示 FPS 标签', 'Show FPS label'),
    group: GROUP_FPS,
    description: label('显示数字前面的“FPS”字样。', 'Shows the FPS caption before the number.'),
    defaultValue: true,
  },
  {
    key: 'fpsFontSize',
    type: 'number',
    label: label('FPS 字号（px）', 'FPS font size (px)'),
    group: GROUP_FPS,
    description: label('会再乘整体大小。', 'Multiplied by the overall scale.'),
    defaultValue: 26,
    min: 14,
    max: 72,
    step: 1,
  },
  {
    key: 'fpsValueColor',
    type: 'select',
    label: label('FPS 数字颜色', 'FPS number color'),
    group: GROUP_FPS,
    defaultValue: '#f4f4f6',
    options: COLOR_OPTIONS,
  },
  {
    key: 'fpsLabelColor',
    type: 'select',
    label: label('FPS 标签颜色', 'FPS label color'),
    group: GROUP_FPS,
    defaultValue: '#9aa4b2',
    options: COLOR_OPTIONS,
  },
  {
    key: 'cornerFps',
    type: 'select',
    label: label('FPS 默认角', 'FPS default corner'),
    group: GROUP_FPS,
    defaultValue: 'bottom-left',
    options: CORNER_OPTIONS,
  },
  {
    key: 'fpsClickThrough',
    type: 'boolean',
    label: label('FPS 鼠标穿透', 'FPS click-through'),
    group: GROUP_FPS,
    description: label('打开后卡片不响应鼠标，也就不能拖动。', 'On makes the card ignore the pointer, so it cannot be dragged either.'),
    defaultValue: false,
  },

  {
    key: 'perfShow',
    type: 'boolean',
    label: label('显示性能监测', 'Show performance panel'),
    group: GROUP_PERF,
    description: label('关掉后性能两层都不渲染。', 'Off hides the panel on both slots.'),
    defaultValue: true,
  },
  {
    key: 'showCpu',
    type: 'boolean',
    label: label('显示 CPU', 'Show CPU'),
    group: GROUP_PERF,
    defaultValue: true,
  },
  {
    key: 'showMemory',
    type: 'boolean',
    label: label('显示内存', 'Show memory'),
    group: GROUP_PERF,
    defaultValue: true,
  },
  {
    key: 'showGpu',
    type: 'boolean',
    label: label('显示 GPU', 'Show GPU'),
    group: GROUP_PERF,
    defaultValue: true,
  },
  {
    key: 'showDetails',
    type: 'boolean',
    label: label('显示分进程明细', 'Show per-process detail'),
    group: GROUP_PERF,
    description: label('main / renderer / gpu 三行明细。', 'main / renderer / gpu rows.'),
    defaultValue: false,
  },
  {
    key: 'barLayout',
    type: 'select',
    label: label('可视条布局', 'Bar layout'),
    group: GROUP_PERF,
    description: label(
      'vertical：三条指标竖排，条在读数右侧；horizontal：三条指标横排，条缩短后放在各自条目下方。',
      'vertical: rows stacked, bar right of the reading; horizontal: the three metrics side by side, each with a short bar underneath.',
    ),
    defaultValue: 'vertical',
    options: [
      { value: 'vertical', label: label('条在右侧', 'Bar at right') },
      { value: 'horizontal', label: label('条在下方', 'Bar below') },
    ],
  },
  {
    key: 'colorCpu',
    type: 'select',
    label: label('CPU 条颜色', 'CPU bar color'),
    group: GROUP_PERF,
    defaultValue: '#5ac8fa',
    options: COLOR_OPTIONS,
  },
  {
    key: 'colorMemory',
    type: 'select',
    label: label('内存条颜色', 'Memory bar color'),
    group: GROUP_PERF,
    defaultValue: '#34c759',
    options: COLOR_OPTIONS,
  },
  {
    key: 'colorGpu',
    type: 'select',
    label: label('GPU 条颜色', 'GPU bar color'),
    group: GROUP_PERF,
    defaultValue: '#ff9f0a',
    options: COLOR_OPTIONS,
  },
  {
    key: 'perfLabelColor',
    type: 'select',
    label: label('性能标签颜色', 'Panel label color'),
    group: GROUP_PERF,
    defaultValue: '#9aa4b2',
    options: COLOR_OPTIONS,
  },
  {
    key: 'perfValueColor',
    type: 'select',
    label: label('性能数值颜色', 'Panel value color'),
    group: GROUP_PERF,
    defaultValue: '#f4f4f6',
    options: COLOR_OPTIONS,
  },
  {
    key: 'memoryLimitGb',
    type: 'number',
    label: label('内存上限（GB）', 'Memory limit (GB)'),
    group: GROUP_PERF,
    description: label('内存条按这个值归一。', 'Memory bar normalises against this.'),
    defaultValue: 4,
    min: 1,
    max: 64,
    step: 1,
  },
  {
    key: 'refreshMs',
    type: 'select',
    label: label('指标刷新间隔', 'Metrics refresh interval'),
    group: GROUP_PERF,
    defaultValue: '1000',
    options: [
      { value: '500', label: label('0.5 秒', '0.5 s') },
      { value: '1000', label: label('1 秒', '1 s') },
      { value: '2000', label: label('2 秒', '2 s') },
    ],
  },
  {
    key: 'cornerPerf',
    type: 'select',
    label: label('性能默认角', 'Panel default corner'),
    group: GROUP_PERF,
    description: label('默认放右下角，避开窗口右上角的控制按钮。', 'Defaults to the bottom right, away from the window controls.'),
    defaultValue: 'bottom-right',
    options: CORNER_OPTIONS,
  },
  {
    key: 'perfClickThrough',
    type: 'boolean',
    label: label('性能鼠标穿透', 'Panel click-through'),
    group: GROUP_PERF,
    description: label('打开后卡片不响应鼠标，也就不能拖动。', 'On makes the card ignore the pointer, so it cannot be dragged either.'),
    defaultValue: false,
  },

  {
    key: 'cardBackground',
    type: 'boolean',
    label: label('卡片背景', 'Card background'),
    group: GROUP_STYLE,
    description: label('关掉后只剩文字，也不留毛玻璃。', 'Off leaves text only and drops the frosted layer.'),
    defaultValue: true,
  },
  {
    key: 'cardOpacity',
    type: 'number',
    label: label('底色不透明度', 'Card opacity'),
    group: GROUP_STYLE,
    defaultValue: 0.55,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'backdropOpacity',
    type: 'number',
    label: label('毛玻璃强度', 'Backdrop strength'),
    group: GROUP_STYLE,
    description: label('控制 backdrop-filter 的模糊程度，0 表示不模糊。', 'Drives the backdrop-filter blur radius; 0 means no blur.'),
    defaultValue: 0.55,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: 'scale',
    type: 'number',
    label: label('整体大小', 'Scale'),
    group: GROUP_STYLE,
    description: label('按倍率缩放整张卡片（字号与尺寸一起乘，不用 transform）。', 'Multiplies font sizes and dimensions; no transform scaling.'),
    defaultValue: 1,
    min: 0.7,
    max: 1.6,
    step: 0.05,
  },
];

/* ------------------------------------------------------------------ 工具 */

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const clampNumber = (raw, min, max, fallback) => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

const clampUnit = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);

const pick = (raw, allowed, fallback) => (allowed.indexOf(raw) >= 0 ? raw : fallback);

const clockStyleValue = (raw) => pick(CLOCK_STYLE_ALIASES[raw] || raw, CLOCK_STYLES, 'minimal');

const colorValue = (raw, fallback) => {
  if (typeof raw !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw)) return fallback;
  return raw.toLowerCase();
};

const withAlpha = (hex, alpha) => {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex));
  if (!match) return 'rgba(255, 255, 255, ' + alpha + ')';
  const value = parseInt(match[1], 16);
  return 'rgba(' + ((value >> 16) & 255) + ', ' + ((value >> 8) & 255) + ', ' + (value & 255) + ', ' + alpha + ')';
};

const pad2 = (value) => String(value).padStart(2, '0');

const setText = (node, value) => {
  if (node.textContent !== value) node.textContent = value;
};

const makeElement = (tag, cssText) => {
  const node = document.createElement(tag);
  if (cssText) node.style.cssText = cssText;
  return node;
};

const appendAll = (parent, ...children) => {
  for (const child of children) parent.appendChild(child);
  return parent;
};

const applyDecls = (node, decls) => {
  for (const name of Object.keys(decls)) node.style[name] = decls[name];
};

const persistWarn = (() => {
  const seen = new Set();
  return (folium, key, error) => {
    if (seen.has(key)) return;
    seen.add(key);
    if (folium && folium.log && typeof folium.log.warn === 'function') {
      folium.log.warn('clock-perf-widget: ' + key, error);
    }
  };
})();

const round1 = (value) => Math.round(value * 10) / 10;

const formatMemory = (kilobytes) => {
  const value = Number(kilobytes);
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1048576) return (value / 1048576).toFixed(1) + ' GB';
  if (value >= 1024) return (value / 1024).toFixed(1) + ' MB';
  return Math.round(value) + ' KB';
};

const roundMbToGb = (megabytes) => {
  const value = Number(megabytes);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value / 1024) * 10) / 10;
};

const DATE_MEDIUM = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' });

const isoDate = (date) => date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());

const clockParts = (date, use24) => {
  const hours = date.getHours();
  const suffix = use24 ? '' : hours < 12 ? '上午' : '下午';
  const display = use24 ? hours : hours % 12 || 12;
  return { hh: pad2(display), mm: pad2(date.getMinutes()), suffix };
};

/* ------------------------------------------------------------------ 状态 */

const readState = (values) => ({
  placement: pick(values.placement, PLACEMENTS, 'global'),
  cardBackground: values.cardBackground !== false,
  cardOpacity: clampNumber(values.cardOpacity, 0, 1, 0.55),
  backdropOpacity: clampNumber(values.backdropOpacity, 0, 1, 0.55),
  scale: clampNumber(values.scale, 0.7, 1.6, 1),
  clock: {
    show: values.clockShow !== false,
    style: clockStyleValue(values.clockStyle),
    corner: pick(values.cornerClock, CORNERS, 'top-left'),
    clickThrough: values.clockClickThrough === true,
    showDate: values.clockShowDate !== false,
    showWeekday: values.clockShowWeekday !== false,
    clock24: values.clock24 !== false,
    color: colorValue(values.clockColor, '#f4f4f6'),
  },
  fps: {
    show: values.fpsShow !== false,
    corner: pick(values.cornerFps, CORNERS, 'bottom-left'),
    clickThrough: values.fpsClickThrough === true,
    showLabel: values.fpsShowLabel !== false,
    fontSize: clampNumber(values.fpsFontSize, 14, 72, 26),
    valueColor: colorValue(values.fpsValueColor, '#f4f4f6'),
    labelColor: colorValue(values.fpsLabelColor, '#9aa4b2'),
  },
  perf: {
    show: values.perfShow !== false,
    corner: pick(values.cornerPerf, CORNERS, 'bottom-right'),
    clickThrough: values.perfClickThrough === true,
    labelColor: colorValue(values.perfLabelColor, '#9aa4b2'),
    valueColor: colorValue(values.perfValueColor, '#f4f4f6'),
    barLayout: values.barLayout === 'horizontal' ? 'horizontal' : 'vertical',
    colorCpu: colorValue(values.colorCpu, '#5ac8fa'),
    colorMemory: colorValue(values.colorMemory, '#34c759'),
    colorGpu: colorValue(values.colorGpu, '#ff9f0a'),
    showCpu: values.showCpu !== false,
    showMemory: values.showMemory !== false,
    showGpu: values.showGpu !== false,
    showDetails: values.showDetails === true,
    memoryLimitGb: clampNumber(values.memoryLimitGb, 1, 64, 4),
    refreshMs: Math.max(MIN_METRICS_MS, Number(values.refreshMs) || 1000),
  },
});

/* ------------------------------------------------------------------ 时钟 */

const CLOCK_LOOKS = {
  minimal: {
    family: UI_FAMILY,
    top: { display: 'none' },
    main: { display: 'flex', alignItems: 'baseline', gap: '10px' },
    time: { display: 'inline-block', fontSize: '3.2em', fontWeight: '600', letterSpacing: '-0.02em', lineHeight: '1' },
    term: { display: 'none' },
    prompt: { display: 'none' },
    suffix: { display: 'inline-block', fontSize: '0.8em', fontWeight: '600', letterSpacing: '0.06em', opacity: '0.7' },
    dateInline: { display: 'inline-block', fontSize: '0.8em', fontWeight: '600', letterSpacing: '0.04em', opacity: '0.85' },
    weekdayInline: { display: 'inline-block', fontSize: '0.8em', fontWeight: '600', letterSpacing: '0.04em', opacity: '0.55' },
    cursor: { display: 'none' },
    stack: { display: 'none' },
    bottom: { display: 'none' },
    suffixBottom: { display: 'none' },
  },
  terminal: {
    family: MONO_FAMILY,
    top: { display: 'flex', alignItems: 'baseline', gap: '10px' },
    dateTop: { display: 'inline-block', fontSize: '0.72em', fontWeight: '600', letterSpacing: '0.08em', opacity: '0.75' },
    weekdayTop: { display: 'inline-block', fontSize: '0.72em', fontWeight: '600', letterSpacing: '0.08em', opacity: '0.55' },
    main: { display: 'flex', alignItems: 'baseline', gap: '0px' },
    time: { display: 'none' },
    term: {
      display: 'inline-flex',
      alignItems: 'baseline',
      fontSize: '2.6em',
      fontWeight: '600',
      letterSpacing: '0.06em',
      lineHeight: '1',
    },
    prompt: { display: 'inline-block', fontSize: '0.95em', fontWeight: '700', opacity: '0.85' },
    suffix: { display: 'inline-block', fontSize: '0.5em', fontWeight: '600', letterSpacing: '0.12em', opacity: '0.6' },
    dateInline: { display: 'none' },
    weekdayInline: { display: 'none' },
    cursor: { display: 'inline-block', fontSize: '2.2em', fontWeight: '400', lineHeight: '1' },
    stack: { display: 'none' },
    bottom: { display: 'none' },
    suffixBottom: { display: 'none' },
  },
  stacked: {
    family: UI_FAMILY,
    top: { display: 'none' },
    main: { display: 'none' },
    time: { display: 'none' },
    term: { display: 'none' },
    prompt: { display: 'none' },
    suffix: { display: 'none' },
    dateInline: { display: 'none' },
    weekdayInline: { display: 'none' },
    cursor: { display: 'none' },
    stack: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '0.96' },
    hours: { display: 'block', fontSize: '3em', fontWeight: '800', letterSpacing: '-0.01em' },
    rule: { display: 'block', width: '2.6em', height: '1px', margin: '0.12em 0', background: 'currentColor', opacity: '0.45' },
    minutes: { display: 'block', fontSize: '3em', fontWeight: '800', letterSpacing: '-0.01em' },
    bottom: { display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '9px', order: '-1', margin: '0 0 7px' },
    dateBottom: { display: 'inline-block', fontSize: '0.8em', fontWeight: '700', letterSpacing: '0.16em', opacity: '0.9' },
    weekdayBottom: { display: 'inline-block', fontSize: '0.8em', fontWeight: '700', letterSpacing: '0.16em', opacity: '0.55' },
    suffixBottom: { display: 'inline-block', fontSize: '0.8em', fontWeight: '700', letterSpacing: '0.12em', opacity: '0.55' },
  },
  outline: {
    family: UI_FAMILY,
    top: { display: 'none' },
    main: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px' },
    time: {
      display: 'inline-block',
      fontSize: '3.4em',
      fontWeight: '800',
      letterSpacing: '0.04em',
      lineHeight: '1',
      webkitTextStroke: '1px currentColor',
    },
    term: { display: 'none' },
    prompt: { display: 'none' },
    suffix: { display: 'inline-block', fontSize: '0.55em', fontWeight: '700', letterSpacing: '0.12em', opacity: '0.75' },
    dateInline: { display: 'none' },
    weekdayInline: { display: 'none' },
    cursor: { display: 'none' },
    stack: { display: 'none' },
    bottom: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '10px', marginTop: '2px' },
    dateBottom: { display: 'inline-block', fontSize: '0.7em', fontWeight: '700', letterSpacing: '0.3em', opacity: '0.9' },
    weekdayBottom: { display: 'inline-block', fontSize: '0.7em', fontWeight: '700', letterSpacing: '0.3em', opacity: '0.6' },
    suffixBottom: { display: 'none' },
  },
};

const createClockCard = () => {
  const card = makeElement('div', CARD_SHELL_CSS);
  card.dataset.role = 'card-clock';

  const rowTop = makeElement('div', 'display:none;');
  rowTop.dataset.role = 'clock-row-top';

  const prompt = makeElement('span', '');
  prompt.dataset.role = 'clock-prompt';
  prompt.textContent = '>_';

  const dateTop = makeElement('span', 'font-variant-numeric:tabular-nums;');
  dateTop.dataset.role = 'clock-date-top';

  const weekdayTop = makeElement('span', '');
  weekdayTop.dataset.role = 'clock-weekday-top';

  appendAll(rowTop, prompt, dateTop, weekdayTop);

  const rowMain = makeElement('div', 'display:flex;align-items:baseline;');
  rowMain.dataset.role = 'clock-main';

  const timeBox = makeElement('span', 'position:relative;display:inline-flex;align-items:baseline;');
  timeBox.dataset.role = 'clock-time-box';

  const time = makeElement('span', 'font-variant-numeric:tabular-nums;white-space:nowrap;');
  time.dataset.role = 'clock-time';

  const term = makeElement('span', 'display:none;');
  term.dataset.role = 'clock-term';

  const termHours = makeElement('span', 'font-variant-numeric:tabular-nums;');
  termHours.dataset.role = 'clock-term-hours';

  const termColon = makeElement('span', '');
  termColon.dataset.role = 'clock-term-colon';
  termColon.textContent = ':';

  const termMinutes = makeElement('span', 'font-variant-numeric:tabular-nums;');
  termMinutes.dataset.role = 'clock-term-minutes';

  appendAll(term, termHours, termColon, termMinutes);
  appendAll(timeBox, time, term);

  const suffixInline = makeElement('span', 'display:none;');
  suffixInline.dataset.role = 'clock-suffix';

  const dateInline = makeElement('span', 'display:none;');
  dateInline.dataset.role = 'clock-date-inline';

  const weekdayInline = makeElement('span', 'display:none;');
  weekdayInline.dataset.role = 'clock-weekday-inline';

  const cursor = makeElement('span', 'display:none;');
  cursor.dataset.role = 'clock-cursor';
  cursor.textContent = '\u258c';

  appendAll(rowMain, timeBox, suffixInline, dateInline, weekdayInline, cursor);

  const stack = makeElement('div', 'display:none;');
  stack.dataset.role = 'clock-stack';

  const hours = makeElement('span', 'font-variant-numeric:tabular-nums;');
  hours.dataset.role = 'clock-hours';

  const rule = makeElement('span', '');
  rule.dataset.role = 'clock-rule';

  const minutes = makeElement('span', 'font-variant-numeric:tabular-nums;');
  minutes.dataset.role = 'clock-minutes';

  appendAll(stack, hours, rule, minutes);

  const rowBottom = makeElement('div', 'display:none;');
  rowBottom.dataset.role = 'clock-bottom';

  const dateBottom = makeElement('span', 'font-variant-numeric:tabular-nums;');
  dateBottom.dataset.role = 'clock-date-bottom';

  const weekdayBottom = makeElement('span', '');
  weekdayBottom.dataset.role = 'clock-weekday-bottom';

  const suffixBottom = makeElement('span', '');
  suffixBottom.dataset.role = 'clock-suffix-bottom';

  appendAll(rowBottom, dateBottom, weekdayBottom, suffixBottom);
  appendAll(card, rowTop, rowMain, stack, rowBottom);

  const nodes = {
    card,
    top: rowTop,
    dateTop,
    weekdayTop,
    main: rowMain,
    time,
    term,
    prompt,
    suffix: suffixInline,
    dateInline,
    weekdayInline,
    cursor,
    stack,
    hours,
    rule,
    minutes,
    bottom: rowBottom,
    dateBottom,
    weekdayBottom,
    suffixBottom,
  };

  let state = null;
  let timer = null;
  let blinkTimer = null;
  let blinkOn = true;

  const applyLook = (look) => {
    for (const name of Object.keys(nodes)) {
      if (name === 'card') continue;
      nodes[name].style.display = 'none';
      const decls = look[name];
      if (decls) applyDecls(nodes[name], decls);
    }
    card.style.fontFamily = look.family;
  };

  const paintBlink = () => {
    cursor.style.opacity = blinkOn ? '1' : '0';
    termColon.style.opacity = blinkOn ? '1' : '0.15';
  };

  const stopBlink = () => {
    if (blinkTimer === null) return;
    if (typeof clearTimeout === 'function') clearTimeout(blinkTimer);
    blinkTimer = null;
  };

  const scheduleBlink = () => {
    if (blinkTimer !== null || typeof setTimeout !== 'function') return;
    blinkTimer = setTimeout(() => {
      blinkTimer = null;
      blinkOn = !blinkOn;
      paintBlink();
      scheduleBlink();
    }, BLINK_MS);
  };

  const tick = () => {
    if (!state) return;
    const now = new Date();
    const parts = clockParts(now, state.clock.clock24);
    const stamp = parts.hh + ':' + parts.mm;
    setText(time, stamp);
    setText(termHours, parts.hh);
    setText(termMinutes, parts.mm);
    setText(hours, parts.hh);
    setText(minutes, parts.mm);
    setText(suffixInline, parts.suffix);
    setText(suffixBottom, parts.suffix);
    const dateValue = state.clock.showDate ? DATE_MEDIUM.format(now) : '';
    const weekdayValue = state.clock.showWeekday ? WEEKDAY_SHORT.format(now) : '';
    setText(dateTop, isoDate(now));
    setText(weekdayTop, weekdayValue);
    setText(dateInline, dateValue);
    setText(dateBottom, dateValue);
    setText(weekdayInline, weekdayValue);
    setText(weekdayBottom, weekdayValue);
  };

  const render = (next) => {
    state = next;
    const clock = next.clock;
    const look = CLOCK_LOOKS[clock.style] || CLOCK_LOOKS.minimal;
    card.dataset.style = clock.style;
    applyLook(look);
    if (!clock.showDate) {
      nodes.dateTop.style.display = 'none';
      nodes.dateInline.style.display = 'none';
      nodes.dateBottom.style.display = 'none';
    }
    if (!clock.showWeekday) {
      nodes.weekdayTop.style.display = 'none';
      nodes.weekdayInline.style.display = 'none';
      nodes.weekdayBottom.style.display = 'none';
    }
    if (clock.clock24) {
      nodes.suffix.style.display = 'none';
      nodes.suffixBottom.style.display = 'none';
    }

    card.style.color = clock.color;
    const bare = !next.cardBackground || clock.style === 'outline';
    const shadow = bare ? BARE_TEXT_SHADOW : 'none';
    for (const node of [time, term, hours, minutes]) node.style.textShadow = shadow;
    time.style.webkitTextStroke = clock.style === 'outline' ? '1px currentColor' : '';

    if (clock.style === 'terminal') {
      blinkOn = true;
      scheduleBlink();
    } else {
      stopBlink();
      blinkOn = true;
    }
    paintBlink();
    tick();
  };

  const start = (next) => {
    render(next);
    if (timer === null && typeof setInterval === 'function') timer = setInterval(tick, 1000);
  };

  const stop = () => {
    if (timer !== null && typeof clearInterval === 'function') clearInterval(timer);
    timer = null;
    stopBlink();
  };

  return { card, render, start, stop };
};

/* ------------------------------------------------------------------ FPS */

const createFpsCard = (services) => {
  const card = makeElement('div', CARD_SHELL_CSS + 'display:inline-flex;flex-direction:row;align-items:baseline;gap:8px;');
  card.dataset.role = 'card-fps';

  const labelNode = makeElement('span', 'flex:0 0 auto;font-size:0.72em;font-weight:600;letter-spacing:0.18em;opacity:0.6;');
  labelNode.dataset.role = 'fps-label';
  labelNode.textContent = 'FPS';

  const value = makeElement('span', 'flex:0 0 auto;font-size:1em;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;');
  value.dataset.role = 'fps-value';
  value.textContent = '—';

  appendAll(card, labelNode, value);

  let frames = 0;
  let rafId = null;
  let windowStart = 0;
  let frameStop = null;

  /** 每帧计一次数；宿主帧循环与自带的 rAF 循环都走这里。 */
  const count = (time) => {
    const stamp = isNumber(time) ? time : 0;
    if (windowStart === 0) windowStart = stamp;
    frames += 1;
    if (stamp - windowStart >= 1000) {
      setText(value, String(frames));
      frames = 0;
      windowStart = stamp;
    }
  };

  const loop = (time) => {
    count(time);
    rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(loop) : null;
  };

  const render = (next) => {
    const fps = next.fps;
    const shadow = next.cardBackground ? 'none' : BARE_TEXT_SHADOW;
    card.style.color = fps.valueColor;
    labelNode.style.color = fps.labelColor;
    labelNode.style.display = fps.showLabel ? 'inline-block' : 'none';
    labelNode.style.textShadow = shadow;
    value.style.color = fps.valueColor;
    value.style.textShadow = shadow;
  };

  const start = (next) => {
    render(next);
    if (frameStop !== null) return;
    const ctxObject = services && services.ctx;
    if (ctxObject && typeof ctxObject.onFrame === 'function') {
      try {
        const disposer = ctxObject.onFrame(count);
        if (typeof disposer === 'function') {
          frameStop = disposer;
          return;
        }
      } catch (error) {
        persistWarn(services.folium, 'ctx.onFrame', error);
      }
    }
    if (rafId === null && typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(loop);
      frameStop = () => {
        if (rafId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId);
        rafId = null;
      };
    }
  };

  const stop = () => {
    if (frameStop !== null) {
      frameStop();
      frameStop = null;
    }
    frames = 0;
    windowStart = 0;
  };

  return { card, render, start, stop };
};

/* ------------------------------------------------------------------ 性能 */

const makeMetricRow = (key, caption) => {
  const root = makeElement('div', 'display:flex;flex-direction:row;align-items:center;gap:8px;min-width:0;');
  root.dataset.role = 'row-' + key;

  const head = makeElement('div', 'display:flex;align-items:baseline;gap:6px;flex:0 0 auto;min-width:0;');
  head.dataset.role = 'head-' + key;

  const labelNode = makeElement('div', 'flex:0 0 auto;font-size:0.75em;font-weight:600;letter-spacing:0.08em;');
  labelNode.dataset.role = 'label-' + key;
  labelNode.textContent = caption;

  const value = makeElement('div', 'flex:0 0 auto;font-size:0.86em;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;');
  value.dataset.role = 'value-' + key;
  value.textContent = '—';

  const track = makeElement(
    'div',
    'background:rgba(128,128,128,0.28);border-radius:2px;overflow:hidden;flex:1 1 auto;min-width:0;height:5px;',
  );
  track.dataset.role = 'track-' + key;

  const bar = makeElement('div', 'height:100%;width:100%;border-radius:2px;transform:scaleX(0);transform-origin:left center;');
  bar.dataset.role = 'bar-' + key;

  appendAll(track, bar);
  appendAll(head, labelNode, value);
  appendAll(root, head, track);

  return { key, root, head, label: labelNode, value, track, bar, caption };
};

const makeDetailRow = (key, caption) => {
  const root = makeElement('div', 'display:flex;align-items:baseline;gap:6px;font-size:0.7em;opacity:0.78;');
  root.dataset.role = 'detail-' + key;

  const labelNode = makeElement('div', 'flex:0 0 auto;');
  labelNode.dataset.role = 'detail-label-' + key;
  labelNode.textContent = caption;

  const value = makeElement('div', 'flex:1 1 auto;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;');
  value.dataset.role = 'detail-value-' + key;
  value.textContent = '—';

  appendAll(root, labelNode, value);
  return { key, root, label: labelNode, value };
};

const createPerfCard = (services) => {
  const card = makeElement('div', CARD_SHELL_CSS);
  card.dataset.role = 'card-perf';

  const body = makeElement('div', 'display:flex;flex-direction:column;gap:5px;');
  body.dataset.role = 'perf-body';

  const rows = {
    cpu: makeMetricRow('cpu', 'Folia CPU'),
    memory: makeMetricRow('memory', 'Folia 内存'),
    gpu: makeMetricRow('gpu', 'GPU'),
  };

  appendAll(body, rows.cpu.root, rows.memory.root, rows.gpu.root);

  const source = makeElement('div', 'display:none;font-size:0.68em;opacity:0.5;letter-spacing:0.02em;margin-top:1px;');
  source.dataset.role = 'perf-source';

  const details = makeElement('div', 'display:none;flex-direction:column;gap:2px;margin-top:5px;padding-top:5px;');
  details.dataset.role = 'perf-details';

  const detailRows = {
    main: makeDetailRow('main', '主进程'),
    renderer: makeDetailRow('renderer', '渲染'),
    gpu: makeDetailRow('gpu', 'GPU 进程'),
  };

  appendAll(details, detailRows.main.root, detailRows.renderer.root, detailRows.gpu.root);
  appendAll(card, body, source, details);

  const folium = services.folium;
  const callRpc =
    folium && folium.rpc && typeof folium.rpc.call === 'function' ? folium.rpc.call.bind(folium.rpc) : null;

  let state = null;
  let latest = null;
  let active = false;
  let intervalMs = 0;
  let stopper = null;
  let inFlight = false;
  /* 渲染端只在真的要看 GPU 时才让主进程跑 nvidia-smi。 */
  let wantsGpu = true;

  const paintRow = (key, ratio, valueText, barColor, labelColor, valueColor) => {
    const row = rows[key];
    row.value.textContent = valueText;
    row.label.style.color = labelColor;
    row.value.style.color = valueColor;
    row.bar.style.backgroundColor = barColor;
    row.bar.style.transform = 'scaleX(' + clampUnit(ratio).toFixed(4) + ')';
  };

  const applyBodyLayout = (layout) => {
    body.style.flexDirection = layout === 'horizontal' ? 'row' : 'column';
    body.style.alignItems = 'stretch';
    body.style.gap = layout === 'horizontal' ? '10px' : '5px';
  };

  const applyRowLayout = (row, layout) => {
    if (layout === 'horizontal') {
      row.root.style.flex = '1 1 0';
      row.root.style.flexDirection = 'column';
      row.root.style.alignItems = 'stretch';
      row.root.style.gap = '4px';
      row.head.style.justifyContent = 'space-between';
      row.head.style.flex = '1 1 auto';
      row.track.style.width = '100%';
      row.track.style.maxWidth = '72px';
      row.track.style.height = '3px';
      row.track.style.flex = '0 0 auto';
      row.track.style.marginTop = '0';
    } else {
      row.root.style.flex = '0 0 auto';
      row.root.style.flexDirection = 'row';
      row.root.style.alignItems = 'center';
      row.root.style.gap = '8px';
      row.head.style.justifyContent = '';
      row.head.style.flex = '0 0 auto';
      row.track.style.width = 'auto';
      row.track.style.maxWidth = 'none';
      row.track.style.height = '5px';
      row.track.style.flex = '1 1 auto';
      row.track.style.marginTop = '0';
    }
  };

  const paintMetrics = () => {
    if (!state) return;
    const perf = state.perf;

    if (latest) {
      const totalCpu = Number(latest.totalCpu) || 0;
      const totalMemKb = Number(latest.totalMemKb) || 0;
      const gpu = latest.gpu && typeof latest.gpu === 'object' ? latest.gpu : null;

      paintRow('cpu', totalCpu / 100, round1(totalCpu) + '%', perf.colorCpu, perf.labelColor, perf.valueColor);
      paintRow(
        'memory',
        totalMemKb / 1048576 / perf.memoryLimitGb,
        formatMemory(totalMemKb),
        perf.colorMemory,
        perf.labelColor,
        perf.valueColor,
      );

      const byType = latest.byType || {};
      for (const key of ['main', 'renderer', 'gpu']) {
        const entry = byType[key] || {};
        const cpuPart = round1(Number(entry.cpu) || 0) + '%';
        detailRows[key].value.textContent = cpuPart + ' · ' + formatMemory(entry.memKb);
      }

      if (gpu) {
        const utilPct = Number(gpu.utilPct) || 0;
        const tempText = isNumber(gpu.tempC) ? Math.round(gpu.tempC) + '°C' : '—';
        paintRow(
          'gpu',
          utilPct / 100,
          Math.round(utilPct) + '% · ' + tempText,
          perf.colorGpu,
          perf.labelColor,
          perf.valueColor,
        );
        const used = roundMbToGb(gpu.memUsedMb);
        const total = roundMbToGb(gpu.memTotalMb);
        const power = isNumber(gpu.powerW) ? round1(gpu.powerW) + ' W' : '—';
        source.textContent =
          'nvidia-smi · VRAM ' + (used === null ? '—' : used) + '/' + (total === null ? '—' : total) + ' GB · ' + power;
      } else {
        paintRow('gpu', 0, '—', perf.colorGpu, perf.labelColor, perf.valueColor);
        source.textContent = '无 nvidia-smi · 占用与温度仅支持 NVIDIA 显卡';
      }
      source.style.display = 'block';
    } else {
      source.style.display = 'none';
    }

    rows.cpu.root.style.display = perf.showCpu ? 'flex' : 'none';
    rows.memory.root.style.display = perf.showMemory ? 'flex' : 'none';
    rows.gpu.root.style.display = perf.showGpu ? 'flex' : 'none';
    details.style.display = perf.showDetails ? 'flex' : 'none';
    details.style.borderTop = '1px solid ' + withAlpha(perf.labelColor, 0.18);
  };

  const fetchMetrics = () => {
    if (!callRpc || inFlight || !active) return;
    inFlight = true;
    let result;
    try {
      result = callRpc('metrics', { gpu: wantsGpu });
    } catch (error) {
      inFlight = false;
      persistWarn(folium, 'rpc.call', error);
      return;
    }
    Promise.resolve(result)
      .then((data) => {
        inFlight = false;
        if (!data || typeof data !== 'object') return;
        latest = data;
        if (active) paintMetrics();
      })
      .catch((error) => {
        inFlight = false;
        persistWarn(folium, 'rpc.result', error);
      });
  };

  const tick = () => {
    fetchMetrics();
  };

  const start = (next) => {
    const wanted = Math.max(MIN_METRICS_MS, next.perf.refreshMs);
    active = true;
    if (stopper && intervalMs === wanted) {
      paintMetrics();
      return;
    }
    stop();
    active = true;
    intervalMs = wanted;
    if (services.ctx && typeof services.ctx.every === 'function') {
      const disposer = services.ctx.every(wanted, tick);
      if (typeof disposer === 'function') stopper = disposer;
    }
    if (!stopper && typeof setInterval === 'function') {
      const handle = setInterval(tick, wanted);
      stopper = () => clearInterval(handle);
    }
    fetchMetrics();
  };

  const stop = () => {
    active = false;
    intervalMs = 0;
    if (stopper) {
      try {
        stopper();
      } catch (error) {
        void error;
      }
      stopper = null;
    }
  };

  const render = (next) => {
    state = next;
    const perf = next.perf;
    wantsGpu = perf.showGpu !== false;
    card.style.color = perf.valueColor;
    applyBodyLayout(perf.barLayout);
    const shadow = next.cardBackground ? 'none' : BARE_TEXT_SHADOW;
    for (const key of ['cpu', 'memory', 'gpu']) {
      const row = rows[key];
      applyRowLayout(row, perf.barLayout);
      row.root.style.color = perf.valueColor;
      row.value.style.textShadow = shadow;
      row.label.style.textShadow = shadow;
    }
    for (const key of ['main', 'renderer', 'gpu']) {
      const row = detailRows[key];
      row.label.style.color = perf.labelColor;
      row.value.style.color = perf.valueColor;
    }
    source.style.color = perf.labelColor;
    paintMetrics();
  };

  return { card, render, start, stop, refresh: fetchMetrics };
};

/* ------------------------------------------------------------------ 组件表 */

const COMPONENTS = {
  clock: { key: 'clock', display: 'flex', widthOf: () => 0, baseFont: () => 12, create: createClockCard },
  fps: {
    key: 'fps',
    display: 'inline-flex',
    widthOf: () => 0,
    baseFont: (state) => state.fps.fontSize,
    create: createFpsCard,
  },
  perf: {
    key: 'perf',
    display: 'flex',
    widthOf: (state) => (state.perf.barLayout === 'horizontal' ? PERF_HORIZONTAL_WIDTH : PERF_WIDTH),
    baseFont: () => 12,
    create: createPerfCard,
  },
};
/* ------------------------------------------------------------------ 挂载 */

const mountWidget = ({ folium, settings, slot, container, ctx, component }) => {
  const ctxObject = ctx || null;
  const componentKey = component.key;
  const storeKey = STORE_KEYS[componentKey];
  const widget = component.create({ folium, ctx: ctxObject });
  const card = widget.card;

  container.appendChild(card);

  const warned = new Set();
  const warnOnce = (key, error) => {
    if (warned.has(key)) return;
    warned.add(key);
    persistWarn(folium, key, error);
  };

  const readValues = () => {
    if (!settings || typeof settings.get !== 'function') return {};
    try {
      const values = settings.get();
      return values && typeof values === 'object' ? values : {};
    } catch (error) {
      warnOnce('settings.get', error);
      return {};
    }
  };

  const snapshot = () => {
    const values = readValues();
    const keys = Object.keys(values).sort();
    const ordered = {};
    for (const key of keys) ordered[key] = values[key];
    return JSON.stringify(ordered);
  };

  const readDaylight = () => {
    if (ctxObject && typeof ctxObject.getTheme === 'function') {
      try {
        const theme = ctxObject.getTheme();
        if (theme && typeof theme.isDaylight === 'boolean') return theme.isDaylight;
      } catch (error) {
        warnOnce('ctx.getTheme', error);
      }
    }
    const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    return query ? !query.matches : false;
  };

  let state = readState(readValues());
  let daylight = readDaylight();
  let visible = false;
  let currentRatio = { rx: 0, ry: 0 };
  let restored = false;
  let appliedCorner = null;
  let appliedScale = null;
  let touched = false;
  let dragging = null;
  let stopped = false;

  const activeConfig = () => state[componentKey];

  const viewport = () => {
    const win = typeof window === 'undefined' ? null : window;
    const width = win && isNumber(win.innerWidth) ? win.innerWidth : 0;
    const height = win && isNumber(win.innerHeight) ? win.innerHeight : 0;
    return { width, height };
  };

  const cardSize = () => {
    const win = typeof window === 'undefined' ? null : window;
    const scrollY = win && isNumber(win.scrollY) ? win.scrollY : 0;
    return { width: card.offsetWidth || 0, height: card.offsetHeight || 0, scrollY };
  };

  const persist = (ratio) => {
    if (!folium || !folium.storage || typeof folium.storage.set !== 'function') return;
    try {
      Promise.resolve(folium.storage.set(storeKey, ratio)).catch((error) => warnOnce('storage.set', error));
    } catch (error) {
      warnOnce('storage.set', error);
    }
  };

  const place = (position, ratio) => {
    const view = viewport();
    let x = isNumber(position.x) ? position.x : 0;
    let y = isNumber(position.y) ? position.y : 0;
    const size = cardSize();
    const maxX = Math.max(CORNER_MARGIN, view.width - size.width - CORNER_MARGIN);
    const maxY = Math.max(CORNER_MARGIN, view.height - size.height - CORNER_MARGIN);
    x = Math.min(Math.max(x, CORNER_MARGIN), maxX);
    y = Math.min(Math.max(y, CORNER_MARGIN + size.scrollY), maxY + size.scrollY);
    card.style.transform = 'translate3d(' + Math.round(x) + 'px, ' + Math.round(y) + 'px, 0)';
    if (ratio) currentRatio = { rx: ratio.rx, ry: ratio.ry };
    else currentRatio = { rx: x / (view.width || 1), ry: y / (view.height || 1) };
  };

  const cornerPos = (corner, size, view) => {
    /* 时钟停靠左侧时避开窗口左上角的返回/菜单按钮 */
    const left = CORNER_MARGIN + (componentKey === 'clock' ? CLOCK_LEFT_SAFE : 0);
    const right = Math.max(left, view.width - size.width - CORNER_MARGIN);
    const top = CORNER_MARGIN + size.scrollY;
    const bottom = Math.max(CORNER_MARGIN, view.height - size.height - CORNER_MARGIN) + size.scrollY;
    const x = corner === 'top-right' || corner === 'bottom-right' ? right : left;
    const y = corner === 'bottom-left' || corner === 'bottom-right' ? bottom : top;
    return { x, y };
  };

  const restoreFromRatio = () => {
    const view = viewport();
    place({ x: currentRatio.rx * view.width, y: currentRatio.ry * view.height }, currentRatio);
  };

  const applyCorner = (corner) => {
    const size = cardSize();
    const view = viewport();
    place(cornerPos(corner, size, view), null);
  };

  const applyShell = () => {
    const tint = daylight ? [255, 255, 255] : [18, 18, 22];
    const opacity = state.cardOpacity;
    if (!state.cardBackground || (componentKey === 'clock' && state.clock.style === 'outline')) {
      card.style.backgroundColor = 'transparent';
      card.style.backgroundImage = 'none';
      card.style.backdropFilter = 'none';
      card.style.webkitBackdropFilter = 'none';
      card.style.borderColor = 'transparent';
      card.style.boxShadow = 'none';
      return;
    }
    const blur = (state.backdropOpacity * 22).toFixed(1);
    card.style.backgroundColor = 'rgba(' + tint[0] + ', ' + tint[1] + ', ' + tint[2] + ', ' + opacity.toFixed(3) + ')';
    card.style.backgroundImage =
      'linear-gradient(180deg, rgba(255, 255, 255, ' + (0.1 * state.backdropOpacity).toFixed(3) + '), rgba(255, 255, 255, 0))';
    card.style.backdropFilter = 'blur(' + blur + 'px) saturate(1.15)';
    card.style.webkitBackdropFilter = 'blur(' + blur + 'px) saturate(1.15)';
    card.style.borderColor = daylight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.14)';
    card.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.22)';
    card.style.textShadow = 'none';
  };

  const applyScale = () => {
    const scale = state.scale;
    const width = component.widthOf(state);
    card.style.width = width ? Math.round(width * scale) + 'px' : 'auto';
    card.style.padding = round1(8 * scale) + 'px ' + round1(11 * scale) + 'px';
    card.style.borderRadius = round1(12 * scale) + 'px';
    card.style.fontSize = round1(component.baseFont(state) * scale) + 'px';
  };

  const syncPointer = () => {
    const through = activeConfig().clickThrough;
    card.style.pointerEvents = through ? 'none' : 'auto';
    if (!dragging) card.style.cursor = through ? 'default' : 'grab';
  };

  const syncPlacement = () => {
    const wanted = state.placement === 'global' ? SLOT_OVERLAY : state.placement === 'player' ? SLOT_PLAYER : null;
    const next = wanted === slot && activeConfig().show;
    visible = next;
    card.style.display = next ? component.display : 'none';
    syncPointer();
    if (next) {
      const corner = activeConfig().corner;
      const resized = appliedScale !== null && appliedScale !== state.scale;
      if (corner !== appliedCorner || resized) {
        applyCorner(corner);
        appliedCorner = corner;
        /* 首屏由 storage 里的比例接手，别拿角落坐标覆盖存档 */
        if (restored) persist(currentRatio);
      } else {
        restoreFromRatio();
      }
    }
    appliedScale = state.scale;
    return next;
  };

  /* 卡片尺寸随内容与字号变化，角落坐标要跟着重算，否则会贴边或丢掉 16px 边距 */
  const relayout = () => {
    if (!visible) return;
    if (appliedCorner) applyCorner(appliedCorner);
    else restoreFromRatio();
  };

  const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(relayout) : null;
  if (sizeObserver) sizeObserver.observe(card);

  const syncLoops = () => {
    if (stopped) return;
    if (!visible) {
      widget.stop();
      return;
    }
    if (typeof widget.start === 'function') widget.start(state);
  };

  const apply = (values) => {
    state = readState(values);
    applyScale();
    widget.render(state);
    syncPlacement();
    applyShell();
    syncLoops();
  };

  /* 拖动 ---------------------------------------------------------- */

  const insideNoDrag = (target, root) => {
    let node = target;
    while (node && node !== root) {
      if (node.dataset && node.dataset.noDragComplete === 'true') return true;
      node = node.parentNode;
    }
    return false;
  };

  const onPointerDown = (event) => {
    if (!event || (isNumber(event.button) && event.button !== 0)) return;
    if (activeConfig().clickThrough) return;
    if (dragging) return;
    if (insideNoDrag(event.target, card)) return;
    touched = true;
    dragging = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: readTranslate(card),
    };
    if (typeof card.setPointerCapture === 'function' && isNumber(event.pointerId)) {
      try {
        card.setPointerCapture(event.pointerId);
      } catch (error) {
        warnOnce('setPointerCapture', error);
      }
    }
    card.style.cursor = 'grabbing';
    if (typeof event.preventDefault === 'function') event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!dragging || !event) return;
    if (isNumber(dragging.pointerId) && isNumber(event.pointerId) && event.pointerId !== dragging.pointerId) return;
    const x = dragging.origin.x + (event.clientX - dragging.startX);
    const y = dragging.origin.y + (event.clientY - dragging.startY);
    place({ x, y }, null);
  };

  const finishDrag = (event) => {
    if (!dragging) return;
    const pointerId = dragging.pointerId;
    dragging = null;
    card.style.cursor = activeConfig().clickThrough ? 'default' : 'grab';
    if (isNumber(pointerId) && typeof card.releasePointerCapture === 'function') {
      try {
        card.releasePointerCapture(pointerId);
      } catch (error) {
        void error;
      }
    }
    void event;
    persist(currentRatio);
  };

  const onDoubleClick = () => {
    if (activeConfig().clickThrough) return;
    touched = true;
    applyCorner(activeConfig().corner);
    persist(currentRatio);
  };

  card.style.cursor = 'grab';
  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', finishDrag);
  card.addEventListener('pointercancel', finishDrag);
  card.addEventListener('lostpointercapture', finishDrag);
  card.addEventListener('dblclick', onDoubleClick);

  /* 位置恢复 ------------------------------------------------------ */

  if (folium && folium.storage && typeof folium.storage.get === 'function') {
    try {
      const pending = folium.storage.get(storeKey);
      if (pending && typeof pending.then === 'function') {
        pending
          .then((value) => {
            if (touched || stopped || !value) return;
            const rx = Number(value.rx);
            const ry = Number(value.ry);
            if (!Number.isFinite(rx) || !Number.isFinite(ry)) return;
            currentRatio = { rx: clampUnit(rx), ry: clampUnit(ry) };
            if (visible) restoreFromRatio();
          })
          .catch((error) => warnOnce('storage.get', error));
      }
    } catch (error) {
      warnOnce('storage.get', error);
    }
  }

  /* 初始应用 ------------------------------------------------------ */

  let lastSnapshot = snapshot();
  apply(readValues());
  restored = true;

  /* 设置订阅 ------------------------------------------------------ */

  const onHostChange = () => {
    if (stopped) return;
    lastSnapshot = snapshot();
    apply(readValues());
  };

  const hostDisposers = [];
  const subscribeSettings = () => {
    if (!settings || typeof settings.subscribe !== 'function') return false;
    try {
      const disposer = settings.subscribe(onHostChange);
      if (typeof disposer === 'function') hostDisposers.push(disposer);
      return true;
    } catch (error) {
      warnOnce('settings.subscribe', error);
      return false;
    }
  };

  /* 兜底：0.7.20 以前的宿主没有 subscribe，只能每秒比对一次快照。 */
  const poll = () => {
    if (stopped) return;
    const next = snapshot();
    if (next === lastSnapshot) return;
    lastSnapshot = next;
    apply(readValues());
  };

  let pollTimer = null;
  if (!subscribeSettings() && typeof setInterval === 'function') pollTimer = setInterval(poll, FALLBACK_POLL_MS);
  if (ctxObject && typeof ctxObject.onChange === 'function') {
    try {
      const disposer = ctxObject.onChange(() => {
        if (stopped) return;
        const nextDaylight = readDaylight();
        if (nextDaylight === daylight) return;
        daylight = nextDaylight;
        applyShell();
      });
      if (typeof disposer === 'function') hostDisposers.push(disposer);
    } catch (error) {
      warnOnce('ctx.onChange', error);
    }
  }

  /* 视口 ---------------------------------------------------------- */

  const onResize = () => {
    if (stopped || !visible) return;
    restoreFromRatio();
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', onResize);
  }

  return () => {
    stopped = true;
    if (pollTimer !== null && typeof clearInterval === 'function') clearInterval(pollTimer);
    for (const disposer of hostDisposers) {
      try {
        disposer();
      } catch (error) {
        void error;
      }
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', onResize);
    }
    try {
      widget.stop();
    } catch (error) {
      void error;
    }
    card.removeEventListener('pointerdown', onPointerDown);
    card.removeEventListener('pointermove', onPointerMove);
    card.removeEventListener('pointerup', finishDrag);
    card.removeEventListener('pointercancel', finishDrag);
    card.removeEventListener('lostpointercapture', finishDrag);
    card.removeEventListener('dblclick', onDoubleClick);
    if (sizeObserver) sizeObserver.disconnect();
    if (card.parentNode) card.parentNode.removeChild(card);
  };
};

const readTranslate = (card) => {
  const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(card.style.transform || '');
  if (!match) return { x: 0, y: 0 };
  return { x: Number(match[1]) || 0, y: Number(match[2]) || 0 };
};

/* ------------------------------------------------------------------ 入口 */

export default function activate(folium) {
  if (!folium || !folium.registries || !folium.registries.settingsSections || !folium.registries.stageLayers) {
    return () => {};
  }

  const section = folium.registries.settingsSections.register({
    id: 'folium-clock-perf',
    label: { 'zh-CN': '时钟与性能悬浮窗', en: 'Clock and performance overlay' },
    description: {
      'zh-CN': '时钟 / FPS / 性能监测三个独立悬浮卡。',
      en: 'Clock, FPS and performance cards, each with its own switch, position and style.',
    },
    settings: SETTINGS,
  });

  const handle = section && (section.params || section.settings);
  const settingsAccess = handle && typeof handle.get === 'function' ? handle : null;

  const layers = [];
  const slots = [SLOT_OVERLAY, SLOT_PLAYER];
  const componentKeys = ['clock', 'fps', 'perf'];

  for (const componentKey of componentKeys) {
    const component = COMPONENTS[componentKey];
    for (const slot of slots) {
      const layerId = 'clock-perf-' + componentKey + '-' + (slot === SLOT_OVERLAY ? 'overlay' : 'player');
      try {
        const layer = folium.registries.stageLayers.register({
          id: layerId,
          slot,
          order: 700,
          mount: (container, ctx) =>
            mountWidget({ folium, settings: settingsAccess, slot, container, ctx, component }),
        });
        layers.push(layer);
      } catch (error) {
        persistWarn(folium, 'stageLayers.register:' + layerId, error);
      }
    }
  }

  if (typeof folium.onDispose === 'function') {
    try {
      const disposer = folium.onDispose(() => {
        for (const layer of layers) {
          try {
            layer.unregister();
          } catch (error) {
            void error;
          }
        }
      });
      if (typeof disposer === 'function') void disposer;
    } catch (error) {
      void error;
    }
  }

  return () => {
    for (const layer of layers) {
      try {
        layer.unregister();
      } catch (error) {
        void error;
      }
    }
    if (section && typeof section.unregister === 'function') {
      try {
        section.unregister();
      } catch (error) {
        void error;
      }
    }
  };
}
