'use strict';

const { randomUUID } = require('crypto');

// Ask Folia's renderer for its own playback handoff before replacing a transparent window.
const pending = new WeakMap();
function capturePlaybackForOpaque(win) {
    const contents = win.webContents;
    const existing = pending.get(contents);
    if (existing) return existing.promise;
    const capture = {};
    pending.set(contents, capture);
    capture.promise = new Promise((resolve, reject) => {
        const channel = 'window-playback-handoff-submit';
        const requestId = randomUUID();
        let timer;
        const clear = () => {
            if (pending.get(contents) !== capture) return;
            pending.delete(contents);
            clearTimeout(timer);
            if (!contents.isDestroyed()) {
                contents.ipc.removeHandler(channel);
                contents.removeListener('did-start-navigation', navigation);
            }
            win.removeListener('closed', closed);
        };
        const closed = () => { clear(); resolve(null); };
        const navigation = details => {
            if (details.isMainFrame && !details.isSameDocument) closed();
        };
        try {
            contents.ipc.handle(channel, (event, id, handoff) => {
                if (event.senderFrame !== contents.mainFrame) throw new Error('Unexpected playback frame');
                clear();
                if (id !== requestId) {
                    // A native window operation takes precedence and receives its original answer.
                    resolve(null);
                    return contents.executeJavaScript('window.electron.submitWindowPlaybackHandoff(' + JSON.stringify(id) + ',' + JSON.stringify(handoff) + ')');
                }
                resolve(handoff);
                return true;
            });
        } catch (error) {
            pending.delete(contents);
            reject(error);
            return;
        }
        timer = setTimeout(() => {
            clear();
            reject(new Error('Folia did not provide its playback state; background mode was not changed'));
        }, 7000);
        win.once('closed', closed);
        contents.on('did-start-navigation', navigation);
        contents.send('window-playback-handoff-requested', { requestId });
    });
    return capture.promise;
}

module.exports = { capturePlaybackForOpaque };
