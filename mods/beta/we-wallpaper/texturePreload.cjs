'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Draw inside the isolated world so a VideoFrame never crosses contextBridge.
async function initialize() {
    const prefix = 'folia-we-native:';
    const rpcSession = await ipcRenderer.invoke(prefix + 'bootstrap');
    if (!rpcSession) return;
    const { sharedTexture } = require('electron');
    const version = '0.4.8';
    const canvases = new Map();

    sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, consumerId) => {
        let frame;
        try {
            const target = canvases.get(consumerId);
            if (!target || !target.canvas.isConnected) return;
            frame = importedSharedTexture.getVideoFrame();
            if (target.canvas.width !== frame.displayWidth || target.canvas.height !== frame.displayHeight) {
                target.canvas.width = frame.displayWidth;
                target.canvas.height = frame.displayHeight;
            }
            target.context.drawImage(frame, 0, 0);
            const size = frame.displayWidth + 'x' + frame.displayHeight;
            if (target.size !== size) {
                target.size = size;
                target.canvas.dispatchEvent(new CustomEvent('we-native-frame', { detail: { width: frame.displayWidth, height: frame.displayHeight } }));
            }
        } catch (error) {
            ipcRenderer.send(prefix + 'draw-failed', consumerId, String(error.message || error));
        } finally {
            frame?.close();
            importedSharedTexture.release();
        }
    });

    contextBridge.exposeInMainWorld('foliaWeNative', {
        version,
        rpcSession,
        expectFrame(consumerId) { const target = canvases.get(consumerId); if (target) target.size = ''; },
        async attachCanvas(canvasId, consumerId) {
            const roots = [document];
            let canvas;
            while (roots.length && !canvas) {
                const root = roots.pop();
                canvas = root.getElementById(canvasId);
                if (!canvas) for (const element of root.querySelectorAll('*')) {
                    if (element.shadowRoot) roots.push(element.shadowRoot);
                }
            }
            if (!(canvas instanceof HTMLCanvasElement)) throw new Error('没有找到 WE 背景画布');
            canvases.set(consumerId, { canvas, size: '', context: canvas.getContext('2d', { alpha: false, desynchronized: true }) });
            try {
                return await ipcRenderer.invoke(prefix + 'attach', { consumerId, version });
            } catch (error) {
                canvases.delete(consumerId);
                throw error;
            }
        },
        detachCanvas(consumerId) {
            canvases.delete(consumerId);
            ipcRenderer.send(prefix + 'detach', consumerId);
        },
        pointer(data) { ipcRenderer.send(prefix + 'pointer', data); },
    });
    window.dispatchEvent(new Event('folia-we-native-ready'));

    window.addEventListener('pagehide', () => {
        for (const consumerId of canvases.keys()) ipcRenderer.send(prefix + 'detach', consumerId);
        canvases.clear();
    });
}
if (process.isMainFrame) {
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', () => { void initialize().catch(error => console.error('[WE preload]', error)); }, { once: true });
    else void initialize().catch(error => console.error('[WE preload]', error));
}
