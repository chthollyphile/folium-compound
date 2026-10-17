/*
 * Random lyric visualizer for Folia 0.7.x.
 *
 * The entry itself stays selected as `随机`. Its renderer delegates to the
 * host's live visualizer registry, so builtin and third-party visualizers use
 * their real renderers. This is intentionally pinned to Folia's internals:
 * the public Folium API can register a visualizer, but cannot render another
 * registered visualizer from inside it.
 */

const RANDOM_MODE = 'mod:lyric-style-switcher:random-lyric-style';
const MEMORY_KEY = 'song-style-map';
const SETTINGS_KEY = 'randomMode';
const MAX_MEMORY_ENTRIES = 2000;

const state = { active: false, mode: null, songKey: null, saved: false, listeners: new Set() };
const notifyState = () => state.listeners.forEach((listener) => listener());
const listenState = (listener) => {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
};

const resolveLocale = (ctx) => {
  const declared = ctx?.locale || (typeof document !== 'undefined' ? document.documentElement?.lang : '') || (typeof navigator !== 'undefined' ? navigator.language : '');
  return String(declared || 'en').toLowerCase();
};

const label = (locale, zh, en) => String(locale || '').toLowerCase().startsWith('zh') ? zh : en;

const getSongKey = (song) => {
  if (!song) return null;
  const source = song.source || 'unknown';
  const id = song.id || song.ref || `${song.title}|${song.artist || ''}|${song.album || ''}`;
  return `${source}:${id}`;
};

const trimMemory = (memory) => {
  const keys = Object.keys(memory);
  if (keys.length <= MAX_MEMORY_ENTRIES) return memory;
  keys.slice(0, keys.length - MAX_MEMORY_ENTRIES).forEach((key) => delete memory[key]);
  return memory;
};

const rememberInMemory = (memory, songKey, mode) => {
  // Reassigning moves an existing song to the newest end of the object.
  delete memory[songKey];
  memory[songKey] = mode;
  return trimMemory(memory);
};

const safeStorageGet = async (storage) => {
  try {
    const value = await storage.get(MEMORY_KEY);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (_) {
    return {};
  }
};

const safeStorageSet = async (storage, memory) => {
  try {
    await storage.set(MEMORY_KEY, trimMemory(memory));
    return true;
  } catch (_) {
    return false;
  }
};

const readRegistry = (folium) => {
  let registry;
  try { registry = folium.internals && folium.internals.visualizerRegistry; } catch (_) { return []; }
  const entries = Array.isArray(registry) ? registry : registry && registry.entries;
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => entry && entry.mode && entry.mode !== RANDOM_MODE && typeof entry.render === 'function');
};

const pickEntry = (folium, previousMode) => {
  const entries = readRegistry(folium);
  if (entries.length === 0) return null;
  const candidates = entries.filter((entry) => entry.mode !== previousMode);
  const pool = candidates.length ? candidates : entries;
  return pool[Math.floor(Math.random() * pool.length)] || null;
};

const getVisualizerSettingsState = (folium) => {
  try {
    const store = folium.internals?.stores?.visualizerSettings;
    const state = typeof store?.getState === 'function' ? store.getState() : store;
    const nested = state?.visualizerSettings && typeof state.visualizerSettings === 'object'
      ? state.visualizerSettings : state;
    return nested && typeof nested === 'object' ? nested : {};
  } catch (_) {
    return {};
  }
};

const getThemeSettingsState = (folium) => {
  try {
    const store = folium.internals?.stores?.themeSettings;
    return typeof store?.getState === 'function' ? store.getState() : {};
  } catch (_) {
    return {};
  }
};

