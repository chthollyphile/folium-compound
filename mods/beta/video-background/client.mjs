// client.mjs
export default function activate(folium) {
  const cleanups = [];
  const disposeAll = () => {
    cleanups.forEach((fn) => { try { fn(); } catch {} });
    cleanups.length = 0;
  };

  // ── 日志 ──
  let logEnabled = true;
  const logOnceFlags = new Set();
  async function loadLogEnabled() {
    try { const v = await folium.storage.get('logEnabled'); if (typeof v === 'boolean') logEnabled = v; } catch {}
  }
  async function saveLogEnabled(v) {
    logEnabled = v;
    try { await folium.storage.set('logEnabled', v); } catch {}
  }
  function log(level, message, details) {
    if (!logEnabled) return;
    try { folium.rpc.call('log', level, message, details); } catch {}
  }
  function logOnce(key, level, message, details) {
    if (logOnceFlags.has(key)) return;
    logOnceFlags.add(key);
    log(level, message, details);
  }
  log('info', 'activate called');

  // ── 歌曲 ID ──
  function extractSongId(st) {
    if (!st || typeof st !== 'object') return null;
    const candidates = [
      st.song?.id, st.currentSong?.id, st.track?.id, st.media?.id,
      st.songId, st.currentSongId, st.trackId, st.mediaId,
    ];
    for (const c of candidates) {
      if (c != null && c !== '') return c;
    }
    for (const k of Object.keys(st)) {
      const v = st[k];
      if (v && typeof v === 'object' && (typeof v.id === 'string' || typeof v.id === 'number')) {
        return v.id;
      }
    }
    return null;
  }

  // ── 状态 ──
  let currentSongId = null;
  let mappingCache = null;
  let blurValue = 8;
  let offsetValue = 0;
  let forceSyncEnabled = false;

  const mappingListeners = new Set();
  const blurListeners = new Set();
  const offsetListeners = new Set();
  const forceSyncListeners = new Set();
  const songIdListeners = new Set();

  function setCurrentSongId(id) {
    if (currentSongId === id) return;
    currentSongId = id;
    log('info', 'currentSongId updated', { songId: id });
    songIdListeners.forEach((fn) => { try { fn(id); } catch {} });
  }
  function onSongIdChange(fn) {
    songIdListeners.add(fn);
    return () => songIdListeners.delete(fn);
  }

  const offSongGlobal = folium.events.on('playback.songChanged', (event) => {
    setCurrentSongId(event.song?.id ?? null);
  });
  cleanups.push(offSongGlobal);

  (async () => {
    try {
      let st = folium.playback.getState();
      if (st && typeof st.then === 'function') st = await st;
      const id = extractSongId(st);
      if (id) {
        log('info', 'initial songId from getState', { songId: id });
        setCurrentSongId(id);
      }
    } catch (e) {
      log('warn', 'initial getState failed', String(e));
    }
  })();

  // ── 存储 ──
  async function loadMapping() {
    if (mappingCache) return mappingCache;
    try { mappingCache = (await folium.storage.get('videoMap')) ?? {}; }
    catch (e) { log('error', 'loadMapping threw', String(e)); mappingCache = {}; }
    return mappingCache;
  }
  async function saveMapping(map) {
    mappingCache = map;
    try { await folium.storage.set('videoMap', map); }
    catch (e) { log('error', 'saveMapping threw', String(e)); }
    mappingListeners.forEach((fn) => { try { fn(); } catch {} });
  }
  function onMappingChange(fn) { mappingListeners.add(fn); return () => mappingListeners.delete(fn); }

  async function loadBlur() {
    try { const v = await folium.storage.get('blurValue'); if (typeof v === 'number' && Number.isFinite(v)) blurValue = v; } catch {}
    return blurValue;
  }
  async function saveBlur(v) {
    blurValue = v;
    try { await folium.storage.set('blurValue', v); } catch {}
    blurListeners.forEach((fn) => { try { fn(v); } catch {} });
  }
  function onBlurChange(fn) { blurListeners.add(fn); return () => blurListeners.delete(fn); }

  async function loadOffset() {
    try { const v = await folium.storage.get('videoOffset'); if (typeof v === 'number' && Number.isFinite(v)) offsetValue = v; } catch {}
    return offsetValue;
  }
  async function saveOffset(v) {
    offsetValue = v;
    try { await folium.storage.set('videoOffset', v); } catch {}
    offsetListeners.forEach((fn) => { try { fn(v); } catch {} });
  }
  function onOffsetChange(fn) { offsetListeners.add(fn); return () => offsetListeners.delete(fn); }

  async function loadForceSync() {
    try { const v = await folium.storage.get('forceSync'); if (typeof v === 'boolean') forceSyncEnabled = v; } catch {}
    return forceSyncEnabled;
  }
  async function saveForceSync(v) {
    forceSyncEnabled = v;
    try { await folium.storage.set('forceSync', v); } catch {}
    forceSyncListeners.forEach((fn) => { try { fn(v); } catch {} });
  }
  function onForceSyncChange(fn) { forceSyncListeners.add(fn); return () => forceSyncListeners.delete(fn); }

  // ── 自动隐藏 ──
  function setupAutoHide() {
    try {
      folium.registries.styles.register({
        id: 'auto-hide-chrome',
        label: { 'zh-CN': '自动隐藏控制栏', en: 'Auto-hide Chrome' },
        css: `
          [data-folium-chrome], .player-controls, .control-bar,
          [class*="player-chrome"], [class*="PlayerChrome"],
          [class*="controls"], [class*="Controls"] { transition: opacity 0.5s ease; }
          .fv-hidden { opacity: 0 !important; pointer-events: none !important; }
        `,
      });
      log('info', 'auto-hide styles registered');
    } catch (e) { log('error', 'auto-hide styles register failed', String(e)); }

    let hideTimer = null;
    let mouseInside = false;
    const HIDE_DELAY = 3000;
    const SEL = [
      '[data-folium-chrome]', '.player-controls', '.control-bar',
      '[class*="player-chrome"]', '[class*="PlayerChrome"]',
      '[class*="controls"]', '[class*="Controls"]',
    ].join(', ');

    function hideChrome() {
      const els = document.querySelectorAll(SEL);
      if (els.length > 0) { els.forEach((el) => el.classList.add('fv-hidden')); log('info', 'hideChrome', { matched: els.length }); }
      else logOnce('hide-zero', 'warn', 'hideChrome: no element matched', {});
    }
    function showChrome() {
      const els = document.querySelectorAll(SEL);
      if (els.length > 0) els.forEach((el) => el.classList.remove('fv-hidden'));
    }
    function scheduleHide() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (mouseInside) hideChrome(); }, HIDE_DELAY);
    }
    const onMouseMove = () => { mouseInside = true; showChrome(); scheduleHide(); };
    const onMouseLeave = () => {
      mouseInside = false;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { if (!mouseInside) hideChrome(); }, HIDE_DELAY);
    };
    const onMouseEnter = () => { mouseInside = true; showChrome(); scheduleHide(); };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('mouseenter', onMouseEnter);
    scheduleHide();

    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('mouseenter', onMouseEnter);
    };
  }
  const disposeAutoHide = setupAutoHide();
  cleanups.push(disposeAutoHide);

  // ── 背景 ──
  folium.registries.backgrounds.register({
    id: 'video-bg',
    label: { 'zh-CN': '视频背景', en: 'Video Background' },
    async mount(container, ctx) {
      log('info', 'background mount start', {
        songId: currentSongId, hasCtx: !!ctx, hasContainer: !!container,
      });

      let wrapper = null;
      let videoEl = null;
      let syncTimer = null;
      let boostTimer = null;
      let boostUntil = 0;
      let disposed = false;
      let lastRenderedSongId = null;
      let lastRenderedSource = null;

      const globalDisposers = [];
      const localDisposers = [];

      const applyBlur = (px) => {
        if (wrapper) wrapper.style.filter = px > 0 ? `blur(${px}px)` : 'none';
      };
      const getState = () => {
        try {
          const s = folium.playback.getState();
          if (s && typeof s.then === 'function') return null;
          return s;
        } catch { return null; }
      };

      // ★ 关键修复：不再因为 paused=false 就短路
      // seek 期间 paused 可能为 false 但画面实际卡住，需要每次主动 play
      const ensurePlaying = (vid) => {
        const v = vid ?? videoEl;
        if (!v || disposed) return;
        try {
          const p = v.play();
          if (p && typeof p.catch === 'function') {
            p.catch((e) => logOnce('play-fail', 'warn', 'video play failed', String(e)));
          }
        } catch (e) {
          logOnce('play-throw', 'warn', 'video play throw', String(e));
        }
      };

      const alignVideo = (force, vid) => {
        const v = vid ?? videoEl;
        if (!v || disposed) { logOnce('align-novid', 'warn', 'alignVideo: no video', { vid: !!vid }); return; }
        const state = getState();
        if (!state) { logOnce('align-nostate', 'warn', 'alignVideo: no state', {}); return; }

        const musicPos = state.position ?? 0;
        const musicDur = state.duration ?? 0;
        const videoDur = v.duration;
        if (!Number.isFinite(videoDur) || videoDur <= 0) {
          logOnce('invalid-videodur', 'warn', 'alignVideo: invalid videoDur', { videoDur });
          return;
        }

        const playing = state.state === 'playing';
        if (!playing) {
          if (!v.paused) v.pause();
          logOnce('align-paused', 'info', 'alignVideo: music paused', { state: state.state });
          return;
        }

        const isEqualDuration = musicDur > 0 && Math.abs(musicDur - videoDur) < 0.5;
        const effectiveForce = forceSyncEnabled || isEqualDuration;
        const threshold = force ? 0.05 : (effectiveForce ? 1.0 : 0.5);

        let target = musicPos - offsetValue;
        if (target < 0) target = 0;

        log('info', 'alignVideo check', {
          musicPos: +musicPos.toFixed(2),
          videoPos: +v.currentTime.toFixed(2),
          target: +target.toFixed(2),
          threshold,
          force: !!force,
          forceSync: forceSyncEnabled,
          equalDuration: isEqualDuration,
        });

        const videoLonger = musicDur > 0 && videoDur >= musicDur - 0.5;
        const wantSeek = videoLonger
          ? Math.abs(v.currentTime - target) > threshold
          : Math.abs(v.currentTime - (((target % videoDur) + videoDur) % videoDur)) > threshold;

        if (wantSeek) {
          // ★ force seek 时先 pause，避免 seek 与已有 play 竞争
          if (force && !v.paused) {
            try { v.pause(); } catch {}
          }
          if (videoLonger) {
            if (v.loop) v.loop = false;
            if (target >= videoDur) { if (!v.paused) v.pause(); return; }
            v.currentTime = target;
            log('info', 'seek video to target', { target: +target.toFixed(2), force: !!force });
          } else {
            if (!v.loop) v.loop = true;
            const wrapped = ((target % videoDur) + videoDur) % videoDur;
            v.currentTime = wrapped;
            log('info', 'loop seek video', { wrapped: +wrapped.toFixed(2), force: !!force });
          }
        }

        // ★ 无条件 ensurePlaying（幂等），捕捉 seek 后"paused=false 但画面卡住"的情况
        ensurePlaying(v);
      };

      const clearLocal = () => {
        if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
        if (boostTimer) { clearInterval(boostTimer); boostTimer = null; }
        localDisposers.forEach((d) => { try { d?.(); } catch {} });
        localDisposers.length = 0;
        wrapper?.remove(); wrapper = null; videoEl = null;
      };

      const render = async (reason) => {
        log('info', 'render called', { reason, songId: currentSongId, disposed });
        if (disposed) { logOnce('render-disposed', 'warn', 'render: disposed'); return; }

        const songId = currentSongId;
        if (!songId) { logOnce('render-nosong', 'warn', 'render: no songId, skip'); return; }

        const map = await loadMapping();
        const keys = Object.keys(map);
        log('info', 'render: mapping loaded', { keys, songId });

        const source = map[songId];
        if (!source) {
          log('warn', 'render: source not found for song', { songId, keys });
          if (wrapper || videoEl) {
            clearLocal();
            lastRenderedSongId = null;
            lastRenderedSource = null;
          }
          return;
        }

        if (
          songId === lastRenderedSongId &&
          videoEl &&
          JSON.stringify(source) === JSON.stringify(lastRenderedSource)
        ) {
          log('info', 'render: skip (same song & source)', { reason, songId });
          return;
        }

        clearLocal();
        lastRenderedSongId = songId;
        lastRenderedSource = source;

        log('info', 'render: source found', { type: source.type });

        wrapper = document.createElement('div');
        wrapper.style.cssText = 'width:100%;height:100%;overflow:hidden;will-change:filter;';
        applyBlur(blurValue);
        container.appendChild(wrapper);

        if (source.type === 'local') {
          let handle = null;
          try { handle = await folium.ui.restoreFile(source.grantId); }
          catch (e) { log('error', 'restoreFile threw', String(e)); handle = null; }
          if (!handle?.url) {
            log('warn', 'render: restoreFile failed', { grantId: source.grantId, name: source.name });
            wrapper?.remove(); wrapper = null;
            lastRenderedSongId = null;
            lastRenderedSource = null;
            return;
          }
          log('info', 'restoreFile ok', { url: handle.url });

          const v = document.createElement('video');
          v.src = handle.url;
          v.muted = true;
          v.playsInline = true;
          v.preload = 'auto';  // ★ 预加载更多数据，减少 seek 解码等待
          v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          wrapper.appendChild(v);
          videoEl = v;
          log('info', 'video element created');

          // ★ seeked 事件里补一次 ensurePlaying，捕捉 seek 完成后的卡住状态
          const onSeeked = () => {
            if (disposed || videoEl !== v) return;
            const st = getState();
            if (st?.state === 'playing') {
              ensurePlaying(v);
            }
          };
          const onPause = () => {
            if (disposed || videoEl !== v) return;
            const st = getState();
            if (st?.state === 'playing') ensurePlaying(v);
          };
          const onError = () => log('error', 'video element error', {
            code: v.error?.code, message: v.error?.message,
          });
          v.addEventListener('seeked', onSeeked);
          v.addEventListener('pause', onPause);
          v.addEventListener('error', onError);
          localDisposers.push(() => {
            v.removeEventListener('seeked', onSeeked);
            v.removeEventListener('pause', onPause);
            v.removeEventListener('error', onError);
          });

          v.addEventListener('loadedmetadata', () => {
            if (disposed || videoEl !== v) return;
            const st = getState();
            const musicDur = st?.duration ?? 0;
            const isEqual = musicDur > 0 && Math.abs(musicDur - v.duration) < 0.5;
            const interval = (forceSyncEnabled || isEqual) ? 500 : 2000;
            log('info', 'video metadata loaded', {
              videoDur: v.duration, musicDur, forceSync: forceSyncEnabled,
              equalDuration: isEqual, intervalMs: interval,
            });
            syncTimer = setInterval(() => {
              if (disposed || videoEl !== v) return;
              // ★ boost 窗口内强制对齐
              const inBoost = Date.now() < boostUntil;
              alignVideo(inBoost, v);
            }, interval);
            alignVideo(true, v);
            ensurePlaying(v);
          }, { once: true });

          setTimeout(() => {
            if (disposed || videoEl !== v) return;
            if (v.readyState < 1) {
              log('warn', 'video metadata not loaded after 3s', {
                readyState: v.readyState, networkState: v.networkState, src: v.src,
              });
            }
          }, 3000);

          try {
            const off = ctx.onChange(() => { if (!disposed && videoEl === v) alignVideo(true, v); });
            if (typeof off === 'function') localDisposers.push(off);
          } catch (e) { log('error', 'ctx.onChange threw', String(e)); }
          ensurePlaying(v);
          return;
        }

        if (source.type === 'bilibili') {
          const url =
            `https://player.bilibili.com/player.html` +
            `?bvid=${encodeURIComponent(source.bvid)}` +
            `&page=${source.page ?? 1}` +
            `&autoplay=0&danmaku=0&high_quality=1`;
          try {
            const ec = document.createElement('div');
            ec.style.cssText = 'width:100%;height:100%;';
            wrapper.appendChild(ec);
            const rm = folium.ui.embed(ec, url, {
              title: 'Bilibili', allow: ['autoplay', 'encrypted-media'],
            });
            if (typeof rm === 'function') localDisposers.push(rm);
            log('info', 'bilibili embed created', { bvid: source.bvid });
          } catch (e) { log('error', 'bilibili embed threw', String(e)); }
        }
      };

      await loadBlur();
      await loadOffset();
      await loadForceSync();
      await render('mount-initial');

      const offSong = folium.events.on('playback.songChanged', () => queueMicrotask(() => render('songChanged')));
      const offSongId = onSongIdChange(() => queueMicrotask(() => render('songIdChanged')));
      const offMapping = onMappingChange(() => render('mappingChanged'));
      const offBlur = onBlurChange(applyBlur);
      const offOffset = onOffsetChange(() => alignVideo(true));
      const offForce = onForceSyncChange(() => alignVideo(true));
      globalDisposers.push(() => { try { offSong?.(); } catch {} });
      globalDisposers.push(() => { try { offSongId?.(); } catch {} });
      globalDisposers.push(() => { try { offMapping?.(); } catch {} });
      globalDisposers.push(() => { try { offBlur?.(); } catch {} });
      globalDisposers.push(() => { try { offOffset?.(); } catch {} });
      globalDisposers.push(() => { try { offForce?.(); } catch {} });

      // ★ boost 机制：后台恢复后 500ms 内每 100ms 强制对齐一次
      // 覆盖浏览器渲染管线恢复 + seek 解码窗口
      const startBoost = () => {
        if (disposed) return;
        boostUntil = Date.now() + 1500;  // 期间 syncTimer 里也用 force
        if (boostTimer) clearInterval(boostTimer);
        let n = 0;
        boostTimer = setInterval(() => {
          if (disposed || document.hidden) {
            clearInterval(boostTimer);
            boostTimer = null;
            return;
          }
          alignVideo(true);
          ensurePlaying();
          n++;
          if (n >= 5) {
            clearInterval(boostTimer);
            boostTimer = null;
          }
        }, 100);
      };

      const onVisible = () => {
        if (disposed || document.hidden) return;
        log('info', 'visibility restored, kick boost realign');
        alignVideo(true);
        ensurePlaying();
        startBoost();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      globalDisposers.push(() => {
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      });

      return () => {
        disposed = true;
        clearLocal();
        globalDisposers.forEach((d) => { try { d?.(); } catch {} });
        log('info', 'background unmount');
      };
    },
  });

  // ── Visualizer: 无歌词 ──
  try {
    folium.registries.visualizers.register({
      id: 'no-lyrics',
      label: { 'zh-CN': '无歌词（纯视频）', en: 'No Lyrics' },
      hostLayers: { background: true, subtitles: false },
      mount(container) { container.replaceChildren(); return () => {}; },
    });
    log('info', 'visualizer no-lyrics registered');
  } catch (e) { log('error', 'no-lyrics register failed', String(e)); }

  // ── Visualizer: 电影字幕 ──
  try {
    folium.registries.visualizers.register({
      id: 'cinema-subtitle',
      label: { 'zh-CN': '电影字幕', en: 'Cinema Subtitle' },
      hostLayers: { background: true, subtitles: false },
      mount(container, ctx) {
        const root = document.createElement('div');
        root.style.cssText =
          'position:absolute;left:0;right:0;bottom:88px;' +
          'display:flex;justify-content:center;pointer-events:none;' +
          'padding:0 8%;z-index:5;';
        const line = document.createElement('div');
        line.style.cssText =
          'font-size:22px;line-height:1.4;' +
          'color:var(--folium-accent,var(--folium-theme-color,#ffffff));' +
          'text-align:center;text-shadow:0 2px 8px rgba(0,0,0,0.85);' +
          'font-weight:500;max-width:100%;word-break:break-word;' +
          'transition:none;white-space:pre-wrap;';
        root.appendChild(line);
        container.appendChild(root);
        let disposed = false;
        const getIdx = () => {
          try { if (typeof ctx.getLineIndex === 'function') { const v = ctx.getLineIndex(); if (v != null) return v; } } catch {}
          if (typeof ctx.currentLineIndex === 'number') return ctx.currentLineIndex;
          return null;
        };
        const update = () => {
          if (disposed) return;
          let text = '';
          try {
            const idx = getIdx();
            if (idx != null && Array.isArray(ctx.lines) && ctx.lines[idx])
              text = ctx.lines[idx].fullText ?? ctx.lines[idx].text ?? '';
          } catch {}
          if (line.textContent !== text) line.textContent = text;
        };
        try { ctx.onChange(update); } catch {}
        update();
        return () => { disposed = true; root.remove(); };
      },
    });
    log('info', 'visualizer cinema-subtitle registered');
  } catch (e) { log('error', 'cinema-subtitle register failed', String(e)); }

  // ── 播放器面板 ──
  folium.registries.playerPanelTabs.register({
    id: 'video-config',
    label: { 'zh-CN': '视频背景', en: 'Video BG' },
    async mount(container) {
      const root = document.createElement('div');
      root.style.cssText = 'padding:16px;font-size:14px;color:var(--folium-text);max-width:420px;';

      async function resolveSongId() {
        try {
          let st = folium.playback.getState();
          if (st && typeof st.then === 'function') st = await st;
          const id = extractSongId(st);
          if (id) return id;
        } catch {}
        return currentSongId;
      }

      let lastPanelSongId = undefined;
      const render = async (force) => {
        await loadBlur();
        await loadOffset();
        await loadForceSync();
        await loadLogEnabled();

        let songId = await resolveSongId();
        if (songId) setCurrentSongId(songId);

        if (!force && songId === lastPanelSongId && root.childElementCount > 0) {
          const bv = root.querySelector('#blur-val');
          if (bv) bv.textContent = `${blurValue}px`;
          const bs = root.querySelector('#blur-slider');
          if (bs) bs.value = blurValue;
          const ov = root.querySelector('#offset-val');
          if (ov) ov.textContent = `${offsetValue.toFixed(1)}s`;
          const os = root.querySelector('#offset-slider');
          if (os) os.value = offsetValue;
          const fs = root.querySelector('#force-sync');
          if (fs) fs.checked = forceSyncEnabled;
          const lt = root.querySelector('#log-toggle');
          if (lt) lt.checked = logEnabled;
          return;
        }
        lastPanelSongId = songId;

        const map = await loadMapping();
        const current = songId ? map[songId] : null;
        const currentLabel = !current
          ? '未配置'
          : current.type === 'local'
            ? `本地视频：${escapeHtml(current.name ?? '已选择')}`
            : `Bilibili：${escapeHtml(current.bvid)}`;

        root.innerHTML = `
          <p style="margin:0 0 4px;opacity:.7;">歌曲 ID</p>
          <p style="margin:0 0 12px;font-family:monospace;font-size:12px;word-break:break-all;">${
            songId ? escapeHtml(String(songId)) : '（无播放歌曲）'
          }</p>
          <p style="margin:0 0 16px;">当前配置：${currentLabel}</p>

          <div style="margin-bottom:20px;padding-top:12px;border-top:1px solid var(--folium-border);">
            <label style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span>背景模糊度</span><span id="blur-val">${blurValue}px</span>
            </label>
            <input id="blur-slider" type="range" min="0" max="30" step="1" value="${blurValue}" style="width:100%;" />
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span>视频偏移（正 = 视频晚）</span><span id="offset-val">${offsetValue.toFixed(1)}s</span>
            </label>
            <input id="offset-slider" type="range" min="-10" max="10" step="0.1" value="${offsetValue}" style="width:100%;" />
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input id="force-sync" type="checkbox" ${forceSyncEnabled ? 'checked' : ''} />
              <span>强制归正（每 0.5 秒检测，误差 1 秒内）</span>
            </label>
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input id="log-toggle" type="checkbox" ${logEnabled ? 'checked' : ''} />
              <span>启用调试日志</span>
            </label>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="pick-local" style="padding:8px 12px;" ${!songId ? 'disabled' : ''}>选择本地视频</button>
            <input id="bvid-input" placeholder="Bilibili BVID"
              value="${current?.type === 'bilibili' ? escapeAttr(current.bvid) : ''}"
              ${!songId ? 'disabled' : ''}
              style="padding:8px;border-radius:6px;border:1px solid var(--folium-border);background:transparent;color:inherit;" />
            <button id="save-bili" style="padding:8px 12px;" ${!songId ? 'disabled' : ''}>保存 Bilibili 视频</button>
            <button id="clear" style="padding:8px 12px;opacity:.8;" ${!songId ? 'disabled' : ''}>清除当前歌曲的视频</button>
          </div>

          <div style="margin-top:20px;padding-top:12px;border-top:1px solid var(--folium-border);">
            <p style="margin:0 0 8px;opacity:.7;">歌词模式</p>
            <div style="display:flex;gap:8px;">
              <button id="mode-no-lyrics" style="flex:1;padding:8px;">无歌词</button>
              <button id="mode-cinema" style="flex:1;padding:8px;">电影字幕</button>
            </div>
          </div>
        `;

        root.querySelector('#blur-slider').oninput = (e) => {
          const v = Number(e.target.value);
          root.querySelector('#blur-val').textContent = `${v}px`;
          saveBlur(v);
        };
        root.querySelector('#offset-slider').oninput = (e) => {
          const v = Number(e.target.value);
          root.querySelector('#offset-val').textContent = `${v.toFixed(1)}s`;
          saveOffset(v);
        };
        root.querySelector('#force-sync').onchange = (e) => {
          saveForceSync(e.target.checked);
          log('info', 'forceSync toggled', { value: e.target.checked });
        };
        root.querySelector('#log-toggle').onchange = (e) => saveLogEnabled(e.target.checked);

        root.querySelector('#pick-local').onclick = async () => {
          if (!songId) return;
          try {
            const handle = await folium.ui.pickFile({ accept: 'video', persist: true });
            if (!handle) return;
            const next = { ...map, [songId]: { type: 'local', grantId: handle.grantId, name: handle.name } };
            await saveMapping(next);
            log('info', 'local video picked', { name: handle.name, grantId: handle.grantId });
            render(true);
          } catch (e) { log('error', 'pick file failed', String(e)); }
        };
        root.querySelector('#save-bili').onclick = async () => {
          if (!songId) return;
          const bvid = root.querySelector('#bvid-input').value.trim();
          if (!/^BV[0-9A-Za-z]+$/.test(bvid)) {
            try { folium.ui.toast('BVID 格式不正确', { type: 'error' }); } catch {}
            return;
          }
          const next = { ...map, [songId]: { type: 'bilibili', bvid, page: 1 } };
          await saveMapping(next);
          log('info', 'bilibili saved', { bvid });
          render(true);
        };
        root.querySelector('#clear').onclick = async () => {
          if (!songId) return;
          const next = { ...map };
          delete next[songId];
          await saveMapping(next);
          log('info', 'cleared', { songId });
          render(true);
        };

        const setMode = (mode) => {
          try {
            if (folium.visualizer?.setMode) folium.visualizer.setMode(mode);
            else if (folium.visualizers?.setMode) folium.visualizers.setMode(mode);
            else try { folium.ui.toast('当前版本不支持通过模组切换模式', { type: 'error' }); } catch {}
            log('info', 'mode set', { mode });
          } catch (e) { log('error', 'setMode failed', String(e)); }
        };
        root.querySelector('#mode-no-lyrics').onclick = () => setMode('mod:video-background:no-lyrics');
        root.querySelector('#mode-cinema').onclick = () => setMode('mod:video-background:cinema-subtitle');
      };

      const offSong = folium.events.on('playback.songChanged', () => queueMicrotask(() => render(true)));
      const offSongId = onSongIdChange(() => queueMicrotask(() => render(true)));
      await render(true);
      container.appendChild(root);

      return () => {
        try { offSong?.(); } catch {}
        try { offSongId?.(); } catch {}
        root.remove();
      };
    },
  });

  return () => {
    disposeAll();
    log('info', 'disposed');
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
function escapeAttr(s) { return escapeHtml(s); }