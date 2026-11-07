// src/client.mjs
// Folia「桌面歌词」模组的 client 入口：把播放状态与歌词投影成一份小快照推给 main 入口，
// 并把 main 入口转发回来的窗口命令翻译成 folium.playback 调用。
// 宿主以原生 ESM 从模组目录直接加载这个文件，所以这里不能 import 任何 npm 包。

// 播放位置推送的间隔与容差：窗口自己按 rAF 外推时间，这里只在「推的时候算出来的位置」和
// 「窗口此刻应该在的位置」差得太多时才补一帧，避免每帧跨进程。
const TICK_MS = 200;
const DRIFT_TOLERANCE_MS = 120;
const HEARTBEAT_MS = 3000;

const LABEL = { 'zh-CN': '桌面歌词', en: 'Desktop lyrics', 'zh-TW': '桌面歌詞' };

// Folia 0.7.22 起，切换壁纸 / 重建主窗口会先把播放桥接摘掉再挂回来。这期间读播放状态或歌词
// 会抛这个错误码；它不是故障，等下一拍重试就行，别让它冒出 activate。
const errorText = (error) => {
    if (!error) return '';
    if (typeof error === 'string') return error;
    const message = error.message ?? error.code ?? error.name;
    return message === undefined ? '' : String(message);
};
const isBridgeUnavailable = (error) => /unavailable-in-main-context/.test(errorText(error));

// src/fontPanel.mjs
// 设置面板里的字体选择器：四行（主字体 / 西文字体 / 中文字体 / 回退字体），点「选择」展开
// 可搜索的本机字体列表，列表由 main 入口扫字体目录给出。值仍然存在设置 schema 里（text 字段），
// 这个面板只负责画表单，不另外存一份。

const TEXT = {
    'zh-CN': {
        choose: '选择',
        search: '搜索字体…',
        followTheme: '跟随 Folia 主题字体',
        none: '不指定',
        fallbackGeneric: '通用字族',
        installed: '本机字体',
        resetTab: '恢复本页默认',
        windowTab: '窗口',
        lyricsTab: '歌词',
        lookTab: '外观',
        on: '开',
        off: '关',
        panelFallback: '自定义设置面板加载失败，请重载模组后再试。',
        preview: '夜色漫过城市的边缘 — Lyrics Preview 123',
        count: (n) => `共 ${n} 个`,
        limited: (n) => `还有 ${n} 个，继续输入以缩小范围`,
        empty: '还没有读到本机字体',
        loading: '正在读取本机字体…',
    },
    en: {
        choose: 'Choose',
        search: 'Search fonts…',
        followTheme: 'Follow the Folia theme font',
        none: 'Not set',
        fallbackGeneric: 'Generic families',
        installed: 'Installed',
        resetTab: 'Reset this page',
        windowTab: 'Window',
        lyricsTab: 'Lyrics',
        lookTab: 'Look',
        on: 'On',
        off: 'Off',
        panelFallback: 'The custom settings panel failed to load. Reload the mod and try again.',
        preview: 'Night spills over the edge — Lyrics Preview 123',
        count: (n) => `${n} fonts`,
        limited: (n) => `${n} more — keep typing to narrow it down`,
        empty: 'No installed fonts found',
        loading: 'Reading installed fonts…',
    },
};

const GENERIC = ['sans-serif', 'serif', 'monospace', 'system-ui', 'cursive', 'fantasy'];

const ROWS = [
    { key: 'fontFamily', label: { 'zh-CN': '主字体', en: 'Main font' }, empty: 'followTheme' },
    { key: 'fontLatin', label: { 'zh-CN': '西文字体', en: 'Latin font' }, empty: 'none' },
    { key: 'fontCjk', label: { 'zh-CN': '中文字体', en: 'CJK font' }, empty: 'none' },
    { key: 'fontFallback', label: { 'zh-CN': '回退字体', en: 'Fallback font' }, empty: 'none', generic: true },
];

const quote = (name) => (/^[A-Za-z0-9_-]+$/.test(name) ? name : `'${name.replace(/'/g, "\\'")}'`);

const STYLE = `
.dlf { position: relative; display: flex; flex-direction: column; gap: 12px; font: inherit; }
.dlf * { box-sizing: border-box; }
.dlf button, .dlf input { font: inherit; color: inherit; }
.dlf button { cursor: pointer; }
.dlf :focus-visible { outline: 2px solid var(--folium-accent, currentColor); outline-offset: 2px; }
.dlf-preview {
    padding: 10px 12px; border-radius: 10px; background: rgba(127, 127, 127, 0.1);
    font-size: 19px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dlf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.dlf-row {
    min-width: 0; display: flex; flex-direction: column; gap: 5px; padding: 9px 10px;
    border: 1px solid rgba(127, 127, 127, 0.18); border-radius: 10px; background: rgba(127, 127, 127, 0.07);
}
.dlf-row-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dlf-label {
    min-width: 0; font-size: 11px; opacity: 0.58; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dlf-value { min-height: 18px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dlf-value.empty { opacity: 0.45; }
.dlf-btn {
    align-self: flex-start; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(127, 127, 127, 0.3);
    background: transparent; font-size: 11px; opacity: 0.7;
}
.dlf-btn:hover { opacity: 1; background: rgba(127, 127, 127, 0.16); }
.dlf-pop {
    position: absolute; z-index: 40; display: flex; flex-direction: column; gap: 6px; padding: 8px;
    border-radius: 10px; border: 1px solid rgba(127, 127, 127, 0.26);
    background: var(--folium-bg, #1c1c22);
    box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
}
.dlf-search {
    width: 100%; padding: 6px 8px; border-radius: 7px; border: 1px solid rgba(127, 127, 127, 0.3);
    background: rgba(127, 127, 127, 0.12); font-size: 12px;
}
.dlf-list {
    max-height: min(280px, 46vh); overflow: auto; border-radius: 7px; border: 1px solid rgba(127, 127, 127, 0.18);
    background: rgba(127, 127, 127, 0.05);
}
.dlf-item {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
    padding: 5px 9px; border: 0; background: transparent; text-align: left; font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dlf-item:hover, .dlf-item.active { background: rgba(127, 127, 127, 0.2); }
.dlf-item.current { background: rgba(127, 127, 127, 0.24); }
.dlf-check { flex: 0 0 auto; font-size: 11px; opacity: 0.6; }
.dlf-group {
    position: sticky; top: 0; z-index: 1; padding: 6px 9px 3px; font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.45;
    background: var(--folium-bg, #1c1c22);
}
.dlf-note { font-size: 11px; opacity: 0.5; }
.dlf-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 10px; opacity: 0.45; }
`;

// 字体列表在模组生命周期里只取一次；设置面板反复开关不重复走 rpc。
const fontCache = { list: null, error: false, promise: null };

const loadFontFamilies = (loader, force = false) => {
    if (!loader) {
        fontCache.list = [];
        fontCache.error = false;
        return Promise.resolve([]);
    }
    if (force) {
        fontCache.list = null;
        fontCache.error = false;
        fontCache.promise = null;
    }
    if (fontCache.list) return Promise.resolve(fontCache.list);
    if (!fontCache.promise) {
        fontCache.promise = Promise.resolve()
            .then(() => loader())
            .then((result) => {
                const list = Array.isArray(result) ? result.filter((item) => typeof item === 'string' && item) : [];
                list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
                fontCache.list = list;
                fontCache.error = false;
                return list;
            })
            .catch((error) => {
                fontCache.error = true;
                fontCache.promise = null;
                throw error;
            });
    }
    return fontCache.promise;
};

const buildFontStack = (current, theme, resolveFontStack) => {
    const parts = [];
    const push = (value) => {
        if (value && !parts.includes(value)) parts.push(value);
    };
    if (current.fontLatin) push(quote(current.fontLatin));
    if (current.fontCjk) push(quote(current.fontCjk));
    if (current.fontFamily) push(quote(current.fontFamily));
    else if (typeof resolveFontStack === 'function') {
        try {
            const stack = resolveFontStack(theme);
            if (stack) push(stack);
        } catch {
            /* 主题字体解析失败不影响选择器 */
        }
    }
    if (current.fontFallback) push(String(current.fontFallback));
    return parts.join(', ') || 'sans-serif';
};

