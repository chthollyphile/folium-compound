import { label } from './client/labels.mjs';
import { styles } from './client/styles.mjs';
import { mountBackground } from './client/background.mjs';
import { mountPicker } from './client/picker.mjs';
import { createPropertySettings } from './client/properties.mjs';
import { createDesktopNavigation, mountNavigation } from './client/navigation.mjs';
import { NATIVE_VERSION, isMainContext, callHost } from './client/support.mjs';
import { watchOpaqueBackground } from './client/opaque.mjs';
import { mountDesktopInput } from './client/input.mjs';

// Keep the established background id so existing Folia selections continue to work.
export default function activate(folium) {
    if (!isMainContext(folium) || window.foliaWeNative?.version !== NATIVE_VERSION) return;
    const navigation = createDesktopNavigation(folium);
    watchOpaqueBackground(folium);
    folium.registries.styles.register({ id: 'native-wallpaper', css: styles });
    const properties = createPropertySettings(folium);
    folium.onDispose(() => properties.dispose());
    const settings = [
            { key: 'source', type: 'text', label: label('壁纸 ID', 'Wallpaper ID', 'ID wallpaper'), defaultValue: '' },
            { key: 'followWE', type: 'boolean', label: label('跟随 WE 当前壁纸', 'Follow the current WE wallpaper', 'Ikuti wallpaper WE saat ini'), defaultValue: true },
            { key: 'presetName', type: 'text', label: label('WE 预设', 'WE preset', 'Prasetel WE'), defaultValue: '' },
            { key: 'fps', type: 'number', label: label('画面帧率（0 沿用 WE）', 'Frame rate (0 uses WE)', 'Laju bingkai (0 memakai WE)'), defaultValue: 0, min: 0, max: 144, step: 1 },
            { key: 'interaction', type: 'boolean', label: label('壁纸鼠标交互', 'Wallpaper mouse interaction', 'Interaksi tetikus wallpaper'), defaultValue: true },
    ];
    let controls;
    const picker = (container, ctx) => mountPicker(folium, container, { ...ctx, settings: controls.settings }, (id, preset) => properties.select(id, preset), navigation);
    controls = folium.registries.settingsSections.register({
        id: 'wallpaper', label: label('WE 壁纸与预设', 'WE wallpapers and presets', 'Wallpaper dan prasetel WE'),
        settings, settingsPanel: picker,
    });
    folium.onDispose(folium.rpc.on('we-selection', () => {
        if (controls.settings.get().followWE) controls.settings.set({ presetName: '' });
    }));
    folium.registries.backgrounds.register({
        id: 'we-wallpaper',
        label: label('Wallpaper Engine 原生画面', 'Wallpaper Engine native', 'Wallpaper Engine asli'),
        order: 420,
        settings,
        settingsPanel: picker,
        mount: (container, ctx) => {
            const prior = ctx.getSettings();
            if (!controls.settings.get().source && prior.source) controls.settings.set(prior);
            return mountBackground(folium, container, {
                ...ctx, getSettings: () => controls.settings.get(),
                onNativeReady: () => navigation?.onNativeReady(),
                onNativeStopped: () => navigation?.onNativeStopped(),
                onChange: listener => {
                    const offContext = ctx.onChange(listener);
                    const offSettings = controls.settings.onChange(listener);
                    return () => { offContext(); offSettings(); };
                },
            });
        },
    });
    folium.registries.commands.register({
        id: 'show-on-desktop',
        label: label('回到 WE 歌词桌面', 'Return to WE lyric desktop', 'Kembali ke desktop lirik WE'),
        run: () => navigation.enter(),
    });
    folium.registries.commands.register({
        id: 'choose-song',
        label: label('打开选歌窗口', 'Open music library', 'Buka pustaka musik'),
        run: () => navigation.leave(),
    });
    if (navigation) folium.registries.stageLayers.register({
        id: 'desktop-navigation', slot: 'app.overlay', order: 100,
        mount: (container, ctx) => {
            const stopNavigation = mountNavigation(folium, container, ctx, navigation);
            const stopInput = mountDesktopInput(folium, ctx, navigation);
            return () => { stopInput(); stopNavigation?.(); };
        },
    });
    folium.registries.commands.register({
        id: 'refresh-we-wallpapers',
        label: label('刷新 WE 壁纸列表', 'Refresh WE wallpaper library', 'Muat ulang pustaka WE'),
        run: async () => { await callHost('refresh'); },
    });
}
