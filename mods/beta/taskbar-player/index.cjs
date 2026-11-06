// taskbar-player / index.cjs
// Node (main process) half of the mod. It owns a small always-on-top,
// click-through-free frameless window that sits on the Windows taskbar and
// shows the song Folia is playing. Playback data comes from the host's public
// playback snapshot; the renderer half supplies cover art and the liked state,
// and performs the playback commands this window sends.

'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain, screen } = require('electron');



const CMD_CHANNEL = 'taskbar-player:cmd';
const PAGE_CHANNEL = 'taskbar-player:page';
const STATE_CHANNEL = 'taskbar-player:state';
const WINDOW_HEIGHT = 44;

const DEFAULT_CONFIG = {
    enabled: true,
    showLyric: true,
    hideWhenPaused: false,
    width: 380,
    rightOffset: 300,
    offsetY: 0,
    opacity: 0.92,
    lyricOffsetMs: 0,
};

const clampNumber = (value, min, max, fallback) => {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
};

const normalizeConfig = (raw) => {
    const values = raw && typeof raw === 'object' ? raw : {};
    return {
        enabled: values.enabled !== false,
        showLyric: values.showLyric !== false,
        hideWhenPaused: values.hideWhenPaused === true,
        width: Math.round(clampNumber(values.width, 260, 900, DEFAULT_CONFIG.width)),
        rightOffset: Math.round(clampNumber(values.rightOffset, 0, 2000, DEFAULT_CONFIG.rightOffset)),
        offsetY: Math.round(clampNumber(values.offsetY, -30, 30, DEFAULT_CONFIG.offsetY)),
        opacity: clampNumber(values.opacity, 0.3, 1, DEFAULT_CONFIG.opacity),
        lyricOffsetMs: Math.round(clampNumber(values.lyricOffsetMs, -3000, 3000, DEFAULT_CONFIG.lyricOffsetMs)),
    };
};

