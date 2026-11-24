import { translator } from './labels.mjs';
import { NATIVE_VERSION, isMainContext, callHost } from './support.mjs';
import { observeNavigationAnchor } from './navigationLayout.mjs';

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
    const layoutListeners = new Set();
    let hitRegion = null;
    const publish = () => { for (const listener of listeners) listener(); };
    const report = error => { if (!disposed) folium.ui.toast(error.message, { type: 'error' }); };
    const applyState = state => {
        desktop = Boolean(state.enabled);
        if (!busy) requestedDesktop = desktop;
        publish();
    };
    const suspendDesktop = () => !disposed && desktop && nativeReady ? callHost(folium, 'suspend-desktop') : Promise.resolve();
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
        const state = await callHost(folium, 'desktop-state');
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
            const state = await callHost(folium, enabled ? 'enter-desktop' : 'leave-desktop');
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
    folium.onDispose(() => { disposed = true; ++generation; listeners.clear(); layoutListeners.clear(); });
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
        get hitRegion() { return hitRegion; },
        setHitRegion(rect) {
            if (JSON.stringify(hitRegion) === JSON.stringify(rect)) return;
            hitRegion = rect;
            for (const listener of layoutListeners) listener();
        },
        onLayout(listener) { layoutListeners.add(listener); return () => layoutListeners.delete(listener); },
    };
}

export function mountNavigation(folium, container, ctx, navigation) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const t = translator();
    const style = document.createElement('style');
    style.textContent =
        '.we-navigation{position:absolute;box-sizing:border-box;width:48px;height:48px;padding:0;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:rgba(0,0,0,.4);color:#fff;backdrop-filter:blur(12px);box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1);font:12px "Segoe UI","Microsoft YaHei UI",sans-serif;cursor:pointer;opacity:0;transition:opacity .2s ease-out,background-color .15s ease}' +
        '.we-navigation{transition:opacity .2s ease-out,background-color .15s ease,transform .3s ease}.we-navigation[data-daylight=true]{background:rgba(255,255,255,.7);color:#18181b}.we-navigation:hover{background:rgba(0,0,0,.55)}.we-navigation[data-daylight=true]:hover{background:rgba(255,255,255,.85)}' +
        '.we-navigation:focus-visible{outline:2px solid currentColor;outline-offset:3px}.we-navigation:disabled{cursor:wait}.we-navigation svg{width:var(--we-navigation-icon-size,20px);height:var(--we-navigation-icon-size,20px);transition:transform .15s ease}.we-navigation:active svg{transform:scale(.9)}' +
        '.we-navigation[data-desktop=true] [data-icon=monitor],.we-navigation[data-desktop=false] [data-icon=list-music]{display:none}' +
        '.we-navigation-label{position:absolute;right:calc(100% + 12px);top:50%;padding:6px 10px;border-radius:8px;white-space:nowrap;line-height:1.5;color:inherit;background:inherit;backdrop-filter:blur(12px);pointer-events:none;opacity:0;visibility:hidden;transform:translate(4px,-50%);transition:opacity .15s ease,transform .15s ease,visibility .15s}' +
        '.we-navigation:hover .we-navigation-label,.we-navigation:focus-visible .we-navigation-label{opacity:1;visibility:visible;transform:translate(0,-50%)}' +
        '@media(prefers-reduced-motion:reduce){.we-navigation,.we-navigation svg,.we-navigation-label{transition:none}}';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'we-navigation';
    const caption = document.createElement('span');
    caption.className = 'we-navigation-label';
    caption.setAttribute('aria-hidden', 'true');
    button.append(caption);
    container.append(style, button);
    let disposed = false;
    let nearby = false;
    let keyboardFocused = false;
    let touchTimer;
    for (const name of ['monitor', 'list-music']) {
        folium.ui.icon(name, { size:20 }).then(icon => {
            if (!icon || disposed) return;
            icon.dataset.icon = name;
            icon.setAttribute('aria-hidden', 'true');
            button.prepend(icon);
        });
    }
    let position = null;
    const nativeAnchor = observeNavigationAnchor(() => render());
    const render = () => {
        const display = ctx.getDisplay();
        caption.textContent = navigation.desktop ? t('chooseSong') : t('returnDesktop');
        button.setAttribute('aria-label', caption.textContent);
        button.dataset.desktop = String(navigation.desktop);
        button.dataset.daylight = String(ctx.getTheme().isDaylight);
        position = nativeAnchor.get();
        if (position) {
            button.style.left = position.left + 'px'; button.style.top = position.top + 'px';
            button.style.width = position.width + 'px'; button.style.height = position.height + 'px';
            button.style.backgroundColor = position.background; button.style.color = position.color; button.style.boxShadow = position.shadow;
            button.style.setProperty('--we-navigation-icon-size', (position.width === 40 ? 18 : 20) + 'px');
        }
        const unavailable = !position || position.blocked || display.isPlayerChromeHidden || display.isPanelOpen || display.visualizerOpacity === 0 || position.top < 0;
        navigation.setHitRegion(unavailable ? null : position);
        button.disabled = navigation.busy || unavailable;
        button.style.opacity = String(unavailable ? 0 : display.visualizerOpacity * (navigation.busy ? 0.4 : nearby || keyboardFocused ? 1 : 0.6));
        button.style.pointerEvents = unavailable ? 'none' : 'auto';
        button.setAttribute('aria-hidden', String(unavailable));
        button.tabIndex = unavailable ? -1 : 0;
    };
    const off = navigation.subscribe(render);
    const offDisplay = ctx.onChange(() => { nativeAnchor.refresh(); render(); });
    const offView = folium.events.on('app.viewChanged', () => nativeAnchor.refresh());
    const reveal = next => {
        if (nearby === next) return;
        nearby = next;
        render();
    };
    // Both circles share a reveal area, while their actual click targets stay separate.
    const move = event => reveal(Boolean(position && (
        (event.clientX >= innerWidth - 240 && event.clientY >= innerHeight - 200) ||
        (event.clientX >= position.left - position.revealPadding && event.clientX <= position.left + position.width + position.revealPadding
            && event.clientY >= position.top - position.revealPadding && event.clientY <= position.top + position.height * 2 + 12)
    )));
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
    const resized = () => { leave(); render(); };
    window.addEventListener('resize', resized);
    render();
    button.onclick = () => {
        const action = navigation.desktop ? navigation.leave() : navigation.enter();
        action.catch(error => folium.ui.toast(error.message, { type: 'error' }));
    };
    return () => {
        disposed = true;
        off(); offDisplay(); offView();
        nativeAnchor.dispose();
        navigation.setHitRegion(null);
        clearTimeout(touchTimer);
        window.removeEventListener('mousemove', move, true);
        window.removeEventListener('pointerdown', touch, true);
        window.removeEventListener('pointercancel', cancel, true);
        document.removeEventListener('mouseleave', leave);
        window.removeEventListener('blur', leave);
        window.removeEventListener('resize', resized);
        button.remove(); style.remove();
    };
}
