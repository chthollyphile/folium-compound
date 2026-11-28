// mods/sweet-lyrics/client.mjs — 甜甜歌词 v2.4.0
//
// 视觉参照用户提供的演唱会现场视频（10 秒之后）：
//   · 紫色 / 粉色的舞台烟雾与从顶部打下来的光束；
//   · 奶白色、圆滚滚的卡通大字，逐字大小与角度错落，几乎不带描边；
//   · 爱心是「霓虹描边 + 颗粒」的灯牌感，中等大小、散落在字后；
//   · 小气泡、小圆点、四角星点缀在字的周围。
//
// 歌词数据沿用 Folia 的真实结构：line.fullText + line.words[].text/startTime/endTime。
// 歌词永远最后绘制，压在所有光效与粒子之上。

import { FONT_MAIN_DATA_URL } from './font.mjs';

const SWEET_FONT_NAME = 'SweetLyricsMain';
let fontPromise = null;

const loadFace = async (name, url) => {
    if (!url) return false;
    try {
        const face = new FontFace(name, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        return true;
    } catch (error) {
        console.warn(`[sweet-lyrics] 字体 ${name} 加载失败，退回系统字体`, error);
        return false;
    }
};

const ensureFont = () => {
    if (fontPromise) return fontPromise;
    if (typeof FontFace !== 'function' || !document.fonts) {
        fontPromise = Promise.resolve(false);
        return fontPromise;
    }
    fontPromise = loadFace(SWEET_FONT_NAME, FONT_MAIN_DATA_URL);
    return fontPromise;
};

const PALETTES = {
    sweet: {
        skyTop: '#1c0620',
        skyMid: '#3a0d33',
        skyBottom: '#150312',
        hazeA: 'rgba(255,80,190,',
        hazeB: 'rgba(150,60,255,',
        beamA: 'rgba(255,222,246,',
        beamB: 'rgba(255,150,225,',
        fillTop: '#fffafc',
        fillMid: '#fff0f8',
        fillBottom: '#ffd9ec',
        textGlow: 'rgba(255,170,220,0.16)',
        textOutline: 'rgba(188,86,133,0.52)',
        heartLine: 'rgba(255,170,225,0.85)',
        heartGlow: 'rgba(255,120,200,',
        heartDot: ['#ffc3e6', '#ff9fd6', '#ffe6f5', '#ff87c8'],
        softHeartLine: 'rgba(244,200,222,0.5)',
        softHeartGlow: 'rgba(255,205,230,',
        softHeartDot: ['#f2dce7', '#eac9da', '#faf0f6', '#dfc2d1'],
        dots: ['#ffd6ee', '#fff2c8', '#d9c8ff', '#c8ecff', '#ffc9d8'],
        star: '#fff6fb',
        bubble: 'rgba(255,235,250,0.75)',
        flowerPetal: ['#ffcfec', '#ffeaf9', '#f4d4ff'],
        flowerCore: '#c979d0',
        doodle: 'rgba(255,138,186,',
    },
    starlight: {
        skyTop: '#050b1c',
        skyMid: '#0d1f42',
        skyBottom: '#03060f',
        hazeA: 'rgba(70,150,255,',
        hazeB: 'rgba(120,90,255,',
        beamA: 'rgba(226,244,255,',
        beamB: 'rgba(140,200,255,',
        fillTop: '#f9fdff',
        fillMid: '#eef7ff',
        fillBottom: '#cfe8ff',
        textGlow: 'rgba(160,215,255,0.16)',
        textOutline: 'rgba(64,108,158,0.52)',
        heartLine: 'rgba(160,215,255,0.85)',
        heartGlow: 'rgba(110,170,255,',
        heartDot: ['#bfe4ff', '#8fc8ff', '#e6f5ff', '#79bcff'],
        softHeartLine: 'rgba(190,215,238,0.5)',
        softHeartGlow: 'rgba(200,225,255,',
        softHeartDot: ['#dbe6f0', '#c8d8e5', '#eff8ff', '#b9ccdb'],
        dots: ['#cfe8ff', '#e0d4ff', '#fff2c8', '#c8f0ec', '#bcd8ff'],
        star: '#ffffff',
        bubble: 'rgba(230,245,255,0.75)',
        flowerPetal: ['#cfe6ff', '#eaf5ff', '#d9d2ff'],
        flowerCore: '#7e9be8',
        doodle: 'rgba(150,198,255,',
    },
};

// 舞台色循环：每 5 秒换一组灯色，音乐主色以玫粉 / 紫罗兰为主，
// 中间穿插冰蓝、青绿、琥珀，5 道光束同组不同色。
const STAGE_PHASES = [
    {
        name: '玫瑰',
        beams: [[255, 92, 168], [238, 120, 214], [186, 100, 255], [255, 172, 110], [84, 200, 255]],
        bgTop: '#1c0517',
        bgMid: '#480b35',
        bgBottom: '#100208',
        hazeA: [255, 80, 190],
        hazeB: [150, 60, 255],
    },
    {
        name: '紫罗兰',
        beams: [[188, 104, 255], [230, 130, 255], [132, 96, 255], [255, 158, 220], [86, 224, 232]],
        bgTop: '#180724',
        bgMid: '#3a1050',
        bgBottom: '#0b0416',
        hazeA: [180, 100, 255],
        hazeB: [110, 70, 255],
    },
    {
        name: '冰蓝',
        beams: [[92, 190, 255], [150, 228, 255], [92, 112, 255], [255, 140, 235], [180, 255, 232]],
        bgTop: '#051022',
        bgMid: '#0a2546',
        bgBottom: '#02060f',
        hazeA: [70, 150, 255],
        hazeB: [120, 90, 255],
    },
    {
        name: '青绿',
        beams: [[80, 235, 205], [150, 255, 220], [92, 200, 255], [255, 196, 112], [232, 132, 255]],
        bgTop: '#041a18',
        bgMid: '#0a3230',
        bgBottom: '#02080a',
        hazeA: [62, 222, 200],
        hazeB: [70, 180, 255],
    },
    {
        name: '琥珀',
        beams: [[255, 196, 96], [255, 154, 96], [255, 232, 164], [255, 118, 178], [122, 212, 255]],
        bgTop: '#200e04',
        bgMid: '#401a06',
        bgBottom: '#0c0402',
        hazeA: [255, 170, 80],
        hazeB: [255, 112, 120],
    },
];

const SETTINGS_SCHEMA = [
    {
        key: 'heartCount',
        type: 'number',
        group: { 'zh-CN': '背景', en: 'Backdrop' },
        label: { 'zh-CN': '爱心灯牌数量', en: 'Heart count' },
        description: {
            'zh-CN': '饱满颗粒爱心的个数，默认 8，最多 12。',
            en: 'How many plump particle hearts. Default 8, up to 12.',
        },
        min: 6,
        max: 12,
        step: 1,
        defaultValue: 8,
    },
    {
        key: 'density',
        type: 'number',
        group: { 'zh-CN': '背景', en: 'Backdrop' },
        label: { 'zh-CN': '星尘密度', en: 'Dust density' },
        description: {
            'zh-CN': '小圆点、气泡、星星的总量倍率。',
            en: 'Multiplier on how many dots, bubbles and stars float around.',
        },
        min: 0.3,
        max: 2.5,
        step: 0.1,
        defaultValue: 1.2,
    },
    {
        key: 'stageLight',
        type: 'select',
        group: { 'zh-CN': '背景', en: 'Backdrop' },
        label: { 'zh-CN': '舞台光束', en: 'Stage lights' },
        description: {
            'zh-CN': '顶部打下来的光束与烟雾，关掉会更干净。',
            en: 'Overhead light beams and haze; turn off for a cleaner look.',
        },
        defaultValue: 'on',
        options: [
            { value: 'on', label: { 'zh-CN': '开', en: 'On' } },
            { value: 'off', label: { 'zh-CN': '关', en: 'Off' } },
        ],
    },
    {
        key: 'textScale',
        type: 'number',
        group: { 'zh-CN': '歌词', en: 'Lyrics' },
        label: { 'zh-CN': '字号', en: 'Text size' },
        description: {
            'zh-CN': '整行歌词的字号倍率，长句会自动缩小，不会出屏。',
            en: 'Scale of the lyric line; long lines shrink automatically and never leave the frame.',
        },
        min: 0.7,
        max: 1.6,
        step: 0.05,
        defaultValue: 1,
    },
    {
        key: 'bounce',
        type: 'number',
        group: { 'zh-CN': '歌词', en: 'Lyrics' },
        label: { 'zh-CN': '跳动幅度', en: 'Bounce' },
        description: {
            'zh-CN': '每个字的大小、高低、角度错落：0 是整齐一行，1 是现场大屏那种活泼感。',
            en: 'Per-glyph size/offset/rotation stagger, like the live-house screen.',
        },
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.75,
    },
    {
        key: 'decor',
        type: 'select',
        group: { 'zh-CN': '歌词', en: 'Lyrics' },
        label: { 'zh-CN': '字上小装饰', en: 'Glyph decorations' },
        description: {
            'zh-CN': '字角的小气泡、小星星、小圆点。',
            en: 'Tiny bubbles, stars and dots around the glyphs.',
        },
        defaultValue: 'on',
        options: [
            { value: 'on', label: { 'zh-CN': '开', en: 'On' } },
            { value: 'off', label: { 'zh-CN': '关', en: 'Off' } },
        ],
    },
    {
        key: 'nextLine',
        type: 'select',
        group: { 'zh-CN': '歌词', en: 'Lyrics' },
        label: { 'zh-CN': '显示下一句', en: 'Show next line' },
        description: {
            'zh-CN': '在主歌词下方再显示一行小一号的下一句。',
            en: 'Show a smaller upcoming line under the main lyric.',
        },
        defaultValue: 'on',
        options: [
            { value: 'on', label: { 'zh-CN': '开', en: 'On' } },
            { value: 'off', label: { 'zh-CN': '关', en: 'Off' } },
        ],
    },
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length) % list.length];

