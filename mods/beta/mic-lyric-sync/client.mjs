// client.mjs — 整合式麥克風即時聽歌同步歌詞 (透過 folium.rpc 驅動內建主行程引擎)
import {
  formatMicOptionLabel,
  formatSystemDefaultMicLabel,
  getLocaleMap,
  resolveLocale,
  t
} from './i18n.mjs';
import { createPlaybackGuard } from './playbackGuard.mjs';

const DEFAULT_POLL_INTERVAL_SEC = 30;
const MIN_POLL_INTERVAL_SEC = 5;
const MAX_POLL_INTERVAL_SEC = 300;

export function promptInstallConsent(loc, status) {
  const uvVersion = status?.uvVersion || '0.12.4';
  const pyVersion = status?.managedPythonVersion || '3.12';
  const packages = Array.isArray(status?.packages) && status.packages.length > 0
    ? status.packages.join(', ')
    : 'shazamio, sounddevice, numpy';
  const dataDir = status?.dataDir || '(Folia mods-data/mic-lyric-sync)';

  const titleText = t(loc, 'consent.title');
  const introText = t(loc, 'consent.intro');
  const downloadsTitle = t(loc, 'consent.downloadsTitle');
  const downloadUv = t(loc, 'consent.downloadUv', { uvVersion, pyVersion });
  const downloadPkgs = t(loc, 'consent.downloadPkgs', { packages });
  const sizeTitle = t(loc, 'consent.sizeTitle');
  const sizeDesc = t(loc, 'consent.sizeDesc');
  const storageTitle = t(loc, 'consent.storageTitle');
  const storageDesc = t(loc, 'consent.storageDesc', { dataDir });

  if (globalThis.document?.body) {
    return new Promise((resolve) => {
      const dark = detectPanelDarkMode(globalThis.document.body);
      const overlay = globalThis.document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:99999',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px',
        'background:rgba(0,0,0,0.55)'
      ].join(';');

      const card = globalThis.document.createElement('div');
      card.style.cssText = [
        'max-width:480px',
        'width:100%',
        'border-radius:12px',
        'padding:18px 20px',
        'display:flex',
        'flex-direction:column',
        'gap:10px',
        'font-family:var(--folium-font, system-ui, sans-serif)',
        'font-size:13px',
        'line-height:1.5',
        `background:${dark ? '#1e2025' : '#ffffff'}`,
        `color:${dark ? '#f4f4f5' : '#18181b'}`,
        `border:1px solid ${dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'}`,
        'box-shadow:0 16px 40px rgba(0,0,0,0.35)'
      ].join(';');

      const h3 = globalThis.document.createElement('div');
      h3.style.cssText = 'font-size:15px;font-weight:600;';
      h3.textContent = titleText;

      const pIntro = globalThis.document.createElement('div');
      pIntro.textContent = introText;

      const secDl = globalThis.document.createElement('div');
      secDl.style.cssText = 'font-weight:600;margin-top:2px;';
      secDl.textContent = downloadsTitle;

      const listDl = globalThis.document.createElement('div');
      listDl.style.cssText = 'white-space:pre-line;opacity:0.9;font-size:12px;';
      listDl.textContent = `${downloadUv}\n${downloadPkgs}`;

      const secSize = globalThis.document.createElement('div');
      secSize.style.cssText = 'font-weight:600;margin-top:2px;';
      secSize.textContent = sizeTitle;

      const pSize = globalThis.document.createElement('div');
      pSize.style.cssText = 'opacity:0.9;font-size:12px;';
      pSize.textContent = sizeDesc;

      const secStore = globalThis.document.createElement('div');
      secStore.style.cssText = 'font-weight:600;margin-top:2px;';
      secStore.textContent = storageTitle;

      const pStore = globalThis.document.createElement('div');
      pStore.style.cssText = [
        'white-space:pre-wrap',
        'word-break:break-all',
        'font-size:12px',
        'padding:8px 10px',
        'border-radius:8px',
        `background:${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`
      ].join(';');
      pStore.textContent = storageDesc;

      const btnRow = globalThis.document.createElement('div');
      btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:6px;';

      const cancelBtn = globalThis.document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = t(loc, 'consent.cancel');
      cancelBtn.style.cssText = [
        'padding:7px 14px',
        'border-radius:8px',
        `border:1px solid ${dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
        'background:transparent',
        'color:inherit',
        'cursor:pointer',
        'font-size:12px'
      ].join(';');

      const agreeBtn = globalThis.document.createElement('button');
      agreeBtn.type = 'button';
      agreeBtn.textContent = t(loc, 'consent.agree');
      agreeBtn.style.cssText = [
        'padding:7px 14px',
        'border-radius:8px',
        'border:none',
        'background:#2563eb',
        'color:#ffffff',
        'cursor:pointer',
        'font-size:12px',
        'font-weight:600'
      ].join(';');

      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };
      cancelBtn.addEventListener('click', () => cleanup(false));
      agreeBtn.addEventListener('click', () => cleanup(true));

      btnRow.append(cancelBtn, agreeBtn);
      card.append(h3, pIntro, secDl, listDl, secSize, pSize, secStore, pStore, btnRow);
      overlay.appendChild(card);
      globalThis.document.body.appendChild(overlay);
    });
  }

  if (typeof globalThis.confirm === 'function') {
    const msg = `${titleText}\n\n${introText}\n\n${downloadsTitle}\n${downloadUv}\n${downloadPkgs}\n\n${sizeTitle}\n${sizeDesc}\n\n${storageTitle}\n${storageDesc}`;
    return Promise.resolve(Boolean(globalThis.confirm(msg)));
  }

  return Promise.resolve(false);
}

export async function ensureInstallConsent(folium, loc) {
  let status = null;
  try {
    status = await folium.rpc.call('getEnvStatus');
  } catch {
    return true;
  }
  if (!status || status.consented || status.ready || status.needsConsent === false || status.needsConsent === undefined) {
    return true;
  }
  const agreed = await promptInstallConsent(loc, status);
  if (!agreed) return false;
  await folium.rpc.call('grantInstallConsent');
  return true;
}

export function clampPollInterval(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return DEFAULT_POLL_INTERVAL_SEC;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_POLL_INTERVAL_SEC;
  return Math.max(MIN_POLL_INTERVAL_SEC, Math.min(MAX_POLL_INTERVAL_SEC, Math.round(n)));
}

export function getSongKey(song) {
  if (!song) return '';
  return `${song.source || ''}::${song.id ?? ''}`;
}

export function shouldResumeAfterSongEnd(playbackState, trackedSongKey) {
  if (!trackedSongKey) return false;
  if (!playbackState || !playbackState.song) return true;
  if (getSongKey(playbackState.song) !== trackedSongKey) return true;
  if (playbackState.state === 'ended' || playbackState.state === 'stopped') return true;
  const duration = Number(playbackState.duration || 0);
  const position = Number(playbackState.position || 0);
  if (duration > 0 && position >= duration - 0.5) return true;
  return false;
}

export function isLightColor(cssColor) {
  if (!cssColor || typeof cssColor !== 'string') return null;
  const match = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return null;
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 140;
}

export function detectPanelDarkMode(el) {
  try {
    if (el && typeof globalThis.getComputedStyle === 'function') {
      const lightText = isLightColor(globalThis.getComputedStyle(el).color);
      if (lightText !== null) return lightText;
    }
  } catch {}
  try {
    const docEl = globalThis.document?.documentElement;
    if (docEl) {
      const theme = String(docEl.dataset?.theme || docEl.getAttribute?.('data-theme') || '').toLowerCase();
      if (theme.includes('dark') || docEl.classList?.contains('dark')) return true;
      if (theme.includes('light') || docEl.classList?.contains('light')) return false;
    }
  } catch {}
  try {
    if (typeof globalThis.matchMedia === 'function') {
      return Boolean(globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  } catch {}
  return false;
}

export default function activate(folium) {
  if (folium.env.context !== 'main') return;
  if (folium.host.folium.minor < 7) {
    folium.log.warn(t(resolveLocale('auto', folium), 'warn.requireFolium'));
    return;
  }

  let syncEnabled = false;
  let recognitionPaused = false;
  let trackedSongKey = '';
  let songEndWatchTimer = null;
  let lastTrackSig = '';
  let songStartRefMs = 0; // 用於平滑多輪 Shazam 偏移的中位數基準時間
  let anchorSamples = []; // 儲存同一首歌最近 5 輪推算出的 t0 (trackStartWallClockMs)
  const buttonUpdaters = new Set();
  const playbackGuard = createPlaybackGuard(folium);

  const settingsSection = folium.registries.settingsSections.register({
    id: 'prefs',
    label: getLocaleMap('section.label'),
    description: getLocaleMap('section.description'),
    settings: [
      {
        key: 'language',
        type: 'text',
        label: getLocaleMap('setting.language'),
        defaultValue: 'auto'
      },
      {
        key: 'pythonMode',
        type: 'text',
        label: getLocaleMap('setting.pythonMode'),
        defaultValue: 'auto'
      },
      {
        key: 'customPythonPath',
        type: 'text',
        label: getLocaleMap('setting.customPythonPath'),
        defaultValue: ''
      },
      {
        key: 'micDeviceId',
        type: 'text',
        label: getLocaleMap('setting.micDeviceId'),
        defaultValue: ''
      },
      {
        key: 'pollIntervalSec',
        type: 'number',
        label: getLocaleMap('setting.pollIntervalSec'),
        min: MIN_POLL_INTERVAL_SEC,
        max: MAX_POLL_INTERVAL_SEC,
        step: 1,
        defaultValue: DEFAULT_POLL_INTERVAL_SEC
      },
      {
        key: 'pauseUntilSongEnd',
        type: 'boolean',
        label: getLocaleMap('setting.pauseUntilSongEnd'),
        defaultValue: true
      },
      {
        key: 'driftThresholdSec',
        type: 'number',
        label: getLocaleMap('setting.driftThresholdSec'),
        min: 0.5,
        max: 15,
        step: 0.1,
        defaultValue: 5
      },
      {
        key: 'offsetAdjustSec',
        type: 'number',
        label: getLocaleMap('setting.offsetAdjustSec'),
        min: -5,
        max: 5,
        step: 0.1,
        defaultValue: 0
      },
      {
        key: 'autoMute',
        type: 'boolean',
        label: getLocaleMap('setting.autoMute'),
        defaultValue: true
      },
      {
        key: 'autoEnterPlayer',
        type: 'boolean',
        label: getLocaleMap('setting.autoEnterPlayer'),
        defaultValue: true
      },
      {
        key: 'preferredProvider',
        type: 'text',
        label: getLocaleMap('setting.preferredProvider'),
        defaultValue: ''
      }
    ],
    settingsPanel(container, panelCtx) {
      return mountSettingsPanel(container, panelCtx, folium);
    }
  });

  function getLocale() {
    return resolveLocale(settingsSection.settings.get()?.language, folium);
  }

  function stopSongEndWatcher() {
    if (songEndWatchTimer !== null) {
      clearInterval(songEndWatchTimer);
      songEndWatchTimer = null;
    }
  }

  async function resumeRecognitionFromPause(reasonKey = 'log.resumeAfterSongEnd') {
    stopSongEndWatcher();
    trackedSongKey = '';
    if (!recognitionPaused) return;
    recognitionPaused = false;
    lastTrackSig = '';
    songStartRefMs = 0;
    anchorSamples = [];
    if (!syncEnabled) return;
    folium.log.info(`[MicSync] ${t(getLocale(), reasonKey)}`);
    try {
      await folium.rpc.call('setRecognitionPaused', false);
    } catch {}
  }

  function startSongEndWatcher(song) {
    stopSongEndWatcher();
    trackedSongKey = getSongKey(song);
    if (!trackedSongKey) return;
    songEndWatchTimer = setInterval(() => {
      if (!syncEnabled || !recognitionPaused) {
        stopSongEndWatcher();
        return;
      }
      const st = folium.playback.getState();
      if (shouldResumeAfterSongEnd(st, trackedSongKey)) {
        void resumeRecognitionFromPause();
      }
    }, 1000);
  }

  function notifyButtons() {
    for (const fn of buttonUpdaters) fn();
  }

  function recordAnchorSample(positionSec) {
    const now = performance.now();
    // 推算「歌曲 0:00 對應的本機 performance.now() 時刻」
    const projectedStartMs = now - positionSec * 1000;
    anchorSamples.push(projectedStartMs);
    if (anchorSamples.length > 5) anchorSamples.shift();
    const sorted = [...anchorSamples].sort((a, b) => a - b);
    songStartRefMs = sorted[Math.floor(sorted.length / 2)]; // 取中位數濾除單次抖動
  }

  function getSmoothedPos(cfg) {
    if (!songStartRefMs) return 0;
    const elapsedSec = (performance.now() - songStartRefMs) / 1000;
    return Math.max(0, elapsedSec + Number(cfg.offsetAdjustSec || 0));
  }

  async function nudgeTimeline(deltaSec) {
    const loc = getLocale();
    const state = folium.playback.getState();
    if (!state || !state.song) {
      folium.ui.toast(t(loc, 'toast.noCurrentSong'), { type: 'info', durationMs: 2000 });
      return;
    }
    const nextPos = Math.max(0, (state.position || 0) + deltaSec);
    await folium.playback.seek(nextPos);
    const sign = deltaSec >= 0 ? '+' : '';
    folium.ui.toast(
      t(loc, 'toast.timelineNudged', { sign, sec: deltaSec.toFixed(1) }),
      { type: 'info', durationMs: 1800 }
    );
  }

  async function handleRecognizedState(data) {
    if (!syncEnabled || !data || !data.ok || !data.title) return;
    const cfg = settingsSection.settings.get();
    const title = String(data.title).trim();
    const artist = String(data.artist || '').trim();
    const trackSig = `${title.toLowerCase()}::${artist.toLowerCase()}`;

    const currentState = folium.playback.getState();
    const isSameSong = trackSig === lastTrackSig && Boolean(currentState?.song);

    if (isSameSong) {
      recordAnchorSample(Number(data.position_sec || 0));
      const targetPos = getSmoothedPos(cfg);
      const currentPos = Number(currentState.position || 0);
      const drift = targetPos - currentPos;
      const threshold = Math.max(0.5, Math.min(15, Number(cfg.driftThresholdSec) || 5));
      if (Math.abs(drift) > threshold) {
        await folium.playback.seek(targetPos);
        folium.log.info(`[MicSync] 平滑誤差 ${drift.toFixed(2)}s 超過門檻 (${threshold}s)，已自動校正至 ${targetPos.toFixed(2)}s`);
      }
      return;
    }

    // 切換新歌：重置中位數樣本
    anchorSamples = [];
    recordAnchorSample(Number(data.position_sec || 0));

    const providerId = String(cfg.preferredProvider || '').trim() || undefined;
    const query = artist ? `${title} ${artist}` : title;
    let page = await folium.omni.searchSongs(query, { providerId, limit: 5 });
    if (!page.items.length && artist) {
      page = await folium.omni.searchSongs(title, { providerId, limit: 5 });
    }
    if (!syncEnabled) return;

    if (!page.items.length) {
      folium.log.warn(`[MicSync] 辨識「${title} - ${artist}」，但目前音源查無此曲`);
      lastTrackSig = trackSig;
      return;
    }

    const song = page.items[0];
    await playbackGuard.applyBeforePlay(Boolean(cfg.autoMute));
    await folium.playback.playSong(song);
    await playbackGuard.isolateQueueAfterPlay(song);
    await waitForPlaybackReady(folium, song, 3500);
    if (!syncEnabled) return;

    const finalPos = getSmoothedPos(cfg);
    await folium.playback.seek(finalPos);
    lastTrackSig = trackSig;

    // 450ms 後複查一次，避免串流剛緩衝完成把進度條彈回 0:00
    setTimeout(async () => {
      if (!syncEnabled || lastTrackSig !== trackSig) return;
      const st = folium.playback.getState();
      const expected = getSmoothedPos(settingsSection.settings.get());
      if (st && Math.abs(Number(st.position || 0) - expected) > 1.5) {
        await folium.playback.seek(expected);
      }
    }, 450);

    if (cfg.autoEnterPlayer) {
      folium.ui.navigate('player');
    }

    if (cfg.pauseUntilSongEnd !== false) {
      recognitionPaused = true;
      startSongEndWatcher(song);
      try {
        await folium.rpc.call('setRecognitionPaused', true);
      } catch {}
    }

    folium.ui.toast(
      t(getLocale(), 'toast.synced', {
        track: `${title}${artist ? ' - ' + artist : ''}`,
        time: formatTime(finalPos)
      }),
      { type: 'success', durationMs: 3000 }
    );
  }

  const offState = folium.rpc.on('state', (payload) => {
    void handleRecognizedState(payload);
  });

  const offSettingsWatch = settingsSection.settings.onChange((nextCfg) => {
    const intervalSec = clampPollInterval(nextCfg?.pollIntervalSec);
    void folium.rpc.call('setPollInterval', intervalSec).catch(() => {});
    void folium.rpc.call('setPythonConfig', {
      pythonMode: nextCfg?.pythonMode || 'auto',
      customPythonPath: nextCfg?.customPythonPath || ''
    }).catch(() => {});
    if (syncEnabled && recognitionPaused && nextCfg?.pauseUntilSongEnd === false) {
      void resumeRecognitionFromPause('log.resumeOptionDisabled');
    }
    notifyButtons();
  });

  async function toggleSync() {
    syncEnabled = !syncEnabled;
    notifyButtons();
    const loc = getLocale();

    if (syncEnabled) {
      const consentOk = await ensureInstallConsent(folium, loc);
      if (!consentOk) {
        syncEnabled = false;
        notifyButtons();
        folium.ui.toast(t(loc, 'toast.consentCancelled'), { type: 'info', durationMs: 2500 });
        return;
      }
      stopSongEndWatcher();
      recognitionPaused = false;
      trackedSongKey = '';
      lastTrackSig = '';
      songStartRefMs = 0;
      anchorSamples = [];
      const cfg = settingsSection.settings.get();
      const pollIntervalSec = clampPollInterval(cfg.pollIntervalSec);
      await playbackGuard.captureAndApplyOnStart(Boolean(cfg.autoMute));
      folium.ui.toast(t(loc, 'toast.starting'), { type: 'info', durationMs: 3000 });
      try {
        await folium.rpc.call('startSync', {
          deviceId: cfg.micDeviceId || '',
          pollIntervalSec,
          pythonMode: cfg.pythonMode || 'auto',
          customPythonPath: cfg.customPythonPath || ''
        });
      } catch (err) {
        syncEnabled = false;
        await playbackGuard.restoreOnStop();
        notifyButtons();
        folium.ui.toast(
          t(loc, 'toast.startFailed', { error: err?.message || err }),
          { type: 'error', durationMs: 4500 }
        );
      }
    } else {
      stopSongEndWatcher();
      recognitionPaused = false;
      trackedSongKey = '';
      try {
        await folium.rpc.call('stopSync');
      } finally {
        await playbackGuard.restoreOnStop();
      }
      folium.ui.toast(t(loc, 'toast.stopped'), { type: 'info', durationMs: 1800 });
    }
  }

  folium.registries.commands.register({
    id: 'toggle-sync',
    label: getLocaleMap('cmd.toggleSync'),
    keywords: ['mic', 'shazam', 'lyrics', 'sync', '麥克風', '麦克风', 'マイク', '字幕', '歌詞'],
    globalShortcut: true,
    run: () => toggleSync()
  });

  folium.registries.commands.register({
    id: 'nudge-forward',
    label: getLocaleMap('cmd.nudgeForward'),
    keywords: ['sync', 'offset', 'timeline', '微調', '微调', '調整'],
    globalShortcut: true,
    run: () => nudgeTimeline(0.5)
  });

  folium.registries.commands.register({
    id: 'nudge-backward',
    label: getLocaleMap('cmd.nudgeBackward'),
    keywords: ['sync', 'offset', 'timeline', '微調', '微调', '調整'],
    globalShortcut: true,
    run: () => nudgeTimeline(-0.5)
  });

  folium.registries.progressButtons.register({
    id: 'mic-sync-btn',
    slot: 'progress.trailing',
    hideWhenCollapsed: true,
    mount(container) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'width:28px',
        'height:28px',
        'border:none',
        'border-radius:999px',
        'background:transparent',
        'color:var(--folium-primary, currentColor)',
        'cursor:pointer',
        'padding:0'
      ].join(';');

      let disposed = false;
      const updateAppearance = async () => {
        if (disposed) return;
        btn.style.color = syncEnabled
          ? 'var(--folium-accent, #f43f5e)'
          : 'var(--folium-primary, currentColor)';
        btn.title = t(getLocale(), syncEnabled ? 'btn.syncActiveTitle' : 'btn.syncIdleTitle');
        const svg = await folium.ui.icon(syncEnabled ? 'radio' : 'mic', { size: 16, strokeWidth: 2 });
        if (!disposed && svg) btn.replaceChildren(svg);
      };

      const onClick = () => void toggleSync();
      btn.addEventListener('click', onClick);
      buttonUpdaters.add(updateAppearance);
      container.appendChild(btn);
      void updateAppearance();

      return () => {
        disposed = true;
        buttonUpdaters.delete(updateAppearance);
        btn.removeEventListener('click', onClick);
        btn.remove();
      };
    }
  });

  return () => {
    syncEnabled = false;
    recognitionPaused = false;
    trackedSongKey = '';
    stopSongEndWatcher();
    if (typeof offState === 'function') offState();
    if (typeof offSettingsWatch === 'function') offSettingsWatch();
    void folium.rpc.call('stopSync').catch(() => {});
    void playbackGuard.restoreOnStop();
    buttonUpdaters.clear();
  };
}

function mountSettingsPanel(container, panelCtx, folium) {
  const root = document.createElement('div');
  root.dataset.micLyricSyncPanel = '1';
  root.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:10px',
    'font-family:var(--folium-font, system-ui, sans-serif)',
    'color:var(--folium-primary, inherit)',
    'font-size:13px'
  ].join(';');

  const themeStyleEl = document.createElement('style');
  root.appendChild(themeStyleEl);

  function applySelectTheme() {
    const dark = detectPanelDarkMode(root);
    themeStyleEl.textContent = dark
      ? [
          '[data-mic-lyric-sync-panel] select { color-scheme: dark; background-color: #24262b !important; color: #f4f4f5 !important; border-color: rgba(255, 255, 255, 0.22) !important; }',
          '[data-mic-lyric-sync-panel] select option { background-color: #1e2025; color: #f4f4f5; }'
        ].join('\n')
      : [
          '[data-mic-lyric-sync-panel] select { color-scheme: light; background-color: #ffffff !important; color: #18181b !important; border-color: rgba(0, 0, 0, 0.2) !important; }',
          '[data-mic-lyric-sync-panel] select option { background-color: #ffffff; color: #18181b; }'
        ].join('\n');
  }

  const inputStyle = [
    'width:100%',
    'box-sizing:border-box',
    'padding:6px 10px',
    'border-radius:8px',
    'border:1px solid color-mix(in srgb, currentColor 20%, transparent)',
    'background:color-mix(in srgb, currentColor 6%, transparent)',
    'color:inherit',
    'font-size:13px'
  ].join(';');

  const btnStyle = [
    'padding:6px 12px',
    'border-radius:8px',
    'border:1px solid color-mix(in srgb, currentColor 22%, transparent)',
    'background:color-mix(in srgb, currentColor 10%, transparent)',
    'color:inherit',
    'cursor:pointer',
    'font-size:12px',
    'white-space:nowrap'
  ].join(';');

  const getPanelLocale = () => resolveLocale(panelCtx.settings.get()?.language, folium);

  let latestEnvStatus = null;
  const consentBanner = document.createElement('div');
  consentBanner.style.cssText = [
    'display:none',
    'flex-direction:column',
    'gap:8px',
    'padding:10px 12px',
    'border-radius:8px',
    'border:1px solid rgba(245, 158, 11, 0.45)',
    'background:rgba(245, 158, 11, 0.12)',
    'font-size:12px',
    'line-height:1.45'
  ].join(';');
  const consentBannerText = document.createElement('div');
  const consentBannerBtn = document.createElement('button');
  consentBannerBtn.type = 'button';
  consentBannerBtn.style.cssText = `${btnStyle};align-self:flex-start;font-weight:600;`;
  consentBanner.append(consentBannerText, consentBannerBtn);
  root.appendChild(consentBanner);

  const langWrap = document.createElement('label');
  langWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  const langTitle = document.createElement('span');
  langTitle.style.cssText = 'font-size:12px;opacity:0.85;';
  const langSelect = document.createElement('select');
  langSelect.style.cssText = inputStyle;
  const langAutoOpt = document.createElement('option');
  langAutoOpt.value = 'auto';
  const langZhTwOpt = document.createElement('option');
  langZhTwOpt.value = 'zh-TW';
  const langZhCnOpt = document.createElement('option');
  langZhCnOpt.value = 'zh-CN';
  const langJaOpt = document.createElement('option');
  langJaOpt.value = 'ja';
  const langEnOpt = document.createElement('option');
  langEnOpt.value = 'en';
  langSelect.append(langAutoOpt, langZhTwOpt, langZhCnOpt, langJaOpt, langEnOpt);
  langWrap.append(langTitle, langSelect);
  root.appendChild(langWrap);

  const pyWrap = document.createElement('div');
  pyWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  const pyTitle = document.createElement('span');
  pyTitle.style.cssText = 'font-size:12px;opacity:0.85;';
  const pySelect = document.createElement('select');
  pySelect.style.cssText = inputStyle;
  const pyAutoOpt = document.createElement('option');
  pyAutoOpt.value = 'auto';
  const pySystemOpt = document.createElement('option');
  pySystemOpt.value = 'system';
  const pyCustomOpt = document.createElement('option');
  pyCustomOpt.value = 'custom';
  const pyManagedOpt = document.createElement('option');
  pyManagedOpt.value = 'managed';
  pySelect.append(pyAutoOpt, pySystemOpt, pyCustomOpt, pyManagedOpt);

  const pyCustomWrap = document.createElement('label');
  pyCustomWrap.style.cssText = 'display:none;flex-direction:column;gap:4px;';
  const pyCustomTitle = document.createElement('span');
  pyCustomTitle.style.cssText = 'font-size:12px;opacity:0.85;';
  const pyCustomInput = document.createElement('input');
  pyCustomInput.type = 'text';
  pyCustomInput.style.cssText = inputStyle;
  pyCustomWrap.append(pyCustomTitle, pyCustomInput);

  pySelect.addEventListener('change', () => {
    const mode = pySelect.value || 'auto';
    pyCustomWrap.style.display = mode === 'custom' ? 'flex' : 'none';
    panelCtx.settings.set({ pythonMode: mode });
  });
  pyCustomInput.addEventListener('change', () => {
    panelCtx.settings.set({ customPythonPath: pyCustomInput.value.trim() });
  });

  pyWrap.append(pyTitle, pySelect, pyCustomWrap);
  root.appendChild(pyWrap);

  const micBox = document.createElement('div');
  micBox.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'padding:10px 12px',
    'border-radius:10px',
    'border:1px solid color-mix(in srgb, currentColor 15%, transparent)',
    'background:color-mix(in srgb, currentColor 4%, transparent)'
  ].join(';');

  const micTitle = document.createElement('div');
  micTitle.style.cssText = 'font-weight:600;font-size:13px;';

  const micRow = document.createElement('div');
  micRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

  const micSelect = document.createElement('select');
  micSelect.style.cssText = inputStyle + ';flex:1;';

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.style.cssText = btnStyle;

  micRow.append(micSelect, refreshBtn);

  const testRow = document.createElement('div');
  testRow.style.cssText = 'display:flex;gap:10px;align-items:center;';

  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.style.cssText = btnStyle;

  const meterTrack = document.createElement('div');
  meterTrack.style.cssText = [
    'flex:1',
    'height:10px',
    'border-radius:999px',
    'overflow:hidden',
    'background:color-mix(in srgb, currentColor 12%, transparent)'
  ].join(';');

  const meterFill = document.createElement('div');
  meterFill.style.cssText = [
    'width:0%',
    'height:100%',
    'border-radius:999px',
    'background:var(--folium-accent, #22c55e)',
    'transition:width 0.08s linear'
  ].join(';');
  meterTrack.appendChild(meterFill);

  const meterText = document.createElement('span');
  meterText.style.cssText = 'min-width:68px;text-align:right;font-size:12px;opacity:0.8;';

  testRow.append(testBtn, meterTrack, meterText);
  micBox.append(micTitle, micRow, testRow);
  root.appendChild(micBox);

  const pollIntervalField = addNumberField(
    root,
    '',
    MIN_POLL_INTERVAL_SEC,
    MAX_POLL_INTERVAL_SEC,
    1,
    inputStyle,
    (v) => {
      const clamped = clampPollInterval(v);
      pollIntervalField.input.value = String(clamped);
      panelCtx.settings.set({ pollIntervalSec: clamped });
    }
  );
  const pauseUntilEndField = addBoolField(
    root,
    '',
    (v) => panelCtx.settings.set({ pauseUntilSongEnd: v })
  );
  const driftField = addNumberField(root, '', 0.5, 15, 0.1, inputStyle, (v) => panelCtx.settings.set({ driftThresholdSec: v }));
  const offsetField = addNumberField(root, '', -5, 5, 0.1, inputStyle, (v) => panelCtx.settings.set({ offsetAdjustSec: v }));
  const providerField = addTextField(root, '', inputStyle, (v) => panelCtx.settings.set({ preferredProvider: v }));
  const autoMuteField = addBoolField(root, '', (v) => panelCtx.settings.set({ autoMute: v }));
  const autoPlayerField = addBoolField(root, '', (v) => panelCtx.settings.set({ autoEnterPlayer: v }));

  const logTitle = document.createElement('div');
  logTitle.style.cssText = 'font-size:12px;opacity:0.85;margin-top:4px;';

  const logPre = document.createElement('pre');
  logPre.style.cssText = [
    'margin:0',
    'padding:8px 10px',
    'max-height:150px',
    'overflow-y:auto',
    'border-radius:8px',
    'font-family:ui-monospace, Consolas, monospace',
    'font-size:11px',
    'line-height:1.45',
    'white-space:pre-wrap',
    'word-break:break-word',
    'background:color-mix(in srgb, currentColor 6%, transparent)',
    'border:1px solid color-mix(in srgb, currentColor 12%, transparent)'
  ].join(';');

  const footerRow = document.createElement('div');
  footerRow.style.cssText = 'display:flex;justify-content:space-between;gap:8px;margin-top:4px;';

  const updatePkgBtn = document.createElement('button');
  updatePkgBtn.type = 'button';
  updatePkgBtn.style.cssText = btnStyle;
  let updatingPkgs = false;
  updatePkgBtn.addEventListener('click', async () => {
    const loc = getPanelLocale();
    const consentOk = await ensureInstallConsent(folium, loc);
    if (!consentOk) {
      folium.ui.toast(t(loc, 'toast.consentCancelled'), { type: 'info', durationMs: 2500 });
      return;
    }
    await refreshEnvBanner(false);
    updatingPkgs = true;
    updatePkgBtn.disabled = true;
    updatePkgBtn.textContent = t(loc, 'panel.updatingPkg');
    try {
      const cur = panelCtx.settings.get();
      await folium.rpc.call('updatePackages', {
        pythonMode: cur?.pythonMode || 'auto',
        customPythonPath: cur?.customPythonPath || ''
      });
      folium.ui.toast(t(getPanelLocale(), 'toast.pkgUpdated'), { type: 'success', durationMs: 2500 });
    } catch (err) {
      folium.ui.toast(
        t(getPanelLocale(), 'toast.pkgUpdateFailed', { error: err?.message || err }),
        { type: 'error', durationMs: 4000 }
      );
    } finally {
      updatingPkgs = false;
      updatePkgBtn.disabled = false;
      updatePkgBtn.textContent = t(getPanelLocale(), 'panel.updatePkg');
    }
  });

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.style.cssText = btnStyle;
  resetBtn.addEventListener('click', () => panelCtx.settings.reset());

  footerRow.append(updatePkgBtn, resetBtn);
  root.append(logTitle, logPre, footerRow);
  container.appendChild(root);

  let testing = false;
  let scanning = false;
  let meterStatusKey = 'mic.levelIdle';
  let lastMicsData = { current_device_id: null, devices: [] };

  function renderMics(data) {
    if (data && typeof data === 'object') {
      lastMicsData = data;
    }
    const loc = getPanelLocale();
    const savedId = String(panelCtx.settings.get().micDeviceId || '');
    const devices = Array.isArray(lastMicsData?.devices) ? lastMicsData.devices : [];
    const defaultDev = devices.find((d) => d.is_default) || null;

    micSelect.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = formatSystemDefaultMicLabel(defaultDev, loc);
    micSelect.appendChild(defOpt);

    const availableValues = new Set(['']);
    for (const dev of devices) {
      const opt = document.createElement('option');
      const val = String(dev.id);
      opt.value = val;
      opt.textContent = formatMicOptionLabel(dev, loc);
      micSelect.appendChild(opt);
      availableValues.add(val);
    }
    micSelect.value = availableValues.has(savedId) ? savedId : '';
  }

  function applyTranslations() {
    const loc = getPanelLocale();
    langTitle.textContent = t(loc, 'setting.language');
    langAutoOpt.textContent = t(loc, 'setting.language.auto');
    langZhTwOpt.textContent = t(loc, 'setting.language.zh-TW');
    langZhCnOpt.textContent = t(loc, 'setting.language.zh-CN');
    langJaOpt.textContent = t(loc, 'setting.language.ja');
    langEnOpt.textContent = t(loc, 'setting.language.en');

    pyTitle.textContent = t(loc, 'panel.pythonModeLabel');
    pyAutoOpt.textContent = t(loc, 'panel.pythonMode.auto');
    pySystemOpt.textContent = t(loc, 'panel.pythonMode.system');
    pyCustomOpt.textContent = t(loc, 'panel.pythonMode.custom');
    pyManagedOpt.textContent = t(loc, 'panel.pythonMode.managed');
    pyCustomTitle.textContent = t(loc, 'panel.customPythonPathLabel');
    pyCustomInput.placeholder = t(loc, 'panel.customPythonPathPlaceholder');

    micTitle.textContent = t(loc, 'mic.panelTitle');
    refreshBtn.textContent = scanning ? t(loc, 'mic.scanning') : t(loc, 'mic.rescan');
    testBtn.textContent = testing ? t(loc, 'mic.testStop') : t(loc, 'mic.testStart');
    if (!testing) {
      meterText.textContent = t(loc, meterStatusKey);
    }

    pollIntervalField.title.textContent = t(loc, 'panel.pollIntervalLabel');
    pauseUntilEndField.title.textContent = t(loc, 'panel.pauseUntilSongEndLabel');
    driftField.title.textContent = t(loc, 'panel.driftThresholdLabel');
    offsetField.title.textContent = t(loc, 'panel.offsetAdjustLabel');
    providerField.title.textContent = t(loc, 'panel.preferredProviderLabel');
    autoMuteField.title.textContent = t(loc, 'panel.autoMuteLabel');
    autoPlayerField.title.textContent = t(loc, 'panel.autoEnterPlayerLabel');

    logTitle.textContent = t(loc, 'panel.logTitle');
    updatePkgBtn.textContent = updatingPkgs ? t(loc, 'panel.updatingPkg') : t(loc, 'panel.updatePkg');
    resetBtn.textContent = t(loc, 'panel.resetDefaults');
    consentBannerText.textContent = t(loc, 'panel.consentBanner', {
      dataDir: latestEnvStatus?.dataDir || '(Folia mods-data/mic-lyric-sync)'
    });
    consentBannerBtn.textContent = t(loc, 'panel.consentBtn');

    renderMics(lastMicsData);
  }

  async function refreshEnvBanner(autoScanIfReady = false) {
    try {
      const status = await folium.rpc.call('getEnvStatus');
      latestEnvStatus = status;
      const needsConsent = Boolean(status && status.needsConsent);
      consentBanner.style.display = needsConsent ? 'flex' : 'none';
      const loc = getPanelLocale();
      consentBannerText.textContent = t(loc, 'panel.consentBanner', {
        dataDir: status?.dataDir || '(Folia mods-data/mic-lyric-sync)'
      });
      if (autoScanIfReady && !needsConsent) {
        void scanMics(false);
      }
    } catch {
      consentBanner.style.display = 'none';
      if (autoScanIfReady) {
        void scanMics(false);
      }
    }
  }

  consentBannerBtn.addEventListener('click', async () => {
    const loc = getPanelLocale();
    const ok = await ensureInstallConsent(folium, loc);
    if (!ok) {
      folium.ui.toast(t(loc, 'toast.consentCancelled'), { type: 'info', durationMs: 2500 });
      return;
    }
    await refreshEnvBanner(true);
  });

  async function scanMics(showFeedback = false) {
    const loc = getPanelLocale();
    if (showFeedback) {
      const consentOk = await ensureInstallConsent(folium, loc);
      if (!consentOk) {
        folium.ui.toast(t(loc, 'toast.consentCancelled'), { type: 'info', durationMs: 2500 });
        return;
      }
      await refreshEnvBanner(false);
    }
    scanning = true;
    refreshBtn.disabled = true;
    refreshBtn.textContent = t(loc, 'mic.scanning');
    try {
      const res = await folium.rpc.call('listMics');
      renderMics(res);
      if (showFeedback && (!res?.devices || res.devices.length === 0)) {
        folium.ui.toast(t(getPanelLocale(), 'mic.noneFound'), { type: 'info', durationMs: 2500 });
      }
    } catch (err) {
      if (showFeedback) {
        folium.ui.toast(
          t(getPanelLocale(), 'mic.scanFailed', { error: err?.message || err }),
          { type: 'error', durationMs: 3500 }
        );
      }
    } finally {
      scanning = false;
      refreshBtn.disabled = false;
      refreshBtn.textContent = t(getPanelLocale(), 'mic.rescan');
    }
  }

  const offMics = folium.rpc.on('mics', renderMics);
  const offLevel = folium.rpc.on('level', (d) => {
    if (!testing) return;
    const loc = getPanelLocale();
    const pct = Math.min(100, Math.round(Number(d?.peak || 0) * 180));
    meterFill.style.width = `${pct}%`;
    meterText.textContent = pct < 1 ? t(loc, 'mic.levelSilent') : t(loc, 'mic.levelPercent', { pct });
  });
  const offLog = folium.rpc.on('log', (d) => {
    if (!d?.line) return;
    logPre.textContent = (logPre.textContent ? logPre.textContent + '\n' : '') + d.line;
    logPre.scrollTop = logPre.scrollHeight;
  });

  langSelect.addEventListener('change', () => {
    panelCtx.settings.set({ language: langSelect.value });
    applyTranslations();
  });

  micSelect.addEventListener('change', () => {
    panelCtx.settings.set({ micDeviceId: micSelect.value });
    void folium.rpc.call('selectMic', micSelect.value);
  });

  refreshBtn.addEventListener('click', () => {
    void scanMics(true);
  });

  testBtn.addEventListener('click', async () => {
    const loc = getPanelLocale();
    if (!testing) {
      const consentOk = await ensureInstallConsent(folium, loc);
      if (!consentOk) {
        folium.ui.toast(t(loc, 'toast.consentCancelled'), { type: 'info', durationMs: 2500 });
        return;
      }
      await refreshEnvBanner(false);
    }
    testing = !testing;
    testBtn.textContent = testing ? t(loc, 'mic.testStop') : t(loc, 'mic.testStart');
    if (!testing) {
      meterFill.style.width = '0%';
      meterStatusKey = 'mic.levelStopped';
      meterText.textContent = t(loc, meterStatusKey);
    } else {
      meterStatusKey = 'mic.levelOpening';
      meterText.textContent = t(loc, meterStatusKey);
    }
    void folium.rpc.call('setMicTest', testing).catch(() => {
      testing = false;
      const errLoc = getPanelLocale();
      testBtn.textContent = t(errLoc, 'mic.testStart');
      meterStatusKey = 'mic.levelFailed';
      meterText.textContent = t(errLoc, meterStatusKey);
    });
  });

  function syncFromSettings() {
    const v = panelCtx.settings.get();
    langSelect.value = v.language || 'auto';
    const pyMode = v.pythonMode || 'auto';
    pySelect.value = pyMode;
    pyCustomInput.value = v.customPythonPath || '';
    pyCustomWrap.style.display = pyMode === 'custom' ? 'flex' : 'none';
    micSelect.value = v.micDeviceId || '';
    pollIntervalField.input.value = String(clampPollInterval(v.pollIntervalSec));
    pauseUntilEndField.input.checked = v.pauseUntilSongEnd !== false;
    driftField.input.value = String(v.driftThresholdSec ?? 5);
    offsetField.input.value = String(v.offsetAdjustSec ?? 0);
    providerField.input.value = v.preferredProvider || '';
    autoMuteField.input.checked = Boolean(v.autoMute);
    autoPlayerField.input.checked = Boolean(v.autoEnterPlayer);
    applyTranslations();
  }

  const offChange = panelCtx.settings.onChange(syncFromSettings);
  syncFromSettings();
  applySelectTheme();

  let themeObserver = null;
  if (typeof MutationObserver === 'function' && globalThis.document?.documentElement) {
    themeObserver = new MutationObserver(() => applySelectTheme());
    themeObserver.observe(globalThis.document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme']
    });
  }
  const colorSchemeQuery =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onColorSchemeChange = () => applySelectTheme();
  if (colorSchemeQuery?.addEventListener) {
    colorSchemeQuery.addEventListener('change', onColorSchemeChange);
  }

  void refreshEnvBanner(true);
  void folium.rpc.call('getLogs').then((lines) => {
    if (Array.isArray(lines)) {
      logPre.textContent = lines.join('\n');
      logPre.scrollTop = logPre.scrollHeight;
    }
  });

  return () => {
    if (testing) void folium.rpc.call('setMicTest', false).catch(() => {});
    if (typeof offMics === 'function') offMics();
    if (typeof offLevel === 'function') offLevel();
    if (typeof offLog === 'function') offLog();
    if (typeof offChange === 'function') offChange();
    if (themeObserver) themeObserver.disconnect();
    if (colorSchemeQuery?.removeEventListener) {
      colorSchemeQuery.removeEventListener('change', onColorSchemeChange);
    }
    root.remove();
  };
}

function addTextField(parent, labelText, style, onCommit) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  const title = document.createElement('span');
  title.textContent = labelText;
  title.style.cssText = 'font-size:12px;opacity:0.85;';
  const input = document.createElement('input');
  input.type = 'text';
  input.style.cssText = style;
  input.addEventListener('change', () => onCommit(input.value));
  wrap.append(title, input);
  parent.appendChild(wrap);
  return { input, title };
}

function addNumberField(parent, labelText, min, max, step, style, onCommit) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  const title = document.createElement('span');
  title.textContent = labelText;
  title.style.cssText = 'font-size:12px;opacity:0.85;';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.style.cssText = style;
  input.addEventListener('change', () => {
    const n = Number(input.value);
    if (Number.isFinite(n)) onCommit(n);
  });
  wrap.append(title, input);
  parent.appendChild(wrap);
  return { input, title };
}

function addBoolField(parent, labelText, onCommit) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.addEventListener('change', () => onCommit(input.checked));
  const title = document.createElement('span');
  title.textContent = labelText;
  wrap.append(input, title);
  parent.appendChild(wrap);
  return { input, title };
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function waitForPlaybackReady(folium, targetSong, timeoutMs) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const st = folium.playback.getState();
    if (
      st?.song &&
      st.song.source === targetSong.source &&
      st.song.id === targetSong.id &&
      (st.state === 'playing' || (st.duration && st.duration > 0))
    ) {
      await new Promise((r) => setTimeout(r, 150));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
