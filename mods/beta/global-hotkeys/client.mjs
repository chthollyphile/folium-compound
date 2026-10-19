// global-hotkeys/client.mjs
// The mod's client entry, run in the main window's renderer: publishes the playback actions
// the OS-level hotkeys call, and draws the panel where those keys are recorded.

// 20 steps from silence to full: fine enough to feel continuous, coarse enough that a held key
// does not take a minute to cross the range.
const VOLUME_STEP = 0.05;

// One row per action. `defaultValue` must match the main entry's DEFAULTS: the schema owns the
// persisted value, main owns the fallback it uses before the panel has ever been opened.
const FIELDS = [
    { key: 'playPause', label: { 'zh-CN': '播放 / 暂停', en: 'Play / pause' }, defaultValue: 'Ctrl+Alt+Shift+Space' },
    { key: 'previous', label: { 'zh-CN': '上一曲', en: 'Previous track' }, defaultValue: 'Ctrl+Alt+Shift+A' },
    { key: 'next', label: { 'zh-CN': '下一曲', en: 'Next track' }, defaultValue: 'Ctrl+Alt+Shift+D' },
    { key: 'volumeUp', label: { 'zh-CN': '音量加', en: 'Volume up' }, defaultValue: 'Ctrl+Alt+Shift+W' },
    { key: 'volumeDown', label: { 'zh-CN': '音量减', en: 'Volume down' }, defaultValue: 'Ctrl+Alt+Shift+S' },
];

// `event.code` names Electron's accelerator keys differently for the ones that are not a single
// character. Anything not listed and not A-Z / 0-9 / F1-F24 is refused rather than guessed.
const CODE_NAMES = {
    ArrowUp: 'Up',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowDown: 'Down',
    NumpadAdd: 'Plus',
    NumpadSubtract: '-',
    NumpadMultiply: '*',
    NumpadDivide: '/',
    NumpadDecimal: '.',
    NumpadEnter: 'Enter',
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Space: 'Space',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    PrintScreen: 'PrintScreen',
};

const MODIFIER_CODES = new Set([
    'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight',
]);

// `globalShortcut.isRegistered` only sees keys this process registered (the host and other mods),
// so an accelerator another program owns fails in register() instead, not here.
const REASON_TEXT = {
    occupied: '已被 Folia 或其他模组占用',
    'register-failed': '可能被其他程序或输入法占用',
    duplicate: '和另一个动作重复',
    empty: '没有设置',
};

/** `event` -> Electron accelerator, or null when this key cannot be one. */
const toAccelerator = (event) => {
    if (MODIFIER_CODES.has(event.code)) {
        return null;
    }

    const mods = [];
    if (event.ctrlKey) mods.push('Ctrl');
    if (event.altKey) mods.push('Alt');
    if (event.shiftKey) mods.push('Shift');
    if (event.metaKey) mods.push('Meta');

    const code = event.code;
    let key = null;
    if (/^Key[A-Z]$/.test(code)) {
        key = code.slice(3);
    } else if (/^Digit[0-9]$/.test(code)) {
        key = code.slice(5);
    } else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
        key = code;
    } else if (CODE_NAMES[code]) {
        key = CODE_NAMES[code];
    }
    if (!key) {
        return null;
    }

    // A bare letter or digit would be taken from every other program for the whole session;
    // an F-key alone is harmless.
    if (mods.length === 0 && !/^F\d+$/.test(key)) {
        return null;
    }

    return [...mods, key].join('+');
};

export default function activate(folium) {
    // The export window loads every mod too; there is no player there, and publishing would
    // make the main entry pick the wrong window.
    if (folium.env.context !== 'main') {
        return;
    }

    // Playback calls may be asynchronous and may fail (nothing playing, a disabled control): a
    // rejection must be logged rather than left to the host's generic fault report.
    const safe = (name, run) => {
        try {
            const result = run();
            if (result && typeof result.then === 'function') {
                result.then(undefined, (error) => folium.log.warn(`playback.${name} 失败`, error));
            }
        } catch (error) {
            folium.log.warn(`playback.${name} 失败`, error);
        }
    };

    const changeVolume = (delta) => {
        const { volume, muted } = folium.playback.getVolume();
        const next = Math.min(1, Math.max(0, Math.round((volume + delta) * 100) / 100));
        safe('setVolume', () => folium.playback.setVolume(next));
        // Raising the volume on a muted player stays silent otherwise, which reads as a broken key.
        if (muted && next > 0) {
            safe('setMuted', () => folium.playback.setMuted(false));
        }
        try {
            folium.ui.toast(`音量 ${Math.round(next * 100)}%`, { type: 'info', durationMs: 900 });
        } catch {
            // A toast is a courtesy; never let it break the key.
        }
    };

    window.__foliaHotkey = {
        playPause: () => safe('toggle', () => folium.playback.toggle()),
        previous: () => safe('previous', () => folium.playback.previous()),
        next: () => safe('next', () => folium.playback.next()),
        volumeUp: () => changeVolume(VOLUME_STEP),
        volumeDown: () => changeVolume(-VOLUME_STEP),
    };

    folium.onDispose(() => {
        delete window.__foliaHotkey;
    });

    const section = folium.registries.settingsSections.register({
        id: 'keys',
        label: { 'zh-CN': '全局快捷键', en: 'Global hotkeys' },
        description: {
            'zh-CN': '点一个键位再按下新组合，松开即生效并保存。至少要用一个修饰键（F1–F24 除外）。',
            en: 'Click a shortcut, then press the new combination. A modifier is required (except F1–F24).',
        },
        settings: FIELDS.map((field) => ({
            key: field.key,
            type: 'text',
            label: field.label,
            defaultValue: field.defaultValue,
        })),
        // The host-rendered text field would never tell the mod a value changed, and a hotkey has
        // to be recorded rather than typed, so the form is drawn here while `settings` above still
        // owns persistence and validation.
        settingsPanel: (container, ctx) => mountPanel(container, ctx, folium),
    });

    // The schema owns the persisted values, and importing a visual config writes them, while the
    // main entry only ever sees what was pushed to it. Pushing once here keeps the two in step
    // without waiting for the panel to be opened and a key to be pressed again.
    try {
        const access = section && section.settings;
        if (access) {
            pushBindings(folium, access.get());
            access.onChange(() => pushBindings(folium, access.get()));
        }
    } catch (error) {
        folium.log.warn('读取设置区块的键位失败，沿用上次保存的键位', error);
    }
}

