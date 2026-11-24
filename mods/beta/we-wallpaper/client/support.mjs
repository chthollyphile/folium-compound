// Official Folia mounts identify previews in the DOM; staticMode also changes on the live player.
export const NATIVE_VERSION = '0.4.8';

export function callHost(folium, name, ...args) {
    return folium.rpc.call(name, window.foliaWeNative.rpcSession, ...args);
}

export const isMainContext = folium => folium.env.context === 'main';
export const backgroundMode = folium => 'mod:' + folium.modId + ':we-wallpaper';
export const isBackgroundSelected = folium => localStorage.getItem('visualizer_background_mode') === backgroundMode(folium);

export function liveBackgroundLayer(folium, container) {
    if (!isMainContext(folium) || container.closest('[data-picture]')) return null;
    for (let node = container; node; node = node.parentElement) {
        if (node.style.contain === 'strict' && node.style.transform.startsWith('scale(')) return null;
    }
    const layer = container.closest('[data-visualizer-background]');
    return layer?.getAttribute('data-visualizer-background') === backgroundMode(folium) ? layer : null;
}
