// mods/daily-30/archive.cjs
// The archive the mod keeps on disk: one JSON file per day, plus an index with the date, song count and
// capture time so the home tab can list days without opening every file. The main entry owns this; the
// client reads and writes through rpc, because the client has no file system.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PLATFORMS = new Set(['netease']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INDEX = 'index.json';

const text = (value, max = 300) => String(value ?? '').trim().slice(0, max);

const cleanSong = (raw) => {
    const id = text(raw?.id, 80);
    if (!id) return null;
    const cover = text(raw?.cover, 2_000);
    const duration = Number(raw?.duration);
    return {
        id,
        name: text(raw?.name, 300) || 'Unknown',
        artist: text(raw?.artist, 500),
        album: text(raw?.album, 300),
        duration: Number.isFinite(duration) ? Math.max(0, Math.min(100_000, Math.round(duration))) : 0,
        cover: /^https?:\/\//i.test(cover) ? cover : '',
    };
};

const cleanDay = (raw) => {
    const platform = text(raw?.platform, 20);
    const date = text(raw?.date, 10);
    if (!PLATFORMS.has(platform) || !DATE.test(date)) return null;
    const songs = [];
    const seen = new Set();
    for (const item of Array.isArray(raw?.songs) ? raw.songs.slice(0, 200) : []) {
        const song = cleanSong(item);
        if (!song || seen.has(song.id)) continue;
        seen.add(song.id);
        songs.push(song);
    }
    if (!songs.length) return null;
    const capturedAt = Date.parse(String(raw?.capturedAt)) ? new Date(raw.capturedAt).toISOString() : new Date().toISOString();
    return {
        platform,
        date,
        capturedAt,
        title: text(raw?.title, 120),
        backfilled: raw?.backfilled === true,
        songs,
    };
};

const sameSongs = (left, right) => {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((song, index) => String(song?.id) === String(right[index]?.id));
};

const readJson = (file) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
};

const writeJson = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    try {
        fs.renameSync(temp, file);
    } catch (error) {
        try {
            fs.unlinkSync(file);
        } catch {
            // The destination was already gone.
        }
        fs.renameSync(temp, file);
    }
};

const createArchive = (root, log = console) => {
    const cache = new Map();
    const index = new Map();
    const keyOf = (platform, date) => `${platform}\n${date}`;
    const fileOf = (platform, date) => path.join(root, platform, `${date}.json`);
    const indexPath = path.join(root, INDEX);

    const sortedEntries = () => [...index.values()].sort((left, right) => (
        right.date.localeCompare(left.date) || left.platform.localeCompare(right.platform)
    ));

    const saveIndex = () => {
        writeJson(indexPath, sortedEntries());
    };

    let archive = null;

    const getDay = (platform, date) => {
        const name = text(platform, 20);
        const day = text(date, 10);
        if (!PLATFORMS.has(name) || !DATE.test(day)) return null;
        const key = keyOf(name, day);
        if (cache.has(key)) return cache.get(key);
        const value = readJson(fileOf(name, day));
        if (!value || value.platform !== name || value.date !== day || !Array.isArray(value.songs)) return null;
        cache.set(key, value);
        return value;
    };

    const putIndex = (day) => {
        index.set(keyOf(day.platform, day.date), {
            platform: day.platform,
            date: day.date,
            count: day.songs.length,
            capturedAt: day.capturedAt,
            backfilled: day.backfilled === true,
        });
    };

    const rebuild = () => {
        index.clear();
        cache.clear();
        for (const platform of PLATFORMS) {
            const directory = path.join(root, platform);
            let names = [];
            try {
                names = fs.readdirSync(directory);
            } catch {
                continue;
            }
            for (const name of names) {
                if (!name.endsWith('.json')) continue;
                const date = name.slice(0, -5);
                if (!DATE.test(date)) continue;
                const day = getDay(platform, date);
                if (day) putIndex(day);
            }
        }
        saveIndex();
    };

    const init = () => {
        for (const platform of PLATFORMS) fs.mkdirSync(path.join(root, platform), { recursive: true });
        const stored = readJson(indexPath);
        if (Array.isArray(stored)) {
            for (const entry of stored) {
                if (!entry || !PLATFORMS.has(entry.platform) || !DATE.test(String(entry.date))) continue;
                index.set(keyOf(entry.platform, entry.date), {
                    platform: entry.platform,
                    date: entry.date,
                    count: Number(entry.count) || 0,
                    capturedAt: text(entry.capturedAt, 40),
                    backfilled: entry.backfilled === true,
                });
            }
        }
        const complete = index.size > 0
            && [...index.values()].every((entry) => getDay(entry.platform, entry.date));
        if (!complete) rebuild();
        log.info('[daily-30] archive ready', { root, days: index.size });
        return archive;
    };

    const saveDay = (raw) => {
        const day = cleanDay(raw);
        if (!day) throw new Error('invalid-day');
        const existing = getDay(day.platform, day.date);
        const changed = !existing || !sameSongs(existing.songs, day.songs);
        writeJson(fileOf(day.platform, day.date), day);
        cache.set(keyOf(day.platform, day.date), day);
        putIndex(day);
        saveIndex();
        return { ok: true, changed, count: day.songs.length };
    };

    const listDays = () => sortedEntries().map((entry) => ({ ...entry }));

    const deleteDay = (platform, date) => {
        const name = text(platform, 20);
        const day = text(date, 10);
        if (!PLATFORMS.has(name) || !DATE.test(day)) throw new Error('invalid-day');
        try {
            fs.unlinkSync(fileOf(name, day));
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
        cache.delete(keyOf(name, day));
        index.delete(keyOf(name, day));
        saveIndex();
        return { ok: true };
    };

    const search = (query, options = {}) => {
        const needle = text(query, 100).toLowerCase();
        if (!needle) return [];
        const limit = Math.max(1, Math.min(200, Math.floor(Number(options.limit) || 100)));
        const results = [];
        for (const entry of sortedEntries()) {
            const day = getDay(entry.platform, entry.date);
            if (!day) continue;
            for (let position = 0; position < day.songs.length; position += 1) {
                const song = day.songs[position];
                const haystack = `${song.name}\n${song.artist}\n${song.album}`.toLowerCase();
                if (!haystack.includes(needle)) continue;
                results.push({ platform: entry.platform, date: entry.date, position, song });
                if (results.length >= limit) return results;
            }
        }
        return results;
    };

    const exportAll = (downloads) => {
        const days = sortedEntries().map((entry) => getDay(entry.platform, entry.date)).filter(Boolean);
        if (!days.length) throw new Error('nothing-to-export');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const destination = path.join(downloads, `daily-30-${stamp}.json`);
        writeJson(destination, {
            app: 'Folia daily-30',
            exportedAt: new Date().toISOString(),
            days,
        });
        return { path: destination, days: days.length };
    };

    archive = { init, saveDay, listDays, getDay, deleteDay, search, exportAll, root };
    return archive;
};

module.exports = { createArchive };
