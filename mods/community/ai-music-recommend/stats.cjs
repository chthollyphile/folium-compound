// mods/ai-music-recommend/stats.cjs
//
// 「本地听歌统计」(listening-stats) 联动：读取它落盘在
// `<userData>/mod-data/listening-stats/` 的聚合文件，转换成与本模组
// digest 同构的口味档案。
//
// 数据文件（listening-stats 1.9.x 的格式，宽容解析）：
//   agg.json    { totals, songs: { key: {plays, completePlays, skips, secs, likes, lastTs} },
//                 artists: {...}, recent?: [...] }
//   songs.json  { key: { title, artist, album, source } }
//   events/YYYY-MM.ndjson  逐条流水（agg 覆盖不到时才用）
//
// key 是 listening-stats 的 songKey(source+id+title+artist 的 djb2 哈希)，
// 只在它自己的字典里有意义——所以这里不拼 key，而是经 songs.json 把 key
// 翻译回歌名/歌手再聚合。与「听歌档案」联动同款原则：只读，坏文件跳过，
// 最坏情况退回本模组自记数据。

'use strict';

const fs = require('fs');
const path = require('path');

const STATS_DATA_SUB = ['mod-data', 'listening-stats'];
const MAX_FILES = 120;
const MAX_LINES = 50000;
const MAX_ARTISTS = 12;
const MAX_SONGS = 15;
const MAX_RECENT = 25;
const MAX_SKIPS = 8;

const splitArtistNames = (artist) => String(artist ?? '')
    .split(/\s*[/&、,，;；]\s*/)
    .map((name) => name.trim())
    .filter(Boolean);

const readJson = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
};

/**
 * 读取并聚合「本地听歌统计」的统计。
 * @param {string} userDataDir Electron userData 根目录
 */
const readStatsProfileFrom = (userDataDir) => {
    const emptyProfile = {
        status: 'no-records',
        sessions: 0,
        songs: 0,
        plays: 0,
        topArtists: [],
        topSongs: [],
        recent: [],
        skips: [],
    };

    const root = path.join(userDataDir, ...STATS_DATA_SUB);
    const agg = readJson(path.join(root, 'agg.json'));
    const songsDict = readJson(path.join(root, 'songs.json'));
    if (!agg || typeof agg !== 'object' || !songsDict || typeof songsDict !== 'object') {
        return { ...emptyProfile };
    }

    // 主路径：agg.songs[key]（已聚合）经 songsDict[key] 翻译回歌名/歌手。
    const aggSongs = agg.songs && typeof agg.songs === 'object' ? agg.songs : {};
    const songAgg = new Map();
    let sessions = 0;
    for (const [key, entry] of Object.entries(aggSongs)) {
        if (!entry || typeof entry !== 'object') continue;
        const meta = songsDict[key];
        const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
        if (!title) continue;
        const artist = typeof meta?.artist === 'string' ? meta.artist : '';
        const plays = Number(entry.completePlays) || 0;   // 完整播放才算有效播放
        const skips = Number(entry.skips) || 0;
        const secs = Number(entry.secs) || 0;
        const lastTs = Number(entry.lastTs) || 0;
        sessions += plays + skips;
        const songKey = `${title}\u0000${artist}`;
        const cur = songAgg.get(songKey) ?? { title: title.slice(0, 200), artist: artist.slice(0, 200), plays: 0, skips: 0, lastAt: 0 };
        cur.plays += plays;
        cur.skips += skips;
        cur.lastAt = Math.max(cur.lastAt, lastTs);
        songAgg.set(songKey, cur);
    }

    // 兜底：agg.songs 为空但 events 流水有货（刚装、聚合未落盘的场景）。
    if (songAgg.size === 0) {
        let eventsDir;
        try {
            eventsDir = path.join(root, 'events');
            fs.accessSync(eventsDir, fs.constants.R_OK);
        } catch {
            eventsDir = null;
        }
        if (eventsDir) {
            let names = [];
            try {
                names = fs.readdirSync(eventsDir).filter((n) => n.toLowerCase().endsWith('.ndjson')).sort().slice(0, MAX_FILES);
            } catch {
                names = [];
            }
            const bySession = new Map();
            let lines = 0;
            for (const name of names) {
                if (lines >= MAX_LINES) break;
                let content = '';
                try {
                    content = fs.readFileSync(path.join(eventsDir, name), 'utf8');
                } catch {
                    continue;
                }
                for (const line of content.split('\n')) {
                    if (lines >= MAX_LINES) break;
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('{')) continue;
                    let rec;
                    try {
                        rec = JSON.parse(trimmed);
                    } catch {
                        continue;
                    }
                    if (!rec || typeof rec !== 'object') continue;
                    lines += 1;
                    const meta = songsDict[rec.key];
                    const title = typeof meta?.title === 'string' ? meta.title.trim() : '';
                    if (!title) continue;
                    const artist = typeof meta?.artist === 'string' ? meta.artist : '';
                    const sKey = `${name}\u0000${rec.key}`;
                    const session = bySession.get(sKey) ?? { title, artist, secs: 0, ts: Number(rec.ts) || 0 };
                    session.secs += Number(rec.secs) || 0;
                    session.ts = Math.max(session.ts, Number(rec.ts) || 0);
                    bySession.set(sKey, session);
                }
            }
            // 每会话（同一文件内同一首歌的连续流水）按 30 秒判完整播放。
            for (const session of bySession.values()) {
                sessions += 1;
                const songKey = `${session.title}\u0000${session.artist}`;
                const cur = songAgg.get(songKey) ?? {
                    title: session.title.slice(0, 200),
                    artist: session.artist.slice(0, 200),
                    plays: 0, skips: 0, lastAt: 0,
                };
                if (session.secs >= 30) cur.plays += 1; else cur.skips += 1;
                cur.lastAt = Math.max(cur.lastAt, session.ts);
                songAgg.set(songKey, cur);
            }
        }
    }

    const songs = [...songAgg.values()];
    if (sessions === 0 || songs.length === 0) {
        return { ...emptyProfile };
    }

    const plays = songs.reduce((sum, s) => sum + s.plays, 0);
    const topSongs = songs
        .filter((s) => s.plays > 0)
        .sort((x, y) => (y.plays - x.plays) || (y.lastAt - x.lastAt))
        .slice(0, MAX_SONGS)
        .map((s) => ({ t: s.title, a: s.artist, p: s.plays }));

    const artistAgg = new Map();
    for (const s of songs) {
        for (const name of splitArtistNames(s.artist)) {
            artistAgg.set(name, (artistAgg.get(name) ?? 0) + s.plays);
        }
    }
    const topArtists = [...artistAgg.entries()]
        .filter(([, p]) => p > 0)
        .sort((x, y) => y[1] - x[1])
        .slice(0, MAX_ARTISTS)
        .map(([name, p]) => ({ name, plays: p }));

    const recent = songs
        .filter((s) => s.lastAt > 0)
        .sort((x, y) => y.lastAt - x.lastAt)
        .slice(0, MAX_RECENT)
        .map((s) => ({ t: s.title, a: s.artist }));

    const skips = songs
        .filter((s) => s.skips >= 2 && s.plays === 0)
        .sort((x, y) => y.skips - x.skips)
        .slice(0, MAX_SKIPS)
        .map((s) => ({ t: s.title, a: s.artist, q: s.skips }));

    return {
        status: 'linked',
        sessions,
        songs: songs.length,
        plays,
        topArtists,
        topSongs,
        recent,
        skips,
    };
};

module.exports = { readStatsProfileFrom, splitArtistNames };
