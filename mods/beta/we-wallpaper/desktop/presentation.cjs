'use strict';

function fadePresentation(covered, duration) {
    const id = 'folia-wallpaper-transition';
    let overlay = document.getElementById(id);
    if (!overlay) {
        const roots = [document];
        let source;
        while (roots.length && !source) {
            const root = roots.pop();
            source = root.querySelector('.we-native-background canvas');
            if (!source) for (const element of root.querySelectorAll('*')) {
                if (element.shadowRoot) roots.push(element.shadowRoot);
            }
        }
        overlay = document.createElement('canvas');
        overlay.id = id;
        overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:2147483647;pointer-events:none;opacity:0;background:#09090b';
        if (source) {
            overlay.width = source.width;
            overlay.height = source.height;
            overlay.getContext('2d', { alpha: false }).drawImage(source, 0, 0);
        }
        document.body.appendChild(overlay);
    }
    const target = covered ? '1' : '0';
    return overlay.animate([{ opacity: getComputedStyle(overlay).opacity }, { opacity: target }], {
        duration, easing: 'ease-in-out', fill: 'forwards',
    }).finished.then(() => { if (!covered) overlay.remove(); });
}

function fadeWindow(win, covered, duration) {
    // SetParent and layered-window opacity break Chromium composition on the classic desktop.
    return win.webContents.executeJavaScript('(' + fadePresentation.toString() + ')(' + covered + ',' + duration + ')');
}

// Borderless windows can move between WorkerW and the ordinary desktop without replacing Chromium.
function createWindowsWallpaperPresentation({ getWindow, getTargetBounds, getStoredPresentation, savePresentation, ensureVisibleBounds, attach, detach, clearTarget, notify }) {
    let owner = null;
    let normal = null;
    let pending = Promise.resolve();
    let desired = false;

    async function apply() {
        const win = getWindow();
        if (!win || win.isDestroyed()) return;
        if (owner !== win) {
            owner = win;
            normal = null;
        }
        const enabled = desired;
        if (enabled === win.__foliaWeDesktop) {
            notify();
            return;
        }
        await fadeWindow(win, true, 110);
        win.hide();
        try {
        if (enabled) {
            const bounds = getTargetBounds();
            normal = {
                bounds: win.getNormalBounds(), isMaximized: win.isMaximized(),
                resizable: win.isResizable(), movable: win.isMovable(),
                maximizable: win.isMaximizable(), minimizable: win.isMinimizable(),
                alwaysOnTop: win.isAlwaysOnTop(),
                skipTaskbar: getStoredPresentation().skipTaskbar,
            };
            savePresentation(normal);
            win.__foliaWeDesktop = true;
            win.__wallpaperGeometry = true;
            if (win.isMaximized()) win.unmaximize();
            win.setAlwaysOnTop(false);
            win.setResizable(false);
            win.setMovable(false);
            win.setMaximizable(false);
            win.setMinimizable(false);
            win.setSkipTaskbar(true);
            win.setBounds(bounds, false);
            await attach();
            win.showInactive();
        } else {
            await detach();
            if (win.isDestroyed()) return;
            const presentation = normal || getStoredPresentation();
            win.__foliaWeDesktop = false;
            win.__wallpaperGeometry = false;
            win.setResizable(presentation.resizable);
            win.setMovable(presentation.movable);
            win.setMaximizable(presentation.maximizable);
            win.setMinimizable(presentation.minimizable);
            win.setAlwaysOnTop(presentation.alwaysOnTop);
            win.setSkipTaskbar(presentation.skipTaskbar ?? false);
            win.setBounds(ensureVisibleBounds(presentation.bounds), false);
            if (presentation.isMaximized) win.maximize();
            clearTarget();
            win.show();
            win.focus();
        }
        notify();
        await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))');
        console.info('[WallpaperWin] presentation changed without reloading', { enabled, windowId: win.id });
        } finally {
            if (!win.isDestroyed()) {
                if (!win.isVisible()) win.showInactive();
                await fadeWindow(win, false, 160);
                if (!enabled) {
                    win.hide();
                    win.show();
                    win.webContents.invalidate();
                    win.focus();
                }
            }
        }
    }

    return {
        setEnabled(enabled) {
            desired = enabled;
            const operation = pending.then(apply);
            pending = operation.catch(() => {});
            return operation;
        },
    };
}

module.exports = { createWindowsWallpaperPresentation };