const hexRgb = (hex) => {
    const v = String(hex).replace('#', '');
    return [
        parseInt(v.slice(0, 2), 16),
        parseInt(v.slice(2, 4), 16),
        parseInt(v.slice(4, 6), 16),
    ];
};
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgbCss = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const rgbaCss = (c, a) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

// 重音 / 高音字的暖金色，和奶白粉字最搭，也不会被舞台灯色吃掉
const ACCENT_TEXT = {
    top: [255, 247, 198],
    mid: [255, 210, 120],
    bottom: [255, 160, 96],
    outline: [214, 120, 48],
    glow: [255, 198, 104],
};

// 还没唱到的字用灰调，唱过之后恢复奶白粉
const GRAY_TEXT = {
    top: '#c8c2cb',
    mid: '#b3abb6',
    bottom: '#9b939f',
    outline: 'rgba(92,84,96,0.34)',
};

// 每 5 秒切换一组灯色；最后 0.55 秒交叉过渡，避免硬跳色
const stageAt = (time) => {
    const clock = Number.isFinite(time) ? time : 0;
    const span = 5;
    const total = STAGE_PHASES.length * span;
    const pos = ((clock % total) + total) % total;
    const index = Math.floor(pos / span);
    const next = (index + 1) % STAGE_PHASES.length;
    const local = pos - index * span;
    const k = local > span - 0.55 ? easeOut((local - (span - 0.55)) / 0.55) : 0;
    const A = STAGE_PHASES[index];
    const B = STAGE_PHASES[next];
    return {
        name: k > 0.5 ? B.name : A.name,
        beams: A.beams.map((c, i) => mixRgb(c, B.beams[i], k)),
        hazeA: mixRgb(A.hazeA, B.hazeA, k),
        hazeB: mixRgb(A.hazeB, B.hazeB, k),
        bgTop: rgbCss(mixRgb(hexRgb(A.bgTop), hexRgb(B.bgTop), k)),
        bgMid: rgbCss(mixRgb(hexRgb(A.bgMid), hexRgb(B.bgMid), k)),
        bgBottom: rgbCss(mixRgb(hexRgb(A.bgBottom), hexRgb(B.bgBottom), k)),
    };
};

const resolveSettings = (ctx) => {
    const raw = (typeof ctx.getSettings === 'function' ? ctx.getSettings() : null) ?? {};
    return {
        heartCount: Number.isFinite(Number(raw.heartCount)) ? Number(raw.heartCount) : 8,
        density: Number.isFinite(Number(raw.density)) ? Number(raw.density) : 1.2,
        stageLight: raw.stageLight ?? 'on',
        textScale: Number.isFinite(Number(raw.textScale)) ? Number(raw.textScale) : 1,
        bounce: Number.isFinite(Number(raw.bounce)) ? Number(raw.bounce) : 0.75,
        decor: raw.decor ?? 'on',
        nextLine: raw.nextLine ?? 'on',
    };
};

/* ---------------- 歌词数据 ---------------- */
const lineTextOf = (line) => {
    if (!line) return '';
    if (typeof line.fullText === 'string' && line.fullText.length) return line.fullText;
    if (typeof line.text === 'string' && line.text.length) return line.text;
    if (Array.isArray(line.words)) return line.words.map((w) => String(w?.text ?? '')).join('');
    return '';
};

const graphemesOf = (text) => {
    try {
        if (typeof Intl === 'object' && typeof Intl.Segmenter === 'function') {
            const seg = new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' });
            return Array.from(seg.segment(text), (item) => item.segment);
        }
    } catch {
        /* 回落 */
    }
    return Array.from(text);
};

