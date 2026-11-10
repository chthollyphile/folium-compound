'use strict';

const path = require('path');
const { app, BrowserWindow, screen } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { fileURLToPath } = require('url');
const { createWindowsWallpaperController } = require('./desktop/controller.cjs');
const { createDesktopTray } = require('./desktop/tray.cjs');
const { createDesktopInput } = require('./desktop/input.cjs');
const { createWindowsWallpaperPresentation } = require('./desktop/presentation.cjs');

// Own the desktop session entirely inside this mod; the installed Folia files stay untouched.
const execute = promisify(execFile);
function mainWindow() {
    return BrowserWindow.getAllWindows().find(window => {
        if (window.getParentWindow()) return false;
        const url = window.webContents.getURL();
        if (url.includes('obs=1') || url.includes('export=1') || url.includes('remote=1')) return false;
        if (/^http:\/\/(localhost|127\.0\.0\.1):3000\//.test(url)) return true;
        return url.startsWith('file:') && path.resolve(fileURLToPath(new URL(url))) === path.join(app.getAppPath(), 'dist/index.html');
    });
}

function createDesktopHost({ storage, desktop, publish, log }) {
    let enabled = false;
    let resume = false;
    let disposed = false;
    let disposing = null;
    let bounds;
    let tray;
    const input = createDesktopInput({ getWindow:mainWindow, log });
    const values = new Map();
    const helper = path.join(__dirname, 'bin/folia-wallpaper-helper.exe');
    const getHwnd = () => {
        const win = mainWindow();
        return win && !win.isDestroyed() ? win.getNativeWindowHandle().readBigUInt64LE().toString() : null;
    };
    const controller = createWindowsWallpaperController({
        store: { get: key => key === 'wallpaper_mode' ? enabled : values.get(key), set: (key, value) => values.set(key, value) },
        helperPath: () => helper, getHwnd,
        onDegrade: () => { void setEnabled(false).catch(error => log.error(error)); },
        onReattachNeeded: () => { void setEnabled(false).catch(error => log.error(error)); },
    });
    const fit = rectangle => {
        const area = screen.getDisplayMatching(rectangle).workArea;
        const width = Math.min(rectangle.width, area.width);
        const height = Math.min(rectangle.height, area.height);
        return { x: Math.max(area.x, Math.min(rectangle.x, area.x + area.width - width)),
            y: Math.max(area.y, Math.min(rectangle.y, area.y + area.height - height)), width, height };
    };
    const presenter = createWindowsWallpaperPresentation({
        getWindow: mainWindow,
        getTargetBounds: () => screen.getPrimaryDisplay().bounds,
        getStoredPresentation: () => ({ bounds: bounds || mainWindow().getNormalBounds(),
            resizable: true, movable: true, maximizable: true, minimizable: true,
            isMaximized: false, alwaysOnTop: false, skipTaskbar: false }),
        savePresentation: value => { bounds = value.bounds; }, ensureVisibleBounds: fit,
        attach: () => controller.attachAndWait(),
        detach: () => new Promise((resolve, reject) => {
            const finish = () => execute(helper, ['detach', '--hwnd', getHwnd()], { windowsHide: true })
                .then(() => resolve(), reject);
            if (!controller.detach({ onDetached: resolve, onAborted: finish, afterExit: true })) finish();
        }),
        clearTarget: () => {},
        notify: () => { if (!disposed) publish({ enabled }); },
    });
    let pending = Promise.resolve();
    const setEnabled = next => {
        const operation = pending.then(async () => {
            if (disposed || enabled === next) return { enabled };
            if (next) {
                await desktop.remember();
                const locale = await mainWindow().webContents.executeJavaScript('document.documentElement.lang');
                tray ??= createDesktopTray(() => { void setEnabled(false).catch(error => log.error(error)); }, locale);
            }
            else await desktop.restore();
            enabled = next;
            await presenter.setEnabled(next);
            input.setEnabled(next);
            if (!next) { tray?.destroy(); tray = null; }
            await storage.set('desktop-enabled', next);
            resume = next;
            return { enabled };
        });
        pending = operation.catch(() => {});
        return operation;
    };
    function dispose() {
        if (disposing) return disposing;
        disposed = true;
        disposing = pending.then(async () => {
            try {
                if (enabled) {
                    enabled = false;
                    try { await desktop.restore(); }
                    finally { await presenter.setEnabled(false); }
                }
            } finally { controller.killHelper(); tray?.destroy(); tray = null; input.dispose(); }
        });
        return disposing;
    }
    return {
        async initialize() { resume = Boolean(await storage.get('desktop-enabled')); },
        state: () => ({ enabled, resume }),
        updateInput: rects => input.update(rects),
        setEnabled, dispose,
    };
}
module.exports = { createDesktopHost, mainWindow };
