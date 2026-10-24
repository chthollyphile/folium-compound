// src/main.cjs
// Folia「桌面歌词」模组的 main 入口（Node）。负责那扇透明置顶小窗本身：开关、几何、锁定
// （鼠标穿透）、总在最前、字号 ↔ 窗口高度互推，以及在 client 与窗口之间转发状态和命令。
// 这是契约之外的自由度：main 入口以 Node 运行，可以 require('electron')。

'use strict';

const path = require('path');
const { BrowserWindow, ipcMain, screen } = require('electron');

const { listFontFamilies } = require('./fonts.cjs');

const CH_STATE = 'folia-amll-desktop-lyric:state';
const CH_SETTINGS = 'folia-amll-desktop-lyric:settings';
const CH_FROM_WINDOW = 'folia-amll-desktop-lyric:from-window';

// 字号与窗口高度的线性映射，沿用 SPlayer 桌面歌词那套（字号 16–96 ↔ 高 140–360）。
const FONT = { min: 16, max: 96, minHeight: 140, maxHeight: 360 };

const MODES = {
    // 单行 / 双行：高度由字号算出来，宽度可拖。
    single: { width: 800, minWidth: 420, resizable: true },
    double: { width: 800, minWidth: 420, resizable: true },
    // 多行歌词板：默认大一点，高度也不跟字号走。
    board: { width: 720, minWidth: 420, resizable: true },
};

const DEFAULT_SETTINGS = {
    mode: 'single',
    fontSize: 30,
    backgroundMode: 'color',
    backgroundColor: '#0b0b10',
    backgroundOpacity: 0.45,
    cornerRadius: 12,
    border: true,
    showTranslation: true,
    showRomanization: false,
    align: 'center',
    verticalPosition: 0.5,
    wordFadeWidth: 1,
    fontWeight: 400,
    translationScale: 0.5,
    enableSpring: true,
    blurUpcoming: true,
    hidePassedLines: false,
    skipTaskbar: true,
    pausedOpacity: 1,
    playedColor: '#ffffff',
    unplayedOpacity: 0.5,
    shadowColor: '#000000',
    textBackgroundMask: false,
    backgroundMaskColor: '#000000',
    alwaysShowPlayInfo: false,
    followTheme: false,
    fontFamily: '',
    fontLatin: '',
    fontCjk: '',
    fontFallback: 'sans-serif',
    opacity: 0.95,
    alwaysOnTop: true,
    lock: false,
    ignoreHover: false,
    lockPosition: false,
    headerMode: 'hover',
    springMass: 1,
    springStiffness: 100,
    springDamping: 10,
    wheelFontSize: false,
    translationOpacity: 0.3,
    hideWithoutLyrics: false,
    letterSpacing: 0,
};

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

const fontSizeToHeight = (size) => {
    const value = Number(size);
    // 设置文件坏了、或者别的模组塞了脏值时兜底：NaN 传给 BrowserWindow 会退回 800x600。
    const safe = Number.isFinite(value) ? value : DEFAULT_SETTINGS.fontSize;
    const ratio = (clamp(Math.round(safe), FONT.min, FONT.max) - FONT.min) / (FONT.max - FONT.min);
    return Math.round(FONT.minHeight + ratio * (FONT.maxHeight - FONT.minHeight));
};

const heightToFontSize = (height) => {
    const ratio = (clamp(Math.round(height), FONT.minHeight, FONT.maxHeight) - FONT.minHeight) / (FONT.maxHeight - FONT.minHeight);
    return Math.round(FONT.min + ratio * (FONT.max - FONT.min));
};

const isAlive = (win) => Boolean(win) && !win.isDestroyed();

