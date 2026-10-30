// mods/taskbar-lyrics/index.cjs
// Main process entry for Taskbar Lyrics Drawer mod.
// Calculates Windows taskbar geometry, manages the drawer overlay window,
// and bridges playback actions securely.
// Note: Supported exclusively on Windows (win32).

'use strict';

const path = require('path');
const { BrowserWindow, screen, ipcMain } = require('electron');

const COLLAPSED_WIDTH = 56; // Width of the permanent left replacement button
const MAX_PENDING_ACTIONS = 50;
const DEFAULT_EMBED_WIDTH = 480;
const MIN_EMBED_WIDTH = 240;
const TASKBAR_EDGE_GAP = 4;
const TASKBAR_VERTICAL_GAP = 3;
const HOVER_PROGRESS_HEIGHT = 34;
const HOVER_PROGRESS_GAP = 4;

let compactConfig = {
  width: DEFAULT_EMBED_WIDTH,
  autoAvoid: true,
};
let taskbarNative = null;

/**
 * Load the Koffi FFI already bundled with Folia. This helper is read-only and
 * only queries taskbar geometry; it never changes Explorer or the host app.
 */
function initializeTaskbarNative(log) {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = require(path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@koromix',
      'koffi-win32-x64',
    ));
    const user32 = koffi.load('user32.dll');
    const rectType = koffi.struct('FoliaCompactTaskbarRect', {
      left: 'int',
      top: 'int',
      right: 'int',
      bottom: 'int',
    });
    const api = {
      FindWindowW: user32.func(
        'void * __stdcall FindWindowW(const char16_t *className, const char16_t *windowName)',
      ),
      FindWindowExW: user32.func(
        'void * __stdcall FindWindowExW(void *parent, void *after, const char16_t *className, const char16_t *windowName)',
      ),
      GetWindowRect: user32.func(
        'bool __stdcall GetWindowRect(void *hwnd, _Out_ FoliaCompactTaskbarRect *rect)',
      ),
      rectType,
    };
    log.info('Compact taskbar geometry reader initialized');
    return api;
  } catch (error) {
    log.warn('Could not initialize compact taskbar geometry reader', error);
    return null;
  }
}

/** Returns the left-side free space before the centred Windows task buttons. */
function readTaskbarFreeLeft(taskbarBounds) {
  if (!taskbarNative) return null;
  try {
    const taskbar = taskbarNative.FindWindowW('Shell_TrayWnd', null);
    if (!taskbar) return null;

    const rebar = taskbarNative.FindWindowExW(taskbar, null, 'ReBarWindow32', null);
    let taskList = rebar
      ? taskbarNative.FindWindowExW(rebar, null, 'MSTaskSwWClass', null)
      : null;
    if (!taskList) {
      taskList = taskbarNative.FindWindowExW(taskbar, null, 'MSTaskSwWClass', null);
    }
    if (!taskList && rebar) {
      taskList = taskbarNative.FindWindowExW(rebar, null, 'MSTaskListWClass', null);
    }
    if (!taskList) return null;

    const taskbarRect = {};
    const taskListRect = {};
    if (!taskbarNative.GetWindowRect(taskbar, taskbarRect)) return null;
    if (!taskbarNative.GetWindowRect(taskList, taskListRect)) return null;

    const physicalTaskbarWidth = taskbarRect.right - taskbarRect.left;
    if (!Number.isFinite(physicalTaskbarWidth) || physicalTaskbarWidth <= 0) return null;

    // Win32 returns physical pixels for a DPI-aware Electron process. Normalize
    // against Electron's taskbar rectangle so the result is always in DIPs.
    const scale = physicalTaskbarWidth / Math.max(1, taskbarBounds.width);
    const freeLeft = (taskListRect.left - taskbarRect.left) / scale;
    if (!Number.isFinite(freeLeft) || freeLeft <= 0) return null;
    return freeLeft;
  } catch {
    return null;
  }
}

