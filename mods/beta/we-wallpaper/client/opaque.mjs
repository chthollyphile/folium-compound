import { isBackgroundSelected, callHost } from './support.mjs';

// A selected background cannot be drawn while Folia's transparent-background setting is active.
export function watchOpaqueBackground(folium) {
    let changing = false;
    let disposed = false;
    let attempted = false;
    const sync = async () => {
        if (!isBackgroundSelected(folium)) { attempted = false; return; }
        if (changing || attempted || localStorage.getItem('transparent_player_background') !== 'true') return;
        try { folium.playback.getState(); }
        catch { return; }
        changing = true;
        attempted = true;
        try {
            const handoff = await callHost('capture-for-opaque');
            if (!handoff) return;
            if (disposed || !isBackgroundSelected(folium) || localStorage.getItem('transparent_player_background') !== 'true') {
                // Finish the handoff in the user's current mode if they changed the selection.
                const current = await window.electron.getWindowTransparentMode();
                await window.electron.setWindowTransparentMode(current, handoff);
                return;
            }
            localStorage.setItem('transparent_player_background', 'false');
            await window.electron.setWindowTransparentMode(false, handoff);
        } catch (error) {
            if (!disposed) folium.ui.toast(error.message, { type: 'error' });
        } finally { changing = false; }
    };
    const stop = folium.every(200, sync);
    folium.onDispose(() => { disposed = true; stop(); });
}
