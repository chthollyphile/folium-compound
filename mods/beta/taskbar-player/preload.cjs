const { contextBridge, ipcRenderer } = require('electron');

const STATE_CHANNEL = 'taskbar-player:state';
const CMD_CHANNEL = 'taskbar-player:cmd';
const PAGE_CHANNEL = 'taskbar-player:page';

contextBridge.exposeInMainWorld('taskbarPlayer', {
    onState(listener) {
        const handler = (_event, view) => {
            try {
                listener(view);
            } catch {
                /* the page is ours; nothing to report to */
            }
        };
        ipcRenderer.on(STATE_CHANNEL, handler);
        return () => ipcRenderer.removeListener(STATE_CHANNEL, handler);
    },
    sendCommand(name) {
        ipcRenderer.send(CMD_CHANNEL, String(name));
    },
    pageEvent(type) {
        ipcRenderer.send(PAGE_CHANNEL, String(type));
    },
});
