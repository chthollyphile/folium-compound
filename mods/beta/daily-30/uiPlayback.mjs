// mods/daily-30/uiPlayback.mjs
// Turns an archived day into playback: resolve the stored ids through Omni, replace the queue with them,
// and start at the first song. The home tab owns the busy state and the toasts; these functions only do
// the queue work and throw a message the tab can show.

const SOURCE = 'netease';

const keysOf = (songs) => songs.map((song) => ({ source: SOURCE, id: String(song.id) }));

const foundSongs = (resolved) => {
    const songs = [];
    for (const item of Array.isArray(resolved) ? resolved : []) {
        if (item?.status === 'found' && item.song) songs.push(item.song);
    }
    return songs;
};

export const playDay = async (folium, t, day) => {
    const keys = keysOf(day.songs);
    if (!keys.length) throw new Error(t.noPlayable);
    const songs = foundSongs(await folium.omni.resolveSongs(keys));
    if (!songs.length) throw new Error(t.noPlayable);

    let queue = folium.playback.getQueue();
    let result = await folium.playback.replaceQueue(songs, { expectedVersion: queue.version });
    if (result.status === 'refused' && result.reason === 'stale-version') {
        queue = folium.playback.getQueue();
        result = await folium.playback.replaceQueue(songs, { expectedVersion: queue.version });
    }
    if (result.status !== 'replaced') throw new Error(t.queueRefused);

    const started = await folium.playback.playQueueItem(0);
    if (!started) throw new Error(t.noPlayable);
    return { played: songs.length, missing: keys.length - songs.length };
};

export const playSong = async (folium, t, song) => {
    const [resolved] = await folium.omni.resolveSongs([{ source: SOURCE, id: String(song.id) }]);
    if (resolved?.status !== 'found' || !resolved.song) throw new Error(t.noPlayable);
    const started = await folium.playback.playSong(resolved.song);
    if (!started) throw new Error(t.noPlayable);
};
