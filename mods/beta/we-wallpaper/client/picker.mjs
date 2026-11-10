import { translator } from './labels.mjs';
import { styles } from './styles.mjs';
import { NATIVE_VERSION, isMainContext, callHost } from './support.mjs';

// Picker buttons leave generic settings controls to Folia's own schema renderer.
export function mountPicker(folium, container, ctx, selection, navigation) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const t = translator(ctx.locale);
    const root = document.createElement('div');
    root.className = 'we-native-picker';
    const style = document.createElement('style');
    style.textContent = styles;
    root.appendChild(style);
    const theme = ctx.getTheme();
    root.style.setProperty('--we-text', theme.primaryColor || '#f4f4f5');
    root.style.setProperty('--we-muted', theme.secondaryColor || '#a1a1aa');
    root.style.setProperty('--we-accent', theme.accentColor || '#91b3ff');
    root.style.setProperty('--we-line', 'color-mix(in srgb, var(--we-text) 16%, transparent)');
    root.style.setProperty('--we-surface', 'color-mix(in srgb, var(--we-text) 4%, transparent)');
    container.appendChild(root);
    let disposed = false;
    let snapshot;
    const make = (tag, className, text) => {
        const element = document.createElement(tag);
        element.className = className;
        if (text) element.textContent = text;
        return element;
    };
    const toolbar = make('div', 'we-native-toolbar');
    toolbar.append(make('strong', '', t('title')));
    const refresh = make('button', 'we-native-action', t('refresh'));
    refresh.type = 'button';
    toolbar.append(refresh);
    const desktop = make('button', 'we-native-action', t('desktop'));
    desktop.type = 'button';
    desktop.onclick = async () => {
        desktop.disabled = true;
        try {
            await navigation.enter();
        } catch (error) { status.textContent = error.message; }
        finally { desktop.disabled = false; }
    };
    toolbar.append(desktop);
    const status = make('div', 'we-native-status', t('loading'));
    status.setAttribute('role', 'status');
    const grid = make('div', 'we-native-grid');
    const options = make('div', 'we-native-options');
    root.append(toolbar, make('div', 'we-native-description', t('native')), status, grid, options);

    const set = patch => ctx.settings.set(patch);
    const stateText = state => {
        status.dataset.phase = state.phase;
        status.textContent = state.phase === 'streaming' ? t('ready') + ' · ' + state.width + ' × ' + state.height + ' · ' + state.fps + ' FPS'
            : state.phase === 'error' ? state.message : state.phase === 'opening' ? t('opening') : t('idle');
    };
    const switchButton = (key, text, defaultValue) => {
        const button = make('button', 'we-native-switch', text);
        button.type = 'button';
        button.setAttribute('role', 'switch');
        button.setAttribute('aria-checked', String(ctx.settings.get()[key] ?? defaultValue));
        button.onclick = () => set({ [key]: !(ctx.settings.get()[key] ?? defaultValue) });
        return button;
    };
    const render = () => {
        if (!snapshot) return;
        const settings = ctx.settings.get();
        const activeId = settings.followWE ? snapshot.selectedId || settings.source : settings.source;
        const active = snapshot.wallpapers.find(item => item.id === activeId);
        grid.replaceChildren();
        for (const wallpaper of snapshot.wallpapers) {
            const card = make('button', 'we-native-card');
            card.type = 'button';
            card.title = wallpaper.title;
            card.setAttribute('aria-pressed', String(wallpaper.id === activeId));
            const image = make('img', '');
            image.loading = 'lazy';
            image.alt = '';
            if (wallpaper.previewUrl) image.src = wallpaper.previewUrl;
            card.append(image, make('span', 'we-native-card-title', wallpaper.title), make('span', 'we-native-card-type', t(wallpaper.type)));
            card.onclick = () => set({ source: wallpaper.id, followWE: false, presetName: '' });
            grid.appendChild(card);
        }
        if (!snapshot.wallpapers.length) grid.append(make('div', 'we-native-description', t('empty')));
        options.replaceChildren();
        options.append(switchButton('followWE', t('follow'), true));
        const presets = make('div', 'we-native-option');
        presets.append(make('span', '', t('preset')));
        for (const value of ['', ...(active?.presets || [])]) {
            const button = make('button', '', value || t('saved'));
            button.type = 'button';
            button.setAttribute('aria-pressed', String((settings.presetName || '') === value));
            button.onclick = () => set({ presetName: value });
            presets.append(button);
        }
        const fps = make('div', 'we-native-option');
        fps.append(make('span', '', t('fps')));
        for (const value of [0, 30, 60]) {
            const button = make('button', '', value ? value + ' FPS' : t('original'));
            button.type = 'button';
            button.setAttribute('aria-pressed', String(Number(settings.fps || 0) === value));
            button.onclick = () => set({ fps: value });
            fps.append(button);
        }
        options.append(presets, fps, switchButton('interaction', t('interaction'), true), make('div', 'we-native-description', t('weSettings')));
        void selection(activeId, settings.presetName || '').catch(error => { if (!disposed) status.textContent = error.message; });
    };
    const load = async refreshLibrary => {
        status.textContent = t('loading');
        try {
            snapshot = await callHost(refreshLibrary ? 'refresh' : 'assets');
            if (disposed) return;
            render();
            stateText(snapshot.native || await callHost('status'));
        } catch (error) { if (!disposed) status.textContent = error.message; }
    };
    refresh.onclick = () => load(true);
    const stopSettings = ctx.settings.onChange(render);
    const stopStatus = folium.rpc.on('native-status', stateText);
    const stopSelection = folium.rpc.on('we-selection', ({ id }) => { if (snapshot) { snapshot.selectedId = id; render(); } });
    void load(false);
    return () => { disposed = true; stopSettings(); stopStatus(); stopSelection(); root.remove(); };
}
