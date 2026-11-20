'use strict';

// 任务栏控制条 —— main 入口（主进程）
//
// 职责：在屏幕底部任务栏左下方创建一条「无边框 + 全透明 + 置顶」的窗口，
// 把渲染层（bar.html）发来的点击指令转给 client 入口，再把 client 推来的
// 播放状态回灌给 bar.html。
//
// 安全模型：
// - 控制条窗口不开放 Node：contextIsolation: true、nodeIntegration: false，
//   页面只能通过 preload.js 暴露的 window.tb 发白名单指令、收状态。
// - 所有 IPC 频道带 taskbar-controls: 前缀，处理函数校验 event.sender 就是
//   本模组自己的窗口，dispose 时移除监听，避免模组重载后叠加多份监听。
// - 只使用 Electron 公开 API，不读取宿主的内部模块或打包结构。
//
// 关于焦点：这个窗口必须是「可获得焦点」的（focusable: true）。
// Windows 上如果创建成 WS_EX_NOACTIVATE（Electron 的 focusable: false），
// Chromium 只把鼠标移动转发给渲染进程，按下/抬起事件会被丢掉——表现就是
// 悬停有反应、点击没反应。所以这里不能用 focusable: false。

const path = require('path');
const { app, BrowserWindow, screen, ipcMain } = require('electron');

const BAR_FILE = path.join(__dirname, 'bar.html');
const PRELOAD_FILE = path.join(__dirname, 'preload.js');

// 频道统一加模组前缀：宿主和其他模组的频道不会串到这里，我们自己也不会误发出去
const CH = {
    cmd: 'taskbar-controls:cmd',
    resize: 'taskbar-controls:resize',
    state: 'taskbar-controls:state',
    error: 'taskbar-controls:error',
    config: 'taskbar-controls:config',
};

// client ↔ main 走宿主的 rpc，不是原生 IPC：宿主用 /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/
// 校验名字，冒号会被直接拒掉。这一组只用小写字母和连字符，最保守。
const RPC = {
    cmd: 'tb-cmd',
    state: 'tb-state',
    error: 'tb-error',
    config: 'tb-config',
    visibility: 'tb-visibility',
    heartbeat: 'tb-heartbeat',
};

const DEFAULTS = {
    width: 320,
    offsetX: 10,
    bottomGap: 2,
    opacity: 1,
};

const COLLAPSED_HEIGHT = 40;
const TICK_MS = 900;