/**
 * Calculates the bounding rectangle of the Windows taskbar using screen display metrics.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function resolveTaskbarBounds() {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { bounds, workArea } = primaryDisplay;

    // Taskbar at the bottom of the screen (standard Windows configuration)
    if (workArea.y === bounds.y && workArea.height < bounds.height) {
      return {
        x: bounds.x,
        y: bounds.y + workArea.height,
        width: bounds.width,
        height: bounds.height - workArea.height,
      };
    }

    // Taskbar at the top
    if (workArea.y > bounds.y) {
      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: workArea.y - bounds.y,
      };
    }

    // Taskbar on the left
    if (workArea.x > bounds.x) {
      return {
        x: bounds.x,
        y: bounds.y,
        width: workArea.x - bounds.x,
        height: bounds.height,
      };
    }

    // Taskbar on the right
    if (workArea.x === bounds.x && workArea.width < bounds.width) {
      return {
        x: bounds.x + workArea.width,
        y: bounds.y,
        width: bounds.width - workArea.width,
        height: bounds.height,
      };
    }

    // Fallback: bottom 48px
    const defaultHeight = 48;
    return {
      x: bounds.x,
      y: bounds.y + bounds.height - defaultHeight,
      width: bounds.width,
      height: defaultHeight,
    };
  } catch {
    return { x: 0, y: 0, width: 1920, height: 48 };
  }
}

/**
 * Taskbar Lyrics Mod Main Entry
 * @param {import('../../src/mods/folium/contract').FoliumNodeApi} api
 */
