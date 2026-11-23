'use strict';

/**
 * cloud-lyric-float · 悬浮窗渲染端
 *
 * 主进程每 80ms 推一次播放快照；这里用 requestAnimationFrame 在两次快照之间
 * 插值播放时间，因此逐字染色和长句滚动仍然是 60fps。歌词全部用 textContent /
 * 文本节点写入，不把外部数据当 HTML。
 */

const api = window.cloudLyric;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const DEFAULT_CONFIG = {
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
};

const el = {
  lines: document.getElementById('lines'),
  empty: document.getElementById('empty'),
  emptyTitle: document.getElementById('empty-title'),
  emptySub: document.getElementById('empty-sub'),
  statusChip: document.getElementById('status-chip'),
  songTitle: document.getElementById('song-title'),
  artist: document.getElementById('artist'),
  settings: document.getElementById('settings'),
  settingsHead: document.querySelector('.settings-head'),
  toast: document.getElementById('toast'),
  hitbox: document.getElementById('hitbox'),
  hitboxLabel: document.getElementById('hitbox-label'),
  unlockHint: document.getElementById('unlock-hint'),
  chrome: document.querySelector('.chrome'),
  fontRange: document.getElementById('font-range'),
  fontValue: document.getElementById('font-value'),
  textColor: document.getElementById('text-color'),
  accentColor: document.getElementById('accent-color'),
  showTranslation: document.getElementById('show-translation'),
  showRomanization: document.getElementById('show-romanization'),
  alwaysOnTop: document.getElementById('always-on-top'),
  hotkeys: document.getElementById('hotkeys'),
};

const state = {
  data: null,
  config: { ...DEFAULT_CONFIG },
  receivedAt: 0,
  activeIndex: -2,
  signature: '',
  charSpans: [],
  currentLine: null,
  viewport: null,
  track: null,
  overflow: 0,
  settingsOpen: false,
  lastConfigSendAt: 0,
  pendingConfig: null,
  configTimer: null,
  toastTimer: null,
  layoutTimer: null,
  lastLayoutWidth: 0,
  lastLayoutHeight: 0,
};

const parseHexColor = (hex, fallback = [255, 255, 255]) => {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback;
  const number = Number.parseInt(value, 16);
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

// 逐字颜色直接插值，不再使用 background-clip + 红色 drop-shadow。
// 这样不会在字形边缘或下一行留下红色残影。
const mixCharColor = (progress) => {
  const t = clamp(Number(progress) || 0, 0, 1);
  const from = parseHexColor(state.config.unsungColor || state.config.textColor, [255, 255, 255]);
  const to = parseHexColor(state.config.accentColor, [255, 77, 79]);
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  const unsungOpacity = clamp(Number(state.config.unsungOpacity) || 0.48, 0.1, 1);
  const alpha = unsungOpacity + (1 - unsungOpacity) * t;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const RIGHT_DRAG_HOLD_MS = 360;
let leftPress = null;
let rightPress = null;
let suppressContextMenuUntil = 0;
let resetHighlightTimer = null;

const showToast = (message) => {
  if (!message) return;
  el.toast.textContent = message;
  el.toast.classList.add('show');
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    state.toastTimer = null;
    el.toast.classList.remove('show');
  }, 1500);
};

const command = (name, payload) => {
  try {
    api?.command(name, payload);
  } catch { /* 窗口销毁阶段忽略 */ }
};

const SETTINGS_POS_KEY = 'cloud-lyric-float:settings-position';

try {
  const savedPanel = JSON.parse(localStorage.getItem(SETTINGS_POS_KEY) || 'null');
  if (savedPanel && [savedPanel.x, savedPanel.y, savedPanel.width, savedPanel.height].every(Number.isFinite)) {
    state.settingsPos = savedPanel;
  }
} catch { /* ignore invalid saved position */ }

const clampSettingsPosition = (position) => {
  const width = Math.min(position.width, Math.max(260, window.innerWidth - 8));
  const height = Math.min(position.height, Math.max(240, window.innerHeight - 8));
  return {
    x: clamp(position.x, 4, Math.max(4, window.innerWidth - width - 4)),
    y: clamp(position.y, 4, Math.max(4, window.innerHeight - height - 4)),
    width,
    height,
  };
};

const applySettingsPosition = () => {
  if (!state.settingsPos || !el.settings) return;
  const position = clampSettingsPosition(state.settingsPos);
  state.settingsPos = position;
  el.settings.style.left = position.x + 'px';
  el.settings.style.top = position.y + 'px';
  el.settings.style.right = 'auto';
  el.settings.style.bottom = 'auto';
  el.settings.style.height = position.height + 'px';
};

