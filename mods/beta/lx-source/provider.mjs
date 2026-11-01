import { httpUrl, musicInfoOf, PLATFORMS, qualityOf } from './protocol.mjs';

// Each LX platform keeps the host catalog identity; only its own playback uses the imported script.
export function createProvider(folium, runtime, source, capability, displayName, signal) {
    const providerId = PLATFORMS[source];
    const searches = new Map();
    const toSong = song => {
        const details = folium.omni.describeSong(song);
        return {
            id: String(song.id), title: song.title, artists: song.artist ? song.artist.split(' / ') : [],
            album: song.album ?? '', coverUrl: details?.coverUrl ?? undefined, durationMs: details?.durationMs ?? 0,
        };
    };
    const resolve = async id => {
        const [result] = await folium.omni.resolveSongs([{ source: providerId, id }], { signal });
        if (result.status === 'not-found') return null;
        if (result.status !== 'found') throw new Error(`LX: catalog lookup ${result.code ?? result.status}`);
        return result.song;
    };
    return {
        id: source, displayName: `LX · ${displayName}`, shortName: `LX · ${displayName}`,
        async search(query, { limit, offset }) {
            const key = JSON.stringify([query, limit]);
            let state = searches.get(key);
            if (!state) {
                if (searches.size >= 8) searches.delete(searches.keys().next().value);
                state = { items: [], cursor: undefined, ended: false, total: undefined, chain: Promise.resolve() };
                searches.set(key, state);
            }
            // Serialize pages of the same query so concurrent searches cannot skip a cursor.
            const work = state.chain.then(async () => {
                if (offset + limit > 5000) throw new Error('LX: search result limit reached');
                let reads = 0;
                while (!state.ended && state.items.length < offset + limit) {
                    if (++reads > 50) throw new Error('LX: catalog pagination did not converge');
                    const page = await folium.omni.searchSongs(query, {
                        providerId, limit, ...(state.cursor ? { cursor: state.cursor } : {}), signal,
                    });
                    state.items.push(...page.items.filter(song => song.id !== null).map(toSong));
                    state.total = page.total ?? undefined;
                    state.ended = !page.nextCursor || page.nextCursor === state.cursor;
                    state.cursor = page.nextCursor;
                }
                return { items: state.items.slice(offset, offset + limit), hasMore: !state.ended || state.items.length > offset + limit, total: state.total };
            });
            state.chain = work.catch(() => {});
            return work;
        },
        async getSong(id) {
            const song = await resolve(id);
            return song ? toSong(song) : null;
        },
        async getAudioUrl(song, quality) {
            const result = await runtime.call({
                source, action: 'musicUrl', info: { type: qualityOf(quality, capability.qualitys), musicInfo: musicInfoOf(source, song) },
            });
            if (typeof result !== 'string' || !result) throw new Error('LX: script returned no audio URL');
            return { url: httpUrl(result) };
        },
        async getLyrics(song) {
            // Host lyrics do not depend on a preceding musicUrl call (some LX scripts only cache lyrics there).
            const original = await resolve(song.id);
            if (!original) return null;
            const lyrics = await folium.omni.getLyrics(original, { signal });
            const stamp = seconds => {
                const ms = Math.max(0, Math.round(seconds * 1000));
                return `[${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}]`;
            };
            const track = field => lyrics.lines.filter(line => line[field]).map(line => `${stamp(line.startTime)}${line[field]}`).join('\n');
            const main = { format: 'lrc', text: track('fullText'), translationText: track('translation'), romanizationText: track('romanization') };
            const wordStamp = seconds => stamp(seconds).replace('[', '<').replace(']', '>');
            const wordByWord = lyrics.isWordByWord ? {
                format: 'enhanced-lrc',
                text: lyrics.lines.map(line => `${stamp(line.startTime)}${line.words.map(word => `${wordStamp(word.startTime)}${word.text}`).join('')}${wordStamp(line.endTime)}`).join('\n'),
            } : undefined;
            return { isPureMusic: lyrics.isPureMusic, main, ...(wordByWord ? { wordByWord } : {}) };
        },
    };
}

