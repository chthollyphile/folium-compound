// settings-preload.cjs — bridge for the "More settings" panel.
//
// Same shape as any Electron preload: contextBridge exposes a narrow API, and
// the window talks to the mod's Node entry over two channels. No node
// integration in the page.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('menubarLyricsSettings', {
    onState: (callback) => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on('menubar-lyrics:state', listener);
        return () => ipcRenderer.removeListener('menubar-lyrics:state', listener);
    },
    update: (patch) => ipcRenderer.send('menubar-lyrics:update', patch),
    close: () => ipcRenderer.send('menubar-lyrics:close'),
});