const onSettingsHandleDown = (event) => {
  if (event.button !== 0 || event.target.closest('button, input, textarea, select, a')) return;
  if (!state.settingsOpen || !el.settings) return;
  event.preventDefault();
  const rect = el.settings.getBoundingClientRect();
  state.settingsPos = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  state.panelDrag = {
    pointerId: event.pointerId,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  document.body.classList.add('panel-dragging');
  try { el.settingsHead.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  applySettingsPosition();
};

const onSettingsHandleMove = (event) => {
  if (!state.panelDrag || event.pointerId !== state.panelDrag.pointerId || !state.settingsPos) return;
  event.preventDefault();
  state.settingsPos = clampSettingsPosition({
    x: event.clientX - state.panelDrag.offsetX,
    y: event.clientY - state.panelDrag.offsetY,
    width: state.settingsPos.width,
    height: state.settingsPos.height,
  });
  applySettingsPosition();
};

const endSettingsDrag = (event) => {
  if (!state.panelDrag || (event && event.pointerId !== state.panelDrag.pointerId)) return;
  try { el.settingsHead.releasePointerCapture(state.panelDrag.pointerId); } catch { /* ignore */ }
  state.panelDrag = null;
  document.body.classList.remove('panel-dragging');
  try { localStorage.setItem(SETTINGS_POS_KEY, JSON.stringify(state.settingsPos)); } catch { /* ignore */ }
};

const setSettingsOpen = (open) => {
  state.settingsOpen = Boolean(open);
  document.body.classList.toggle('settings-open', state.settingsOpen);
  if (state.settingsOpen) {
    command('request-state');
    requestAnimationFrame(applySettingsPosition);
    setTimeout(applySettingsPosition, 120);
  }
  scheduleLayout();
};

const applyConfig = (next) => {
  const source = next && typeof next === 'object' ? next : {};
  const previousFontSize = Number(state.config.fontSize);
  state.config = { ...state.config, ...source };
  const config = state.config;
  command('log', {
    message: 'renderer:config-apply',
    data: {
      previousFontSize,
      fontSize: config.fontSize,
      patchFontSize: source.fontSize,
    },
  });

  document.body.dataset.mode = config.mode || 'double';
  const lyricFontPx = `${clamp(Number(config.fontSize) || 46, 16, 96)}px`;
  document.documentElement.style.setProperty('--font-size', lyricFontPx);
  document.body.style.setProperty('--font-size', lyricFontPx);
  document.documentElement.style.setProperty('--text-color', config.textColor || '#ffffff');
  document.documentElement.style.setProperty('--accent-color', config.accentColor || '#ff4d4f');
  document.documentElement.style.setProperty('--unsung-color', config.unsungColor || '#ffffff');
  document.documentElement.style.setProperty('--unsung-opacity', String(clamp(Number(config.unsungOpacity) || 0.48, 0.1, 1)));
  document.documentElement.style.setProperty('--upcoming-scale', String(clamp(Number(config.upcomingScale) || 0.58, 0.3, 1)));

  el.fontRange.value = String(Math.round(Number(config.fontSize) || 46));
  el.fontValue.textContent = String(Math.round(Number(config.fontSize) || 46));
  el.textColor.value = config.textColor || '#ffffff';
  el.accentColor.value = config.accentColor || '#ff4d4f';
  el.showTranslation.checked = config.showTranslation !== false;
  el.showRomanization.checked = config.showRomanization === true;
  el.alwaysOnTop.checked = config.alwaysOnTop !== false;
  el.hotkeys.checked = config.hotkeys === true;

  for (const button of document.querySelectorAll('button[data-mode]')) {
    button.classList.toggle('is-active', button.dataset.mode === config.mode);
  }
  for (const button of document.querySelectorAll('button[data-drag-mode]')) {
    button.classList.toggle('is-active', button.dataset.dragMode === (config.dragMode || 'left'));
  }
  for (const button of document.querySelectorAll('[data-action="lock"]')) {
    const locked = config.locked === true;
    button.title = locked ? '解除鼠标穿透' : '锁定鼠标穿透';
    button.setAttribute('aria-label', button.title);
  }

  setLocked(config.locked === true);
  rebuild(true);
  scheduleLayout();
  requestAnimationFrame(() => {
    const current = document.querySelector('.line.is-current .line-main') || document.querySelector('.line-main');
    command('log', {
      message: 'renderer:font-size-check',
      data: {
        configured: config.fontSize,
        rootValue: getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim(),
        bodyValue: getComputedStyle(document.body).getPropertyValue('--font-size').trim(),
        computed: current ? getComputedStyle(current).fontSize : null,
      },
    });
  });
};

const toRectPayload = (element) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
};

function updateHitboxBounds() {
  if (!el.hitbox) return;
  const rects = [];
  for (const node of document.querySelectorAll('.line-track, .line-sub')) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) rects.push(rect);
  }
  if (rects.length === 0) {
    el.hitbox.style.width = '0px';
    el.hitbox.style.height = '0px';
    return;
  }
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const pad = 10;
  el.hitbox.style.left = Math.max(2, left - pad) + 'px';
  el.hitbox.style.top = Math.max(2, top - pad) + 'px';
  el.hitbox.style.width = Math.max(1, Math.min(window.innerWidth - 4, right - left + pad * 2)) + 'px';
  el.hitbox.style.height = Math.max(1, Math.min(window.innerHeight - 4, bottom - top + pad * 2)) + 'px';
}

