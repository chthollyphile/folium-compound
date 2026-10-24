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
        preview: '夜色漫过城市的边缘 — Lyrics Preview 123',
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
        preview: 'Night spills over the edge — Lyrics Preview 123',
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
.dlf { display: flex; flex-direction: column; gap: 10px; font: inherit; }
.dlf-preview {
    padding: 10px 12px; border-radius: 8px; background: rgba(127, 127, 127, 0.12);
    font-size: 19px; line-height: 1.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dlf-row { display: flex; align-items: center; gap: 10px; }
.dlf-label { flex: 0 0 84px; opacity: 0.75; font-size: 12px; }
.dlf-value {
    flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 13px;
}
.dlf-value.empty { opacity: 0.5; }
.dlf-btn {
    flex: 0 0 auto; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(127, 127, 127, 0.4);
    background: transparent; color: inherit; font: inherit; font-size: 12px; cursor: pointer;
}
.dlf-btn:hover { background: rgba(127, 127, 127, 0.18); }
.dlf-picker { margin: -2px 0 4px 94px; display: flex; flex-direction: column; gap: 6px; }
.dlf-search {
    padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(127, 127, 127, 0.4);
    background: rgba(127, 127, 127, 0.1); color: inherit; font: inherit; font-size: 12px;
}
.dlf-list {
    max-height: 220px; overflow: auto; border-radius: 6px; border: 1px solid rgba(127, 127, 127, 0.28);
}
.dlf-item {
    display: block; width: 100%; padding: 5px 10px; border: 0; background: transparent;
    color: inherit; font: inherit; font-size: 13px; text-align: left; cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dlf-item:hover { background: rgba(127, 127, 127, 0.2); }
.dlf-item.current { background: rgba(127, 127, 127, 0.26); }
.dlf-group { padding: 6px 10px 2px; font-size: 11px; opacity: 0.55; }
.dlf-note { font-size: 12px; opacity: 0.55; }
`;

// resolveFontStack 由 client 注入（那是 folium.theme 的方法，不在面板上下文里）。
const renderFontPicker = ({ loadFamilies, resolveFontStack }, container, ctx) => {
    const locale = String(ctx.locale || 'en').startsWith('zh') ? 'zh-CN' : 'en';
    const t = TEXT[locale];

    const root = document.createElement('div');
    root.className = 'dlf';
    const style = document.createElement('style');
    style.textContent = STYLE;

    const preview = document.createElement('div');
    preview.className = 'dlf-preview';
    preview.textContent = t.preview;

    const rowsHost = document.createElement('div');
    rowsHost.style.display = 'flex';
    rowsHost.style.flexDirection = 'column';
    rowsHost.style.gap = '10px';

    root.append(preview, rowsHost);
    container.append(style, root);

    let families = null;
    let familiesError = false;
    let openKey = null;
    let query = '';
    let pickerHost = null;

    const values = () => ctx.settings.get();

    // 窗口那边用的同一套拼法：西文 → 中文 → 主字体（空则主题）→ 回退。
    const buildStack = () => {
        const current = values();
        const parts = [];
        const push = (value) => {
            if (value && !parts.includes(value)) parts.push(value);
        };
        if (current.fontLatin) push(quote(String(current.fontLatin)));
        if (current.fontCjk) push(quote(String(current.fontCjk)));
        if (current.fontFamily) push(quote(String(current.fontFamily)));
        else {
            const theme = ctx.getTheme();
            if (theme && typeof resolveFontStack === 'function') push(resolveFontStack(theme));
        }
        if (current.fontFallback) push(String(current.fontFallback));
        return parts.join(', ') || 'sans-serif';
    };

    const refresh = () => {
        preview.style.fontFamily = buildStack();
        for (const row of ROWS) {
            const span = rowsHost.querySelector(`[data-value="${row.key}"]`);
            if (!span) continue;
            const value = values()[row.key];
            span.textContent = value ? String(value) : t[row.empty] || t.none;
            span.className = `dlf-value${value ? '' : ' empty'}`;
        }
        if (openKey && pickerHost) renderPicker();
    };

    const renderPicker = () => {
        if (!pickerHost) return;
        pickerHost.textContent = '';

        const search = document.createElement('input');
        search.className = 'dlf-search';
        search.placeholder = t.search;
        search.value = query;
        search.addEventListener('input', () => {
            query = search.value;
            renderList();
        });
        search.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closePicker();
            event.stopPropagation();
        });

        const list = document.createElement('div');
        list.className = 'dlf-list';

        const renderList = () => {
            list.textContent = '';
            const row = ROWS.find((entry) => entry.key === openKey);
            const current = values()[openKey] ? String(values()[openKey]) : '';

            const addItem = (value, label, group) => {
                if (group && list.dataset.group !== group) {
                    const heading = document.createElement('div');
                    heading.className = 'dlf-group';
                    heading.textContent = group;
                    list.append(heading);
                    list.dataset.group = group;
                }
                const item = document.createElement('button');
                item.type = 'button';
                item.className = `dlf-item${value === current ? ' current' : ''}`;
                item.textContent = label;
                item.addEventListener('click', () => {
                    ctx.settings.set({ [row.key]: value });
                    closePicker();
                });
                list.append(item);
            };

            list.dataset.group = '';
            addItem('', t[row.empty] || t.none, '');
            if (row.generic) {
                for (const family of GENERIC) addItem(family, family, t.fallbackGeneric);
            }
            if (families === null) {
                const note = document.createElement('div');
                note.className = 'dlf-note';
                note.textContent = familiesError ? t.empty : t.loading;
                list.append(note);
                return;
            }
            const keyword = query.trim().toLowerCase();
            const matches = keyword
                ? families.filter((family) => family.toLowerCase().includes(keyword))
                : families;
            for (const family of matches.slice(0, 300)) addItem(family, family, t.installed);
        };

        pickerHost.append(search, list);
        renderList();
        search.focus();
    };

    const closePicker = () => {
        openKey = null;
        query = '';
        if (pickerHost) {
            pickerHost.remove();
            pickerHost = null;
        }
    };

    for (const row of ROWS) {
        const line = document.createElement('div');
        line.className = 'dlf-row';

        const label = document.createElement('span');
        label.className = 'dlf-label';
        label.textContent = row.label[locale];

        const value = document.createElement('span');
        value.className = 'dlf-value';
        value.dataset.value = row.key;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dlf-btn';
        button.textContent = t.choose;
        button.addEventListener('click', () => {
            const wasOpen = openKey === row.key;
            closePicker();
            if (wasOpen) return;
            openKey = row.key;
            pickerHost = document.createElement('div');
            pickerHost.className = 'dlf-picker';
            line.after(pickerHost);
            renderPicker();
        });

        line.append(label, value, button);
        rowsHost.append(line);
    }

    refresh();

    const off = ctx.settings.onChange(refresh);
    if (typeof loadFamilies === 'function') {
        loadFamilies()
            .then((list) => {
                families = Array.isArray(list) ? list : [];
                if (openKey) renderPicker();
            })
            .catch(() => {
                familiesError = true;
                families = [];
                if (openKey) renderPicker();
            });
    } else {
        families = [];
    }

    return () => {
        off?.();
        style.remove();
        root.remove();
    };
};

const LYRICS_GROUP = { 'zh-CN': '歌词', en: 'Lyrics' };
const WINDOW_GROUP = { 'zh-CN': '窗口', en: 'Window' };
const LOOK_GROUP = { 'zh-CN': '外观', en: 'Appearance' };

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

export default function activate(folium) {
    // main 入口没加载（或模组只装了 client）时 rpc 会一直 reject，这里吞掉并只记一次。
    let rpcBroken = false;
    const call = (name, payload) => {
        if (rpcBroken) return Promise.resolve(null);
        return folium.rpc.call(name, payload).catch((error) => {
            rpcBroken = true;
            folium.log.warn('[desktop-lyric] main 入口不可用，状态不再推送', error);
            return null;
        });
    };
    const push = (name, payload) => {
        void call(name, payload);
    };

    
// ---------------------------------------------------------------- 设置分区

    const section = folium.registries.settingsSections.register({
        id: 'desktop-lyric',
        label: LABEL,
        description: {
            'zh-CN': '桌面歌词窗口的形态与外观。窗口本身用命令面板的「桌面歌词：开关」打开。',
            en: 'Shape and look of the desktop lyrics window. Open it with the "Desktop lyrics: toggle" command.',
            'zh-TW': '桌面歌詞視窗的形態與外觀。',
        },
        settings: [
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
                key: 'fontSize',
                group: LYRICS_GROUP,
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
                key: 'showTranslation',
                type: 'boolean',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '显示翻译', en: 'Show translation' },
                defaultValue: true,
            },
            {
                key: 'showRomanization',
                type: 'boolean',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '显示音译', en: 'Show romanization' },
                description: {
                    'zh-CN': '有音译时作为第三行显示。',
                    en: 'Shown as a third line when the source has one.',
                },
                defaultValue: false,
            },
            {
                key: 'align',
                type: 'select',
                group: LYRICS_GROUP,
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
                group: LYRICS_GROUP,
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
                key: 'wordFadeWidth',
                type: 'number',
                group: LYRICS_GROUP,
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
                key: 'fontWeight',
                type: 'number',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '字重', en: 'Font weight' },
                defaultValue: 400,
                min: 300,
                max: 900,
                step: 100,
            },
            {
                key: 'letterSpacing',
                type: 'number',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '字间距', en: 'Letter spacing' },
                defaultValue: 0,
                min: -0.06,
                max: 0.2,
                step: 0.01,
            },
            {
                key: 'translationOpacity',
                type: 'number',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '翻译透明度', en: 'Translation opacity' },
                defaultValue: 0.3,
                min: 0.1,
                max: 1,
                step: 0.05,
            },
            {
                key: 'translationScale',
                type: 'number',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '翻译字号比例', en: 'Translation scale' },
                defaultValue: 0.5,
                min: 0.3,
                max: 1,
                step: 0.02,
            },
            {
                key: 'enableSpring',
                type: 'boolean',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '弹簧动画', en: 'Spring animation' },
                description: {
                    'zh-CN': '关掉回退到 CSS 过渡，省 CPU，动效单一。',
                    en: 'Turn off to fall back to CSS transitions: cheaper, plainer.',
                },
                defaultValue: true,
            },
            {
                key: 'springMass',
                type: 'number',
                group: LYRICS_GROUP,
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
                group: LYRICS_GROUP,
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
                group: LYRICS_GROUP,
                label: { 'zh-CN': '弹簧阻尼', en: 'Spring damping' },
                description: { 'zh-CN': 'AMLL 默认 10。越小越弹。', en: 'AMLL default is 10; lower bounces more.' },
                defaultValue: 10,
                min: 1,
                max: 40,
                step: 0.5,
            },
            {
                key: 'blurUpcoming',
                type: 'boolean',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '上下句模糊', en: 'Blur neighboring lines' },
                defaultValue: true,
            },
            {
                key: 'hidePassedLines',
                type: 'boolean',
                group: LYRICS_GROUP,
                label: { 'zh-CN': '隐藏已唱行', en: 'Hide passed lines' },
                description: {
                    'zh-CN': '只对多行歌词板有用，单行 / 双行本来就只留一句。',
                    en: 'Only matters on the board layout; the bar layouts already clip.',
                },
                defaultValue: false,
            },
            {
                key: 'ignoreHover',
                type: 'boolean',
                group: WINDOW_GROUP,
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
                group: WINDOW_GROUP,
                label: { 'zh-CN': '锁定位置', en: 'Lock position' },
                description: {
                    'zh-CN': '窗口钉在原地不能拖；和上面的鼠标穿透是两件事。',
                    en: 'Pins the window so it cannot be dragged; separate from click-through above.',
                },
                defaultValue: false,
            },
            {
                key: 'headerMode',
                type: 'select',
                group: WINDOW_GROUP,
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
                key: 'wheelFontSize',
                type: 'boolean',
                group: WINDOW_GROUP,
                label: { 'zh-CN': '滚轮调字号', en: 'Mouse wheel font size' },
                description: {
                    'zh-CN': '在歌词上滚滚轮改字号，滚一格 1px。',
                    en: 'Scroll on the lyrics to change the font size by 1px a notch.',
                },
                defaultValue: false,
            },
            {
                key: 'hideWithoutLyrics',
                type: 'boolean',
                group: WINDOW_GROUP,
                label: { 'zh-CN': '无歌词时隐藏', en: 'Hide without lyrics' },
                description: {
                    'zh-CN': '当前歌没有歌词时整扇窗隐形，免得挡桌面。',
                    en: 'Makes the whole window invisible while the song has no lyrics.',
                },
                defaultValue: false,
            },
            {
                key: 'skipTaskbar',
                type: 'boolean',
                group: WINDOW_GROUP,
                label: { 'zh-CN': '不在任务栏显示', en: 'Hide from taskbar' },
                defaultValue: true,
            },
            {
                key: 'pausedOpacity',
                type: 'number',
                group: WINDOW_GROUP,
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
            {
                key: 'backgroundMode',
                group: LOOK_GROUP,
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
                group: LOOK_GROUP,
                type: 'color',
                label: { 'zh-CN': '底色', en: 'Background color' },
                defaultValue: '#0b0b10',
            },
            {
                key: 'backgroundOpacity',
                group: LOOK_GROUP,
                type: 'number',
                label: { 'zh-CN': '底色不透明度', en: 'Background opacity' },
                defaultValue: 0.45,
                min: 0.05,
                max: 1,
                step: 0.05,
            },
            {
                key: 'cornerRadius',
                group: LOOK_GROUP,
                type: 'number',
                label: { 'zh-CN': '圆角', en: 'Corner radius' },
                defaultValue: 12,
                min: 0,
                max: 28,
                step: 1,
            },
            {
                key: 'border',
                group: LOOK_GROUP,
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
                group: LOOK_GROUP,
                type: 'color',
                label: { 'zh-CN': '已唱颜色', en: 'Played color' },
                defaultValue: '#ffffff',
            },
            {
                key: 'unplayedOpacity',
                group: LOOK_GROUP,
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
                group: LOOK_GROUP,
                type: 'color',
                label: { 'zh-CN': '描影颜色', en: 'Shadow color' },
                description: {
                    'zh-CN': '任何壁纸上都读得清用的投影颜色。',
                    en: 'Shadow color that keeps the text readable on any wallpaper.',
                },
                defaultValue: '#000000',
            },
            {
                key: 'textBackgroundMask',
                group: LOOK_GROUP,
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
                group: LOOK_GROUP,
                type: 'color',
                label: { 'zh-CN': '遮罩颜色', en: 'Mask color' },
                defaultValue: '#000000',
            },
            {
                key: 'alwaysShowPlayInfo',
                group: WINDOW_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '始终显示歌名', en: 'Always show song info' },
                description: {
                    'zh-CN': '关掉时歌名只在鼠标移到歌词上时出现。',
                    en: 'When off, the song name only shows while hovering.',
                },
                defaultValue: false,
            },
            {
                key: 'followTheme',
                group: LOOK_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '跟随主题文字颜色', en: 'Follow theme text color' },
                description: {
                    'zh-CN': '打开后用当前主题的主色当已唱颜色，关掉用上面的颜色。',
                    en: 'Use the theme primary color as the played color.',
                },
                defaultValue: false,
            },
            {
                key: 'opacity',
                group: LOOK_GROUP,
                type: 'number',
                label: { 'zh-CN': '不透明度', en: 'Opacity' },
                defaultValue: 0.95,
                min: 0.2,
                max: 1,
                step: 0.02,
            },
            {
                key: 'alwaysOnTop',
                group: WINDOW_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '总在最前', en: 'Always on top' },
                defaultValue: true,
            },
            {
                key: 'lock',
                group: WINDOW_GROUP,
                type: 'boolean',
                label: { 'zh-CN': '锁定（鼠标穿透）', en: 'Lock (click-through)' },
                description: {
                    'zh-CN': '锁定时整扇窗穿透，只有指针压到锁定按钮那一小块才临时解冻。默认不锁。',
                    en: 'While locked the whole window passes clicks through; only the lock button itself catches them. Off by default.',
                },
                defaultValue: false,
            },
        ],
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
            fontFamily: typeof values.fontFamily === 'string' ? values.fontFamily : '',
            opacity: Number(values.opacity) || 0.95,
            alwaysOnTop: values.alwaysOnTop !== false,
            lock: values.lock !== false,
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

    // 「左右交替」用 AMLL 的对唱行标记实现：奇数行右对齐，偶数行左对齐。
    let liveAlign = 'center';

    const toPayloadLine = (line, index) => ({
        x: line.fullText || '',
        t: Math.round(line.startTime * 1000),
        e: Math.round(line.endTime * 1000),
        tr: line.translation || '',
        ro: line.romanization || '',
        bg: 0,
        d: liveAlign === 'both' ? index % 2 : line.agentId ? 1 : 0,
        w: (line.words || []).map((word) => ({
            w: word.text,
            s: Math.round(word.startTime * 1000),
            e: Math.round(word.endTime * 1000),
        })),
    });

    // AMLL 的 isBG 行必须紧跟它的主行，所以背景人声插在所属行后面。
    const toPayloadLines = (lines) => {
        const out = [];
        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            out.push(toPayloadLine(line, index));
            for (const vocal of line.backgroundVocals || []) {
                out.push({
                    x: vocal.text || '',
                    t: Math.round(vocal.startTime * 1000),
                    e: Math.round(vocal.endTime * 1000),
                    tr: vocal.translation || '',
                    ro: vocal.romanization || '',
                    bg: 1,
                    d: 0,
                    w: (vocal.words || []).map((word) => ({
                        w: word.text,
                        s: Math.round(word.startTime * 1000),
                        e: Math.round(word.endTime * 1000),
                    })),
                });
            }
        }
        return out;
    };

    let lines = [];
    let linesVersion = 0;

    const setLines = (next) => {
        lines = toPayloadLines(next);
        linesVersion += 1;
    };

    const refreshLines = () => {
        try {
            setLines(folium.lyrics.getLines() || []);
        } catch (error) {
            folium.log.warn('[desktop-lyric] 读取歌词失败', error);
            setLines([]);
        }
    };

    // ---------------------------------------------------------------- 快照推送

    // 歌词行只在版本变了的时候随快照走：一首歌几十行、每行带逐字时间，每 200ms 重发一遍
    // 纯属浪费 IPC 和结构化克隆。
    let deliveredLinesVersion = -1;

    const snapshot = (withLines) => {
        const playback = folium.playback.getState();
        const song = playback.song;
        const sendLines = withLines || linesVersion !== deliveredLinesVersion;
        if (sendLines) deliveredLinesVersion = linesVersion;
        return {
            title: song ? song.title : '',
            artist: song ? song.artist : '',
            album: song && song.album ? song.album : '',
            state: playback.state,
            position: playback.position,
            duration: playback.duration,
            ...(sendLines ? { lines } : {}),
            linesVersion,
            theme: theme
                ? {
                    color: theme.primaryColor || '#ffffff',
                    background: theme.backgroundColor || '',
                    fontStack: folium.theme.resolveFontStack(theme),
                }
                : null,
        };
    };

    let lastPosition = -1;
    let lastAt = 0;
    let lastState = '';
    let lastLinesVersion = -1;
    let lastSentAt = 0;

    const pushState = (force = false, withLines = false) => {
        const payload = snapshot(withLines);
        const now = Date.now();
        const unchanged =
            !force &&
            payload.state === lastState &&
            payload.linesVersion === lastLinesVersion &&
            (payload.state !== 'playing' ||
                Math.abs(payload.position - (lastPosition + (now - lastAt) / 1000)) * 1000 < DRIFT_TOLERANCE_MS);

        if (unchanged && now - lastSentAt < HEARTBEAT_MS) return;

        lastPosition = payload.position;
        lastAt = now;
        lastState = payload.state;
        lastLinesVersion = payload.linesVersion;
        lastSentAt = now;
        push('state', payload);
    };

    const pushSettings = () => {
        push('settings', readSettings());
    };

    // ---------------------------------------------------------------- 窗口回来的命令

    // 播放控制失败的原因要看得见：权限没给、宿主不让控制，都会在这里留一行。
    const tryPlayback = (method) => {
        try {
            folium.playback[method]();
            folium.log.info(`[desktop-lyric] playback.${method}()`);
        } catch (error) {
            folium.log.error(`[desktop-lyric] playback.${method}() 失败`, error);
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
                section.settings.set({ lock: !readSettings().lock });
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
        if (name) runCommand(name, payload);
    };

    if (foliumMinor() >= 7) {
        folium.rpc.on('cmd', (payload) => dispatch('cmd', payload));
    } else {
        folium.every(150, () => {
            call('take-commands').then((queued) => {
                if (!Array.isArray(queued)) return;
                for (const entry of queued) {
                    if (!entry || typeof entry !== 'object') continue;
                    dispatch(entry.name, entry.payload);
                }
            });
        });
    }

    // ---------------------------------------------------------------- 事件

    folium.events.on('lyrics.loaded', ({ lines: loaded }) => {
        setLines(loaded || []);
        pushState(true);
    });
    folium.events.on('playback.songChanged', () => {
        // 新歌的歌词还没到：先把上一首的清掉，免得窗口继续显示旧歌词。
        setLines([]);
        pushState(true);
    });
    folium.events.on('playback.stateChanged', () => pushState(true));
    folium.events.on('playback.seeked', () => pushState(true));
    folium.events.on('theme.changed', ({ theme: next }) => {
        theme = next;
        pushState(true);
    });

    fonts.settings.onChange(() => pushSettings());

    section.settings.onChange(() => {
        const nextAlign = readSettings().align;
        if (nextAlign !== liveAlign) {
            // 左右交替改的是每行的对齐标记，必须重铺一次歌词。
            liveAlign = nextAlign;
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
        ...(folium.host && folium.host.folium && Number(folium.host.folium.minor) >= 7 ? { globalShortcut: true } : {}),
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
        ...(folium.host && folium.host.folium && Number(folium.host.folium.minor) >= 7 ? { globalShortcut: true } : {}),
        run: () => {
            section.settings.set({ lock: !readSettings().lock });
        },
    });

    // ---------------------------------------------------------------- 启动

    liveAlign = readSettings().align;
    refreshLines();
    pushSettings();
    pushState(true);

    const timer = folium.every(TICK_MS, () => pushState(false));

    return () => {
        timer();
        call('window-closed', { reason: 'mod-stopped' });
    };
}