const renderFontPicker = ({ loadFamilies, resolveFontStack }, container, ctx) => {
    const locale = String(ctx.locale || 'en');
    const t = pickText(TEXT, locale);
    const theme = () => ctx.getTheme?.() || null;

    const root = makeEl('div', 'dlf');
    const style = makeEl('style');
    style.textContent = STYLE;
    const preview = makeEl('div', 'dlf-preview');
    preview.textContent = t.preview;
    const grid = makeEl('div', 'dlf-grid');
    root.append(style, preview, grid);
    container.append(root);

    let families = fontCache.list;
    let familiesError = fontCache.error;
    let loading = false;
    let openKey = null;
    let openRowEl = null;
    let query = '';
    let popover = null;
    let searchEl = null;
    let listEl = null;
    let footEl = null;
    let activeIndex = -1;
    let renderedValues = [];
    let detachPopover = null;
    let frame = 0;

    const values = () => ctx.settings.get() || {};

    const refresh = () => {
        const current = values();
        preview.style.fontFamily = buildFontStack(current, theme(), resolveFontStack);
        for (const row of ROWS) {
            const valueEl = grid.querySelector(`[data-value="${row.key}"]`);
            if (!valueEl) continue;
            const value = current[row.key];
            if (value) {
                valueEl.textContent = String(value);
                valueEl.classList.remove('empty');
                valueEl.title = String(value);
            } else {
                valueEl.textContent = row.empty === 'followTheme' ? t.followTheme : t.none;
                valueEl.classList.add('empty');
                valueEl.title = '';
            }
        }
        if (openKey && popover) renderList();
    };

    const closePopover = () => {
        if (detachPopover) {
            detachPopover();
            detachPopover = null;
        }
        if (frame) {
            cancelAnimationFrame(frame);
            frame = 0;
        }
        popover?.remove();
        popover = null;
        searchEl = null;
        listEl = null;
        footEl = null;
        openKey = null;
        openRowEl = null;
        query = '';
        activeIndex = -1;
        renderedValues = [];
    };

    const highlight = (index) => {
        if (!listEl) return;
        const items = listEl.querySelectorAll('button[data-value]');
        items.forEach((item, itemIndex) => item.classList.toggle('active', itemIndex === index));
        activeIndex = items.length === 0 ? -1 : Math.min(Math.max(index, 0), items.length - 1);
    };

    const scrollActive = () => {
        if (activeIndex < 0 || !listEl) return;
        listEl.querySelectorAll('button[data-value]')[activeIndex]?.scrollIntoView({ block: 'nearest' });
    };

    const selectValue = (value) => {
        const key = openKey;
        closePopover();
        if (!key) return;
        try {
            const result = ctx.settings.set({ [key]: value });
            if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch (error) {
            console.warn('[desktop-lyric] 保存字体失败', error);
        }
        refresh();
    };

    const renderList = () => {
        if (!listEl) return;
        listEl.textContent = '';
        const row = ROWS.find((entry) => entry.key === openKey);
        if (!row) return;
        const current = values()[openKey] ? String(values()[openKey]) : '';
        const keyword = query.trim().toLowerCase();
        const fragment = document.createDocumentFragment();
        let group = '';
        let count = 0;

        const addItem = (value, label, groupName) => {
            if (groupName && group !== groupName) {
                const heading = makeEl('div', 'dlf-group');
                heading.textContent = groupName;
                fragment.append(heading);
                group = groupName;
            }
            const item = makeEl('button', 'dlf-item');
            item.type = 'button';
            item.dataset.value = value;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(value === current));
            item.classList.toggle('current', value === current);
            const text = makeEl('span');
            text.textContent = label;
            const check = makeEl('span', 'dlf-check');
            check.textContent = value === current ? '✓' : '';
            item.append(text, check);
            fragment.append(item);
            count += 1;
        };

        addItem('', t[row.empty] || t.none, '');
        if (row.generic) {
            for (const family of GENERIC) {
                if (keyword && !family.toLowerCase().includes(keyword)) continue;
                addItem(family, family, t.fallbackGeneric);
            }
        }
        if (families === null) {
            const note = makeEl('div', 'dlf-note');
            note.textContent = loading ? t.loading : familiesError ? `${t.empty} · ${t.retry}` : t.loading;
            fragment.append(note);
        } else {
            const matches = keyword ? families.filter((family) => family.toLowerCase().includes(keyword)) : families;
            if (matches.length === 0) {
                const note = makeEl('div', 'dlf-note');
                note.textContent = t.noMatch;
                fragment.append(note);
            }
            for (const family of matches.slice(0, 150)) addItem(family, family, t.installed);
            if (matches.length > 150) {
                const note = makeEl('div', 'dlf-note');
                note.textContent = t.limited(matches.length - 150);
                fragment.append(note);
            }
        }
        listEl.append(fragment);
        renderedValues = [...listEl.querySelectorAll('button[data-value]')].map((item) => item.dataset.value);
        activeIndex = renderedValues.length > 0 ? 0 : -1;
        highlight(0);
        if (footEl) {
            footEl.textContent = families === null
                ? loading
                    ? t.loading
                    : familiesError
                      ? `${t.empty} · ${t.retry}`
                      : ''
                : keyword
                  ? t.count(families.filter((family) => family.toLowerCase().includes(keyword)).length)
                  : t.count(families.length);
        }
        // 列表很长时，把当前项滚到视野里；只在打开时、没输入关键词时做一次。
        if (!keyword && current) {
            const currentItem = listEl.querySelector('button[data-value="' + CSS.escape(current) + '"]');
            if (currentItem) requestAnimationFrame(() => currentItem.scrollIntoView({ block: 'nearest' }));
        }
    };

    const openPicker = (row, rowEl) => {
        closePopover();
        openKey = row.key;
        openRowEl = rowEl;
        query = '';
        popover = makeEl('div', 'dlf-pop');
        popover.style.left = '0px';
        popover.style.width = `${grid.clientWidth}px`;
        // 面板可能贴近屏幕底部：空间不够就向上弹，别让列表跑出窗口。
        const rootRect = root.getBoundingClientRect();
        const rowTop = rootRect.top + rowEl.offsetTop;
        const rowBottom = rowTop + rowEl.offsetHeight;
        const spaceBelow = window.innerHeight - rowBottom - 12;
        const spaceAbove = rowTop - 12;
        const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
        if (openAbove) {
            popover.style.top = 'auto';
            popover.style.bottom = `${root.offsetHeight - rowEl.offsetTop + 6}px`;
            popover.style.maxHeight = `${Math.min(420, Math.max(200, spaceAbove))}px`;
        } else {
            popover.style.top = `${rowEl.offsetTop + rowEl.offsetHeight + 6}px`;
            popover.style.maxHeight = `${Math.min(420, Math.max(200, spaceBelow))}px`;
        }

        searchEl = makeEl('input', 'dlf-search');
        searchEl.type = 'search';
        searchEl.placeholder = t.search;
        searchEl.setAttribute('aria-label', t.search);
        searchEl.addEventListener('input', () => {
            query = searchEl.value;
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = 0;
                renderList();
            });
        });
        searchEl.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                closePopover();
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                highlight(activeIndex + 1);
                scrollActive();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                highlight(activeIndex - 1);
                scrollActive();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const value = renderedValues[activeIndex];
                if (value !== undefined) selectValue(value);
            }
        });

        listEl = makeEl('div', 'dlf-list');
        listEl.setAttribute('role', 'listbox');
        listEl.style.maxHeight = `${Math.min(280, Math.max(120, (parseFloat(popover.style.maxHeight) || 420) - 74))}px`;
        listEl.addEventListener('click', (event) => {
            const item = event.target instanceof Element ? event.target.closest('button[data-value]') : null;
            if (item) selectValue(item.dataset.value);
        });
        listEl.addEventListener('pointermove', (event) => {
            const item = event.target instanceof Element ? event.target.closest('button[data-value]') : null;
            if (!item || !listEl) return;
            const items = [...listEl.querySelectorAll('button[data-value]')];
            const index = items.indexOf(item);
            if (index >= 0 && index !== activeIndex) highlight(index);
        });

        footEl = makeEl('div', 'dlf-foot');
        const retry = makeEl('button', 'dlf-btn');
        retry.type = 'button';
        retry.textContent = t.retry;
        retry.hidden = !familiesError;
        retry.addEventListener('click', () => load(true));
        footEl.append(retry);

        popover.append(searchEl, listEl, footEl);
        root.append(popover);

        const onOutside = (event) => {
            if (!popover) return;
            // 设置面板挂在 shadow root 里：document 上看到的 target 会被重定向成宿主元素，
            // 必须看 composedPath 才知道点击是不是落在选择器内部。
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (path.includes(popover)) return;
            // 点同一行的「选择」是切换开关：交给按钮的 click 处理，别在这里先关掉再被 click 打开。
            if (openRowEl && path.includes(openRowEl)) return;
            if (event.target instanceof Node && popover.contains(event.target)) return;
            closePopover();
        };
        const openedAt = performance.now();
        const onScroll = () => {
            // 刚打开的 250ms 内不关：focus / 布局抖动可能触发一次 scroll，
            // 真把选择器关掉的话用户会以为点了没反应。
            if (performance.now() - openedAt > 250) closePopover();
        };
        document.addEventListener('pointerdown', onOutside, true);
        window.addEventListener('resize', onScroll);
        // 不要用 capture：列表自己的滚动也会冒到 window，会把刚打开的选择器关掉。
        window.addEventListener('scroll', onScroll);
        detachPopover = () => {
            document.removeEventListener('pointerdown', onOutside, true);
            window.removeEventListener('resize', onScroll);
            window.removeEventListener('scroll', onScroll);
        };

        renderList();
        // preventScroll：焦点跳进搜索框时别把整页滚一下，否则会触发上面的 scroll 关掉选择器。
        searchEl.focus({ preventScroll: true });
    };

    const load = (force = false) => {
        loading = true;
        familiesError = false;
        refresh();
        loadFontFamilies(loadFamilies, force)
            .then((list) => {
                families = list;
                familiesError = false;
            })
            .catch(() => {
                families = [];
                familiesError = true;
            })
            .finally(() => {
                loading = false;
                if (openKey) renderList();
                refresh();
            });
    };

    for (const row of ROWS) {
        const rowEl = makeEl('div', 'dlf-row');
        const head = makeEl('div', 'dlf-row-head');
        const label = makeEl('span', 'dlf-label');
        label.textContent = localeText(row.label, locale, row.key);
        head.append(label);
        const valueEl = makeEl('div', 'dlf-value');
        valueEl.dataset.value = row.key;
        const button = makeEl('button', 'dlf-btn');
        button.type = 'button';
        button.textContent = t.choose;
        button.addEventListener('click', () => {
            if (openKey === row.key) closePopover();
            else openPicker(row, rowEl);
        });
        rowEl.append(head, valueEl, button);
        grid.append(rowEl);
    }

    refresh();
    if (fontCache.list === null) load(false);

    const offStore = ctx.settings.onChange(refresh);
    let offContext = null;
    try {
        offContext = ctx.onChange?.(() => refresh()) || null;
    } catch {
        offContext = null;
    }

    return () => {
        closePopover();
        try {
            offStore?.();
        } catch {
            /* ignore */
        }
        try {
            offContext?.();
        } catch {
            /* ignore */
        }
        style.remove();
        root.remove();
    };
};