function reportInteractiveRegions() {
  const lyricRects = [];
  for (const node of document.querySelectorAll('.line-track, .line-sub')) {
    const rect = toRectPayload(node);
    if (rect) lyricRects.push(rect);
  }
  command('regions', {
    unlockRect: toRectPayload(el.unlockHint),
    lyricRects,
  });
}

const updateHitboxLabel = () => {
  if (!el.hitboxLabel) return;
  const width = Math.round(window.innerWidth);
  const height = Math.round(window.innerHeight);
  const locked = state.config.locked === true;
  el.hitboxLabel.textContent = `${locked ? '鼠标穿透' : '交互范围'} · ${width} × ${height}`;
  reportInteractiveRegions();
};

const setLocked = (locked) => {
  document.body.classList.toggle('locked', Boolean(locked));
  document.body.classList.toggle('unlocked', !locked);
  updateHitboxLabel();
  if (!locked) document.body.classList.remove('unlock-hover');
  if (locked) setSettingsOpen(false);
  for (const button of document.querySelectorAll('[data-action="lock"]')) {
    button.classList.toggle('active-lock', Boolean(locked));
    button.title = locked ? '解除鼠标穿透' : '锁定鼠标穿透';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(Boolean(locked)));
  }
};

const pushConfig = (patch, immediate = false) => {
  state.pendingConfig = { ...(state.pendingConfig || {}), ...patch };
  if (immediate) {
    const payload = state.pendingConfig;
    state.pendingConfig = null;
    if (state.configTimer) {
      clearTimeout(state.configTimer);
      state.configTimer = null;
    }
    command('config', payload);
    return;
  }
  if (state.configTimer) return;
  state.configTimer = setTimeout(() => {
    state.configTimer = null;
    const payload = state.pendingConfig;
    state.pendingConfig = null;
    if (payload) command('config', payload);
  }, 60);
};

const effectiveTime = () => {
  if (!state.data) return 0;
  const base = Number(state.data.position) || 0;
  if (state.data.state !== 'playing') return base;
  return base + Math.max(0, performance.now() - state.receivedAt) / 1000;
};

const findActiveIndex = () => {
  const lines = state.data?.lines || [];
  const time = effectiveTime();
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const start = Number(lines[index].startTime);
    if (Number.isFinite(start) && start <= time + .06) active = index;
    else break;
  }
  return active;
};

const makeCharTimings = (line) => {
  const text = String(line.text || '');
  const chars = Array.from(text);
  if (chars.length === 0) return [];

  const words = Array.isArray(line.words) ? line.words : [];
  const wordsText = words.map((word) => String(word.text || '')).join('');
  if (words.length > 0 && wordsText === text) {
    const timings = [];
    for (const word of words) {
      const wordChars = Array.from(String(word.text || ''));
      const start = Number(word.startTime);
      const end = Number(word.endTime);
      if (!Number.isFinite(start) || wordChars.length === 0) continue;
      const safeEnd = Number.isFinite(end) && end > start ? end : start + .12;
      const duration = safeEnd - start;
      for (let index = 0; index < wordChars.length; index += 1) {
        timings.push({
          char: wordChars[index],
          start: start + (duration * index) / wordChars.length,
          end: start + (duration * (index + 1)) / wordChars.length,
        });
      }
    }
    if (timings.length === chars.length) return timings;
  }

  const start = Number(line.startTime) || 0;
  const end = Number(line.endTime);
  const safeEnd = Number.isFinite(end) && end > start ? end : start + Math.max(2.5, chars.length * .22);
  const duration = safeEnd - start;
  return chars.map((char, index) => ({
    char,
    start: start + (duration * index) / chars.length,
    end: start + (duration * (index + 1)) / chars.length,
  }));
};