module.exports = function activate(api) {
    let win = null;
    let disposed = false;
    const config = { ...DEFAULTS };

    let currentHeight = COLLAPSED_HEIGHT;
    let currentWidth = DEFAULTS.width;
    // 有全屏程序在前台时，控制条要主动藏起来
    let hiddenForFullscreen = false;
    // 用户从命令面板手动隐藏时，轮询不要把它又弹回来
    let manuallyHidden = false;
    // 页面加载完成前推上来的状态要先存着，否则那一次会随「页面还没挂好监听」一起丢掉，
    // 而 client 侧有去重（歌没变不重推），页面就永远等不到第二次。
    let lastSnapshot = null;
    // client 只活在主窗口的渲染进程里：主窗口一关，它就没了，点击也就没人执行。
    // 心跳用来判断这一端还在不在，否则会留下一条「点了没反应」的死条。
    let lastHeartbeat = Date.now();
    const HEARTBEAT_TIMEOUT_MS = 8000;
    let hiddenBecauseClientGone = false;

    api.log.info('任务栏控制条启动');

    const readScreen = () => {
        const display = screen.getPrimaryDisplay();
        const bounds = display.bounds;
        const work = display.workArea;
        let edge = 'bottom';
        if (work.y > bounds.y) edge = 'top';
        else if (work.x > bounds.x) edge = 'left';
        else if (work.x + work.width < bounds.x + bounds.width) edge = 'right';
        else if (work.height < bounds.height) edge = 'bottom';
        return { bounds, work, edge };
    };

    // 底部对齐：展开时窗口向上长，底边不动
    const boundsFor = (height, width) => {
        const { bounds, work, edge } = readScreen();
        const gap = Math.max(0, Math.round(config.bottomGap));
        const w = Math.max(120, Math.round(width ?? config.width));
        const h = Math.max(32, Math.round(height));
        let x;
        let y;
        if (edge === 'top') {
            x = work.x + Math.round(config.offsetX);
            y = bounds.y + gap;
        } else if (edge === 'left') {
            x = work.x;
            y = bounds.y + bounds.height - h - gap;
        } else if (edge === 'right') {
            x = work.x + work.width - w;
            y = bounds.y + bounds.height - h - gap;
        } else {
            x = Math.round(work.x + config.offsetX);
            y = bounds.y + bounds.height - h - gap;
        }
        return { x, y, width: w, height: h };
    };

    const resetTopmost = () => {
        if (!win || win.isDestroyed()) return;
        if (hiddenForFullscreen || manuallyHidden || hiddenBecauseClientGone) return;
        win.setAlwaysOnTop(true, 'screen-saver', 1);
        if (typeof win.moveTop === 'function') win.moveTop();
        win.setIgnoreMouseEvents(false);
    };

    const place = (height, width) => {
        if (!win || win.isDestroyed()) return;
        win.setBounds(boundsFor(height, width));
        resetTopmost();
    };

    const createWindow = () => {
        const initial = boundsFor(currentHeight, currentWidth);
        win = new BrowserWindow({
            ...initial,
            show: false,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            // 必须保持 resizable：Windows 上不可调尺寸的窗口，程序化 setBounds 改不动高度
            resizable: true,
            movable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            hasShadow: false,
            // 关键：必须 focusable，否则 Windows 下收不到鼠标按下（只剩悬停）
            focusable: true,
            acceptFirstMouse: true,
            webPreferences: {
                // 页面拿不到 Node，能力全部收敛到 preload 里的白名单
                preload: PRELOAD_FILE,
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: false,
                backgroundThrottling: false,
            },
        });
        win.setAlwaysOnTop(true, 'screen-saver', 1);
        win.setSkipTaskbar(true);
        win.setMenuBarVisibility(false);
        win.setOpacity(Math.min(1, Math.max(0.2, Number(config.opacity) || 1)));

        win.webContents.on('preload-error', (_event, preloadPath, error) => {
            api.log.error('preload 加载失败，控制条按钮会无响应', preloadPath, error);
        });

        win.loadFile(BAR_FILE);
        win.webContents.once('did-finish-load', () => {
            if (!win || win.isDestroyed()) return;
            win.showInactive();
            place(currentHeight, currentWidth);
            // 页面监听这时才挂好：补发加载期间攒下的状态
            if (lastSnapshot) win.webContents.send(CH.state, lastSnapshot);
        });
        win.on('closed', () => {
            win = null;
        });
    };

    createWindow();

    // ---- 全屏让位：只看宿主自己的窗口（Electron 公开能力）
    const isHostWindowFullscreen = () => {
        try {
            const windows = BrowserWindow.getAllWindows();
            for (const other of windows) {
                if (!other || other === win || other.isDestroyed()) continue;
                if (other.isFullScreen()) return true;
            }
        } catch (error) {
            /* 拿不到窗口列表时按「不是全屏」处理 */
        }
        return false;
    };

    const tick = () => {
        if (disposed || !win || win.isDestroyed()) return;

        // 先看 client 还在不在：主窗口关闭后它就没了，这时把条藏起来，
        // 等主窗口回来（心跳恢复）再自己出现。
        const clientAlive = Date.now() - lastHeartbeat < HEARTBEAT_TIMEOUT_MS;
        if (!clientAlive && !hiddenBecauseClientGone && !manuallyHidden) {
            hiddenBecauseClientGone = true;
            try {
                win.hide();
            } catch (error) {
                hiddenBecauseClientGone = false;
            }
        } else if (clientAlive && hiddenBecauseClientGone) {
            hiddenBecauseClientGone = false;
            if (!hiddenForFullscreen && !manuallyHidden) {
                try {
                    win.showInactive();
                    place(currentHeight, currentWidth);
                } catch (error) {
                    /* 窗口可能正在销毁 */
                }
            }
        }

        const fullscreen = isHostWindowFullscreen();
        if (fullscreen && !hiddenForFullscreen) {
            hiddenForFullscreen = true;
            try {
                win.hide();
            } catch (error) {
                hiddenForFullscreen = false;
            }
        } else if (!fullscreen && hiddenForFullscreen) {
            hiddenForFullscreen = false;
            if (!manuallyHidden) {
                try {
                    win.showInactive();
                    place(currentHeight, currentWidth);
                } catch (error) {
                    /* 窗口可能正在销毁 */
                }
            }
        }
        resetTopmost();
    };

    const tickTimer = setInterval(tick, TICK_MS);

    // ---- 来源校验：只接受本模组窗口发来的消息
    const fromBar = (event) => Boolean(win) && !win.isDestroyed() && event.sender === win.webContents;

    // ---- 渲染层 → 主进程
    const onResize = (event, size) => {
        if (!fromBar(event) || !size) return;
        currentHeight = Number(size.height) || COLLAPSED_HEIGHT;
        currentWidth = Number(size.width) || config.width;
        place(currentHeight, currentWidth);
    };

    const onCmd = (event, payload) => {
        if (!fromBar(event)) return;
        // 页面主动拉状态：立刻回发缓存的最新快照（页面重载或消息丢失时靠它自愈）
        if (payload?.action === 'sync') {
            if (win && !win.isDestroyed() && lastSnapshot) win.webContents.send(CH.state, lastSnapshot);
            return;
        }
        if (disposed) return;
        try {
            api.rpc.send(RPC.cmd, payload);
        } catch (error) {
            api.log.warn('转发指令失败', error);
            if (win && !win.isDestroyed()) {
                win.webContents.send(CH.error, {
                    action: payload?.action,
                    message: String(error?.message ?? error),
                });
            }
        }
    };

    ipcMain.on(CH.resize, onResize);
    ipcMain.on(CH.cmd, onCmd);

    // ---- client 入口 → 主进程
    // 心跳：client 每 2 秒来一次，主进程据此判断那一端还在不在
    api.rpc.handle(RPC.heartbeat, () => {
        lastHeartbeat = Date.now();
        return true;
    });

    api.rpc.handle(RPC.state, (snapshot) => {
        lastSnapshot = snapshot ?? null;
        if (win && !win.isDestroyed()) win.webContents.send(CH.state, snapshot ?? null);
        return true;
    });

    api.rpc.handle(RPC.error, (payload) => {
        if (win && !win.isDestroyed()) win.webContents.send(CH.error, payload ?? null);
        return true;
    });

    api.rpc.handle(RPC.config, (patch) => {
        if (patch && typeof patch === 'object') {
            ['width', 'offsetX', 'bottomGap', 'opacity'].forEach((key) => {
                const value = Number(patch[key]);
                if (Number.isFinite(value)) config[key] = value;
            });
            if (win && !win.isDestroyed()) {
                win.setOpacity(Math.min(1, Math.max(0.2, config.opacity)));
                currentWidth = config.width;
                place(currentHeight, currentWidth);
            }
        }
        return true;
    });

    // 命令：隐藏 / 显示控制条（宿主没有外部程序全屏的公开信号，手动切）
    api.rpc.handle(RPC.visibility, () => {
        if (!win || win.isDestroyed()) return false;
        let next;
        try {
            next = !win.isVisible();
        } catch (error) {
            return false;
        }
        manuallyHidden = !next;
        try {
            if (next) {
                hiddenForFullscreen = false;
                hiddenBecauseClientGone = false;
                lastHeartbeat = Date.now();
                win.showInactive();
                place(currentHeight, currentWidth);
                resetTopmost();
            } else {
                win.hide();
            }
        } catch (error) {
            api.log.warn('切换控制条可见性失败', error);
            return false;
        }
        api.log.info(next ? '控制条已显示' : '控制条已隐藏');
        return next;
    });

    const onDisplayChange = () => {
        if (!win || win.isDestroyed()) return;
        place(currentHeight, currentWidth);
    };
    screen.on('display-metrics-changed', onDisplayChange);
    screen.on('display-added', onDisplayChange);
    screen.on('display-removed', onDisplayChange);

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        clearInterval(tickTimer);
        try {
            ipcMain.removeListener(CH.resize, onResize);
            ipcMain.removeListener(CH.cmd, onCmd);
        } catch (error) {
            /* 忽略：退出阶段可能已经清理过 */
        }
        screen.removeListener('display-metrics-changed', onDisplayChange);
        screen.removeListener('display-added', onDisplayChange);
        screen.removeListener('display-removed', onDisplayChange);
        if (win && !win.isDestroyed()) win.destroy();
        win = null;
    };

    api.onDispose(dispose);
    return dispose;
};