const readVisualizerTuning = (folium, mode) => {
  let store;
  try { store = folium.internals?.stores?.visualizerSettings; } catch (_) { store = null; }
  const settings = getVisualizerSettingsState(folium);
  const themeSettings = getThemeSettingsState(folium);
  const tuningKeys = {
    classic: 'classicTuning', cadenza: 'cadenzaTuning', partita: 'partitaTuning',
    fume: 'fumeTuning', claddagh: 'claddaghTuning', cappella: 'cappellaTuning',
    tilt: 'tiltTuning', diorama: 'dioramaTuning', monet: 'monetTuning',
    pendolo: 'pendoloTuning', sonnet: 'sonnetTuning', tempera: 'temperaTuning',
    lumiere: 'lumiereTuning',
  };
  const visualizerTunings = Object.fromEntries(Object.entries(tuningKeys)
    .map(([name, key]) => [name, settings[key]])
    .filter(([, value]) => value !== undefined));
  const byMode = visualizerTunings?.[mode]
    ?? (store && typeof store.getVisualizerTuning === 'function' ? store.getVisualizerTuning(mode) : undefined);
  const visualizerTuning = byMode;
  const background = {
    mode: settings.visualizerBackgroundMode ?? null,
    common: {
      useCoverColorBg: themeSettings.useCoverColorBg,
      opacity: settings.backgroundOpacity,
      disableGeometricBackground: settings.disableVisualizerGeometricBackground,
      disableVignette: settings.disableVisualizerVignette,
    },
    customImage: settings.monetBackgroundImage ?? null,
    monet: { tuning: settings.monetBackgroundTuning },
    nomand: { tuning: settings.nomandBackgroundTuning },
    latent: { tuning: settings.latentBackgroundTuning },
    sora: { tuning: settings.soraBackgroundTuning },
    url: { items: settings.urlBackgroundList, selectedId: settings.urlBackgroundSelectedId },
  };
  return { visualizerTunings, visualizerTuning, background };
};

// A small MotionValue-compatible adapter. Folium exposes analyser values as
// snapshots; builtin renderers expect `.get()` and `.on('change')` signals.
const createSignal = (initial) => {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    getPrevious: () => value,
    on: (event, listener) => {
      if (event !== 'change') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((listener) => listener(value));
    },
  };
};

const createAudioSignals = (ctx) => {
  const isMotionValue = (value) => value && typeof value.get === 'function' && typeof value.on === 'function';
  const hostPower = ctx.audioPower || ctx.audio?.power || ctx.audio?.audioPower;
  const hostBands = ctx.audioBands || ctx.audio?.bands || ctx.audio?.audioBands;
  if (isMotionValue(hostPower) && hostBands && Object.values(hostBands).some(isMotionValue)) {
    return { power: hostPower, bands: hostBands, update: () => {} };
  }
  const power = createSignal(0);
  const bands = {
    bass: createSignal(0), lowMid: createSignal(0), mid: createSignal(0),
    vocal: createSignal(0), treble: createSignal(0),
  };
  const scale = (value) => {
    const number = Number(value) || 0;
    return number >= 0 && number <= 1 ? number * 255 : number;
  };
  const update = () => {
    const audio = ctx.audio;
    if (!audio) return;
    power.set(scale(audio.getPower?.()));
    const next = audio.getBands?.() || {};
    Object.keys(bands).forEach((key) => bands[key].set(scale(next[key])));
  };
  update();
  return { power, bands, update };
};

const buildRendererProps = (folium, ctx, audio, entry) => {
  const display = ctx.getDisplay?.() || {};
  const theme = ctx.getTheme();
  const song = ctx.song;
  const tuning = readVisualizerTuning(folium, entry?.mode);
  const lineIndex = display.staticMode && display.staticLineIndex !== null
    ? display.staticLineIndex : ctx.getLineIndex();
  return {
    currentTime: ctx.currentTime,
    currentLineIndex: lineIndex,
    lines: ctx.lines,
    theme,
    subtitleTheme: ctx.getSubtitleTheme?.() || theme,
    isDaylight: theme.isDaylight,
    audioPower: audio.power,
    audioBands: audio.bands,
    visualizerTunings: tuning.visualizerTunings,
    visualizerTuning: tuning.visualizerTuning,
    tuning: tuning.visualizerTuning,
    background: tuning.background,
    showText: display.showText,
    songTitle: song?.title || null,
    songArtist: song?.artist || null,
    songAlbum: song?.album || null,
    coverUrl: ctx.getCoverUrl?.() || null,
    seed: ctx.seed || song?.id || null,
    staticMode: Boolean(display.staticMode),
    backgroundStaticMode: Boolean(display.staticMode),
    visualizerOpacity: display.visualizerOpacity,
    lyricsFontScale: display.lyricsFontScale,
    subtitleFontScale: display.subtitleFontScale,
    subtitleOverlayOpacity: display.subtitleOverlayOpacity,
    subtitleOverlayBackground: display.subtitleOverlayBackground,
    subtitleUpcomingLyricsBlur: display.subtitleUpcomingLyricsBlur,
    showHarmonySubtitle: display.showHarmonySubtitle,
    harmonySubtitleBackground: display.harmonySubtitleBackground,
    isPlayerChromeHidden: display.isPlayerChromeHidden,
    hideTranslationSubtitle: display.hideTranslationSubtitle,
    showSubtitleTranslation: display.showSubtitleTranslation,
    subtitleContentMode: display.subtitleContentMode,
    paused: ctx.isPaused(),
    isPreviewMode: Boolean(ctx.isPreview),
  };
};