const makeLine = (line, role) => {
  const wrapper = document.createElement('div');
  wrapper.className = `line is-${role}`;

  const viewport = document.createElement('div');
  viewport.className = 'line-viewport';
  const track = document.createElement('div');
  track.className = 'line-main line-track';
  viewport.appendChild(track);
  wrapper.appendChild(viewport);

  if (role === 'current') {
    const timings = makeCharTimings(line);
    state.charSpans = [];
    state.currentLine = line;
    state.viewport = viewport;
    state.track = track;
    for (const timing of timings) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = timing.char;
      span.style.color = mixCharColor(0);
      track.appendChild(span);
      state.charSpans.push({ element: span, start: timing.start, end: timing.end });
    }
  } else {
    track.textContent = line.text;
  }

  if (role === 'current' && state.config.showTranslation !== false && line.translation) {
    const translation = document.createElement('div');
    translation.className = 'line-sub translation';
    translation.textContent = line.translation;
    wrapper.appendChild(translation);
  }
  if (role === 'current' && state.config.showRomanization === true && line.romanization) {
    const romanization = document.createElement('div');
    romanization.className = 'line-sub romanization';
    romanization.textContent = line.romanization;
    wrapper.appendChild(romanization);
  }

  return wrapper;
};

const updateEmptyState = () => {
  const data = state.data;
  const status = data?.status || 'idle';
  const hasLines = Boolean(data?.lines?.length);
  const noLyric = !hasLines && status !== 'upcoming';
  el.empty.hidden = !noLyric;
  el.lines.hidden = noLyric;
  if (!noLyric) return;

  if (!data || status === 'idle') {
    el.emptyTitle.textContent = '等待播放';
    el.emptySub.textContent = '在 Folia 播放音乐后，歌词会出现在这里';
    return;
  }
  if (status === 'no-lyrics') {
    el.emptyTitle.textContent = '纯音乐，请欣赏';
    el.emptySub.textContent = '这首歌暂时没有可用歌词';
    return;
  }
  el.emptyTitle.textContent = '歌词暂时不可用';
  el.emptySub.textContent = '切歌或继续播放后再试';
};

const visualSignature = () => {
  const data = state.data;
  if (!data) return 'none';
  const lines = (data.lines || []).map((line) => [
    line.text,
    line.translation || '',
    line.romanization || '',
    line.startTime,
    Array.isArray(line.words) ? line.words.length : 0,
  ]);
  return JSON.stringify({
    mode: state.config.mode,
    showTranslation: state.config.showTranslation,
    showRomanization: state.config.showRomanization,
    song: data.song,
    status: data.status,
    lines,
  });
};

function measureTextWidth(element) {
  if (!element) return 0;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return 0;
  try {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rect = range.getBoundingClientRect();
    return Math.max(rect.width, element.scrollWidth || 0);
  } catch {
    return element.scrollWidth || 0;
  }
}

function reportLayout() {
  if (!document.body) return;
  if (!state.data) return;

  let textWidth = 0;
  for (const element of document.querySelectorAll('.line-track, .line-sub')) {
    textWidth = Math.max(textWidth, measureTextWidth(element));
  }
  if (el.empty && !el.empty.hidden) {
    textWidth = Math.max(textWidth, measureTextWidth(el.emptyTitle), measureTextWidth(el.emptySub));
  }

  const baseWidth = Math.ceil(textWidth + 62);
  const width = state.settingsOpen
    ? clamp(baseWidth + 430, 820, 1400)
    : clamp(baseWidth, 260, 1200);
  const linesHeight = el.lines && !el.lines.hidden ? el.lines.getBoundingClientRect().height : 0;
  const contentHeight = linesHeight > 4 ? linesHeight + 84 : 184;
  const height = clamp(
    Math.ceil(state.settingsOpen ? Math.max(contentHeight, 500) : contentHeight),
    150,
    520,
  );

  if (Math.abs(width - state.lastLayoutWidth) < 2 && Math.abs(height - state.lastLayoutHeight) < 2) return;
  state.lastLayoutWidth = width;
  state.lastLayoutHeight = height;
  command('log', {
    message: 'renderer:layout-report',
    data: {
      width,
      height,
      textWidth,
      linesHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      mode: state.config.mode,
      fontSize: state.config.fontSize,
      settingsOpen: state.settingsOpen,
      dragArmed: Boolean(rightPress && rightPress.armed),
      dragging: Boolean(rightPress && rightPress.dragging),
    },
  });
  updateHitboxBounds();
  updateHitboxLabel();
  command('layout', { width, height });
  if (state.settingsOpen) setTimeout(applySettingsPosition, 80);
}

function scheduleLayout() {
  if (state.layoutTimer) clearTimeout(state.layoutTimer);
  state.layoutTimer = setTimeout(() => {
    state.layoutTimer = null;
    requestAnimationFrame(reportLayout);
  }, 40);
}