const WINDOW_GROUP = { 'zh-CN': '窗口', en: 'Window' };
const HEADER_GROUP = { 'zh-CN': '控制条', en: 'Control bar' };
const MOUSE_GROUP = { 'zh-CN': '鼠标与拖动', en: 'Mouse & dragging' };
const VISIBILITY_GROUP = { 'zh-CN': '显示', en: 'Visibility' };
const TYPO_GROUP = { 'zh-CN': '字形', en: 'Type' };
const POSITION_GROUP = { 'zh-CN': '位置', en: 'Position' };
const SUBS_GROUP = { 'zh-CN': '翻译与音译', en: 'Translation & romanization' };
const MOTION_GROUP = { 'zh-CN': '动效', en: 'Motion' };
const BG_GROUP = { 'zh-CN': '底色', en: 'Background' };
const TEXT_GROUP = { 'zh-CN': '文字', en: 'Text' };
const WHOLE_GROUP = { 'zh-CN': '整体', en: 'Whole window' };

// 选择器自己挂了（宿主上下文变了、DOM 不给力……）时的退路：四个纯文本框，值照样写进设置，
// 不把「界面代码出错」甩给用户。
const renderFontFallback = (container, ctx) => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';

    const ROWS_FALLBACK = [
        ['fontFamily', '主字体'],
        ['fontLatin', '西文字体'],
        ['fontCjk', '中文字体'],
        ['fontFallback', '回退字体'],
    ];
    const current = ctx.settings.get();
    for (const [key, label] of ROWS_FALLBACK) {
        const line = document.createElement('label');
        line.style.display = 'flex';
        line.style.gap = '8px';
        line.style.alignItems = 'center';
        const name = document.createElement('span');
        name.textContent = label;
        name.style.flex = '0 0 84px';
        name.style.fontSize = '12px';
        name.style.opacity = '0.75';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = typeof current[key] === 'string' ? current[key] : '';
        input.placeholder = key === 'fontFallback' ? 'sans-serif' : '留空跟随主题';
        input.style.flex = '1 1 auto';
        input.style.padding = '5px 8px';
        input.style.borderRadius = '6px';
        input.style.border = '1px solid rgba(127,127,127,0.4)';
        input.style.background = 'rgba(127,127,127,0.1)';
        input.style.color = 'inherit';
        input.style.font = 'inherit';
        input.addEventListener('input', () => ctx.settings.set({ [key]: input.value }));
        line.append(name, input);
        wrap.append(line);
    }
    container.append(wrap);
    return () => wrap.remove();
};

// ---------------------------------------------------------------- 主设置面板

// Folia 的设置分区默认把所有 number / select 渲染成整行，39 项会变成一条很长的单列。
// 这里用一个轻量的自定义面板：三个页签 + 两列卡片，值仍然写回 section.settings，
// 所以关掉面板、重载模组之后设置都还在原处。
const PANEL_CSS = `
.dls { display: flex; flex-direction: column; gap: 12px; font: inherit; color: inherit; }
.dls * { box-sizing: border-box; }
.dls button, .dls input, .dls select { font: inherit; color: inherit; }
.dls button { cursor: pointer; }
.dls :focus-visible { outline: 2px solid var(--folium-accent, currentColor); outline-offset: 2px; }
.dls-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.dls-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: rgba(127, 127, 127, 0.1); }
.dls-tab {
    padding: 5px 12px; border: 0; border-radius: 7px; background: transparent; color: inherit;
    font-size: 12px; opacity: 0.62; transition: background 0.15s ease, opacity 0.15s ease;
}
.dls-tab:hover { opacity: 0.9; }
.dls-tab.active { background: rgba(127, 127, 127, 0.24); opacity: 1; }
.dls-reset {
    padding: 5px 9px; border: 1px solid rgba(127, 127, 127, 0.28); border-radius: 7px;
    background: transparent; color: inherit; font-size: 11px; opacity: 0.62;
}
.dls-reset:hover { opacity: 1; background: rgba(127, 127, 127, 0.14); }
.dls-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; align-items: stretch; }
.dls-group {
    grid-column: 1 / -1; padding: 6px 2px 0; font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.45;
}
.dls-field {
    min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 9px 10px;
    border: 1px solid rgba(127, 127, 127, 0.18); border-radius: 10px;
    background: rgba(127, 127, 127, 0.07);
}
.dls-field.wide { grid-column: 1 / -1; }
.dls-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.dls-label {
    min-width: 0; font-size: 12px; font-weight: 500; opacity: 0.86;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dls-value { flex: 0 0 auto; font-size: 11px; opacity: 0.55; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dls-range { width: 100%; height: 4px; margin: 1px 0 0; accent-color: var(--folium-accent, currentColor); cursor: pointer; }
.dls-select {
    width: 100%; padding: 5px 7px; border-radius: 7px; border: 1px solid rgba(127, 127, 127, 0.3);
    background: rgba(127, 127, 127, 0.12); font-size: 11px;
}
.dls-select option { color: #111; background: #fff; }
.dls-toggle {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%;
    padding: 0; border: 0; background: transparent; text-align: left;
}
.dls-toggle .dls-label { opacity: 0.86; }
.dls-toggle-right { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
.dls-switch {
    position: relative; width: 30px; height: 17px; border-radius: 999px;
    background: rgba(127, 127, 127, 0.3); transition: background 0.15s ease;
}
.dls-switch::after {
    content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%;
    background: rgba(255, 255, 255, 0.92); transition: transform 0.15s ease;
}
.dls-toggle[aria-checked='true'] .dls-switch { background: var(--folium-accent, #6aa9ff); }
.dls-toggle[aria-checked='true'] .dls-switch::after { transform: translateX(13px); }
.dls-color { display: flex; align-items: center; gap: 8px; }
.dls-color input[type='color'] {
    width: 34px; height: 26px; padding: 0; border: 1px solid rgba(127, 127, 127, 0.3); border-radius: 6px;
    background: transparent; cursor: pointer;
}
.dls-color .dls-hex { flex: 1 1 auto; min-width: 0; font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.dls-text {
    width: 100%; padding: 5px 7px; border-radius: 7px; border: 1px solid rgba(127, 127, 127, 0.3);
    background: rgba(127, 127, 127, 0.12); font-size: 11px;
}
.dls-note { font-size: 10px; line-height: 1.35; opacity: 0.45; }
`;

const SETTINGS_TABS = [
    {
        id: 'window',
        label: 'windowTab',
        keys: [
            'mode',
            'alwaysOnTop',
            'skipTaskbar',
            'headerMode',
            'alwaysShowPlayInfo',
            'wheelFontSize',
            'lock',
            'ignoreHover',
            'lockPosition',
            'hideWithoutLyrics',
        ],
    },
    {
        id: 'lyrics',
        label: 'lyricsTab',
        keys: [
            'fontSize',
            'fontWeight',
            'letterSpacing',
            'align',
            'verticalPosition',
            'showTranslation',
            'showRomanization',
            'translationOpacity',
            'translationScale',
            'enableSpring',
            'blurUpcoming',
            'springMass',
            'springStiffness',
            'springDamping',
            'wordFadeWidth',
            'hidePassedLines',
        ],
    },
    {
        id: 'look',
        label: 'lookTab',
        keys: [
            'backgroundMode',
            'backgroundColor',
            'backgroundOpacity',
            'cornerRadius',
            'border',
            'playedColor',
            'unplayedOpacity',
            'shadowColor',
            'followTheme',
            'textBackgroundMask',
            'backgroundMaskColor',
            'opacity',
            'pausedOpacity',
        ],
    },
];

