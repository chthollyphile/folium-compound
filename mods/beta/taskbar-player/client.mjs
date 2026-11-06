// taskbar-player / client.mjs
// Renderer half of the mod. It feeds the controller window its cover art and
// liked state, runs the playback commands the window sends back, and renders
// the mod's settings.

const SETTINGS_SCHEMA = [
    {
        key: 'enabled',
        type: 'boolean',
        label: { 'zh-CN': '启用任务栏控制器', en: 'Enable the taskbar controller' },
        defaultValue: true,
    },
    {
        key: 'showLyric',
        type: 'boolean',
        label: { 'zh-CN': '显示当前歌词', en: 'Show the current lyric line' },
        defaultValue: true,
    },
    {
        key: 'hideWhenPaused',
        type: 'boolean',
        label: { 'zh-CN': '暂停时隐藏', en: 'Hide while paused' },
        defaultValue: false,
    },
    {
        key: 'width',
        type: 'number',
        label: { 'zh-CN': '宽度', en: 'Width' },
        defaultValue: 380,
        min: 260,
        max: 900,
        step: 10,
    },
    {
        key: 'rightOffset',
        type: 'number',
        label: { 'zh-CN': '距屏幕右边缘', en: 'Distance from the right edge' },
        defaultValue: 300,
        min: 0,
        max: 2000,
        step: 10,
    },
    {
        key: 'offsetY',
        type: 'number',
        label: { 'zh-CN': '垂直微调', en: 'Vertical nudge' },
        defaultValue: 0,
        min: -30,
        max: 30,
        step: 1,
    },
    {
        key: 'opacity',
        type: 'number',
        label: { 'zh-CN': '不透明度', en: 'Opacity' },
        defaultValue: 0.92,
        min: 0.3,
        max: 1,
        step: 0.01,
    },
    {
        key: 'lyricOffsetMs',
        type: 'number',
        label: { 'zh-CN': '歌词偏移（毫秒）', en: 'Lyric offset (ms)' },
        defaultValue: 0,
        min: -3000,
        max: 3000,
        step: 50,
    },
];

const PANEL_CSS = `
.tp-settings { display: flex; flex-direction: column; gap: 10px; padding: 4px 2px 8px; }
.tp-row { display: flex; align-items: center; gap: 12px; min-height: 30px; }
.tp-row > label { flex: 1 1 auto; font-size: 13px; color: var(--folium-secondary, rgba(255,255,255,.75)); }
.tp-row input[type="range"] { flex: 0 0 170px; accent-color: var(--folium-accent, #7c8cff); }
.tp-row input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--folium-accent, #7c8cff); }
.tp-value { width: 64px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--folium-primary, #fff); opacity: .8; }
.tp-note { font-size: 12px; line-height: 18px; color: var(--folium-secondary, rgba(255,255,255,.55)); }
`;

const pick = (label, locale) => (label && typeof label === 'object' ? label[locale] ?? label['zh-CN'] ?? label.en : label) ?? '';