const rebuild = (force = false) => {
  if (!state.data) {
    updateEmptyState();
    return;
  }
  const signature = visualSignature();
  const active = findActiveIndex();
  if (!force && signature === state.signature && active === state.activeIndex) return;
  state.signature = signature;
  state.activeIndex = active;
  state.charSpans = [];
  state.currentLine = null;
  state.viewport = null;
  state.track = null;
  state.overflow = 0;
  el.lines.replaceChildren();

  const lines = state.data.lines || [];
  const hasLines = lines.length > 0;
  updateEmptyState();
  if (!hasLines) {
    el.statusChip.hidden = true;
    requestAnimationFrame(scheduleLayout);
    return;
  }

  const mode = state.config.mode || 'double';
  let indices = [];
  if (active >= 0) {
    if (mode === 'single') indices = [active];
    else if (mode === 'double') indices = [active, active + 1];
    else {
      for (let index = active - 2; index <= active + 2; index += 1) indices.push(index);
    }
  } else if (mode === 'single') {
    indices = [0];
  } else if (mode === 'double') {
    indices = [0, 1];
  } else {
    indices = [0, 1, 2, 3, 4];
  }

  const clampedIndices = [...new Set(indices)].filter((index) => index >= 0 && index < lines.length);
  for (const index of clampedIndices) {
    const distance = active < 0 ? Math.min(index + 1, 3) : Math.abs(index - active);
    const role = index === active ? 'current' : distance === 1 ? 'adjacent' : 'nearby';
    el.lines.appendChild(makeLine(lines[index], role));
  }

  el.statusChip.hidden = active >= 0 || state.data.status !== 'upcoming';
  requestAnimationFrame(() => {
    measureOverflow();
    updateHitboxBounds();
    scheduleLayout();
  });
};

const measureOverflow = () => {
  if (!state.viewport || !state.track) return;
  state.overflow = Math.max(0, state.track.scrollWidth - state.viewport.clientWidth);
};

const updateMeta = () => {
  const data = state.data;
  const song = data?.song || {};
  const title = song.title || '云音乐悬浮歌词';
  const artist = song.artist || '';
  el.songTitle.textContent = artist ? title : `${title}${data?.status === 'idle' ? '' : ' · 云音乐悬浮歌词'}`;
  el.artist.textContent = artist;
  document.body.classList.toggle('is-playing', data?.state === 'playing');
};

const setState = (payload) => {
  state.data = payload && typeof payload === 'object' ? payload : null;
  state.receivedAt = performance.now();
  updateMeta();
  rebuild();
};

const updateFrame = () => {
  if (state.data) {
    const active = findActiveIndex();
    if (active !== state.activeIndex) {
      rebuild(true);
    } else {
      const time = effectiveTime();
      for (const span of state.charSpans) {
        const duration = Math.max(.001, Number(span.end) - Number(span.start));
        const progress = clamp((time - Number(span.start)) / duration, 0, 1);
        span.element.style.color = mixCharColor(progress);
      }
      if (state.track && state.viewport) {
        const line = state.currentLine;
        if (line && state.overflow > 1) {
          const start = Number(line.startTime) || 0;
          const end = Number(line.endTime);
          const duration = Math.max(.8, (Number.isFinite(end) ? end : start + 8) - start);
          const raw = clamp((time - start) / duration, 0, 1);
          const eased = raw < .5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
          state.track.style.transform = `translateX(${(-state.overflow * eased).toFixed(2)}px)`;
        } else {
          state.track.style.transform = 'translateX(0)';
        }
      }
    }
  }
  requestAnimationFrame(updateFrame);
};

const actionHandlers = {
  prev: () => {
    command('playback', { action: 'prev' });
    showToast('上一首');
  },
  play: () => {
    command('playback', { action: 'toggle' });
    showToast(state.data?.state === 'playing' ? '已暂停' : '继续播放');
  },
  next: () => {
    command('playback', { action: 'next' });
    showToast('下一首');
  },
  'font-down': () => {
    const next = clamp((Number(state.config.fontSize) || 46) - 2, 16, 96);
    applyConfig({ fontSize: next });
    pushConfig({ fontSize: next }, true);
  },
  'font-up': () => {
    const next = clamp((Number(state.config.fontSize) || 46) + 2, 16, 96);
    applyConfig({ fontSize: next });
    pushConfig({ fontSize: next }, true);
  },
  settings: () => {
    setSettingsOpen(false);
    command('open-settings');
  },
  'close-settings': () => setSettingsOpen(false),
  lock: () => {
    setSettingsOpen(false);
    command(state.config.locked ? 'unlock' : 'lock');
    showToast(state.config.locked ? '已解除锁定' : '已锁定，鼠标将穿透');
  },
  hide: () => {
    setSettingsOpen(false);
    command('hide');
  },
  'focus-app': () => {
    setSettingsOpen(false);
    command('focus-app');
    showToast('已切回 Folia');
  },
  'reset-position': () => {
    command('reset-position');
    showToast('已回到默认位置');
  },
};

