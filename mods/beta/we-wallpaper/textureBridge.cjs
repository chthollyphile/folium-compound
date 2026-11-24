'use strict';

const path = require('path');
const { randomBytes } = require('crypto');
const { ipcMain, session, sharedTexture, screen, BrowserWindow } = require('electron');

// Only texture metadata crosses JS IPC; pixels stay in GPU resources.
const PREFIX = 'folia-we-native:';
const VERSION = '0.4.8';

function installTextureBridge({ getMainWindow, onDetach, onPointer, onError }) {
    const targets = new Map();
    const watched = new Map();
    let rpcGrant = null;
    let clearGrant = () => {};
    const authorized = event => event.sender === getMainWindow()?.webContents && event.senderFrame === event.sender.mainFrame;
    ipcMain.handle(PREFIX + 'bootstrap', event => {
        if (!authorized(event)) return null;
        if (rpcGrant?.contents === event.sender && rpcGrant.frame === event.senderFrame) return rpcGrant.token;
        clearGrant();
        const contents = event.sender;
        rpcGrant = { token: randomBytes(32).toString('hex'), contents, frame: event.senderFrame };
        const navigation = details => { if (details.isMainFrame && !details.isSameDocument) clearGrant(); };
        const revoke = () => {
            rpcGrant = null;
            contents.removeListener('did-start-navigation', navigation);
            contents.removeListener('render-process-gone', revoke);
            contents.removeListener('destroyed', revoke);
        };
        clearGrant = revoke;
        contents.on('did-start-navigation', navigation);
        contents.on('render-process-gone', revoke);
        contents.on('destroyed', revoke);
        return rpcGrant.token;
    });
    const preloadId = session.defaultSession.registerPreloadScript({
        type: 'frame', filePath: path.join(__dirname, 'texturePreload.cjs'),
    });

    const removeTarget = consumerId => {
        if (!targets.delete(consumerId)) return;
        onDetach(consumerId);
    };

    ipcMain.handle(PREFIX + 'attach', (event, { consumerId, version }) => {
        if (!authorized(event)) throw new Error('WE native frames are available only to the Folia main window');
        if (typeof consumerId !== 'string' || consumerId.length > 100) throw new Error('Invalid frame consumer');
        if (version !== VERSION) throw new Error('请重新载入 Folia 以更新 WE 画面接入模块');
        targets.set(consumerId, { contents: event.sender, frame: event.senderFrame });
        if (!watched.has(event.sender.id)) {
            const contents = event.sender;
            const cleanup = () => {
                for (const [id, target] of targets) if (target.contents === contents) removeTarget(id);
            };
            contents.on('render-process-gone', cleanup);
            contents.on('destroyed', cleanup);
            watched.set(contents.id, { contents, cleanup });
        }
        return { version: VERSION };
    });

    const detach = (event, consumerId) => {
        if (authorized(event) && targets.get(consumerId)?.contents === event.sender) removeTarget(consumerId);
    };
    const pointer = (event, data) => {
        if (authorized(event) && targets.get(data.consumerId)?.contents === event.sender) onPointer(data);
    };
    const drawFailed = (event, consumerId, message) => {
        if (authorized(event) && targets.get(consumerId)?.contents === event.sender) onError(new Error(String(message).slice(0, 500)));
    };
    ipcMain.on(PREFIX + 'detach', detach);
    ipcMain.on(PREFIX + 'pointer', pointer);
    ipcMain.on(PREFIX + 'draw-failed', drawFailed);

    return {
        version: VERSION,
        allowsRequest(token) {
            const contents = getMainWindow()?.webContents;
            return Boolean(rpcGrant && token === rpcGrant.token && contents === rpcGrant.contents
                && !contents.isDestroyed() && !rpcGrant.frame.detached && contents.mainFrame === rpcGrant.frame);
        },
        has: consumerId => targets.has(consumerId),
        window(consumerId) {
            const contents = targets.get(consumerId)?.contents;
            return contents && !contents.isDestroyed() ? BrowserWindow.fromWebContents(contents) : null;
        },
        viewport(consumerId) {
            const window = this.window(consumerId);
            if (!window) throw new Error('Folia 的壁纸显示区域已经关闭');
            // Keep WE's scene layout and GPU surface stable while Folia changes window size.
            const display = screen.getDisplayMatching(window.getBounds());
            return screen.dipToScreenRect(window, display.bounds);
        },
        sourcePosition() {
            const right = Math.max(...screen.getAllDisplays().map(display => {
                const bounds = screen.dipToScreenRect(null, display.bounds);
                return bounds.x + bounds.width;
            }));
            return { x: right + 64, y: 0 };
        },
        async send(consumerId, capture, frame) {
            const target = targets.get(consumerId);
            const owner = target && !target.contents.isDestroyed() ? BrowserWindow.fromWebContents(target.contents) : null;
            if (!target || target.contents.isDestroyed() || target.frame.detached || target.sending || !owner || owner.isMinimized() || !owner.isVisible()) {
                capture.release(frame.frameId);
                return;
            }
            target.sending = true;
            let texture;
            try {
                texture = sharedTexture.importSharedTexture({
                    textureInfo: {
                        codedSize: { width: frame.width, height: frame.height },
                        handle: { ntHandle: frame.handle }, pixelFormat: 'bgra',
                    },
                    allReferencesReleased: () => capture.release(frame.frameId),
                });
                await sharedTexture.sendSharedTexture({ frame: target.frame, importedSharedTexture: texture }, consumerId);
            } catch (error) {
                if (!texture) capture.release(frame.frameId);
                onError(error, capture);
            } finally {
                texture?.release();
                target.sending = false;
            }
        },
        dispose() {
            clearGrant();
            session.defaultSession.unregisterPreloadScript(preloadId);
            ipcMain.removeHandler(PREFIX + 'attach');
            ipcMain.removeHandler(PREFIX + 'bootstrap');
            ipcMain.removeListener(PREFIX + 'detach', detach);
            ipcMain.removeListener(PREFIX + 'pointer', pointer);
            ipcMain.removeListener(PREFIX + 'draw-failed', drawFailed);
            for (const { contents, cleanup } of watched.values()) {
                contents.removeListener('render-process-gone', cleanup);
                contents.removeListener('destroyed', cleanup);
            }
            targets.clear();
            watched.clear();
        },
    };
}

module.exports = { installTextureBridge };
