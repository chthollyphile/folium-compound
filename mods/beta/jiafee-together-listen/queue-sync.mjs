const MAX_ROOM_QUEUE = 200;
const MAX_ATTEMPTS = 3;

export function queueEdits(before, after) {
  const a = before.map((item) => item.trackId);
  const b = after.map((item) => item.trackId);
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keepA = new Set();
  const keepB = new Set();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { keepA.add(i++); keepB.add(j++); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const edits = [];
  for (let i = a.length - 1; i >= 0; i--) {
    if (!keepA.has(i)) edits.push({ type: 'QUEUE_REMOVE', payload: { index: i } });
  }
  for (let j = 0; j < b.length; j++) {
    if (!keepB.has(j)) edits.push({ type: 'QUEUE_ADD', payload: { index: j, track: after[j] } });
  }
  return edits;
}

export class QueueSync {
  constructor({ playback, omni, notice, log, isCurrent = () => true }) {
    this.playback = playback;
    this.omni = omni;
    this.notice = notice;
    this.log = log;
    this.isCurrent = isCurrent;
    this.generation = 0;
    this.lastVersion = null;
    this.pending = null;
    this.waiting = false;
    this.timer = null;
    this.controller = null;
    this.disposed = false;
  }

  cancel() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = null;
    this.controller?.abort();
    this.controller = null;
    this.waiting = false;
    this.pending = null;
  }

  dispose() {
    this.disposed = true;
    this.cancel();
  }

  async request(room, { play = false } = {}) {
    if (this.disposed) return false;
    this.cancel();
    const generation = this.generation;
    const queue = Array.isArray(room.queue) ? room.queue.slice(0, MAX_ROOM_QUEUE) : [];
    this.pending = { room: { ...room, queue }, play, generation, deferredAttempts: 0 };
    return this.run(generation);
  }

  active(generation) {
    return !this.disposed && generation === this.generation && this.pending && this.isCurrent(this.pending.room);
  }

  async resolve(queue, generation, previous = null, refreshBatch = -1) {
    const songs = [];
    for (let offset = 0; offset < queue.length; offset += 50) {
      if (!this.active(generation)) return null;
      if (previous && Math.floor(offset / 50) !== refreshBatch) {
        songs.push(...previous.slice(offset, offset + 50));
        continue;
      }
      const part = queue.slice(offset, offset + 50);
      const keys = part.map((item) => ({ source: String(item.provider || ''), id: String(item.providerId || '') }));
      const invalid = keys.findIndex((key) => !key.source || !key.id);
      if (invalid >= 0) {
        this.notice(`无法解析第 ${offset + invalid + 1} 首歌曲：缺少 source + id`);
        return null;
      }
      let results;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        this.controller = new AbortController();
        try {
          results = await this.omni.resolveSongs(keys, { signal: this.controller.signal });
        } catch (error) {
          if (!this.active(generation)) return null;
          if (attempt === MAX_ATTEMPTS - 1) throw error;
          continue;
        } finally {
          this.controller = null;
        }
        if (!this.active(generation)) return null;
        if (!Array.isArray(results) || results.length !== keys.length) throw new Error('resolveSongs returned an incomplete page');
        if (!results.some((item) => item.status === 'failed')) break;
        if (attempt === MAX_ATTEMPTS - 1) break;
      }
      for (let i = 0; i < part.length; i++) {
        const result = results[i];
        if (result.status !== 'found' || !result.song?.ref) {
          const label = part[i].name || part[i].trackId || `#${offset + i + 1}`;
          this.notice(`歌曲「${label}」无法同步：${result.status}${result.code ? ` (${result.code})` : ''}`);
          return null;
        }
        songs.push(result.song);
      }
    }
    return songs;
  }

  waitForEvent(generation) {
    if (this.active(generation)) this.waiting = true;
    return false;
  }

  retryAfter(generation, ms) {
    if (++this.pending.deferredAttempts >= MAX_ATTEMPTS) {
      this.notice('队列同步频繁受限，已停止重试');
      this.pending = null;
      return false;
    }
    const delay = Math.max(1, Math.min(60000, Number(ms) || 1000));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run(generation).catch((error) => this.log.warn('Queue sync retry failed', String(error)));
    }, delay);
    return false;
  }

  async run(generation) {
    if (!this.active(generation)) return false;
    this.waiting = false;
    const request = this.pending;
    let resolved = null;
    let refreshBatch = -1;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && this.active(generation); attempt++) {
      const snapshot = this.playback.getQueue({ offset: 0, limit: 1 });
      if (typeof snapshot.version !== 'string') throw new Error('Folium 1.7 queue version is required');
      if (snapshot.kind === 'stage') return this.waitForEvent(generation);
      const songs = await this.resolve(request.room.queue, generation, resolved, refreshBatch);
      if (!songs || !this.active(generation)) return false;
      resolved = songs;
      refreshBatch = -1;
      const result = await this.playback.replaceQueue(songs, { expectedVersion: snapshot.version });
      if (!this.active(generation)) return false;
      if (result.status === 'replaced') {
        this.lastVersion = result.version;
        this.pending = null;
        if (request.play && request.room.currentIndex >= 0 && request.room.currentIndex < songs.length) {
          const chosen = songs[request.room.currentIndex];
          const played = await this.playback.playQueueItem(request.room.currentIndex, chosen.ref);
          if (!played) this.notice('队列已变化，未执行远端切歌');
        }
        return true;
      }
      if (result.status !== 'refused') throw new Error('Unknown replaceQueue result');
      const reason = result.reason;
      if (reason === 'stale-version') {
        resolved = null;
        continue;
      }
      if (reason === 'stale-ref') {
        refreshBatch = Math.floor(Number(result.index) / 50);
        continue;
      }
      if (reason === 'rate-limited') return this.retryAfter(generation, result.retryAfterMs);
      if (reason === 'stage' || reason === 'transition') return this.waitForEvent(generation);
      if (reason === 'not-queueable') {
        this.notice(`第 ${Number(result.index) + 1} 首歌曲不可加入队列`);
        this.pending = null;
        return false;
      }
      this.log.warn('Unknown replaceQueue refusal', String(reason));
      if (attempt === MAX_ATTEMPTS - 1) break;
      return this.waitForEvent(generation);
    }
    if (this.active(generation)) {
      this.notice('队列同步重试已耗尽，当前本机队列保持不变');
      this.pending = null;
    }
    return false;
  }

  async queueChanged(event) {
    if (this.disposed) return false;
    const changed = !event?.byThisMod && event?.version !== this.lastVersion;
    if (typeof event?.version === 'string') this.lastVersion = event.version;
    if (this.waiting && this.pending) {
      const generation = this.generation;
      this.waiting = false;
      if (++this.pending.deferredAttempts >= MAX_ATTEMPTS) {
        this.notice('队列同步等待宿主状态超时，已停止重试');
        this.pending = null;
      } else if (this.playback.getQueue({ offset: 0, limit: 1 }).kind !== 'stage') await this.run(generation);
      else this.waiting = true;
    }
    return changed;
  }
}