document.addEventListener('click', (event) => {
  const modeButton = event.target.closest('button[data-mode]');
  if (modeButton) {
    const mode = modeButton.dataset.mode;
    if (['single', 'double', 'multi'].includes(mode)) {
      applyConfig({ mode });
      pushConfig({ mode }, true);
    }
    return;
  }
  const dragModeButton = event.target.closest('button[data-drag-mode]');
  if (dragModeButton) {
    const dragMode = dragModeButton.dataset.dragMode;
    if (['left', 'right-hold', 'both'].includes(dragMode)) {
      applyConfig({ dragMode });
      pushConfig({ dragMode }, true);
    }
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const handler = actionHandlers[actionButton.dataset.action];
  if (handler) {
    event.preventDefault();
    event.stopPropagation();
    handler();
  }
});

el.fontRange.addEventListener('input', () => {
  const size = clamp(Number(el.fontRange.value) || 46, 16, 96);
  el.fontValue.textContent = String(Math.round(size));
  applyConfig({ fontSize: size });
  pushConfig({ fontSize: size });
});

el.textColor.addEventListener('change', () => {
  applyConfig({ textColor: el.textColor.value });
  pushConfig({ textColor: el.textColor.value }, true);
});

el.accentColor.addEventListener('change', () => {
  applyConfig({ accentColor: el.accentColor.value });
  pushConfig({ accentColor: el.accentColor.value }, true);
});

el.showTranslation.addEventListener('change', () => {
  applyConfig({ showTranslation: el.showTranslation.checked });
  pushConfig({ showTranslation: el.showTranslation.checked }, true);
});

el.showRomanization.addEventListener('change', () => {
  applyConfig({ showRomanization: el.showRomanization.checked });
  pushConfig({ showRomanization: el.showRomanization.checked }, true);
});


el.alwaysOnTop.addEventListener('change', () => {
  pushConfig({ alwaysOnTop: el.alwaysOnTop.checked }, true);
});

el.hotkeys.addEventListener('change', () => {
  pushConfig({ hotkeys: el.hotkeys.checked }, true);
});

const isInteractiveTarget = (target) => Boolean(
  target && typeof target.closest === 'function'
  && target.closest('button, input, textarea, select, a, .chrome, .settings-panel'),
);

function pointInsideClientRect(event, rect, margin = 0) {
  return Boolean(
    rect
    && event.clientX >= rect.left - margin
    && event.clientX <= rect.right + margin
    && event.clientY >= rect.top - margin
    && event.clientY <= rect.bottom + margin
  );
}

function isPointOverLyrics(event, margin = 8) {
  for (const node of document.querySelectorAll('.line-track, .line-sub')) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (pointInsideClientRect(event, node.getBoundingClientRect(), margin)) return true;
  }
  return false;
}

const stopResetHighlight = () => {
  document.body.classList.remove('reset-highlight');
  if (resetHighlightTimer) clearTimeout(resetHighlightTimer);
  resetHighlightTimer = null;
};

const startResetHighlight = () => {
  document.body.classList.add('reset-highlight');
  if (resetHighlightTimer) clearTimeout(resetHighlightTimer);
  resetHighlightTimer = setTimeout(stopResetHighlight, 6000);
  command('log', { message: 'renderer:reset-highlight-start', data: null });
};

const updateLyricHoverFromPointer = (event) => {
  if (state.config.locked) {
    document.body.classList.remove('lyric-hover');
    if (document.body.classList.contains('reset-highlight') && isPointOverLyrics(event)) {
      stopResetHighlight();
    }
    return;
  }
  const overLyrics = !isInteractiveTarget(event.target) && isPointOverLyrics(event);
  document.body.classList.toggle('lyric-hover', overLyrics);
  if (overLyrics && document.body.classList.contains('reset-highlight')) stopResetHighlight();
};

const cancelLeftDrag = (endDrag = true) => {
  if (!leftPress) return;
  if (endDrag) command('drag-end');
  try {
    if (leftPress.pointerId !== null) document.documentElement.releasePointerCapture(leftPress.pointerId);
  } catch { /* ignore */ }
  leftPress = null;
  document.body.classList.remove('left-dragging');
};

const onLeftPointerDown = (event) => {
  if (state.config.locked) return;
  if (event.button !== 0 || isInteractiveTarget(event.target)) return;
  if (!['left', 'both'].includes(state.config.dragMode || 'left')) return;
  if (!isPointOverLyrics(event)) return;
  event.preventDefault();
  cancelRightPress(false);
  cancelLeftDrag(false);
  leftPress = { pointerId: event.pointerId };
  document.body.classList.add('left-dragging');
  try {
    document.documentElement.setPointerCapture(event.pointerId);
  } catch { /* ignore */ }
  logPointerEvent('left-drag-start', event);
  command('drag-start', { x: event.screenX, y: event.screenY });
};

const onLeftPointerMove = (event) => {
  if (!leftPress || event.pointerId !== leftPress.pointerId) return;
  event.preventDefault();
  command('drag-move', { x: event.screenX, y: event.screenY });
};