/** Offers a whole binding set to the main entry; a failure is logged, not surfaced here. */
function pushBindings(folium, values) {
    try {
        const pending = folium.rpc.call('rebind', { ...values });
        if (pending && typeof pending.then === 'function') {
            pending.then(undefined, (error) => folium.log.warn('同步键位失败', error));
        }
    } catch (error) {
        folium.log.warn('同步键位失败', error);
    }
}

function mountPanel(container, ctx, folium) {
    const theme = ctx.getTheme();

    const root = document.createElement('div');
    root.style.cssText = [
        'display:flex', 'flex-direction:column', 'gap:10px',
        'font:13px/1.5 system-ui, sans-serif',
        `color:${theme.primaryColor}`,
    ].join(';');
    container.appendChild(root);

    const rows = new Map();
    let recording = null; // { field, finish }

    const status = document.createElement('div');
    status.style.cssText = `font-size:12px;opacity:.75;color:${theme.secondaryColor}`;
    status.textContent = '';

    const setStatus = (text, isError) => {
        status.textContent = text;
        status.style.color = isError ? '#ff6b6b' : theme.secondaryColor;
    };

    // Re-offers the whole current set to the main entry and reports what did not take.
    const rebind = async () => {
        const values = { ...ctx.settings.get() };
        let failed;
        try {
            failed = await folium.rpc.call('rebind', values);
        } catch (error) {
            folium.log.warn('重新注册全局键失败', error);
            setStatus('重新注册失败，详见模组面板日志', true);
            return null;
        }
        return Array.isArray(failed) ? failed : [];
    };

    const commit = async (field, accelerator, previous) => {
        ctx.settings.set({ [field.key]: accelerator });
        const failed = await rebind();
        if (failed === null) {
            return;
        }
        const mine = failed.find((entry) => entry && entry.action === field.key);
        if (mine) {
            // Put the old key back: leaving a key the OS refused registered would make the row
            // claim something that is not true.
            ctx.settings.set({ [field.key]: previous });
            await rebind();
            setStatus(`${accelerator} ${REASON_TEXT[mine.reason] ?? '无法注册'}`, true);
        } else {
            setStatus(`${accelerator} 已生效`, false);
        }
    };

    const startRecording = (field, button, previous) => {
        if (recording) {
            recording.finish();
        }
        const label = button.textContent;
        button.textContent = '按下组合…';
        button.style.borderColor = theme.accentColor;

        const onKeyDown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
                finish();
                setStatus('已取消', false);
                return;
            }
            const accelerator = toAccelerator(event);
            if (!accelerator) {
                setStatus('这个键不支持，或缺少修饰键', true);
                return;
            }
            finish();
            void commit(field, accelerator, previous);
        };

        const finish = () => {
            window.removeEventListener('keydown', onKeyDown, true);
            button.textContent = label;
            button.style.borderColor = theme.secondaryColor;
            recording = null;
        };

        window.addEventListener('keydown', onKeyDown, true);
        recording = { field, finish };
        setStatus('按下新的组合，Esc 取消', false);
    };

    const render = () => {
        const values = ctx.settings.get();
        for (const [fieldKey, entry] of rows) {
            const value = values[fieldKey];
            entry.button.textContent = typeof value === 'string' && value ? value : '未设置';
        }
    };

    for (const field of FIELDS) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;justify-content:space-between';

        const name = document.createElement('span');
        const localized = field.label[ctx.locale] ?? field.label['zh-CN'];
        name.textContent = String(localized ?? field.key);

        const button = document.createElement('button');
        button.type = 'button';
        button.style.cssText = [
            'min-width:180px', 'padding:6px 10px', 'border-radius:6px',
            `border:1px solid ${theme.secondaryColor}`, 'background:transparent',
            `color:${theme.primaryColor}`, 'font:inherit', 'cursor:pointer',
        ].join(';');

        button.addEventListener('click', () => {
            const previous = ctx.settings.get()[field.key];
            startRecording(field, button, previous);
        });

        row.append(name, button);
        root.appendChild(row);
        rows.set(field.key, { button });
    }

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;align-items:center;gap:12px';

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '恢复默认';
    reset.style.cssText = [
        'padding:4px 10px', 'border-radius:6px', `border:1px solid ${theme.secondaryColor}`,
        'background:transparent', `color:${theme.primaryColor}`, 'font:inherit', 'cursor:pointer',
    ].join(';');
    reset.addEventListener('click', async () => {
        if (recording) {
            recording.finish();
        }
        ctx.settings.reset();
        const failed = await rebind();
        render();
        const hasFailure = Boolean(failed && failed.length > 0);
        setStatus(
            hasFailure ? `${failed.length} 个默认键无法注册（对照日志换一个）` : '已恢复默认',
            hasFailure,
        );
    });

    footer.append(reset, status);
    root.appendChild(footer);

    render();
    ctx.settings.onChange(render);

    return () => {
        if (recording) {
            recording.finish();
        }
        root.remove();
    };
}
