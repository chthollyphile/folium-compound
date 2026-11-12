'use strict';

/**
 * 桌面歌词 —— Folium mod 主入口（Node 侧）
 *
 * 职责：
 *  1. 创建一个独立、无边框、透明、置顶的「桌面歌词」窗口，只显示一行歌词。
 *  2. 定时从 api.runtime.getPlaybackSnapshot() 读取播放状态与歌词行，推送给窗口。
 *  3. 「锁定」= 窗口鼠标穿透（setIgnoreMouseEvents(true, { forward: true })），
 *     锁定时不接收任何鼠标事件，桌面操作完全不受影响。
 *  4. 窗口上的「上一首 / 下一首 / 播放暂停」按钮把命令排入队列，
 *     由 client 入口（跑在宿主渲染层，拥有 folium.playback 能力）取走并执行。
 */

const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const {
  DEFAULT_HOTKEY_BINDINGS,
  HOTKEY_ACTIONS,
  normalizeHotkeyBindings,
} = require('./hotkeys.cjs');
const { createLyricResolver, lyricLineText } = require('./lyrics.cjs');
const { listFontFamilies } = require('./fonts.cjs');

// 窗口宽度不写死：由渲染层量出内容宽度后回报，窗口贴着内容收放。
// 这里只定最小/最大/默认三个固定值，宽度计算全部走这三者，不再散落多套常量。
const WIN_W_MIN = 450;
const WIN_W_MAX = 1200;
const WIN_W_DEFAULT = 460;
const POLL_MS = 100;
/** 窗口和任务栏重叠时，重新置顶的检查间隔；只在窗口显示时启用。 */
const TOPMOST_MS = 1000;
/**
 * 锁定（点击穿透）时，指针进入歌词窗口后要停留多久才临时恢复交互。
 * 留这一小段延迟，是为了鼠标只是快速扫过歌词（比如打游戏瞄过去）时不抢走点击；
 * 真正想拖动 / 点解锁时，把鼠标停在歌词上一下即可。
 */
const HOVER_LIFT_DELAY_MS = 200;
/** 轮询屏幕光标的间隔。穿透窗口收不到 mouse 事件，只能按光标位置判断指针在不在歌词上。 */
const HOVER_POLL_MS = 80;
/**
 * Linux/Wayland 拿不到全局光标位置，只能靠渲染层转发来的 mousemove 判断悬停；
 * 其余平台（Windows / macOS / X11）由主进程轮询，稳定得多。
 */
const CURSOR_POLLING_SUPPORTED = !(process.platform === 'linux'
  && (process.env.XDG_SESSION_TYPE === 'wayland' || Boolean(process.env.WAYLAND_DISPLAY)));
const FONT_MIN = 12;
const FONT_MAX = 48;
const FONT_DEFAULT = 19;
/** 胶囊/窗口最小高度。 */
const MIN_HEIGHT = 150;
/** 低于这个高度按单行歌词显示（拉高到阈值以上才进入多行列表）。 */
const MULTI_MIN_HEIGHT = 170;
/** 歌词偏移（毫秒）范围：把桌面歌词整体前移/后移，正数让歌词更晚出现。 */
const OFFSET_MIN_MS = -10000;
const OFFSET_MAX_MS = 10000;
/** 调试日志开关：默认关闭；需要排错时改成 true，才会输出 api.log 日志。 */
const DEBUG = false;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