const onLeftPointerUp = (event) => {
  if (!leftPress || event.pointerId !== leftPress.pointerId) return;
  logPointerEvent('left-drag-end', event);
  command('drag-end');
  try {
    document.documentElement.releasePointerCapture(event.pointerId);
  } catch { /* ignore */ }
  leftPress = null;
  document.body.classList.remove('left-dragging');
};

const clearRightPressTimer = () => {
  if (rightPress && rightPress.timer) {
    clearTimeout(rightPress.timer);
    rightPress.timer = null;
  }
};

const endRightPressClasses = () => {
  document.body.classList.remove('right-pressing', 'right-dragging');
};

const cancelRightPress = (endDrag = true) => {
  if (!rightPress) return;
  clearRightPressTimer();
  if (rightPress.dragging) {
    if (endDrag) command('drag-end');
  } else if (rightPress.armed) {
    command('drag-disarm');
  }
  try {
    if (rightPress.pointerId !== null) document.documentElement.releasePointerCapture(rightPress.pointerId);
  } catch { /* ignore */ }
  rightPress = null;
  endRightPressClasses();
};

const logPointerEvent = (message, event, extra = {}) => {
  command('log', {
    message,
    data: {
      screenX: event?.screenX,
      screenY: event?.screenY,
      button: event?.button,
      buttons: event?.buttons,
      pointerId: event?.pointerId,
      ...extra,
    },
  });
};

// 长按只进入 armed 状态，不发送 drag-start。
// 必须等用户真正移动鼠标后才启动窗口拖动，避免单纯长按时坐标噪声让窗口上飞。
const armRightDrag = () => {
  if (!rightPress || rightPress.dragging || rightPress.armed) return;
  rightPress.armed = true;
  rightPress.armX = rightPress.lastX;
  rightPress.armY = rightPress.lastY;
  document.body.classList.remove('right-pressing');
  document.body.classList.add('right-dragging');
  command('drag-arm', { x: rightPress.armX, y: rightPress.armY });
  logPointerEvent('right-hold-armed', null, {
    x: rightPress.armX,
    y: rightPress.armY,
  });
};

const onRightPointerDown = (event) => {
  if (state.config.locked) return;
  if (event.button !== 2 || isInteractiveTarget(event.target)) return;
  if (!['right-hold', 'both'].includes(state.config.dragMode || 'left')) return;
  if (!isPointOverLyrics(event)) return;
  event.preventDefault();
  cancelRightPress(false);
  rightPress = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    lastX: event.screenX,
    lastY: event.screenY,
    armX: event.screenX,
    armY: event.screenY,
    moved: false,
    armed: false,
    dragging: false,
    timer: null,
  };
  logPointerEvent('right-pointer-down', event);
  document.body.classList.add('right-pressing');
  try {
    document.documentElement.setPointerCapture(event.pointerId);
  } catch { /* pointer capture is best-effort */ }
  rightPress.timer = setTimeout(armRightDrag, RIGHT_DRAG_HOLD_MS);
};

const onRightPointerMove = (event) => {
  if (!rightPress || event.pointerId !== rightPress.pointerId) return;
  rightPress.lastX = event.screenX;
  rightPress.lastY = event.screenY;
  if (Math.hypot(event.screenX - rightPress.startX, event.screenY - rightPress.startY) > 6) {
    rightPress.moved = true;
  }
  if (rightPress.armed && !rightPress.dragging) {
    const movedAfterArm = Math.hypot(event.screenX - rightPress.armX, event.screenY - rightPress.armY);
    if (movedAfterArm > 2) {
      rightPress.dragging = true;
      logPointerEvent('right-drag-first-move', event, {
        fromX: rightPress.armX,
        fromY: rightPress.armY,
      });
      command('drag-start', { x: event.screenX, y: event.screenY });
    }
  }
  if (rightPress.dragging) {
    event.preventDefault();
    command('drag-move', { x: event.screenX, y: event.screenY });
  }
};

const onRightPointerUp = (event) => {
  if (!rightPress || event.pointerId !== rightPress.pointerId) return;
  const wasDragging = rightPress.dragging;
  const wasArmed = rightPress.armed;
  const wasMoved = rightPress.moved;
  logPointerEvent('right-pointer-up', event, { dragging: wasDragging, armed: wasArmed, moved: wasMoved });
  clearRightPressTimer();
  if (wasDragging) {
    command('drag-end');
    suppressContextMenuUntil = performance.now() + 400;
  } else if (wasArmed) {
    command('drag-disarm');
  } else if (!wasMoved) {
    command('open-settings');
  }
  try {
    document.documentElement.releasePointerCapture(event.pointerId);
  } catch { /* ignore */ }
  rightPress = null;
  endRightPressClasses();
};

