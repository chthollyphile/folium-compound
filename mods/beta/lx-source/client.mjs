import { createController } from './controller.mjs';
import { httpUrl, MAX_SCRIPT_BYTES } from './protocol.mjs';
import { t, text } from './text.mjs';

// Registers LX import and lifecycle commands using Folium's existing command forms and file picker.
export default async function activate(folium) {
    if (folium.env.context !== 'main') return;
    if (!folium.omni || folium.host.folium.minor < 7) throw new Error('LX adapter requires Folium 1.7');
    const controller = createController(folium);
    const consent = { key: 'consent', type: 'boolean', label: text.consent, description: text.consentHint, defaultValue: false };
    const requireConsent = values => {
        if (values?.consent !== true) throw new Error(t(text.consentRequired));
    };
    const register = (id, label, run, params) => folium.registries.commands.register({
        id, label, run, ...(params ? { params } : {}), keywords: ['LX', '洛雪', '音源', 'source'],
    });
    register('import-url', text.importUrl, async ({ values }) => {
        requireConsent(values);
        const response = await folium.net.fetch(httpUrl(String(values.url)), { timeoutMs: 20000 });
        if (!response.ok) throw new Error(`LX: script download HTTP ${response.status}`);
        return controller.import(response.text());
    }, [{ key: 'url', type: 'text', label: text.url, description: text.importHint, defaultValue: '' }, consent]);
    register('import-file', text.importFile, async ({ values }) => {
        requireConsent(values);
        const file = await folium.ui.pickFile({ accept: 'any' });
        if (!file) return t(text.cancelled);
        if (file.size > MAX_SCRIPT_BYTES) throw new Error('LX: script exceeds 256 KiB');
        const response = await fetch(file.url);
        if (!response.ok) throw new Error('LX: could not read script file');
        return controller.import(await response.text());
    }, [consent]);
    register('enable', text.enable, ({ values }) => { requireConsent(values); return controller.enable(); }, [consent]);
    register('disable', text.disable, controller.disable);
    register('remove', text.remove, controller.remove);
    register('status', text.status, controller.status);
    // Keep import/recovery commands available when a saved script cannot initialize.
    try { await controller.initialize(); }
    catch (error) { console.warn('[LxSource] Saved source could not initialize', error); }
    return () => controller.dispose();
}

