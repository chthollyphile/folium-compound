'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const listen = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('cloudLyric', {
  onState: (callback) => listen('cloud-lyric:state', callback),
  onConfig: (callback) => listen('cloud-lyric:config', callback),
  onLocked: (callback) => listen('cloud-lyric:locked', callback),
  onLockHover: (callback) => listen('cloud-lyric:lock-hover', callback),
  onResetPosition: (callback) => listen('cloud-lyric-float:reset-position', callback),
  onOpenSettings: (callback) => listen('cloud-lyric:open-settings', callback),
  command: (name, payload) => ipcRenderer.send('cloud-lyric:command', name, payload),
  ready: () => ipcRenderer.send('cloud-lyric:ready'),
});
