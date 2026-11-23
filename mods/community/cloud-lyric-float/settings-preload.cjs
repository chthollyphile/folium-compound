'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const listen = (channel, callback) => {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('cloudLyricSettings', {
  onConfig: (callback) => listen('cloud-lyric-settings:config', callback),
  command: (name, payload) => ipcRenderer.send('cloud-lyric-settings:command', name, payload),
  ready: () => ipcRenderer.send('cloud-lyric-settings:ready'),
});
