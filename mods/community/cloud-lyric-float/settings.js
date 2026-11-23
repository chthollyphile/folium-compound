'use strict';
const api = window.cloudLyricSettings;
const el = {
  close: document.getElementById('close'),
  fontRange: document.getElementById('font-range'),
  fontDown: document.getElementById('font-down'),
  fontUp: document.getElementById('font-up'),
  fontValue: document.getElementById('font-value'),
  textColor: document.getElementById('text-color'),
  accentColor: document.getElementById('accent-color'),
  unsungColor: document.getElementById('unsung-color'),
  unsungOpacity: document.getElementById('unsung-opacity'),
  unsungOpacityValue: document.getElementById('unsung-opacity-value'),
  upcomingScale: document.getElementById('upcoming-scale'),
  upcomingScaleValue: document.getElementById('upcoming-scale-value'),
  showTranslation: document.getElementById('show-translation'),
  showRomanization: document.getElementById('show-romanization'),
  alwaysOnTop: document.getElementById('always-on-top'),
  hotkeys: document.getElementById('hotkeys'),
  resetPosition: document.getElementById('reset-position'),
  lockLyrics: document.getElementById('lock-lyrics'),
  openLog: document.getElementById('open-log'),
  clearLog: document.getElementById('clear-log'),
};
const state = { config: null, configTimer: null, pending: null, sliderTimer: null };
const panel = document.querySelector('.panel');
const titlebar = document.querySelector('.titlebar');
let titleDrag = null;
const command = (name, payload) => { try { api?.command(name, payload); } catch { /* ignore */ } };
const sendConfig = (patch, immediate = false) => {
  state.pending = { ...(state.pending || {}), ...patch };
  if (immediate) {
    if (state.configTimer) clearTimeout(state.configTimer);
    state.configTimer = null;
    const payload = state.pending;
    state.pending = null;
    command('config', payload);
    return;
  }
  if (state.configTimer) return;
  state.configTimer = setTimeout(() => {
    state.configTimer = null;
    const payload = state.pending;
    state.pending = null;
    if (payload) command('config', payload);
  }, 55);
};
const applyConfig = (next) => {
  state.config = { ...(state.config || {}), ...(next || {}) };
  const config = state.config;
  const size = Math.round(Number(config.fontSize) || 46);
  el.fontRange.value = String(size);
  el.fontValue.textContent = String(size);
  el.textColor.value = config.textColor || '#ffffff';
  el.accentColor.value = config.accentColor || '#ff4d4f';
  el.unsungColor.value = config.unsungColor || '#ffffff';
  const unsungOpacity = Math.round((Number(config.unsungOpacity) || 0.48) * 100);
  el.unsungOpacity.value = String(unsungOpacity);
  el.unsungOpacityValue.textContent = unsungOpacity + '%';
  const upcomingScale = Math.round((Number(config.upcomingScale) || 0.58) * 100);
  el.upcomingScale.value = String(upcomingScale);
  el.upcomingScaleValue.textContent = upcomingScale + '%';
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
  document.body.classList.toggle('locked', config.locked === true);
  el.lockLyrics.title = config.locked ? '解除鼠标穿透' : '锁定鼠标穿透';
  el.lockLyrics.setAttribute('aria-label', el.lockLyrics.title);
  el.lockLyrics.classList.toggle('danger', !config.locked);
};
document.addEventListener('click', (event) => {
  const mode = event.target.closest('button[data-mode]');
  if (mode) { sendConfig({ mode: mode.dataset.mode }, true); return; }
  const dragMode = event.target.closest('button[data-drag-mode]');
  if (dragMode) { sendConfig({ dragMode: dragMode.dataset.dragMode }, true); return; }
});
el.fontRange.addEventListener('input', () => {
  const fontSize = Number(el.fontRange.value) || 46;
  el.fontValue.textContent = String(Math.round(fontSize));
  if (state.sliderTimer) clearTimeout(state.sliderTimer);
  state.sliderTimer = setTimeout(() => {
    state.sliderTimer = null;
    sendConfig({ fontSize }, true);
  }, 110);
});
el.fontRange.addEventListener('change', () => {
  if (state.sliderTimer) clearTimeout(state.sliderTimer);
  state.sliderTimer = null;
  sendConfig({ fontSize: Number(el.fontRange.value) || 46 }, true);
});
const stepFont = (delta) => {
  const current = Math.round(Number(state.config?.fontSize) || Number(el.fontRange.value) || 46);
  const fontSize = Math.max(16, Math.min(96, current + delta));
  el.fontRange.value = String(fontSize);
  el.fontValue.textContent = String(fontSize);
  sendConfig({ fontSize }, true);
};
el.fontDown.addEventListener('click', () => stepFont(-2));
el.fontUp.addEventListener('click', () => stepFont(2));

