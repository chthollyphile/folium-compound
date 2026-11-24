import { translator } from './labels.mjs';
import { styles } from './styles.mjs';
import { NATIVE_VERSION, isMainContext, callHost } from './support.mjs';

// Keep wallpaper cards alive when only a preset, frame rate or interaction setting changes.
export function mountPicker(folium, container, ctx, selection, navigation) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const t = translator(ctx.locale);
    const root = document.createElement('div');
    root.className = 'we-native-picker';
    const style = document.createElement('style'); style.textContent = styles; root.append(style);
    const applyTheme = () => {
        const theme = ctx.getTheme();
        root.style.setProperty('--we-text', theme.primaryColor || '#f4f4f5');
        root.style.setProperty('--we-muted', theme.secondaryColor || '#a1a1aa');
        root.style.setProperty('--we-accent', theme.accentColor || '#91b3ff');
        root.style.setProperty('--we-line', 'color-mix(in srgb, var(--we-text) 16%, transparent)');
        root.style.setProperty('--we-surface', 'color-mix(in srgb, var(--we-text) 4%, transparent)');
    };
    applyTheme(); container.append(root);
    let disposed = false, snapshot, renderedLibrary, presetKey = '', loadSequence = 0;
    const cards = new Map(), presetButtons = new Map(), fpsButtons = new Map();
    const make = (tag, className, text) => {
        const element = document.createElement(tag); element.className = className;
        if (text) element.textContent = text;
        if (tag === 'button') element.type = 'button';
        return element;
    };
    const toolbar = make('div', 'we-native-toolbar');
    const refresh = make('button', 'we-native-action', t('refresh'));
    const desktop = make('button', 'we-native-action', t('desktop'));
    toolbar.append(make('strong', '', t('title')), refresh, desktop);
    const status = make('div', 'we-native-status', t('loading')); status.setAttribute('role', 'status');
    const grid = make('div', 'we-native-grid');
    const options = make('div', 'we-native-options');
    const follow = make('button', 'we-native-switch', t('follow')); follow.setAttribute('role','switch');
    const interaction = make('button', 'we-native-switch', t('interaction')); interaction.setAttribute('role','switch');
    const presets = make('div', 'we-native-option');
    const fps = make('div', 'we-native-option'); fps.append(make('span','',t('fps')));
    for (const value of [0,30,60,120,144]) {
        const button = make('button','',value ? value+' FPS' : t('original'));
        button.onclick = () => ctx.settings.set({fps:value}); fpsButtons.set(value,button); fps.append(button);
    }
    follow.onclick = () => ctx.settings.set({followWE:!ctx.settings.get().followWE});
    interaction.onclick = () => ctx.settings.set({interaction:!ctx.settings.get().interaction});
    options.append(follow,presets,fps,make('div','we-native-description',t('fpsHint')),interaction,make('div','we-native-description',t('weSettings')));
    root.append(toolbar,make('div','we-native-description',t('native')),status,grid,options);
    const stateText = state => {
        if (disposed) return;
        status.dataset.phase = state.phase;
        status.textContent = state.phase === 'streaming' ? t('ready')+' · '+state.width+' × '+state.height+' · '+t('fps')+' '+state.fps+' FPS'
            : state.phase === 'error' ? state.message : state.phase === 'opening' ? t('opening') : state.phase === 'paused' ? t('paused') : t('idle');
    };
    const updateNavigation = () => {
        if (disposed) return;
        desktop.textContent = navigation.desktop ? t('chooseSong') : t('desktop');
        desktop.disabled = navigation.busy;
    };
    desktop.onclick = () => (navigation.desktop ? navigation.leave() : navigation.enter()).catch(error => { if (!disposed) status.textContent = error.message; });
    const render = () => {
        if (!snapshot || disposed) return;
        const settings = ctx.settings.get();
        const activeId = settings.followWE ? snapshot.selectedId || settings.source : settings.source;
        const active = snapshot.wallpapers.find(item => item.id === activeId);
        if (renderedLibrary !== snapshot.wallpapers) {
            renderedLibrary = snapshot.wallpapers; cards.clear(); grid.replaceChildren();
            const fragment = document.createDocumentFragment();
            for (const wallpaper of snapshot.wallpapers) {
                const card = make('button','we-native-card'); card.title = wallpaper.title;
                const image = make('img',''); image.loading = 'lazy'; image.decoding = 'async'; image.alt = '';
                if (wallpaper.previewUrl) image.src = wallpaper.previewUrl;
                card.append(image,make('span','we-native-card-title',wallpaper.title),make('span','we-native-card-type',t(wallpaper.type)));
                card.onclick = () => ctx.settings.set({source:wallpaper.id,followWE:false,presetName:''});
                cards.set(wallpaper.id,card); fragment.append(card);
            }
            if (!cards.size) fragment.append(make('div','we-native-description',t('empty')));
            grid.append(fragment);
        }
        for (const [id,card] of cards) card.setAttribute('aria-pressed',String(id === activeId));
        const nextPresetKey = JSON.stringify([activeId,active?.presets]);
        if (nextPresetKey !== presetKey) {
            presetKey = nextPresetKey; presetButtons.clear(); presets.replaceChildren(make('span','',t('preset')));
            for (const value of ['',...(active?.presets || [])]) {
                const button = make('button','',value || t('saved'));
                button.onclick = () => ctx.settings.set({presetName:value}); presetButtons.set(value,button); presets.append(button);
            }
        }
        for (const [value,button] of presetButtons) button.setAttribute('aria-pressed',String((settings.presetName || '') === value));
        for (const [value,button] of fpsButtons) button.setAttribute('aria-pressed',String(Number(settings.fps || 0) === value));
        follow.setAttribute('aria-checked',String(settings.followWE)); interaction.setAttribute('aria-checked',String(settings.interaction));
        void selection(activeId,settings.presetName || '').catch(error => { if(!disposed) status.textContent = error.message; });
    };
    const load = async refreshLibrary => {
        const request = ++loadSequence; refresh.disabled = true; status.textContent = t('loading');
        try {
            const value = await callHost(folium, refreshLibrary ? 'refresh' : 'assets');
            if (disposed || request !== loadSequence) return;
            snapshot = value; render();
            const current = snapshot.native || await callHost(folium, 'status');
            if (request === loadSequence) stateText(current);
        } catch(error) { if(!disposed && request === loadSequence) status.textContent = error.message; }
        finally { if(!disposed && request === loadSequence) refresh.disabled = false; }
    };
    refresh.onclick = () => load(true);
    const offTheme = ctx.onChange(applyTheme), offSettings = ctx.settings.onChange(render);
    const offStatus = folium.rpc.on('native-status',stateText);
    const offSelection = folium.rpc.on('we-selection',({id}) => { if(snapshot){snapshot.selectedId=id;render();} });
    const offNavigation = navigation.subscribe(updateNavigation);
    updateNavigation(); void load(false);
    return () => { disposed = true; ++loadSequence; offTheme(); offSettings(); offStatus(); offSelection(); offNavigation(); root.remove(); };
}
