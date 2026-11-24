// mods/ai-music-recommend/archive.cjs
//
// 「听歌档案」联动：读取官方模组 listening-archive 落在
// `<userData>/mods-data/listening-archive/files/*.jsonl` 的按月播放日志
// （每行一次播放会话，segments[].seconds 是实际收听秒数），聚合成与本模组
// 自身历史同构的「口味档案」，供推荐提示词使用。
//
// 这是模组对模组的自愿联动，不是宿主接口：listening-archive 把逐秒记录写在
// 自己的 mods-data 文件目录里（它声明的 filesystem.data 权限），本模组用
// main 入口的 Node 能力只读这些文件，绝不写入。格式是 listening-archive
// 1.3.x 的内部格式，所以这里全程宽容解析——坏行、缺字段、未来新增的字段都
// 不应让联动失败，最坏情况就是「读不到，退回本模组自己的记录」。

'use strict';

const fs = require('fs');
const path = require('path');

// 一条会话收听满这么久才算一次有效播放（与 client.mjs 的 30 秒规则一致）。
const PLAY_MIN_SECONDS = 30;
// 比这更长的收听才进「最近播放」（过滤 0.0x 秒的切歌噪声）。
const RECENT_MIN_SECONDS = 10;
// 安全上限：日志再大也不无限制读。
const MAX_LINES = 50000;
const MAX_FILES = 120;
const MAX_ARTISTS = 12;
const MAX_SONGS = 15;
const MAX_RECENT = 25;
const MAX_SKIPS = 8;

const splitArtistNames = (artist) => String(artist ?? '')
    .split(/\s*[/&、,，;；]\s*/)
    .map((name) => name.trim())
    .filter(Boolean);

/** 单行 JSONL → 会话记录；解析不了返回 null（宽容：坏行只被跳过）。 */
const parseLine = (line) => {
    if (!line || typeof line !== 'string') return null;
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return null;
    let entry;
    try {
        entry = JSON.parse(trimmed);
    } catch {
        return null;
    }
    if (!entry || typeof entry !== 'object') return null;
    const song = entry.song && typeof entry.song === 'object' ? entry.song : null;
    const title = typeof song?.title === 'string' ? song.title.trim() : '';
    if (!title) return null;
    const listened = Array.isArray(entry.segments)
        ? entry.segments.reduce((sum, segment) => sum + (Number(segment?.seconds) || 0), 0)
        : (Number(entry.duration) || 0);
    const at = Number(entry.endedAt) || Number(entry.startedAt) || 0;
    return {
        // 行级 id：一次播放会话一个。歌曲自己的 song.id 是另一回事，不能拿来去重，
        // 否则同一首歌的多次播放会被折叠成一条。
        sessionId: typeof entry.id === 'string' ? entry.id.slice(0, 200) : '',
        title: title.slice(0, 200),
        artist: typeof song.artist === 'string' ? song.artist.slice(0, 200) : '',
        album: typeof song.album === 'string' ? song.album.slice(0, 200) : '',
        source: typeof song.source === 'string' ? song.source : '',
        at,
        listened: Number.isFinite(listened) ? Math.max(0, listened) : 0,
    };
};

/**
 * 读取并聚合「听歌档案」的播放日志。
 * @param {object} options
 * @param {string} options.filesDir  listening-archive 的 mods-data/<id>/files 目录
 * @param {string|null} [options.modsDir] listening-archive 的安装目录（mods/<id>），只用来区分
 *   「未安装」和「已安装但没记录」两种状态，读不到就当未安装处理
 * @returns {{status: string, sessions: number, songs: number, plays: number,
 *   topArtists: Array, topSongs: Array, recent: Array, skips: Array}}
 */