const makeEl = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
};

const localeText = (value, locale, fallback = '') => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') return value;
    const key = String(locale || 'en');
    const order = [key, key.startsWith('zh') ? 'zh-CN' : null, 'zh-CN', 'en'];
    for (const candidate of order) {
        if (candidate && typeof value[candidate] === 'string' && value[candidate]) return value[candidate];
    }
    for (const item of Object.values(value)) {
        if (typeof item === 'string' && item) return item;
    }
    return fallback;
};

const pickText = (table, locale) => {
    const key = String(locale || 'en');
    return table[key] || (key.startsWith('zh') ? table['zh-CN'] : null) || table.en;
};

const formatNumber = (value, step) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    const text = String(step ?? 1);
    const decimals = text.includes('.') ? (text.split('.')[1] || '').length : 0;
    return number.toFixed(Math.min(decimals, 3));
};

const clampColor = (value, fallback = '#000000') => {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text;
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
    }
    return fallback;
};

const renderSettingsPanel = ({ fields }, container, ctx) => {
    const locale = String(ctx.locale || 'en');
    const t = pickText(TEXT, locale);
    const list = Array.isArray(fields) ? fields.filter((field) => field && typeof field.key === 'string') : [];
    if (list.length === 0) return undefined;
    const fieldByKey = new Map(list.map((field) => [field.key, field]));
    const allKeys = list.map((field) => field.key);
    let values = { ...(ctx.settings.get() || {}) };
    let timer = null;
    let pending = {};
    let closed = false;
    let activeTab = SETTINGS_TABS[0];

    const root = makeEl('div', 'dls');
    const style = makeEl('style');
    style.textContent = PANEL_CSS;
    const bar = makeEl('div', 'dls-bar');
    const tabsHost = makeEl('div', 'dls-tabs');
    const resetButton = makeEl('button', 'dls-reset');
    resetButton.type = 'button';
    resetButton.textContent = t.resetTab;
    bar.append(tabsHost, resetButton);
    const grid = makeEl('div', 'dls-grid');
    root.append(style, bar, grid);
    container.append(root);

    const setStore = (patch, force = false) => {
        if ((!force && closed) || Object.keys(patch).length === 0) return;
        try {
            const result = ctx.settings.set(patch);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => console.warn('[desktop-lyric] 保存设置失败', error));
            }
        } catch (error) {
            console.warn('[desktop-lyric] 保存设置失败', error);
        }
    };

    const flush = (force = false) => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        const patch = pending;
        pending = {};
        setStore(patch, force);
    };

    const queue = () => {
        if (timer === null) timer = setTimeout(flush, 60);
    };

    const noteFor = (field, label) => {
        const note = localeText(field.description, locale, '');
        return note ? `${label}\n${note}` : label;
    };

    const controls = new Map();

    const buildField = (field) => {
        const key = field.key;
        const label = localeText(field.label, locale, key);
        const wrap = makeEl('div', `dls-field${field.type === 'select' || field.type === 'text' ? ' wide' : ''}`);

        if (field.type === 'boolean') {
            const button = makeEl('button', 'dls-toggle');
            button.type = 'button';
            button.setAttribute('role', 'switch');
            button.title = noteFor(field, label);
            const title = makeEl('span', 'dls-label');
            title.textContent = label;
            const right = makeEl('span', 'dls-toggle-right');
            const state = makeEl('span', 'dls-value');
            const knob = makeEl('span', 'dls-switch');
            right.append(state, knob);
            button.append(title, right);
            button.addEventListener('click', () => {
                const next = values[key] !== true;
                values[key] = next;
                pending[key] = next;
                queue();
                update(next);
            });
            wrap.append(button);
            const update = (value) => {
                const on = value === true;
                button.setAttribute('aria-checked', String(on));
                state.textContent = on ? t.on : t.off;
            };
            controls.set(key, update);
            return { wrap, update };
        }

        const head = makeEl('div', 'dls-head');
        const title = makeEl('span', 'dls-label');
        title.textContent = label;
        title.title = noteFor(field, label);
        const valueEl = makeEl('span', 'dls-value');
        head.append(title, valueEl);
        wrap.append(head);

        if (field.type === 'number') {
            const range = makeEl('input', 'dls-range');
            range.type = 'range';
            range.min = String(field.min ?? 0);
            range.max = String(field.max ?? 100);
            range.step = String(field.step ?? 1);
            range.addEventListener('input', () => {
                const next = Number(range.value);
                values[key] = next;
                pending[key] = next;
                valueEl.textContent = formatNumber(next, field.step);
                queue();
            });
            range.addEventListener('change', flush);
            wrap.append(range);
            const update = (value) => {
                const next = Number.isFinite(Number(value)) ? Number(value) : Number(field.defaultValue) || 0;
                range.value = String(next);
                valueEl.textContent = formatNumber(next, field.step);
            };
            controls.set(key, update);
            return { wrap, update };
        }

        if (field.type === 'select') {
            const select = makeEl('select', 'dls-select');
            for (const option of field.options || []) {
                const item = document.createElement('option');
                item.value = String(option.value);
                item.textContent = localeText(option.label, locale, String(option.value));
                select.append(item);
            }
            select.addEventListener('change', () => {
                const next = select.value;
                values[key] = next;
                pending[key] = next;
                flush();
                update(next);
            });
            wrap.append(select);
            const update = (value) => {
                const next = value === undefined || value === null ? '' : String(value);
                select.value = next;
            };
            controls.set(key, update);
            return { wrap, update };
        }

        if (field.type === 'color') {
            const row = makeEl('div', 'dls-color');
            const input = document.createElement('input');
            input.type = 'color';
            const hex = makeEl('span', 'dls-hex');
            input.addEventListener('input', () => {
                values[key] = input.value;
                pending[key] = input.value;
                hex.textContent = input.value;
                queue();
            });
            input.addEventListener('change', flush);
            row.append(input, hex);
            wrap.append(row);
            const update = (value) => {
                const next = clampColor(value, '#000000');
                input.value = next;
                hex.textContent = next;
            };
            controls.set(key, update);
            return { wrap, update };
        }

        const input = makeEl('input', 'dls-text');
        input.type = 'text';
        input.addEventListener('input', () => {
            values[key] = input.value;
            pending[key] = input.value;
            queue();
        });
        input.addEventListener('change', flush);
        wrap.append(input);
        const update = (value) => {
            input.value = typeof value === 'string' ? value : '';
        };
        controls.set(key, update);
        return { wrap, update };
    };

    const buildGrid = () => {
        grid.textContent = '';
        controls.clear();
        let currentGroup = null;
        for (const key of activeTab.keys) {
            const field = fieldByKey.get(key);
            if (!field) continue;
            const group = localeText(field.group, locale, '');
            if (group && group !== currentGroup) {
                const heading = makeEl('div', 'dls-group');
                heading.textContent = group;
                grid.append(heading);
            }
            currentGroup = group;
            try {
                const built = buildField(field);
                built.update(values[key]);
                grid.append(built.wrap);
            } catch (error) {
                console.warn(`[desktop-lyric] 设置项 ${key} 渲染失败`, error);
            }
        }
    };

    const tabButtons = new Map();
    for (const tab of SETTINGS_TABS) {
        const button = makeEl('button', 'dls-tab');
        button.type = 'button';
        button.textContent = t[tab.label];
        button.setAttribute('role', 'tab');
        button.addEventListener('click', () => {
            activeTab = tab;
            for (const [id, item] of tabButtons) {
                item.classList.toggle('active', id === tab.id);
                item.setAttribute('aria-selected', String(id === tab.id));
            }
            buildGrid();
        });
        tabButtons.set(tab.id, button);
        tabsHost.append(button);
    }

    resetButton.addEventListener('click', () => {
        const patch = {};
        for (const key of activeTab.keys) {
            const field = fieldByKey.get(key);
            if (field && field.defaultValue !== undefined) patch[key] = field.defaultValue;
        }
        if (Object.keys(patch).length === 0) return;
        values = { ...values, ...patch };
        pending = { ...pending, ...patch };
        flush();
        for (const [key, update] of controls) update(values[key]);
    });

    const sync = () => {
        const next = ctx.settings.get() || {};
        let changed = false;
        for (const key of allKeys) {
            if (next[key] !== values[key]) {
                values[key] = next[key];
                changed = true;
            }
        }
        if (!changed) return;
        for (const [key, update] of controls) update(values[key]);
    };

    const offStore = ctx.settings.onChange(sync);

    tabButtons.get(activeTab.id)?.click();

    return () => {
        closed = true;
        try {
            offStore?.();
        } catch {
            /* ignore */
        }
        flush(true);
        style.remove();
        root.remove();
    };
};

export const createSettingsPanel = (options) => (container, ctx) => {
    try {
        return renderSettingsPanel(options, container, ctx);
    } catch (error) {
        console.warn('[desktop-lyric] 设置面板挂了', error);
        container.textContent = '';
        try {
            const note = makeEl('div', 'dls-note');
            note.textContent = pickText(TEXT, ctx.locale).panelFallback;
            container.append(note);
        } catch {
            /* ignore */
        }
        return undefined;
    }
};