module.exports = function activate(api) {
    let win = null;
    let disposed = false;
    let settings = { ...DEFAULT_SETTINGS };
    let geometry = null; // { x, y, width, height }
    let lastState = null;
    // 穿透模型：锁定时整窗始终 ignore(true, {forward:true})，只有指针压在锁定按钮上
    // 那一小块时才解冻 —— 指针一进来就整窗解冻的话，点击永远落在窗口上，穿透等于没有。
    let hitLockButton = false;
    let saveTimer = null;
    // 我们自己调 setSize 时会触发一次 'resized'，那一次不能反过来改字号。
    let programmaticUntil = 0;
    // 拖动的起点，renderer 只发累计位移过来。
    let dragOrigin = null;
    // 宿主是 Folium 1.6 时没有 api.rpc.send（1.7 才有），窗口的命令改成排队等 client 来取。
    let pendingCommands = [];
    const foliumMinor = () => (api.host && api.host.folium ? Number(api.host.folium.minor) || 0 : 0);

    const pushToClient = (name, payload) => {
        if (foliumMinor() >= 7) {
            api.rpc.send(name, payload);
            return;
        }
        pendingCommands.push({ name, payload });
        // client 每 150ms 来取一次；没人取时别让队列无限长。
        if (pendingCommands.length > 32) pendingCommands.shift();
    };

    const send = (channel, payload) => {
        if (isAlive(win) && !win.webContents.isDestroyed()) {
            win.webContents.send(channel, payload);
        }
    };

    const persist = (key, value) => {
        api.storage.set(key, value).catch((error) => {
            api.log.warn(`[desktop-lyric] 保存 ${key} 失败`, error);
        });
    };

    // ---------------------------------------------------------------- 尺寸

    const desiredHeight = () => {
        const base = fontSizeToHeight(settings.fontSize);
        if (!Number.isFinite(base)) return 180;
        if (settings.mode === 'double') return Math.round(base * 1.72);
        if (settings.mode === 'board') return Math.max(320, Math.round(base * 2.6));
        return base;
    };

    const modeSpec = () => MODES[settings.mode] || MODES.single;

    const savedBounds = () => {
        const spec = modeSpec();
        const found = geometry || {};
        const width = Math.max(spec.minWidth, Math.round(Number(found.width) || spec.width || 800));
        const bounds = { width, height: desiredHeight() };
        // 上次的位置如果已经不在任何显示器里（拔了副屏、改了分辨率），就不带位置，让 Electron 居中。
        if (Number.isFinite(found.x) && Number.isFinite(found.y)) {
            const target = { x: Math.round(found.x), y: Math.round(found.y), width: bounds.width, height: bounds.height };
            const area = screen.getDisplayMatching(target).workArea;
            const visible =
                target.x + target.width > area.x + 40 &&
                target.x < area.x + area.width - 40 &&
                target.y + target.height > area.y + 20 &&
                target.y < area.y + area.height - 20;
            if (visible) {
                bounds.x = target.x;
                bounds.y = target.y;
            }
        }
        return bounds;
    };

    const resizeTo = (width, height) => {
        if (!isAlive(win)) return;
        const bounds = win.getBounds();
        const nextWidth = Math.max(modeSpec().minWidth, Math.round(width ?? bounds.width));
        const wanted = Number.isFinite(height) ? height : bounds.height;
        const nextHeight = Math.max(FONT.minHeight, Math.round(wanted));
        if (nextWidth === bounds.width && nextHeight === bounds.height) return;
        programmaticUntil = Date.now() + 400;
        win.setSize(nextWidth, nextHeight, false);
    };

    const scheduleSaveBounds = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            saveBounds();
        }, 400);
    };

    const saveBounds = () => {
        if (!isAlive(win)) return;
        const bounds = win.getBounds();
        geometry = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        persist('window', geometry);
    };

    // 用户拖边、拖角结束（或者过程中）：存位置，单行/双行形态下把高度换算回字号。
    const onResized = () => {
        if (!isAlive(win)) return;
        if (Date.now() < programmaticUntil) {
            scheduleSaveBounds();
            return;
        }
        if (settings.mode === 'single' || settings.mode === 'double') {
            const derived = heightToFontSize(win.getBounds().height);
            if (Math.abs(derived - settings.fontSize) > 1) {
                settings = { ...settings, fontSize: derived };
                // 交给 client 写进设置（设置归宿主管），再由它推回来。
                if (api.host.folium.minor >= 7) api.rpc.send('cmd', { name: 'font-size', value: derived });
            }
        }
        scheduleSaveBounds();
    };

    // ---------------------------------------------------------------- 窗口开关

    const applyAlwaysOnTop = () => {
        if (!isAlive(win)) return;
        win.setSkipTaskbar(settings.skipTaskbar !== false);
        win.setAlwaysOnTop(Boolean(settings.alwaysOnTop), 'screen-saver');
        win.setVisibleOnAllWorkspaces(Boolean(settings.alwaysOnTop), { visibleOnFullScreen: true });
    };

    // 锁定 = 鼠标穿透。锁定时整窗始终 ignore(true, { forward: true })：点击落到下面的窗口，
    // forward 只把指针移动送进页面，好浮出控制条、认出「现在压在锁定按钮上」。
    // 只有指针压在锁定按钮那一小块时才临时解冻，否则一 hover 就整窗能点，穿透等于没有。
    const applyLock = () => {
        if (!isAlive(win)) return;
        // 完全忽略鼠标：连 forward 都不给，指针移动根本进不了页面。
        if (settings.ignoreHover) {
            hitLockButton = false;
            win.setIgnoreMouseEvents(true);
            return;
        }
        if (!settings.lock) {
            hitLockButton = false;
            win.setIgnoreMouseEvents(false);
            return;
        }
        if (hitLockButton) {
            win.setIgnoreMouseEvents(false);
        } else {
            // forward：指针移动仍然送进页面，好浮出控制条、认出「现在压在锁定按钮上」。
            win.setIgnoreMouseEvents(true, { forward: true });
        }
    };

    const applyMode = (previousMode) => {
        if (!isAlive(win)) return;
        const spec = modeSpec();
        win.setResizable(spec.resizable);
        win.setMinimumSize(spec.minWidth, FONT.minHeight);
        if (previousMode !== undefined && previousMode !== settings.mode) {
            // 换形态时宽度回到该形态的默认值，高度按字号重算。
            resizeTo(settings.mode === 'board' ? 720 : Math.max(win.getBounds().width, 620), desiredHeight());
        }
    };

    const applySettings = (next) => {
        const previousMode = settings.mode;
        const previousFont = settings.fontSize;
        settings = { ...settings, ...next };
        applyAlwaysOnTop();
        applyLock();
        applyMode(previousMode);
        // 字号变了：高度跟着走（板式形态不跟）。
        if (settings.mode !== 'board' && (settings.fontSize !== previousFont || settings.mode !== previousMode)) {
            resizeTo(undefined, desiredHeight());
        }
        send(CH_SETTINGS, settings);
    };

    const closeWindow = () => {
        if (isAlive(win)) win.close();
    };

    const openWindow = () => {
        if (isAlive(win)) {
            win.showInactive();
            return win;
        }
        const bounds = savedBounds();
        const spec = modeSpec();
        win = new BrowserWindow({
            ...bounds,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            hasShadow: false,
            resizable: spec.resizable,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: settings.skipTaskbar !== false,
            alwaysOnTop: Boolean(settings.alwaysOnTop),
            show: false,
            title: 'Folia 桌面歌词',
            // 这个窗口是模组自己的页面，不走宿主的 preload。
            webPreferences: {
                preload: path.join(__dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                backgroundThrottling: false,
                zoomFactor: 1,
                partition: 'persist:folia-desktop-lyric',
            },
        });

        const created = win;
        created.on('ready-to-show', () => {
            // showInactive：不抢主窗口的焦点。
            if (isAlive(created)) created.showInactive();
        });
        created.on('resized', onResized);
        created.on('moved', scheduleSaveBounds);
        created.on('move', scheduleSaveBounds);
        created.on('closed', () => {
            if (win === created) win = null;
            hitLockButton = false;
            if (disposed) return;
            persist('window', geometry);
            persist('open', false);
        });

        created.webContents.on('did-finish-load', () => {
            if (!isAlive(created)) return;
            created.webContents.send(CH_SETTINGS, settings);
            if (lastState) created.webContents.send(CH_STATE, lastState);
            applyAlwaysOnTop();
            applyLock();
        });

        created.loadFile(path.join(__dirname, 'window', 'index.html')).catch((error) => {
            api.log.error('[desktop-lyric] 歌词窗口加载失败', error);
        });

        persist('open', true);
        return created;
    };

    const toggleWindow = () => {
        if (isAlive(win)) {
            closeWindow();
            return { open: false };
        }
        openWindow();
        return { open: true };
    };

    // ---------------------------------------------------------------- 窗口发来的消息

    const onWindowMessage = (event, message) => {
        // 只认自己这扇窗，别的页面（主窗口、导出窗口）发同样通道名的一律不理。
        if (!isAlive(win) || event.sender !== win.webContents) return;
        const type = message && typeof message.type === 'string' ? message.type : '';
        switch (type) {
            case 'ready':
                event.sender.send(CH_SETTINGS, settings);
                if (lastState) event.sender.send(CH_STATE, lastState);
                break;
            case 'hover':
                if (message.over !== true) {
                    hitLockButton = false;
                    applyLock();
                }
                break;
            case 'hit':
                hitLockButton = message.onLock === true;
                applyLock();
                break;
            case 'font-size':
                pushToClient('cmd', { name: 'font-size', value: Math.round(Number(message.value) || 0) });
                break;
            case 'lock':
                applySettings({ lock: message.locked === true });
                break;
            case 'close':
                closeWindow();
                break;
            case 'drag-start':
                dragOrigin = isAlive(win) ? win.getPosition() : null;
                break;
            case 'drag-move': {
                if (!dragOrigin || !isAlive(win) || settings.lockPosition) break;
                const bounds = win.getBounds();
                const target = {
                    x: dragOrigin[0] + Math.round(Number(message.dx) || 0),
                    y: dragOrigin[1] + Math.round(Number(message.dy) || 0),
                    width: bounds.width,
                    height: bounds.height,
                };
                const area = screen.getDisplayMatching(target).workArea;
                // 别把标题栏拖到工作区外面，拖丢了就再也抓不回来。
                const x = Math.min(Math.max(target.x, area.x - 40), area.x + area.width - 80);
                const y = Math.min(Math.max(target.y, area.y), area.y + area.height - 40);
                win.setPosition(Math.round(x), Math.round(y), false);
                break;
            }
            case 'drag-end':
                dragOrigin = null;
                saveBounds();
                break;
            case 'cmd':
                // 播放控制要回到 Folia 的渲染进程里执行：main 入口没有 playback 控制。
                pushToClient('cmd', { name: message.name });
                break;
            case 'sync':
                pushToClient('cmd', { name: 'sync' });
                break;
            default:
                break;
        }
    };

    ipcMain.on(CH_FROM_WINDOW, onWindowMessage);

    // ---------------------------------------------------------------- client 的 rpc

    api.rpc.handle('state', (payload) => {
        lastState = payload && typeof payload === 'object' ? payload : null;
        send(CH_STATE, lastState);
        return { ok: true };
    });

    api.rpc.handle('settings', (payload) => {
        applySettings(payload && typeof payload === 'object' ? payload : {});
        return { ok: true };
    });

    api.rpc.handle('toggle', () => toggleWindow());

    // Folium 1.6 没有 main → client 推送：client 定时来取，取走就清空。
    api.rpc.handle('take-commands', () => {
        const queued = pendingCommands;
        pendingCommands = [];
        return queued;
    });

    // 设置面板的字体选择器要的本机字体族。第一次扫目录，之后读缓存。
    api.rpc.handle('fonts', async () => {
        try {
            return await listFontFamilies(api.storage.paths, api.log);
        } catch (error) {
            api.log.warn('[desktop-lyric] 读取本机字体失败', error);
            return [];
        }
    });

    // client 停掉（模组重载、停用）时它自己关窗，避免留下一个点不动的空壳。
    api.rpc.handle('window-closed', () => {
        closeWindow();
        return { ok: true };
    });

    api.onDispose(() => {
        disposed = true;
        ipcMain.removeListener(CH_FROM_WINDOW, onWindowMessage);
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (isAlive(win)) {
            win.removeAllListeners('closed');
            win.destroy();
        }
        win = null;
    });

    // ---------------------------------------------------------------- 启动时恢复

    (async () => {
        try {
            const stored = await api.storage.get('window');
            if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
                geometry = stored;
            }
            const open = await api.storage.get('open');
            if (open === true && !disposed) openWindow();
        } catch (error) {
            api.log.warn('[desktop-lyric] 读取窗口状态失败', error);
        }
    })();
};
