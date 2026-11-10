import { translator } from './labels.mjs';
import { NATIVE_VERSION, isMainContext, callHost } from './support.mjs';

// Desktop attachment and remembered window bounds belong to the mod main entry.
export function createDesktopNavigation(folium) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return null;
    let desktop = false;
    let hostReady = false;
    let disposed = false;
    let busy = false;
    let generation = 0;
    let requestedDesktop = false;
    let nativeReady = false;
    let pending = Promise.resolve();
    let active = pending;
    const listeners = new Set();
    const publish = () => { for (const listener of listeners) listener(); };
    const report = error => { if (!disposed) folium.ui.toast(error.message, { type: 'error' }); };
    const applyState = state => {
        desktop = Boolean(state.enabled);
        if (!busy) requestedDesktop = desktop;
        publish();
    };
    const suspendDesktop = () => !disposed && desktop && nativeReady ? callHost('suspend-desktop') : Promise.resolve();
    const waitForHost = new Promise(resolve => {
        const stopWaiting = folium.every(50, () => {
            try { folium.playback.getState(); }
            catch { return; }
            hostReady = true;
            stopWaiting();
            resolve();
        });
    });
    const ready = (async () => {
        const settings = await window.electron.getSettings();
        if (disposed) return;
        if (settings.wallpaper_mode) await window.electron.saveSettings('wallpaper_mode', false);
        if (disposed) return;
        const state = await callHost('desktop-state');
        if (!disposed) applyState(state);
        return state;
    })();
    const change = (enabled, openHome = false) => {
        if (disposed) return Promise.resolve();
        if (busy && requestedDesktop === enabled) return active;
        const request = ++generation;
        requestedDesktop = enabled;
        busy = true;
        publish();
        const operation = pending.then(async () => {
            await ready;
            await waitForHost;
            if (disposed || request !== generation) return;
            if (enabled) folium.ui.navigate('player');
            const state = await callHost(enabled ? 'enter-desktop' : 'leave-desktop');
            if (disposed) return;
            applyState(state);
            if (request !== generation) return;
            if (desktop) await suspendDesktop();
            else if (openHome) folium.ui.navigate('home');
        });
        pending = operation.catch(() => {});
        active = operation.finally(() => {
            if (!disposed && request === generation) {
                busy = false;
                requestedDesktop = desktop;
                publish();
            }
        });
        return active;
    };
    const enter = () => change(true);
    const leave = (openHome = true) => change(false, openHome);
    folium.onDispose(folium.events.on('app.viewChanged', ({ view }) => {
        if ((desktop || requestedDesktop) && view !== 'player') void leave(false).catch(report);
    }));
    folium.onDispose(folium.rpc.on('desktop-mode', state => {
        if (disposed) return;
        const wasDesktop = desktop;
        applyState(state);
        if (!hostReady || busy) return;
        if (desktop) {
            folium.ui.navigate('player');
            void suspendDesktop().catch(report);
        } else if (wasDesktop) folium.ui.navigate('home');
    }));
    void (async () => {
        const state = await ready;
        await waitForHost;
        if (disposed || generation !== 0) return;
        if (state.resume && !desktop) await enter();
        else if (desktop) {
            folium.ui.navigate('player');
            await suspendDesktop();
        }
    })().catch(error => { if (!disposed) folium.log.error(error.message); });
    folium.onDispose(() => { disposed = true; ++generation; listeners.clear(); });
    return {
        enter, leave, ready,
        onNativeReady() {
            if (nativeReady || disposed) return;
            nativeReady = true;
            if (!busy) void suspendDesktop().catch(report);
        },
        onNativeStopped() { nativeReady = false; },
        get desktop() { return desktop; },
        get busy() { return busy; },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    };
}

export function mountNavigation(folium, container, ctx, navigation) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const t = translator();
    const style = document.createElement('style');
    style.textContent = '.we-navigation{position:absolute;right:24px;bottom:108px;display:flex;align-items:center;gap:8px;min-height:40px;padding:8px 16px;border:0;border-radius:20px;background:rgba(0,0,0,.2);color:rgba(255,255,255,.6);backdrop-filter:blur(12px);font:13px "Segoe UI","Microsoft YaHei UI",sans-serif;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease-out,transform .2s ease-out,background-color .15s ease}.we-navigation:hover{background:rgba(255,255,255,.1)}.we-navigation:focus-visible{outline:2px solid currentColor;outline-offset:3px}.we-navigation:disabled{cursor:wait}';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'we-navigation';
    const caption = document.createElement('span');
    button.appendChild(caption);
    container.append(style, button);
    let disposed = false;
    let nearby = false;
    let keyboardFocused = false;
    let touchTimer;
    folium.ui.icon('list-music', { size: 16 }).then(icon => { if (icon && !disposed) button.prepend(icon); });
    const render = () => {
        const display = ctx.getDisplay();
        const unavailable = display.isPlayerChromeHidden || display.visualizerOpacity === 0;
        const hidden = unavailable || (!nearby && !keyboardFocused);
        caption.textContent = navigation.desktop ? t('chooseSong') : t('returnDesktop');
        button.disabled = navigation.busy || unavailable;
        button.style.opacity = String(hidden ? 0 : display.visualizerOpacity * (navigation.busy ? 0.6 : 1));
        button.style.transform = hidden ? 'translateY(6px) scale(.92)' : 'translateY(0) scale(1)';
        button.style.pointerEvents = hidden ? 'none' : 'auto';
        button.setAttribute('aria-hidden', String(unavailable));
        button.tabIndex = unavailable ? -1 : 0;
    };
    const off = navigation.subscribe(render);
    const offDisplay = ctx.onChange(render);
    const reveal = next => {
        if (nearby === next) return;
        nearby = next;
        render();
    };
    const move = event => reveal(event.clientX >= window.innerWidth - 240 && event.clientY >= window.innerHeight - 200);
    const leave = () => { clearTimeout(touchTimer); reveal(false); };
    const touch = event => {
        if (event.pointerType !== 'touch') return;
        move(event);
        clearTimeout(touchTimer);
        touchTimer = window.setTimeout(leave, 1400);
    };
    const cancel = event => { if (event.pointerType === 'touch') leave(); };
    button.onfocus = () => { keyboardFocused = button.matches(':focus-visible'); render(); };
    button.onblur = () => { keyboardFocused = false; render(); };
    window.addEventListener('mousemove', move, true);
    window.addEventListener('pointerdown', touch, true);
    window.addEventListener('pointercancel', cancel, true);
    document.addEventListener('mouseleave', leave);
    window.addEventListener('blur', leave);
    window.addEventListener('resize', leave);
    render();
    button.onclick = () => {
        const action = navigation.desktop ? navigation.leave() : navigation.enter();
        action.catch(error => folium.ui.toast(error.message, { type: 'error' }));
    };
    return () => {
        disposed = true;
        off(); offDisplay();
        clearTimeout(touchTimer);
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('pointerdown', touch, true);
        window.removeEventListener('pointercancel', cancel, true);
        document.removeEventListener('mouseleave', leave);
        window.removeEventListener('blur', leave);
        window.removeEventListener('resize', leave);
        button.remove(); style.remove();
    };
}