export default function activate(folium) {
    if (folium.env.context !== 'main') return undefined;

    const pushConfig = (values) => {
        folium.rpc.call('config', values).catch(() => {});
    };

    const pushMeta = () => {
        let state = null;
        try {
            state = folium.playback.getState();
        } catch {
            return;
        }
        const song = state?.song ?? null;
        let cover = null;
        if (song && folium.omni) {
            try {
                const details = folium.omni.describeSong(song);
                if (details && typeof details.coverUrl === 'string') cover = details.coverUrl;
            } catch {
                cover = null;
            }
        }
        folium.rpc
            .call('state', {
                cover,
                liked: Boolean(state?.liked),
                canLike: Boolean(state?.canLike),
            })
            .catch(() => {});
    };

    pushMeta();
    folium.events.on('playback.songChanged', pushMeta);
    folium.events.on('playback.likeChanged', pushMeta);

    // Commands the controller window sends from the taskbar. The main entry
    // pushes them and also queues them; each command carries an id so the push
    // and the poll cannot run the same press twice.
    const seenCommands = new Set();
    const runCommand = (item) => {
        const name = typeof item === 'string' ? item : item?.name;
        const id = item && typeof item === 'object' ? item.id : null;
        if (!name) return;
        if (id != null) {
            if (seenCommands.has(id)) return;
            seenCommands.add(id);
            if (seenCommands.size > 200) seenCommands.clear();
        }
        try {
            if (name === 'toggle') folium.playback.toggle();
            else if (name === 'next') folium.playback.next();
            else if (name === 'previous' || name === 'prev') folium.playback.previous();
            else if (name === 'like') folium.playback.toggleLike();
        } catch (error) {
            folium.log.error('taskbar-player: playback command failed', error?.message);
        }
        pushMeta();
    };

    const pollCommands = () => {
        folium.rpc
            .call('pollCommands')
            .then((list) => {
                if (Array.isArray(list)) list.forEach(runCommand);
            })
            .catch(() => {});
    };

    if (typeof folium.rpc.on === 'function') folium.rpc.on('command', runCommand);
    pollCommands();
    folium.every(300, pollCommands);
    folium.every(5000, () => {
        folium.rpc.call('heartbeat').catch(() => {});
    });

    const settingsHandle = folium.registries.settingsSections.register({
        id: 'settings',
        label: { 'zh-CN': '任务栏播放器', en: 'Taskbar player' },
        description: {
            'zh-CN': '控制器叠在 Windows 任务栏上，跟随 Folia 正在播放的歌曲。',
            en: 'The controller floats over the Windows taskbar and follows what Folia plays.',
        },
        settings: SETTINGS_SCHEMA,
        settingsPanel(container, panelCtx) {
            const locale = panelCtx.locale || 'zh-CN';
            const style = document.createElement('style');
            style.textContent = PANEL_CSS;
            const root = document.createElement('div');
            root.className = 'tp-settings';
            container.append(style, root);

            const rows = new Map();
            for (const field of SETTINGS_SCHEMA) {
                const row = document.createElement('div');
                row.className = 'tp-row';
                const label = document.createElement('label');
                label.textContent = pick(field.label, locale);
                let input;
                let valueText = null;
                if (field.type === 'boolean') {
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.addEventListener('change', () => panelCtx.settings.set({ [field.key]: input.checked }));
                    row.append(label, input);
                } else {
                    input = document.createElement('input');
                    input.type = 'range';
                    input.min = String(field.min);
                    input.max = String(field.max);
                    input.step = String(field.step);
                    input.addEventListener('input', () => {
                        panelCtx.settings.set({ [field.key]: Number(input.value) });
                    });
                    valueText = document.createElement('span');
                    valueText.className = 'tp-value';
                    row.append(label, input, valueText);
                }
                root.append(row);
                rows.set(field.key, { row, input, valueText, field });
            }

            const note = document.createElement('div');
            note.className = 'tp-note';
            note.textContent =
                locale === 'zh-CN'
                    ? '位置按 100% 缩放计算；不同缩放或任务栏位置下可用「垂直微调」和「距屏幕右边缘」对齐。'
                    : 'Positions are in CSS pixels; use the nudge and right-edge options to line it up on other scaling or taskbar placements.';
            root.append(note);

            const render = () => {
                const values = panelCtx.settings.get();
                for (const field of SETTINGS_SCHEMA) {
                    const entry = rows.get(field.key);
                    if (!entry) continue;
                    const value = values[field.key];
                    if (field.type === 'boolean') {
                        entry.input.checked = value !== false;
                    } else {
                        entry.input.value = String(value);
                        if (entry.valueText) {
                            entry.valueText.textContent = field.key === 'opacity' ? `${Math.round(Number(value) * 100)}%` : String(value);
                        }
                    }
                }
            };

            render();
            // The main entry keeps the authoritative copy in the mod data, so
            // the panel starts from it instead of from the host's schema
            // defaults (the two only differ when the panel was never opened).
            folium.storage
                .get('config')
                .then((stored) => {
                    if (stored && typeof stored === 'object') panelCtx.settings.set(stored);
                })
                .catch(() => {})
                .finally(() => {
                    render();
                    pushConfig(panelCtx.settings.get());
                });
            const offChange = panelCtx.settings.onChange(() => {
                render();
                pushConfig(panelCtx.settings.get());
            });
            return () => {
                offChange();
                style.remove();
                root.remove();
            };
        },
    });

    try {
        folium.registries.commands.register({
            id: 'toggle-controller',
            label: { 'zh-CN': '显示 / 隐藏任务栏播放器', en: 'Show / hide the taskbar player' },
            description: { 'zh-CN': '临时隐藏或重新显示任务栏上的控制器。', en: 'Temporarily hide or show the taskbar controller.' },
            globalShortcut: true,
            run() {
                return folium.rpc.call('toggleVisible');
            },
        });
    } catch {
        /* commands registry is stable; ignore hosts without it */
    }

    return () => {
        settingsHandle.unregister();
    };
}
