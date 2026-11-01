import { createRuntime } from './runtime.mjs';
import { createProvider } from './provider.mjs';
import { PLATFORMS, scriptInfo } from './protocol.mjs';
import { t, text } from './text.mjs';

// Serializes imports and lifecycle changes, keeping a failed replacement from discarding a working source.
export function createController(folium) {
    let current;
    let candidate;
    let saved;
    let stopped = false;
    let chain = Promise.resolve();
    const clear = () => {
        current?.abort.abort();
        current?.handles.forEach(handle => handle.unregister());
        current?.runtime.dispose();
        current = undefined;
    };
    const serialize = action => {
        const next = chain.then(() => {
            if (stopped) throw new Error('LX: mod stopped');
            return action();
        });
        chain = next.catch(() => {});
        return next;
    };
    async function enable(rawScript) {
        scriptInfo(rawScript);
        candidate = createRuntime(folium, rawScript);
        const runtime = candidate;
        try {
            const sources = await runtime.ready;
            if (stopped) throw new Error('LX: mod stopped');
            const hosts = folium.omni.listProviders().filter(provider => provider.origin === 'host' && provider.supports.search);
            const supported = Object.keys(sources).filter(source => hosts.some(host => host.providerId === PLATFORMS[source]));
            if (!supported.length) throw new Error('LX: no supported catalog provider in this host');
            const abort = new AbortController();
            const definitions = supported.map(source => {
                const host = hosts.find(item => item.providerId === PLATFORMS[source]);
                return createProvider(folium, runtime, source, sources[source], host.displayName, abort.signal);
            });
            const previous = current;
            previous?.handles.forEach(handle => handle.unregister());
            current = { runtime, abort, definitions, handles: [], platforms: supported };
            try {
                for (const definition of definitions) current.handles.push(folium.experimental['omni.providers'].register(definition));
                // Persist a copy, never a URL to execute changing remote code on the next launch.
                await folium.storage.set('source', { rawScript, enabled: true, confirmed: true });
                if (stopped) throw new Error('LX: mod stopped');
            } catch (error) {
                clear();
                if (previous && !stopped) {
                    current = previous;
                    current.handles = [];
                    for (const definition of previous.definitions) current.handles.push(folium.experimental['omni.providers'].register(definition));
                } else { previous?.abort.abort(); previous?.runtime.dispose(); }
                throw error;
            }
            previous?.abort.abort();
            previous?.runtime.dispose();
            saved = { rawScript, enabled: true, confirmed: true };
            console.info('[LxSource] Source enabled', { platforms: supported });
            return `${runtime.info.name}: ${t(text.enabled)} (${supported.join(', ')})`;
        } catch (error) {
            if (current?.runtime === runtime) clear();
            runtime.dispose();
            throw error;
        } finally { candidate = undefined; }
    }
    return {
        initialize: () => serialize(async () => {
            saved = await folium.storage.get('source');
            if (saved?.enabled && saved.confirmed === true) return enable(saved.rawScript);
        }),
        import: rawScript => serialize(() => enable(rawScript)),
        enable: () => serialize(() => {
            if (!saved?.rawScript) throw new Error(t(text.empty));
            return enable(saved.rawScript);
        }),
        disable: () => serialize(async () => {
            if (saved) { saved = { ...saved, enabled: false }; await folium.storage.set('source', saved); }
            clear();
            console.info('[LxSource] Source disabled');
            return t(text.disabled);
        }),
        remove: () => serialize(async () => {
            await folium.storage.delete('source');
            saved = undefined;
            clear();
            console.info('[LxSource] Source removed');
            return t(text.removed);
        }),
        status: () => current?.runtime.active ? `${current.runtime.info.name} (${current.platforms.join(', ')})` : t(saved ? text.disabled : text.empty),
        dispose() { stopped = true; candidate?.dispose(); clear(); },
    };
}

