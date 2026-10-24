import { validBpm } from './rules.mjs';

export function songKey(song) {
  if (!song) return null;
  const ref = song.sourceRef;
  if (ref?.kind) return ref.kind === 'online' ? `online:${ref.providerId || 'netease'}:${ref.mediaId ?? song.id}` : `${ref.kind}:${ref.mediaId ?? song.id}`;
  if (song.isStage) return `stage:${song.id}`;
  if (song.localRef?.songId || song.isLocal) return `local:${song.localRef?.songId ?? song.id}`;
  if (song.isNavidrome || song.navidromeData?.isNavidrome) return `navidrome:${song.id}`;
  return `online:${song.providerId || song.source || 'netease'}:${song.id}`;
}
export function createHost(folium) {
  if (folium.host?.folia !== '0.7.22') throw new Error('此版本适配 Folia 0.7.22。');
  // This is a deprecated capability, not an old spelling of a public method.
  // Folium 1.7 has no public API for native mode selection or its random switch.
  // Keep the dependency explicit and the host pinned; do not hide its warning.
  let internal;
  try { internal = folium.internals; } catch { /* Explain a missing version-pinned internal surface. */ }
  if (!internal?.stores?.playback?.getState || !internal?.stores?.visualizerSettings?.getState) throw new Error('无法访问播放器状态，请确认版本并重新启用模组。');
  const store = internal.stores.visualizerSettings;
  if (typeof store.getState().handleSetVisualizerMode !== 'function') throw new Error('当前版本的样式切换接口不匹配。');
  return {
    modes() {
      const registry = internal.visualizerRegistry;
      const entries = Array.isArray(registry) ? registry : registry?.entries || [];
      return entries.filter(x => typeof x.mode === 'string').map(x => ({ id: x.mode, label: x.labelFallback || x.mode }));
    },
    context() {
      const state = internal.stores.playback.getState();
      const song = state.transitionDisplay?.song ?? state.currentSong;
      if (!song) return null;
      const artists = Array.isArray(song.artists) ? song.artists.map(x => x?.name).filter(Boolean).join(' / ') : '';
      const key = songKey(song), showingTail = Boolean(state.transitionDisplay);
      return { key, song, title: song.name || song.title || '未命名歌曲', artist: artists, source: key.split(':')[0],
        duration: (song.duration || song.durationMs || song.dt || 0) / 1000,
        // During an Automix handover audioSrc can already belong to the other
        // deck; never analyse it under the displayed outgoing song's identity.
        audioUrl: showingTail ? null : state.audioSrc, showingTail };
    },
    visualState() { const s = store.getState(); return { mode: s.visualizerMode, random: Boolean(s.randomVisualizerModePerSong) }; },
    setMode(mode) {
      if (!this.modes().some(x => x.id === mode)) throw new Error('目标歌词样式未加载：' + mode);
      const s = store.getState();
      if (s.randomVisualizerModePerSong) s.handleToggleRandomVisualizerModePerSong(false, { notify: false });
      s.handleSetVisualizerMode(mode, { notify: false });
    },
    setRandom(value) { store.getState().handleToggleRandomVisualizerModePerSong?.(value, { notify: false }); },
    onMode(fn) { return store.subscribe(() => fn(this.visualState())); },
    onPlayback(fn) { return internal.stores.playback.subscribe(fn); },
  };
}

export async function nativeBpm(context, dbFactory = globalThis.indexedDB) {
  const direct = [context.song.bpm, context.song.tempo, context.song.localData?.bpm].find(validBpm);
  if (direct !== undefined) return { bpm: Number(direct), confidence: null, source: '歌曲元数据' };
  if (!dbFactory?.databases || !globalThis.IDBKeyRange) return null;
  const databases = await dbFactory.databases();
  if (!databases.some(x => x.name === 'KineticPlayerDB')) return null;
  return new Promise(resolve => {
    const request = dbFactory.open('KineticPlayerDB');
    let done = false, db;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); db?.close(); resolve(value); };
    const timer = setTimeout(() => finish(null), 1500);
    request.onerror = () => finish(null);
    request.onupgradeneeded = () => { request.transaction?.abort(); finish(null); };
    request.onsuccess = () => {
      db = request.result;
      if (done) { db.close(); return; }
      db.onversionchange = () => { db.close(); finish(null); };
      const tables = ['metadata_cache', 'api_cache'].filter(x => db.objectStoreNames.contains(x));
      if (!tables.length) return finish(null);
      const matches = [], prefix = `automix_profile_${context.key}`;
      const transaction = db.transaction(tables, 'readonly');
      transaction.onabort = transaction.onerror = () => finish(null);
      transaction.oncomplete = () => {
        matches.sort((a, b) => b.timestamp - a.timestamp);
        const result = matches.find(x => validBpm(x.data?.bpm) && x.data.version === 9);
        finish(result ? { bpm: Number(result.data.bpm), confidence: null,
          source: result.data.gridless === false ? 'Folia 节拍分析缓存' : 'Folia BPM 估算缓存' } : null);
      };
      for (const table of tables) {
        const cursor = transaction.objectStore(table).openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
        let count = 0;
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item || count++ >= 16) return;
          // Exact source identity or one of its transcoded representations only.
          if (item.key === prefix || String(item.key).startsWith(prefix + '@')) matches.push(item.value);
          item.continue();
        };
      }
    };
  });
}
