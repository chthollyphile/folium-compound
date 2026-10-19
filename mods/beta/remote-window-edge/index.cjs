// index.cjs —— 主进程入口：让远程控制小窗的拖动边界按"看得见的卡片"算。
// 宿主（electron/main.cjs 的 keepRemoteControlCoverOnScreen + remoteControlWindowGeometry.cjs
// 的 clampRemoteControlWindowX）把窗口左边缘钉在屏幕左边缘上。可窗口左边缘到可见卡片
// 左边缘还隔着 178 px（4 px 弹窗边距 + 174 px 空闲封面区），那块在放歌时完全透明，
// 于是卡片被顶在离屏幕左边缘 178 px 处，再往左拖不动。这个模组接管 will-move，把锚点换成卡片。
'use strict';

const { app, BrowserWindow, screen } = require('electron');

// 与 electron/remoteControlWindowGeometry.cjs、src/components/remote/remote.css 同一套数字。
const REMOTE_WINDOW_TITLE = 'Folia Remote';
const WINDOW_WIDTH = 602;
const WINDOW_HEIGHT = 184;
const CARD_WIDTH = 594;
const SLEEVE_WIDTH = 174;
/** 卡片左边缘到窗口左边缘：边距 4 px 加上空闲时放大封面占的 174 px。 */
const CARD_LEFT = Math.floor((WINDOW_WIDTH - CARD_WIDTH) / 2) + SLEEVE_WIDTH;
/** 默认让它正好吃掉那块空判定区：卡片能贴到、并再往左越过屏幕左边缘。 */
const DEFAULT_OVERHANG = CARD_LEFT;
// 178 + 278 = 456 px 在屏外，窗口还留 146 px 抓得住。
const MAX_OVERHANG = 278;

const clampOverhang = (value) => {
    const overhang = Number(value);
    if (!Number.isFinite(overhang)) return DEFAULT_OVERHANG;
    return Math.min(MAX_OVERHANG, Math.max(0, Math.round(overhang)));
};

const containsPoint = (area, point) => (
    point.x >= area.x && point.x < area.x + area.width
    && point.y >= area.y && point.y < area.y + area.height
);

const overlapArea = (a, b) => (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
);

/*
 * 允许的 x。锚点是"卡片左边缘再往左 overhang 像素"：只要它落在某块屏上就放行，卡片左边那
 * 178 px 的空窗口可以跟着出屏。越界时夹到承载这块窗口最多的那块屏，下限是
 * 屏左边缘 - CARD_LEFT - overhang。
 * overhang 传 -CARD_LEFT 时锚点退回窗口左边缘，就是播放器原本的规则。
 */
const allowedX = (bounds, areas, overhang) => {
    const anchor = { x: bounds.x + CARD_LEFT + overhang, y: bounds.y + Math.floor(bounds.height / 2) };
    if (areas.some((area) => containsPoint(area, anchor))) {
        return bounds.x;
    }

    let home = null;
    let homeOverlap = 0;
    for (const area of areas) {
        const overlap = overlapArea(area, bounds);
        if (overlap > homeOverlap) {
            home = area;
            homeOverlap = overlap;
        }
    }
    return home ? Math.max(bounds.x, home.x - CARD_LEFT - overhang) : bounds.x;
};

const isRemoteWindow = (win) => {
    try {
        if (!win || win.isDestroyed()) return false;
        if (win.getTitle() === REMOTE_WINDOW_TITLE) return true;
        const [width, height] = win.getSize();
        return width === WINDOW_WIDTH && height === WINDOW_HEIGHT;
    } catch {
        return false;
    }
};

const screenBounds = () => screen.getAllDisplays().map((display) => display.bounds);

module.exports = function activate(api) {
    if (process.platform !== 'win32') {
        // 宿主只在 Windows 上注册那条 will-move，别处本来就能拖出屏幕。
        api.log.info('[remote-window-edge] nothing to do: the host limits the drag on Windows only');
        return () => {};
    }

    const state = { overhang: DEFAULT_OVERHANG };
    const hooked = new WeakSet();
    let disposed = false;

    const applyDragLimit = (win, event, newBounds) => {
        if (!app.isReady()) return;
        const x = allowedX(newBounds, screenBounds(), state.overhang);
        if (x === newBounds.x) return;
        // Windows 上这样窗口会停在原处，拖动沿边缘滑，和宿主同样的手法。
        event.preventDefault();
        win.setPosition(x, newBounds.y);
    };

    /*
     * 宿主是在 BrowserWindow 构造返回之后才注册它的 will-move，而 browser-window-created 在
     * 构造函数里就发出来了：此刻移除等于没做。等到事件已经有人监听再接。
     */
    const attach = (win, attempt = 0) => {
        try {
            if (disposed || !win || win.isDestroyed() || hooked.has(win)) return;
            if (win.listenerCount('will-move') === 0) {
                if (attempt < 8) {
                    setTimeout(() => attach(win, attempt + 1), 16);
                }
                return;
            }
            hooked.add(win);
            win.removeAllListeners('will-move');
            win.on('will-move', (event, newBounds) => {
                try {
                    applyDragLimit(win, event, newBounds);
                } catch (error) {
                    api.log.warn('[remote-window-edge] will-move handler failed', error);
                }
            });
            api.log.info('[remote-window-edge] took over the drag limit', { overhang: state.overhang });
        } catch (error) {
            api.log.warn('[remote-window-edge] could not hook the remote window', error);
        }
    };

    const onWindowCreated = (event, win) => {
        if (disposed || !isRemoteWindow(win)) return;
        setImmediate(() => attach(win));
    };

    const attachExisting = () => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (isRemoteWindow(win)) attach(win);
        }
    };

    // 停用后把宿主那条规则放回去：锚点退回窗口左边缘（即 allowedX 的 -CARD_LEFT）。
    const restoreHostRule = (win) => {
        win.removeAllListeners('will-move');
        win.on('will-move', (event, newBounds) => {
            try {
                if (!app.isReady()) return;
                const x = allowedX(newBounds, screenBounds(), -CARD_LEFT);
                if (x === newBounds.x) return;
                event.preventDefault();
                win.setPosition(x, newBounds.y);
            } catch {
                // 窗口正在关闭时不值得再报。
            }
        });
    };

    const applyOverhang = (value) => {
        state.overhang = clampOverhang(value);
        return state.overhang;
    };

    api.rpc.handle('overhang', (value) => applyOverhang(value));
    api.rpc.handle('status', () => ({
        overhang: state.overhang,
        maxOverhang: MAX_OVERHANG,
        remoteWindows: BrowserWindow.getAllWindows().filter(isRemoteWindow).length,
    }));

    app.on('browser-window-created', onWindowCreated);
    if (app.isReady()) {
        attachExisting();
    } else {
        app.once('ready', attachExisting);
    }

    api.storage.get('overhang')
        .then((stored) => {
            if (stored !== undefined && stored !== null) applyOverhang(stored);
        })
        .catch((error) => {
            api.log.warn('[remote-window-edge] could not read the saved overhang', error);
        });

    return () => {
        disposed = true;
        app.removeListener('browser-window-created', onWindowCreated);
        app.removeListener('ready', attachExisting);
        for (const win of BrowserWindow.getAllWindows()) {
            if (win.isDestroyed() || !isRemoteWindow(win)) continue;
            restoreHostRule(win);
        }
    };
};
