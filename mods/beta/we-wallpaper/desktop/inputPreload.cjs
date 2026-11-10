'use strict';

const { ipcRenderer } = require('electron');

// Only DOM pointer events delivered to this shaped window are sent to the main process.
window.addEventListener('DOMContentLoaded', () => {
    let lastMove = 0;
    let activePointer = null;
    let activeButton = 0;
    const send = (kind,event) => ipcRenderer.send('folia-we-desktop-input:pointer', {
        kind, x:event.clientX, y:event.clientY, button:event.button,
        deltaX:event.deltaX || 0, deltaY:event.deltaY || 0,
    });
    document.addEventListener('pointermove', event => {
        if(performance.now()-lastMove < 16) return;
        lastMove = performance.now();
        send('move',event);
    });
    document.addEventListener('pointerdown', event => {
        if(event.button !== 0 && event.button !== 2) return;
        activePointer = event.pointerId;
        activeButton = event.button;
        document.body.setPointerCapture(event.pointerId);
        send('down',event);
    });
    document.addEventListener('pointerup', event => {
        if(event.pointerId !== activePointer) return;
        send('up',event);
        activePointer = null;
        if(document.body.hasPointerCapture(event.pointerId)) document.body.releasePointerCapture(event.pointerId);
    });
    document.addEventListener('pointercancel', event => { if(event.pointerId === activePointer) {send('up',{clientX:event.clientX,clientY:event.clientY,button:activeButton}); activePointer = null;} });
    document.addEventListener('pointerleave', event => { if(activePointer === null) send('leave',event); });
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('wheel', event => { event.preventDefault(); send('wheel',event); }, { passive:false });
});
