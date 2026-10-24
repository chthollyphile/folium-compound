// global-hotkeys/index.cjs
// The mod's Node entry, run in Folia's main process: owns the OS-level hotkeys.
//
// The keys are data, not code: they live in this mod's data file (mods-data/<id>, outside the
// mod folder, so changing them does not invalidate the mod's approval) and are rebound at
// runtime over rpc. Every action is carried out by the client entry, which is the only side
// that can touch playback; a press is handed to it with `api.rpc.send` (Folium 1.7), so nothing
// here touches a window, evaluates script in the page, or knows which window the client is in.

const { globalShortcut } = require('electron');

const STORAGE_KEY = 'bindings';

// Every action the client implements, with the accelerator it gets until the user picks one.
// The keys here are the contract with client.mjs: both sides name the same five actions.
const DEFAULTS = {
    playPause: 'Ctrl+Alt+Shift+Space',
    previous: 'Ctrl+Alt+Shift+A',
    next: 'Ctrl+Alt+Shift+D',
    volumeUp: 'Ctrl+Alt+Shift+W',
    volumeDown: 'Ctrl+Alt+Shift+S',
};

module.exports = async (api) => {
    // accelerator -> action, for exactly the keys this mod registered: releasing must never
    // touch a key the host or another mod owns.
    const owned = new Map();

    const release = () => {
        for (const accelerator of owned.keys()) {
            globalShortcut.unregister(accelerator);
        }
        owned.clear();
    };

    // Registers one whole set of bindings, replacing whatever was registered before. Answers the
    // failures so the settings panel can say which key did not take, instead of leaving the user
    // pressing a key that does nothing.
    const apply = (bindings) => {
        release();

        const source = bindings && typeof bindings === 'object' ? bindings : {};
        const failed = [];
        const taken = new Set();

        for (const action of Object.keys(DEFAULTS)) {
            const raw = source[action];
            const accelerator = typeof raw === 'string' ? raw.trim() : '';
            if (!accelerator) {
                failed.push({ action, accelerator: '', reason: 'empty' });
                continue;
            }
            if (taken.has(accelerator)) {
                failed.push({ action, accelerator, reason: 'duplicate' });
                continue;
            }
            taken.add(accelerator);

            // Another app already owns it: register() would return false with no explanation.
            if (globalShortcut.isRegistered(accelerator)) {
                failed.push({ action, accelerator, reason: 'occupied' });
                continue;
            }

            // A throw from this callback is an uncaught exception in the main process; the host
            // only guards promise rejections, so nothing may escape.
            const registered = globalShortcut.register(accelerator, () => {
                Promise.resolve()
                    .then(() => api.rpc.send('action', action))
                    .catch((error) => api.log.error(`${accelerator} 处理失败`, error));
            });

            if (registered) {
                owned.set(accelerator, action);
            } else {
                failed.push({ action, accelerator, reason: 'register-failed' });
            }
        }

        const total = Object.keys(DEFAULTS).length;
        api.log.info(`已注册 ${owned.size}/${total} 个全局键`, [...owned.keys()].join(', ') || '(none)');
        return failed;
    };

    // The stored set is the one that survives a restart. Reading it needs `filesystem.data`;
    // without it, or with a broken file, the defaults still work.
    let stored = null;
    try {
        stored = await api.storage.get(STORAGE_KEY);
    } catch (error) {
        api.log.warn('读取已保存的键位失败，改用默认键位', error);
    }

    apply({ ...DEFAULTS, ...(stored && typeof stored === 'object' ? stored : {}) });

    // The panel calls this after every change. Writing here rather than in the client keeps a
    // single writer for the data file.
    api.rpc.handle('rebind', (bindings) => {
        const next = bindings && typeof bindings === 'object' ? bindings : {};
        api.storage.set(STORAGE_KEY, next).catch((error) => api.log.warn('保存键位失败', error));
        return apply({ ...DEFAULTS, ...next });
    });

    return release;
};
