'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { app } = require('electron');
const { WallpaperCatalog } = require('./catalog.cjs');
const { installTextureBridge } = require('./textureBridge.cjs');
const { WeRuntime } = require('./weRuntime.cjs');
const { createWeDesktop } = require('./weDesktop.cjs');
const { createDesktopHost, mainWindow } = require('./desktopHost.cjs');
const { randomBytes } = require('crypto');
const { capturePlaybackForOpaque } = require('./opaqueBackground.cjs');

// The mod controls WE and supplies its native frames to the existing Folia background registry.
module.exports = function activate(api) {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Wallpaper Engine 原生联动当前仅支持 Windows x64');
    // Folium 1's manifest parser rejects prerelease suffixes before loading the mod.
    if (!/^0\.7\.27(?:[-+].+)?$/.test(app.getVersion())) throw new Error('Wallpaper Engine 原生联动需要 Folia 0.7.27（含 beta 构建），当前版本：' + app.getVersion());
    const catalog = new WallpaperCatalog();
    let runtime;
    let desktop;
    let host;
    let bridge;
    let server;
    let watcher;
    let configTimer;
    let base = '';
    let disposed = false;
    let cleaned = false;
    let cleanupPromise;
    const cleanupKey = Symbol.for('folia-we-native-cleanup');
    const previousCleanup = globalThis[cleanupKey] || Promise.resolve();
    const handlers = new Map();
    const handle = (name, handler) => handlers.set(name, handler);
    const previewToken = randomBytes(24).toString('hex');
    let saved = {};
    const propertyKey = (id, preset) => id + ':' + preset;
    const overrides = (id, preset) => saved[propertyKey(id, preset)] || {};

    const cleanup = () => {
        if (cleanupPromise) return cleanupPromise;
        disposed = true;
        clearTimeout(configTimer);
        watcher?.close();
        const win = mainWindow();
        if (win) delete win.__foliaWePreloadVersion;
        bridge?.dispose();
        cleanupPromise = (async () => {
            try { await host?.dispose(); }
            finally {
                try { await runtime?.stop(); }
                finally { await catalog.dispose(); }
            }
        })().finally(() => { cleaned = true; app.removeListener('before-quit', beforeQuit); });
        globalThis[cleanupKey] = cleanupPromise.catch(() => {});
        server?.close();
        return cleanupPromise;
    };
    const beforeQuit = event => {
        if (cleaned) return;
        event.preventDefault();
        void cleanup().catch(error => api.log.error(error)).finally(() => app.quit());
    };
    app.on('before-quit', beforeQuit);
    api.onDispose(() => { void cleanup().catch(error => api.log.error(error)); });

    const ready = (async () => {
        await previousCleanup;
        if (disposed) return;
        saved = await api.storage.get('native-properties') || {};
        await catalog.refresh();
        if (disposed) return;
        bridge = installTextureBridge({
            getMainWindow: mainWindow,
            onRequest: (name, args) => {
                const handler = handlers.get(name);
                if (!handler) throw new Error('Unknown WE operation');
                return handler(...args);
            },
            onDetach: consumerId => { void runtime?.stop(consumerId).catch(error => api.log.error('[WE wallpaper] ' + error.message)); },
            onPointer: data => runtime?.pointer(data),
            onError: (error, capture) => runtime?.fail(error, capture),
        });
        runtime = new WeRuntime({
            catalog, bridge, properties: overrides,
            publish: state => { if (!disposed) api.rpc.send('native-status', state); },
            log: api.log,
        });
        desktop = createWeDesktop({ catalog, runtime, storage: api.storage, properties: overrides });
        host = createDesktopHost({ storage: api.storage, desktop, publish: state => api.rpc.send('desktop-mode', state), log: api.log });
        await host.initialize();
        server = http.createServer(async (req, res) => {
            try {
                if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
                const origin = req.headers.origin;
                const appOrigin = new URL(mainWindow()?.webContents.getURL() || 'file:///').origin;
                if (origin && origin !== appOrigin) { res.writeHead(403); res.end(); return; }
                const url = new URL(req.url, 'http://127.0.0.1');
                const prefix = '/' + previewToken + '/preview/';
                const id = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
                const wallpaper = /^[a-f0-9]{12}$/.test(id) && catalog.byId.get(id);
                const file = wallpaper?.previewPath;
                if (!file) { res.writeHead(404); res.end(); return; }
                const [realFile, realDir] = await Promise.all([fs.promises.realpath(file), fs.promises.realpath(wallpaper.dir)]);
                if (!realFile.startsWith(realDir + path.sep) || !/\.(png|jpe?g|gif|webp)$/i.test(realFile)) { res.writeHead(403); res.end(); return; }
                const stat = await fs.promises.stat(realFile);
                res.writeHead(200, {
                    'Content-Type': path.extname(file).toLowerCase() === '.gif' ? 'image/gif' : 'image/' + path.extname(file).slice(1).replace('jpg', 'jpeg'),
                    'Content-Length': stat.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
                });
                if (req.method === 'HEAD') { res.end(); return; }
                const stream = fs.createReadStream(realFile);
                res.once('close', () => stream.destroy());
                stream.on('error', error => res.destroy(error));
                stream.pipe(res);
            } catch (error) {
                if (!res.headersSent) { res.writeHead(404); res.end(); }
                else res.destroy(error);
            }
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        if (disposed) { server.close(); return; }
        base = 'http://127.0.0.1:' + server.address().port + '/' + previewToken;
        watcher = fs.watch(path.join(catalog.weDir, 'config.json'), () => {
            clearTimeout(configTimer);
            configTimer = setTimeout(async () => {
                try {
                    const previous = catalog.selectedId;
                    await catalog.reloadConfig();
                    if (!disposed && previous !== catalog.selectedId) api.rpc.send('we-selection', { id: catalog.selectedId });
                    const active = runtime.active;
                    if (!disposed && active) {
                        const description = catalog.describe(active.source, active.presetName, overrides(active.source, active.presetName));
                        await runtime.updateProperties(active.source, active.presetName, description.properties);
                    }
                } catch (error) { api.log.warn('[WE wallpaper] ' + error.message); }
            }, 350);
        });
        api.log.info('[WE wallpaper] Native integration ready (' + catalog.wallpapers.length + ' wallpapers)');
        const win = mainWindow();
        if (win && win.__foliaWePreloadVersion !== bridge.version) {
            win.__foliaWePreloadVersion = bridge.version;
            setImmediate(() => { if (!win.isDestroyed()) win.webContents.reload(); });
        }
    })();

    handle('assets', async () => {
        await ready;
        return { ...catalog.snapshot(base), native: runtime.status(), bridgeVersion: bridge.version };
    });
    handle('refresh', async () => {
        await ready;
        await catalog.refresh();
        return catalog.snapshot(base);
    });
    handle('describe', async (id, preset = '') => {
        await ready;
        return catalog.describe(id, preset, overrides(id, preset));
    });
    handle('start', async params => { await ready; return runtime.start(params); });
    handle('stop', async consumerId => { await ready; await runtime.stop(consumerId); });
    handle('status', async () => { await ready; return runtime.status(); });
    handle('desktop-state', async () => { await ready; return host.state(); });
    handle('desktop-input-regions', async rects => { await ready; host.updateInput(rects); });
    handle('capture-for-opaque', async () => {
        await ready;
        return capturePlaybackForOpaque(mainWindow());
    });
    handle('enter-desktop', async () => { await ready; return host.setEnabled(true); });
    handle('leave-desktop', async () => { await ready; return host.setEnabled(false); });
    handle('prepare-desktop', async () => {
        await ready;
        await desktop.remember();
        return true;
    });
    handle('suspend-desktop', async () => {
        await ready;
        const owner = runtime.active && bridge.window(runtime.active.consumerId);
        if (owner?.__foliaWeDesktop) await desktop.hide();
    });
    handle('restore-desktop', async () => { await ready; await desktop.restore(); });
    handle('properties', async (id, preset, patch) => {
        await ready;
        const key = propertyKey(id, preset);
        const original = catalog.describe(id, preset).properties;
        saved[key] = { ...overrides(id, preset) };
        for (const [name, value] of Object.entries(patch)) {
            if (value === original[name]) delete saved[key][name];
            else saved[key][name] = value;
        }
        await api.storage.set('native-properties', saved);
        const description = catalog.describe(id, preset, saved[key]);
        await runtime.updateProperties(id, preset, description.properties);
        return description;
    });
    handle('reload-host', () => {
        const window = mainWindow();
        if (!window) throw new Error('没有找到 Folia 主窗口');
        setImmediate(() => window.webContents.reload());
        return true;
    });

    return ready.catch(error => {
        api.log.error('[WE wallpaper] ' + error.message);
        throw error;
    });
};
