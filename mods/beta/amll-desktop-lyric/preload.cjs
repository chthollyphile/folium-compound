// src/preload.cjs
// 歌词窗口的 preload：只开一条通道，把宿主的两个方向（状态/设置下行、命令上行）做成一个
// 最小 API。窗口页面拿不到 Node，也拿不到别的 IPC。

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const CH_STATE = 'folia-amll-desktop-lyric:state';
const CH_SETTINGS = 'folia-amll-desktop-lyric:settings';
const CH_FROM_WINDOW = 'folia-amll-desktop-lyric:from-window';

const subscribe = (channel) => (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
};

contextBridge.exposeInMainWorld('deskLyric', {
    onState: subscribe(CH_STATE),
    onSettings: subscribe(CH_SETTINGS),
    send: (message) => ipcRenderer.send(CH_FROM_WINDOW, message),
});