export const createFontPanel = (options) => (container, ctx) => {
    try {
        return renderFontPicker(options, container, ctx);
    } catch (error) {
        console.warn('[desktop-lyric] 字体选择器挂了，退回文本框', error);
        container.textContent = '';
        try {
            return renderFontFallback(container, ctx);
        } catch {
            return undefined;
        }
    }
};

// 主设置分区的字段表。放在模块作用域，设置面板和 schema 共用同一份定义。
export const MAIN_FIELDS = [
            {
                key: 'mode',
                                group: WINDOW_GROUP,
                type: 'select',
                label: { 'zh-CN': '窗口形态', en: 'Window mode' },
                description: {
                    'zh-CN': '单行 / 双行是跟着字号走的窄条；多行是整块可滚动的歌词板。',
                    en: 'Single and double are a bar sized by the font; board is a scrollable lyric panel.',
                },
                defaultValue: 'single',
                options: [
                    { value: 'single', label: { 'zh-CN': '单行', en: 'Single line' } },
                    { value: 'double', label: { 'zh-CN': '双行（含下一句）', en: 'Double line' } },
                    { value: 'board', label: { 'zh-CN': '多行歌词板', en: 'Multi-line board' } },
                ],
            },
            {
                key: 'alwaysOnTop',
                                group: WINDOW_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '总在最前', en: 'Always on top' },
                defaultValue: true,
            },
            {
                key: 'skipTaskbar',
                type: 'boolean',
                                group: WINDOW_GROUP,
                label: { 'zh-CN': '不在任务栏显示', en: 'Hide from taskbar' },
                defaultValue: true,
            },
            {
                key: 'headerMode',
                type: 'select',
                                group: HEADER_GROUP,
                label: { 'zh-CN': '控制条', en: 'Control bar' },
                description: {
                    'zh-CN': '悬停显示：鼠标移上来才出现。一直隐藏：纯歌词，永远不出现。',
                    en: 'On hover: appears when the pointer is over the window. Never: lyrics only, always hidden.',
                },
                defaultValue: 'hover',
                options: [
                    { value: 'hover', label: { 'zh-CN': '悬停显示', en: 'On hover' } },
                    { value: 'always', label: { 'zh-CN': '常显', en: 'Always' } },
                    { value: 'never', label: { 'zh-CN': '一直隐藏', en: 'Never' } },
                ],
            },
            {
                key: 'alwaysShowPlayInfo',
                                group: HEADER_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '始终显示歌名', en: 'Always show song info' },
                description: {
                    'zh-CN': '关掉时歌名只在鼠标移到歌词上时出现。',
                    en: 'When off, the song name only shows while hovering.',
                },
                defaultValue: false,
            },
            {
                key: 'wheelFontSize',
                type: 'boolean',
                                group: MOUSE_GROUP,
                label: { 'zh-CN': '滚轮调字号', en: 'Mouse wheel font size' },
                description: {
                    'zh-CN': '在歌词上滚滚轮改字号，滚一格 1px。',
                    en: 'Scroll on the lyrics to change the font size by 1px a notch.',
                },
                defaultValue: false,
            },
            {
                key: 'lock',
                                group: MOUSE_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '锁定（鼠标穿透）', en: 'Lock (click-through)' },
                description: {
                    'zh-CN': '锁定时整扇窗穿透，只有指针压到锁定按钮那一小块才临时解冻。默认不锁。',
                    en: 'While locked the whole window passes clicks through; only the lock button itself catches them. Off by default.',
                },
                defaultValue: false,
            },
            {
                key: 'ignoreHover',
                type: 'boolean',
                                group: MOUSE_GROUP,
                label: { 'zh-CN': '忽略鼠标悬停', en: 'Ignore the mouse entirely' },
                description: {
                    'zh-CN': '指针完全不进这扇窗：不出控制条、不响应悬停、也点不到任何东西。适合纯展示；要操作时用命令面板开关键。',
                    en: 'The pointer never reaches this window: no control bar, no hover, nothing clickable. For a pure overlay; use the commands to switch it back.',
                },
                defaultValue: false,
            },
            {
                key: 'lockPosition',
                type: 'boolean',
                                group: MOUSE_GROUP,
                label: { 'zh-CN': '锁定位置', en: 'Lock position' },
                description: {
                    'zh-CN': '窗口钉在原地不能拖；和上面的鼠标穿透是两件事。',
                    en: 'Pins the window so it cannot be dragged; separate from click-through above.',
                },
                defaultValue: false,
            },
            {
                key: 'hideWithoutLyrics',
                type: 'boolean',
                                group: VISIBILITY_GROUP,
                label: { 'zh-CN': '无歌词时隐藏', en: 'Hide without lyrics' },
                description: {
                    'zh-CN': '当前歌没有歌词时整扇窗隐形，免得挡桌面。',
                    en: 'Makes the whole window invisible while the song has no lyrics.',
                },
                defaultValue: false,
            },
            {
                key: 'fontSize',
                                group: TYPO_GROUP,
                type: 'number',
                label: { 'zh-CN': '字号', en: 'Font size' },
                description: {
                    'zh-CN': '单行 / 双行形态下窗口高度跟着字号走；直接拖窗口高度也能反过来改字号。',
                    en: 'In single/double the window height follows the font; dragging the height changes the font back.',
                },
                defaultValue: 30,
                min: 16,
                max: 96,
                step: 1,
            },
            {
                key: 'fontWeight',
                type: 'number',
                                group: TYPO_GROUP,
                label: { 'zh-CN': '字重', en: 'Font weight' },
                defaultValue: 400,
                min: 300,
                max: 900,
                step: 100,
            },
            {
                key: 'letterSpacing',
                type: 'number',
                                group: TYPO_GROUP,
                label: { 'zh-CN': '字间距', en: 'Letter spacing' },
                defaultValue: 0,
                min: -0.06,
                max: 0.2,
                step: 0.01,
            },
            {
                key: 'align',
                type: 'select',
                                group: TYPO_GROUP,
                label: { 'zh-CN': '对齐方式', en: 'Alignment' },
                defaultValue: 'center',
                options: [
                    { value: 'center', label: { 'zh-CN': '居中', en: 'Center' } },
                    { value: 'left', label: { 'zh-CN': '靠左', en: 'Left' } },
                    { value: 'right', label: { 'zh-CN': '靠右', en: 'Right' } },
                    { value: 'both', label: { 'zh-CN': '左右交替（对唱）', en: 'Alternating (duet)' } },
                ],
            },
            {
                key: 'verticalPosition',
                type: 'number',
                                group: POSITION_GROUP,
                label: { 'zh-CN': '纵向位置', en: 'Vertical position' },
                description: {
                    'zh-CN': '当前句在窗口高度上的位置，0.5 是正中。',
                    en: 'Where the current line sits in the window height; 0.5 is the middle.',
                },
                defaultValue: 0.5,
                min: 0.2,
                max: 0.8,
                step: 0.01,
            },
            {
                key: 'showTranslation',
                type: 'boolean',
                                group: SUBS_GROUP,
                label: { 'zh-CN': '显示翻译', en: 'Show translation' },
                defaultValue: true,
            },
            {
                key: 'showRomanization',
                type: 'boolean',
                                group: SUBS_GROUP,
                label: { 'zh-CN': '显示音译', en: 'Show romanization' },
                description: {
                    'zh-CN': '有音译时作为第三行显示。',
                    en: 'Shown as a third line when the source has one.',
                },
                defaultValue: false,
            },
            {
                key: 'translationOpacity',
                type: 'number',
                                group: SUBS_GROUP,
                label: { 'zh-CN': '翻译透明度', en: 'Translation opacity' },
                defaultValue: 0.3,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            {
                key: 'translationScale',
                type: 'number',
                                group: SUBS_GROUP,
                label: { 'zh-CN': '翻译字号比例', en: 'Translation scale' },
                defaultValue: 0.5,
                min: 0.3,
                max: 1,
                step: 0.02,
            },
            {
                key: 'enableSpring',
                type: 'boolean',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '弹簧动画', en: 'Spring animation' },
                description: {
                    'zh-CN': '关掉回退到 CSS 过渡，省 CPU，动效单一。',
                    en: 'Turn off to fall back to CSS transitions: cheaper, plainer.',
                },
                defaultValue: true,
            },
            {
                key: 'blurUpcoming',
                type: 'boolean',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '上下句模糊', en: 'Blur neighboring lines' },
                defaultValue: true,
            },
            {
                key: 'springMass',
                type: 'number',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '弹簧质量', en: 'Spring mass' },
                description: {
                    'zh-CN': 'AMLL 默认 1。越大越沉、 inertial。',
                    en: 'AMLL default is 1; heavier feels more inertial.',
                },
                defaultValue: 1,
                min: 0.4,
                max: 3,
                step: 0.1,
            },
            {
                key: 'springStiffness',
                type: 'number',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '弹簧刚度', en: 'Spring stiffness' },
                description: { 'zh-CN': 'AMLL 默认 100。越大回位越快。', en: 'AMLL default is 100; higher snaps back faster.' },
                defaultValue: 100,
                min: 20,
                max: 400,
                step: 5,
            },
            {
                key: 'springDamping',
                type: 'number',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '弹簧阻尼', en: 'Spring damping' },
                description: { 'zh-CN': 'AMLL 默认 10。越小越弹。', en: 'AMLL default is 10; lower bounces more.' },
                defaultValue: 10,
                min: 1,
                max: 40,
                step: 0.5,
            },
            {
                key: 'wordFadeWidth',
                type: 'number',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '逐字渐变宽度', en: 'Word fade width' },
                description: {
                    'zh-CN': '逐字擦除的柔和程度，1 ≈ Android 版 Apple Music，0.5 ≈ iPad。',
                    en: 'Softness of the per-word wipe: 1 is Android Apple Music, 0.5 is iPad.',
                },
                defaultValue: 1,
                min: 0.1,
                max: 2,
                step: 0.05,
            },
            {
                key: 'hidePassedLines',
                type: 'boolean',
                                group: MOTION_GROUP,
                label: { 'zh-CN': '隐藏已唱行', en: 'Hide passed lines' },
                description: {
                    'zh-CN': '只对多行歌词板有用，单行 / 双行本来就只留一句。',
                    en: 'Only matters on the board layout; the bar layouts already clip.',
                },
                defaultValue: false,
            },
            {
                key: 'backgroundMode',
                                group: BG_GROUP,
                type: 'select',
                label: { 'zh-CN': '窗口底色', en: 'Window background' },
                description: {
                    'zh-CN': '透明是一片纯透明；纯色用下面的颜色；跟随主题用 Folia 当前主题的背景色。',
                    en: 'None is fully transparent; color uses the color below; theme follows the Folia theme background.',
                },
                defaultValue: 'color',
                options: [
                    { value: 'none', label: { 'zh-CN': '透明', en: 'None' } },
                    { value: 'color', label: { 'zh-CN': '纯色', en: 'Color' } },
                    { value: 'theme', label: { 'zh-CN': '跟随主题背景', en: 'Theme background' } },
                ],
            },
            {
                key: 'backgroundColor',
                                group: BG_GROUP,
                type: 'color',
                label: { 'zh-CN': '底色', en: 'Background color' },
                defaultValue: '#0b0b10',
            },
            {
                key: 'backgroundOpacity',
                                group: BG_GROUP,
                type: 'number',
                label: { 'zh-CN': '底色不透明度', en: 'Background opacity' },
                defaultValue: 0.45,
                min: 0.05,
                max: 1,
                step: 0.05,
            },
            {
                key: 'cornerRadius',
                                group: BG_GROUP,
                type: 'number',
                label: { 'zh-CN': '圆角', en: 'Corner radius' },
                defaultValue: 12,
                min: 0,
                max: 28,
                step: 1,
            },
            {
                key: 'border',
                                group: BG_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '窗口描边', en: 'Window border' },
                description: {
                    'zh-CN': '一圈 1px 亮边，深色壁纸上更像一块浮起来的板子。',
                    en: 'A 1px light edge so it reads as a floating panel on dark wallpapers.',
                },
                defaultValue: true,
            },
            {
                key: 'playedColor',
                                group: TEXT_GROUP,
                type: 'color',
                label: { 'zh-CN': '已唱颜色', en: 'Played color' },
                defaultValue: '#ffffff',
            },
            {
                key: 'unplayedOpacity',
                                group: TEXT_GROUP,
                type: 'number',
                label: { 'zh-CN': '未唱亮度', en: 'Unplayed brightness' },
                description: {
                    'zh-CN': 'AMLL 用透明度区分已唱 / 未唱，没有独立的未唱颜色；越小未唱的字越淡。',
                    en: 'AMLL separates sung and unsung words by opacity, not by color; lower means dimmer.',
                },
                defaultValue: 0.5,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            {
                key: 'shadowColor',
                                group: TEXT_GROUP,
                type: 'color',
                label: { 'zh-CN': '描影颜色', en: 'Shadow color' },
                description: {
                    'zh-CN': '任何壁纸上都读得清用的投影颜色。',
                    en: 'Shadow color that keeps the text readable on any wallpaper.',
                },
                defaultValue: '#000000',
            },
            {
                key: 'followTheme',
                                group: TEXT_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '跟随主题文字颜色', en: 'Follow theme text color' },
                description: {
                    'zh-CN': '打开后用当前主题的主色当已唱颜色，关掉用上面的颜色。',
                    en: 'Use the theme primary color as the played color.',
                },
                defaultValue: false,
            },
            {
                key: 'textBackgroundMask',
                                group: TEXT_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '歌词底色遮罩', en: 'Text background mask' },
                description: {
                    'zh-CN': '在歌词行后面垫一层半透明底，浅色壁纸下更好读。',
                    en: 'A translucent plate behind each line for light wallpapers.',
                },
                defaultValue: false,
            },
            {
                key: 'backgroundMaskColor',
                                group: TEXT_GROUP,
                type: 'color',
                label: { 'zh-CN': '遮罩颜色', en: 'Mask color' },
                defaultValue: '#000000',
            },
            {
                key: 'opacity',
                                group: WHOLE_GROUP,
                type: 'number',
                label: { 'zh-CN': '不透明度', en: 'Opacity' },
                defaultValue: 0.95,
                min: 0.2,
                max: 1,
                step: 0.02,
            },
            {
                key: 'pausedOpacity',
                type: 'number',
                                group: WHOLE_GROUP,
                label: { 'zh-CN': '暂停时不透明度', en: 'Opacity while paused' },
                description: {
                    'zh-CN': '暂停时淡下去，不挡桌面；1 表示暂停也不变。',
                    en: 'Fades while paused; 1 keeps it unchanged.',
                },
                defaultValue: 1,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
];