el.textColor.addEventListener('change', () => sendConfig({ textColor: el.textColor.value }, true));
el.accentColor.addEventListener('change', () => sendConfig({ accentColor: el.accentColor.value }, true));
el.unsungColor.addEventListener('change', () => sendConfig({ unsungColor: el.unsungColor.value }, true));
el.unsungOpacity.addEventListener('input', () => {
  const value = Math.round(Number(el.unsungOpacity.value) || 48);
  el.unsungOpacityValue.textContent = value + '%';
  sendConfig({ unsungOpacity: value / 100 });
});
el.upcomingScale.addEventListener('input', () => {
  const value = Math.round(Number(el.upcomingScale.value) || 58);
  el.upcomingScaleValue.textContent = value + '%';
  sendConfig({ upcomingScale: value / 100 });
});
el.showTranslation.addEventListener('change', () => sendConfig({ showTranslation: el.showTranslation.checked }, true));
el.showRomanization.addEventListener('change', () => sendConfig({ showRomanization: el.showRomanization.checked }, true));
el.alwaysOnTop.addEventListener('change', () => sendConfig({ alwaysOnTop: el.alwaysOnTop.checked }, true));
el.hotkeys.addEventListener('change', () => sendConfig({ hotkeys: el.hotkeys.checked }, true));
el.close.addEventListener('click', () => command('close'));
el.resetPosition.addEventListener('click', () => command('reset-position'));
el.lockLyrics.addEventListener('click', () => command(state.config?.locked ? 'unlock' : 'lock'));
el.openLog.addEventListener('click', () => command('open-log'));
el.clearLog.addEventListener('click', () => command('clear-log'));
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') command('close'); });
panel?.addEventListener('dblclick', (event) => {
  if (event.target.closest('button, input, label, .switch-row, .segmented')) return;
  command('close');
});

titlebar?.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.target.closest('button, input')) return;
  titleDrag = {
    pointerId: event.pointerId,
    startX: event.screenX,
    startY: event.screenY,
    moved: false,
  };
  try { titlebar.setPointerCapture(event.pointerId); } catch { /* ignore */ }
});

window.addEventListener('pointermove', (event) => {
  if (!titleDrag || event.pointerId !== titleDrag.pointerId) return;
  if (!titleDrag.moved) {
    if (Math.hypot(event.screenX - titleDrag.startX, event.screenY - titleDrag.startY) <= 3) return;
    titleDrag.moved = true;
    command('drag-start', { x: titleDrag.startX, y: titleDrag.startY });
  }
  command('drag-move', { x: event.screenX, y: event.screenY });
});

const endTitleDrag = (event) => {
  if (!titleDrag || (event && event.pointerId !== titleDrag.pointerId)) return;
  if (titleDrag.moved) command('drag-end');
  try { titlebar.releasePointerCapture(titleDrag.pointerId); } catch { /* ignore */ }
  titleDrag = null;
};
window.addEventListener('pointerup', endTitleDrag);
window.addEventListener('pointercancel', endTitleDrag);
api?.onConfig?.(applyConfig);
api?.ready?.();
window.__cloudLyricSettingsTest = { applyConfig, sendConfig };
