'use strict';

/**
 * cloud-lyric-float · 主进程入口
 *
 * 一个无边框、透明、置顶、跳过任务栏的桌面歌词窗口：
 *  - 主进程读取 Folia 播放快照并通过 IPC 推给窗口；
 *  - 窗口渲染当前句、译文、音译和逐字染色；
 *  - 播放控制只排队，由 client.mjs 调用 folium.playback 执行；
 *  - 位置、字号、颜色、模式、锁定状态都持久化。
 *
 * 本模组不加载外部网页，也不把任何资源写入模组目录。
 */

const fs = require('node:fs');
const path = require('node:path');

const POLL_MS = 80;
const SAVE_BOUNDS_DEBOUNCE_MS = 250;
const HOST_EMPTY_GRACE_MS = 320;
const MODE_IDS = ['single', 'double', 'multi'];
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const INTERLUDE_TEXT = '......';
const IPC_STATE = 'cloud-lyric:state';
const IPC_CONFIG = 'cloud-lyric:config';
const IPC_LOCKED = 'cloud-lyric:locked';
const IPC_LOCK_HOVER = 'cloud-lyric:lock-hover';
const IPC_OPEN_SETTINGS = 'cloud-lyric:open-settings';
const IPC_COMMAND = 'cloud-lyric:command';
const IPC_READY = 'cloud-lyric:ready';
const IPC_SETTINGS_CONFIG = 'cloud-lyric-settings:config';
const IPC_SETTINGS_COMMAND = 'cloud-lyric-settings:command';
const IPC_SETTINGS_READY = 'cloud-lyric-settings:ready';
const IPC_RESET_POSITION = 'cloud-lyric-float:reset-position';

const DEFAULT_CONFIG = Object.freeze({
  mode: 'double',
  fontSize: 46,
  textColor: '#ffffff',
  accentColor: '#ff4d4f',
  unsungColor: '#ffffff',
  unsungOpacity: 0.48,
  upcomingScale: 0.58,
  showTranslation: true,
  showRomanization: false,
  showMeta: true,
  alwaysOnTop: true,
  hotkeys: false,
  dragMode: 'left',
  locked: false,
  visible: true,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const safeText = (value) => (typeof value === 'string' ? value : '');

const normalizeColor = (value, fallback) => {
  const text = String(value || '').trim();
  return COLOR_RE.test(text) ? text.toLowerCase() : fallback;
};

const normalizeConfig = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fontSize = finite(Number(source.fontSize));
  const unsungOpacity = finite(Number(source.unsungOpacity));
  const upcomingScale = finite(Number(source.upcomingScale));
  return {
    mode: MODE_IDS.includes(source.mode) ? source.mode : DEFAULT_CONFIG.mode,
    fontSize: fontSize === null ? DEFAULT_CONFIG.fontSize : Math.round(clamp(fontSize, 16, 96)),
    textColor: normalizeColor(source.textColor, DEFAULT_CONFIG.textColor),
    accentColor: normalizeColor(source.accentColor, DEFAULT_CONFIG.accentColor),
    unsungColor: normalizeColor(source.unsungColor, DEFAULT_CONFIG.unsungColor),
    unsungOpacity: unsungOpacity === null ? DEFAULT_CONFIG.unsungOpacity : clamp(unsungOpacity, 0.1, 1),
    upcomingScale: upcomingScale === null ? DEFAULT_CONFIG.upcomingScale : clamp(upcomingScale, 0.3, 1),
    showTranslation: source.showTranslation !== false,
    showRomanization: source.showRomanization === true,
    showMeta: source.showMeta !== false,
    alwaysOnTop: source.alwaysOnTop !== false,
    hotkeys: source.hotkeys === true,
    dragMode: ['left', 'right-hold', 'both'].includes(source.dragMode) ? source.dragMode : DEFAULT_CONFIG.dragMode,
    locked: source.locked === true,
    visible: source.visible !== false,
  };
};

const heightForConfig = (config) => {
  const extra = (config.fontSize - DEFAULT_CONFIG.fontSize) * (config.mode === 'multi' ? 2.2 : 1.35);
  const translationExtra = config.showTranslation || config.showRomanization ? 18 : 0;
  if (config.mode === 'multi') return Math.round(clamp(358 + extra + translationExtra, 300, 520));
  if (config.mode === 'double') return Math.round(clamp(224 + extra + translationExtra, 190, 340));
  return Math.round(clamp(174 + extra + translationExtra, 150, 280));
};

const defaultWindowSize = () => ({ width: 720, height: heightForConfig(normalizeConfig(null)) });

const queue = (commands, command) => {
  if (!command) return;
  commands.push(command);
  if (commands.length > 24) commands.splice(0, commands.length - 24);
};

const readSong = (snapshot) => {
  const song = snapshot && snapshot.song && typeof snapshot.song === 'object' ? snapshot.song : {};
  const artists = Array.isArray(song.artists)
    ? song.artists.map((artist) => safeText(artist && (artist.name || artist.title))).filter(Boolean)
    : [];
  const title = safeText(song.title || song.name || song.songName);
  const artist = artists.length > 0 ? artists.join(' / ') : safeText(song.artist || song.artistsText);
  return {
    id: safeText(song.id || song.songId),
    title,
    artist,
    album: safeText(song.album || song.albumName),
  };
};

const normalizeLineText = (line) => {
  const text = safeText(line && (line.fullText || line.text || line.content)).trim();
  return text === INTERLUDE_TEXT ? '' : text;
};

const normalizeWords = (line, fallbackEnd) => {
  const list = line && Array.isArray(line.words) ? line.words : [];
  const words = [];
  for (const word of list) {
    if (!word || typeof word !== 'object') continue;
    const text = safeText(word.text || word.content || word.word);
    if (!text) continue;
    const startTime = finite(Number(word.startTime));
    const endTime = finite(Number(word.endTime));
    if (startTime === null) continue;
    words.push({
      text,
      startTime,
      endTime: endTime === null ? fallbackEnd : endTime,
    });
  }
  return words;
};

const buildPayload = (snapshot) => {
  const song = readSong(snapshot);
  const rawLines = snapshot && Array.isArray(snapshot.lines) ? snapshot.lines : [];
  const lines = [];

  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    const text = normalizeLineText(raw);
    if (!text) continue;
    const startTime = finite(Number(raw && raw.startTime));
    if (startTime === null) continue;
    const nextStart = (() => {
      for (let cursor = index + 1; cursor < rawLines.length; cursor += 1) {
        const next = finite(Number(rawLines[cursor] && rawLines[cursor].startTime));
        if (next !== null) return next;
      }
      return null;
    })();
    const endTime = finite(Number(raw && raw.endTime))
      ?? nextStart
      ?? startTime + 5;
    lines.push({
      text,
      translation: safeText(raw && raw.translation) || null,
      romanization: safeText(raw && (raw.romanization || raw.roman)) || null,
      startTime,
      endTime: Math.max(startTime + 0.05, endTime),
      words: normalizeWords(raw, Math.max(startTime + 0.05, endTime)),
    });
  }

  const position = Number(snapshot && snapshot.position) || 0;
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startTime <= position + 0.06) active = index;
    else break;
  }

  const from = active >= 0 ? Math.max(0, active - 3) : 0;
  const to = active >= 0 ? Math.min(lines.length, active + 4) : Math.min(lines.length, 7);
  const visibleLines = lines.slice(from, to);
  const activeIndex = active >= from && active < to ? active - from : -1;
  const hasSong = Boolean(song.title || song.artist || song.id);
  const state = safeText(snapshot && snapshot.state) || 'stopped';
  const hasLyrics = lines.length > 0;
  const status = !hasSong ? 'idle' : !hasLyrics ? 'no-lyrics' : active < 0 ? 'upcoming' : 'ready';

  return {
    version: 1,
    at: Date.now(),
    state,
    position,
    duration: Number(snapshot && snapshot.duration) || 0,
    song,
    status,
    activeIndex,
    lines: visibleLines,
    hasLyrics,
    canPlay: hasSong,
  };
};