export default function activate(folium) {
    // 导出等非主上下文没有播放、歌词和 RPC 服务，注册了也用不上；宿主会把 activate 里的
    // 异常直接记成「client activate: ...」，所以这里整套都跳过。
    if (folium.env && folium.env.context && folium.env.context !== 'main') return () => {};

    // main 入口没加载（或模组只装了 client）时 rpc 会一直 reject。这里吞掉并只记一次，
    // 但 3 秒后允许重试：main 比 client 晚挂好、或重载时短暂断开的场景都能自己恢复。
    let rpcRetryAt = 0;
    let rpcWarned = false;
    const call = (name, payload) => {
        if (Date.now() < rpcRetryAt) return Promise.resolve(null);
        let result;
        try {
            result = folium.rpc.call(name, payload);
        } catch (error) {
            result = Promise.reject(error);
        }
        return Promise.resolve(result)
            .then((value) => {
                rpcWarned = false;
                rpcRetryAt = 0;
                return value;
            })
            .catch((error) => {
                rpcRetryAt = Date.now() + 3000;
                if (!rpcWarned) {
                    rpcWarned = true;
                    folium.log.warn('[desktop-lyric] main 入口暂不可用，3 秒后重试', error);
                }
                return null;
            });
    };
    const push = (name, payload) => call(name, payload);


// ---------------------------------------------------------------- 设置分区

    const section = folium.registries.settingsSections.register({
        id: 'desktop-lyric',
        label: LABEL,
        description: {
            'zh-CN': '桌面歌词窗口的形态与外观。窗口本身用命令面板的「桌面歌词：开关」打开。',
            en: 'Shape and look of the desktop lyrics window. Open it with the "Desktop lyrics: toggle" command.',
            'zh-TW': '桌面歌詞視窗的形態與外觀。',
        },
        settings: MAIN_FIELDS,
        settingsPanel: (container, ctx) => createSettingsPanel({ fields: MAIN_FIELDS })(container, ctx),
    });

    // ---------------------------------------------------------------- 字体分区

    const fonts = folium.registries.settingsSections.register({
        id: 'fonts',
        label: { 'zh-CN': '桌面歌词 · 字体', en: 'Desktop lyrics · Fonts', 'zh-TW': '桌面歌詞 · 字型' },
        description: {
            'zh-CN': '从本机已安装的字体里选。拼起来是「西文 → 中文 → 主字体 → 回退」，没字形就往后落。',
            en: 'Picked from installed fonts. The stack is Latin → CJK → main → fallback; a glyph missing above falls through.',
        },
        settings: [
            { key: 'fontFamily', type: 'text', label: { 'zh-CN': '主字体', en: 'Main font' }, defaultValue: '' },
            { key: 'fontLatin', type: 'text', label: { 'zh-CN': '西文字体', en: 'Latin font' }, defaultValue: '' },
            { key: 'fontCjk', type: 'text', label: { 'zh-CN': '中文字体', en: 'CJK font' }, defaultValue: '' },
            {
                key: 'fontFallback',
                type: 'text',
                label: { 'zh-CN': '回退字体', en: 'Fallback font' },
                defaultValue: 'sans-serif',
            },
        ],
        // FoliumMount 是函数本身，不是 { mount }：直接给挂载函数。
        settingsPanel: createFontPanel({
            loadFamilies: () => call('fonts'),
            resolveFontStack: (theme) => folium.theme.resolveFontStack(theme),
        }),
    });

    const readSettings = () => {
        // 字体单独一个分区（带自己的选择器面板），两边的值合起来用。
        const values = { ...section.settings.get(), ...fonts.settings.get() };
        const mode = values.mode === 'board' || values.mode === 'double' ? values.mode : 'single';
        const color = (value, fallback) => (typeof value === 'string' ? value : fallback);
        return {
            mode,
            fontSize: Math.round(Number(values.fontSize) || 30),
            backgroundMode:
                values.backgroundMode === 'none' || values.backgroundMode === 'theme' ? values.backgroundMode : 'color',
            backgroundColor: color(values.backgroundColor, '#0b0b10'),
            backgroundOpacity: Math.min(Math.max(Number(values.backgroundOpacity) || 0.45, 0.02), 1),
            cornerRadius: Math.min(Math.max(Math.round(Number(values.cornerRadius) || 0), 0), 28),
            border: values.border !== false,
            showTranslation: values.showTranslation !== false,
            showRomanization: values.showRomanization === true,
            align:
                values.align === 'left' || values.align === 'right' || values.align === 'both' ? values.align : 'center',
            verticalPosition: Math.min(Math.max(Number(values.verticalPosition) || 0.5, 0.1), 0.9),
            wordFadeWidth: Math.min(Math.max(Number(values.wordFadeWidth) || 1, 0.05), 2),
            fontWeight: Math.min(Math.max(Math.round(Number(values.fontWeight) || 400), 100), 900),
            translationScale: Math.min(Math.max(Number(values.translationScale) || 0.5, 0.2), 1.2),
            enableSpring: values.enableSpring !== false,
            blurUpcoming: values.blurUpcoming !== false,
            hidePassedLines: values.hidePassedLines === true,
            skipTaskbar: values.skipTaskbar !== false,
            ignoreHover: values.ignoreHover === true,
            lockPosition: values.lockPosition === true,
            headerMode: values.headerMode === 'always' || values.headerMode === 'never' ? values.headerMode : 'hover',
            fontFamily: typeof values.fontFamily === 'string' ? values.fontFamily : '',
            fontLatin: typeof values.fontLatin === 'string' ? values.fontLatin : '',
            fontCjk: typeof values.fontCjk === 'string' ? values.fontCjk : '',
            fontFallback: typeof values.fontFallback === 'string' ? values.fontFallback : 'sans-serif',
            springMass: Math.min(Math.max(Number(values.springMass) || 1, 0.2), 5),
            springStiffness: Math.min(Math.max(Number(values.springStiffness) || 100, 10), 800),
            springDamping: Math.min(Math.max(Number(values.springDamping) || 10, 0.5), 60),
            wheelFontSize: values.wheelFontSize === true,
            hideWithoutLyrics: values.hideWithoutLyrics === true,
            letterSpacing: Math.min(Math.max(Number(values.letterSpacing) || 0, -0.1), 0.3),
            translationOpacity: Math.min(Math.max(Number(values.translationOpacity) || 0.3, 0.05), 1),
            pausedOpacity: Math.min(Math.max(Number(values.pausedOpacity) || 1, 0.05), 1),
            playedColor: color(values.playedColor, '#ffffff'),
            unplayedOpacity: Math.min(Math.max(Number(values.unplayedOpacity) || 0.5, 0.05), 1),
            shadowColor: color(values.shadowColor, '#000000'),
            textBackgroundMask: values.textBackgroundMask === true,
            backgroundMaskColor: color(values.backgroundMaskColor, '#000000'),
            alwaysShowPlayInfo: values.alwaysShowPlayInfo === true,
            followTheme: values.followTheme === true,
            opacity: Number(values.opacity) || 0.95,
            alwaysOnTop: values.alwaysOnTop !== false,
            lock: values.lock === true,
        };
    };

    // 窗口高度被拖大拖小的时候，main 会把它换算回字号推过来，这里落成设置值。
    const setFontSize = (size) => {
        const next = Math.round(Number(size));
        if (!Number.isFinite(next)) return;
        const current = readSettings().fontSize;
        if (Math.abs(next - current) <= 1) return;
        section.settings.set({ fontSize: next });
    };

    // ---------------------------------------------------------------- 歌词投影

    // 宿主主题只能在主题变化事件里读到（没有 getTheme），先记下来，用默认白字起步。
    let theme = null;
    // 快照里每 200ms 都要带主题；字体栈只在主题变化时解析一次，别在定时器里反复算。
    let themePayload = null;

    const setTheme = (next) => {
        theme = next || null;
        themePayload = null;
        if (!theme) return;
        let fontStack = '';
        try {
            if (typeof folium.theme?.resolveFontStack === 'function') {
                fontStack = folium.theme.resolveFontStack(theme) || '';
            }
        } catch (error) {
            folium.log.warn('[desktop-lyric] 解析主题字体失败', error);
        }
        themePayload = {
            color: theme.primaryColor || '#ffffff',
            background: theme.backgroundColor || '',
            fontStack,
        };
    };

    // 「左右交替」用 AMLL 的对唱行标记实现：奇数行右对齐，偶数行左对齐。
    let liveAlign = 'center';

    const toMs = (value) => {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.round(number * 1000)) : 0;
    };

    const toWord = (word) => {
        const start = toMs(word && word.startTime);
        const end = Math.max(start + 1, toMs(word && word.endTime));
        return { w: word && typeof word.text === 'string' ? word.text : '', s: start, e: end };
    };

    const toPayloadLine = (line, index, background = false) => {
        const source = line || {};
        const start = toMs(source.startTime);
        const end = Math.max(start + 1, toMs(source.endTime));
        return {
            x: background ? source.text || '' : source.fullText || '',
            t: start,
            e: end,
            tr: source.translation || '',
            ro: source.romanization || '',
            bg: background ? 1 : 0,
            d: background ? 0 : liveAlign === 'both' ? index % 2 : source.agentId ? 1 : 0,
            w: (source.words || []).map(toWord).filter((word) => word.w),
        };
    };

    // AMLL 的 isBG 行必须紧跟它的主行，所以背景人声插在所属行后面。
    const toPayloadLines = (sourceLines) => {
        const out = [];
        const input = Array.isArray(sourceLines) ? sourceLines : [];
        for (let index = 0; index < input.length; index += 1) {
            const line = input[index];
            if (!line || typeof line !== 'object') continue;
            out.push(toPayloadLine(line, index));
            for (const vocal of line.backgroundVocals || []) {
                if (vocal && typeof vocal === 'object') out.push(toPayloadLine(vocal, index, true));
            }
        }
        return out;
    };

    let lines = [];
    let linesVersion = 0;

    const setLines = (next) => {
        try {
            lines = toPayloadLines(next);
            linesVersion += 1;
        } catch (error) {
            // 歌词数据坏了也不要把异常甩给事件回调；保留上一份能显示的行。
            folium.log.warn('[desktop-lyric] 歌词投影失败，保留旧歌词', error);
        }
    };

    const refreshLines = () => {
        let next;
        try {
            if (!folium.lyrics || typeof folium.lyrics.getLines !== 'function') return;
            next = folium.lyrics.getLines() || [];
        } catch (error) {
            // 桥接被摘掉时歌词也一起没了：保留窗口现有的行，别一读不到就清空。
            if (isBridgeUnavailable(error)) return;
            folium.log.warn('[desktop-lyric] 读取歌词失败', error);
            next = [];
        }
        setLines(next);
    };

    // ---------------------------------------------------------------- 快照推送

    // 歌词行只在版本变了的时候随快照走：一首歌几十行、每行带逐字时间，每 200ms 重发一遍
    // 纯属浪费 IPC 和结构化克隆。
    let deliveredLinesVersion = -1;

    // 桥接还没挂好时返回 null：这一帧不发，等它挂回来再补。
    const readPlayback = () => {
        try {
            if (!folium.playback || typeof folium.playback.getState !== 'function') return null;
            return folium.playback.getState();
        } catch (error) {
            if (!isBridgeUnavailable(error)) throw error;
            return null;
        }
    };

    const snapshot = (withLines) => {
        const playback = readPlayback();
        if (!playback) return null;
        const song = playback.song;
        const sendLines = withLines || linesVersion !== deliveredLinesVersion;
        return {
            payload: {
                title: song ? song.title : '',
                artist: song ? song.artist : '',
                album: song && song.album ? song.album : '',
                state: playback.state,
                position: playback.position,
                duration: playback.duration,
                ...(sendLines ? { lines } : {}),
                linesVersion,
                theme: themePayload,
            },
            sendLines,
        };
    };

    let lastPosition = -1;
    let lastAt = 0;
    let lastState = '';
    let lastLinesVersion = -1;
    let lastSentAt = 0;
    let playbackReady = false;

    const pushState = (force = false, withLines = false) => {
        let result;
        try {
            result = snapshot(withLines);
        } catch (error) {
            // 快照出问题不能从定时器或事件回调里冒出去：记一行，下一拍再试。
            folium.log.warn('[desktop-lyric] 生成快照失败，跳过这一帧', error);
            return;
        }
        if (!result) {
            if (playbackReady) folium.log.warn('[desktop-lyric] 播放桥接暂不可用，等它挂回来再推送');
            playbackReady = false;
            return;
        }
        const payload = result.payload;
        // 桥接刚挂回来：不管有没有变化都先补一帧，否则窗口会一直停在旧状态。
        const recovered = !playbackReady;
        playbackReady = true;

        const now = Date.now();
        const unchanged =
            !force &&
            payload.state === lastState &&
            payload.linesVersion === lastLinesVersion &&
            (payload.state !== 'playing' ||
                Math.abs(payload.position - (lastPosition + (now - lastAt) / 1000)) * 1000 < DRIFT_TOLERANCE_MS);

        if (!recovered && unchanged && now - lastSentAt < HEARTBEAT_MS) return;

        lastPosition = payload.position;
        lastAt = now;
        lastState = payload.state;
        lastLinesVersion = payload.linesVersion;
        lastSentAt = now;
        const sent = push('state', payload);
        // 行只有在真的送出去之后才算送达；IPC 失败时下次快照还会带行。
        if (result.sendLines) {
            Promise.resolve(sent).then((value) => {
                if (value === null) deliveredLinesVersion = -1;
            }).catch(() => {
                deliveredLinesVersion = -1;
            });
        }
    };

    let settingsTimer = null;
    let settingsDirty = false;

    const flushSettings = () => {
        settingsTimer = null;
        if (!settingsDirty) return;
        settingsDirty = false;
        push('settings', readSettings());
    };

    const pushSettings = (immediate = false) => {
        settingsDirty = true;
        if (immediate) {
            if (settingsTimer !== null) {
                clearTimeout(settingsTimer);
                settingsTimer = null;
            }
            flushSettings();
            return;
        }
        if (settingsTimer === null) settingsTimer = setTimeout(flushSettings, 50);
    };

    // ---------------------------------------------------------------- 窗口回来的命令

    const toggleLock = () => {
        try {
            section.settings.set({ lock: readSettings().lock !== true });
        } catch (error) {
            if (!isBridgeUnavailable(error)) folium.log.warn('[desktop-lyric] 切换锁定时写入设置失败', error);
        }
    };

    const tryPlayback = (method) => {
        try {
            const action = folium.playback && folium.playback[method];
            if (typeof action !== 'function') {
                folium.log.info('[desktop-lyric] 播放桥接暂不可用，忽略这次控制');
                return;
            }
            action.call(folium.playback);
            folium.log.info(`[desktop-lyric] playback.${method}()`);
        } catch (error) {
            // 桥接没挂好不是「控制失败」，别在日志里报成错误。
            if (isBridgeUnavailable(error)) folium.log.info('[desktop-lyric] 播放桥接暂不可用，忽略这次控制');
            else folium.log.error(`[desktop-lyric] playback.${method}() 失败`, error);
        }
        // 命令生效后位置/状态都会变，立刻补一帧给窗口。
        pushState(true);
    };

    const runCommand = (name, payload) => {
        switch (name) {
            case 'playpause':
                tryPlayback('toggle');
                break;
            case 'next':
                tryPlayback('next');
                break;
            case 'previous':
                tryPlayback('previous');
                break;
            case 'sync':
                refreshLines();
                pushState(true, true);
                break;
            case 'lock':
                toggleLock();
                break;
            case 'font-size':
                setFontSize(payload && payload.value);
                break;
            default:
                break;
        }
    };

    // main → client 的推送是 Folium 1.7 才有的。1.6 上改成 client 主动来取：
    // 窗口按钮 → main 排队 → 这里每 150ms 取一次执行。两条路只走一条，不会重复执行。
    const foliumMinor = () => (folium.host && folium.host.folium ? Number(folium.host.folium.minor) || 0 : 0);
    // 两种到达方式共用这一处解析：main 发的是 { channel, payload }，真正要执行的是 payload.name。
    const dispatch = (channel, payload) => {
        if (channel !== 'cmd') return;
        const name = payload && typeof payload.name === 'string' ? payload.name : '';
        if (!name) return;
        try {
            runCommand(name, payload);
        } catch (error) {
            if (!isBridgeUnavailable(error)) folium.log.warn(`[desktop-lyric] 执行命令 ${name} 失败`, error);
        }
    };

    if (foliumMinor() >= 7 && typeof folium.rpc.on === 'function') {
        folium.rpc.on('cmd', (payload) => dispatch('cmd', payload));
    } else {
        folium.every(150, () => {
            call('take-commands').then((queued) => {
                if (!Array.isArray(queued)) return;
                for (const entry of queued) {
                    if (!entry || typeof entry !== 'object') continue;
                    dispatch(entry.name, entry.payload);
                }
            }).catch(() => {});
        });
    }

    // ---------------------------------------------------------------- 事件

    // 宿主的事件回调里抛异常会被记成「界面代码出错」；这里统一兜住，桥接错误只当作暂时读不到。
    const safeHandler = (label, handler) => (event) => {
        try {
            return handler(event);
        } catch (error) {
            if (isBridgeUnavailable(error)) {
                playbackReady = false;
                return undefined;
            }
            folium.log.warn(`[desktop-lyric] ${label} 处理失败`, error);
            return undefined;
        }
    };

    folium.events.on('lyrics.loaded', safeHandler('lyrics.loaded', (event) => {
        setLines(event && event.lines ? event.lines : []);
        pushState(true);
    }));
    folium.events.on('playback.songChanged', safeHandler('playback.songChanged', () => {
        // 新歌的歌词还没到：先把上一首的清掉，免得窗口继续显示旧歌词。
        setLines([]);
        pushState(true);
    }));
    folium.events.on('playback.stateChanged', safeHandler('playback.stateChanged', () => pushState(true)));
    folium.events.on('playback.seeked', safeHandler('playback.seeked', () => pushState(true)));
    folium.events.on('theme.changed', safeHandler('theme.changed', (event) => {
        setTheme(event && event.theme);
        pushState(true);
    }));

    fonts.settings.onChange(() => pushSettings());

    section.settings.onChange(() => {
        const next = readSettings();
        if (next.align !== liveAlign) {
            // 左右交替改的是每行的对齐标记，必须重铺一次歌词。
            liveAlign = next.align;
            refreshLines();
        }
        pushSettings();
        if (theme) pushState(true);
    });

    // ---------------------------------------------------------------- 命令

    folium.registries.commands.register({
        id: 'toggle',
        label: { 'zh-CN': '桌面歌词：开关', en: 'Desktop lyrics: toggle', 'zh-TW': '桌面歌詞：開關' },
        description: {
            'zh-CN': '打开或关闭独立的桌面歌词窗口。',
            en: 'Show or hide the standalone desktop lyrics window.',
        },
        keywords: ['lyric', 'desktop', '歌词', '桌面'],
        // globalShortcut 是 Folium 1.7 的命令字段；1.6 上不声明，命令照样在命令面板里。
        ...(foliumMinor() >= 7 ? { globalShortcut: true } : {}),
        run: async () => {
            const result = await call('toggle');
            return { message: result && result.open ? '桌面歌词已打开' : '桌面歌词已关闭' };
        },
    });

    folium.registries.commands.register({
        id: 'lock',
        label: { 'zh-CN': '桌面歌词：锁定 / 解锁', en: 'Desktop lyrics: lock / unlock' },
        description: {
            'zh-CN': '切换歌词窗口的鼠标穿透。',
            en: 'Toggle click-through on the lyrics window.',
        },
        ...(foliumMinor() >= 7 ? { globalShortcut: true } : {}),
        run: () => {
            toggleLock();
        },
    });

    // ---------------------------------------------------------------- 启动

    // 初始化只做「读一次现状 + 推一帧」；任何一步失败都不应该让 activate 抛给宿主。
    const start = (label, fn) => {
        try {
            fn();
        } catch (error) {
            if (!isBridgeUnavailable(error)) folium.log.warn(`[desktop-lyric] 初始化 ${label} 失败`, error);
        }
    };
    start('对齐', () => {
        liveAlign = readSettings().align;
    });
    start('歌词', refreshLines);
    start('设置', () => pushSettings(true));
    start('首帧', () => pushState(true));

    const timer = folium.every(TICK_MS, () => {
        // 桥接没挂好、手里又还没有歌词时重读一次：挂回来的那一帧就能带上行，
        // 不用等下一次 lyrics.loaded。已经有词就不重复序列化。
        if (!playbackReady && lines.length === 0) refreshLines();
        pushState(false);
    });

    return () => {
        timer();
        if (settingsTimer !== null) {
            clearTimeout(settingsTimer);
            settingsTimer = null;
        }
        call('window-closed', { reason: 'mod-stopped' });
    };
}