module.exports = function activate(api) {
  /** 取得 electron 模块。主进程入口里直接 require 即可。 */
  const getElectron = () => {
    try {
      return require('electron');
    } catch (error) {
      throw new Error(`无法加载 electron 模块 -> ${error.message}`);
    }
  };

  const debugLog = (msg, extra) => {
    if (!DEBUG) return;
    api.log.info(`[desktop-lyric] ${msg}`, extra);
  };
  const logErr = (msg, err) => {
    api.log.error(`[desktop-lyric] ${msg}`, err);
  };

  /** 内置主题：从 themes.json 读取（失败则空数组，渲染层退回默认样式）。 */
  let themesData = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, 'themes.json'), 'utf8'));
    if (Array.isArray(parsed)) themesData = parsed;
  } catch (error) {
    logErr('读取 themes.json 失败', error);
  }

  /** 字体列表只加载一次（带缓存、并发合并）；启动时后台预热，菜单打开时直接命中。 */
  let fontsPromise = null;
  const getFontFamilies = () => {
    if (!fontsPromise) {
      fontsPromise = listFontFamilies(api, api.log).catch((error) => {
        fontsPromise = null;
        throw error;
      });
    }
    return fontsPromise;
  };

  // 在这里（而不是模块顶层）取 electron：抛错会被 modSystem 捕获并记为 mod 错误，
  // 不会影响 Folia 主进程启动。
  const { BrowserWindow, screen, ipcMain, globalShortcut } = getElectron();

  /** @type {BrowserWindow | null} */
  let win = null;
  /** @type {BrowserWindow | null} 独立设置窗口 */
  let settingsWin = null;
  /** 上次打开的设置标签页（settings / colors），用于显示时恢复 */
  let settingsTab = 'settings';
  let locked = true;
  /** 上次写盘成功的锁定值，避免每次启动/重载都无谓写一次存储。 */
  let lastSavedLocked = null;
  /**
   * 锁定（点击穿透）时指针是否停在歌词窗口上，也就是要不要临时取消穿透。
   * 两路来源取或：渲染层转发的悬停（Wayland 用），主进程轮询屏幕光标得到的悬停（其余平台）。
   */
  let unlockHoverRenderer = false;
  let unlockHoverPolled = false;
  /** 刚开启穿透时，若指针正停在窗口上，先别悬停解冻；等指针移出一次再恢复悬停解冻。 */
  let suppressHoverUnlock = false;
  /** 轮询屏幕光标的定时器 / 悬停停留的延时定时器 / 上一刻指针是否在窗口内。 */
  let hoverPollTimer = null;
  let hoverEnterTimer = null;
  let hoverPointerInside = false;
  /** 上一次发给渲染层的「临时可交互」状态，避免每帧重复 send。 */
  let lastInteractiveSent = false;
  /** 拖动状态：按下时的屏幕坐标与窗口原点（DIP）；不在拖动时为 null。 */
  let dragOrigin = null;
  /** 拖动结束后跳过下一次内容贴合，避免松手瞬间按内容改尺寸导致位置跳动。 */
  let skipFitOnce = false;
  /** 本次拖动是不是从任务栏模式里拖出来的（拖出后要恢复普通尺寸，不能跳过贴合）。 */
  let dragFromTaskbar = false;
  let dragWinOrigin = null;
  /** 拖动开始时锁定的窗口尺寸：拖动全程只改位置，绝不改宽高，避免窗口在拖动中「变大」。 */
  let dragFixedSize = null;
  /** 从任务栏拖出时，记住进任务栏前的 userHeight/userWidth/位置尺寸，松手后恢复。 */
  let dragRestore = null;
  let dragPollTimer = null;
  let lastDragCursor = null;
  let fontSize = FONT_DEFAULT;
  /** 字号写盘合并定时器（滚轮高频调字号只写最后一次）。 */
  let fontSizeSaveTimer = null;
  /** 歌词偏移（毫秒），当前歌曲的偏移；正数让歌词更晚出现。 */
  let lyricOffsetMs = 0;
  /** 每首歌各自的偏移：{ [songKey]: ms }，无记录时默认 0。 */
  let lyricOffsets = {};
  /** 当前歌曲标识（song.ref || song.id || songName）。 */
  let currentSongKey = '';
  let lyricOffsetSaveTimer = null;
  /** 配色：歌词/翻译/音译三色 + 胶囊背景色 + 显示模式(dark/light) + 主题预设。 */
  let colors = { lyric: '#ffffff', translation: '', romanization: '', bg: '#1a1b21', bgAlpha: 0.55, mode: 'dark', preset: 'classic', theme: null };
  /** 是否注册全局快捷键（默认关，用户自己开）。 */
  let hotkeysEnabled = false;
  /** 当前这套组合键；用户在设置里录制后更新。 */
  let hotkeyBindings = { ...DEFAULT_HOTKEY_BINDINGS };
  /** 已经成功注册的组合键，注销时按这份来，避免改了键位后旧的还留着。 */
  const registeredAccelerators = new Set();
  let pollTimer = null;
  /** 歌词压到任务栏上时，周期性把窗口重新插到任务栏之上的定时器。 */
  let topmostTimer = null;
  let lastPushed = '';
  /** 歌词派生数据缓存（按歌曲签名）：排序后的行 + 是否含翻译/音译，避免每 100ms 重建。 */
  let lyricCache = { key: '', lines: [], hasTranslation: false, hasRomanization: false };
  /** 多行歌词列表缓存：key = 歌曲签名 + 当前行 startTime，当前句没变就复用。 */
  let lyricLinesCache = { key: '', value: [] };
  /** 多行歌词列表版本：lyricLines 重建一次 +1，渲染层据此判断要不要重排，避免每 tick 拼全量 key。 */
  let lyricLinesVersion = 0;
  /** 逐字卡拉OK words 缓存：key = 歌曲 + 行 start + 文本，同一句每个 tick 复用同一份数组。 */
  let karaokeWordsCache = { key: '', words: [] };
  let disposed = false;
  /** 待 client 入口取走的播放控制命令 */
  let pendingCommands = [];
  /** 是否显示翻译行 / 音译行。 */
  let showTranslation = true;
  let showRomanization = false;
  /** 歌词字体（CSS font-family 名称）；空串表示用内置字体栈。 */
  let lyricFont = '';
  /** 渲染层按内容量出的宽度（不含最小宽度限制），用于改最小宽度时重新贴合。 */
  let lastContentWidth = 0;
  /** 渲染层最近一次量出的高度（任务栏竖排时用来定窗口高度）。 */
  let lastMeasuredHeight = 0;
  /** 用户手动拖动调整的窗口高度；0 表示按内容自动。 */
  let userHeight = 0;
  /** 用户手动拖动调整的窗口宽度；0 表示按内容自动。 */
  let userWidth = 0;
  /** 多行歌词要显示几行：只在窗口高度（或字号）变化时重算一次，tick 直接用这个缓存值。 */
  let visibleLineCount = 1;
  /** 任务栏模式：贴到任务栏那条上、只显示歌词、透明背景。 */
  let taskbarMode = false;
  /** 进入任务栏模式前的窗口位置，退出时恢复。 */
  let preTaskbarBounds = null;
  /** 任务栏那一条的区域（水平方向覆盖整块屏幕）。 */
  let taskbarBand = null;
  /** 任务栏对齐方式（left/center）缓存，避免每次进任务栏都同步 reg query。 */
  let taskbarAlignCache = null;

  /** 按字号估算的单行窗口高度；最小 120。 */
  const heightForFont = (size) => Math.max(MIN_HEIGHT, Math.round(size * 1.3) + 60);

  /** 一行歌词占的高度（和渲染层 --line-h = 2×字号 保持一致，最小 24）。 */
  const lineHeightMul = () => {
    const t = colors.theme;
    const v = t && t.text ? Number(t.text.lineHeight) : NaN;
    return Number.isFinite(v) && v > 0 ? v : 2.6;
  };
  const lineHeightPx = () => Math.max(24, Math.round(fontSize * lineHeightMul()));
  /**
   * 按当前窗口高度算一次「能显示几行歌词」，缓存到 visibleLineCount。
   * 只有高度/字号变化时才调用；tick 每 100ms 不再重复计算。
   * userHeight=0（没手动拉高过）恒为单行，避免菜单/贴合把窗口撑高时误显示多行。
   */
  const recomputeVisibleLineCount = () => {
    let next = 1;
    if (userHeight > 0 && win && !win.isDestroyed() && !taskbarMode) {
      // 以 userHeight（用户拉的高度）为准，而不是当前窗口高度：
      // 菜单临时撑高窗口时不能因此多显示歌词行。
      const h = Math.round(userHeight);
      if (h > 0) next = Math.max(1, Math.min(24, Math.floor((h - 60) / lineHeightPx())));
    }
    visibleLineCount = next;
  };

  /**
   * 取窗口所在显示器「整块屏幕」的范围（bounds，含任务栏），而不是 workArea（扣掉了任务栏）。
   * 这样歌词可以贴到任务栏上；配合 'screen-saver' 置顶级别才不会被任务栏盖住。
   */
  const displayBoundsFor = (bounds) => {
    try {
      const b = bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)
        && Number.isFinite(bounds.width) && Number.isFinite(bounds.height) ? bounds : null;
      const display = b
        ? screen.getDisplayNearestPoint({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) })
        : screen.getPrimaryDisplay();
      return display.bounds;
    } catch {
      return screen.getPrimaryDisplay().bounds;
    }
  };

  /** 取窗口所在显示器的工作区（扣掉任务栏）。缩放高度用它封顶，免得拉到任务栏下面看不见。 */
  const workAreaFor = (bounds) => {
    try {
      const b = bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.y)
        && Number.isFinite(bounds.width) && Number.isFinite(bounds.height) ? bounds : null;
      const display = b ? screen.getDisplayMatching(b) : screen.getPrimaryDisplay();
      return display.workArea;
    } catch {
      return displayBoundsFor(bounds);
    }
  };

  // ---------------------------------------------------------------- 位置

  const defaultBounds = () => {
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, WIN_W_DEFAULT));
    const height = heightForFont(fontSize);
    return {
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + area.height - height - 36,
      width,
      height,
    };
  };

  /** 只把位置夹回屏幕内；宽度交给文字自适应，不沿用旧存档里的死宽度。 */
  const clampToDisplay = (bounds) => {
    const area = displayBoundsFor(bounds);
    const width = Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, Number(bounds.width) || WIN_W_DEFAULT));
    // 手动拉高以 userHeight 为准，否则沿用传入的高度（不再依赖内容高度缓存）
    const height = Math.max(MIN_HEIGHT, Math.round(userHeight > 0 ? userHeight : (Number(bounds.height) || heightForFont(fontSize))));
    const x = Math.min(Math.max(area.x, Number(bounds.x) || area.x), Math.max(area.x, area.x + area.width - width));
    const y = Math.min(Math.max(area.y, Number(bounds.y) || area.y), Math.max(area.y, area.y + area.height - height));
    return { x, y, width, height };
  };

  /**
   * 渲染层量出内容（胶囊）的实际宽高后调用：窗口贴着内容收放。
   * 宽度按内容（左边界固定、向右伸缩），高度按实测高度（底边固定、向上/下伸缩），
   * 这样歌词/翻译/音译/菜单增减导致的高度变化都自动跟上。
   * 参数可以是 {width, height}，也兼容旧的纯数字宽度。
   */
  const fitToContent = (measure) => {
    if (!win || win.isDestroyed()) return;
    // 拖动过程中不改窗口，免得和 setPosition 抢布局。
    if (dragOrigin) return;
    // 刚拖完的那一次内容贴合直接跳过：松手瞬间不按内容改尺寸，位置就不会跳。
    if (skipFitOnce) { skipFitOnce = false; return; }
    let textWidth = 0;
    let measuredHeight = 0;
    if (measure && typeof measure === 'object') {
      textWidth = Number(measure.width) || 0;
      measuredHeight = Number(measure.height) || 0;
    } else {
      textWidth = Number(measure) || 0;
    }
    const content = Math.ceil(textWidth);
    if (content <= 0 && measuredHeight <= 0) return;
    if (content > 0) lastContentWidth = content;
    if (measuredHeight > 0) lastMeasuredHeight = Math.round(measuredHeight);
    // 任务栏模式：贴着任务栏那一条显示，只占歌词所需尺寸。
    if (taskbarMode && taskbarBand) {
      const tb = taskbarBand;
      if (tb.edge === 'left' || tb.edge === 'right') {
        // 竖向任务栏：歌词竖排，窗口是「任务栏宽度 × 歌词长度」的窄高条，垂直居中
        const h = Math.min(tb.height, Math.max(60, lastMeasuredHeight || 200));
        const y = Math.round(tb.top + (tb.height - h) / 2);
        win.setBounds({ x: tb.x, y, width: tb.width, height: Math.round(h) });
        return;
      }
      // 底部 / 顶部任务栏：高度就是那一条，宽度贴文字；水平位置按任务栏对齐方式（左对齐靠左，居中居中）
      const want = content > 0 ? Math.min(tb.width, Math.max(80, content)) : Math.max(80, Math.min(tb.width, lastContentWidth || 200));
      const x = tb.align === 'left'
        ? Math.round(tb.x + 12)
        : Math.round(Math.min(Math.max(tb.x, tb.x + (tb.width - want) / 2), tb.x + tb.width - want));
      win.setBounds({ x, y: tb.top, width: Math.round(want), height: tb.height });
      return;
    }
    const b = win.getBounds();
    // 高度：手动拉高后只认 userHeight，否则按这次实测内容高度，都不缓存，避免上次的高度残留把窗口顶大。
    let height;
    if (userHeight > 0) {
      height = Math.max(MIN_HEIGHT, Math.round(userHeight));
    } else {
      height = Math.max(MIN_HEIGHT, Math.round(measuredHeight > 0 ? measuredHeight : b.height));
    }
    const area = displayBoundsFor(b);
    // 顶边固定：展开齿轮菜单时窗口向下长高、歌词位置不动；只有超出屏幕底部才整体上移夹回。
    const y = Math.min(Math.max(area.y, b.y), Math.max(area.y, area.y + area.height - height));
    // 宽度：手动拖动宽度优先；否则内容宽度与最小宽度取大，再夹到上限。
    const want = userWidth > 0
      ? Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, userWidth))
      : (content > 0 ? Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, content)) : b.width);
    if (Math.abs(b.width - want) < 2 && Math.abs(b.height - height) < 2 && b.y === y) return;
    win.setBounds({ x: b.x, y, width: want, height });
  };

  const loadBounds = async () => {
    try {
      const saved = await api.storage.get('windowBounds');
      if (saved && typeof saved === 'object' && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        const height = heightForFont(fontSize);
        const area = displayBoundsFor({ x: saved.x, y: saved.y, width: WIN_W_MIN, height });
        return {
          x: Math.min(Math.max(area.x, saved.x), Math.max(area.x, area.x + area.width - WIN_W_MIN)),
          y: Math.min(Math.max(area.y, saved.y), Math.max(area.y, area.y + area.height - height)),
          width: Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, WIN_W_DEFAULT)),
          height,
        };
      }
    } catch (error) {
      logErr('读取窗口位置失败', error);
    }
    return defaultBounds();
  };

  const loadFontSize = async () => {
    try {
      const saved = await api.storage.get('fontSize');
      const size = Number(saved);
      if (Number.isFinite(size)) return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(size * 10) / 10));
    } catch (error) {
      logErr('读取字号失败', error);
    }
    return FONT_DEFAULT;
  };

  const loadColors = async () => {
    try {
      const saved = await api.storage.get('colors');
      if (saved && typeof saved === 'object') {
        if (COLOR_RE.test(String(saved.lyric || ''))) colors.lyric = String(saved.lyric);
        if (COLOR_RE.test(String(saved.translation || ''))) colors.translation = String(saved.translation);
        if (COLOR_RE.test(String(saved.romanization || ''))) colors.romanization = String(saved.romanization);
        if (COLOR_RE.test(String(saved.bg || ''))) colors.bg = String(saved.bg);
        if (saved.mode === 'dark' || saved.mode === 'light') colors.mode = saved.mode;
        if (Number.isFinite(Number(saved.bgAlpha))) colors.bgAlpha = Math.min(1, Math.max(0, Number(saved.bgAlpha)));
        if (typeof saved.preset === 'string') colors.preset = saved.preset;
        if (saved.theme && typeof saved.theme === 'object') colors.theme = saved.theme;
      }
    } catch (error) {
      logErr('读取颜色失败', error);
    }
    return colors;
  };

  /** 读取「每首歌偏移」表；无记录时对应歌曲默认 0。 */
  const loadLyricOffsets = async () => {
    try {
      const saved = await api.storage.get('lyricOffsets');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const out = {};
        for (const [key, value] of Object.entries(saved)) {
          const n = Number(value);
          if (key && Number.isFinite(n) && n !== 0) {
            out[String(key).slice(0, 300)] = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Math.round(n)));
          }
        }
        lyricOffsets = out;
      }
    } catch (error) {
      logErr('读取歌词偏移失败', error);
    }
    return lyricOffsets;
  };
  const scheduleSaveLyricOffsets = () => {
    if (lyricOffsetSaveTimer) clearTimeout(lyricOffsetSaveTimer);
    lyricOffsetSaveTimer = setTimeout(() => {
      lyricOffsetSaveTimer = null;
      void api.storage.set('lyricOffsets', lyricOffsets).catch((error) => logErr('保存歌词偏移失败', error));
    }, 300);
  };
  const offsetForSong = (key) => (key && Object.prototype.hasOwnProperty.call(lyricOffsets, key) ? lyricOffsets[key] : 0);
  /** 切歌时把该歌存下的偏移应用到当前值；没有记录就是 0。 */
  const syncOffsetToSong = (key) => {
    if (key === currentSongKey) return;
    currentSongKey = key;
    const next = offsetForSong(key);
    if (next !== lyricOffsetMs) {
      lyricOffsetMs = next;
      send('desktop-lyric:offset', lyricOffsetMs);
      sendToSettings('desktop-lyric:offset', lyricOffsetMs);
    }
  };

  const loadFontFamily = async () => {
    try {
      const saved = await api.storage.get('lyricFont');
      if (typeof saved === 'string') lyricFont = saved.trim().slice(0, 120);
    } catch (error) {
      logErr('读取字体失败', error);
    }
    debugLog(`字体: ${lyricFont || '(默认)'}`);
    return lyricFont;
  };

  const loadLineVisibility = async () => {
    try {
      const saved = await api.storage.get('lines');
      if (saved && typeof saved === 'object') {
        if (typeof saved.showTranslation === 'boolean') showTranslation = saved.showTranslation;
        if (typeof saved.showRomanization === 'boolean') showRomanization = saved.showRomanization;
      }
    } catch (error) {
      logErr('读取翻译/音译显隐失败', error);
    }
    return { showTranslation, showRomanization };
  };

  const saveBounds = async () => {
    if (!win || win.isDestroyed()) return;
    try {
      const b = win.getBounds();
      await api.storage.set('windowBounds', { x: b.x, y: b.y, width: b.width });
    } catch (error) {
      logErr('保存窗口位置失败', error);
    }
  };

  /** 字号写盘合并：滚动调节时 300ms 内只写最后一次。 */
  const scheduleSaveFontSize = (size) => {
    if (fontSizeSaveTimer) clearTimeout(fontSizeSaveTimer);
    fontSizeSaveTimer = setTimeout(() => {
      fontSizeSaveTimer = null;
      void api.storage.set('fontSize', size).catch((error) => logErr('保存字号失败', error));
    }, 300);
  };

  // 拖动时每次 setPosition 都会触发窗口的 'moved' 事件；如果每次都立刻写盘，
  // 高频写文件会拖慢拖动。这里把非拖动引起的移动合并成一次写盘，
  // 拖动过程本身不写（松手时 drag-end 立刻存一次）。
  let boundsSaveTimer = null;
  const scheduleSaveBounds = () => {
    if (boundsSaveTimer) return;
    boundsSaveTimer = setTimeout(() => {
      boundsSaveTimer = null;
      void saveBounds();
    }, 400);
  };
  const flushSavedBounds = () => {
    if (boundsSaveTimer) {
      clearTimeout(boundsSaveTimer);
      boundsSaveTimer = null;
    }
    void saveBounds();
  };

  // ---------------------------------------------------------------- 窗口

  const send = (channel, payload) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch (error) {
      logErr(`发送 ${channel} 失败`, error);
    }
  };

  const sendToSettings = (channel, payload) => {
    if (!settingsWin || settingsWin.isDestroyed()) return;
    try {
      settingsWin.webContents.send(channel, payload);
    } catch (error) {
      logErr(`发送设置窗口 ${channel} 失败`, error);
    }
  };

  const settingsStateSnapshot = () => ({
    colors,
    fontSize,
    lyricFont,
    showTranslation,
    showRomanization,
    locked,
    lyricOffsetMs,
  });

  /** 把当前状态 + 主题 + 字体列表推给设置窗口。 */
  const pushSettingsState = () => {
    if (!settingsWin || settingsWin.isDestroyed()) return;
    sendToSettings('desktop-lyric:state', settingsStateSnapshot());
    sendToSettings('desktop-lyric:themes', themesData);
    getFontFamilies()
      .then((families) => {
        const list = Array.isArray(families) ? families : [];
        sendToSettings('desktop-lyric:fonts', { families: list, current: lyricFont });
      })
      .catch(() => {});
  };

  /** 打开（或聚焦）独立设置窗口，可指定标签页 settings / colors。 */
  const openSettings = (tab) => {
    if (tab === 'colors' || tab === 'settings') settingsTab = tab;
    if (!settingsWin || settingsWin.isDestroyed()) {
      settingsWin = new BrowserWindow({
        width: 420,
        height: 640,
        minWidth: 400,
        minHeight: 360,
        frame: false,
        resizable: true,
        minimizable: false,
        maximizable: false,
        skipTaskbar: false,
        alwaysOnTop: true,
        show: false,
        title: '桌面歌词设置',
        backgroundColor: '#2f3140',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          backgroundThrottling: false,
        },
      });
      settingsWin.setMenuBarVisibility(false);
      settingsWin.on('closed', () => { settingsWin = null; });
      settingsWin.once('ready-to-show', () => {
        if (settingsWin && !settingsWin.isDestroyed()) { settingsWin.show(); settingsWin.focus(); }
      });
      settingsWin.webContents.on('did-finish-load', () => {
        pushSettingsState();
        sendToSettings('desktop-lyric:settings-tab', settingsTab);
      });
      settingsWin.loadFile(path.join(__dirname, 'settings.html'))
        .then(() => {
          if (settingsWin && !settingsWin.isDestroyed() && !settingsWin.isVisible()) { settingsWin.show(); settingsWin.focus(); }
        })
        .catch((error) => logErr('加载设置窗口失败', error));
    } else {
      settingsWin.show();
      settingsWin.focus();
      pushSettingsState();
      sendToSettings('desktop-lyric:settings-tab', settingsTab);
    }
  };

  const closeSettings = () => {
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
    settingsWin = null;
  };

  // 锁定 = 鼠标穿透：指针不在歌词上时，点击、拖拽、右键全部穿透到下面的窗口。
  // 但整窗穿透后既拖不动也点不到解锁，所以锁定时做「悬停临时取消穿透」：
  //   指针停在歌词窗口上（默认 200ms 的停留，避免扫过时误捕获）→ 临时取消穿透，
  //   这时按住歌词就能拖动挪位、点锁形按钮就能解锁；指针离开立刻恢复穿透。
  // 悬停由主进程轮询屏幕光标判断（穿透窗口收不到 mouse 事件），Wayland 走渲染层转发。
  const isUnlockHovering = () => unlockHoverRenderer || unlockHoverPolled;

  const notifyInteractive = () => {
    // 只有主进程轮询驱动悬停的平台才需要这条通知（渲染层据此点亮解锁按钮）。
    // Wayland 由渲染层自己的 mousemove 判断悬停，不需要也不要发，避免和轮询互相覆盖。
    if (!CURSOR_POLLING_SUPPORTED) return;
    const active = isUnlockHovering();
    if (active === lastInteractiveSent) return;
    lastInteractiveSent = active;
    send('desktop-lyric:interactive', active);
  };

  const applyMouseIgnoreState = () => {
    if (!win || win.isDestroyed()) return;
    // 拖动过程中始终可交互：否则窗口跟着指针一动，指针滑出热区又变回穿透，拖到一半就断。
    // 锁定（穿透）时始终忽略鼠标，绝不被悬停解冻——用快捷键/宿主按钮解除穿透再操作。
    // 任务栏模式：默认透传；指针悬停歌词时临时解冻以便拖出任务栏。
    const hoverLift = taskbarMode && isUnlockHovering();
    const ignore = (locked || taskbarMode) && !hoverLift && !dragOrigin;
    win.setIgnoreMouseEvents(ignore, { forward: true });
    notifyInteractive();
  };

  const clearHoverEnterTimer = () => {
    if (hoverEnterTimer) {
      clearTimeout(hoverEnterTimer);
      hoverEnterTimer = null;
    }
  };

  const cursorInsideWindow = () => {
    if (!win || win.isDestroyed()) return false;
    try {
      const b = win.getBounds();
      const p = screen.getCursorScreenPoint();
      return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    } catch {
      return false;
    }
  };

  /** 每 HOVER_POLL_MS 看一次屏幕光标：停在窗口上够久就取消穿透，离开立刻恢复。 */
  const syncHoverFromCursor = () => {
    if (!win || win.isDestroyed() || !(locked || taskbarMode) || !win.isVisible()) return;
    if (dragOrigin) return; // 拖动中由 applyMouseIgnoreState 兜着，这里不改状态
    const inside = cursorInsideWindow();
    if (suppressHoverUnlock) {
      if (!inside) {
        suppressHoverUnlock = false;
        hoverPointerInside = false;
      } else {
        hoverPointerInside = true;
        return;
      }
    }
    if (inside === hoverPointerInside) return;
    hoverPointerInside = inside;
    if (inside) {
      if (hoverEnterTimer) return;
      const delay = taskbarMode ? 0 : HOVER_LIFT_DELAY_MS;
      hoverEnterTimer = setTimeout(() => {
        hoverEnterTimer = null;
        if (!hoverPointerInside || !(locked || taskbarMode) || dragOrigin || unlockHoverPolled) return;
        unlockHoverPolled = true;
        applyMouseIgnoreState();
      }, delay);
    } else {
      clearHoverEnterTimer();
      if (unlockHoverPolled) {
        unlockHoverPolled = false;
        applyMouseIgnoreState();
      }
    }
  };

  const startHoverMonitor = () => {
    if (hoverPollTimer || !CURSOR_POLLING_SUPPORTED) return;
    if (!win || win.isDestroyed() || !(locked || taskbarMode)) return;
    hoverPointerInside = false;
    syncHoverFromCursor();
    hoverPollTimer = setInterval(syncHoverFromCursor, HOVER_POLL_MS);
  };

  const stopHoverMonitor = () => {
    if (hoverPollTimer) {
      clearInterval(hoverPollTimer);
      hoverPollTimer = null;
    }
    clearHoverEnterTimer();
    hoverPointerInside = false;
    unlockHoverPolled = false;
  };

  const applyLock = (next) => {
    const wasLocked = locked;
    locked = Boolean(next);
    if (locked && !wasLocked) suppressHoverUnlock = true;
    if (!locked) suppressHoverUnlock = false;
    unlockHoverRenderer = false;
    stopHoverMonitor();
    if (!win || win.isDestroyed()) return locked;
    applyMouseIgnoreState();
    send('desktop-lyric:lock', locked);
    debugLog(`锁定状态: ${locked ? '已锁定（鼠标穿透）' : '未锁定（可拖动 / 可点击）'}`);
    // 只在值真的变了才写盘（启动/重载时 applyLock 恢复原值不该再写一次）
    if (locked !== lastSavedLocked) {
      lastSavedLocked = locked;
      void api.storage.set('locked', locked).catch((error) => logErr('保存锁定状态失败', error));
    }
    if (locked) startHoverMonitor();
    return locked;
  };

  /** 读上次的锁定状态；没存过就默认不锁，方便一进来就能拖。 */
  const loadLocked = async () => {
    try {
      const saved = await api.storage.get('locked');
      if (typeof saved === 'boolean') locked = saved;
      else locked = false;
    } catch (error) {
      logErr('读取锁定状态失败', error);
      locked = false;
    }
    lastSavedLocked = locked;
    debugLog(`恢复锁定状态: ${locked ? '已锁定' : '未锁定'}`);
    return locked;
  };

  /** 读用户是否开启过全局快捷键；没存过就不注册。 */
  const loadHotkeysEnabled = async () => {
    try {
      const saved = await api.storage.get('hotkeys');
      hotkeysEnabled = saved === true;
    } catch (error) {
      logErr('读取快捷键设置失败', error);
      hotkeysEnabled = false;
    }
    debugLog(`全局快捷键: ${hotkeysEnabled ? '已开启' : '未开启'}`);
    return hotkeysEnabled;
  };

  /** 读用户录制的组合键；没存过或格式不对的动作用默认值。 */
  const loadHotkeyBindings = async () => {
    try {
      hotkeyBindings = normalizeHotkeyBindings(await api.storage.get('hotkeyBindings'));
    } catch (error) {
      logErr('读取快捷键组合失败', error);
      hotkeyBindings = { ...DEFAULT_HOTKEY_BINDINGS };
    }
    debugLog(`快捷键组合: ${JSON.stringify(hotkeyBindings)}`);
    return hotkeyBindings;
  };

  /** 调整字号：把新字号推给渲染层，渲染层量出新的内容高度后再回传贴合窗口。 */
  const applyFontSize = async (next) => {
    const size = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((Number(next) || FONT_DEFAULT) * 10) / 10));
    fontSize = size;
    // 字号影响行高，可见行数要跟着重算一次
    recomputeVisibleLineCount();
    if (win && !win.isDestroyed()) {
      send('desktop-lyric:font', size);
    }
    // 滚轮连续调字号会高频触发，写盘合并一下，避免每格都写文件。
    scheduleSaveFontSize(size);
    debugLog(`字号: ${size}px`);
    return size;
  };

  /** 改歌词字体：存盘并推给渲染层（渲染层会重排并回传新高度）。 */
  const applyFontFamily = async (family) => {
    lyricFont = String(family || '').trim().slice(0, 120);
    if (win && !win.isDestroyed()) {
      send('desktop-lyric:font-family', lyricFont);
    }
    try {
      await api.storage.set('lyricFont', lyricFont);
    } catch (error) {
      logErr('保存字体失败', error);
    }
    debugLog(`字体: ${lyricFont || '(默认)'}`);
    return lyricFont;
  };

  /** 翻译行 / 音译行显隐。 */
  const applyLineVisibility = async (which, on) => {
    if (which === 'translation') showTranslation = Boolean(on);
    else if (which === 'romanization') showRomanization = Boolean(on);
    if (win && !win.isDestroyed()) {
      send('desktop-lyric:lines', { showTranslation, showRomanization });
    }
    try {
      await api.storage.set('lines', { showTranslation, showRomanization });
    } catch (error) {
      logErr('保存翻译/音译显隐失败', error);
    }
    debugLog(`翻译=${showTranslation} 音译=${showRomanization}`);
    return { showTranslation, showRomanization };
  };

  const persistColors = async () => {
    try { await api.storage.set('colors', colors); } catch (error) { logErr('保存颜色失败', error); }
  };

  /** 整套配色/跟随主题：只更新传入的字段。 */
  const applyColorConfig = async (patch) => {
    if (!patch || typeof patch !== 'object') return colors;
    const next = { ...colors };
    if (COLOR_RE.test(String(patch.lyric || ''))) next.lyric = String(patch.lyric).toLowerCase();
    if (patch.translation === '') next.translation = '';
    else if (COLOR_RE.test(String(patch.translation || ''))) next.translation = String(patch.translation).toLowerCase();
    if (patch.romanization === '') next.romanization = '';
    else if (COLOR_RE.test(String(patch.romanization || ''))) next.romanization = String(patch.romanization).toLowerCase();
    if (COLOR_RE.test(String(patch.bg || ''))) next.bg = String(patch.bg).toLowerCase();
    if (patch.mode === 'dark' || patch.mode === 'light') next.mode = patch.mode;
    if (patch.bgAlpha !== undefined && Number.isFinite(Number(patch.bgAlpha))) {
      next.bgAlpha = Math.min(1, Math.max(0, Number(patch.bgAlpha)));
    }
    if (typeof patch.preset === 'string') next.preset = patch.preset;
    if (patch.theme && typeof patch.theme === 'object') next.theme = patch.theme;
    colors = next;
    if (typeof recomputeVisibleLineCount === 'function') recomputeVisibleLineCount();
    send('desktop-lyric:colors', colors);
    await persistColors();
    debugLog(`配色: preset=${colors.preset} mode=${colors.mode} lyric=${colors.lyric}`);
    return colors;
  };

  /** 调整歌词偏移（毫秒）：正数让歌词更晚出现，0.1s 一步；存盘后下一拍 tick 立刻生效。 */
  const applyLyricOffset = async (ms) => {
    const next = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Math.round(Number(ms) || 0)));
    lyricOffsetMs = next;
    send('desktop-lyric:offset', next);
    sendToSettings('desktop-lyric:offset', next);
    // 只记录到「当前歌曲」；值为 0 视为默认，不落库。
    if (currentSongKey) {
      if (next === 0) delete lyricOffsets[currentSongKey];
      else lyricOffsets[currentSongKey] = next;
      scheduleSaveLyricOffsets();
    }
    debugLog(`歌词偏移: ${currentSongKey || '(无歌曲)'} ${next}ms`);
    return next;
  };

  /**
   * 用轻量标量拼 dirty key 判断要不要推送，避免多行模式下每 100ms 全量 JSON.stringify。
   * lineStart 是当前行 startTime：即使两句歌词文本相同（重复副歌），换行也能被感知到。
   */
  const pushSnapshot = (payload, lineStart) => {
    const k = payload.karaoke;
    const key = [
      payload.text,
      payload.title,
      payload.artist,
      payload.translation,
      payload.romanization,
      payload.hasTranslation ? 1 : 0,
      payload.hasRomanization ? 1 : 0,
      payload.placeholder ? 1 : 0,
      payload.state,
      k ? k.time : '',
      k ? (k.playing ? 1 : 0) : '',
      k ? k.words.length : '',
      Array.isArray(payload.lines) ? payload.lines.length : '',
      payload.linesVersion,
      lineStart,
    ].join('|');
    if (key === lastPushed) return;
    lastPushed = key;
    send('desktop-lyric:update', payload);
  };

  const createWindow = async () => {
    const bounds = await loadBounds();
    await loadLocked();
    await loadHotkeyBindings();
    await loadHotkeysEnabled();
    if (disposed) return;

    win = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      acceptFirstMouse: true,
      show: false,
      title: '桌面歌词',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });

    // 用最高置顶级别：歌词要能压住任务栏，点任务栏也不能被摁下去。
    // （和 Folia 桌面歌词模式里主窗口用的是同一级别。）
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setMenuBarVisibility(false);

    // 任务栏自己也是 topmost 窗口，被点击时会被激活、抬到同一 z 带最前面，把歌词压下去。
    // 纯 z-order 没法比它更高，所以在「窗口和任务栏有重叠」时周期性重设一次 'screen-saver'
    // （Windows 上这一档会插到任务栏之上，moveTop 不一定够）；平时不重叠就完全不做事。
    const overlapsTaskbar = () => {
      if (!win || win.isDestroyed()) return false;
      try {
        const b = win.getBounds();
        const wa = screen.getDisplayMatching(b).workArea;
        return b.x < wa.x || b.y < wa.y
          || (b.x + b.width) > (wa.x + wa.width)
          || (b.y + b.height) > (wa.y + wa.height);
      } catch {
        return false;
      }
    };
    const reassertTopmost = () => {
      if (!win || win.isDestroyed() || !win.isVisible()) return;
      // 拖动过程中不要动 z 序/位置：SetWindowPos 会和拖动的 setPosition 抢，
      // 在任务栏那一带表现为「往上顶一下」。松手后定时器会自己补上。
      if (dragOrigin) return;
      if (!overlapsTaskbar()) return;
      try {
        // screen-saver = Windows 上「任务栏之上」这一档；moveTop 再补一刀 SetWindowPos，
        // 避免 SetZOrderLevel 同值时不真正重排。
        win.setAlwaysOnTop(true, 'screen-saver');
        win.moveTop();
      } catch { /* 忽略 */ }
    };

    // 只在窗口显示时保留定时器；显示/重新获得焦点时立即补一次，隐藏时停掉，避免空转。
    const startTopmostTimer = () => {
      if (topmostTimer || !win || win.isDestroyed() || !win.isVisible()) return;
      topmostTimer = setInterval(reassertTopmost, TOPMOST_MS);
    };
    const stopTopmostTimer = () => {
      if (!topmostTimer) return;
      clearInterval(topmostTimer);
      topmostTimer = null;
    };
    win.on('show', () => {
      reassertTopmost();
      startTopmostTimer();
      startPoll();
      // 重新显示时先按当前锁定状态恢复穿透，再开始悬停轮询（隐藏前可能正处于临时可交互）。
      applyMouseIgnoreState();
      if (locked || taskbarMode) startHoverMonitor();
    });
    win.on('hide', () => {
      stopPoll();
      stopTopmostTimer();
      stopHoverMonitor();
      stopDragPoll();
      dragOrigin = null;
      dragWinOrigin = null;
      dragRestore = null;
      unlockHoverRenderer = false;
    });
    win.on('focus', reassertTopmost);

    win.once('ready-to-show', () => {
      if (!win || win.isDestroyed()) return;
      win.showInactive();
      reassertTopmost();
      startTopmostTimer();
      applyLock(locked);
      send('desktop-lyric:themes', themesData);
      send('desktop-lyric:font', fontSize);
      send('desktop-lyric:font-family', lyricFont);
      send('desktop-lyric:lines', { showTranslation, showRomanization });
      send('desktop-lyric:colors', colors);
      send('desktop-lyric:offset', lyricOffsetMs);
      send('desktop-lyric:resized', userHeight > 0);
      // 渲染层已就绪，补发一次字体列表（预热可能早于监听注册）
      getFontFamilies()
        .then((families) => {
          const list = Array.isArray(families) ? families : [];
          if (win && !win.isDestroyed()) send('desktop-lyric:fonts', { families: list, current: lyricFont });
        })
        .catch(() => {});
    });

    // 兜底：页面每次加载完成后补发一次主题数据，避免监听注册晚于首帧
    win.webContents.on('did-finish-load', () => {
      if (win && !win.isDestroyed()) send('desktop-lyric:themes', themesData);
    });

    win.on('moved', () => { if (dragOrigin) return; scheduleSaveBounds(); });
    // 窗口高度变化（拖动调整、内容贴合等）时重算一次可见行数；不在这里 tick，避免和尺寸贴合互相触发
    win.on('resize', () => { if (dragOrigin) return; recomputeVisibleLineCount(); });
    // 关窗只隐藏，不销毁：窗口一旦销毁就再也打不开，
    // 显示/隐藏快捷键和按钮都会失效，只能重载模组才能恢复。
    win.on('close', (event) => {
      if (disposed || !win) return;
      event.preventDefault();
      win.hide();
      stopHoverMonitor();
      stopDragPoll();
      dragOrigin = null;
      dragWinOrigin = null;
      dragRestore = null;
      unlockHoverRenderer = false;
      debugLog('窗口已关闭（实际是隐藏，可用快捷键或按钮再次显示）');
    });
    win.on('closed', () => { win = null; });

    await win.loadFile(path.join(__dirname, 'lyric.html'));
    debugLog('桌面歌词窗口已创建');
  };

  // ---------------------------------------------------------------- 歌词

  const resolveText = createLyricResolver();

  const tick = () => {
    if (disposed) return;
    let snapshot = null;
    try {
      snapshot = api.runtime.getPlaybackSnapshot();
    } catch (error) {
      logErr('读取播放快照失败', error);
    }

    if (!snapshot) {
      pushSnapshot({ text: '', title: '', placeholder: false, state: 'stopped' });
      return;
    }

    const position = Number(snapshot.position) || 0;
    const state = snapshot.state || 'stopped';
    const song = snapshot.song || {};
    const songName = String(song.title || song.name || '');
    const songArtist = String(song.artist || '');
    // 歌曲标识必须跨会话稳定：source + id（id 仅在 source 内唯一）；没有 id 时退回 歌名+歌手。
    // 注意不能用 song.ref——它只是本次会话的临时句柄，重启/重建队列后会变。
    const songKey = (song.id
      ? `${song.source || ''}#${song.id}`
      : (songName ? `name:${songName}\u0001${songArtist}` : '')).slice(0, 300);
    // 每首歌各自偏移：切歌时切到该歌存储值（无记录=0）。
    syncOffsetToSong(songKey);
    const duration = Number(snapshot.duration) || 0;

    // 什么都没在播放（Folia 刚启动、没选歌）时才留空，交给渲染层显示「等待播放」
    const idle = !songName && state === 'stopped';

    const lyricTime = idle ? 0 : position + lyricOffsetMs / 1000;
    const resolved = idle
      ? { text: '', kind: 'none', translation: '', romanization: '', line: null }
      : resolveText(snapshot.lines, lyricTime, songKey, duration);

    // 整首歌是否有翻译 / 音译内容：有的话渲染层会为这两行预留固定高度，避免逐句有无翻译导致窗口跳动。
    // 同一首歌（签名不变）只算一次，滚动推进时不再每 100ms 扫全部歌词行。
    // 宿主通常已按 startTime 排好序，缓存键直接取首尾做签名；命中时连排序/扫描都省掉。
    const rawLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    const firstLine = rawLines[0];
    const lastLine = rawLines[rawLines.length - 1];
    const metaKey = [
      songKey,
      rawLines.length,
      Number(firstLine && firstLine.startTime) || 0,
      Number(lastLine && lastLine.startTime) || 0,
      String((firstLine && firstLine.translation) || ''),
      String((lastLine && lastLine.translation) || ''),
      String((firstLine && firstLine.romanization) || ''),
      String((lastLine && lastLine.romanization) || ''),
    ].join('|');
    let songLines;
    let hasTranslation;
    let hasRomanization;
    if (metaKey === lyricCache.key) {
      songLines = lyricCache.lines;
      hasTranslation = lyricCache.hasTranslation;
      hasRomanization = lyricCache.hasRomanization;
    } else {
      songLines = rawLines.slice()
        .sort((a, b) => (Number(a && a.startTime) || 0) - (Number(b && b.startTime) || 0));
      hasTranslation = songLines.some((line) => line && String(line.translation || '').trim());
      hasRomanization = songLines.some((line) => line && String(line.romanization || '').trim());
      lyricCache = { key: metaKey, lines: songLines, hasTranslation, hasRomanization };
    }

    // 多行模式（用户拉高过窗口）：推整首歌词给渲染层，让它自己滚动、逐句高亮、点行跳转。
    // 单行/任务栏模式只显示当前一句（lines 为空，由渲染层用单行 #text）。
    // 列表只跟「歌曲 + 当前句」有关：当前句没变就复用上次建好的数组，不再每 tick 全量 map。
    let lyricLines = [];
    if (!idle && !taskbarMode && userHeight >= MULTI_MIN_HEIGHT && resolved.kind === 'lyric' && resolved.line) {
      const curStart = Number(resolved.line.startTime);
      const linesKey = `${metaKey}|${curStart}`;
      if (linesKey === lyricLinesCache.key) {
        lyricLines = lyricLinesCache.value;
      } else {
        lyricLines = songLines.map((line) => ({
          text: lyricLineText(line),
          translation: String(line.translation || '').trim(),
          romanization: String(line.romanization || '').trim(),
          isCurrent: Number(line && line.startTime) === curStart,
          startTime: Number(line && line.startTime) || 0,
        }));
        lyricLinesCache = { key: linesKey, value: lyricLines };
        lyricLinesVersion += 1;
      }
    }

    // 逐字卡拉OK：优先用词级时间；没有词时间时按整句时长把文字逐字均分（保证普通歌词也有渐变）。
    // words 只跟当前行有关：按「歌曲 + 行 start + 文本」缓存，同一句的每个 tick 复用同一份数组，
    // 不再每 100ms 重新映射 / 均分一遍。id 交给渲染层判断“还是不是同一句”。
    let karaoke = null;
    if (!idle && resolved.kind === 'lyric' && resolved.line && resolved.text) {
      const line = resolved.line;
      const start = Number(line.startTime) || 0;
      const karaokeKey = `${songKey}|${start}|${resolved.text}`;
      let words;
      if (karaokeKey === karaokeWordsCache.key) {
        words = karaokeWordsCache.words;
      } else {
        let end = Number(line.renderHints && line.renderHints.renderEndTime) || Number(line.endTime) || 0;
        if (!(end > start) && songLines.length) {
          const idx = songLines.findIndex((l) => Number(l && l.startTime) === start);
          const next = idx >= 0 ? songLines[idx + 1] : null;
          end = Number(next && next.startTime) || 0;
        }
        words = [];
        if (Array.isArray(line.words) && line.words.some((w) => Number(w && w.endTime) > Number(w && w.startTime))) {
          words = line.words.map((w) => ({
            text: String((w && w.text) || ''),
            startTime: Number(w && w.startTime) || 0,
            endTime: Number(w && w.endTime) || 0,
          }));
        } else {
          const chars = Array.from(String(resolved.text));
          if (chars.length > 0) {
            if (!(end > start)) end = start + Math.max(1, chars.length * 0.18);
            const per = (end - start) / chars.length;
            words = chars.map((ch, i) => ({
              text: ch,
              startTime: Math.round((start + per * i) * 1000) / 1000,
              endTime: Math.round((start + per * (i + 1)) * 1000) / 1000,
            }));
          }
        }
        karaokeWordsCache = { key: karaokeKey, words };
      }
      if (words.length > 0) {
        karaoke = {
          time: Math.round(lyricTime * 100) / 100,
          playing: state === 'playing',
          words,
          id: karaokeKey,
        };
      }
    }

    pushSnapshot({
      text: idle ? '' : resolved.text,
      title: idle ? '' : songName,
      artist: idle ? '' : String(song.artist || ''),
      translation: idle ? '' : (resolved.translation || ''),
      romanization: idle ? '' : (resolved.romanization || ''),
      karaoke,
      lines: lyricLines,
      linesVersion: lyricLinesVersion,
      hasTranslation: !idle && hasTranslation,
      hasRomanization: !idle && hasRomanization,
      placeholder: !idle && resolved.kind !== 'lyric' && resolved.kind !== 'ended',
      state,
    }, idle ? 0 : (Number(resolved.line && resolved.line.startTime) || 0));
  };

  // ---------------------------------------------------------------- 命令

  /** 开始 100ms 轮询；隐藏窗口时停掉，显示时恢复，省 CPU。 */
  const startPoll = () => {
    if (disposed || pollTimer) return;
    pollTimer = setInterval(tick, POLL_MS);
    tick();
  };
  const stopPoll = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  };

  const queueCommand = (command) => {
    pendingCommands.push(command);
    if (pendingCommands.length > 32) pendingCommands = pendingCommands.slice(-32);
    debugLog(`排入播放控制命令: ${command}`);
  };

  const setVisible = (next) => {
    if (!win || win.isDestroyed()) return false;
    if (next) {
      win.showInactive();
      applyMouseIgnoreState();
      if (locked || taskbarMode) startHoverMonitor();
      debugLog('已显示');
      return true;
    }
    win.hide();
    stopHoverMonitor();
    stopDragPoll();
    dragOrigin = null;
    dragWinOrigin = null;
    unlockHoverRenderer = false;
    applyMouseIgnoreState();
    debugLog('已隐藏');
    return false;
  };

  const toggleVisible = () => {
    if (!win || win.isDestroyed()) return;
    setVisible(!win.isVisible());
  };

  const toggleLock = () => applyLock(!locked);

  // Wayland 拿不到全局光标：用页面转发的 screenX/Y 按绝对锚点移动。
  const moveByDrag = (point) => {
    if (!win || win.isDestroyed() || !dragOrigin || !point) return;
    const x = Number(point.x);
    const y = Number(point.y);
    const originX = Number(dragOrigin.x);
    const originY = Number(dragOrigin.y);
    // 任何一个是 NaN / Infinity 都不能往下算：Math.round(NaN) 传给 setPosition
    // 会抛 "conversion failure" 并变成主进程的 uncaughtException（整个 Folia 崩溃）。
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(originX) || !Number.isFinite(originY)) return;
    if (!dragWinOrigin) {
      try { dragWinOrigin = win.getPosition(); } catch { dragWinOrigin = null; }
    }
    if (!dragWinOrigin) return;
    const baseX = Number(dragWinOrigin[0]);
    const baseY = Number(dragWinOrigin[1]);
    if (!Number.isFinite(baseX) || !Number.isFinite(baseY)) return;
    const nextX = Math.round(baseX + (x - originX));
    const nextY = Math.round(baseY + (y - originY));
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
    try {
      // 位置照常跟手，尺寸用拖动开始那一刻锁定的值，拖动过程中窗口不会变大/变小。
      if (dragFixedSize) {
        win.setBounds({ x: nextX, y: nextY, width: dragFixedSize.width, height: dragFixedSize.height });
      } else {
        win.setPosition(nextX, nextY);
      }
    } catch (error) {
      logErr(`移动窗口失败 (${nextX}, ${nextY})`, error);
    }
  };

  // Windows / macOS / X11：主进程每 16ms 读一次系统光标，按两次光标之间的位移增量移动窗口。
  // 完全不依赖页面上报的坐标，也不保留绝对锚点 —— 光标不动，窗口就绝对不动，
  // 页面坐标随窗口移动变化而产生的反馈循环在这里不存在。
  const startDragPoll = () => {
    if (dragPollTimer || !CURSOR_POLLING_SUPPORTED) return;
    try {
      lastDragCursor = screen.getCursorScreenPoint();
    } catch {
      lastDragCursor = null;
    }
    dragPollTimer = setInterval(() => {
      if (!win || win.isDestroyed() || !dragOrigin) return;
      let point;
      try { point = screen.getCursorScreenPoint(); } catch { return; }
      if (!lastDragCursor) {
        lastDragCursor = point;
        return;
      }
      const dx = Number(point.x) - Number(lastDragCursor.x);
      const dy = Number(point.y) - Number(lastDragCursor.y);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      // 光标没动就不碰窗口，杜绝「松手后窗口自己继续跑」。
      if (dx === 0 && dy === 0) return;
      lastDragCursor = point;
      try {
        const [wx, wy] = win.getPosition();
        const nextX = Math.round(Number(wx) + dx);
        const nextY = Math.round(Number(wy) + dy);
        if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
          // 只移动位置：宽高用拖动开始锁定的值。纯 setPosition 在某些缩放下会被系统
          // 按 DPI 反复取整而让窗口一点点变大，这里显式带上尺寸把它钉死。
          if (dragFixedSize) {
            win.setBounds({ x: nextX, y: nextY, width: dragFixedSize.width, height: dragFixedSize.height });
          } else {
            win.setPosition(nextX, nextY);
          }
        }
      } catch (error) {
        logErr(`移动窗口失败 (dx=${dx}, dy=${dy})`, error);
      }
    }, 16);
  };

  const stopDragPoll = () => {
    dragFixedSize = null;
    if (!dragPollTimer) return;
    clearInterval(dragPollTimer);
    dragPollTimer = null;
    lastDragCursor = null;
  };
  // 读 Windows 11 任务栏对齐方式（TaskbarAl：0=左对齐，1=居中）。拿不到返回 null。
  // 异步查询不阻塞主进程；成功读到就缓存，失败不缓存下次再试。
  const getTaskbarAlignment = () => {
    if (taskbarAlignCache !== null) return Promise.resolve(taskbarAlignCache);
    if (process.platform !== 'win32') return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        execFile(
          'reg',
          ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', '/v', 'TaskbarAl'],
          { encoding: 'utf8', windowsHide: true, timeout: 800 },
          (error, stdout) => {
            if (error) {
              resolve(null);
              return;
            }
            const match = /TaskbarAl\s+REG_DWORD\s+0x([0-9a-fA-F]+)/.exec(String(stdout || ''));
            taskbarAlignCache = match ? (parseInt(match[1], 16) === 0 ? 'left' : 'center') : null;
            resolve(taskbarAlignCache);
          },
        );
      } catch {
        resolve(null);
      }
    });
  };

  /** 系统任务栏对齐 → 歌词摆放：左对齐→歌词居中，居中→歌词靠左，未知→居中。 */
  const alignForTaskbar = (osAlign) => {
    if (osAlign === 'left') return 'center';
    if (osAlign === 'center') return 'left';
    return 'center';
  };

  /** 退出任务栏模式；restore 为真时恢复进入前的位置，否则保持当前（拖动时用）。 */
  const exitTaskbar = (restore) => {
    const wasTaskbar = taskbarMode;
    taskbarMode = false;
    taskbarBand = null;
    send('desktop-lyric:taskbar', { active: false });
    if (restore && preTaskbarBounds && win && !win.isDestroyed()) {
      try { win.setBounds(clampToDisplay(preTaskbarBounds)); } catch { /* ignore */ }
    }
    preTaskbarBounds = null;
    // 退出任务栏模式：恢复原本的互动/穿透状态
    if (wasTaskbar) {
      stopHoverMonitor();
      applyMouseIgnoreState();
      if (locked) startHoverMonitor();
    }
  };

  // 一键把歌词贴到「任务栏」那条上：只显示歌词、透明背景、高度限制在任务栏那条以内；再点一次退出。
  const moveToTaskbar = () => {
    if (!win || win.isDestroyed()) return;
    if (taskbarMode) { exitTaskbar(true); return; }
    const b = win.getBounds();
    let display;
    try {
      display = screen.getDisplayMatching(b) || screen.getPrimaryDisplay();
    } catch {
      display = screen.getPrimaryDisplay();
    }
    const bounds = display.bounds; // 整块屏幕（含任务栏）
    const wa = display.workArea;   // 扣掉任务栏
    // 根据任务栏所在的那一边（bounds 与 workArea 的差值）判断从哪贴。
    const dTop = wa.y - bounds.y;
    const dBottom = (bounds.y + bounds.height) - (wa.y + wa.height);
    const dLeft = wa.x - bounds.x;
    const dRight = (bounds.x + bounds.width) - (wa.x + wa.width);
    const maxGap = Math.max(dTop, dBottom, dLeft, dRight);
    if (maxGap < 18) {
      // 自动隐藏 / 取不到任务栏：退化成底部 40px
      taskbarBand = { edge: 'bottom', x: bounds.x, width: bounds.width, top: bounds.y + bounds.height - 40, height: 40 };
    } else if (maxGap === dBottom) {
      taskbarBand = { edge: 'bottom', x: bounds.x, width: bounds.width, top: wa.y + wa.height, height: Math.round(dBottom) };
    } else if (maxGap === dTop) {
      taskbarBand = { edge: 'top', x: bounds.x, width: bounds.width, top: bounds.y, height: Math.round(dTop) };
    } else if (maxGap === dLeft) {
      taskbarBand = { edge: 'left', x: bounds.x, width: Math.round(dLeft), top: bounds.y, height: bounds.height };
    } else {
      taskbarBand = { edge: 'right', x: wa.x + wa.width, width: Math.round(dRight), top: bounds.y, height: bounds.height };
    }
    // 歌词放在任务栏图标「不在」的那一侧：任务栏左对齐→歌词居中；任务栏居中→歌词靠左。
    // 对齐方式异步查（不阻塞）；先用缓存/默认摆好，查到后再修正一次。
    taskbarBand.align = (taskbarBand.edge === 'bottom' || taskbarBand.edge === 'top')
      ? alignForTaskbar(taskbarAlignCache)
      : 'center';
    preTaskbarBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
    taskbarMode = true;
    send('desktop-lyric:taskbar', { active: true, edge: taskbarBand.edge });
    // 先给一个临时位置；渲染层量出文字宽度后会再贴一次。
    if (taskbarBand.edge === 'left' || taskbarBand.edge === 'right') {
      const h = Math.min(taskbarBand.height, 200);
      const y = Math.round(taskbarBand.top + (taskbarBand.height - h) / 2);
      try { win.setBounds({ x: taskbarBand.x, y, width: taskbarBand.width, height: h }); } catch { /* ignore */ }
    } else {
      const width = Math.min(b.width, bounds.width);
      const x = taskbarBand.align === 'left'
        ? Math.round(bounds.x + 12)
        : Math.round(bounds.x + (bounds.width - width) / 2);
      try { win.setBounds({ x, y: taskbarBand.top, width, height: taskbarBand.height }); } catch { /* ignore */ }
    }
    try {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.moveTop();
    } catch (error) {
      logErr('移到任务栏失败', error);
    }
    flushSavedBounds();
    // 对齐方式首次没缓存时，异步查一次并重新摆位。
    if ((taskbarBand.edge === 'bottom' || taskbarBand.edge === 'top') && taskbarAlignCache === null) {
      getTaskbarAlignment()
        .then((osAlign) => {
          if (!taskbarMode || !taskbarBand || !win || win.isDestroyed()) return;
          taskbarBand.align = alignForTaskbar(osAlign);
          const cur = win.getBounds();
          const x = taskbarBand.align === 'left'
            ? Math.round(taskbarBand.x + 12)
            : Math.round(taskbarBand.x + (taskbarBand.width - cur.width) / 2);
          try { win.setBounds({ x, y: taskbarBand.top, width: cur.width, height: taskbarBand.height }); } catch { /* ignore */ }
        })
        .catch(() => {});
    }
    // 进入任务栏模式：默认透传；指针悬停歌词时临时解冻，可拖动（拖出任务栏即恢复普通胶囊）。
    unlockHoverPolled = false;
    unlockHoverRenderer = false;
    applyMouseIgnoreState();
    startHoverMonitor();
    debugLog(`已进入任务栏模式: edge=${taskbarBand.edge} top=${taskbarBand.top} h=${taskbarBand.height} 透传=开`);
  };

  /** 拖动结束后吸附到最近的屏幕边缘（阈值 16px）。 */
  const snapToEdge = () => {
    if (!win || win.isDestroyed() || taskbarMode) return;
    const SNAP = 16;
    const b = win.getBounds();
    let area;
    try {
      area = screen.getDisplayMatching(b).workArea;
    } catch {
      return;
    }
    let { x, y } = b;
    if (Math.abs(x - area.x) <= SNAP) x = area.x;
    else if (Math.abs((x + b.width) - (area.x + area.width)) <= SNAP) x = area.x + area.width - b.width;
    if (Math.abs(y - area.y) <= SNAP) y = area.y;
    else if (Math.abs((y + b.height) - (area.y + area.height)) <= SNAP) y = area.y + area.height - b.height;
    if (x !== b.x || y !== b.y) {
      try { win.setBounds({ x, y, width: b.width, height: b.height }); } catch { /* ignore */ }
    }
  };

  // 来自歌词窗口的 IPC（只信任本窗口）
  const handleWindowCommand = (event, name, arg) => {
    const fromLyric = win && !win.isDestroyed() && event.sender === win.webContents;
    const fromSettings = settingsWin && !settingsWin.isDestroyed() && event.sender === settingsWin.webContents;
    if (!fromLyric && !fromSettings) return;
    const text = String(name || '');
    // 独立设置窗口：打开 / 关闭（已打开时再点设置按钮 = 关闭）
    if (text === 'open-settings') {
      if (settingsWin && !settingsWin.isDestroyed() && settingsWin.isVisible()) {
        closeSettings();
      } else {
        openSettings(typeof arg === 'string' ? arg : 'settings');
      }
      return;
    }
    if (text === 'close-settings') {
      closeSettings();
      return;
    }
    // 整套配色（主题预设 / 跟随主题）
    if (text === 'colors-set') {
      void applyColorConfig(arg);
      return;
    }
    switch (text) {
      case 'lock': toggleLock(); break;
      case 'unlock': applyLock(false); break;
      case 'close': if (win && !win.isDestroyed()) win.close(); break;
      case 'next': queueCommand('next'); break;
      case 'prev': queueCommand('prev'); break;
      case 'toggle-play': queueCommand('toggle-play'); break;
      // 点某句歌词的播放按钮：跳到该句的歌词时间
      case 'seek-lyric': {
        const sec = Number(arg);
        if (Number.isFinite(sec) && sec >= 0) queueCommand({ name: 'seek-lyric', lyricSeconds: sec });
        break;
      }
      // 滚轮调字号：arg 是本次要增减的像素（正放大、负缩小）
      case 'font-delta': {
        const delta = Math.round(Number(arg) || 0);
        if (delta !== 0) void applyFontSize(fontSize + delta);
        break;
      }
      // 预设字号：直接设置为指定像素（支持小数，如 12.5）
      case 'font-set': {
        const size = Number(arg);
        if (Number.isFinite(size)) void applyFontSize(size);
        break;
      }
      // 工具条上的歌词偏移：offset-delta 增减 ms，offset-set 直接设为 ms
      case 'offset-delta': {
        const delta = Math.round(Number(arg) || 0);
        if (delta !== 0) void applyLyricOffset(lyricOffsetMs + delta);
        break;
      }
      case 'offset-set': void applyLyricOffset(arg); break;
      // 一键移到任务栏位置显示
      case 'to-taskbar': moveToTaskbar(); break;
      // 齿轮菜单：取本机字体（带缓存、启动已预热），把结果推回窗口。
      case 'request-fonts': {
        getFontFamilies()
          .then((families) => {
            const list = Array.isArray(families) ? families : [];
            const data = { families: list, current: lyricFont };
            send('desktop-lyric:fonts', data);
            sendToSettings('desktop-lyric:fonts', data);
          })
          .catch((error) => logErr('扫描字体失败', error));
        break;
      }
      case 'font-family': void applyFontFamily(arg); break;
      case 'set-translation': void applyLineVisibility('translation', Boolean(arg)); break;
      case 'set-romanization': void applyLineVisibility('romanization', Boolean(arg)); break;
      // 锁定状态下指针悬停会让窗口临时可交互（为了能拖动），此时滚轮会被本窗口截住。
      // 用户一滚动就说明想让下层程序接收滚轮，这里立刻恢复穿透，后续滚轮交给下层。
      case 'wheel-through': {
        // 锁定穿透或任务栏模式下，用户一滚动就说明想让下层程序接收滚轮，这里恢复穿透。
        if (!(locked || taskbarMode) || dragOrigin) break;
        unlockHoverPolled = false;
        unlockHoverRenderer = false;
        clearHoverEnterTimer();
        applyMouseIgnoreState();
        break;
      }
      case 'fit': fitToContent(arg); break;
      // 四边/四角缩放：渲染层给绝对目标矩形 + 方向，主进程夹到工作区并记下用户尺寸。
      case 'resize-rect': {
        if (!win || win.isDestroyed() || taskbarMode) break;
        const p = arg && typeof arg === 'object' ? arg : {};
        let w = Math.round(Number(p.width));
        let h = Math.round(Number(p.height));
        let x = Math.round(Number(p.x));
        let y = Math.round(Number(p.y));
        if (![w, h, x, y].every(Number.isFinite)) break;
        const b = win.getBounds();
        const wa = workAreaFor(b);
        const maxH = Math.max(MIN_HEIGHT, Math.round(wa.height));
        const rawW = w, rawH = h;
        w = Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, w));
        h = Math.min(maxH, Math.max(MIN_HEIGHT, h));
        const dir = p.dir && typeof p.dir === 'object' ? p.dir : {};
        // 被最小/最大尺寸夹住时，拖左边/上边要补偿位置，保持对边不动
        if (dir.left) x = Math.round(Number(p.x) + (rawW - w));
        if (dir.top) y = Math.round(Number(p.y) + (rawH - h));
        x = Math.min(Math.max(wa.x, x), Math.max(wa.x, wa.x + wa.width - w));
        y = Math.min(Math.max(wa.y, y), Math.max(wa.y, wa.y + wa.height - h));
        userWidth = w;
        userHeight = h;
        try { win.setBounds({ x, y, width: w, height: h }); } catch { /* ignore */ }
        recomputeVisibleLineCount();
        send('desktop-lyric:resized', true);
        break;
      }
      case 'resize-reset': {
        userHeight = 0;
        userWidth = 0;
        recomputeVisibleLineCount();
        send('desktop-lyric:resized', false);
        if (win && !win.isDestroyed()) {
          try { win.setBounds({ x: win.getBounds().x, y: win.getBounds().y, width: WIN_W_DEFAULT, height: heightForFont(fontSize) }); } catch { /* ignore */ }
        }
        tick();
        break;
      }
      // 锁定状态下指针悬停在歌词上：临时取消穿透，让歌词能拖、解锁按钮能点。
      // 能轮询光标的平台只用主进程判断（渲染层转发的 mouse 事件可能卡住、导致一直不恢复穿透）；
      // 只有拿不到全局光标的 Wayland 才接收这条渲染层命令。
      case 'unlock-hover': {
        if (CURSOR_POLLING_SUPPORTED) break;
        const next = Boolean(arg) && locked;
        if (unlockHoverRenderer !== next) {
          unlockHoverRenderer = next;
          applyMouseIgnoreState();
        }
        break;
      }
      // 窗口内按住拖动：页面上报屏幕坐标，主进程算位移后移动窗口。
      // 用页面自绘拖动（而非 -webkit-app-region: drag）是为了保留点击事件。
      case 'drag-start': {
        // 从任务栏模式开始拖动：拖动过程中用最小尺寸方便拖，松手后恢复进任务栏前的尺寸。
        if (taskbarMode) {
          dragFromTaskbar = true;
          dragRestore = {
            userHeight,
            userWidth,
            bounds: preTaskbarBounds ? { ...preTaskbarBounds } : null,
          };
          exitTaskbar(false);
          // 拖动期间临时最小尺寸（不动最终要恢复的值）
          userHeight = MIN_HEIGHT;
          userWidth = WIN_W_MIN;
          recomputeVisibleLineCount();
          if (win && !win.isDestroyed()) {
            const b = win.getBounds();
            const wa = workAreaFor(b);
            const w = WIN_W_MIN;
            const h = MIN_HEIGHT;
            const x = Math.max(wa.x, Math.min(b.x, wa.x + wa.width - w));
            const y = Math.max(wa.y, Math.min(b.y, wa.y + wa.height - h));
            try { win.setBounds({ x, y, width: w, height: h }); } catch { /* ignore */ }
          }
        } else {
          dragRestore = null;
        }
        // 坐标必须都是有限数，否则后面算位移会得到 NaN（setPosition 收到 NaN 会崩主进程）。
        // 窗口原点在这里就记下来，之后整段拖动都以它为基准，拖动过程不会累积误差。
        const px = Number(arg && arg.x);
        const py = Number(arg && arg.y);
        if (Number.isFinite(px) && Number.isFinite(py)) {
          dragOrigin = { x: px, y: py };
          try {
            const b = win.getBounds();
            dragWinOrigin = [Number(b.x), Number(b.y)];
            if (!Number.isFinite(dragWinOrigin[0]) || !Number.isFinite(dragWinOrigin[1])) dragWinOrigin = null;
            // 记住拖动开始时的宽高：整段拖动只用它，窗口不会在拖动中改变大小。
            dragFixedSize = {
              width: Math.round(Number(b.width)),
              height: Math.round(Number(b.height)),
            };
            if (!Number.isFinite(dragFixedSize.width) || dragFixedSize.width <= 0
              || !Number.isFinite(dragFixedSize.height) || dragFixedSize.height <= 0) {
              dragFixedSize = null;
            }
          } catch {
            dragWinOrigin = null;
            dragFixedSize = null;
          }
          // 拖动期间强制保持可交互，避免窗口一动指针离开热区就又变回穿透、拖到一半断掉。
          applyMouseIgnoreState();
          startDragPoll();
        } else {
          dragOrigin = null;
          dragWinOrigin = null;
          dragFixedSize = null;
        }
        break;
      }
      case 'drag-move':
        // 轮询平台由主进程按系统光标自己跟，忽略页面转发来的坐标；
        // 只有拿不到全局光标的 Wayland 才用这条命令。
        if (CURSOR_POLLING_SUPPORTED) break;
        moveByDrag(arg);
        break;
      case 'drag-end':
        stopDragPoll();
        dragOrigin = null;
        dragWinOrigin = null;
        dragFixedSize = null;
        if (dragFromTaskbar) {
          dragFromTaskbar = false;
          // 拖出任务栏松手：恢复到进任务栏前的尺寸/位置（拖动过程中只是临时最小）
          const restore = dragRestore;
          dragRestore = null;
          if (restore) {
            userHeight = restore.userHeight;
            userWidth = restore.userWidth;
            recomputeVisibleLineCount();
            if (win && !win.isDestroyed()) {
              const target = restore.bounds;
              const base = target && Number.isFinite(target.x) && Number.isFinite(target.y) ? target : win.getBounds();
              const wa = workAreaFor(base);
              const maxH = Math.max(MIN_HEIGHT, Math.round(wa.height));
              // 优先用进任务栏前的实际窗口尺寸恢复，避免 userHeight 为 0（自动高度）时
              // 被误算成单行高度，导致恢复后变矮、底部被裁。
              const w = Math.min(WIN_W_MAX, Math.max(WIN_W_MIN, Math.round(Number(base.width) || userWidth || WIN_W_MIN)));
              const h = Math.min(maxH, Math.max(MIN_HEIGHT, Math.round(Number(base.height) || userHeight || heightForFont(fontSize))));
              const x = Math.max(wa.x, Math.min(Number(base.x) || wa.x, wa.x + wa.width - w));
              const y = Math.max(wa.y, Math.min(Number(base.y) || wa.y, wa.y + wa.height - h));
              try { win.setBounds({ x, y, width: w, height: h }); } catch { /* ignore */ }
            }
            send('desktop-lyric:resized', userHeight > 0);
            if (!disposed) tick();
          }
        } else {
          dragRestore = null;
        }
        // 松手后跳过下一次按内容的贴合，避免把刚恢复的尺寸又改掉/跳动
        skipFitOnce = true;
        // 拖完重新按悬停状态决定是否恢复穿透（指针还在歌词上就保持可交互）。
        applyMouseIgnoreState();
        snapToEdge();
        flushSavedBounds();
        break;
      default: debugLog(`未知命令: ${text}`);
    }
  };

  // 来自歌词窗口的命令统一兜一层：模组的 IPC 里抛出的任何错误都不能变成
  // 主进程的 uncaughtException（那会直接让整个 Folia 崩掉），记入日志即可。
  const onWindowCommand = (event, name, arg) => {
    try {
      handleWindowCommand(event, name, arg);
    } catch (error) {
      logErr(`处理窗口命令 ${String(name)} 失败`, error);
    }
  };

  // ---------------------------------------------------------------- 启动

  const start = async () => {
    ipcMain.on('desktop-lyric:command', onWindowCommand);

    // client 入口一加载就开始每 250ms 轮询，所以 RPC 必须在第一个 await 之前注册好，
    // 否则读存储慢一点就会先撞上 rpc-not-found:poll-commands。
    // client 入口每 250ms 取一次命令并调用 folium.playback.*，
    // 顺便回报锁定状态，让 Folia 界面上的按钮能显示对错状态。
    api.rpc.handle('poll-commands', () => {
      const commands = pendingCommands;
      pendingCommands = [];
      return {
        commands,
        locked,
        visible: Boolean(win && !win.isDestroyed() && win.isVisible()),
      };
    });

    // client 入口回报自身是否就绪（便于排错）
    api.rpc.handle('client-ready', (info) => {
      debugLog('client 入口已就绪', info);
      return {
        ok: true,
        locked,
        visible: Boolean(win && !win.isDestroyed() && win.isVisible()),
        colors,
      };
    });

    // client 入口（Folia 界面里的锁按钮）→ 在这里切换歌词条状态：
    //   锁定时点一下 = 弹出控制条（解除穿透，可拖动、可点按钮、可调字号）
    //   未锁定时点一下 = 重新锁定（鼠标穿透，打游戏不会误触）
    api.rpc.handle('toggle-tools', () => {
      // 任务栏模式下点这个按钮 = 退出任务栏模式（回到普通胶囊）
      if (taskbarMode) {
        exitTaskbar(true);
        if (win && !win.isDestroyed()) win.showInactive();
        return { ok: true, locked, taskbar: false };
      }
      applyLock(!locked);
      if (win && !win.isDestroyed()) {
        win.showInactive();
        win.setBounds(clampToDisplay(win.getBounds()));
      }
      return { ok: true, locked };
    });

    // 设置歌词显示开关（设置面板最上面那一行）。
    api.rpc.handle('set-visible', (visible) => ({ ok: true, visible: setVisible(Boolean(visible)) }));

    // 设置全局快捷键开关。设置面板里的开关走 set-hotkeys。
    api.rpc.handle('set-hotkeys', (enabled) => {
      const next = Boolean(enabled);
      if (next === hotkeysEnabled) return { ok: true, hotkeys: hotkeysEnabled, failed: [] };
      hotkeysEnabled = next;
      let failed = [];
      if (hotkeysEnabled) failed = registerHotkeys().failed;
      else unregisterHotkeys();
      void api.storage.set('hotkeys', hotkeysEnabled)
        .catch((error) => logErr('保存快捷键设置失败', error));
      debugLog(`全局快捷键: ${hotkeysEnabled ? '开启' : '关闭'}`);
      return { ok: true, hotkeys: hotkeysEnabled, failed };
    });
    // 设置面板里录制的组合键：整体替换并立刻按新键位重新注册。
    api.rpc.handle('set-hotkey-bindings', (input) => {
      hotkeyBindings = normalizeHotkeyBindings(input);
      void api.storage.set('hotkeyBindings', hotkeyBindings)
        .catch((error) => logErr('保存快捷键组合失败', error));
      let failed = [];
      if (hotkeysEnabled) failed = registerHotkeys().failed;
      debugLog(`快捷键组合已更新: ${JSON.stringify(hotkeyBindings)}`);
      return { ok: true, bindings: hotkeyBindings, failed };
    });

    fontSize = await loadFontSize();
    await loadColors();
    await loadLyricOffsets();
    await loadFontFamily();
    await loadLineVisibility();

    await createWindow();
    // 启动途中可能已被停用：此时不能再注册快捷键和定时器，否则它们会残留。
    if (disposed) return;

    if (hotkeysEnabled) registerHotkeys();

    // 后台预热字体列表，并主动推给窗口：第一次打开设置时渲染层已有列表，下拉立即弹出。
    void getFontFamilies()
      .then((families) => {
        const list = Array.isArray(families) ? families : [];
        if (win && !win.isDestroyed()) {
          send('desktop-lyric:fonts', { families: list, current: lyricFont });
        }
      })
      .catch(() => {});

    startPoll();
    debugLog('桌面歌词已启动');
  };

  /** 注册全局快捷键。默认不开：这些组合键会抢走其他软件里的同名操作。 */
  const registerHotkeys = () => {
    unregisterHotkeys();
    const handlers = {
      lock: toggleLock,
      visible: toggleVisible,
    };
    const results = {};
    for (const action of HOTKEY_ACTIONS) {
      const accelerator = hotkeyBindings[action];
      if (!accelerator) continue;
      try {
        results[action] = globalShortcut.register(accelerator, handlers[action]);
        if (results[action]) registeredAccelerators.add(accelerator);
      } catch {
        results[action] = false;
      }
    }
    const failed = Object.keys(results)
      .filter((action) => !results[action])
      .map((action) => ({ action, accelerator: hotkeyBindings[action] }));
    debugLog(`快捷键注册: ${failed.length === 0 ? '全部成功' : `失败 ${failed.map((item) => `${item.action}=${item.accelerator}`).join('/')}`}`);
    return { ok: failed.length === 0, failed };
  };

  const unregisterHotkeys = () => {
    for (const accelerator of registeredAccelerators) {
      try { globalShortcut.unregister(accelerator); } catch { /* ignore */ }
    }
    registeredAccelerators.clear();
  };

  api.onDispose(() => {
    disposed = true;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (boundsSaveTimer) {
      clearTimeout(boundsSaveTimer);
      boundsSaveTimer = null;
    }
    if (fontSizeSaveTimer) {
      clearTimeout(fontSizeSaveTimer);
      fontSizeSaveTimer = null;
    }
    if (lyricOffsetSaveTimer) {
      clearTimeout(lyricOffsetSaveTimer);
      lyricOffsetSaveTimer = null;
      void api.storage.set('lyricOffsets', lyricOffsets).catch((error) => logErr('保存歌词偏移失败', error));
    }
    if (topmostTimer) {
      clearInterval(topmostTimer);
      topmostTimer = null;
    }
    stopHoverMonitor();
    stopDragPoll();
    try { ipcMain.removeListener('desktop-lyric:command', onWindowCommand); } catch { /* ignore */ }
    unregisterHotkeys();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.destroy();
    settingsWin = null;
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
    debugLog('桌面歌词已停止');
  });

  start().catch((error) => logErr('启动失败', error));

  return () => {};
};