const finite = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const buildCharTimeline = (line, lineStart, lineEnd) => {
    const graphemes = graphemesOf(lineTextOf(line));
    if (!graphemes.length) return [];
    const words = (Array.isArray(line?.words) ? line.words : []).filter(
        (w) => w && typeof w.text === 'string' && finite(w.startTime) !== null && finite(w.endTime) !== null,
    );
    if (!words.length) {
        const unit = Math.max(0.05, lineEnd - lineStart) / graphemes.length;
        return graphemes.map((char, i) => ({
            char,
            startTime: lineStart + unit * i,
            endTime: lineStart + unit * (i + 1),
        }));
    }
    const timeline = new Array(graphemes.length);
    let cursor = 0;
    let lastEnd = lineStart;
    words.forEach((word) => {
        const wg = graphemesOf(String(word.text ?? ''));
        if (!wg.length) return;
        const wStart = clamp(Number(word.startTime), lineStart, lineEnd);
        const wEnd = clamp(Math.max(wStart, Number(word.endTime)), lineStart, lineEnd);
        let found = -1;
        for (let i = cursor; i <= graphemes.length - wg.length; i += 1) {
            let ok = true;
            for (let k = 0; k < wg.length; k += 1) {
                if (graphemes[i + k] !== wg[k]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                found = i;
                break;
            }
        }
        const start = found >= 0 ? found : cursor;
        for (let i = cursor; i < start; i += 1) timeline[i] = { char: graphemes[i], startTime: wStart, endTime: wStart };
        const unit = (wEnd - wStart) / Math.max(1, wg.length);
        for (let k = 0; k < wg.length; k += 1) {
            const idx = start + k;
            if (idx >= graphemes.length) break;
            timeline[idx] = { char: graphemes[idx], startTime: wStart + unit * k, endTime: wStart + unit * (k + 1) };
        }
        cursor = Math.min(graphemes.length, start + wg.length);
        lastEnd = Math.max(lastEnd, wEnd);
    });
    for (let i = 0; i < graphemes.length; i += 1) {
        if (!timeline[i]) timeline[i] = { char: graphemes[i], startTime: lastEnd, endTime: lastEnd };
    }
    return timeline;
};

/* ---------------- 挂载 ---------------- */
const mountSweet = (container, ctx) => {
    const root = document.createElement('div');
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    root.appendChild(canvas);
    container.appendChild(root);

    const surface = (typeof ctx.getSurface === 'function' ? ctx.getSurface() : null) ?? {};
    let settings = resolveSettings(ctx);
    const themeName = 'stage';
    const palette = PALETTES.sweet;

    const c2d = canvas.getContext('2d');
    let width = 960;
    let height = 540;
    let dpr = 1;

    const readTime = () => {
        try {
            const clock = ctx.currentTime;
            if (typeof clock === 'number') return clock;
            if (typeof clock === 'function') return Number(clock());
            if (clock && typeof clock.get === 'function') return Number(clock.get());
        } catch {
            /* ignore */
        }
        return NaN;
    };

    /* ---------------- 形状 ---------------- */
    const heartPath = (c, s) => {
        c.beginPath();
        c.moveTo(0, s * 0.36);
        c.bezierCurveTo(0, s * 0.05, -s * 0.56, s * 0.05, -s * 0.56, -s * 0.2);
        c.bezierCurveTo(-s * 0.56, -s * 0.58, -s * 0.16, -s * 0.62, 0, -s * 0.3);
        c.bezierCurveTo(s * 0.16, -s * 0.62, s * 0.56, -s * 0.58, s * 0.56, -s * 0.2);
        c.bezierCurveTo(s * 0.56, s * 0.05, 0, s * 0.05, 0, s * 0.36);
        c.closePath();
    };

    const starPath = (c, r) => {
        c.beginPath();
        for (let i = 0; i < 4; i += 1) {
            const a = (Math.PI / 2) * i - Math.PI / 2;
            const b = a + Math.PI / 4;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            c.lineTo(Math.cos(b) * r * 0.22, Math.sin(b) * r * 0.22);
        }
        c.closePath();
    };

    // 五角星：正在唱的字上方的大星星和小拖尾都用它
    const star5Path = (c, r, rot = 0) => {
        c.beginPath();
        for (let i = 0; i < 10; i += 1) {
            const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
            const rr = i % 2 ? r * 0.44 : r;
            c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
    };

    // 五瓣圆花（参照第四张图）：胖花瓣 + 深色圆心
    const drawFlowerShape = (c, r, petals, core) => {
        for (let i = 0; i < 5; i += 1) {
            const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            c.fillStyle = petals[i % petals.length];
            c.beginPath();
            c.arc(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.5, 0, Math.PI * 2);
            c.fill();
        }
        c.fillStyle = core;
        c.beginPath();
        c.arc(0, 0, r * 0.36, 0, Math.PI * 2);
        c.fill();
    };

    /* ---------------- 背景：随灯光变化的舞台底色 + 烟雾 + 光束 ---------------- */
    const drawBackground = (stage) => {
        const g = c2d.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, stage.bgTop);
        g.addColorStop(0.5, stage.bgMid);
        g.addColorStop(1, stage.bgBottom);
        if (surface.transparent) {
            c2d.fillStyle = 'rgba(6,2,10,0.94)';
            c2d.fillRect(0, 0, width, height);
            c2d.globalAlpha = 0.72;
            c2d.fillStyle = g;
            c2d.fillRect(0, 0, width, height);
            c2d.globalAlpha = 1;
        } else {
            c2d.fillStyle = g;
            c2d.fillRect(0, 0, width, height);
        }
        // 舞台边缘和没被灯照到的地方压暗，中间留给光
        const vg = c2d.createRadialGradient(
            width * 0.5,
            height * 0.46,
            height * 0.12,
            width * 0.5,
            height * 0.46,
            Math.max(width, height) * 0.78,
        );
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(0.55, 'rgba(0,0,0,0.08)');
        vg.addColorStop(1, 'rgba(0,0,0,0.58)');
        c2d.fillStyle = vg;
        c2d.fillRect(0, 0, width, height);
    };

    const drawHaze = (now, stage) => {
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i += 1) {
            const cx = width * (0.22 + 0.28 * i) + Math.sin(now * 0.11 + i * 2.1) * width * 0.08;
            const cy = height * (0.36 + 0.16 * i) + Math.cos(now * 0.09 + i * 1.4) * height * 0.06;
            const r = height * (0.62 + 0.14 * i);
            const color = i % 2 ? stage.hazeB : stage.hazeA;
            const g = c2d.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, rgbaCss(color, 0.22));
            g.addColorStop(0.45, rgbaCss(color, 0.1));
            g.addColorStop(1, rgbaCss(color, 0));
            c2d.fillStyle = g;
            c2d.fillRect(0, 0, width, height);
        }
        c2d.restore();
    };

    /* ---------------- 聚光灯重音脉冲 ---------------- */
    // 直接读 Folia 的低频能量做 onset 检测，检测不到音频时用固定慢拍兜底
    const createSpotBeat = () => {
        let previousLow = 0;
        let mean = 0;
        let variance = 0;
        let lastBeat = -Infinity;
        return {
            step(audio, time, dt) {
                if (!audio || typeof audio.getBands !== 'function') return false;
                const bands = audio.getBands();
                if (!bands) return false;
                const low = 0.7 * (Number(bands.bass) || 0) + 0.3 * (Number(bands.lowMid) || 0);
                const flux = Math.max(0, low - previousLow);
                previousLow = low;
                const alpha = 1 - Math.exp(-Math.max(dt, 0) / 1.0);
                const deviation = Math.sqrt(Math.max(variance, 0));
                const threshold = Math.max(0.008, mean + 1.45 * deviation);
                const sinceLast = time - lastBeat;
                const onset = flux > threshold && sinceLast >= 0.24;
                mean += alpha * (flux - mean);
                variance += alpha * ((flux - mean) ** 2 - variance);
                if (onset || sinceLast >= 1.8) {
                    lastBeat = time;
                    return true;
                }
                return false;
            },
        };
    };

    // 高音检测：看高频段的上升通量，不和低频重音互相干扰
    const highBandValue = (audio) => {
        try {
            if (typeof audio.getBands === 'function') {
                const bands = audio.getBands() || {};
                const values = [bands.treble, bands.high, bands.highMid, bands.mid]
                    .map((v) => Number(v))
                    .filter((v) => Number.isFinite(v) && v > 0);
                if (values.length) return Math.max(...values);
            }
            if (typeof audio.getSpectrum === 'function') {
                const spectrum = audio.getSpectrum();
                if (spectrum && spectrum.length) {
                    const from = Math.floor(spectrum.length * 0.62);
                    let total = 0;
                    let count = 0;
                    for (let i = from; i < spectrum.length; i += 1) {
                        total += Number(spectrum[i]) || 0;
                        count += 1;
                    }
                    if (count) return total / count / 255;
                }
            }
        } catch {
            /* ignore */
        }
        return 0;
    };

    const createPitchPeak = () => {
        let previous = 0;
        let mean = 0;
        let variance = 0;
        let last = -Infinity;
        return {
            step(audio, time, dt) {
                if (!audio) return false;
                const high = highBandValue(audio);
                const flux = Math.max(0, high - previous);
                previous = high;
                const alpha = 1 - Math.exp(-Math.max(dt, 0) / 0.9);
                const deviation = Math.sqrt(Math.max(variance, 0));
                const threshold = Math.max(0.006, mean + 1.25 * deviation);
                const sinceLast = time - last;
                const onset = flux > threshold && high > 0.1 && sinceLast >= 0.5;
                mean += alpha * (flux - mean);
                variance += alpha * ((flux - mean) ** 2 - variance);
                if (onset) {
                    last = time;
                    return true;
                }
                return false;
            },
        };
    };

    const spotBeat = createSpotBeat();
    let beatPulse = 0;
    let fallbackBeatClock = rand(0, 0.8);

    // 重音只用于舞台灯闪烁；歌词高亮已经改成“正在唱的字”，不再吃低频节拍
    const updateBeatPulse = (time, dt) => {
        let beat = false;
        if (ctx.audio && typeof ctx.audio.getBands === 'function') {
            beat = spotBeat.step(ctx.audio, time, dt);
        } else {
            fallbackBeatClock += dt;
            if (fallbackBeatClock >= 0.78) {
                fallbackBeatClock = 0;
                beat = true;
            }
        }
        if (beat) beatPulse = 1;
        else beatPulse *= Math.exp(-dt * 7.2);
        if (beatPulse < 0.02) beatPulse = 0;
    };

    const drawBeams = (now, stage) => {
        if (settings.stageLight === 'off') return;
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i += 1) {
            const baseX = width * (0.08 + 0.21 * i);
            const swing = Math.sin(now * 0.19 + i * 0.42) * width * 0.155;
            const apexX = baseX + swing * 0.16;
            const apexY = -height * 0.06;
            const lean = swing + Math.sin(now * 0.12 + i * 1.1) * width * 0.032;
            const spread = width * (0.07 + 0.012 * i);
            const endY = height * 1.06;
            const color = stage.beams[i % stage.beams.length];
            const strength = (0.5 + 0.16 * Math.sin(now * 0.7 + i * 2.3)) * (1 + 1.25 * beatPulse);
            const g = c2d.createLinearGradient(apexX, apexY, apexX + lean, endY);
            g.addColorStop(0, rgbaCss(color, Math.min(1, 0.58 * strength)));
            g.addColorStop(0.35, rgbaCss(color, Math.min(1, 0.22 * strength)));
            g.addColorStop(1, rgbaCss(color, 0));
            c2d.fillStyle = g;
            c2d.beginPath();
            c2d.moveTo(apexX - 4, apexY);
            c2d.lineTo(apexX + lean - spread, endY);
            c2d.lineTo(apexX + lean + spread, endY);
            c2d.closePath();
            c2d.fill();
            const lampR = Math.max(2, width * 0.006) * (1 + 0.16 * beatPulse);
            const lg = c2d.createRadialGradient(apexX, 2, 0, apexX, 2, lampR * 3);
            lg.addColorStop(0, rgbaCss(color, Math.min(1, 0.82 + 0.18 * beatPulse)));
            lg.addColorStop(1, rgbaCss(color, 0));
            c2d.fillStyle = lg;
            c2d.beginPath();
            c2d.arc(apexX, 2, lampR * 3, 0, Math.PI * 2);
            c2d.fill();
        }
        c2d.restore();
    };

    /* ---------------- 代码版跳动粒子爱心 ---------------- */
    // 参照用户给的 Python 爱心：
    // 1) 心形参数方程取边缘点；2) 边缘向心扩散；3) 大量向心散点填内部；
    // 4) 外圈 halo 随机散布；5) 用正弦曲线让全部粒子整体收缩/膨胀，形成心跳。
    let hearts = [];

    // 返回归一化心形坐标：x 约 ±0.94，y 约 -0.3 ~ 1.0
    const heartUnit = (t) => {
        const x = (16 * Math.pow(Math.sin(t), 3)) / 17;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
        return { x, y };
    };

    // 与源码 scatter_inside 同逻辑：沿指向中心的方向随机内缩
    const scatterInside = (p, beta) => {
        const rx = -beta * Math.log(Math.max(1e-6, Math.random()));
        const ry = -beta * Math.log(Math.max(1e-6, Math.random()));
        return { x: p.x * (1 - rx), y: p.y * (1 - ry) };
    };

    // 按弧长权重取点，避免心形尖端聚成一条亮线
    const heartRandomT = () => {
        for (let attempt = 0; attempt < 12; attempt += 1) {
            const t = Math.random() * Math.PI * 2;
            const dx = 48 * Math.pow(Math.sin(t), 2) * Math.cos(t);
            const dy = 13 * Math.sin(t) - 10 * Math.sin(2 * t) - 6 * Math.sin(3 * t) - 4 * Math.sin(4 * t);
            const speed = Math.hypot(dx, dy);
            if (Math.random() * 24 <= speed) return t;
        }
        return Math.random() * Math.PI * 2;
    };

    const BUCKET_ALPHAS = [0.28, 0.52, 0.86];

    const pointRecord = (p, size, colorIndex, alphaLevel) => {
        const r = Math.max(0.24, Math.hypot(p.x, p.y));
        return {
            x: p.x,
            y: p.y,
            size,
            force: 1 / Math.pow(r, 0.52),
            bucket: colorIndex * 3 + alphaLevel,
        };
    };

    const makeHeart = (index, soft) => {
        const buckets = Array.from({ length: 5 * 3 }, () => []);
        const pushPoint = (p, size, colorIndex, alphaLevel) => {
            buckets[colorIndex * 3 + alphaLevel].push(pointRecord(p, size, colorIndex, alphaLevel));
        };

        // 1. 心形轮廓点（按弧长取样）
        const core = [];
        for (let i = 0; i < 520; i += 1) {
            core.push(heartUnit(heartRandomT()));
        }
        // 轮廓本身画实：高亮核心点
        core.forEach((p) => {
            pushPoint(
                p,
                rand(1.25, 2.5),
                Math.random() < 0.16 ? 4 : Math.random() < 0.55 ? 0 : 1,
                Math.random() < 0.82 ? 2 : 1,
            );
        });

        // 2. 边缘向心扩散：每颗轮廓点再撒 2 颗，贴着边形成粗糙毛面
        core.forEach((p) => {
            for (let k = 0; k < 2; k += 1) {
                const q = scatterInside(p, 0.05);
                pushPoint(q, rand(1, 2.1), Math.random() < 0.35 ? 3 : Math.random() < 0.7 ? 1 : 0, Math.random() < 0.5 ? 2 : 1);
            }
        });

        // 3. 向心散点，铺出内部颗粒
        for (let i = 0; i < 1600; i += 1) {
            const base = core[Math.floor(Math.random() * core.length)];
            const q = scatterInside(base, rand(0.15, 0.45));
            pushPoint(
                q,
                rand(0.9, 1.9),
                Math.random() < 0.5 ? 1 : Math.random() < 0.75 ? 3 : 2,
                Math.random() < 0.45 ? 1 : 0,
            );
        }

        // 4. 外圈 halo：比心形略大、向外随机散开
        for (let i = 0; i < 1050; i += 1) {
            const base = heartUnit(heartRandomT());
            const spread = 1.02 + Math.pow(Math.random(), 1.4) * 0.22;
            const q = {
                x: base.x * spread + (Math.random() - 0.5) * 0.055,
                y: base.y * spread + (Math.random() - 0.5) * 0.055,
            };
            pushPoint(
                q,
                rand(0.8, 1.7),
                Math.random() < 0.4 ? 2 : Math.random() < 0.8 ? 0 : 4,
                Math.random() < 0.55 ? 0 : 1,
            );
        }

        // 5. 少量大颗亮白闪点
        for (let i = 0; i < 46; i += 1) {
            const base = heartUnit(heartRandomT());
            const spread = 0.97 + Math.random() * 0.15;
            pushPoint(
                { x: base.x * spread, y: base.y * spread },
                rand(1.7, 3),
                4,
                2,
            );
        }

        const h = {
            index,
            soft,
            buckets,
            sprite: null,
            spriteVariant: '',
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0,
            size: 0,
            life: 3.2,
            age: 0,
            phase: 0,
            rot: 0,
        };
        resetHeart(h, false);
        return h;
    };

    const resetHeart = (h, warm) => {
        // 和小爱心、小花同一条路径：从画面中间冒出，向四周扩散，边扩散边长大
        h.size = height * (h.soft ? rand(0.132, 0.196) : rand(0.145, 0.225));
        h.life = rand(2.9, 4.2);
        h.phase = rand(0, Math.PI * 2);
        h.rot = rand(-0.14, 0.14);

        const angle = rand(0, Math.PI * 2);
        const reach = Math.min(width, height) * rand(0.16, 0.54);
        h.startX = width * 0.5 + rand(-0.035, 0.035) * width;
        h.startY = height * 0.52 + rand(-0.03, 0.03) * height;
        h.endX = clamp(width * 0.5 + Math.cos(angle) * reach * 1.18, width * 0.07, width * 0.93);
        h.endY = clamp(height * 0.52 + Math.sin(angle) * reach * 0.9, height * 0.07, height * 0.93);

        h.age = warm ? rand(0, h.life) : -rand(0.4, 3.2);
    };

    const layoutHearts = () => {
        hearts = [];
        const count = clamp(Math.round(settings.heartCount), 6, 12);
        const softCount = Math.max(4, Math.round(count * 0.6));
        for (let i = 0; i < count; i += 1) hearts.push(makeHeart(i, false));
        for (let i = 0; i < softCount; i += 1) hearts.push(makeHeart(count + i, true));
        // 错开出现与心跳相位，整体是随机冒出
        hearts.forEach((h, i) => {
            h.age = rand(0, h.life);
            h.phase = i * 1.37;
        });
    };

    const easeBack = (t) => {
        const x = clamp(t, 0, 1) - 1;
        const c1 = 1.5;
        const c3 = c1 + 1;
        return 1 + c3 * x * x * x + c1 * x * x;
    };

    const HEART_SPRITE_SIZE = 512;
    const HEART_SPRITE_RADIUS = 190;

    const buildHeartSprite = (h) => {
        const cv = document.createElement('canvas');
        cv.width = HEART_SPRITE_SIZE;
        cv.height = HEART_SPRITE_SIZE;
        const g = cv.getContext('2d');
        if (!g) return;
        const dots = h.soft ? palette.softHeartDot : palette.heartDot;
        g.translate(HEART_SPRITE_SIZE / 2, HEART_SPRITE_SIZE / 2);
        g.globalCompositeOperation = 'lighter';
        for (let bucketIndex = 0; bucketIndex < h.buckets.length; bucketIndex += 1) {
            const bucket = h.buckets[bucketIndex];
            if (!bucket.length) continue;
            const colorIndex = Math.floor(bucketIndex / 3);
            const alphaLevel = bucketIndex % 3;
            g.fillStyle = colorIndex === 4 ? palette.star : dots[colorIndex % dots.length];
            g.globalAlpha = BUCKET_ALPHAS[alphaLevel];
            for (let i = 0; i < bucket.length; i += 1) {
                const p = bucket[i];
                const size = p.size * 2.1;
                g.fillRect(
                    p.x * HEART_SPRITE_RADIUS - size * 0.5,
                    p.y * HEART_SPRITE_RADIUS - size * 0.5,
                    size,
                    size,
                );
            }
        }
        h.sprite = cv;
        h.spriteVariant = `${themeName}:${h.soft ? 'soft' : 'main'}`;
    };

    const heartBursts = [];

    const spawnHeartBurst = (h) => {
        const dots = h.soft ? palette.softHeartDot : palette.heartDot;
        const amount = h.soft ? 12 : 20;
        for (let i = 0; i < amount; i += 1) {
            const angle = rand(0, Math.PI * 2);
            const speed = Math.min(width, height) * rand(0.035, 0.14);
            heartBursts.push({
                x: h.endX + rand(-1, 1) * h.size * 0.04,
                y: h.endY + rand(-1, 1) * h.size * 0.04,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0,
                maxLife: rand(0.42, 0.82),
                size: rand(1.7, 4.3) * (h.soft ? 0.9 : 1.1),
                kind: Math.random() < 0.32 ? 'bubble' : 'dot',
                color: Math.random() < 0.18 ? palette.star : pick(dots),
                alpha: (h.soft ? 0.5 : 0.86) * rand(0.7, 1),
            });
        }
        // 水泡炸开时再撒一圈很淡的白光
        heartBursts.push({
            x: h.endX,
            y: h.endY,
            vx: 0,
            vy: 0,
            life: 0,
            maxLife: 0.28,
            size: h.size * 0.75,
            kind: 'flash',
            color: h.soft ? palette.softHeartLine : palette.heartLine,
            alpha: h.soft ? 0.2 : 0.38,
        });
    };

    const drawHeartBursts = (dt) => {
        c2d.save();
        c2d.globalCompositeOperation = 'lighter';
        for (let i = heartBursts.length - 1; i >= 0; i -= 1) {
            const b = heartBursts[i];
            b.life += dt;
            if (b.life >= b.maxLife) {
                heartBursts.splice(i, 1);
                continue;
            }
            const fade = Math.pow(1 - b.life / b.maxLife, 1.6);
            if (b.kind !== 'flash') {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                const drag = Math.exp(-dt * 2.6);
                b.vx *= drag;
                b.vy *= drag;
            }
            c2d.globalAlpha = clamp(b.alpha * fade, 0, 1);
            if (b.kind === 'bubble') {
                c2d.strokeStyle = b.color;
                c2d.lineWidth = Math.max(1, b.size * 0.18);
                c2d.beginPath();
                c2d.arc(b.x, b.y, b.size * 1.5, 0, Math.PI * 2);
                c2d.stroke();
            } else if (b.kind === 'flash') {
                const radius = b.size * (1 + 0.55 * easeOut(b.life / b.maxLife));
                const g = c2d.createRadialGradient(b.x, b.y, 0, b.x, b.y, Math.max(1, radius));
                g.addColorStop(0, b.color);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                c2d.fillStyle = g;
                c2d.beginPath();
                c2d.arc(b.x, b.y, radius, 0, Math.PI * 2);
                c2d.fill();
            } else {
                c2d.fillStyle = b.color;
                c2d.beginPath();
                c2d.arc(b.x, b.y, b.size, 0, Math.PI * 2);
                c2d.fill();
            }
        }
        c2d.restore();
        c2d.globalAlpha = 1;
        c2d.globalCompositeOperation = 'source-over';
    };

    const drawHeart = (h, dt, now) => {
        h.age += dt;
        if (h.age >= h.life) {
            spawnHeartBurst(h);
            resetHeart(h, false);
        }
        if (h.age < 0) return;
        const variant = `${themeName}:${h.soft ? 'soft' : 'main'}`;
        if (!h.sprite || h.spriteVariant !== variant) buildHeartSprite(h);

        const t = clamp(h.age / h.life, 0, 1);
        // 从小变大；最后 0.16 秒再鼓一下，然后炸开消失
        const growT = clamp(h.age / (h.life * 0.94), 0, 1);
        const pop = lerp(0.16, 1, 1 - Math.pow(1 - growT, 2.4));
        const burstT = clamp((h.age - (h.life - 0.16)) / 0.16, 0, 1);
        const travel = easeOut(t);
        const cx = lerp(h.startX, h.endX, travel) + Math.sin(h.age * 1.1 + h.phase) * width * 0.003;
        const cy = lerp(h.startY, h.endY, travel) + Math.cos(h.age * 0.9 + h.phase) * height * 0.004;
        const alpha = clamp(h.age / 0.3, 0, 1) * (h.soft ? 0.58 : 0.94);

        // 沿用源码正弦节奏：约 0.9 秒一次收缩 / 膨胀
        const beat = Math.sin(h.age * 5.6 + h.phase);
        const beatScale = 1 - 0.1 * beat;
        const target = h.size * pop * 0.62 * beatScale * (1 + 0.14 * easeOut(burstT));
        const drawSize = (HEART_SPRITE_SIZE / HEART_SPRITE_RADIUS) * target;

        c2d.save();
        c2d.translate(cx, cy);
        c2d.rotate(h.rot + Math.sin(h.age * 0.9 + h.phase) * 0.04);
        c2d.globalCompositeOperation = 'lighter';

        // 很淡底光，衬托出心形
        c2d.globalAlpha = alpha * (h.soft ? 0.05 : 0.075);
        c2d.fillStyle = (h.soft ? palette.softHeartGlow : palette.heartGlow) + '0.22)';
        heartPath(c2d, target * 1.5);
        c2d.fill();

        c2d.globalAlpha = alpha;
        c2d.shadowColor = h.soft ? palette.softHeartLine : palette.heartLine;
        c2d.shadowBlur = target * 0.14;
        c2d.drawImage(h.sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
        c2d.shadowBlur = 0;

        c2d.restore();
        c2d.globalAlpha = 1;
        c2d.globalCompositeOperation = 'source-over';
    };
    /* ---------------- 星尘 / 气泡 / 星星 ---------------- */
    const particles = [];
    let spawnClock = 0;

    const spawnOne = (warm) => {
        const roll = Math.random();
        const kind = roll < 0.34 ? 'dot' : roll < 0.5 ? 'bubble' : roll < 0.66 ? 'star' : roll < 0.78 ? 'disc' : roll < 0.9 ? 'flower' : 'miniHeart';
        const life = rand(4, 9);
        const reach = Math.max(width, height) * rand(0.25, 0.6);
        return {
            kind,
            angle: rand(0, Math.PI * 2),
            radius: warm ? rand(0, reach * 0.6) : rand(0, width * 0.04),
            life: warm ? rand(0, life) : 0,
            maxLife: life,
            speed: reach / life,
            size:
                kind === 'dot'
                    ? rand(1.2, 3.4)
                    : kind === 'bubble'
                      ? rand(3.5, 9)
                      : kind === 'star'
                        ? rand(2.5, 5.5)
                        : kind === 'disc'
                          ? rand(3, 7)
                          : kind === 'flower'
                            ? rand(10, 18)
                            : rand(5, 9),
            spin: rand(-0.5, 0.5),
            rot: rand(0, Math.PI * 2),
            sway: rand(0.5, 1.8),
            color: kind === 'star' ? palette.star : kind === 'bubble' ? palette.bubble : pick(palette.dots),
            alpha: rand(0.3, 0.75),
        };
    };

    const targetCount = () => clamp(Math.round((width * height) / 8000 * settings.density), 40, 340);

    const seedParticles = () => {
        particles.length = 0;
        for (let i = 0; i < targetCount(); i += 1) particles.push(spawnOne(true));
    };

    const drawParticle = (p) => {
        const lifeP = clamp(p.life / p.maxLife, 0, 1);
        const alpha = clamp(p.alpha * Math.sin(Math.PI * lifeP) * 1.3, 0, 1);
        if (alpha <= 0.012) return;
        const wob = Math.sin(p.life * p.sway + p.angle * 3) * 7;
        const x = width / 2 + Math.cos(p.angle) * p.radius + wob * Math.cos(p.angle + 1.57);
        const y = height * 0.52 + Math.sin(p.angle) * p.radius * 0.72 + wob * Math.sin(p.angle + 1.57);
        c2d.save();
        c2d.globalAlpha = alpha;
        c2d.translate(x, y);
        c2d.rotate(p.rot + p.life * p.spin);
        if (p.kind === 'bubble') {
            c2d.strokeStyle = p.color;
            c2d.lineWidth = Math.max(0.9, p.size * 0.16);
            c2d.beginPath();
            c2d.arc(0, 0, p.size, 0, Math.PI * 2);
            c2d.stroke();
            c2d.globalAlpha = alpha * 0.5;
            c2d.fillStyle = p.color;
            c2d.beginPath();
            c2d.arc(-p.size * 0.3, -p.size * 0.3, p.size * 0.22, 0, Math.PI * 2);
            c2d.fill();
        } else if (p.kind === 'star') {
            c2d.fillStyle = p.color;
            starPath(c2d, p.size);
            c2d.fill();
        } else if (p.kind === 'disc') {
            c2d.fillStyle = p.color;
            c2d.globalAlpha = alpha * 0.6;
            c2d.beginPath();
            c2d.arc(0, 0, p.size, 0, Math.PI * 2);
            c2d.fill();
        } else if (p.kind === 'flower') {
            c2d.globalAlpha = alpha * 0.9;
            drawFlowerShape(c2d, p.size, palette.flowerPetal, palette.flowerCore);
        } else if (p.kind === 'miniHeart') {
            c2d.globalAlpha = alpha * 0.9;
            c2d.fillStyle = pick(palette.heartDot);
            heartPath(c2d, p.size * 2.3);
            c2d.fill();
        } else {
            c2d.fillStyle = p.color;
            c2d.beginPath();
            c2d.arc(0, 0, p.size, 0, Math.PI * 2);
            c2d.fill();
        }
        c2d.restore();
    };

    /* ---------------- 歌词 ---------------- */
    let mainMetrics = null;
    let nextMetrics = null;

    const fontSizeFor = (text, factor) => {
        const len = Math.max(1, graphemesOf(String(text ?? '')).length);
        const byWidth = (width * 0.86) / (len * 1.04);
        const ceil = height * 0.22 * factor;
        const floor = height * 0.045;
        return clamp(Math.min(byWidth, ceil), floor, ceil) * settings.textScale;
    };

    const buildMetrics = (line, lineStart, lineEnd, factor, isMain) => {
        const text = lineTextOf(line);
        if (!text) return null;
        const key = `${Math.round(width)}x${Math.round(height)}@${settings.textScale}#${factor}`;
        const cache = isMain ? mainMetrics : nextMetrics;
        if (cache && cache.text === text && cache.key === key && cache.lineRef === line) return cache;
        let fontPx = fontSizeFor(text, factor);
        const chars = graphemesOf(text);
        let widths = [];
        let totalWidth = 0;
        let gap = fontPx * 0.1;
        for (let pass = 0; pass < 3; pass += 1) {
            widths = chars.map((ch) => {
                c2d.font = `${fontPx}px "${SWEET_FONT_NAME}", 'Microsoft YaHei', sans-serif`;
                return c2d.measureText(ch === ' ' ? '\u00a0' : ch).width;
            });
            gap = fontPx * 0.1;
            totalWidth = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, chars.length - 1);
            const limit = width * 0.86;
            if (totalWidth <= limit || fontPx <= height * 0.05) break;
            fontPx *= limit / totalWidth;
        }
        const value = {
            text,
            lineRef: line,
            chars,
            timeline: buildCharTimeline(line, lineStart, lineEnd),
            widths,
            fontPx,
            totalWidth,
            gap,
            key,
            starParticles: [],
            starX: null,
            starClock: null,
            starSpawn: 0,
            starStill: 0,
            trailWall: null,
        };
        if (isMain) mainMetrics = value;
        else nextMetrics = value;
        return value;
    };

    const drawGlyph = (
        ch, x, y, fontPx, alpha, rot, scale, active,
        played = true, hot = 0, bloom = 0, clock = 0,
    ) => {
        if (!ch || ch === ' ' || ch === '\u3000') return;
        c2d.save();
        c2d.translate(x, y);
        c2d.rotate(rot);
        c2d.scale(scale, scale);
        c2d.globalAlpha = alpha * (played ? 1 : 0.9);
        c2d.textAlign = 'center';
        c2d.textBaseline = 'alphabetic';
        c2d.font = `${fontPx}px "${SWEET_FONT_NAME}", 'Microsoft YaHei', sans-serif`;

        const g = c2d.createLinearGradient(0, -fontPx * 0.8, 0, fontPx * 0.2);
        if (!played) {
            // 还没唱到的字：灰调
            g.addColorStop(0, GRAY_TEXT.top);
            g.addColorStop(0.55, GRAY_TEXT.mid);
            g.addColorStop(1, GRAY_TEXT.bottom);
        } else if (hot > 0.001) {
            // 正在唱的字只带一点点暖调，主体仍是当前奶白粉
            const warm = hot * 0.16;
            g.addColorStop(0, rgbCss(mixRgb(hexRgb(palette.fillTop), ACCENT_TEXT.top, warm)));
            g.addColorStop(0.55, rgbCss(mixRgb(hexRgb(palette.fillMid), ACCENT_TEXT.mid, warm)));
            g.addColorStop(1, rgbCss(mixRgb(hexRgb(palette.fillBottom), ACCENT_TEXT.bottom, warm)));
        } else {
            g.addColorStop(0, palette.fillTop);
            g.addColorStop(0.55, palette.fillMid);
            g.addColorStop(1, palette.fillBottom);
        }

        const inflate = (dist, style) => {
            c2d.fillStyle = style;
            const steps = 8;
            for (let k = 0; k < steps; k += 1) {
                const a = (k / steps) * Math.PI * 2;
                c2d.fillText(ch, Math.cos(a) * dist, Math.sin(a) * dist);
            }
            c2d.fillText(ch, 0, 0);
        };

        // 发光压低，只留很轻的一层柔光；动感字和光晕入场稍微亮一点
        if (played && (active || hot > 0.05 || bloom > 0.05)) {
            c2d.shadowColor = hot > 0.05
                ? rgbaCss(ACCENT_TEXT.glow, 0.14 + 0.12 * hot)
                : palette.textGlow;
            c2d.shadowBlur = fontPx * (0.009 + 0.024 * hot + 0.018 * bloom);
        }
        inflate(fontPx * 0.012, g);
        c2d.shadowBlur = 0;

        // 清晰的细轮廓：在字形真实边缘描一圈低饱和色
        c2d.lineJoin = 'round';
        c2d.strokeStyle = !played
            ? GRAY_TEXT.outline
            : (hot > 0.12 ? rgbaCss(ACCENT_TEXT.outline, 0.44 + 0.08 * hot) : palette.textOutline);
        c2d.lineWidth = Math.max(1, fontPx * (0.014 + 0.004 * hot));
        c2d.strokeText(ch, 0, 0);

        // 字身填充盖住描边内侧，只留下外轮廓线
        c2d.fillStyle = g;
        c2d.fillText(ch, 0, 0);

        if (active && settings.decor === 'on') {
            const w = c2d.measureText(ch).width;
            const seed = ch.charCodeAt(0);
            if (seed % 4 === 0) {
                c2d.globalAlpha = alpha * 0.8;
                c2d.strokeStyle = palette.bubble;
                c2d.lineWidth = Math.max(1, fontPx * 0.014);
                c2d.beginPath();
                c2d.arc(w * 0.5, -fontPx * 0.55, fontPx * 0.06, 0, Math.PI * 2);
                c2d.stroke();
            } else if (seed % 4 === 1) {
                c2d.globalAlpha = alpha * 0.85;
                c2d.fillStyle = palette.star;
                c2d.save();
                c2d.translate(-w * 0.45, -fontPx * 0.62);
                starPath(c2d, fontPx * 0.07);
                c2d.fill();
                c2d.restore();
            } else if (seed % 4 === 3) {
                c2d.globalAlpha = alpha * 0.7;
                c2d.fillStyle = palette.bubble;
                c2d.beginPath();
                c2d.arc(w * 0.46, -fontPx * 0.12, fontPx * 0.032, 0, Math.PI * 2);
                c2d.fill();
            }
        }
        c2d.restore();
    };

    /* ---------------- 歌词随机出场动画 ---------------- */
    // 每句按「文字 + 起始时间」固定抽一种出场方式，同一句不会每帧变来变去
    const ENTRANCE_STYLES = [
        'fade', 'dissolve', 'typewriter', 'fly', 'wipe', 'zoom', 'impact', 'spin',
        'bounce', 'bloom', 'wave',
    ];

    const hashString = (s) => {
        let h = 2166136261;
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    };

    const hashUnit = (i, salt) => {
        const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
        return x - Math.floor(x);
    };

    const pickEntranceStyle = (m, start) =>
        ENTRANCE_STYLES[hashString(`${m.text}#${Math.round(start * 1000)}`) % ENTRANCE_STYLES.length];

    const entranceDuration = (style, count) => {
        if (style === 'typewriter') return clamp(0.38 + count * 0.052, 0.6, 1.15);
        if (style === 'impact') return 0.5;
        if (style === 'zoom') return 0.62;
        if (style === 'fly') return 0.78;
        if (style === 'dissolve') return 0.88;
        if (style === 'wipe') return 0.82;
        if (style === 'spin') return 0.8;
        if (style === 'bounce') return 0.86;
        if (style === 'bloom') return 0.94;
        if (style === 'wave') return 0.84;
        return 0.72;
    };

    // 当前正在唱的字：刚开口 0.86 秒内的最新一个；下一个字开口就自然接棒
    const pickLiveChar = (m, time) => {
        let live = -1;
        m.timeline.forEach((entry, i) => {
            const s = finite(entry.startTime) ?? 0;
            if (time >= s && time - s < 0.86) live = i;
        });
        return live;
    };

    const pickSungChar = (m, time) => {
        let sung = -1;
        m.timeline.forEach((entry, i) => {
            const s = finite(entry.startTime) ?? 0;
            if (time >= s) sung = i;
        });
        return sung;
    };

    const charCenterX = (m, index, left, driftX) => {
        let x = left + driftX;
        for (let i = 0; i < index; i += 1) x += m.widths[i] + m.gap;
        return x + m.widths[index] / 2;
    };

    const drawFiveStar = (x, y, r, rot, al) => {
        if (al <= 0.01 || r <= 0.5) return;
        c2d.save();
        c2d.translate(x, y);
        c2d.rotate(rot);
        c2d.globalAlpha = clamp(al, 0, 1);
        const sg = c2d.createLinearGradient(0, -r, 0, r);
        sg.addColorStop(0, '#fffafc');
        sg.addColorStop(0.48, '#ffd9ec');
        sg.addColorStop(1, '#ffc15e');
        c2d.fillStyle = sg;
        c2d.shadowColor = 'rgba(255,196,112,0.6)';
        c2d.shadowBlur = r * 1.05;
        star5Path(c2d, r, 0);
        c2d.fill();
        c2d.shadowBlur = 0;
        c2d.strokeStyle = 'rgba(255,158,96,0.52)';
        c2d.lineWidth = Math.max(1, r * 0.06);
        star5Path(c2d, r, 0);
        c2d.stroke();
        c2d.restore();
    };

    // 小星星用预渲染精灵，避免几十颗逐帧 shadowBlur 拖慢画面
    const SMALL_STAR_CANVAS = 128;
    const SMALL_STAR_RADIUS = 44;
    let smallStarSprite = null;
    const ensureSmallStarSprite = () => {
        if (smallStarSprite) return smallStarSprite;
        const canvas = document.createElement('canvas');
        canvas.width = SMALL_STAR_CANVAS;
        canvas.height = SMALL_STAR_CANVAS;
        const g = canvas.getContext('2d');
        if (!g) return null;
        g.translate(SMALL_STAR_CANVAS / 2, SMALL_STAR_CANVAS / 2);
        const sg = g.createLinearGradient(0, -SMALL_STAR_RADIUS, 0, SMALL_STAR_RADIUS);
        sg.addColorStop(0, '#fffafc');
        sg.addColorStop(0.48, '#ffd9ec');
        sg.addColorStop(1, '#ffc15e');
        g.fillStyle = sg;
        g.shadowColor = 'rgba(255,190,108,0.62)';
        g.shadowBlur = SMALL_STAR_RADIUS * 1.1;
        star5Path(g, SMALL_STAR_RADIUS, 0);
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = 'rgba(255,158,96,0.5)';
        g.lineWidth = Math.max(1, SMALL_STAR_RADIUS * 0.055);
        star5Path(g, SMALL_STAR_RADIUS, 0);
        g.stroke();
        smallStarSprite = canvas;
        return smallStarSprite;
    };
    const drawSmallStar = (x, y, r, rot, al) => {
        if (al <= 0.01 || r <= 0.5) return;
        const sprite = ensureSmallStarSprite();
        if (!sprite) {
            drawFiveStar(x, y, r, rot, al);
            return;
        }
        const scale = r / SMALL_STAR_RADIUS;
        c2d.save();
        c2d.translate(x, y);
        c2d.rotate(rot);
        c2d.globalAlpha = clamp(al, 0, 1);
        c2d.drawImage(
            sprite,
            -SMALL_STAR_CANVAS / 2 * scale,
            -SMALL_STAR_CANVAS / 2 * scale,
            SMALL_STAR_CANVAS * scale,
            SMALL_STAR_CANVAS * scale,
        );
        c2d.restore();
    };

    // 大星星整句常驻：跟着最后一个已唱的字移动；小星星持续生成、落后就淡出
    const updateLineStars = (m, time, left, driftX, baseY, liveIndex, opacity) => {
        const sung = pickSungChar(m, time);
        if (sung < 0 || opacity <= 0.01) return;

        const anchorIndex = liveIndex >= 0 ? liveIndex : sung;
        const targetX = charCenterX(m, anchorIndex, left, driftX);
        const songDt = m.starClock === null ? 0.016 : clamp(time - m.starClock, 0, 0.05);
        if (m.starClock !== null && time - m.starClock < -0.2) {
            m.starX = targetX;
            m.starParticles.length = 0;
        }
        if (m.starX === null) m.starX = targetX;
        else m.starX = lerp(m.starX, targetX, clamp(songDt * 11, 0, 1));
        m.starClock = time;

        const wallNow = (typeof performance === 'object' && performance.now
            ? performance.now()
            : Date.now()) / 1000;
        const rawWallDt = m.trailWall === null ? 1 / 60 : clamp(wallNow - m.trailWall, 0, 0.05);
        const wallDt = rawWallDt > 0.001 ? rawWallDt : 1 / 60;
        m.trailWall = wallNow;

        // 歌在走就认定大星星在动；暂停超过 0.18 秒就停下，小星星不再补新并逐渐消失
        if (songDt > 0.0005) m.starStill = 0;
        else m.starStill = (m.starStill ?? 0) + wallDt;
        const moving = m.starStill < 0.18;
        const starX = m.starX + Math.sin(time * 4.2) * m.fontPx * 0.1;
        const starY = baseY - m.fontPx * 1.08 - Math.abs(Math.sin(time * 6.4)) * m.fontPx * 0.06;
        const bigR = m.fontPx * 0.32;

        if (moving && opacity > 0.35 && m.starParticles.length < 34) {
            m.starSpawn += wallDt * 20;
            while (m.starSpawn >= 1 && m.starParticles.length < 34) {
                m.starSpawn -= 1;
                m.starParticles.push({
                    x: starX + rand(-0.72, 0.18) * m.fontPx,
                    y: starY + rand(-0.22, 0.26) * m.fontPx,
                    vx: rand(-0.2, 0.2) * m.fontPx,
                    vy: rand(0.06, 0.34) * m.fontPx,
                    size: m.fontPx * rand(0.055, 0.16),
                    rot: rand(0, Math.PI * 2),
                    spin: rand(-1.6, 1.6),
                    phase: rand(0, Math.PI * 2),
                    alpha: rand(0.62, 1),
                    life: 0,
                    maxLife: rand(0.7, 1.3),
                });
            }
        } else if (!moving) {
            m.starSpawn = 0;
        }

        for (let i = m.starParticles.length - 1; i >= 0; i -= 1) {
            const p = m.starParticles[i];
            const pDt = Math.max(wallDt, songDt);
            p.life += pDt;
            if (p.life >= p.maxLife) {
                m.starParticles.splice(i, 1);
                continue;
            }
            p.vy += m.fontPx * 0.28 * pDt;
            p.x += (p.vx + Math.sin(p.life * 6 + p.phase) * m.fontPx * 0.14) * pDt;
            p.y += p.vy * pDt;
            p.rot += p.spin * pDt;
            const k = 1 - p.life / p.maxLife;
            drawSmallStar(
                p.x,
                p.y,
                p.size * (0.72 + 0.28 * k),
                p.rot,
                p.alpha * k * opacity,
            );
        }

        drawFiveStar(starX, starY, bigR, time * 2.8, opacity);
    };

    const drawLineShape = (m, time, lineAlpha, baseYRatio, sizeJitter, entrance = null) => {
        const baseY = height * baseYRatio + m.fontPx * 0.3;
        const driftX = Math.sin(time * 0.5) * m.fontPx * 0.03;
        const count = m.chars.length;
        const style = entrance?.style ?? null;
        const total = entranceDuration(style, count);
        const age = entrance ? Math.max(0, time - entrance.start) : 999;
        const p = clamp(age / total, 0, 1);
        const pe = easeOut(p);
        const left = width / 2 - m.totalWidth / 2;
        const liveIndex = entrance?.live ? pickLiveChar(m, time) : -1;

        c2d.save();
        if (style === 'impact') {
            const shake = (1 - pe) * m.fontPx;
            c2d.translate(Math.sin(time * 46) * shake * 0.035, Math.cos(time * 52) * shake * 0.018);
        }
        c2d.translate(driftX, 0);

        // 擦开：整句从左往右被一条干净的边擦出来
        if (style === 'wipe' && p < 1) {
            c2d.beginPath();
            c2d.rect(left - m.fontPx * 0.4, -height, m.totalWidth * pe + m.fontPx * 0.45, height * 2);
            c2d.clip();
        }

        let cursorX = left;
        let typedX = left;
        m.chars.forEach((ch, i) => {
            const w = m.widths[i];
            const cx = cursorX + w / 2;
            cursorX += w + m.gap;
            const entry = m.timeline[i] ?? { startTime: 0 };
            const eased = easeOut((time - entry.startTime) / 0.3);
            const hash = (i * 41 + 7) % 7;
            const zig = [0, -0.1, 0.09, -0.06, 0.04, -0.13, 0.11][hash] * settings.bounce;
            const float = Math.sin(time * 1.8 + i * 1.3) * 0.02 * settings.bounce;
            let y = baseY + (zig + float) * m.fontPx;
            let rot = (([0, -4, 3.5, -3, 4, -5, 3][hash] * settings.bounce) * Math.PI) / 180;
            const sizeJ = 1 + [0, 0.1, -0.06, 0.14, -0.04, 0.08, -0.1][hash] * settings.bounce * sizeJitter;
            let scale = sizeJ * lerp(0.92, 1, eased);
            let alphaMul = 1;
            let bloom = 0;
            let dx = 0;
            let dy = 0;
            const cp = clamp((age - i * 0.012) / total, 0, 1);
            const ce = easeOut(cp);

            if (style === 'fade') {
                alphaMul = clamp(p * 1.3, 0, 1);
                dy += (1 - pe) * m.fontPx * 0.1;
            } else if (style === 'dissolve') {
                const k = hashUnit(i, 11);
                const dp = clamp((p * 1.45 - k * 0.45) / 0.55, 0, 1);
                alphaMul = dp;
                dx += (1 - dp) * (hashUnit(i, 12) - 0.5) * m.fontPx * 0.3;
                dy += (1 - dp) * (hashUnit(i, 13) - 0.35) * m.fontPx * 0.2;
                rot += (1 - dp) * (hashUnit(i, 14) - 0.5) * 0.28;
            } else if (style === 'typewriter') {
                const tp = clamp((p * (count + 0.35) - i) / 1.25, 0, 1);
                alphaMul = tp;
                scale *= lerp(0.78, 1, easeBack(tp));
                if (tp > 0.55) typedX = cx + w / 2;
            } else if (style === 'fly') {
                const dir = i % 2 ? 1 : -1;
                dx += (1 - ce) * width * 0.34 * dir;
                dy += (1 - ce) * m.fontPx * 0.5 * (i % 3 ? 1 : -1);
                rot += (1 - ce) * 0.2 * (i % 3 ? 1 : -1);
                scale *= 0.55 + 0.45 * ce;
                alphaMul = clamp(cp * 1.35, 0, 1);
            } else if (style === 'zoom') {
                scale *= lerp(0.16, 1, easeBack(cp));
                alphaMul = clamp(cp * 1.35, 0, 1);
            } else if (style === 'impact') {
                scale *= 1 + 0.9 * (1 - ce);
                dy += -(1 - ce) * m.fontPx * 0.42;
                rot += (1 - ce) * 0.055 * (i % 2 ? 1 : -1);
                alphaMul = clamp(cp * 2.4, 0, 1);
            } else if (style === 'spin') {
                rot += (1 - ce) * 0.95 * (i % 2 ? 1 : -1);
                scale *= 0.34 + 0.66 * ce;
                dy += -(1 - ce) * m.fontPx * 0.26;
                alphaMul = clamp(cp * 1.3, 0, 1);
            } else if (style === 'bounce') {
                // 弹跳落字：从上方落下，落地时带一点压扁回弹
                const bp = clamp((age - i * 0.03) / 0.55, 0, 1);
                const be = easeOut(bp);
                const land = Math.sin(bp * Math.PI * 2.6) * Math.exp(-bp * 3);
                dy += -(1 - be) * m.fontPx * 1.25;
                scale *= 1 + 0.14 * land;
                rot += (1 - be) * 0.08 * (i % 2 ? 1 : -1);
                alphaMul = clamp(cp * 2.2, 0, 1);
            } else if (style === 'bloom') {
                // 光晕绽放：小字带着柔光长大，光慢慢收掉
                const bp = easeOut(clamp(cp * 1.25, 0, 1));
                scale *= lerp(0.32, 1, easeBack(cp));
                bloom = clamp(1 - cp, 0, 1) * 0.85;
                dy += (1 - bp) * m.fontPx * 0.06;
                rot += (1 - bp) * 0.04 * (i % 2 ? 1 : -1);
                alphaMul = clamp(cp * 1.6, 0, 1);
            } else if (style === 'wave') {
                // 波浪涌起：字从下方一浪一浪抬上来，左右轻轻摆
                const wp = clamp(p * 1.25 - i * 0.035, 0, 1);
                const we = easeOut(wp);
                dy += (1 - we) * m.fontPx * 0.62;
                dx += Math.sin(wp * Math.PI) * m.fontPx * 0.16 * (i % 2 ? 1 : -1);
                rot += (1 - we) * 0.22 * (i % 2 ? 1 : -1);
                scale *= 0.72 + 0.28 * we;
                alphaMul = clamp(wp * 1.4, 0, 1);
            }

            const startAt = finite(entry.startTime) ?? 0;
            const played = time >= startAt - 0.001;
            let hot = 0;
            if (i === liveIndex) {
                const at = clamp((time - startAt) / 0.86, 0, 1);
                if (at < 0.16) hot = easeOut(at / 0.16);
                else if (at > 0.64) hot = 1 - easeOut((at - 0.64) / 0.36);
                else hot = 1;
            }
            if (hot > 0) {
                // 动感字：放大到 1.3 倍，再带一点跳动和摆动
                scale *= 1 + 0.3 * hot;
                rot += Math.sin(time * 10 + i * 1.3) * 0.06 * hot;
                dy -= Math.abs(Math.sin(time * 9 + i * 0.8)) * m.fontPx * 0.05 * hot;
            }
            const glyphAlpha = clamp(lineAlpha * (0.66 + 0.34 * eased) * alphaMul, 0, 1);
            if (glyphAlpha <= 0.01) return;
            drawGlyph(
                ch,
                cx + dx,
                y + dy,
                m.fontPx,
                glyphAlpha,
                rot,
                scale,
                eased > 0.5 && alphaMul > 0.55,
                played,
                hot,
                bloom,
                time,
            );
        });

        // 打字机光标：字打完后自动消失
        if (style === 'typewriter' && p < 0.98) {
            c2d.globalAlpha = lineAlpha * 0.72;
            c2d.fillStyle = palette.star;
            c2d.fillRect(typedX + m.fontPx * 0.04, baseY - m.fontPx * 0.66, m.fontPx * 0.045, m.fontPx * 0.72);
            c2d.globalAlpha = 1;
        }
        c2d.restore();

        // 大星星整句不消失，只在句末淡出；小星星由 updateLineStars 持续生成
        if (entrance?.live) {
            const starStart = entrance.start ?? time;
            const starEnd = entrance.end ?? (starStart + 3);
            if (time >= starStart && time <= starEnd) {
                const fadeIn = clamp((time - starStart) / 0.18, 0, 1);
                const fadeOut = 1 - clamp((time - (starEnd - 0.12)) / 0.12, 0, 1);
                const starOpacity = lineAlpha * fadeIn * fadeOut;
                updateLineStars(m, time, left, driftX, baseY, liveIndex, starOpacity);
            }
        }
    };

    // 手绘涂鸦爱心：粗粉笔描边 + 内部斜线排线 + 外圈虚线
    const drawDoodleHeart = (x, y, s, alpha, rot) => {
        if (alpha <= 0.01) return;
        c2d.save();
        c2d.translate(x, y);
        c2d.rotate(rot);
        c2d.globalAlpha = alpha;
        c2d.strokeStyle = `${palette.doodle}0.62)`;
        c2d.lineWidth = Math.max(1, s * 0.035);
        c2d.setLineDash([s * 0.14, s * 0.09]);
        heartPath(c2d, s * 1.16);
        c2d.stroke();
        c2d.setLineDash([]);
        c2d.strokeStyle = `${palette.doodle}0.85)`;
        c2d.lineWidth = Math.max(1.2, s * 0.055);
        heartPath(c2d, s);
        c2d.stroke();
        // 内部排线
        c2d.save();
        heartPath(c2d, s * 0.97);
        c2d.clip();
        c2d.strokeStyle = `${palette.doodle}0.48)`;
        c2d.lineWidth = Math.max(1, s * 0.04);
        for (let i = -3; i <= 3; i += 1) {
            const off = i * s * 0.16;
            c2d.beginPath();
            c2d.moveTo(-s, -s * 0.2 + off);
            c2d.lineTo(s, s * 0.55 + off);
            c2d.stroke();
        }
        c2d.restore();
        c2d.restore();
    };

    const drawDoodles = (m, time, lineStart, lineEnd, baseAlpha) => {
        const baseY = height * 0.44 + m.fontPx * 0.3;
        const driftX = Math.sin(time * 0.5) * m.fontPx * 0.03;
        const half = m.totalWidth / 2;
        const tail = 1 - easeOut(clamp((time - (lineEnd - 0.5)) / 0.7, 0, 1));
        const alpha = baseAlpha * tail;
        if (alpha <= 0.02) return;
        const spots = [
            [width / 2 + driftX - half - m.fontPx * 0.62, baseY - m.fontPx * 0.38, m.fontPx * 0.44, -0.16],
            [width / 2 + driftX + half + m.fontPx * 0.52, baseY - m.fontPx * 0.82, m.fontPx * 0.3, 0.2],
            [width / 2 + driftX - half * 0.6, baseY - m.fontPx * 1.04, m.fontPx * 0.25, -0.1],
        ];
        spots.forEach((sp, i) => {
            const reveal = clamp((time - lineStart - 0.25 - i * 0.22) / 0.55, 0, 1);
            if (reveal <= 0) return;
            const scale = lerp(0.45, 1, easeBack(reveal));
            drawDoodleHeart(sp[0], sp[1], sp[2] * scale, alpha * 0.8, sp[3]);
        });
    };

    const resolveLines = () => (Array.isArray(ctx.lines) ? ctx.lines : []);

    const pickLineIndex = (lines, time) => {
        let idx = 0;
        for (let i = 0; i < lines.length; i += 1) {
            const s = finite(lines[i]?.startTime);
            if (s === null) continue;
            if (time >= s) idx = i;
        }
        return idx;
    };

    const drawLyrics = (time) => {
        const lines = resolveLines();
        if (lines.length === 0) {
            const song = ctx.song ?? {};
            const text = `${song.title ?? ''}${song.artist ? ' · ' + song.artist : ''}`.trim();
            if (!text) return;
            const m = buildMetrics({ fullText: text, words: [] }, 0, Math.max(2, time + 1), 1, true);
            if (m) drawLineShape(m, 0, 1, 0.5, 1);
            return;
        }
        const idx = pickLineIndex(lines, Number.isFinite(time) ? time : 0);
        const line = lines[idx];
        if (!line) return;
        const start = finite(line.startTime) ?? 0;
        const nextStart = finite(lines[idx + 1]?.startTime);
        const authoredEnd = finite(line.endTime);
        let end = authoredEnd !== null ? Math.max(authoredEnd, start + 0.4) : start + 3;
        if (nextStart !== null) end = Math.min(end, Math.max(start + 0.4, nextStart));
        const fadeIn = clamp((time - start) / 0.2 + 1, 0, 1);
        const m = buildMetrics(line, start, end, 1, true);
        if (m) {
            drawDoodles(m, time, start, end, Math.max(fadeIn, 0.92));
            drawLineShape(m, time, Math.max(fadeIn, 0.92), 0.44, 1, {
                start,
                end,
                style: pickEntranceStyle(m, start),
                live: true,
            });
        }
        if (settings.nextLine === 'on' && lines[idx + 1]) {
            const nl = lines[idx + 1];
            const ns = finite(nl.startTime) ?? end;
            const ne = finite(nl.endTime) ?? ns + 3;
            const nm = buildMetrics(nl, ns, ne, 0.52, false);
            if (nm) drawLineShape(nm, ns, 0.85, 0.66, 0.6);
        }
    };

    /* ---------------- 主循环 ---------------- */
    let rafId = 0;
    let lastTs = 0;
    let time = 0;
    let loggedError = false;

    const frame = (ts) => {
        rafId = requestAnimationFrame(frame);
        const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
        lastTs = ts;
        try {
            const now = readTime();
            if (Number.isFinite(now)) time = now;
            else time += dt;
            const sec = ts / 1000;
            const stage = stageAt(time);

            c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            c2d.clearRect(0, 0, width, height);
            drawBackground(stage);
            updateBeatPulse(time, dt);
            drawHaze(sec, stage);
            drawBeams(sec, stage);
            hearts.forEach((h) => drawHeart(h, dt, sec));
            drawHeartBursts(dt);

            spawnClock += dt;
            const rate = 12 * settings.density;
            while (spawnClock > 1 / rate) {
                spawnClock -= 1 / rate;
                if (particles.length >= targetCount()) break;
                particles.push(spawnOne(false));
            }
            for (let i = 0; i < particles.length; i += 1) {
                const p = particles[i];
                p.life += dt;
                p.radius += p.speed * dt;
                if (p.life >= p.maxLife) particles[i] = spawnOne(false);
                drawParticle(particles[i]);
            }

            drawLyrics(time);
        } catch (error) {
            if (!loggedError) {
                loggedError = true;
                console.warn('[sweet-lyrics] 帧渲染出错，继续保活', error);
            }
        }
    };

    const resize = () => {
        const w = root.clientWidth || container.clientWidth || 960;
        const h = root.clientHeight || container.clientHeight || 540;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = Math.max(240, w);
        height = Math.max(160, h);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        layoutHearts();
        seedParticles();
        mainMetrics = null;
        nextMetrics = null;
    };

    resize();
    const onResize = () => {
        settings = resolveSettings(ctx);
        resize();
    };
    let ro = null;
    try {
        ro = new ResizeObserver(onResize);
        ro.observe(root);
    } catch {
        /* ignore */
    }
    if (typeof window.addEventListener === 'function') window.addEventListener('resize', onResize);

    ensureFont().then(() => {
        mainMetrics = null;
        nextMetrics = null;
    });

    if (ctx.staticMode) {
        const lines = resolveLines();
        const idx = Number.isFinite(ctx.staticLineIndex) ? ctx.staticLineIndex : 0;
        const line = lines[clamp(idx, 0, Math.max(0, lines.length - 1))];
        const paintStatic = () => {
            const stage = stageAt(finite(ctx.staticTime) ?? 2.4);
            c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            c2d.clearRect(0, 0, width, height);
            drawBackground(stage);
            drawHaze(1.4, stage);
            drawBeams(1.4, stage);
            hearts.forEach((h, i) => {
                h.phase = i * 0.7;
                drawHeart(h, 0.016, 1.4);
            });
            particles.forEach((p) => drawParticle(p));
            const start = finite(line?.startTime) ?? 0;
            const end = finite(line?.endTime) ?? start + 3;
            const m = line ? buildMetrics(line, start, end, 1, true) : null;
            if (m) drawLineShape(m, start + 0.9, 1, 0.44, 1);
            else {
                const song = ctx.song ?? {};
                const text = `${song.title ?? ''}${song.artist ? ' · ' + song.artist : ''}`.trim();
                const mm = text ? buildMetrics({ fullText: text, words: [] }, 0, 4, 1, true) : null;
                if (mm) drawLineShape(mm, 1.6, 1, 0.44, 1);
            }
        };
        paintStatic();
        ensureFont().then((ok) => { if (ok) paintStatic(); });
        return () => {
            try { if (ro) ro.disconnect(); } catch { /* ignore */ }
            if (typeof window.removeEventListener === 'function') window.removeEventListener('resize', onResize);
            root.remove();
        };
    }

    rafId = requestAnimationFrame(frame);
    let offTime = () => {};
    try {
        if (ctx.currentTime && typeof ctx.currentTime.on === 'function') {
            const un = ctx.currentTime.on('change', () => {});
            if (typeof un === 'function') offTime = un;
        }
    } catch {
        /* ignore */
    }

    return () => {
        if (rafId) cancelAnimationFrame(rafId);
        try { offTime(); } catch { /* ignore */ }
        try { if (ro) ro.disconnect(); } catch { /* ignore */ }
        if (typeof window.removeEventListener === 'function') window.removeEventListener('resize', onResize);
        root.remove();
    };
};

export default function activate(folium) {
    folium.registries.visualizers.register({
        id: 'sweet-lyrics',
        label: { 'zh-CN': '甜甜歌词', en: 'Sweet Lyrics' },
        order: 470,
        settings: SETTINGS_SCHEMA,
        mount: (container, ctx) => mountSweet(container, ctx),
    });
}



