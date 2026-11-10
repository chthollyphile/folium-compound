import { translator } from './labels.mjs';
import { NATIVE_VERSION, isMainContext, isBackgroundSelected, liveBackgroundLayer, callHost } from './support.mjs';

const liveSurfaces = new WeakMap();

function stopSurface(surface) {
    ++surface.epoch;
    if (surface.attached || surface.attaching) surface.native?.detachCanvas(surface.id);
    surface.attached = false;
    surface.ready = false;
    surface.requestKey = '';
    surface.canvas.width = 1;
    surface.canvas.height = 1;
}

function liveSurface(folium) {
    let surface = liveSurfaces.get(folium);
    if (surface) return surface;
    const canvas = document.createElement('canvas');
    const id = crypto.randomUUID();
    canvas.id = 'we-native-' + id;
    surface = {
        canvas, id, native: window.foliaWeNative, attached: false, attaching: null,
        ready: false, requestKey: '', epoch: 0, owner: null, releaseTimer: null, ended: false,
        frameWidth: 1, frameHeight: 1,
    };
    liveSurfaces.set(folium, surface);
    folium.onDispose(() => {
        surface.ended = true;
        clearTimeout(surface.releaseTimer);
        stopSurface(surface);
        surface.owner = null;
        liveSurfaces.delete(folium);
    });
    return surface;
}

function mountPreview(folium, root, ctx, message) {
    const image = document.createElement('img');
    image.className = 'we-native-preview';
    root.prepend(image);
    let disposed = false;
    let snapshot;
    const render = () => {
        if (!snapshot || disposed) return;
        const settings = ctx.getSettings();
        const source = settings.followWE ? snapshot.selectedId || settings.source : settings.source;
        const wallpaper = snapshot.wallpapers.find(item => item.id === source);
        if (wallpaper?.previewUrl) {
            image.src = wallpaper.previewUrl;
            image.alt = wallpaper.title;
        } else image.removeAttribute('src');
    };
    const stopChange = ctx.onChange(render);
    const stopSelection = folium.rpc.on('we-selection', ({ id }) => {
        if (snapshot) { snapshot.selectedId = id; render(); }
    });
    callHost('assets').then(result => { snapshot = result; render(); })
        .catch(error => { if (!disposed) message.textContent = error.message; });
    return () => { disposed = true; stopChange(); stopSelection(); root.remove(); };
}

