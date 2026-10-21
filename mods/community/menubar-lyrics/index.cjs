// index.cjs — Node entry of the menubar-lyrics mod.
//
// A single, text-only status item sits in the macOS menu bar:
//
//   一首歌的当前歌词（超宽时滚动，暂停时以省略号收尾）
//
// There is deliberately no glyph next to it — the lyric alone is the status
// item, exactly like QQ Music's menu bar lyric. Clicking it opens the menu:
// playback controls plus the lyric settings.
//
// Everything comes from Folium's public mod surface:
//   - `api.runtime.getPlaybackSnapshot()` (playback.read) for the lyric lines
//   - `api.rpc.handle()` for the client ↔ main channel: the client entry keeps
//     a pending call and performs the playback commands with `folium.playback.*`
//     (playback.control)
//   - `api.storage` (filesystem.data) for the settings
// plus plain Electron (Tray / Menu / BrowserWindow), which a Node entry may use.
//
// Folium disposes the mod when it is disabled, reloaded, or the app quits; every
// timer, tray and listener created here is released in the disposer below.

'use strict';

const path = require('path');
const {
    app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen,
} = require('electron');

const SETTINGS_KEY = 'settings';

// The width is the width of the lyric text itself, not of the whole status item:
// short lines are centred inside it, long ones scroll (playing) or are cut with
// an ellipsis (paused).
const WIDTH_MIN = 60;
const WIDTH_MAX = 320;
const WIDTH_DEFAULT = 168;

const DEFAULTS = Object.freeze({
    enabled: true,
    showTranslation: false,
    widthPx: WIDTH_DEFAULT,
    // What the item shows while playback is paused: the current lyric line
    // (cut with an ellipsis) or the track itself, "歌名 - 歌手".
    pausedContent: 'lyric', // 'lyric' | 'title'
});

const MARQUEE_MS = 240;
const POLL_MS = 220;

const isMac = process.platform === 'darwin';

