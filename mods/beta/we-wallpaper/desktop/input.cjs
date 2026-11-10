'use strict';

const path = require('path');
const { BrowserWindow, ipcMain, screen } = require('electron');

// The OS clips this input window to Folia's own controls; other desktop points fall through.
function createDesktopInput({ getWindow, log }) {
    const channel = 'folia-we-desktop-input:pointer';
    const native = require('../bin/we-capture-v2.win32-x64.node');
    let window = null;
    let enabled = false;
    let layout = null;
    let regions = [];
    let pressed = null;
    let lastPoint = { x:0, y:0 };
    let signature = '';
    let observed = null;
    const stopWatching = () => {
        if(!observed) return;
        observed.webContents.removeListener('render-process-gone',clear);
        observed.webContents.removeListener('did-start-navigation',onNavigate);
        observed.removeListener('closed',clear);
        observed = null;
    };
    const onNavigate = (_event,_url,_inPlace,isMainFrame) => { if(isMainFrame) clear(); };
    function release() {
        const target = getWindow();
        if (pressed && target && !target.isDestroyed()) target.webContents.sendInputEvent({ type:'mouseUp', ...lastPoint, button:pressed, clickCount:1 });
        pressed = null;
        if (target && !target.isDestroyed()) target.webContents.sendInputEvent({ type:'mouseLeave', ...lastPoint });
    }
    function clear() {
        release();
        signature = '';
        regions = [];
        const owned = window;
        window = null;
        if (owned && !owned.isDestroyed()) owned.destroy();
    }
    function place() {
        if (!window || window.isDestroyed()) return;
        try { native.placeAboveDesktop(window.getNativeWindowHandle().readBigUInt64LE().toString()); }
        catch(error) { window.hide(); log.error(error); }
    }
    function refresh() {
        const target = getWindow();
        if (!enabled || !layout || !target || target.isDestroyed() || !target.__foliaWeDesktop) { clear(); return; }
        const bounds = target.getContentBounds();
        const zoom = target.webContents.getZoomFactor();
        const rects = layout.map(rect => {
            const x = Math.max(0, Math.floor(rect.left * zoom));
            const y = Math.max(0, Math.floor(rect.top * zoom));
            const right = Math.min(bounds.width, Math.ceil((rect.left + rect.width) * zoom));
            const bottom = Math.min(bounds.height, Math.ceil((rect.top + rect.height) * zoom));
            return { x, y, width:right - x, height:bottom - y };
        }).filter(rect => rect.width > 0 && rect.height > 0);
        if (!rects.length) { clear(); return; }
        const key = JSON.stringify([bounds, rects]);
        if (key === signature) return;
        signature = key;
        regions = rects;
        if (!window) {
            const owned = new BrowserWindow({
                ...bounds, title:'Folia desktop input', frame:false, thickFrame:false, transparent:true,
                backgroundColor:'#01000000', hasShadow:false, resizable:false, focusable:false,
                minimizable:false, maximizable:false, fullscreenable:false, skipTaskbar:true, show:false,
                webPreferences:{ preload:path.join(__dirname,'inputPreload.cjs'), contextIsolation:true, nodeIntegration:false, sandbox:true },
            });
            window = owned;
            owned.setShape(rects);
            owned.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
            owned.webContents.on('will-navigate', event => event.preventDefault());
            owned.once('ready-to-show', () => {
                if (window !== owned || !enabled) return;
                owned.setBounds(bounds,false);
                owned.showInactive();
                place();
            });
            owned.on('closed', () => { if(window === owned) { window = null; release(); signature = ''; } });
            void owned.loadFile(path.join(__dirname,'input.html')).catch(error => log.error(error));
        } else {
            window.setBounds(bounds,false);
            window.setShape(rects);
            place();
        }
    }
    const inside = (x,y) => regions.some(rect => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
    const forward = (event, data) => {
        const target = getWindow();
        if (!enabled || !window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !target || target.isDestroyed() || !target.__foliaWeDesktop) return;
        if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
        const point = { x:Math.round(data.x), y:Math.round(data.y) };
        if (data.kind === 'leave') { if(!pressed) target.webContents.sendInputEvent({ type:'mouseLeave', ...lastPoint }); return; }
        if (!inside(point.x,point.y) && !pressed) return;
        lastPoint = point;
        switch(data.kind) {
            case 'move': target.webContents.sendInputEvent({ type:'mouseMove', ...point, modifiers:pressed?[pressed+'buttondown']:[] }); break;
            case 'down':
                if(data.button !== 0 && data.button !== 2) return;
                pressed = data.button === 2 ? 'right' : 'left';
                target.webContents.sendInputEvent({ type:'mouseMove', ...point });
                target.webContents.sendInputEvent({ type:'mouseDown', ...point, button:pressed, clickCount:1, modifiers:[pressed+'buttondown'] });
                break;
            case 'up':
                if(!pressed || (data.button === 2 ? 'right' : data.button === 0 ? 'left' : null) !== pressed) return;
                target.webContents.sendInputEvent({ type:'mouseMove', ...point, modifiers:[pressed+'buttondown'] });
                target.webContents.sendInputEvent({ type:'mouseUp', ...point, button:pressed, clickCount:1 });
                pressed = null;
                break;
            case 'wheel':
                if(!Number.isFinite(data.deltaX) || !Number.isFinite(data.deltaY)) return;
                target.webContents.sendInputEvent({ type:'mouseWheel', ...point, deltaX:-data.deltaX, deltaY:-data.deltaY });
                break;
        }
    };
    ipcMain.on(channel,forward);
    const displayChanged = () => { signature = ''; refresh(); };
    screen.on('display-metrics-changed',displayChanged);
    return {
        setEnabled(value) {
            enabled = value;
            stopWatching();
            if(value) {
                observed = getWindow();
                observed.webContents.on('render-process-gone',clear);
                observed.webContents.on('did-start-navigation',onNavigate);
                observed.on('closed',clear);
                refresh();
            } else clear();
        },
        update(rects) {
            if(!Array.isArray(rects)) throw new Error('Invalid desktop control regions');
            layout = rects.filter(rect => rect && [rect.left,rect.top,rect.width,rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0).map(({left,top,width,height})=>({left,top,width,height}));
            refresh();
        },
        dispose() { enabled = false; stopWatching(); clear(); ipcMain.removeListener(channel,forward); screen.removeListener('display-metrics-changed',displayChanged); },
    };
}

module.exports = { createDesktopInput };
