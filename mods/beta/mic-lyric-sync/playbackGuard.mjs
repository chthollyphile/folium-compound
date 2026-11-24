// playbackGuard.mjs — 辨識期間停止自動播放下一首，並在關閉辨識時恢復使用者原本的播放與音量設定

const QUEUE_PAGE_SIZE = 500;
const MAX_RESTORE_QUEUE_ITEMS = 5000;

/**
 * 分頁讀取目前播放佇列中的所有歌曲 DTO。
 * @param {object} playback - folium.playback 物件
 * @returns {Array<object> | null} 歌曲列表；若 API 不可用或讀取失敗則回傳 null
 */
export function readAllQueueSongs(playback) {
  if (!playback || typeof playback.getQueue !== 'function') return null;
  try {
    const first = playback.getQueue(0, QUEUE_PAGE_SIZE);
    if (!first || !Array.isArray(first.items)) return null;

    const total = Math.min(Number(first.length || first.items.length), MAX_RESTORE_QUEUE_ITEMS);
    const songs = first.items.map((item) => item?.song).filter(Boolean);

    let offset = first.items.length;
    while (offset < total) {
      const page = playback.getQueue(offset, QUEUE_PAGE_SIZE);
      if (!page || !Array.isArray(page.items) || page.items.length === 0) break;
      for (const item of page.items) {
        if (item?.song) songs.push(item.song);
      }
      offset += page.items.length;
    }
    return songs;
  } catch {
    return null;
  }
}

/**
 * 建立播放設定守護器：
 * - 開啟辨識時記錄使用者原本的循環模式、音量/靜音與播放佇列，並關閉自動循環。
 * - 播放辨識到的歌曲前套用自動靜音，播放後將佇列隔離為單曲（避免播完自動跳下一首）。
 * - 關閉辨識或異常中止時恢復使用者原本的設定。
 * @param {object} folium - Folium 宿主物件
 */
export function createPlaybackGuard(folium) {
  let snapshot = null;

  function ensureSnapshot() {
    if (snapshot) return snapshot;
    const playback = folium?.playback;
    let loopMode = null;
    let volumeState = null;

    try {
      if (typeof playback?.getLoopMode === 'function') {
        loopMode = playback.getLoopMode();
      }
    } catch {}

    try {
      if (typeof playback?.getVolume === 'function') {
        const vol = playback.getVolume();
        if (vol && typeof vol === 'object') {
          volumeState = {
            volume: Number.isFinite(Number(vol.volume)) ? Number(vol.volume) : null,
            muted: typeof vol.muted === 'boolean' ? vol.muted : null
          };
        }
      }
    } catch {}

    const queueSongs = readAllQueueSongs(playback);

    snapshot = {
      loopMode,
      didChangeLoopMode: false,
      volumeState,
      didChangeVolumeOrMute: false,
      queueSongs,
      didChangeQueue: false
    };
    return snapshot;
  }

  function disableLoopPlayback(snap) {
    const playback = folium?.playback;
    if (typeof playback?.setLoopMode !== 'function') return;
    try {
      const current = typeof playback.getLoopMode === 'function' ? playback.getLoopMode() : snap.loopMode;
      if (current !== 'off') {
        playback.setLoopMode('off');
        snap.didChangeLoopMode = true;
      }
    } catch {}
  }

  async function captureAndApplyOnStart(autoMute = true) {
    const snap = ensureSnapshot();
    disableLoopPlayback(snap);

    const playback = folium?.playback;
    if (typeof playback?.pause === 'function') {
      try {
        await playback.pause();
      } catch {}
    }

    if (typeof playback?.replaceQueue === 'function' && typeof playback?.getQueue === 'function') {
      try {
        const currentQueue = playback.getQueue(0, 1);
        if (currentQueue && typeof currentQueue.version === 'string') {
          await playback.replaceQueue([], { expectedVersion: currentQueue.version });
          snap.didChangeQueue = true;
        }
      } catch {}
    }

    if (autoMute && typeof playback?.setMuted === 'function') {
      snap.didChangeVolumeOrMute = true;
      try {
        await playback.setMuted(true);
      } catch {}
    }
  }

  async function applyBeforePlay(autoMute) {
    const snap = ensureSnapshot();
    disableLoopPlayback(snap);

    if (!autoMute) return;
    const playback = folium?.playback;
    if (typeof playback?.setMuted !== 'function') return;

    snap.didChangeVolumeOrMute = true;
    try {
      await playback.setMuted(true);
    } catch {}
  }

  async function isolateQueueAfterPlay(song) {
    if (!song) return;
    const snap = ensureSnapshot();
    disableLoopPlayback(snap);

    const playback = folium?.playback;
    if (typeof playback?.replaceQueue !== 'function' || typeof playback?.getQueue !== 'function') return;
    try {
      const currentQueue = playback.getQueue(0, 1);
      if (currentQueue && typeof currentQueue.version === 'string') {
        await playback.replaceQueue([song], { expectedVersion: currentQueue.version });
        snap.didChangeQueue = true;
      }
    } catch {}
  }

  async function restoreOnStop() {
    const snap = snapshot;
    if (!snap) return;
    snapshot = null;

    const playback = folium?.playback;
    if (!playback) return;

    if (snap.didChangeLoopMode && snap.loopMode && typeof playback.setLoopMode === 'function') {
      try {
        playback.setLoopMode(snap.loopMode);
      } catch {}
    }

    if (snap.didChangeVolumeOrMute && snap.volumeState) {
      if (typeof snap.volumeState.muted === 'boolean' && typeof playback.setMuted === 'function') {
        try {
          await playback.setMuted(snap.volumeState.muted);
        } catch {}
      }
      if (Number.isFinite(snap.volumeState.volume) && typeof playback.setVolume === 'function') {
        try {
          await playback.setVolume(snap.volumeState.volume);
        } catch {}
      }
    }

    if (
      snap.didChangeQueue &&
      Array.isArray(snap.queueSongs) &&
      typeof playback.replaceQueue === 'function' &&
      typeof playback.getQueue === 'function'
    ) {
      try {
        const currentQueue = playback.getQueue(0, 1);
        if (currentQueue && typeof currentQueue.version === 'string') {
          await playback.replaceQueue(snap.queueSongs, { expectedVersion: currentQueue.version });
        }
      } catch {}
    }
  }

  return {
    captureAndApplyOnStart,
    applyBeforePlay,
    isolateQueueAfterPlay,
    restoreOnStop
  };
}