const rememberCurrent = async (folium, ctx, songKey, mode) => {
  if (!songKey || !mode || ctx?.isPreview || folium.env?.context !== 'main') return false;
  const memory = await safeStorageGet(folium.storage);
  rememberInMemory(memory, songKey, mode);
  const ok = await safeStorageSet(folium.storage, memory);
  if (ok) { state.mode = mode; state.saved = true; notifyState(); }
  return ok;
};

const forgetCurrent = async (folium, songKey) => {
  if (!songKey || folium.env?.context !== 'main') return false;
  const memory = await safeStorageGet(folium.storage);
  if (!Object.prototype.hasOwnProperty.call(memory, songKey)) return true;
  delete memory[songKey];
  const ok = await safeStorageSet(folium.storage, memory);
  if (ok) { state.saved = false; notifyState(); }
  return ok;
};

const chooseMode = async (folium, ctx, setting) => {
  const songKey = getSongKey(ctx.song);
  const entries = readRegistry(folium);
  if (!entries.length) return null;
  if (songKey) {
    const memory = await safeStorageGet(folium.storage);
    const saved = entries.find((entry) => entry.mode === memory[songKey]);
    if (saved) return { entry: saved, saved: true };
    const picked = pickEntry(folium, state.mode);
    if (picked && setting === 'fixed' && !ctx.isPreview && folium.env?.context === 'main') {
      rememberInMemory(memory, songKey, picked.mode);
      const persisted = await safeStorageSet(folium.storage, memory);
      return { entry: picked, saved: persisted };
    }
    return picked ? { entry: picked, saved: false } : null;
  }
  const picked = pickEntry(folium, state.mode);
  return picked ? { entry: picked, saved: false } : null;
};

const renderSettingsPanel = (container, ctx) => {
  const style = document.createElement('style');
  style.textContent = `
    .lss-settings{display:grid;gap:10px;padding:2px 0 4px}.lss-settings-buttons{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .lss-settings button{border:1px solid var(--lss-border);background:var(--lss-bg);color:var(--lss-text);border-radius:10px;min-height:38px;padding:7px 10px;cursor:pointer;font:inherit;transition:.18s ease}
    .lss-settings button:hover{border-color:var(--lss-accent)}.lss-settings button[data-active=true]{background:var(--lss-accent);color:var(--lss-accent-text);border-color:var(--lss-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--lss-accent) 22%,transparent)}
    .lss-settings-note{color:var(--lss-muted);font-size:12px;line-height:1.45}`;
  const root = document.createElement('div'); root.className = 'lss-settings';
  const buttons = document.createElement('div'); buttons.className = 'lss-settings-buttons';
  const each = document.createElement('button'); const fixed = document.createElement('button');
  const note = document.createElement('div'); note.className = 'lss-settings-note';
  buttons.append(each, fixed); root.append(buttons, note); container.append(style, root);
  const paint = () => {
    const theme = ctx.getTheme(); const values = ctx.params.get();
    root.style.setProperty('--lss-bg', theme.backgroundColor); root.style.setProperty('--lss-text', theme.primaryColor);
    root.style.setProperty('--lss-muted', theme.secondaryColor); root.style.setProperty('--lss-accent', theme.accentColor);
    root.style.setProperty('--lss-accent-text', theme.backgroundColor); root.style.setProperty('--lss-border', `${theme.secondaryColor}66`);
    const locale = resolveLocale(ctx);
    each.textContent = label(locale, '每首歌都随机样式', 'Random for every song'); fixed.textContent = label(locale, '固定随机', 'Remember per song');
    each.dataset.active = String(values[SETTINGS_KEY] !== 'fixed'); fixed.dataset.active = String(values[SETTINGS_KEY] === 'fixed');
    note.textContent = values[SETTINGS_KEY] === 'fixed'
      ? label(locale, '每首歌的动画会保存到本地记忆文件。', 'The selected animation is saved locally for each song.')
      : label(locale, '每次换歌都会重新抽取；用爱心固定的歌曲会优先使用记忆。', 'A new animation is picked on every song change; songs fixed with the heart use their saved animation first.');
  };
  each.onclick = () => ctx.params.set({ [SETTINGS_KEY]: 'each' }); fixed.onclick = () => ctx.params.set({ [SETTINGS_KEY]: 'fixed' });
  paint(); const offParams = ctx.params.subscribe(paint); const offTheme = ctx.subscribe(paint);
  return () => { offParams(); offTheme(); style.remove(); root.remove(); };
};