// Only the selected, unscaled player mount can own the shared GPU canvas.
export function mountBackground(folium, container, ctx) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const t = translator();
    const root = document.createElement('div');
    root.className = 'we-native-background';
    const message = document.createElement('div');
    message.className = 'we-native-message';
    root.append(message);
    container.append(root);
    const layer = liveBackgroundLayer(folium, container);
    if (!layer || layer.hasAttribute('inert')) return mountPreview(folium, root, ctx, message);

    const surface = liveSurface(folium);
    const canvas = surface.canvas;
    const native = surface.native;
    const consumerId = surface.id;
    let disposed = false;
    const owner = {
        active: () => !disposed && surface.owner === owner && container.isConnected
            && !layer.hasAttribute('inert') && isBackgroundSelected(folium),
    };
    clearTimeout(surface.releaseTimer);
    surface.owner = owner;
    root.prepend(canvas);
    let starting = false;
    let requested = false;
    let timer;
    let lastGeometry = '';
    let viewport;
    const error = value => { if (!disposed) message.textContent = value.message || String(value); };
    const stopLive = () => {
        clearTimeout(timer);
        requested = false;
        if (surface.owner !== owner || (!surface.attached && !surface.attaching && !surface.requestKey)) return;
        stopSurface(surface);
        ctx.onNativeStopped?.();
    };
    const status = state => {
        if (!owner.active() || !surface.attached) return;
        if (state.phase === 'streaming') {
            message.textContent = '';
            surface.frameWidth = state.width;
            surface.frameHeight = state.height;
            surface.ready = true;
            ctx.onNativeReady?.();
        } else if (state.phase === 'opening') message.textContent = t('opening');
        else if (state.phase === 'error') message.textContent = state.message;
    };
    const stopStatus = folium.rpc.on('native-status', status);

    const start = async () => {
        if (!owner.active()) { stopLive(); return; }
        if (!viewport || native?.version !== NATIVE_VERSION) return;
        if (starting) { requested = true; return; }
        requested = false;
        starting = true;
        try {
            if (!surface.attached) {
                if (!surface.attaching) {
                    const epoch = surface.epoch;
                    const attaching = native.attachCanvas(canvas.id, consumerId).then(() => {
                        if (surface.ended || epoch !== surface.epoch || !surface.owner?.active()) {
                            native.detachCanvas(consumerId);
                            return false;
                        }
                        surface.attached = true;
                        return true;
                    }).finally(() => { if (surface.attaching === attaching) surface.attaching = null; });
                    surface.attaching = attaching;
                }
                if (!await surface.attaching) { if (owner.active()) requested = true; return; }
            }
            if (!owner.active()) return;
            const settings = ctx.getSettings();
            const params = {
                consumerId, source: settings.source, followWE: settings.followWE,
                presetName: settings.presetName || '', fps: settings.fps || 0, viewport,
            };
            const key = JSON.stringify(params);
            if (surface.requestKey === key) {
                if (surface.ready) ctx.onNativeReady?.();
                return;
            }
            surface.requestKey = key;
            const epoch = surface.epoch;
            try {
                const state = await callHost('start', params);
                if (epoch === surface.epoch && surface.requestKey === key) status(state);
            } catch (value) {
                if (surface.requestKey === key) surface.requestKey = '';
                throw value;
            }
        } catch (value) { error(value); }
        finally {
            starting = false;
            if (requested && owner.active()) schedule();
        }
    };
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(start, 180);
    };
    const geometry = () => {
        const rect = container.getBoundingClientRect();
        const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height, innerWidth: window.innerWidth };
        if (next.width < 2 || next.height < 2) return;
        const key = JSON.stringify(next);
        if (key !== lastGeometry) { lastGeometry = key; viewport = next; schedule(); }
    };
    const stopResize = ctx.onResize(geometry);
    const stopChange = ctx.onChange(() => {
        if (!owner.active()) stopLive();
        else schedule();
    });
    let selected = owner.active();
    const selectionChanged = () => {
        const next = owner.active();
        if (next === selected) return;
        selected = next;
        if (next) { geometry(); schedule(); }
        else stopLive();
    };
    const observer = new MutationObserver(selectionChanged);
    observer.observe(layer, { attributes: true, attributeFilter: ['inert'] });
    const stopSelectionCheck = ctx.every(150, selectionChanged);
    const stopSelection = folium.rpc.on('we-selection', () => {
        if (ctx.getSettings().followWE && owner.active()) {
            surface.requestKey = '';
            schedule();
        }
    });
    window.addEventListener('resize', geometry);
    window.addEventListener('storage', selectionChanged);
    if (native?.version !== NATIVE_VERSION) message.textContent = t('reloadHint');
    else {
        if (!surface.ready) message.textContent = t('opening');
        else ctx.onNativeReady?.();
        geometry();
    }

    let lastMove = 0;
    let pointerDown = false;
    const forward = kind => event => {
        if (kind === 'move' && performance.now() - lastMove < 16) return;
        if (!surface.attached || !owner.active() || !ctx.getSettings().interaction) return;
        if ((kind === 'down' || kind === 'up') && event.button !== 0) return;
        const rect = container.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside && !(kind === 'up' && pointerDown)) return;
        const control = event.composedPath().some(target => target instanceof Element && target.matches('button,input,textarea,[role=button],[role=slider]'));
        if (kind !== 'move' && control && !(kind === 'up' && pointerDown)) return;
        if (kind === 'down') pointerDown = true;
        if (kind === 'up') pointerDown = false;
        lastMove = performance.now();
        const scale = Math.max(rect.width / surface.frameWidth, rect.height / surface.frameHeight);
        const offsetX = (rect.width - surface.frameWidth * scale) / 2;
        const offsetY = (rect.height - surface.frameHeight * scale) / 2;
        native.pointer({
            consumerId, kind, x: (event.clientX - rect.left - offsetX) / scale,
            y: (event.clientY - rect.top - offsetY) / scale,
            buttons: event.buttons, delta: kind === 'wheel' ? -Math.sign(event.deltaY) * 120 : 0,
        });
    };
    const handlers = [['pointermove', forward('move')], ['pointerdown', forward('down')], ['pointerup', forward('up')], ['wheel', forward('wheel')]];
    for (const [name, handler] of handlers) document.addEventListener(name, handler, { passive: true });

    return () => {
        disposed = true;
        clearTimeout(timer);
        observer.disconnect();
        stopResize(); stopChange(); stopSelection(); stopStatus(); stopSelectionCheck();
        window.removeEventListener('resize', geometry);
        window.removeEventListener('storage', selectionChanged);
        for (const [name, handler] of handlers) document.removeEventListener(name, handler);
        if (surface.owner === owner) {
            surface.owner = null;
            const release = () => {
                if (!surface.owner) { stopSurface(surface); ctx.onNativeStopped?.(); }
            };
            if (!isBackgroundSelected(folium) || layer.hasAttribute('inert')) release();
            else surface.releaseTimer = setTimeout(release, 250);
        }
        root.remove();
    };
}
