'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopLyric', {
  platform: process.platform,
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-lyric:update', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:update', listener);
  },
  onLock: (callback) => {
    const listener = (_event, locked) => callback(locked);
    ipcRenderer.on('desktop-lyric:lock', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:lock', listener);
  },
  onFont: (callback) => {
    const listener = (_event, size) => callback(size);
    ipcRenderer.on('desktop-lyric:font', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:font', listener);
  },
  onFontFamily: (callback) => {
    const listener = (_event, family) => callback(family);
    ipcRenderer.on('desktop-lyric:font-family', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:font-family', listener);
  },
  onLines: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('desktop-lyric:lines', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:lines', listener);
  },
  onFonts: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('desktop-lyric:fonts', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:fonts', listener);
  },
  onThemes: (callback) => {
    const listener = (_event, themes) => callback(themes);
    ipcRenderer.on('desktop-lyric:themes', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:themes', listener);
  },
  onTaskbar: (callback) => {
    const listener = (_event, active) => callback(active);
    ipcRenderer.on('desktop-lyric:taskbar', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:taskbar', listener);
  },
  onColors: (callback) => {
    const listener = (_event, colors) => callback(colors);
    ipcRenderer.on('desktop-lyric:colors', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:colors', listener);
  },
  onOffset: (callback) => {
    const listener = (_event, ms) => callback(ms);
    ipcRenderer.on('desktop-lyric:offset', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:offset', listener);
  },
  onResized: (callback) => {
    const listener = (_event, active) => callback(active);
    ipcRenderer.on('desktop-lyric:resized', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:resized', listener);
  },
  // 锁定（点击穿透）时，指针停在歌词上会让主进程临时取消穿透；这里把该状态推给页面做高亮。
  onInteractive: (callback) => {
    const listener = (_event, active) => callback(active);
    ipcRenderer.on('desktop-lyric:interactive', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:interactive', listener);
  },
  // 设置窗口：整块状态快照 + 目标标签页
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop-lyric:state', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:state', listener);
  },
  onSettingsTab: (callback) => {
    const listener = (_event, tab) => callback(tab);
    ipcRenderer.on('desktop-lyric:settings-tab', listener);
    return () => ipcRenderer.removeListener('desktop-lyric:settings-tab', listener);
  },
  command: (name, arg) => ipcRenderer.send('desktop-lyric:command', name, arg),
});
