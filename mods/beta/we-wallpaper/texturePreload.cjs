'use strict';

const { contextBridge, ipcRenderer, sharedTexture } = require('electron');

// Draw inside the isolated world so a VideoFrame never crosses contextBridge.
if (process.isMainFrame) {
    const prefix = 'folia-we-native:';
    const version = '0.3.5';
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
        } finally {
            frame?.close();
            importedSharedTexture.release();
        }
    });

    contextBridge.exposeInMainWorld('foliaWeNative', {
        version,
        request: (name, args) => ipcRenderer.invoke(prefix + 'request', name, args),
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
            canvases.set(consumerId, { canvas, context: canvas.getContext('2d', { alpha: false, desynchronized: true }) });
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

    window.addEventListener('pagehide', () => {
        for (const consumerId of canvases.keys()) ipcRenderer.send(prefix + 'detach', consumerId);
        canvases.clear();
    });
}