module.exports = async function activate(api) {
    if (!isMac) {
        api.log.warn('menubar-lyrics only draws in the macOS menu bar; nothing to do here');
        return;
    }

    // ----- settings -------------------------------------------------------
    let settings = { ...DEFAULTS };
    let saveTimer = null;

    const normalizeWidth = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return WIDTH_DEFAULT;
        return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, Math.round(num)));
    };

    const normalizePausedContent = (value) => (value === 'title' ? 'title' : 'lyric');

    const readStoredSettings = async () => {
        try {
            const stored = await api.storage.get(SETTINGS_KEY);
            if (!stored || typeof stored !== 'object') return;
            settings = {
                ...DEFAULTS,
                ...stored,
                widthPx: normalizeWidth(stored.widthPx),
                pausedContent: normalizePausedContent(stored.pausedContent),
            };
            // `iconSide` belonged to an early build that drew a note glyph next
            // to the lyric; the setting is gone and must not come back.
            delete settings.iconSide;
        } catch (error) {
            api.log.warn('could not read stored settings, using defaults', String(error));
        }
    };

    const persist = () => {
        if (saveTimer) clearTimeout(saveTimer);
        // Dragging the width slider fires dozens of updates per second.
        saveTimer = setTimeout(() => {
            saveTimer = null;
            api.storage.set(SETTINGS_KEY, settings).catch((error) => {
                api.log.warn('could not save settings', String(error));
            });
        }, 180);
    };

    const applySettings = (patch, { recreate = false } = {}) => {
        const before = settings;
        settings = { ...before, ...patch };
        persist();
        if (recreate || settings.enabled !== before.enabled) {
            buildTray();
        }
        appliedTitle = '';
        render();
        updateMenu(readSnapshot());
        pushSettingsState();
    };

    await readStoredSettings();

    // ----- measuring menu bar text ---------------------------------------
    // Menu bar text is ~13pt: a CJK glyph is about 13.8px wide, latin ~7.4px.
    // Counting characters alone made the width setting feel broken, so measure
    // in pixels the same way the earlier patch did.
    const charWidth = (ch) => {
        const code = ch.codePointAt(0);
        if (code === 0x20) return 4.2;
        if (code < 0x0080) return 7.4;
        const wide = code >= 0x1100 && (
            code <= 0x115f
            || (code >= 0x2e80 && code <= 0xa4cf)
            || (code >= 0xac00 && code <= 0xd7a3)
            || (code >= 0xf900 && code <= 0xfaff)
            || (code >= 0xfe30 && code <= 0xfe6f)
            || (code >= 0xff00 && code <= 0xff60)
            || (code >= 0xffe0 && code <= 0xffe6)
            || (code >= 0x1f300 && code <= 0x1faff)
        );
        return wide ? 13.8 : 8.2;
    };

    const textWidth = (text) => {
        let width = 0;
        for (const ch of text) width += charWidth(ch);
        return width;
    };

    const SPACE_WIDTH = 4.2;

    // The item keeps a constant width: otherwise the whole menu bar jitters on
    // every marquee frame and the click target moves under the pointer.
    const padToWidth = (text, target) => {
        const missing = target - textWidth(text);
        if (missing < SPACE_WIDTH) return text;
        return text + ' '.repeat(Math.floor(missing / SPACE_WIDTH));
    };

    const centre = (text, target) => {
        const missing = target - textWidth(text);
        if (missing < SPACE_WIDTH * 2) return padToWidth(text, target);
        const pad = ' '.repeat(Math.floor(missing / SPACE_WIDTH / 2));
        return pad + text + pad;
    };

    const truncateWithEllipsis = (text, target) => {
        if (textWidth(text) <= target) return text;
        let out = text;
        while (out.length > 1 && textWidth(`${out}…`) > target) {
            out = out.slice(0, -1);
        }
        return `${out}…`;
    };

    // take `maxWidth` px of text starting at `start`, wrapping around (marquee)
    const sliceFrom = (text, start, maxWidth) => {
        if (!text.length) return '';
        let out = '';
        let width = 0;
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[(start + i) % text.length];
            const w = charWidth(ch);
            if (out && width + w > maxWidth) break;
            out += ch;
            width += w;
        }
        return out;
    };

    // ----- lyric lookup ---------------------------------------------------
    const resolveLine = (lines, timeSec) => {
        if (!Array.isArray(lines) || lines.length === 0) return null;
        let current = null;
        let previous = null;
        for (const line of lines) {
            const start = typeof line?.startTime === 'number' ? line.startTime : -Infinity;
            const end = typeof line?.endTime === 'number' ? line.endTime : Infinity;
            if (timeSec + 0.35 >= start && timeSec < end) current = line;
            if (start <= timeSec) previous = line;
        }
        if (!current && previous) {
            const start = typeof previous.startTime === 'number' ? previous.startTime : 0;
            if (timeSec - start < 6) current = previous;
        }
        const text = typeof current?.fullText === 'string' ? current.fullText.trim() : '';
        return text ? { text, translation: typeof current.translation === 'string' ? current.translation.trim() : '' } : null;
    };

    // "歌名 - 歌手" for the paused state. The public song DTO is small, so read
    // the title/artist defensively — if it ever changes shape the lyric is used
    // instead of showing something empty.
    const composeSongTitle = (snapshot) => {
        const song = snapshot?.song;
        if (!song || typeof song !== 'object') return '';
        const name = String(song.name ?? song.title ?? '').trim();
        let artist = '';
        if (Array.isArray(song.artists)) {
            artist = song.artists
                .map((entry) => (entry && typeof entry === 'object' ? String(entry.name ?? '').trim() : String(entry ?? '').trim()))
                .filter(Boolean)
                .join(' / ');
        } else if (typeof song.artist === 'string') {
            artist = song.artist.trim();
        } else if (typeof song.artistName === 'string') {
            artist = song.artistName.trim();
        }
        if (!name) return artist;
        return artist ? `${name} - ${artist}` : name;
    };

    const composeText = (snapshot) => {
        const position = Number.isFinite(snapshot?.position) ? snapshot.position : 0;
        const offset = Number.isFinite(snapshot?.lyricOffsetMs) ? snapshot.lyricOffsetMs / 1000 : 0;
        const line = resolveLine(snapshot?.lines, Math.max(0, position - offset));
        if (!line) return null;
        if (settings.showTranslation && line.translation) {
            return `${line.text} ｜ ${line.translation}`;
        }
        return line.text;
    };

    // ----- status item ----------------------------------------------------
    // Only one item, and it carries no image: an empty (transparent) image keeps
    // macOS from drawing any glyph, so the menu bar shows the lyric text alone.
    const blankImage = nativeImage.createEmpty();
    if (isMac) {
        blankImage.setTemplateImage(true);
    }

    let lyricTray = null;
    let appliedTitle = '';
    let marqueeTimer = null;
    let marqueeOffset = 0;
    let marqueeKey = '';
    let lastSignature = '';
    let menu = null;

    const destroyTray = (tray) => {
        if (!tray) return;
        try {
            tray.removeAllListeners?.();
            tray.destroy();
        } catch (error) { /* already gone */ }
    };

    const buildTray = () => {
        destroyTray(lyricTray);
        lyricTray = null;
        appliedTitle = '';
        // A brand new status item has no menu attached: forget the last
        // signature so the next update really builds one.
        menu = null;
        lastSignature = '';

        lyricTray = new Tray(blankImage);
        lyricTray.setToolTip('Folia — 菜单栏歌词');
        updateMenu(readSnapshot());
    };

    const setTitle = (title) => {
        if (!lyricTray || lyricTray.isDestroyed()) return;
        if (appliedTitle === title) return;
        appliedTitle = title;
        try {
            lyricTray.setTitle(title, { fontType: 'monospacedDigit' });
        } catch (error) { /* torn down mid-frame */ }
    };

    const startMarquee = () => {
        if (marqueeTimer) return;
        marqueeTimer = setInterval(() => {
            marqueeOffset += 1;
            render();
        }, MARQUEE_MS);
    };

    const stopMarquee = () => {
        if (!marqueeTimer) return;
        clearInterval(marqueeTimer);
        marqueeTimer = null;
    };

    // Draws one frame and returns the snapshot it drew from, so the caller can
    // decide whether the menu needs rebuilding without reading it twice.
    const render = () => {
        if (!lyricTray || lyricTray.isDestroyed()) return null;

        let snapshot = null;
        try {
            snapshot = api.runtime.getPlaybackSnapshot();
        } catch (error) {
            api.log.warn('playback snapshot unavailable', String(error));
        }

        const hasTrack = Boolean(snapshot && snapshot.song);
        const playing = snapshot?.state === 'playing';

        if (!settings.enabled || !hasTrack) {
            stopMarquee();
            marqueeOffset = 0;
            marqueeKey = '';
            setTitle('');
            return snapshot;
        }

        const lyricText = composeText(snapshot);
        // Only swap in the track title while paused, and only when it exists.
        const songTitle = !playing && settings.pausedContent === 'title' ? composeSongTitle(snapshot) : '';
        const text = songTitle || lyricText;
        const width = normalizeWidth(settings.widthPx);

        if (!text) {
            stopMarquee();
            marqueeOffset = 0;
            marqueeKey = '';
            setTitle(centre('♪', width));
            return snapshot;
        }

        if (textWidth(text) > width) {
            if (!playing) {
                // Paused: never scroll — cut it and mark the cut with an ellipsis.
                stopMarquee();
                marqueeOffset = 0;
                marqueeKey = '';
                setTitle(padToWidth(truncateWithEllipsis(text, width), width));
                return snapshot;
            }
            const cycle = `${text}　·　`;
            const start = marqueeOffset % cycle.length;
            setTitle(padToWidth(sliceFrom(cycle, start, width), width));
            const key = `${width}|${text}`;
            if (marqueeKey !== key) {
                marqueeOffset = 0;
                marqueeKey = key;
            }
            startMarquee();
            return snapshot;
        }

        stopMarquee();
        marqueeOffset = 0;
        marqueeKey = '';
        setTitle(centre(text, width));
        return snapshot;
    };

    // ----- player window (only "打开 Folia" needs it) ----------------------
    // Our own settings panel is a `file://…/panel.html` window and is usually
    // the most recently focused one, so it must be skipped explicitly.
    const findMainWindow = () => {
        let fallback = null;
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win || win.isDestroyed()) continue;
            if (panel && win === panel) continue;
            let url = '';
            try {
                url = win.webContents.getURL();
            } catch (error) { /* ignore */ }
            if (!url || url.startsWith('data:') || url.startsWith('folia-mod:')) continue;
            if (/panel\.html([?#]|$)/.test(url)) continue;
            if (win.isFocused()) return win;
            if (!fallback) fallback = win;
        }
        return fallback;
    };

    // Playback commands run in the client entry, through the public
    // `folium.playback.*` API. main and client can only talk over the mod's own
    // RPC, so the client keeps one `folium.rpc.call()` pending and main resolves
    // it with a command. Nothing pokes the host window and no host IPC is used.
    const COMMAND_CHANNEL = 'menubar-lyrics.command';
    const queuedCommands = [];
    let commandWaiters = [];
    let clientSeen = false;

    api.rpc.handle(COMMAND_CHANNEL, () => {
        clientSeen = true;
        if (queuedCommands.length > 0) return { command: queuedCommands.shift() };
        return new Promise((resolve) => { commandWaiters.push(resolve); });
    });

    const dispatchCommand = (name) => {
        if (commandWaiters.length > 0) {
            const resolve = commandWaiters.shift();
            resolve({ command: name });
            return;
        }
        queuedCommands.push(name);
        // Keep the queue short: if nobody consumes it, the client half is not
        // running (disabled client entry, renderer reload) and piling up
        // commands would only fire them all at once later.
        if (queuedCommands.length > 8) queuedCommands.shift();
        if (!clientSeen) {
            api.log.warn('the client entry has not requested a command yet; playback controls are inactive until it does');
        }
    };

    // ----- menu ------------------------------------------------------------
    const readSnapshot = () => {
        try {
            return api.runtime.getPlaybackSnapshot();
        } catch (error) {
            return null;
        }
    };

    // No snapshot yet (right after launch) must not grey the controls out
    // forever: treat "unknown" as usable, the command simply does nothing.
    const menuStateOf = (snapshot) => ({
        hasTrack: !snapshot || Boolean(snapshot.song),
        playing: snapshot?.state === 'playing',
    });

    // Bring the player back to the front. `app.focus` is needed as well,
    // otherwise macOS only highlights the window without switching apps.
    const focusPlayerWindow = () => {
        setTimeout(() => {
            try {
                app.focus({ steal: true });
            } catch (error) { /* older Electron */ }
            const win = findMainWindow();
            if (!win) return;
            try {
                if (win.isMinimized()) win.restore();
                if (!win.isVisible()) win.show();
                win.focus();
            } catch (error) {
                api.log.warn('could not focus the player window', String(error));
            }
        }, 0);
    };

    const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

    // The first block of the menu is the current track (歌名 - 歌手), whatever
    // the playback state; clicking it opens Folia. While paused with "显示歌名"
    // enabled the menu bar already shows that same text, so the entry falls back
    // to a plain "打开 Folia" instead of repeating it.
    const menuTitleOf = (snapshot) => {
        const playing = snapshot?.state === 'playing';
        if (!playing && settings.pausedContent === 'title') return '打开 Folia';
        return shorten(composeSongTitle(snapshot), 48) || '打开 Folia';
    };

    const buildMenu = (snapshot) => {
        const { hasTrack, playing } = menuStateOf(snapshot);
        const template = [
            {
                label: menuTitleOf(snapshot),
                click: () => { focusPlayerWindow(); },
            },
            { type: 'separator' },
            {
                label: playing ? '暂停' : '播放',
                enabled: hasTrack,
                click: () => { void dispatchCommand('toggle'); },
            },
            {
                label: '上一曲',
                enabled: hasTrack,
                click: () => { void dispatchCommand('previous'); },
            },
            {
                label: '下一曲',
                enabled: hasTrack,
                click: () => { void dispatchCommand('next'); },
            },
            {
                label: '收藏',
                enabled: hasTrack,
                click: () => { void dispatchCommand('like'); },
            },
            { type: 'separator' },
            {
                label: '在菜单栏显示歌词',
                type: 'checkbox',
                checked: Boolean(settings.enabled),
                click: (item) => {
                    applySettings({ enabled: Boolean(item.checked) });
                },
            },
            // Paused-content (歌名 vs 歌词) lives only in the settings panel —
            // the menu stays short.
            {
                label: '更多设置…',
                click: () => { openSettings(); },
            },
        ];
        const next = Menu.buildFromTemplate(template);
        // Rebuilt whenever the player state moves, so the labels and the enabled
        // flags can never get stuck.
        next.on('menu-will-show', () => { updateMenu(readSnapshot()); });
        return next;
    };

    // The native menu is only rebuilt when what it shows actually changed —
    // the track title, the play state, or a setting. The poll loop runs for the
    // lyric text, not for the menu.
    const menuSignature = (snapshot) => [
        menuTitleOf(snapshot),
        snapshot?.state ?? '',
        settings.enabled ? 1 : 0,
        settings.showTranslation ? 1 : 0,
        settings.pausedContent,
    ].join('|');

    const updateMenu = (snapshot) => {
        if (!lyricTray || lyricTray.isDestroyed()) return;
        const signature = menuSignature(snapshot);
        if (signature === lastSignature && menu) return;
        lastSignature = signature;
        const old = menu;
        menu = buildMenu(snapshot);
        if (lyricTray && !lyricTray.isDestroyed()) lyricTray.setContextMenu(menu);
        if (old && old !== menu) {
            try {
                old.removeAllListeners?.();
            } catch (error) { /* ignore */ }
        }
    };

    // ----- settings panel --------------------------------------------------
    const PANEL_WIDTH = 396;
    const PANEL_HEIGHT = 364;

    let panel = null;

    const pushSettingsState = () => {
        if (!panel || panel.isDestroyed()) return;
        let snapshot = null;
        try {
            snapshot = api.runtime.getPlaybackSnapshot();
        } catch (error) { /* ignore */ }
        let preview = '';
        if (snapshot && snapshot.song) {
            const lyric = composeText(snapshot);
            const title = composeSongTitle(snapshot);
            const playing = snapshot.state === 'playing';
            const raw = (!playing && settings.pausedContent === 'title' ? (title || lyric) : lyric) || title || '♪';
            preview = truncateWithEllipsis(raw, normalizeWidth(settings.widthPx));
        }
        try {
            panel.webContents.send('menubar-lyrics:state', {
                enabled: Boolean(settings.enabled),
                showTranslation: Boolean(settings.showTranslation),
                widthPx: normalizeWidth(settings.widthPx),
                pausedContent: normalizePausedContent(settings.pausedContent),
                preview,
            });
        } catch (error) { /* reloading */ }
    };

    const openSettings = () => {
        if (panel && !panel.isDestroyed()) {
            panel.show();
            panel.focus();
            pushSettingsState();
            return;
        }
        panel = new BrowserWindow({
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
            show: false,
            frame: false,
            transparent: true,
            hasShadow: false,
            resizable: false,
            movable: true,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            backgroundColor: '#00000000',
            type: 'panel',
            webPreferences: {
                preload: path.join(__dirname, 'settings-preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
            },
        });
        panel.setAlwaysOnTop(true, 'floating');
        try {
            panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        } catch (error) { /* ignore */ }
        panel.webContents.on('did-finish-load', pushSettingsState);
        panel.on('closed', () => { panel = null; });
        panel.on('blur', () => { if (panel && !panel.isDestroyed()) panel.hide(); });

        const bounds = panel.getBounds();
        let x = null;
        let y = null;
        if (lyricTray && !lyricTray.isDestroyed() && typeof lyricTray.getBounds === 'function') {
            const rect = lyricTray.getBounds();
            if (rect && rect.width > 0) {
                x = Math.round(rect.x + rect.width / 2 - bounds.width / 2);
                y = Math.round(rect.y + rect.height + 6);
            }
        }
        if (x === null) {
            const area = screen.getPrimaryDisplay().workArea;
            x = area.x + area.width - bounds.width - 16;
            y = area.y + 8;
        }
        const display = screen.getDisplayNearestPoint({ x, y: y || 0 });
        const area = display.workArea;
        x = Math.max(area.x + 10, Math.min(x, area.x + area.width - bounds.width - 10));
        y = Math.max(area.y + 6, Math.min(y, area.y + area.height - bounds.height - 10));
        panel.setPosition(x, y, false);
        panel.loadFile(path.join(__dirname, 'panel.html')).catch(() => {});
        panel.show();
        panel.focus();
    };

    const onPanelUpdate = (_event, patch) => {
        if (!panel || panel.isDestroyed()) return;
        if (!patch || typeof patch !== 'object') return;
        const next = {};
        if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
        if (typeof patch.showTranslation === 'boolean') next.showTranslation = patch.showTranslation;
        if (patch.widthPx !== undefined && Number.isFinite(Number(patch.widthPx))) next.widthPx = normalizeWidth(patch.widthPx);
        if (patch.pausedContent === 'lyric' || patch.pausedContent === 'title') next.pausedContent = normalizePausedContent(patch.pausedContent);
        if (Object.keys(next).length === 0) return;
        applySettings(next);
    };

    const onPanelClose = () => {
        if (panel && !panel.isDestroyed()) panel.hide();
    };

    ipcMain.on('menubar-lyrics:update', onPanelUpdate);
    ipcMain.on('menubar-lyrics:close', onPanelClose);

    // ----- go --------------------------------------------------------------
    buildTray();
    render();

    const poll = setInterval(() => {
        // One snapshot per tick: drawn into the status item, and compared
        // against the last one so the native menu is only rebuilt on change.
        updateMenu(render());
    }, POLL_MS);

    api.onDispose(() => {
        clearInterval(poll);
        stopMarquee();
        // Release any client still waiting for a command, so its call returns
        // instead of hanging until the renderer goes away.
        for (const resolve of commandWaiters) resolve({ command: null });
        commandWaiters = [];
        queuedCommands.length = 0;
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        ipcMain.removeListener('menubar-lyrics:update', onPanelUpdate);
        ipcMain.removeListener('menubar-lyrics:close', onPanelClose);
        if (menu) {
            try {
                menu.removeAllListeners?.();
            } catch (error) { /* ignore */ }
            menu = null;
        }
        if (panel && !panel.isDestroyed()) panel.destroy();
        panel = null;
        destroyTray(lyricTray);
        lyricTray = null;
    });
};
