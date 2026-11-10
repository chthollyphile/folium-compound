'use strict';

const path = require('path');
const { ipcMain, session, sharedTexture, screen, BrowserWindow } = require('electron');

// Only texture metadata crosses JS IPC; pixels stay in GPU resources.
const PREFIX = 'folia-we-native:';
const VERSION = '0.3.5';

function installTextureBridge({ getMainWindow, onRequest, onDetach, onPointer, onError }) {
    const targets = new Map();
    const watched = new Map();
    const authorized = event => event.sender === getMainWindow()?.webContents && event.senderFrame === event.sender.mainFrame;
    ipcMain.handle(PREFIX + 'request', (event, name, args) => {
        if (!authorized(event)) throw new Error('WE operations are available only to the Folia main window');
        if (typeof name !== 'string' || !Array.isArray(args)) throw new Error('Invalid WE request');
        return onRequest(name, args);
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
    ipcMain.on(PREFIX + 'detach', detach);
    ipcMain.on(PREFIX + 'pointer', pointer);

    return {
        version: VERSION,
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
            if (!target || target.contents.isDestroyed() || target.frame.detached || target.sending) {
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
            session.defaultSession.unregisterPreloadScript(preloadId);
            ipcMain.removeHandler(PREFIX + 'attach');
            ipcMain.removeHandler(PREFIX + 'request');
            ipcMain.removeListener(PREFIX + 'detach', detach);
            ipcMain.removeListener(PREFIX + 'pointer', pointer);
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
