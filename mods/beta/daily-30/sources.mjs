// mods/daily-30/sources.mjs
// Reads the NetEase daily recommendation through the host's experimental platform.raw, which adds the
// signed-in session itself: the mod never sees a platform credential and never talks to a platform
// backend directly. None of these routes touches an audio address.

import { normalizeNeteaseSong, normalizeSongs } from './songs.mjs';

// The only raw routes this mod calls; every one of them is a read.
export const PLATFORM_ROUTES = {
    netease: {
        daily: 'recommend_songs',
        history: 'history_recommend_songs',
        historyDay: 'history_recommend_songs_detail',
    },
};

export class SourceError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = 'SourceError';
        this.code = code;
    }
}

export const errorCode = (error) => (
    typeof error?.code === 'string' ? error.code : 'unknown'
);

const neteaseRaw = (folium) => {
    const raw = folium.experimental?.['platform.raw'];
    if (!raw) throw new SourceError('unsupported', 'Folium 没有提供 platform.raw');
    return raw;
};

const neteaseFailure = (error) => {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code === 'not-signed-in' || code === 'session-expired' || code === 'vip-required'
        || code === 'rate-limited' || code === 'unsupported' || code === 'network' || code === 'aborted') {
        return new SourceError(code, error.message);
    }
    return new SourceError('network', error instanceof Error ? error.message : String(error));
};

const neteaseBody = (body) => {
    const code = Number(body?.code);
    if (code === 301 || code === 302 || code === 401) throw new SourceError('session-expired', '网易云音乐登录已失效');
    if (code === 403) throw new SourceError('vip-required', '网易云音乐需要黑胶 VIP 才能读取历史推荐');
    if (code === 405) throw new SourceError('rate-limited', '网易云音乐请求过于频繁');
    return body?.data ?? body;
};

export const fetchNeteaseDaily = async (folium) => {
    const raw = neteaseRaw(folium);
    try {
        const description = raw.describe('netease');
        if (!description?.supported) throw new SourceError('unsupported', '网易云音乐原始接口不可用');
        const { body } = await raw.request('netease', PLATFORM_ROUTES.netease.daily, {});
        const data = neteaseBody(body);
        const rawSongs = Array.isArray(data?.dailySongs) ? data.dailySongs : Array.isArray(data?.songs) ? data.songs : [];
        const songs = normalizeSongs(rawSongs, normalizeNeteaseSong);
        if (!songs.length) throw new SourceError('empty', '网易云音乐今天没有返回歌曲');
        return { songs };
    } catch (error) {
        if (error instanceof SourceError) throw error;
        throw neteaseFailure(error);
    }
};

export const fetchNeteaseHistoryDates = async (folium) => {
    const raw = neteaseRaw(folium);
    try {
        const { body } = await raw.request('netease', PLATFORM_ROUTES.netease.history, {});
        const data = neteaseBody(body);
        const dates = Array.isArray(data?.dates) ? data.dates : [];
        return [...new Set(dates
            .map((entry) => (typeof entry === 'string' ? entry : entry?.date))
            .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))]
            .sort()
            .reverse()
            .slice(0, 5);
    } catch (error) {
        if (error instanceof SourceError) throw error;
        throw neteaseFailure(error);
    }
};

export const fetchNeteaseHistoryDay = async (folium, date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new SourceError('unsupported', '日期格式不正确');
    const raw = neteaseRaw(folium);
    try {
        const { body } = await raw.request('netease', PLATFORM_ROUTES.netease.historyDay, { date });
        const data = neteaseBody(body);
        const rawSongs = Array.isArray(data?.songs) ? data.songs : Array.isArray(data?.dailySongs) ? data.dailySongs : [];
        return normalizeSongs(rawSongs, normalizeNeteaseSong);
    } catch (error) {
        if (error instanceof SourceError) throw error;
        throw neteaseFailure(error);
    }
};