const disableHostRandomModeIfNeeded = (folium, ctx) => {
  if (ctx?.isPreview || folium.env?.context !== 'main') return;
  try {
    const store = folium.internals?.stores?.visualizerSettings;
    const settings = store?.getState?.();
    if (!settings?.randomVisualizerModePerSong || typeof settings.handleToggleRandomVisualizerModePerSong !== 'function') return;
    settings.handleToggleRandomVisualizerModePerSong(false);
    const locale = resolveLocale(ctx);
    folium.ui.toast(label(locale, '随机歌词动画已接管每首歌随机设置', 'Random lyric animation now controls per-song random mode'), { type: 'info' });
  } catch (_) { /* best effort on older hosts */ }
};

const mountDelegatingVisualizer = (folium, container, ctx) => {
  let React; let ReactDOMClient;
  try { React = folium.internals?.React; ReactDOMClient = folium.internals?.ReactDOMClient; } catch (_) { /* export/older host */ }
  if (!React || !ReactDOMClient?.createRoot) {
    const fallback = document.createElement('div'); fallback.textContent = label('zh-CN', '当前 Folia 版本不支持完整随机渲染', 'This Folia version cannot render the full random registry.');
    fallback.style.cssText = 'display:grid;place-items:center;height:100%;opacity:.7;'; container.appendChild(fallback);
    return () => fallback.remove();
  }
  const audio = createAudioSignals(ctx);
  const renderHost = document.createElement('div');
  renderHost.style.cssText = 'position:absolute;inset:0;';
  container.appendChild(renderHost);
  const root = ReactDOMClient.createRoot(renderHost);
  let selected = null; let disposed = false;
  const live = !ctx.isPreview;
  if (live) disableHostRandomModeIfNeeded(folium, ctx);
  if (live) { state.active = true; state.mode = null; state.saved = false; state.songKey = getSongKey(ctx.song); notifyState(); }
  const disposeFavorite = live ? mountFavoriteLayer(folium, container, ctx) : () => {};
  let currentSetting = ctx.getSettings?.()[SETTINGS_KEY] || 'each';
  const repaint = () => {
    if (disposed || !selected) return;
    const entry = readRegistry(folium).find((candidate) => candidate.mode === selected.mode); if (!entry) return;
    root.render(React.createElement(React.Suspense, { fallback: null }, entry.render(buildRendererProps(folium, ctx, audio, entry))));
    state.mode = selected.mode; if (live) notifyState();
  };
  const select = async () => {
    currentSetting = ctx.getSettings?.()[SETTINGS_KEY] || 'each';
    const choice = await chooseMode(folium, ctx, currentSetting);
    if (!choice || disposed) return;
    selected = choice.entry;
    state.mode = selected.mode;
    state.saved = choice.saved;
    if (live) state.songKey = getSongKey(ctx.song);
    if (live) notifyState(); repaint();
  };
  const offClock = ctx.currentTime.on('change', () => audio.update());
  const offCtx = ctx.subscribe(() => {
    audio.update();
    const nextSetting = ctx.getSettings?.()[SETTINGS_KEY] || 'each';
    if (nextSetting !== currentSetting) { select(); return; }
    repaint();
  });
  select();
  return () => { disposed = true; offClock(); offCtx(); root.unmount(); disposeFavorite(); renderHost.remove(); if (live) { state.active = false; state.mode = null; state.songKey = null; state.saved = false; notifyState(); } };
};

