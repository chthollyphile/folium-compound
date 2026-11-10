'use strict';

const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { matchFileId } = require('./catalogIndex.cjs');

// WE remains the owner of project files, user properties and saved presets.
const disposedError = () => Object.assign(new Error('WE 壁纸目录已释放'), { code: 'WE_CATALOG_DISPOSED' });

function loadCatalog(catalog, action, input) {
    return new Promise((resolve, reject) => {
        if (catalog.workerError) { reject(catalog.workerError); return; }
        catalog.request = { resolve, reject };
        catalog.worker.ref();
        try { catalog.worker.postMessage({ action, ...input }); }
        catch (error) {
            catalog.request = null;
            catalog.worker.unref();
            reject(error);
        }
    });
}

class WallpaperCatalog {
    constructor() {
        this.wallpapers = [];
        this.byId = new Map();
        this.weDir = null;
        this.user = null;
        this.selectedId = null;
        this.library = null;
        this.descriptions = new Map();
        this.propertyKeys = new Map();
        this.presetKeys = new Map();
        this.pending = Promise.resolve();
        this.request = null;
        this.workerError = null;
        this.worker = new Worker(path.join(__dirname, 'catalogWorker.cjs'));
        this.worker.on('message', message => {
            const request = this.request;
            this.request = null;
            this.worker.unref();
            if (!request) return;
            if (this.disposed) request.reject(disposedError());
            else if (message.ok) request.resolve(message.result);
            else request.reject(Object.assign(new Error(message.error.message), { code: message.error.code }));
        });
        const failed = error => {
            this.workerError = error;
            this.request?.reject(error);
            this.request = null;
        };
        this.worker.once('error', failed);
        this.worker.once('exit', code => {
            if (!this.disposed && !this.workerError) failed(new Error('WE 壁纸索引线程已退出（' + code + '）'));
        });
        this.worker.unref();
        this.disposed = false;
        this.disposePromise = null;
        this.dto = { ok: true, weDir: null, selectedId: null, fps: 60, wallpapers: [] };
        this.previewBase = null;
        this.previewDto = null;
    }

    enqueue(action) {
        if (this.disposed) return Promise.reject(disposedError());
        const operation = this.pending.then(() => {
            if (this.disposed) throw disposedError();
            return action();
        });
        this.pending = operation.catch(() => {});
        return operation;
    }

    dispose() {
        if (!this.disposePromise) {
            this.disposed = true;
            this.request?.reject(disposedError());
            this.request = null;
            this.disposePromise = Promise.all([this.pending, this.worker.terminate()]).then(() => {});
        }
        return this.disposePromise;
    }

    applyState(state) {
        if (this.disposed) throw disposedError();
        if (state.library) {
            this.library = state.library;
            this.wallpapers = state.library.wallpapers;
            this.byId = state.library.byId;
        }
        this.weDir = state.snapshot.weDir;
        this.user = state.user;
        this.selectedId = state.snapshot.selectedId;
        this.descriptions = state.descriptions;
        this.propertyKeys = state.propertyKeys;
        this.presetKeys = state.presetKeys;
        this.dto = state.snapshot;
        this.previewBase = null;
        this.previewDto = null;
    }

    refresh() {
        return this.enqueue(async () => {
            this.applyState(await loadCatalog(this, 'refresh', { selectedId: this.selectedId }));
            return this.snapshot();
        });
    }

    reloadConfig() {
        return this.enqueue(async () => {
            if (!this.weDir) return;
            this.applyState(await loadCatalog(this, 'reload', {
                weDir: this.weDir, selectedId: this.selectedId,
            }));
        });
    }

    matchFile(file) {
        const id = this.library && matchFileId(this.library, file);
        return id ? this.byId.get(id) || null : null;
    }

    settingsKeys(wallpaper, map) {
        if (map === this.user?.wproperties) return this.propertyKeys.get(wallpaper.id) || [];
        if (map === this.user?.general?.wpresets) return this.presetKeys.get(wallpaper.id) || [];
        return [];
    }

    describe(id, presetName = '', overrides = {}) {
        const cached = this.descriptions.get(id);
        const wallpaper = this.byId.get(id);
        if (!cached || !wallpaper) throw new Error('选中的壁纸已经不在 WE 壁纸库中');
        const preset = presetName ? cached.presetsByName.get(presetName) : null;
        if (presetName && !preset) throw new Error('WE 中不存在预设：' + presetName);
        const baseProperties = { ...cached.baseProperties, ...(preset?.properties || {}) };
        return {
            id, title: wallpaper.title, type: wallpaper.type, entryPath: wallpaper.entryPath,
            definitions: wallpaper.project.general.properties, presets: [...cached.presetNames], baseProperties,
            properties: { ...baseProperties, ...overrides },
            settingsSource: preset ? cached.presetKey : cached.settingsSource,
        };
    }

    snapshot(base = '') {
        if (!base) return this.dto;
        if (this.previewBase !== base) {
            this.previewBase = base;
            this.previewDto = {
                ...this.dto,
                wallpapers: this.dto.wallpapers.map(wallpaper => ({
                    ...wallpaper, previewUrl: wallpaper.previewUrl ? base + wallpaper.previewUrl : null,
                })),
            };
        }
        return this.previewDto;
    }
}

module.exports = { WallpaperCatalog };