document.addEventListener('mouseleave', () => {
  document.body.classList.remove('unlock-hover', 'lyric-hover');
});
window.addEventListener('pointermove', updateLyricHoverFromPointer, true);
window.addEventListener('mousemove', updateLyricHoverFromPointer, true);
window.addEventListener('pointerdown', onSettingsHandleDown, true);
window.addEventListener('pointermove', onSettingsHandleMove, true);
window.addEventListener('pointerup', endSettingsDrag, true);
window.addEventListener('pointercancel', endSettingsDrag, true);
window.addEventListener('blur', endSettingsDrag);
window.addEventListener('pointerdown', onLeftPointerDown, true);
window.addEventListener('pointermove', onLeftPointerMove, true);
window.addEventListener('pointerup', onLeftPointerUp, true);
window.addEventListener('pointerdown', onRightPointerDown, true);
window.addEventListener('pointermove', onRightPointerMove, true);
window.addEventListener('pointerup', onRightPointerUp, true);
window.addEventListener('pointercancel', () => {
  cancelLeftDrag(true);
  cancelRightPress(true);
}, true);
window.addEventListener('blur', () => {
  cancelLeftDrag(true);
  cancelRightPress(true);
});

window.addEventListener('contextmenu', (event) => {
  if (event.target.closest('input')) return;
  event.preventDefault();
  if (!rightPress
    && performance.now() >= suppressContextMenuUntil
    && event.button === 2
    && !isInteractiveTarget(event.target)) {
    command('open-settings');
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.settingsOpen) {
    event.preventDefault();
    setSettingsOpen(false);
    return;
  }
  if (event.target.closest('input')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    actionHandlers.play();
  } else if (event.key === 'ArrowLeft') {
    actionHandlers.prev();
  } else if (event.key === 'ArrowRight') {
    actionHandlers.next();
  }
});

api?.onState?.(setState);
api?.onConfig?.(applyConfig);
api?.onLocked?.((payload) => {
  state.config.locked = Boolean(payload && payload.locked);
  setLocked(state.config.locked);
});
api?.onResetPosition?.(() => startResetHighlight());
api?.onLockHover?.((payload) => {
  document.body.classList.toggle(
    'unlock-hover',
    Boolean(payload && (payload.overLyrics || payload.overUnlock)),
  );
});
api?.onOpenSettings?.(() => command('open-settings'));
api?.ready?.();
updateHitboxLabel();
window.addEventListener('resize', () => {
  updateHitboxBounds();
  updateHitboxLabel();
  applySettingsPosition();
});

// 没有 Electron preload 时也能在浏览器里预览 / 自动化测试。
window.__cloudLyricTest = {
  setState,
  setConfig: applyConfig,
  setLocked,
  openSettings: () => setSettingsOpen(true),
  closeSettings: () => setSettingsOpen(false),
};

const demoMode = new URLSearchParams(location.search).has('demo');
if (demoMode && !api) {
  const makeWords = (text, start, end) => {
    const chars = Array.from(text);
    const duration = (end - start) / Math.max(1, chars.length);
    return chars.map((char, index) => ({
      text: char,
      startTime: start + duration * index,
      endTime: start + duration * (index + 1),
    }));
  };
  const demoLines = [
    { text: '晚风把城市吹成一片海', translation: 'The evening wind turns the city into a sea', romanization: null, startTime: 0, endTime: 4.8 },
    { text: '我在人潮里听见你的名字', translation: 'I hear your name in the crowd', romanization: null, startTime: 4.8, endTime: 9.6 },
    { text: '灯光沿着屋檐慢慢落下来', translation: 'Lights fall slowly along the eaves', romanization: null, startTime: 9.6, endTime: 14.4 },
    { text: '像一封没有寄出的信', translation: 'Like a letter never sent', romanization: null, startTime: 14.4, endTime: 19.2 },
    { text: '如果云会记得这一夜', translation: 'If the clouds remember this night', romanization: null, startTime: 19.2, endTime: 24.0 },
    { text: '请把我的心事唱给她听', translation: 'Please sing my thoughts to her', romanization: null, startTime: 24.0, endTime: 28.8 },
  ].map((line) => ({ ...line, words: makeWords(line.text, line.startTime, line.endTime) }));
  setState({
    version: 1,
    at: Date.now(),
    state: 'paused',
    position: 11.1,
    duration: 218,
    song: { id: 'demo', title: '云海来信', artist: '陈一勺', album: '夜航' },
    status: 'ready',
    activeIndex: 2,
    lines: demoLines.slice(0, 6),
    hasLyrics: true,
    canPlay: true,
  });
  applyConfig({ ...DEFAULT_CONFIG, showTranslation: true, showRomanization: false, mode: 'double' });
}

requestAnimationFrame(updateFrame);

