module.exports = function activate(api) {
  const getElectron = () => {
    try {
      return require('electron');
    } catch (error) {
      api.log.error('[cloud-lyric-float] 无法加载 Electron', error);
      throw error;
    }
  };

  const { app, BrowserWindow, screen, ipcMain, globalShortcut, shell } = getElectron();
  const log = (message, extra) => api.log.info(`[cloud-lyric-float] ${message}`, extra);
  const logError = (message, error) => api.log.error(`[cloud-lyric-float] ${message}`, error);

  let dragLogFile = null;
  try {
    const dataDir = api.storage && api.storage.paths && api.storage.paths.data;
    if (dataDir) {
      fs.mkdirSync(dataDir, { recursive: true });
      dragLogFile = path.join(dataDir, 'cloud-lyric-float.log');
      try {
        if (fs.statSync(dragLogFile).size > 1024 * 1024) fs.writeFileSync(dragLogFile, '', 'utf8');
      } catch { /* 首次写入 */ }
    }
  } catch (error) {
    logError('初始化拖动日志失败', error);
  }

  const dragLog = (event, data = {}) => {
    const entry = {
      time: new Date().toISOString(),
      event,
      data,
    };
    try {
      log(`[drag] ${event}`, data);
    } catch { /* ignore */ }
    if (!dragLogFile) return;
    try {
      fs.appendFileSync(dragLogFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch { /* 日志失败不影响拖动 */ }
  };
  if (dragLogFile) log(`拖动日志文件: ${dragLogFile}`);

  let win = null;
  let settingsWin = null;
  let disposed = false;
  let creatingWidget = false;
  let creatingSettings = false;
  let settingsBoundsSaveTimer = null;
  let settingsDragOrigin = null;
  let settingsWindowOrigin = null;
  let pollTimer = null;
  let topmostTimer = null;
  let boundsSaveTimer = null;
  let layoutTimer = null;
  let hostEmptyTimer = null;
  let lastState = null;
  let lastStateKey = '';
  let config = normalizeConfig(null);
  let persistedBounds = null;
  let persistedSettingsBounds = null;
  let dragOrigin = null;
  let dragArmed = false;
  let dragWindowOrigin = null;
  let dragWindowSize = null;
  let dragInterval = null;
  let pendingMeasuredLayout = null;
  let lastDragLogAt = 0;
  let lockHover = false;
  let lockPollTimer = null;
  let lastLockHoverState = null;
  let interactiveRegions = { unlock: null, lyrics: [] };
  let pendingCommands = [];
  const hostWindows = new Set();

  const isAlive = (browserWindow) => Boolean(browserWindow && !browserWindow.isDestroyed());

  const send = (channel, payload) => {
    if (!isAlive(win)) return false;
    try {
      win.webContents.send(channel, payload);
      return true;
    } catch (error) {
      logError(`发送 ${channel} 失败`, error);
      return false;
    }
  };

  const saveConfig = () => {
    try {
      void api.storage.set('config', config).catch((error) => logError('保存配置失败', error));
    } catch (error) {
      logError('保存配置失败', error);
    }
  };

  const saveBounds = () => {
    if (!isAlive(win)) return;
    if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      boundsSaveTimer = null;
      if (!isAlive(win)) return;
      const bounds = win.getBounds();
      persistedBounds = { x: bounds.x, y: bounds.y };
      try {
        void api.storage.set('bounds', persistedBounds).catch((error) => logError('保存窗口位置失败', error));
      } catch (error) {
        logError('保存窗口位置失败', error);
      }
    }, SAVE_BOUNDS_DEBOUNCE_MS);
  };

  const displayForPoint = (x, y) => {
    try {
      return screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
    } catch {
      return screen.getPrimaryDisplay();
    }
  };

  const clampBounds = (bounds) => {
    const width = Math.min(1400, Math.max(260, Number(bounds.width) || 720));
    const height = Math.max(140, Number(bounds.height) || heightForConfig(config));
    const rawX = Number(bounds.x);
    const rawY = Number(bounds.y);
    const centerX = (Number.isFinite(rawX) ? rawX : 0) + width / 2;
    const centerY = (Number.isFinite(rawY) ? rawY : 0) + height / 2;
    const display = displayForPoint(centerX, centerY);
    const area = display.workArea;
    const margin = 4;
    const minX = area.x + margin;
    const minY = area.y + margin;
    const maxX = Math.max(minX, area.x + area.width - width - margin);
    const maxY = Math.max(minY, area.y + area.height - height - margin);
    return {
      x: Math.round(clamp(Number.isFinite(rawX) ? rawX : area.x + (area.width - width) / 2, minX, maxX)),
      y: Math.round(clamp(Number.isFinite(rawY) ? rawY : area.y + area.height - height - 64, minY, maxY)),
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  const defaultBounds = () => {
    const area = screen.getPrimaryDisplay().workArea;
    const { width, height } = defaultWindowSize();
    return {
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + area.height - height - 64),
      width,
      height,
    };
  };

  const resolveBounds = () => {
    if (persistedBounds && Number.isFinite(persistedBounds.x) && Number.isFinite(persistedBounds.y)) {
      return clampBounds({
        x: persistedBounds.x,
        y: persistedBounds.y,
        width: 720,
        height: heightForConfig(config),
      });
    }
    return clampBounds(defaultBounds());
  };

  const applyAlwaysOnTop = () => {
    if (!isAlive(win)) return;
    try {
      win.setAlwaysOnTop(config.alwaysOnTop, config.alwaysOnTop ? 'screen-saver' : 'normal');
      win.setVisibleOnAllWorkspaces(config.alwaysOnTop, { visibleOnFullScreen: true });
    } catch (error) {
      logError('设置窗口置顶失败', error);
    }
  };

  const pointInRegion = (x, y, rect, margin = 3) => Boolean(
    rect
    && x >= rect.x - margin
    && x <= rect.x + rect.width + margin
    && y >= rect.y - margin
    && y <= rect.y + rect.height + margin
  );

  const emitLockHover = (inside, overLyrics, overUnlock) => {
    const key = JSON.stringify({ inside, overLyrics, overUnlock });
    if (key === lastLockHoverState) return;
    lastLockHoverState = key;
    lockHover = inside;
    send(IPC_LOCK_HOVER, { inside, overLyrics, overUnlock });
    dragLog('main:lock-hover', { inside, overLyrics, overUnlock });
  };

  const updateLockPassthrough = () => {
    if (!isAlive(win) || !config.locked) return;
    const point = readCursorPoint();
    if (!point) return;
    const bounds = win.getBounds();
    const localX = point.x - bounds.x;
    const localY = point.y - bounds.y;
    const overUnlock = pointInRegion(localX, localY, interactiveRegions.unlock, 5);
    const overLyrics = interactiveRegions.lyrics.some((rect) => pointInRegion(localX, localY, rect, 7));
    const interactive = overUnlock || overLyrics;
    try {
      win.setIgnoreMouseEvents(!interactive, { forward: true });
    } catch (error) {
      logError('更新歌词解锁悬停穿透失败', error);
    }
    emitLockHover(interactive, overLyrics, overUnlock);
  };

  const stopLockPoll = () => {
    if (lockPollTimer) clearInterval(lockPollTimer);
    lockPollTimer = null;
  };

  const startLockPoll = () => {
    stopLockPoll();
    if (!config.locked) return;
    lockPollTimer = setInterval(updateLockPassthrough, 50);
    updateLockPassthrough();
  };

  const applyLock = () => {
    if (!isAlive(win)) return;
    lockHover = false;
    lastLockHoverState = null;
    stopLockPoll();
    try {
      win.setIgnoreMouseEvents(config.locked, { forward: true });
    } catch (error) {
      logError('设置鼠标穿透失败', error);
    }
    send(IPC_LOCKED, { locked: config.locked });
    if (config.locked) {
      startLockPoll();
    } else {
      send(IPC_LOCK_HOVER, { inside: false, overLyrics: false, overUnlock: false });
    }
  };

  const applyWindowShape = (previous = null) => {
    if (!isAlive(win)) return;
    const current = win.getBounds();
    const nextHeight = heightForConfig(config);
    if (current.height === nextHeight) return;
    const bottom = current.y + current.height;
    const next = clampBounds({
      x: current.x,
      y: bottom - nextHeight,
      width: current.width,
      height: nextHeight,
    });
    dragLog('main:shape-apply', { from: current, to: next, mode: config.mode, fontSize: config.fontSize });
    win.setBounds(next);
  };

  const readCursorPoint = () => {
    try {
      if (typeof screen.getCursorScreenPoint !== 'function') return null;
      const point = screen.getCursorScreenPoint();
      const x = Number(point && point.x);
      const y = Number(point && point.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    } catch {
      return null;
    }
  };

  const armPointerDrag = (payload) => {
    dragArmed = true;
    dragWindowSize = isAlive(win) ? win.getBounds() : null;
    pendingMeasuredLayout = null;
    if (layoutTimer) {
      clearTimeout(layoutTimer);
      layoutTimer = null;
    }
    dragLog('main:drag-arm', { payload, window: dragWindowSize, frozenSize: dragWindowSize });
  };

  const disarmPointerDrag = () => {
    if (!dragArmed || dragOrigin) return;
    dragArmed = false;
    dragLog('main:drag-disarm', {
      window: isAlive(win) ? win.getBounds() : null,
      discardedLayout: pendingMeasuredLayout,
    });
    dragWindowSize = null;
    // 单纯长按后松开也不立即改尺寸，避免歌词在鼠标松开时跳动。
    pendingMeasuredLayout = null;
  };

  const movePointerDrag = (fallbackPoint = null) => {
    if (!isAlive(win) || !dragOrigin || !dragWindowOrigin) return;
    const point = readCursorPoint() || fallbackPoint;
    const x = Number(point && point.x);
    const y = Number(point && point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const nextX = Math.round(dragWindowOrigin.x + (x - dragOrigin.x));
    const nextY = Math.round(dragWindowOrigin.y + (y - dragOrigin.y));
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;

    const bounds = win.getBounds();
    const frozen = dragWindowSize || { width: bounds.width, height: bounds.height };
    const safe = clampBounds({
      x: nextX,
      y: nextY,
      width: frozen.width,
      height: frozen.height,
    });
    if (bounds.x === safe.x && bounds.y === safe.y
      && bounds.width === frozen.width && bounds.height === frozen.height) return;

    if (Date.now() - lastDragLogAt >= 120) {
      lastDragLogAt = Date.now();
      dragLog('main:drag-move', {
        cursor: { x, y },
        from: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        to: { x: safe.x, y: safe.y, width: frozen.width, height: frozen.height },
        frozenSize: frozen,
      });
    }

    try {
      // 拖动全过程强行写回冻结宽高，外部布局即使误改大小也会被下一帧恢复。
      win.setBounds({
        x: safe.x,
        y: safe.y,
        width: frozen.width,
        height: frozen.height,
      });
    } catch (error) {
      logError('拖动窗口失败，已忽略本次坐标', error);
      if (dragInterval) clearInterval(dragInterval);
      dragInterval = null;
      dragOrigin = null;
      dragWindowOrigin = null;
      dragWindowSize = null;
    }
  };

  const beginPointerDrag = (payload) => {
    if (!isAlive(win) || !payload) return;
    const cursor = readCursorPoint();
    const fallbackX = Number(payload.x);
    const fallbackY = Number(payload.y);
    const startPoint = cursor || (
      Number.isFinite(fallbackX) && Number.isFinite(fallbackY)
        ? { x: fallbackX, y: fallbackY }
        : null
    );
    if (!startPoint) return;

    const bounds = win.getBounds();
    const windowX = Number(bounds && bounds.x);
    const windowY = Number(bounds && bounds.y);
    if (!Number.isFinite(windowX) || !Number.isFinite(windowY)) return;
    if (!dragWindowSize) {
      dragWindowSize = { width: bounds.width, height: bounds.height };
    }
    if (dragInterval) clearInterval(dragInterval);
    dragOrigin = startPoint;
    dragWindowOrigin = { x: windowX, y: windowY };
    dragLog('main:drag-start', {
      cursor: startPoint,
      window: { x: windowX, y: windowY },
      frozenSize: dragWindowSize,
      payload,
    });
    dragInterval = setInterval(() => movePointerDrag(), 16);
  };

  const endPointerDrag = (reason = 'unknown') => {
    dragArmed = false;
    if (dragInterval) clearInterval(dragInterval);
    dragInterval = null;
    dragOrigin = null;

    if (isAlive(win) && dragWindowSize) {
      const bounds = win.getBounds();
      try {
        win.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: dragWindowSize.width,
          height: dragWindowSize.height,
        });
      } catch (error) {
        logError('恢复拖动冻结尺寸失败', error);
      }
    }

    dragLog('main:drag-end', {
      reason,
      cursor: readCursorPoint(),
      window: isAlive(win) ? win.getBounds() : null,
      frozenSize: dragWindowSize,
      discardedLayout: pendingMeasuredLayout,
    });
    dragWindowOrigin = null;
    dragWindowSize = null;
    pendingMeasuredLayout = null;
    saveBounds();
  };
  const scheduleMeasuredLayout = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const width = Math.round(Number(payload.width));
    const height = Math.round(Number(payload.height));
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    dragLog('main:layout-request', {
      width,
      height,
      dragArmed,
      dragging: Boolean(dragOrigin),
      current: isAlive(win) ? win.getBounds() : null,
    });
    // 拖动期间冻结自动缩放，否则换句时窗口高度变化会让歌词上下跳。
    if (dragArmed || dragOrigin) {
      pendingMeasuredLayout = { width, height };
      return;
    }
    if (layoutTimer) clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      layoutTimer = null;
      if (!isAlive(win) || disposed) return;
      const current = win.getBounds();
      const nextWidth = Math.round(clamp(width, 300, 1400));
      const nextHeight = Math.round(clamp(height, 140, 520));
      if (Math.abs(current.width - nextWidth) < 2 && Math.abs(current.height - nextHeight) < 2) return;
      // 宽度变化时保持中心，高度变化时保持底边，视觉上不会跳。
      const next = clampBounds({
        x: current.x + (current.width - nextWidth) / 2,
        y: current.y + current.height - nextHeight,
        width: nextWidth,
        height: nextHeight,
      });
      dragLog('main:layout-apply', { from: current, to: next });
      win.setBounds(next);
      saveBounds();
    }, 32);
  };

  const pushConfig = () => {
    send(IPC_CONFIG, config);
    if (isAlive(settingsWin)) {
      try { settingsWin.webContents.send(IPC_SETTINGS_CONFIG, config); } catch (error) { logError('发送设置窗配置失败', error); }
    }
  };

  const pushState = (force = false) => {
    if (!lastState) return;
    const key = JSON.stringify(lastState);
    if (!force && key === lastStateKey) return;
    lastStateKey = key;
    if (!config.visible) return;
    send(IPC_STATE, lastState);
  };

  const requestState = () => {
    if (!lastState) {
      let snapshot = null;
      try {
        snapshot = typeof api.runtime?.getPlaybackSnapshot === 'function'
          ? api.runtime.getPlaybackSnapshot()
          : null;
      } catch (error) {
        logError('读取播放快照失败', error);
      }
      lastState = buildPayload(snapshot);
    }
    pushState(true);
  };

  const showWidget = (unlock = false) => {
    if (!isAlive(win)) return;
    config.visible = true;
    if (unlock) config.locked = false;
    if (!config.locked) {
      try {
        win.setIgnoreMouseEvents(false);
      } catch { /* ignore */ }
    }
    win.showInactive();
    try {
      win.moveTop();
    } catch { /* ignore */ }
    applyLock();
    saveConfig();
    pushConfig();
    requestState();
  };

  const focusHostApp = () => {
    const candidates = [...hostWindows].filter((candidate) => isAlive(candidate));
    const target = candidates.find((candidate) => candidate.isVisible())
      || BrowserWindow.getAllWindows().find((candidate) => candidate !== win && candidate !== settingsWin && isAlive(candidate));
    if (!target) {
      dragLog('main:focus-app', { ok: false, reason: 'no-host-window' });
      return false;
    }
    try {
      if (typeof target.isMinimized === 'function' && target.isMinimized()) target.restore();
      target.show();
      target.focus();
      dragLog('main:focus-app', { ok: true, window: target.getBounds() });
      return true;
    } catch (error) {
      logError('切回 Folia 主窗口失败', error);
      return false;
    }
  };

  const hideWidget = () => {
    config.visible = false;
    if (isAlive(win)) win.hide();
    saveConfig();
  };

  const widgetState = () => ({
    visible: Boolean(config.visible && isAlive(win) && win.isVisible()),
    locked: config.locked,
    hotkeys: config.hotkeys,
  });

  const applyConfig = (patch, options = {}) => {
    const previous = config;
    config = normalizeConfig({ ...config, ...(patch && typeof patch === 'object' ? patch : {}) });
    dragLog('main:config-apply', {
      previousFontSize: previous.fontSize,
      fontSize: config.fontSize,
      patchFontSize: patch && patch.fontSize,
      source: options && options.source ? options.source : 'unknown',
    });
    if (previous.mode !== config.mode || previous.fontSize !== config.fontSize
      || previous.showTranslation !== config.showTranslation
      || previous.showRomanization !== config.showRomanization) {
      applyWindowShape(previous);
    }
    if (previous.alwaysOnTop !== config.alwaysOnTop) applyAlwaysOnTop();
    if (previous.locked !== config.locked) applyLock();
    if (previous.hotkeys !== config.hotkeys) {
      if (config.hotkeys) registerHotkeys();
      else unregisterHotkeys();
    }
    pushConfig();
    if (options.persist !== false) saveConfig();
    if (options.showSettings) {
      showWidget(true);
      send(IPC_OPEN_SETTINGS, true);
    }
    return config;
  };

  const toggleWidget = () => {
    if (!config.visible) {
      showWidget(true);
      return widgetState();
    }
    if (config.locked) {
      applyConfig({ locked: false });
      showWidget(false);
      return widgetState();
    }
    hideWidget();
    return widgetState();
  };

  const openSettings = () => {
    void openSettingsWindow().catch((error) => logError('打开设置窗口失败', error));
  };

  const resetPosition = () => {
    if (!isAlive(win)) return;
    const current = win.getBounds();
    const display = displayForPoint(current.x + current.width / 2, current.y + current.height / 2);
    const area = display.workArea;
    const next = clampBounds({
      x: area.x + (area.width - current.width) / 2,
      y: area.y + (area.height - current.height) / 2,
      width: current.width,
      height: current.height,
    });
    win.setBounds(next);
    config.visible = true;
    if (!config.locked) win.setIgnoreMouseEvents(false);
    win.showInactive();
    persistedBounds = { x: next.x, y: next.y };
    saveBounds();
    send(IPC_RESET_POSITION, { centered: true });
    pushConfig();
    dragLog('main:reset-position', { window: next });
  };

  const registerHotkeys = () => {
    unregisterHotkeys();
    if (!config.hotkeys || disposed) return;
    const bindings = {
      'CommandOrControl+Shift+H': () => toggleWidget(),
      'CommandOrControl+Shift+L': () => applyConfig({ locked: !config.locked }),
      'CommandOrControl+Shift+Left': () => queue(pendingCommands, 'prev'),
      'CommandOrControl+Shift+Right': () => queue(pendingCommands, 'next'),
      'CommandOrControl+Shift+Space': () => queue(pendingCommands, 'toggle'),
    };
    for (const [accelerator, handler] of Object.entries(bindings)) {
      try {
        if (!globalShortcut.register(accelerator, handler)) {
          log(`快捷键注册失败: ${accelerator}`);
        }
      } catch (error) {
        logError(`注册快捷键失败: ${accelerator}`, error);
      }
    }
  };

  const unregisterHotkeys = () => {
    for (const accelerator of [
      'CommandOrControl+Shift+H',
      'CommandOrControl+Shift+L',
      'CommandOrControl+Shift+Left',
      'CommandOrControl+Shift+Right',
      'CommandOrControl+Shift+Space',
    ]) {
      try { globalShortcut.unregister(accelerator); } catch { /* ignore */ }
    }
  };

  const onWindowCommand = (event, name, payload) => {
    if (!isAlive(win) || event.sender !== win.webContents) return;
    const command = safeText(name);
    try {
      switch (command) {
      case 'playback': {
        const action = safeText(payload && payload.action);
        if (['next', 'prev', 'toggle'].includes(action)) queue(pendingCommands, action);
        break;
      }
      case 'config':
        applyConfig(payload);
        break;
      case 'layout':
        scheduleMeasuredLayout(payload);
        break;
      case 'drag-arm':
        armPointerDrag(payload);
        break;
      case 'drag-disarm':
        disarmPointerDrag();
        break;
      case 'drag-start':
        beginPointerDrag(payload);
        break;
      case 'drag-move':
        movePointerDrag(payload);
        break;
      case 'drag-end':
        endPointerDrag('renderer');
        break;
      case 'log':
        dragLog('renderer:' + safeText(payload && payload.message), (payload && payload.data) || {});
        break;
      case 'lock':
        applyConfig({ locked: true });
        break;
      case 'regions': {
        const region = (value) => {
          if (!value) return null;
          const x = Number(value.x);
          const y = Number(value.y);
          const width = Number(value.width);
          const height = Number(value.height);
          return [x, y, width, height].every(Number.isFinite) ? { x, y, width, height } : null;
        };
        interactiveRegions = {
          unlock: region(payload && payload.unlockRect),
          lyrics: Array.isArray(payload && payload.lyricRects)
            ? payload.lyricRects.map(region).filter(Boolean)
            : [],
        };
        if (config.locked) updateLockPassthrough();
        break;
      }
      case 'unlock':
        applyConfig({ locked: false });
        break;
      case 'toggle-lock':
        applyConfig({ locked: !config.locked });
        break;
      case 'hide':
        hideWidget();
        break;
      case 'focus-app':
        focusHostApp();
        break;
      case 'open-settings':
        openSettings();
        break;
      case 'show':
        showWidget(false);
        break;
      case 'reset-position':
        resetPosition();
        break;
      case 'request-state':
        requestState();
        break;
      case 'ready':
        pushConfig();
        applyLock();
        requestState();
        break;
        default:
          log(`未知窗口指令: ${command}`);
      }
    } catch (error) {
      // IPC 回调里未捕获的异常会升级成 Electron uncaughtException 并终止 Folia，
      // 这里兜住所有窗口指令，坏数据只丢一帧，不让宿主崩溃。
      dragOrigin = null;
      dragWindowOrigin = null;
      logError(`处理窗口指令失败: ${command}`, error);
    }
  };

  const onReadyFromWindow = (event) => {
    if (!isAlive(win) || event.sender !== win.webContents) return;
    pushConfig();
    applyLock();
    requestState();
  };

  const clampSettingsBounds = (bounds) => {
    const width = Math.min(390, Math.max(320, Number(bounds.width) || 390));
    const height = Math.min(590, Math.max(420, Number(bounds.height) || 590));
    const display = displayForPoint(Number(bounds.x) || 0, Number(bounds.y) || 0);
    const area = display.workArea;
    const margin = 8;
    const minX = area.x + margin;
    const minY = area.y + margin;
    const maxX = Math.max(minX, area.x + area.width - width - margin);
    const maxY = Math.max(minY, area.y + area.height - height - margin);
    return {
      x: Math.round(clamp(Number(bounds.x) || area.x + (area.width - width) / 2, minX, maxX)),
      y: Math.round(clamp(Number(bounds.y) || area.y + (area.height - height) / 2, minY, maxY)),
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  const defaultSettingsBounds = () => {
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(390, Math.max(320, area.width - 16));
    const height = Math.min(590, Math.max(420, area.height - 16));
    let x = area.x + (area.width - width) / 2;
    let y = area.y + (area.height - height) / 2;
    if (isAlive(win)) {
      const lyrics = win.getBounds();
      x = lyrics.x + lyrics.width + 12;
      y = lyrics.y;
    }
    return clampSettingsBounds({ x, y, width, height });
  };

  const saveSettingsBounds = () => {
    if (!isAlive(settingsWin)) return;
    if (settingsBoundsSaveTimer) clearTimeout(settingsBoundsSaveTimer);
    settingsBoundsSaveTimer = setTimeout(() => {
      settingsBoundsSaveTimer = null;
      if (!isAlive(settingsWin)) return;
      const bounds = settingsWin.getBounds();
      persistedSettingsBounds = { x: bounds.x, y: bounds.y };
      try {
        void api.storage.set('settingsBounds', persistedSettingsBounds)
          .catch((error) => logError('保存设置窗位置失败', error));
      } catch (error) {
        logError('保存设置窗位置失败', error);
      }
    }, 250);
  };

  const beginSettingsDrag = (payload) => {
    if (!isAlive(settingsWin)) return;
    const point = readCursorPoint() || {
      x: Number(payload && payload.x),
      y: Number(payload && payload.y),
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const bounds = settingsWin.getBounds();
    settingsDragOrigin = point;
    settingsWindowOrigin = { x: bounds.x, y: bounds.y };
  };

  const moveSettingsDrag = (payload) => {
    if (!isAlive(settingsWin) || !settingsDragOrigin || !settingsWindowOrigin) return;
    const point = readCursorPoint() || {
      x: Number(payload && payload.x),
      y: Number(payload && payload.y),
    };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const bounds = settingsWin.getBounds();
    const next = clampSettingsBounds({
      x: settingsWindowOrigin.x + point.x - settingsDragOrigin.x,
      y: settingsWindowOrigin.y + point.y - settingsDragOrigin.y,
      width: bounds.width,
      height: bounds.height,
    });
    try { settingsWin.setBounds(next); } catch (error) { logError('拖动设置窗失败', error); }
  };

  const endSettingsDrag = () => {
    settingsDragOrigin = null;
    settingsWindowOrigin = null;
    saveSettingsBounds();
  };

  const onSettingsCommand = (event, name, payload) => {
    if (!isAlive(settingsWin) || event.sender !== settingsWin.webContents) return;
    const command = safeText(name);
    try {
      switch (command) {
        case 'config':
          applyConfig(payload);
          break;
        case 'close':
          hideSettingsWindow();
          break;
        case 'drag-start':
          beginSettingsDrag(payload);
          break;
        case 'drag-move':
          moveSettingsDrag(payload);
          break;
        case 'drag-end':
          endSettingsDrag();
          break;
        case 'reset-position':
          resetPosition();
          break;
        case 'lock':
          applyConfig({ locked: true });
          break;
        case 'unlock':
          applyConfig({ locked: false });
          break;
        case 'open-log':
          if (dragLogFile) {
            try { fs.appendFileSync(dragLogFile, '', 'utf8'); } catch { /* ignore */ }
            void shell.openPath(dragLogFile).catch((error) => logError('打开拖动日志失败', error));
          }
          break;
        case 'clear-log':
          if (dragLogFile) {
            try {
              fs.writeFileSync(dragLogFile, '', 'utf8');
              log('诊断日志已清除');
            } catch (error) {
              logError('清除诊断日志失败', error);
            }
          }
          break;
        case 'ready':
          if (isAlive(settingsWin)) settingsWin.webContents.send(IPC_SETTINGS_CONFIG, config);
          break;
        default:
          log('未知设置窗指令: ' + command);
      }
    } catch (error) {
      logError('处理设置窗指令失败: ' + command, error);
    }
  };

  const onSettingsReady = (event) => {
    if (!isAlive(settingsWin) || event.sender !== settingsWin.webContents) return;
    settingsWin.webContents.send(IPC_SETTINGS_CONFIG, config);
  };

  async function createSettingsWindow() {
    if (disposed || isAlive(settingsWin)) return settingsWin;
    try {
      persistedSettingsBounds = await api.storage.get('settingsBounds');
    } catch (error) {
      logError('读取设置窗位置失败', error);
    }
    if (disposed) return null;
    const bounds = persistedSettingsBounds
      ? clampSettingsBounds({ ...persistedSettingsBounds, width: 390, height: 590 })
      : defaultSettingsBounds();
    creatingSettings = true;
    try {
      settingsWin = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        acceptFirstMouse: true,
        show: false,
        title: '歌词外观设置',
        webPreferences: {
          preload: path.join(__dirname, 'settings-preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          backgroundThrottling: false,
          webSecurity: true,
        },
      });
    } finally {
      creatingSettings = false;
    }
    try {
      settingsWin.setAlwaysOnTop(true, 'screen-saver');
      settingsWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      settingsWin.setMenuBarVisibility(false);
    } catch (error) {
      logError('设置设置窗置顶失败', error);
    }
    settingsWin.once('ready-to-show', () => {
      if (isAlive(settingsWin)) {
        settingsWin.webContents.send(IPC_SETTINGS_CONFIG, config);
        settingsWin.showInactive();
      }
    });
    settingsWin.on('moved', saveSettingsBounds);
    settingsWin.on('close', (event) => {
      if (disposed || !isAlive(settingsWin)) return;
      event.preventDefault();
      settingsWin.hide();
    });
    settingsWin.on('closed', () => { settingsWin = null; });
    settingsWin.webContents.on('did-finish-load', () => {
      if (isAlive(settingsWin)) settingsWin.webContents.send(IPC_SETTINGS_CONFIG, config);
    });
    await settingsWin.loadFile(path.join(__dirname, 'settings.html'));
    return settingsWin;
  }

  async function openSettingsWindow() {
    let target = settingsWin;
    if (!isAlive(target)) target = await createSettingsWindow();
    if (!isAlive(target) || disposed) return false;
    try {
      target.webContents.send(IPC_SETTINGS_CONFIG, config);
      target.show();
      target.focus();
      dragLog('main:settings-open', { window: target.getBounds() });
      return true;
    } catch (error) {
      logError('显示设置窗失败', error);
      return false;
    }
  }

  function hideSettingsWindow() {
    if (isAlive(settingsWin)) settingsWin.hide();
  }

  const createWindow = async () => {
    if (disposed || isAlive(win)) return;
    const bounds = resolveBounds();
    creatingWidget = true;
    try {
      win = new BrowserWindow({
        ...bounds,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        resizable: false,
        movable: true,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: config.alwaysOnTop,
        acceptFirstMouse: true,
        show: false,
        title: '云风桌面歌词',
        webPreferences: {
          preload: path.join(__dirname, 'preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          backgroundThrottling: false,
          webSecurity: true,
        },
      });
    } finally {
      creatingWidget = false;
    }

    applyAlwaysOnTop();
    win.setMenuBarVisibility(false);
    win.setMinimumSize(260, 140);

    win.once('ready-to-show', () => {
      if (!isAlive(win)) return;
      pushConfig();
      applyLock();
      requestState();
      if (config.visible) win.showInactive();
    });

    win.on('moved', saveBounds);
    win.on('resize', () => {
      dragLog('main:window-resize', {
        dragging: Boolean(dragOrigin),
        dragArmed,
        window: isAlive(win) ? win.getBounds() : null,
      });
    });
    win.on('close', (event) => {
      if (disposed || !isAlive(win)) return;
      event.preventDefault();
      hideWidget();
    });
    win.on('closed', () => {
      win = null;
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      logError('歌词窗口渲染进程退出', details);
      if (!disposed && isAlive(win)) {
        try { win.reload(); } catch { /* ignore */ }
      }
    });

    await win.loadFile(path.join(__dirname, 'overlay.html'));
    log('悬浮歌词窗口已创建');
  };

  const trackHostWindow = (browserWindow) => {
    if (!browserWindow || browserWindow === win || browserWindow === settingsWin || browserWindow.isDestroyed()) return;
    if (hostWindows.has(browserWindow)) return;
    hostWindows.add(browserWindow);
    browserWindow.once('closed', () => {
      hostWindows.delete(browserWindow);
      scheduleHostEmptyCheck();
    });
  };

  const collectHostWindows = () => {
    for (const browserWindow of BrowserWindow.getAllWindows()) trackHostWindow(browserWindow);
  };

  const scheduleHostEmptyCheck = () => {
    if (disposed) return;
    if (hostEmptyTimer) clearTimeout(hostEmptyTimer);
    hostEmptyTimer = setTimeout(() => {
      hostEmptyTimer = null;
      collectHostWindows();
      if (hostWindows.size > 0) return;
      if (!isAlive(win) && !isAlive(settingsWin)) return;
      // 悬浮歌词和设置窗都会阻止 window-all-closed，宿主关闭时一起销毁。
      log('宿主窗口已全部关闭，关闭悬浮歌词与设置窗口');
      if (isAlive(settingsWin)) settingsWin.destroy();
      if (isAlive(win)) win.destroy();
    }, HOST_EMPTY_GRACE_MS);
  };

  const onBrowserWindowCreated = (_event, browserWindow) => {
    if (creatingWidget || creatingSettings || browserWindow === win || browserWindow === settingsWin) return;
    trackHostWindow(browserWindow);
    if (!isAlive(win) && !disposed) {
      setTimeout(() => {
        if (!disposed && !isAlive(win) && hostWindows.size > 0) {
          void createWindow().catch((error) => logError('重建歌词窗口失败', error));
        }
      }, 120);
    }
  };

  const tick = () => {
    if (disposed) return;
    let snapshot = null;
    try {
      snapshot = typeof api.runtime?.getPlaybackSnapshot === 'function'
        ? api.runtime.getPlaybackSnapshot()
        : null;
    } catch (error) {
      logError('读取播放快照失败', error);
    }
    lastState = buildPayload(snapshot);
    pushState();
  };

  const registerRpc = () => {
    if (!api.rpc || typeof api.rpc.handle !== 'function') {
      log('当前 Folium 不支持 api.rpc.handle，窗口控制入口不可用');
      return;
    }
    api.rpc.handle('poll-commands', () => {
      const commands = pendingCommands;
      pendingCommands = [];
      return { ...widgetState(), commands };
    });
    api.rpc.handle('widget-toggle', () => toggleWidget());
    api.rpc.handle('widget-unlock', () => {
      showWidget(true);
      return widgetState();
    });
    api.rpc.handle('open-settings', () => {
      openSettings();
      return widgetState();
    });
    api.rpc.handle('reset-position', () => {
      resetPosition();
      showWidget(true);
      return widgetState();
    });
    api.rpc.handle('open-log', async () => {
      try {
        if (dragLogFile) fs.appendFileSync(dragLogFile, '', 'utf8');
        const pathToOpen = dragLogFile;
        if (!pathToOpen) return { ok: false, error: 'log-file-unavailable' };
        const error = await shell.openPath(pathToOpen);
        return { ok: !error, path: pathToOpen, error: error || null };
      } catch (error) {
        logError('打开拖动日志失败', error);
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
    });
    api.rpc.handle('client-log', (message) => {
      log(`[client] ${String(message)}`);
      return widgetState();
    });
  };

  const start = async () => {
    try {
      const savedConfig = await api.storage.get('config');
      config = normalizeConfig(savedConfig);
    } catch (error) {
      logError('读取配置失败', error);
    }
    try {
      const savedBounds = await api.storage.get('bounds');
      if (savedBounds && typeof savedBounds === 'object') persistedBounds = savedBounds;
    } catch (error) {
      logError('读取窗口位置失败', error);
    }
    if (disposed) return;

    registerRpc();
    ipcMain.on(IPC_COMMAND, onWindowCommand);
    ipcMain.on(IPC_READY, onReadyFromWindow);
    ipcMain.on(IPC_SETTINGS_COMMAND, onSettingsCommand);
    ipcMain.on(IPC_SETTINGS_READY, onSettingsReady);
    app.on('browser-window-created', onBrowserWindowCreated);

    await createWindow();
    if (disposed) return;

    collectHostWindows();
    try {
      dragLog('main:displays', {
        displays: screen.getAllDisplays().map((display) => ({
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
        })),
      });
    } catch (error) {
      logError('记录显示器信息失败', error);
    }
    if (config.hotkeys) registerHotkeys();
    pollTimer = setInterval(tick, POLL_MS);
    topmostTimer = setInterval(() => {
      if (config.alwaysOnTop && config.visible && isAlive(win)) applyAlwaysOnTop();
    }, 3000);
    tick();
    log('模组已启动');
  };

  api.onDispose(() => {
    disposed = true;
    if (pollTimer) clearInterval(pollTimer);
    if (topmostTimer) clearInterval(topmostTimer);
    if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
    if (settingsBoundsSaveTimer) clearTimeout(settingsBoundsSaveTimer);
    if (layoutTimer) clearTimeout(layoutTimer);
    stopLockPoll();
    if (dragInterval) clearInterval(dragInterval);
    if (hostEmptyTimer) clearTimeout(hostEmptyTimer);
    pollTimer = null;
    topmostTimer = null;
    boundsSaveTimer = null;
    settingsBoundsSaveTimer = null;
    layoutTimer = null;
    lockHover = false;
    lastLockHoverState = null;
    interactiveRegions = { unlock: null, lyrics: [] };
    dragInterval = null;
    pendingMeasuredLayout = null;
    hostEmptyTimer = null;

    try { ipcMain.removeListener(IPC_COMMAND, onWindowCommand); } catch { /* ignore */ }
    try { ipcMain.removeListener(IPC_READY, onReadyFromWindow); } catch { /* ignore */ }
    try { ipcMain.removeListener(IPC_SETTINGS_COMMAND, onSettingsCommand); } catch { /* ignore */ }
    try { ipcMain.removeListener(IPC_SETTINGS_READY, onSettingsReady); } catch { /* ignore */ }
    try { app.removeListener('browser-window-created', onBrowserWindowCreated); } catch { /* ignore */ }
    unregisterHotkeys();
    hostWindows.clear();
    dragOrigin = null;
    dragWindowOrigin = null;

    if (isAlive(settingsWin)) {
      try { settingsWin.destroy(); } catch { /* ignore */ }
    }
    if (isAlive(win)) {
      try { win.destroy(); } catch { /* ignore */ }
    }
    settingsWin = null;
    settingsDragOrigin = null;
    settingsWindowOrigin = null;
    win = null;
    log('模组已停止');
  });

  start().catch((error) => logError('启动失败', error));
  return () => { /* api.onDispose 已处理全部清理 */ };
};


