module.exports = function activate(api) {
  // Enforce Windows platform limitation
  if (process.platform !== 'win32') {
    api.log.info('Taskbar Lyrics mod is only supported on Windows (win32). Inactive on this platform.');
    return () => {};
  }

  api.log.info(`Activating Taskbar Lyrics Drawer mod (v${api.manifest.version})`);
  taskbarNative = initializeTaskbarNative(api.log);

  let taskbarWindow = null;
  let menuWindow = null;
  let isEnabled = true;
  let isDrawerExpanded = true;
  let hoverProgressOpen = false;
  let latestSnapshot = null;
  const pendingActions = [];
  let collapseTimer = null;
  let blurDebounceTimer = null;

  let lastMenuBlurTime = 0;

  // Initialize playback snapshot from api.runtime if host has playback running
  try {
    if (api.runtime && typeof api.runtime.getPlaybackSnapshot === 'function') {
      const snap = api.runtime.getPlaybackSnapshot();
      if (snap) {
        latestSnapshot = {
          song: snap.song ? {
            title: snap.song.title || '未知曲目',
            artist: snap.song.artist || 'Folia',
            coverUrl: null,
          } : null,
          playerState: snap.state || 'paused',
          currentTime: typeof snap.position === 'number' ? snap.position : 0,
          duration: typeof snap.duration === 'number' ? snap.duration : 0,
          volume: typeof snap.volume === 'number' ? Math.round(snap.volume * 100) : 100,
          isMuted: Boolean(snap.muted),
          loopMode: snap.loopMode || 'all',
          theme: snap.theme || null,
          updatedAt: Date.now(),
          lyrics: Array.isArray(snap.lines) && snap.lines.length > 0 ? {
            lines: snap.lines.map((line) => ({
              startTime: line.startTime,
              endTime: line.endTime,
              fullText: line.fullText || line.text || '',
              text: line.text || '',
              translation: line.translation || '',
              words: Array.isArray(line.words) ? line.words.map((w) => ({
                text: w.text,
                startTime: w.startTime,
                endTime: w.endTime,
              })) : null,
            })),
          } : null,
        };
      }
    }
  } catch (err) {
    api.log.warn('Could not read initial playback snapshot from api.runtime', err);
  }

  /**
   * Asserts the window to floating level above Windows taskbar (Shell_TrayWnd).
   */
  function assertTopmost() {
    if (!taskbarWindow || taskbarWindow.isDestroyed() || !isEnabled) return;
    try {
      if (!taskbarWindow.isAlwaysOnTop()) {
        taskbarWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      if (typeof taskbarWindow.moveTop === 'function') {
        taskbarWindow.moveTop();
      }
      if (!taskbarWindow.isVisible()) {
        taskbarWindow.showInactive();
      }
    } catch {
      // Ignored if window is mid-transition or destroying
    }
  }

  /**
   * Calculates the compact left-side taskbar window bounds.
   * The window never needs to cover the centred app icons.
   */
  function getCompactLayout() {
    const display = screen.getPrimaryDisplay();
    const taskbarBounds = resolveTaskbarBounds();
    const mainHeight = Math.max(36, taskbarBounds.height - (2 * TASKBAR_VERTICAL_GAP));
    return {
      progressBelow: taskbarBounds.y <= display.bounds.y + 1,
      mainHeight,
      progressHeight: HOVER_PROGRESS_HEIGHT,
      progressGap: HOVER_PROGRESS_GAP,
    };
  }

  function sendCompactLayout() {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
    taskbarWindow.webContents.send('taskbar-lyrics:compact-layout', getCompactLayout());
  }

  function resolveCompactWindowBounds() {
    const taskbarBounds = resolveTaskbarBounds();
    const isHorizontal = taskbarBounds.width > taskbarBounds.height;

    if (!isHorizontal) {
      return {
        x: taskbarBounds.x + TASKBAR_EDGE_GAP,
        y: taskbarBounds.y + TASKBAR_VERTICAL_GAP,
        width: Math.max(1, taskbarBounds.width - (2 * TASKBAR_EDGE_GAP)),
        height: Math.max(240, taskbarBounds.height - (2 * TASKBAR_VERTICAL_GAP)),
      };
    }

    const maximumWidth = Math.max(160, taskbarBounds.width - (2 * TASKBAR_EDGE_GAP));
    let availableWidth = maximumWidth;
    if (compactConfig.autoAvoid) {
      const freeLeft = readTaskbarFreeLeft(taskbarBounds);
      if (freeLeft && Number.isFinite(freeLeft)) {
        availableWidth = Math.min(availableWidth, Math.max(160, freeLeft - (2 * TASKBAR_EDGE_GAP)));
      }
    }

    const layout = getCompactLayout();
    const extraHeight = isDrawerExpanded && hoverProgressOpen
      ? HOVER_PROGRESS_HEIGHT + HOVER_PROGRESS_GAP
      : 0;

    return {
      x: taskbarBounds.x + TASKBAR_EDGE_GAP,
      y: taskbarBounds.y + TASKBAR_VERTICAL_GAP - (layout.progressBelow ? 0 : extraHeight),
      width: Math.round(Math.max(MIN_EMBED_WIDTH, Math.min(compactConfig.width, availableWidth))),
      height: layout.mainHeight + extraHeight,
    };
  }

  function resolveCollapsedWindowBounds() {
    const taskbarBounds = resolveTaskbarBounds();
    return {
      x: taskbarBounds.x + TASKBAR_EDGE_GAP,
      y: taskbarBounds.y + TASKBAR_VERTICAL_GAP,
      width: Math.min(COLLAPSED_WIDTH, taskbarBounds.width),
      height: Math.max(36, taskbarBounds.height - (2 * TASKBAR_VERTICAL_GAP)),
    };
  }

  function applyTaskbarWindowBounds(force = false) {
    if (!taskbarWindow || taskbarWindow.isDestroyed()) return;
    const target = isDrawerExpanded ? resolveCompactWindowBounds() : resolveCollapsedWindowBounds();
    const current = taskbarWindow.getBounds();
    if (force || current.x !== target.x || current.y !== target.y ||
        current.width !== target.width || current.height !== target.height) {
      taskbarWindow.setBounds(target);
    }
    assertTopmost();
  }

  function resolveMenuBounds() {
    const bounds = resolveTaskbarBounds();
    const menuWidth = 360;
    const menuHeight = 460;
    const margin = 12;
    const x = Math.max(0, bounds.x + bounds.width - menuWidth - margin);
    let y = bounds.y - menuHeight - 8;
    if (bounds.y === 0) {
      y = bounds.y + bounds.height + 8;
    }
    return { x, y, width: menuWidth, height: menuHeight };
  }

  function createMenuWindow() {
    if (menuWindow && !menuWindow.isDestroyed()) {
      return menuWindow;
    }

    const bounds = resolveMenuBounds();
    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      title: 'Folia Taskbar Menu',
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      show: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'view', 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true);
    }

    win.loadFile(path.join(__dirname, 'view', 'menu.html'));

    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) {
        win.show();
        win.focus();
        if (latestSnapshot) {
          win.webContents.send('taskbar-lyrics:snapshot', latestSnapshot);
        }
      }
    });

    win.on('blur', () => {
      lastMenuBlurTime = Date.now();
      closeMenuWindow();
    });

    win.on('closed', () => {
      menuWindow = null;
    });

    menuWindow = win;
    return win;
  }

  function showMenuWindow() {
    if (menuWindow && !menuWindow.isDestroyed()) {
      const bounds = resolveMenuBounds();
      menuWindow.setBounds(bounds);
      menuWindow.show();
      menuWindow.focus();
      if (latestSnapshot) {
        menuWindow.webContents.send('taskbar-lyrics:snapshot', latestSnapshot);
      }
      return menuWindow;
    }
    return createMenuWindow();
  }

  function toggleMenuWindow() {
    const now = Date.now();
    if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
      closeMenuWindow();
      return;
    }
    // Prevent toggle bounce: if the menu just blurred within 350ms, the toggle click caused the blur.
    if (now - lastMenuBlurTime < 350) {
      return;
    }
    showMenuWindow();
  }

  function closeMenuWindow() {
    if (menuWindow && !menuWindow.isDestroyed()) {
      menuWindow.hide();
    }
  }

  /**
   * Expands the drawer: resizes the window to full taskbar width and animates.
   */
  function expandDrawer() {
    if (!taskbarWindow || taskbarWindow.isDestroyed() || !isEnabled) return;
    if (isDrawerExpanded) return;

    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }

    isDrawerExpanded = true;
    applyTaskbarWindowBounds(true);
    taskbarWindow.webContents.send('taskbar-lyrics:state', 'expanded');
  }

  /**
   * Collapses the drawer: notifies view to slide out, then resizes back to 56px.
   */
  function collapseDrawer() {
    if (!taskbarWindow || taskbarWindow.isDestroyed() || !isEnabled) return;
    if (!isDrawerExpanded) return;

    closeMenuWindow();
    isDrawerExpanded = false;
    hoverProgressOpen = false;
    taskbarWindow.webContents.send('taskbar-lyrics:state', 'collapsed');

    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      if (taskbarWindow && !taskbarWindow.isDestroyed() && !isDrawerExpanded) {
        applyTaskbarWindowBounds(true);
      }
    }, 420);
  }

  function toggleDrawer() {
    if (isDrawerExpanded) {
      collapseDrawer();
    } else {
      expandDrawer();
    }
  }

  function createWindow() {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      return taskbarWindow;
    }

    const bounds = isDrawerExpanded ? resolveCompactWindowBounds() : resolveCollapsedWindowBounds();
    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      title: 'Folia Taskbar Lyrics Drawer',
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      focusable: true,
      show: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, 'view', 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    if (typeof win.setVisibleOnAllWorkspaces === 'function') {
      win.setVisibleOnAllWorkspaces(true);
    }

    win.loadFile(path.join(__dirname, 'view', 'taskbar.html'));

    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) {
        applyTaskbarWindowBounds(true);
        sendCompactLayout();
        if (isEnabled) {
          win.showInactive();
        }
        win.webContents.send('taskbar-lyrics:state', isDrawerExpanded ? 'expanded' : 'collapsed');
        if (latestSnapshot) {
          win.webContents.send('taskbar-lyrics:snapshot', latestSnapshot);
        }
      }
    });

    win.on('minimize', () => {
      if (taskbarWindow && !taskbarWindow.isDestroyed() && isEnabled) {
        taskbarWindow.restore();
        assertTopmost();
      }
    });

    win.on('blur', () => {
      if (taskbarWindow && !taskbarWindow.isDestroyed() && isEnabled) {
        taskbarWindow.moveTop();
      }
    });

    win.webContents.on('render-process-gone', (_event, details) => {
      api.log.warn(`Taskbar lyrics renderer process gone (${details.reason}), recreating window...`);
      if (taskbarWindow && !taskbarWindow.isDestroyed()) {
        try { taskbarWindow.destroy(); } catch {}
      }
      taskbarWindow = null;
      if (isEnabled) {
        createWindow();
      }
    });

    win.on('unresponsive', () => {
      api.log.warn('Taskbar lyrics window unresponsive, reloading webContents...');
      if (taskbarWindow && !taskbarWindow.isDestroyed()) {
        try { taskbarWindow.webContents.reload(); } catch {}
      }
    });

    win.on('closed', () => {
      taskbarWindow = null;
      if (menuWindow && !menuWindow.isDestroyed()) {
        menuWindow.close();
      }
    });

    taskbarWindow = win;
    return win;
  }

  function enableTaskbarLyrics() {
    isEnabled = true;
    if (!taskbarWindow || taskbarWindow.isDestroyed()) {
      createWindow();
    } else {
      assertTopmost();
      taskbarWindow.showInactive();
    }
  }

  function disableTaskbarLyrics() {
    isEnabled = false;
    closeMenuWindow();
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.hide();
    }
  }

  const isAuthorizedSender = (event) => {
    if (!event || !event.sender) return false;
    const senderId = event.sender.id;
    const taskbarId = taskbarWindow && !taskbarWindow.isDestroyed() ? taskbarWindow.webContents.id : null;
    const menuId = menuWindow && !menuWindow.isDestroyed() ? menuWindow.webContents.id : null;
    return Boolean(senderId && (senderId === taskbarId || senderId === menuId));
  };

  // IPC Event Handlers with Sender Verification
  const onToggleDrawer = (event) => {
    if (isAuthorizedSender(event)) toggleDrawer();
  };
  const onExpandDrawer = (event) => {
    if (isAuthorizedSender(event)) expandDrawer();
  };
  const onCollapseDrawer = (event) => {
    if (isAuthorizedSender(event)) collapseDrawer();
  };
  const onAnimationDone = (event, finalState) => {
    if (!isAuthorizedSender(event)) return;
    if (finalState === 'collapsed' && !isDrawerExpanded) {
      applyTaskbarWindowBounds(true);
    }
  };

  const onPlaybackAction = (event, payload) => {
    if (isAuthorizedSender(event)) {
      if (pendingActions.length < MAX_PENDING_ACTIONS) {
        pendingActions.push(payload);
      }
    }
  };

  const onToggleMenu = (event) => {
    if (isAuthorizedSender(event)) toggleMenuWindow();
  };
  const onCloseMenu = (event) => {
    if (isAuthorizedSender(event)) closeMenuWindow();
  };

  const onAssertTop = (event) => {
    if (isAuthorizedSender(event)) assertTopmost();
  };

  const onHoverProgress = (event, open) => {
    if (!isAuthorizedSender(event)) return;
    const nextOpen = Boolean(open) && isDrawerExpanded;
    if (hoverProgressOpen === nextOpen) return;
    hoverProgressOpen = nextOpen;
    applyTaskbarWindowBounds(true);
  };

  ipcMain.on('taskbar-lyrics:toggle', onToggleDrawer);
  ipcMain.on('taskbar-lyrics:expand', onExpandDrawer);
  ipcMain.on('taskbar-lyrics:collapse', onCollapseDrawer);
  ipcMain.on('taskbar-lyrics:animation-done', onAnimationDone);
  ipcMain.on('taskbar-lyrics:playback-action', onPlaybackAction);
  ipcMain.on('taskbar-lyrics:toggle-menu', onToggleMenu);
  ipcMain.on('taskbar-lyrics:close-menu', onCloseMenu);
  ipcMain.on('taskbar-lyrics:assert-top', onAssertTop);
  ipcMain.on('taskbar-lyrics:hover-progress', onHoverProgress);

  // Screen metrics listener
  const onDisplayMetricsChanged = () => {
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      applyTaskbarWindowBounds(true);
      sendCompactLayout();
    }
    if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
      const menuBounds = resolveMenuBounds();
      menuWindow.setBounds(menuBounds);
    }
  };
  screen.on('display-metrics-changed', onDisplayMetricsChanged);

  // Register RPC for renderer client (`client.mjs`)
  api.rpc.handle('syncSnapshot', (snapshot) => {
    latestSnapshot = { ...latestSnapshot, ...snapshot };
    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.webContents.send('taskbar-lyrics:snapshot', snapshot);
    }
    if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
      menuWindow.webContents.send('taskbar-lyrics:snapshot', snapshot);
    }
    return true;
  });

  api.rpc.handle('drainActions', () => {
    if (pendingActions.length === 0) return [];
    return pendingActions.splice(0, pendingActions.length);
  });


  api.rpc.handle('configureWindow', (nextConfig = {}) => {
    const requestedWidth = Number(nextConfig.width);
    compactConfig = {
      width: Number.isFinite(requestedWidth)
        ? Math.round(Math.min(760, Math.max(320, requestedWidth)))
        : DEFAULT_EMBED_WIDTH,
      autoAvoid: nextConfig.autoAvoid !== false,
    };
    applyTaskbarWindowBounds(true);
    sendCompactLayout();
    return compactConfig;
  });

  api.rpc.handle('toggleDrawer', () => toggleDrawer());
  api.rpc.handle('expandDrawer', () => expandDrawer());
  api.rpc.handle('collapseDrawer', () => collapseDrawer());
  api.rpc.handle('getStatus', () => ({
    isOpen: Boolean(taskbarWindow && !taskbarWindow.isDestroyed()),
    isEnabled,
    isExpanded: isDrawerExpanded,
  }));

  // Initialize the taskbar window
  createWindow();

  // Active Z-order watchdog for Windows: keeps taskbarWindow and left toggle button above Shell_TrayWnd
  const topmostKeepAliveTimer = setInterval(() => {
    if (taskbarWindow && !taskbarWindow.isDestroyed() && isEnabled) {
      applyTaskbarWindowBounds(false);
    }
  }, 1000);

  // Lifecycle teardown
  const onDispose = () => {
    api.log.info('Deactivating Taskbar Lyrics Drawer mod');
    if (topmostKeepAliveTimer) clearInterval(topmostKeepAliveTimer);
    if (collapseTimer) clearTimeout(collapseTimer);
    if (blurDebounceTimer) clearTimeout(blurDebounceTimer);
    screen.removeListener('display-metrics-changed', onDisplayMetricsChanged);
    ipcMain.removeListener('taskbar-lyrics:toggle', onToggleDrawer);
    ipcMain.removeListener('taskbar-lyrics:expand', onExpandDrawer);
    ipcMain.removeListener('taskbar-lyrics:collapse', onCollapseDrawer);
    ipcMain.removeListener('taskbar-lyrics:animation-done', onAnimationDone);
    ipcMain.removeListener('taskbar-lyrics:playback-action', onPlaybackAction);
    ipcMain.removeListener('taskbar-lyrics:toggle-menu', onToggleMenu);
    ipcMain.removeListener('taskbar-lyrics:close-menu', onCloseMenu);
    ipcMain.removeListener('taskbar-lyrics:assert-top', onAssertTop);
    ipcMain.removeListener('taskbar-lyrics:hover-progress', onHoverProgress);

    if (menuWindow && !menuWindow.isDestroyed()) {
      menuWindow.close();
      menuWindow = null;
    }

    if (taskbarWindow && !taskbarWindow.isDestroyed()) {
      taskbarWindow.close();
      taskbarWindow = null;
    }
  };

  return onDispose;
};
