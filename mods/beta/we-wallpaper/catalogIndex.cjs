'use strict';

const path = require('node:path');

// Build library and configuration indexes in the worker; the host only looks up cached entries.
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const normalize = value => typeof value === 'string'
    ? path.win32.normalize(value).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase() : '';
const workshopKey = file => {
    const match = file.match(/\/workshop\/content\/431960\/(\d+)\/(.+)$/);
    return match ? match[1] + '/' + match[2] : null;
};

function matchFileId(library, file) {
    const normalized = normalize(file);
    return library.byFile.get(normalized) || library.workshopMatches.get(workshopKey(normalized)) || null;
}

function buildLibrary(wallpapers, weDir) {
    const workshopEntries = new Map();
    for (const wallpaper of wallpapers) {
        if (wallpaper.kind !== 'workshop') continue;
        const id = normalize(wallpaper.dir).match(/\/workshop\/content\/431960\/(\d+)$/)?.[1];
        wallpaper.workshopId = id || '';
        if (!id) continue;
        if (!workshopEntries.has(id)) workshopEntries.set(id, []);
        workshopEntries.get(id).push(wallpaper);
    }
    const byId = new Map();
    const byFile = new Map();
    const workshopFiles = new Map();
    const workshopMatches = new Map();
    for (const wallpaper of wallpapers) {
        if (wallpaper.kind === 'local') {
            const id = normalize(wallpaper.dir).match(/\/projects\/myprojects\/(\d+)$/)?.[1];
            const originals = workshopEntries.get(id) || [];
            // A numeric local copy can share its real entry with the same workshop directory ID.
            wallpaper.workshopId = id && originals.every(entry => entry.entryFile === wallpaper.entryFile) ? id : '';
        }
        byId.set(wallpaper.id, wallpaper);
        byFile.set(normalize(wallpaper.projectPath), wallpaper.id);
        byFile.set(normalize(wallpaper.entryPath), wallpaper.id);
        if (!wallpaper.workshopId) continue;
        for (const suffix of new Set(['project.json', wallpaper.entryFile])) {
            const key = wallpaper.workshopId + '/' + suffix;
            if (!workshopFiles.has(key)) workshopFiles.set(key, []);
            workshopFiles.get(key).push(wallpaper.id);
            if (!workshopMatches.has(key) || wallpaper.kind === 'workshop') workshopMatches.set(key, wallpaper.id);
        }
    }
    return { weDir, wallpapers, byId, byFile, workshopFiles, workshopMatches };
}

function hostLibrary(library) {
    const { wallpapers, byId, byFile, workshopMatches } = library;
    return { wallpapers, byId, byFile, workshopMatches };
}

function settingsIndex(library, map) {
    const exact = new Map();
    const related = new Map();
    const add = (target, id, key) => {
        if (!target.has(id)) target.set(id, []);
        target.get(id).push(key);
    };
    for (const key of Object.keys(map)) {
        const normalized = normalize(key);
        const exactId = library.byFile.get(normalized);
        if (exactId) add(exact, exactId, key);
        for (const id of library.workshopFiles.get(workshopKey(normalized)) || []) {
            if (id !== exactId) add(related, id, key);
        }
    }
    const result = new Map();
    for (const wallpaper of library.wallpapers) {
        result.set(wallpaper.id, [...(exact.get(wallpaper.id) || []), ...(related.get(wallpaper.id) || [])]);
    }
    return result;
}

function selectedFiles(config) {
    return Object.values(record(config?.selectedwallpapers)).map(value => value?.file).filter(value => typeof value === 'string');
}

function buildState(library, source, previousId) {
    const general = record(source.general);
    const user = {
        general: {
            wallpaperconfig: record(general.wallpaperconfig), wpresets: record(general.wpresets),
            user: { fps: general.user?.fps },
        },
        wproperties: record(source.wproperties),
    };
    const propertyKeys = settingsIndex(library, user.wproperties);
    const presetKeys = settingsIndex(library, user.general.wpresets);
    const descriptions = new Map();
    const wallpapers = [];
    for (const wallpaper of library.wallpapers) {
        const definitions = wallpaper.project.general.properties;
        const defaults = Object.fromEntries(Object.entries(definitions)
            .filter(([, value]) => Object.hasOwn(value, 'value')).map(([key, value]) => [key, value.value]));
        const propertyKey = propertyKeys.get(wallpaper.id)[0];
        const saved = record(Object.values(record(user.wproperties[propertyKey]))[0]);
        const presetKey = presetKeys.get(wallpaper.id)[0];
        const configured = user.general.wpresets[presetKey]?.presets;
        const presets = Array.isArray(configured) ? configured.filter(item => item && typeof item.name === 'string') : [];
        const presetsByName = new Map();
        for (const preset of presets) {
            if (!presetsByName.has(preset.name)) presetsByName.set(preset.name, { properties: record(preset.properties) });
        }
        const presetNames = presets.map(preset => preset.name);
        descriptions.set(wallpaper.id, {
            baseProperties: { ...defaults, ...saved }, presetNames, presetsByName, presetKey,
            settingsSource: propertyKey || wallpaper.entryPath,
        });
        wallpapers.push({
            id: wallpaper.id, title: wallpaper.title, type: wallpaper.type,
            previewUrl: wallpaper.previewPath ? '/preview/' + wallpaper.id : null, presets: presetNames,
        });
    }
    const candidates = [
        ...selectedFiles(general.wallpaperconfig),
        ...Object.values(record(general.wallpaperconfigrecent)).flatMap(item => selectedFiles(item?.config)),
    ];
    let selectedId = library.byId.has(previousId) ? previousId : null;
    for (const file of candidates) {
        const id = matchFileId(library, file);
        if (id) { selectedId = id; break; }
    }
    return {
        user, descriptions, propertyKeys, presetKeys,
        snapshot: {
            ok: true, weDir: library.weDir, selectedId,
            fps: Number(user.general.user.fps) || 60, wallpapers,
        },
    };
}

module.exports = { record, normalize, matchFileId, buildLibrary, buildState, hostLibrary };