const mountFavoriteLayer = (folium, container, ctx) => {
  const style = document.createElement('style'); style.textContent = `
    .lss-favorite{position:absolute;right:clamp(16px,4vw,32px);bottom:80px;z-index:40;width:48px;height:48px;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--lss-text);background:color-mix(in srgb,var(--lss-bg) 78%,transparent);border:1px solid var(--lss-border);border-radius:50%;backdrop-filter:blur(14px);box-shadow:0 8px 24px #0004;font:600 24px/1 system-ui,sans-serif;opacity:.78;transform:translateY(8px) scale(.92);pointer-events:none;transition:opacity .2s ease,transform .2s ease,border-color .2s ease,color .2s ease,background .2s ease}
    .lss-favorite[data-visible=true]{opacity:.78;transform:translateY(0) scale(1);pointer-events:auto}
    .lss-favorite[data-visible=true]:hover{opacity:1;transform:translateY(-2px) scale(1.06);border-color:var(--lss-accent)}
    .lss-favorite[data-chrome-hidden=true]{opacity:0;transform:translateY(8px) scale(.92);pointer-events:none}
    .lss-favorite[data-saved=true]{color:var(--lss-accent);border-color:var(--lss-accent)}
    .lss-favorite__icon{display:block;transform:translateY(-1px)}
    .lss-favorite__tooltip{position:absolute;right:0;bottom:56px;min-width:max-content;padding:7px 10px;border:1px solid var(--lss-border);border-radius:9px;background:color-mix(in srgb,var(--lss-bg) 92%,transparent);color:var(--lss-text);font:500 12px/1.2 system-ui,sans-serif;box-shadow:0 6px 18px #0003;opacity:0;pointer-events:none;transform:translateY(4px);transition:opacity .16s ease,transform .16s ease}
    .lss-favorite[data-visible=true]:hover .lss-favorite__tooltip{opacity:1;transform:translateY(0)}
  `;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'lss-favorite';
  button.setAttribute('aria-label', label(resolveLocale(ctx), '为这首歌固定当前动画', 'Keep this animation for this song'));
  const icon = document.createElement('span'); icon.className = 'lss-favorite__icon';
  const tooltip = document.createElement('span'); tooltip.className = 'lss-favorite__tooltip';
  button.append(icon, tooltip); container.append(style, button);
  const paint = () => {
    const theme = ctx.getTheme(); const active = state.active && state.songKey === getSongKey(ctx.song); const saved = Boolean(active && state.saved);
    const display = ctx.getDisplay?.() || {};
    container.style.setProperty('--lss-bg', theme.backgroundColor); container.style.setProperty('--lss-text', theme.primaryColor); container.style.setProperty('--lss-accent', theme.accentColor); container.style.setProperty('--lss-border', `${theme.secondaryColor}88`);
    button.dataset.visible = String(active); button.dataset.chromeHidden = String(Boolean(display.isPlayerChromeHidden)); button.dataset.saved = String(saved);
    const locale = resolveLocale(ctx);
    button.setAttribute('aria-label', saved ? label(locale, '取消固定此动画', 'Unpin this animation') : label(locale, '为这首歌固定当前动画', 'Keep this animation for this song'));
    icon.textContent = saved ? '♥' : '♡'; tooltip.textContent = saved ? label(locale, '点击取消固定', 'Click to unpin') : label(locale, '为这首歌固定当前动画', 'Keep this animation for this song');
  };
  button.onclick = async (event) => {
    event.stopPropagation();
    if (!state.mode) return;
    const songKey = getSongKey(ctx.song);
    const locale = resolveLocale(ctx);
    const wasSaved = state.saved;
    const ok = wasSaved
      ? await forgetCurrent(folium, songKey)
      : await rememberCurrent(folium, ctx, songKey, state.mode);
    if (ok) {
      folium.ui.toast(wasSaved ? label(locale, '已取消固定此动画', 'Animation unpinned') : label(locale, '已为这首歌固定当前动画', 'Animation saved for this song'), { type: 'success' });
      paint();
    }
  };
  paint(); const offState = listenState(paint); const offTheme = ctx.subscribe(paint);
  const localeObserver = typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
    ? new MutationObserver(paint) : null;
  localeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  return () => { offState(); offTheme(); localeObserver?.disconnect(); style.remove(); button.remove(); };
};

export default function activate(folium) {
  const visualizer = folium.registries.visualizers.register({
    id: 'random-lyric-style', label: { 'zh-CN': '随机', en: 'Random' }, order: 9999,
    hostLayers: { background: false, subtitles: false },
    settings: [{ key: SETTINGS_KEY, type: 'select', label: { 'zh-CN': '随机方式', en: 'Random mode' },
      options: [{ value: 'each', label: { 'zh-CN': '每首歌都随机样式', en: 'Random for every song' } }, { value: 'fixed', label: { 'zh-CN': '固定随机', en: 'Remember per song' } }], defaultValue: 'each' }],
    settingsPanel: renderSettingsPanel, mount: (container, ctx) => mountDelegatingVisualizer(folium, container, ctx),
  });
  return () => { visualizer.unregister(); };
}