// Last line whose start time is not after `time`; keeps the finished line on
// screen through the gap that follows it, like the player does.
const findLine = (lines, time) => {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    let low = 0;
    let high = lines.length - 1;
    let found = -1;
    while (low <= high) {
        const middle = (low + high) >> 1;
        const start = Number(lines[middle]?.startTime);
        if (Number.isFinite(start) && start <= time) {
            found = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return found >= 0 ? lines[found] : null;
};

const taskbarRect = () => {
    const display = screen.getPrimaryDisplay();
    const { bounds, workArea } = display;
    return {
        bounds,
        workArea,
        top: workArea.y - bounds.y,
        bottom: bounds.y + bounds.height - (workArea.y + workArea.height),
        left: workArea.x - bounds.x,
        right: bounds.x + bounds.width - (workArea.x + workArea.width),
    };
};

module.exports = function activate(api) {
    if (process.platform !== 'win32') {
        api.log.info('taskbar-player only runs on Windows; nothing to do here');
        return undefined;
    }

    const state = {
        config: { ...DEFAULT_CONFIG },
        meta: { cover: null, liked: false, canLike: false },
        win: null,
        lastStateJson: '',
        lastSnapshot: null,
        manuallyHidden: false,
        disposed: false,
        configReady: false,
        pendingCommands: [],
        commandSeq: 0,
        clientHeartbeat: 0,
        warnedOfflineClient: false,
        suppressedByFullscreen: false,
        lastHostWidth: 0,
        lastHostHeight: 0,
        hostSettleTimer: null,
        selfHidden: false,
        hasShown: false,
        occluded: false,
    };

    const hideControllerWindow = () => {
        state.selfHidden = true;
        if (state.win && !state.win.isDestroyed() && state.win.isVisible()) state.win.hide();
    };

    const showControllerWindow = () => {
        state.selfHidden = false;
        state.hasShown = true;
        if (state.win && !state.win.isDestroyed()) state.win.showInactive();
    };

    const positionWindow = () => {
        const win = state.win;
        if (!win || win.isDestroyed()) return;
        const { config } = state;
        const { bounds, workArea, top, bottom } = taskbarRect();
        const width = config.width;
        const height = WINDOW_HEIGHT;
        const rightOffset = config.rightOffset;
        let x;
        let y;
        if (bottom >= 8) {
            // Taskbar at the bottom: centre the pill in the taskbar strip.
            x = bounds.x + bounds.width - rightOffset - width;
            y = workArea.y + workArea.height + Math.round((bottom - height) / 2) + config.offsetY;
        } else if (top >= 8) {
            x = bounds.x + bounds.width - rightOffset - width;
            y = bounds.y + Math.round((top - height) / 2) + config.offsetY;
        } else {
            // Auto-hide or side taskbar: keep it at the bottom-right of the work area.
            x = workArea.x + workArea.width - rightOffset - width;
            y = workArea.y + workArea.height - height - 2 + config.offsetY;
        }
        const maxX = Math.round(bounds.x + bounds.width - width);
        const maxY = Math.round(bounds.y + bounds.height - height);
        x = Math.min(maxX, Math.max(bounds.x, Math.round(x)));
        y = Math.min(maxY, Math.max(bounds.y, Math.round(y)));
        win.setBounds({ x, y, width, height });
        win.setOpacity(config.opacity);
    };

    const shouldShow = (snapshot) => {
        if (!state.config.enabled || state.manuallyHidden || !snapshot?.song) return false;
        if (state.config.hideWhenPaused && snapshot.state !== 'playing') return false;
        return true;
    };

    const buildView = (snapshot) => {
        const { config, meta } = state;
        const song = snapshot?.song ?? null;
        let lyric = '';
        let translation = '';
        if (song && config.showLyric) {
            const time = Number(snapshot.position) + config.lyricOffsetMs / 1000;
            const line = findLine(snapshot.lines, time);
            if (line) {
                lyric = typeof line.fullText === 'string' ? line.fullText : '';
                translation = typeof line.translation === 'string' ? line.translation : '';
            }
        }
        return {
            idle: !song,
            playing: snapshot?.state === 'playing',
            title: song?.title ?? '',
            artist: song?.artist ?? '',
            lyric,
            translation,
            cover: meta?.cover ?? null,
            liked: Boolean(meta?.liked),
            canLike: Boolean(meta?.canLike),
            position: Number(snapshot?.position) || 0,
            duration: Number(snapshot?.duration) || 0,
            accent: snapshot?.theme?.accentColor ?? null,
        };
    };

    const pushState = (view) => {
        const win = state.win;
        if (!win || win.isDestroyed()) return;
        const json = JSON.stringify(view);
        if (json === state.lastStateJson) return;
        state.lastStateJson = json;
        try {
            win.webContents.send(STATE_CHANNEL, view);
        } catch {
            /* window may be mid-reload */
        }
    };

    // A fullscreen player window (Folia's immersive mode, a game, a video)
    // covers the taskbar and owns the screen. Keeping a topmost strip over it
    // leaves a window that Windows no longer routes clicks to after the
    // fullscreen app goes away, so the controller is hidden while it lasts and
    // rebuilt fresh afterwards.
    const hostWindows = () => BrowserWindow.getAllWindows().filter((candidate) => candidate !== state.win && !candidate.isDestroyed());

    const anyHostFullscreen = () => hostWindows().some((candidate) => {
        try {
            if (candidate.isFullScreen()) return true;
            const bounds = candidate.getBounds();
            const area = screen.getDisplayMatching(bounds).bounds;
            return bounds.x === area.x && bounds.y === area.y && bounds.width === area.width && bounds.height === area.height;
        } catch {
            return false;
        }
    });

    const enterFullscreenSuppression = () => {
        if (state.suppressedByFullscreen) {
            hideControllerWindow();
            return;
        }
        state.suppressedByFullscreen = true;
        hideControllerWindow();
    };

    const leaveFullscreenSuppression = () => {
        if (!state.suppressedByFullscreen) return;
        state.suppressedByFullscreen = false;
        destroyWindow();
        state.lastStateJson = '';
        ensureWindow();
        positionWindow();
        if (state.lastSnapshot && shouldShow(state.lastSnapshot)) showControllerWindow();
    };

    const refreshController = () => {
        if (state.disposed) return;
        state.hostSettleTimer = null;
        if (anyHostFullscreen()) {
            enterFullscreenSuppression();
            return;
        }
        if (!state.config.enabled) return;
        destroyWindow();
        state.lastStateJson = '';
        ensureWindow();
        positionWindow();
        if (state.lastSnapshot && shouldShow(state.lastSnapshot)) showControllerWindow();
    };

    const handleHostGeometry = () => {
        if (state.disposed) return;
        if (anyHostFullscreen()) enterFullscreenSuppression();
        else leaveFullscreenSuppression();
    };

    // Fullscreen can be Electron's window fullscreen or the web page's own
    // fullscreen; both are watched, and any window geometry change re-checks.
    const watchedHosts = new WeakSet();
    const watchHostWindows = () => {
        for (const candidate of hostWindows()) {
            if (watchedHosts.has(candidate)) continue;
            watchedHosts.add(candidate);
            const onChange = (eventName) => {
                if (state.disposed) return;
                if (state.hostSettleTimer) clearTimeout(state.hostSettleTimer);
                state.hostSettleTimer = setTimeout(handleHostGeometry, 450);
            };
            for (const event of ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize', 'resize']) {
                candidate.on(event, onChange);
            }
            try {
                candidate.webContents.on('enter-html-full-screen', onChange);
                candidate.webContents.on('leave-html-full-screen', onChange);
            } catch {
                /* the window can be mid-destruction */
            }
        }
    };

    const tick = () => {
        if (state.disposed) return;
        const win = state.win;
        if (!win || win.isDestroyed()) return;
        let snapshot = null;
        try {
            snapshot = api.runtime.getPlaybackSnapshot();
        } catch {
            return;
        }
        if (!state.configReady && !snapshot) return;
        state.lastSnapshot = snapshot;
        watchHostWindows();
        const visibleHost = hostWindows().find((candidate) => candidate.isVisible()) ?? hostWindows()[0];
        if (visibleHost) {
            try {
                const bounds = visibleHost.getBounds();
                if (bounds.width !== state.lastHostWidth || bounds.height !== state.lastHostHeight) {
                    if (state.lastHostWidth !== 0 && state.lastHostHeight !== 0) {
                        if (state.hostSettleTimer) clearTimeout(state.hostSettleTimer);
                        state.hostSettleTimer = setTimeout(refreshController, 700);
                    }
                    state.lastHostWidth = bounds.width;
                    state.lastHostHeight = bounds.height;
                }
            } catch {
                /* window is going away */
            }
        }
        const fullscreen = anyHostFullscreen();
        if (fullscreen) {
            enterFullscreenSuppression();
            return;
        }
        // Surface the case where the controller still draws but its commands no
        // longer reach the client half, instead of silently doing nothing.
        if (state.pendingCommands.length > 0 && Date.now() - state.clientHeartbeat > 10000 && !state.warnedOfflineClient) {
            state.warnedOfflineClient = true;
            api.log.error('播放控制没有响应：界面端可能已停止，请到「设置 → 模组」重载本模组');
        }
        const view = buildView(snapshot);
        if (shouldShow(snapshot)) {
            if (!win.isVisible()) {
                if (!state.hasShown || state.selfHidden) {
                    showControllerWindow();
                    state.lastStateJson = '';
                } else {
                    refreshController();
                    return;
                }
            }
            pushState(view);
        } else if (win.isVisible()) {
            hideControllerWindow();
        }
    };

    // The taskbar itself is a topmost window, and so are fullscreen apps and the
    // Snipping Tool overlay. A window that sat above them once can end up behind
    // them after they close, so the controller re-asserts its place regularly
    // instead of only when the song changes.
    const keepOnTop = () => {
        if (state.disposed || !state.config.enabled || state.manuallyHidden) return;
        if (anyHostFullscreen()) {
            enterFullscreenSuppression();
            return;
        }
        if (state.suppressedByFullscreen) {
            // Come back as a new window: input routing after a fullscreen app is
            // not reliable for the old one.
            leaveFullscreenSuppression();
            return;
        }
        const win = state.win;
        if (!win || win.isDestroyed()) {
            // Recover a controller that Windows or a renderer crash took down.
            ensureWindow();
            positionWindow();
            return;
        }
        if (!shouldShow(state.lastSnapshot)) return;
        try {
            if (!win.isVisible()) {
                if (!state.hasShown || state.selfHidden) {
                    showControllerWindow();
                    state.lastStateJson = '';
                } else {
                    refreshController();
                    return;
                }
            }
            win.setIgnoreMouseEvents(false);
            win.setAlwaysOnTop(true, 'screen-saver');
            win.moveTop();
        } catch {
            /* the window is going away; the next tick recreates it */
        }
    };

    const focusHostWindow = () => {
        const windows = BrowserWindow.getAllWindows().filter((candidate) => candidate !== state.win && !candidate.isDestroyed());
        const host = windows.find((candidate) => candidate.isVisible()) ?? windows[0];
        if (!host) return;
        if (host.isMinimized()) host.restore();
        // Clicking a cover on a non-focusable window cannot hand it the
        // foreground the normal way; ask the app for it, then put the main
        // window back to its previous topmost state.
        try {
            app.focus({ steal: true });
        } catch {
            /* older Electron */
        }
        const wasTop = host.isAlwaysOnTop();
        host.show();
        host.moveTop();
        host.focus();
        if (!wasTop) {
            host.setAlwaysOnTop(true, 'screen-saver');
            setTimeout(() => {
                if (!host.isDestroyed()) host.setAlwaysOnTop(false);
            }, 300);
        }
    };

    const onCommand = (event, command) => {
        if (!state.win || event.sender !== state.win.webContents) return;
        if (typeof command !== 'string') return;
        switch (command) {
            case 'prev':
            case 'next':
            case 'toggle':
            case 'like': {
                // Two delivery paths: a push to the client for latency, and a
                // queue the client polls. Whichever arrives first wins; the
                // client de-duplicates by id.
                        const item = { id: ++state.commandSeq, name: command };
                state.pendingCommands.push(item);
                if (state.pendingCommands.length > 10) state.pendingCommands.shift();
                try {
                    api.rpc.send('command', item);
                } catch {
                    /* the poll path still delivers it */
                }
                break;
            }
            case 'open':
                focusHostWindow();
                break;
            default:
                break;
        }
    };

    const ensureWindow = () => {
        if (state.win && !state.win.isDestroyed()) return;
        const win = new BrowserWindow({
            width: state.config.width,
            height: WINDOW_HEIGHT,
            show: false,
            frame: false,
            transparent: true,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            closable: false,
            fullscreenable: false,
            skipTaskbar: true,
            focusable: true,
            hasShadow: false,
            alwaysOnTop: true,
            backgroundColor: '#00000000',
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                devTools: false,
                backgroundThrottling: false,
            },
        });
        state.win = win;
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setSkipTaskbar(true);
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        win.setMenuBarVisibility(false);
        win.on('closed', () => {
            if (state.win === win) state.win = null;
        });
        // A transparent always-on-top window can lose its renderer (GPU reset,
        // driver update); rebuild it instead of leaving an empty strip behind.
        win.webContents.on('render-process-gone', (_event, details) => {
            if (state.win !== win || state.disposed) return;
            api.log.error(`taskbar-player controller renderer stopped (${details?.reason ?? 'unknown'}); recreating`);
            destroyWindow();
            setTimeout(() => {
                if (!state.disposed && state.config.enabled) {
                    ensureWindow();
                    positionWindow();
                }
            }, 800);
        });
        win.on('unresponsive', () => {
            if (state.win !== win || state.disposed) return;
            api.log.warn('taskbar-player controller unresponsive; reloading');
            try {
                win.webContents.reload();
            } catch {
                /* recreate on the next keep-on-top pass */
            }
        });
        win.webContents.on('did-finish-load', () => {
            state.lastStateJson = '';
            tick();
        });
        win.loadFile(path.join(__dirname, 'controller.html')).catch((error) => api.log.error('taskbar-player window failed to load', error?.message));
        positionWindow();
    };

    const destroyWindow = () => {
        const win = state.win;
        state.win = null;
        state.lastStateJson = '';
        if (win && !win.isDestroyed()) win.destroy();
    };

    const applyConfig = () => {
        if (state.disposed) return;
        if (!state.config.enabled) {
            destroyWindow();
            return;
        }
        ensureWindow();
        positionWindow();
    };

    const saveConfig = () => {
        api.storage.set('config', state.config).catch((error) => api.log.warn('taskbar-player could not save its settings', error?.message));
    };

    const sanitizeIncoming = (values) => normalizeConfig({ ...state.config, ...(values && typeof values === 'object' ? values : {}) });

    // ---- API surface -------------------------------------------------------

    api.rpc.handle('config', (values) => {
        state.config = sanitizeIncoming(values);
        state.configReady = true;
        applyConfig();
        saveConfig();
        tick();
        return state.config;
    });

    api.rpc.handle('toggleVisible', () => {
        state.manuallyHidden = !state.manuallyHidden;
        state.lastStateJson = '';
        // Coming back from the global-shortcut hide/show is also the manual
        // escape hatch when the window's input has gone dead: rebuild it.
        if (!state.manuallyHidden) {
            destroyWindow();
            ensureWindow();
            positionWindow();
        }
        tick();
        return state.manuallyHidden;
    });

    api.rpc.handle('state', (meta) => {
        if (meta && typeof meta === 'object') {
            state.meta = {
                cover: typeof meta.cover === 'string' ? meta.cover : null,
                liked: Boolean(meta.liked),
                canLike: Boolean(meta.canLike),
            };
            state.lastStateJson = '';
        }
        tick();
        return true;
    });

    // The client half is alive and listening.
    api.rpc.handle('heartbeat', () => {
        state.clientHeartbeat = Date.now();
        state.warnedOfflineClient = false;
        return true;
    });

    // Pull path for commands: works even when a push to the renderer is lost.
    api.rpc.handle('pollCommands', () => {
        const commands = state.pendingCommands;
        state.pendingCommands = [];
        return commands;
    });

    const onPageEvent = (event, type) => {
        if (!state.win || event.sender !== state.win.webContents) return;
        if (type === 'hidden') {
            state.occluded = true;
        } else if (type === 'visible' && state.occluded) {
            state.occluded = false;
            // The page was fully covered (a screenshot overlay, a fullscreen
            // app) and is visible again: rebuild so clicks work.
            refreshController();
        } else if (type === 'stale-click') {
            // The page received a mouse-up without a mouse-down: the overlay
            // window state after a screenshot tool ate the press. Rebuild so
            // the next press is delivered normally.
            refreshController();
        }
    };
    ipcMain.on(PAGE_CHANNEL, onPageEvent);

    ipcMain.on(CMD_CHANNEL, onCommand);

    // ---- start -------------------------------------------------------------

    api.storage
        .get('config')
        .then((stored) => {
            if (state.disposed) return;
            state.config = normalizeConfig(stored ?? DEFAULT_CONFIG);
            state.configReady = true;
            applyConfig();
        })
        .catch((error) => {
            api.log.warn('taskbar-player could not read its settings', error?.message);
            state.configReady = true;
            applyConfig();
        });

    screen.on('display-metrics-changed', positionWindow);
    screen.on('display-added', positionWindow);
    screen.on('display-removed', positionWindow);

    const timer = setInterval(tick, 250);
    const topTimer = setInterval(keepOnTop, 1200);

    const dispose = () => {
        if (state.disposed) return;
        state.disposed = true;
        clearInterval(timer);
        clearInterval(topTimer);
        if (state.hostSettleTimer) clearTimeout(state.hostSettleTimer);
        ipcMain.removeListener(CMD_CHANNEL, onCommand);
        ipcMain.removeListener(PAGE_CHANNEL, onPageEvent);
        screen.removeListener('display-metrics-changed', positionWindow);
        screen.removeListener('display-added', positionWindow);
        screen.removeListener('display-removed', positionWindow);
        destroyWindow();
        api.log.info('taskbar-player stopped');
    };

    api.onDispose(dispose);
    api.log.info(`taskbar-player ${api.manifest.version} loaded`);
};
