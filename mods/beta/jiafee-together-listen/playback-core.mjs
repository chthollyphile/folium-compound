// Pure song identity and clock helpers shared by the Folium adapter and its tests.
const clean = (value, max = 240) => String(value == null ? '' : value).trim().slice(0, max);

export function canonicalSongKey(song) {
  if (!song) return '';
  const source = clean(song.source || song.provider, 24).toLowerCase();
  const id = clean(song.id || song.providerId, 160);
  if (source && id) return `${source}:${id}`;
  const title = clean(song.title || song.name).toLocaleLowerCase();
  const artist = clean(song.artist).toLocaleLowerCase();
  return title ? `meta:${title}\u0000${artist}` : '';
}

export function serializeTrack(song, duration = 0) {
  const trackId = canonicalSongKey(song);
  if (!trackId) return null;
  const source = clean(song.source || song.provider, 24).toLowerCase();
  const providerId = clean(song.id || song.providerId, 160);
  return {
    trackId,
    provider: source,
    providerId,
    name: clean(song.title || song.name),
    artist: clean(song.artist),
    album: clean(song.album),
    duration: Math.max(0, Math.min(86400, Number(duration) || 0)),
    cover: '',
    id: providerId,
    mid: '',
    spotifyId: '',
    hash: '',
  };
}

export function tracksMatch(remote, song) {
  if (!remote || !song) return false;
  const source = clean(song.source, 24).toLowerCase();
  const id = clean(song.id, 160);
  const remoteSource = clean(remote.provider || remote.source, 24).toLowerCase();
  const remoteId = clean(remote.providerId || remote.id, 160);
  if (source && id && remoteSource && remoteId) return source === remoteSource && id === remoteId;
  return clean(song.title).toLocaleLowerCase() === clean(remote.name || remote.title).toLocaleLowerCase()
    && clean(song.artist).toLocaleLowerCase() === clean(remote.artist).toLocaleLowerCase();
}

export function findMatchingQueueItem(queue, remote) {
  if (!queue || !Array.isArray(queue.items)) return null;
  return queue.items.find((item) => tracksMatch(remote, item.song)) || null;
}

export function authoritativePosition(room, now = Date.now()) {
  if (!room) return 0;
  const position = Math.max(0, Number(room.position) || 0);
  if (!room.playing) return position;
  const serverNow = now + (Number(room.clockOffsetMs) || 0);
  const timestamp = Number(room.serverTimestamp) || serverNow;
  return position + Math.max(0, serverNow - timestamp) / 1000;
}

export function protocolMode(loopMode) {
  if (loopMode === 'one') return 'single';
  return 'loop';
}

export function foliumLoopMode(mode) {
  if (mode === 'single') return 'one';
  return 'all';
}