const readArchiveProfileFrom = ({ filesDir, modsDir = null }) => {
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

    // 安装检测只看 mod.json 是否可读，内容不解析（避免依赖它的格式）。
    const installed = (() => {
        if (!modsDir) return null;
        try {
            fs.accessSync(path.join(modsDir, 'mod.json'), fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    })();

    let fileNames = [];
    try {
        fileNames = fs.readdirSync(filesDir)
            .filter((name) => name.toLowerCase().endsWith('.jsonl'))
            .sort()
            .slice(0, MAX_FILES);
    } catch {
        return { ...emptyProfile, status: installed ? 'no-records' : 'not-installed' };
    }
    if (fileNames.length === 0) {
        return { ...emptyProfile, status: installed ? 'no-records' : 'not-installed' };
    }

    // 按 id 去重（保留最后一条）：将来若改成「修订后追加整行」也仍然正确。
    const byId = new Map();
    let sessions = 0;
    let parsedFiles = 0;
    for (const name of fileNames) {
        let content;
        try {
            content = fs.readFileSync(path.join(filesDir, name), 'utf8');
        } catch {
            continue;
        }
        parsedFiles += 1;
        const lines = content.split('\n');
        const cap = Math.max(0, MAX_LINES - sessions);
        for (let index = 0; index < lines.length && index < cap; index += 1) {
            const record = parseLine(lines[index]);
            if (!record) continue;
            sessions += 1;
            // 会话 id 重复时保留最后一条（将来若改成「修订后追加整行」仍然正确）。
            const lineKey = record.sessionId
                || `${record.title}\u0000${record.artist}\u0000${record.at}`;
            byId.set(`${name}\u0000${lineKey}`, record);
        }
        if (sessions >= MAX_LINES) break;
    }

    if (sessions === 0 || parsedFiles === 0) {
        return { ...emptyProfile, status: installed ? 'no-records' : 'not-installed' };
    }
    const records = [...byId.values()];

    // ---- 聚合：每首歌的播放次数 / 跳过次数 / 最近一次收听
    const songAgg = new Map();
    for (const record of records) {
        const songKey = `${record.title}\u0000${record.artist}`;
        const agg = songAgg.get(songKey) ?? {
            title: record.title,
            artist: record.artist,
            plays: 0,
            skips: 0,
            seconds: 0,
            lastAt: 0,
        };
        if (record.listened >= PLAY_MIN_SECONDS) agg.plays += 1;
        else agg.skips += 1;
        agg.seconds += record.listened;
        agg.lastAt = Math.max(agg.lastAt, record.at);
        songAgg.set(songKey, agg);
    }
    const songs = [...songAgg.values()];

    const plays = songs.reduce((sum, song) => sum + song.plays, 0);
    const topSongs = songs
        .filter((song) => song.plays > 0)
        .sort((x, y) => (y.plays - x.plays) || (y.lastAt - x.lastAt))
        .slice(0, MAX_SONGS)
        .map((song) => ({ t: song.title, a: song.artist, p: song.plays }));

    const artistAgg = new Map();
    for (const song of songs) {
        for (const name of splitArtistNames(song.artist)) {
            artistAgg.set(name, (artistAgg.get(name) ?? 0) + song.plays);
        }
    }
    const topArtists = [...artistAgg.entries()]
        .filter(([, artistPlays]) => artistPlays > 0)
        .sort((x, y) => y[1] - x[1])
        .slice(0, MAX_ARTISTS)
        .map(([name, artistPlays]) => ({ name, plays: artistPlays }));

    // 最近播放：有点收听时长就进候选，按结束时间新→旧，同一首歌只留最新一次。
    const seenRecent = new Set();
    const recent = [];
    const ordered = [...records].sort((x, y) => y.at - x.at);
    for (const record of ordered) {
        if (record.listened < RECENT_MIN_SECONDS) continue;
        const key = `${record.title}\u0000${record.artist}`;
        if (seenRecent.has(key)) continue;
        seenRecent.add(key);
        recent.push({ t: record.title, a: record.artist });
        if (recent.length >= MAX_RECENT) break;
    }

    const skips = songs
        .filter((song) => song.skips >= 2 && song.plays === 0)
        .sort((x, y) => y.skips - x.skips)
        .slice(0, MAX_SKIPS)
        .map((song) => ({ t: song.title, a: song.artist, q: song.skips }));

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

module.exports = { readArchiveProfileFrom, parseLine, splitArtistNames, PLAY_MIN_SECONDS };
