'use strict';

const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { app, screen } = require('electron');
const { randomUUID } = require('crypto');

// A single named WE window owns the original scene; Folia consumes its texture.
const execute = promisify(execFile);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const quoteArgument = value => {
    const text = String(value);
    if (text.startsWith('RAW~(')) return text;
    if (!/[\s"]/.test(text)) return text;
    return '"' + text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
};

class WeRuntime {
    constructor({ catalog, bridge, properties, publish, log }) {
        this.catalog = catalog;
        this.bridge = bridge;
        this.properties = properties;
        this.publish = publish;
        this.log = log;
        this.native = require('./bin/we-capture-v2.win32-' + process.arch + '.node');
        this.capture = null;
        this.active = null;
        this.desired = null;
        this.epoch = 0;
        this.queue = Promise.resolve();
        this.state = { phase: 'idle', source: null, message: '' };
        this.cliPath = null;
        this.instance = randomUUID().slice(0, 8);
        this.windowEvents = [];
        this.hidden = false;
    }

    enqueue(action) {
        const operation = this.queue.then(action);
        this.queue = operation.catch(() => {});
        return operation;
    }

    status(patch) {
        if (patch) {
            this.state = { ...this.state, ...patch };
            this.publish(this.state);
        }
        return this.state;
    }

    async cli(command, args = []) {
        if (!this.cliPath) {
            const { stdout } = await execute('tasklist', ['/FI', 'IMAGENAME eq wallpaper64.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
            this.cliPath = path.join(this.catalog.weDir, /"wallpaper64\.exe"/i.test(stdout) ? 'wallpaper64.exe' : 'wallpaper32.exe');
        }
        return execute(this.cliPath, ['-control', command, ...args].map(quoteArgument), {
            encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, timeout: 15000,
        });
    }

    async apply(properties) {
        if (!this.active) return;
        const signature = JSON.stringify(properties);
        if (this.active.propertySignature === signature) return;
        await this.cli('applyProperties', ['-location', this.active.name, '-properties', 'RAW~(' + JSON.stringify(properties) + ')~END']);
        if (this.active) this.active.propertySignature = signature;
    }

    async closeActive() {
        for (const [window, name, listener] of this.windowEvents) window.removeListener(name, listener);
        this.windowEvents = [];
        this.hidden = false;
        const capture = this.capture;
        this.capture = null;
        const active = this.active;
        this.active = null;
        try {
            if (capture) await capture.stop();
        } finally {
            if (active) await this.cli('closeWallpaper', ['-location', active.name]);
        }
    }

    start(params) {
        this.desired = params.consumerId;
        const epoch = ++this.epoch;
        return this.enqueue(async () => {
            if (epoch !== this.epoch || !this.bridge.has(params.consumerId)) return this.status();
            const source = params.followWE ? this.catalog.selectedId || params.source : params.source || this.catalog.selectedId;
            const wallpaper = this.catalog.byId.get(source);
            if (!wallpaper) throw new Error('请先在模组中选择一张 WE 壁纸');
            const presetName = params.presetName || '';
            const fps = params.fps > 0 ? Math.round(params.fps) : Number(this.catalog.user?.general?.user?.fps) || 60;
            const signature = JSON.stringify([source, presetName, fps]);
            const viewport = this.bridge.viewport(params.consumerId, params.viewport);
            const position = this.bridge.sourcePosition();
            if (this.active?.signature === signature && this.capture) {
                this.active.consumerId = params.consumerId;
                this.active.viewport = params.viewport;
                this.placeSource(viewport);
                this.bindOwner();
                return this.status();
            }
            await this.closeActive();
            if (epoch !== this.epoch || !this.bridge.has(params.consumerId)) return this.status();
            const name = 'Folia WE ' + this.instance + ' ' + epoch;
            this.status({ phase: 'opening', source, message: '' });
            this.active = { name, source, presetName, signature, consumerId: params.consumerId, viewport: params.viewport, hwnd: null };
            await this.cli('openWallpaper', [
                '-file', wallpaper.projectPath, '-playInWindow', name, '-borderless',
                '-width', String(viewport.width), '-height', String(viewport.height),
                '-x', String(position.x), '-y', String(position.y),
            ]);
            let hwnd = null;
            const deadline = Date.now() + 12000;
            while (!hwnd && Date.now() < deadline && epoch === this.epoch) {
                hwnd = this.native.findWindow(name);
                if (!hwnd) await delay(100);
            }
            if (epoch !== this.epoch || !this.bridge.has(params.consumerId)) {
                await this.closeActive();
                return this.status();
            }
            if (!hwnd) throw new Error('WE 没有创建壁纸渲染窗口，请确认 Wallpaper Engine 正在运行');
            this.active.hwnd = hwnd;
            await this.apply(this.catalog.describe(source, presetName, this.properties(source, presetName)).properties);
            if (epoch !== this.epoch) { await this.closeActive(); return this.status(); }
            const info = await app.getGPUInfo('basic');
            if (epoch !== this.epoch || !this.bridge.has(params.consumerId)) {
                await this.closeActive();
                return this.status();
            }
            const gpu = info.gpuDevice.find(device => device.active) || info.gpuDevice[0];
            let capture;
            let captureError;
            const pendingFrames = [];
            let frameSize = '';
            capture = await this.native.Capture.create(hwnd, fps, gpu.vendorId, gpu.deviceId, (error, frame) => {
                if (!capture) {
                    if (error) captureError = error;
                    else pendingFrames.push(frame.frameId);
                    return;
                }
                if (error) { this.fail(error, capture); return; }
                if (this.capture !== capture || !this.active) { capture.release(frame.frameId); return; }
                const nextSize = frame.width + 'x' + frame.height;
                if (frameSize !== nextSize) {
                    frameSize = nextSize;
                    this.log.info('[WE wallpaper] native desktop frame ' + nextSize + ' at ' + fps + ' FPS');
                    this.status({ phase: 'streaming', source, width: frame.width, height: frame.height, fps });
                }
                void this.bridge.send(this.active.consumerId, capture, frame);
            }).catch(async error => {
                await this.closeActive();
                throw error;
            });
            this.capture = capture;
            for (const frameId of pendingFrames) capture.release(frameId);
            if (captureError) {
                await this.closeActive();
                throw captureError;
            }
            if (epoch !== this.epoch || !this.bridge.has(params.consumerId)) {
                await this.closeActive();
                return this.status();
            }
            // WGC must acquire the window before it is removed from the taskbar.
            this.placeSource(viewport);
            this.bindOwner();
            return this.status();
        }).catch(async error => {
            if (epoch === this.epoch) {
                this.status({ phase: 'error', message: error.message });
                await this.enqueue(async () => {
                    if (epoch === this.epoch) await this.closeActive();
                }).catch(closeError => this.log.error('[WE wallpaper] ' + closeError.message));
            }
            throw error;
        });
    }

    placeSource(bounds) {
        const position = this.bridge.sourcePosition();
        const geometry = [position.x, position.y, bounds.width, bounds.height].join(',');
        if (this.active.geometry === geometry) return;
        this.native.placeWindow(this.active.hwnd, position.x, position.y, bounds.width, bounds.height);
        this.active.geometry = geometry;
    }

    bindOwner() {
            for (const [window, name, listener] of this.windowEvents) window.removeListener(name, listener);
            this.windowEvents = [];
            const active = this.active;
            const owner = this.bridge.window(active.consumerId);
            const visibility = () => {
                const next = owner.isMinimized() || !owner.isVisible();
                if (next === this.hidden) return;
                this.hidden = next;
                void this.enqueue(async () => {
                    if (active === this.active) await this.cli(next ? 'pause' : 'play', ['-location', active.name]);
                }).catch(error => this.log.warn('[WE wallpaper] ' + error.message));
            };
            for (const name of ['minimize', 'restore', 'hide', 'show']) {
                owner.on(name, visibility);
                this.windowEvents.push([owner, name, visibility]);
            }
            const move = () => {
                if (this.active !== active) return;
                const bounds = this.bridge.viewport(this.active.consumerId, this.active.viewport);
                this.placeSource(bounds);
            };
            owner.on('move', move);
            this.windowEvents.push([owner, 'move', move]);
            for (const name of ['display-added', 'display-removed', 'display-metrics-changed']) {
                screen.on(name, move);
                this.windowEvents.push([screen, name, move]);
            }
            visibility();
    }

    fail(error, capture = this.capture) {
        if (capture && capture !== this.capture) return;
        const active = this.active;
        this.status({ phase: 'error', message: error.message });
        this.log.error('[WE wallpaper] ' + error.message);
        void this.enqueue(async () => {
            if (this.capture === capture && this.active === active) await this.closeActive();
        }).catch(closeError => this.log.error('[WE wallpaper] ' + closeError.message));
    }

    stop(consumerId) {
        if (consumerId && this.desired !== consumerId) return Promise.resolve();
        this.desired = null;
        ++this.epoch;
        return this.enqueue(async () => {
            await this.closeActive();
            this.status({ phase: 'idle', source: null, message: '' });
        });
    }

    updateProperties(source, presetName, properties) {
        return this.enqueue(async () => {
            if (this.active?.source === source && this.active.presetName === presetName) await this.apply(properties);
        });
    }

    pointer(data) {
        const active = this.active;
        if (active?.hwnd && active.consumerId === data.consumerId) {
            this.native.pointer(active.hwnd, data.kind, Math.round(data.x), Math.round(data.y), data.buttons || 0, Math.round(data.delta || 0));
        }
    }
}

module.exports = { WeRuntime };
