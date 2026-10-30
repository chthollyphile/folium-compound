const { contextBridge, ipcRenderer } = require('electron');

// mods/taskbar-lyrics-compact/view/preload.cjs
// Secure bridge for playback snapshots, hover progress geometry and controls.

contextBridge.exposeInMainWorld('taskbarBridge', {
  assertTop: () => ipcRenderer.send('taskbar-lyrics:assert-top'),
  toggleDrawer: () => ipcRenderer.send('taskbar-lyrics:toggle'),
  expandDrawer: () => ipcRenderer.send('taskbar-lyrics:expand'),
  collapseDrawer: () => ipcRenderer.send('taskbar-lyrics:collapse'),
  setHoverProgress: (open) => ipcRenderer.send('taskbar-lyrics:hover-progress', Boolean(open)),
  onDrawerState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('taskbar-lyrics:state', handler);
    return () => ipcRenderer.removeListener('taskbar-lyrics:state', handler);
  },
  onCompactLayout: (callback) => {
    const handler = (_event, layout) => callback(layout);
    ipcRenderer.on('taskbar-lyrics:compact-layout', handler);
    return () => ipcRenderer.removeListener('taskbar-lyrics:compact-layout', handler);
  },
  notifyAnimationComplete: (state) => {
    ipcRenderer.send('taskbar-lyrics:animation-done', state);
  },
  onSnapshot: (callback) => {
    const handler = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('taskbar-lyrics:snapshot', handler);
    return () => ipcRenderer.removeListener('taskbar-lyrics:snapshot', handler);
  },
  toggleMenu: () => ipcRenderer.send('taskbar-lyrics:toggle-menu'),
  closeMenu: () => ipcRenderer.send('taskbar-lyrics:close-menu'),
  sendPlaybackAction: (action, payload) => {
    ipcRenderer.send('taskbar-lyrics:playback-action', { action, payload });
  },
});
