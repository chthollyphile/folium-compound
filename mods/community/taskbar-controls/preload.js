'use strict';

// 任务栏控制条 —— preload（隔离的桥）
//
// 控制条窗口不开 Node：nodeIntegration=false、contextIsolation=true，
// 页面里拿不到 require / ipcRenderer / process。这里只把控制条真正需要的
// 几个动作做成白名单暴露到 window.tb，页面只能发指令、收状态，
// 频道名和参数都在这一层固定，渲染层无法指定任意 channel。

const { contextBridge, ipcRenderer } = require('electron');

const CH = {
    cmd: 'taskbar-controls:cmd',
    resize: 'taskbar-controls:resize',
    state: 'taskbar-controls:state',
    error: 'taskbar-controls:error',
};

const ALLOWED_ACTIONS = new Set([
    'toggle',
    'play',
    'pause',
    'next',
    'previous',
    'like',
    'mute',
    'loop',
    'volume',
    'seek',
    'panel',
    'back',
    // 页面主动拉一次当前状态（绕开「首推丢了就再也不推」的时序问题）
    'sync',
]);

const subscribe = (channel, callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => {
        try {
            callback(payload ?? null);
        } catch (error) {
            // 页面回调出错不该把 preload 拖垮
        }
    };
    ipcRenderer.on(channel, handler);
    return () => {
        try {
            ipcRenderer.removeListener(channel, handler);
        } catch (error) {
            /* 忽略 */
        }
    };
};

contextBridge.exposeInMainWorld('tb', {
    // 只允许白名单动作，value 只接受字符串/数字/布尔
    send(action, value) {
        if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) return;
        let safeValue;
        if (typeof value === 'number' && Number.isFinite(value)) safeValue = value;
        else if (typeof value === 'string') safeValue = value.slice(0, 256);
        else if (typeof value === 'boolean') safeValue = value;
        ipcRenderer.send(CH.cmd, { action, value: safeValue });
    },
    resize(height) {
        const h = Number(height);
        if (!Number.isFinite(h)) return;
        ipcRenderer.send(CH.resize, { height: h });
    },
    onState(callback) {
        return subscribe(CH.state, callback);
    },
    onError(callback) {
        return subscribe(CH.error, callback);
    },
});
