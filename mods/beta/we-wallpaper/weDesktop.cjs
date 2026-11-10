'use strict';

const fs = require('fs');

// Retain the WE desktop independently of the off-screen window used by Folia.
function createWeDesktop({ catalog, runtime, storage, properties }) {
    let remembered = null;
    let pending = Promise.resolve();
    const enqueue = action => {
        const operation = pending.then(action);
        pending = operation.catch(() => {});
        return operation;
    };
    const descriptionFor = (id, preset = '') => {
        const wallpaper = catalog.byId.get(id);
        if (!wallpaper) return null;
        return {
            file: wallpaper.projectPath,
            properties: catalog.describe(id, preset, properties(id, preset)).properties,
        };
    };

    return {
        remember: () => enqueue(async () => {
            await catalog.reloadConfig();
            const selection = catalog.user?.general?.wallpaperconfig?.selectedwallpapers?.Monitor0;
            if (selection?.file) {
                const wallpaper = catalog.matchFile(selection.file);
                const propertiesMap = catalog.user?.wproperties || {};
                const normalize = value => value.replace(/\\/g, '/').toLowerCase();
                const exact = Object.keys(propertiesMap).find(key => normalize(key) === normalize(selection.file));
                const keys = [...new Set([exact, ...(wallpaper ? catalog.settingsKeys(wallpaper, propertiesMap) : [])].filter(Boolean))];
                const originalProperties = keys.map(key => propertiesMap[key]?.Monitor0).find(Boolean) || {};
                const definitions = wallpaper?.project.general?.properties || {};
                const defaults = Object.fromEntries(Object.entries(definitions).filter(([, value]) => value && 'value' in value).map(([key, value]) => [key, value.value]));
                remembered = wallpaper ? {
                    file: wallpaper.projectPath,
                    properties: { ...defaults, ...originalProperties },
                } : null;
                if (!wallpaper) {
                    try { await fs.promises.access(selection.file); remembered = { file: selection.file, properties: originalProperties }; }
                    catch (error) { if (error.code !== 'ENOENT') throw error; }
                }
            }
            if (!remembered) remembered = await storage.get('desktop-wallpaper');
            if (!remembered && runtime.active) remembered = descriptionFor(runtime.active.source, runtime.active.presetName);
            if (remembered) await storage.set('desktop-wallpaper', remembered);
        }),
        hide: () => enqueue(() => runtime.cli('closeWallpaper', ['-monitor', '0'])),
        restore: () => enqueue(async () => {
            await catalog.reloadConfig();
            const current = catalog.user?.general?.wallpaperconfig?.selectedwallpapers?.Monitor0;
            if (current?.file) return;
            if (!remembered) remembered = await storage.get('desktop-wallpaper');
            if (!remembered && runtime.active) remembered = descriptionFor(runtime.active.source, runtime.active.presetName);
            if (!remembered) return;
            await runtime.cli('openWallpaper', ['-file', remembered.file, '-monitor', '0']);
            if (Object.keys(remembered.properties).length) {
                await runtime.cli('applyProperties', ['-monitor', '0', '-properties', 'RAW~(' + JSON.stringify(remembered.properties) + ')~END']);
            }
        }),
    };
}

module.exports = { createWeDesktop };
