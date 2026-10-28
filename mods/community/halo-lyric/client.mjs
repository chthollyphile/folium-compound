// Halo PixelBar 歌词桥：把 Folia 当前播放的歌和歌词行，POST 给本地 HaloBridge。
// 桥接程序再通过 USB HID 把文字写到音箱点阵屏。
//
// 长句不是自己瞎滚，而是「跟着播放进度走」：按当前唱到的字算窗口起点，
// 再把窗口起点发给桥接程序，屏上只显示那一窗，所以不会越滑越落后。

const ENDPOINT = 'http://127.0.0.1:8765/state';

const LAYOUT_OPTIONS = [
    { value: 'stretch', label: { 'zh-CN': '拉伸铺满', en: 'Stretch' } },
    { value: 'center', label: { 'zh-CN': '居中', en: 'Center' } },
    { value: 'left', label: { 'zh-CN': '靠左', en: 'Left' } },
    { value: 'right', label: { 'zh-CN': '靠右', en: 'Right' } },
];

/** @param {import('folium').FoliumClientApi} folium */
export default function activate(folium) {
    const section = folium.registries.settingsSections.register({
        id: 'halo',
        label: { 'zh-CN': 'Halo PixelBar 歌词', en: 'Halo PixelBar lyrics' },
        description: {
            'zh-CN': '把当前歌词行推到花再 Halo PixelBar 点阵屏（需要 HaloBridge 在运行，且 TempoHub 已关闭）',
            en: 'Push the current lyric line to the Halo PixelBar (HaloBridge must run; close TempoHub)',
        },
        settings: [
            {
                key: 'followProgress',
                type: 'boolean',
                label: { 'zh-CN': '跟随播放进度', en: 'Follow playback progress' },
                description: {
                    'zh-CN': '打开后窗口按当前唱到的字移动，长句不会越滑越落后。关掉则自己匀速滚。',
                    en: 'The window follows the sung glyph; when off it scrolls at a fixed rate.',
                },
                defaultValue: true,
            },
            {
                key: 'frameMs',
                type: 'number',
                label: { 'zh-CN': '滑动帧间隔（毫秒）', en: 'Scroll frame interval (ms)' },
                description: {
                    'zh-CN': '关闭跟随后生效。越小越顺，太小会闪。',
                    en: 'Used when follow is off. Smaller is smoother.',
                },
                defaultValue: 220,
                min: 60,
                max: 1500,
                step: 10,
            },
            {
                key: 'stepChars',
                type: 'number',
                label: { 'zh-CN': '每帧位移（字）', en: 'Step per frame (glyphs)' },
                description: { 'zh-CN': '关闭跟随后生效。1 最平滑，2–4 扫得快。', en: 'Used when follow is off.' },
                defaultValue: 1,
                min: 1,
                max: 8,
                step: 1,
            },
            {
                key: 'windowChars',
                type: 'number',
                label: { 'zh-CN': '窗口字数', en: 'Window size (glyphs)' },
                description: {
                    'zh-CN': '一屏最多显示几个字；拉伸布局下字数越多越扁。',
                    en: 'Glyphs per frame; more glyphs means a flatter stretch.',
                },
                defaultValue: 16,
                min: 4,
                max: 30,
                step: 1,
            },
            {
                key: 'offsetMs',
                type: 'number',
                label: { 'zh-CN': '延迟补偿（毫秒）', en: 'Latency offset (ms)' },
                description: {
                    'zh-CN': '歌词比声音晚就填负数提前，早于声音就填正数。范围 -2000~2000。',
                    en: 'Negative shows lines earlier, positive later. -2000..2000.',
                },
                defaultValue: 0,
                min: -2000,
                max: 2000,
                step: 50,
            },
            {
                key: 'entryEffect',
                type: 'select',
                label: { 'zh-CN': '换行动画', en: 'Line transition' },
                description: {
                    'zh-CN': '新的一句出现时怎么进场。逐字打出最常见，闪烁最省。',
                    en: 'How a new line enters. Typewriter is the usual pick.',
                },
                defaultValue: 'typewriter',
                options: [
                    { value: 'typewriter', label: { 'zh-CN': '逐字打出', en: 'Typewriter' } },
                    { value: 'slide', label: { 'zh-CN': '从右滑入', en: 'Slide in' } },
                    { value: 'blink', label: { 'zh-CN': '闪烁一下', en: 'Blink' } },
                    { value: 'double_blink', label: { 'zh-CN': '双闪', en: 'Double blink' } },
                    { value: 'erase', label: { 'zh-CN': '擦除后重打', en: 'Erase then type' } },
                    { value: 'none', label: { 'zh-CN': '不进场', en: 'None' } },
                ],
            },
            {
                key: 'layout',
                type: 'select',
                label: { 'zh-CN': '文字布局', en: 'Text layout' },
                defaultValue: 'stretch',
                options: LAYOUT_OPTIONS,
            },
        ],
    });

    const readParams = () => {
        const values = section.settings.get();
        return {
            followProgress: values.followProgress !== false,
            frameMs: Number(values.frameMs) || 220,
            stepChars: Number(values.stepChars) || 1,
            windowChars: Number(values.windowChars) || 16,
            entryEffect: String(values.entryEffect || 'typewriter'),
            offsetMs: Number(values.offsetMs) || 0,
            layout: String(values.layout || 'stretch'),
        };
    };

    let lastKey = '';
    let lastAt = 0;
    let bridgeDown = false;

    const lineAt = (lines, t) => {
        let hit = null;
        for (const line of lines) {
            if (line.startTime <= t + 0.15) hit = line;
            else break;
        }
        return hit;
    };

    /** 当前这一行唱到了第几个字（优先用逐字时间轴，没有就按行内比例折算） */
    const sungChars = (line, t) => {
        if (!line) return 0;
        const text = line.fullText || '';
        const words = line.words;
        if (words && words.length) {
            let idx = 0;
            for (const word of words) {
                const start = word.startTime;
                const end = word.endTime > start ? word.endTime : start;
                const len = (word.text || '').length;
                if (t >= end) {
                    idx += len;
                    continue;
                }
                if (t >= start) {
                    const span = Math.max(0.001, end - start);
                    idx += len * Math.min(1, Math.max(0, (t - start) / span));
                    break;
                }
                break;
            }
            return Math.min(idx, text.length);
        }
        const duration = Math.max(0.001, (line.endTime || 0) - line.startTime);
        const ratio = Math.min(1, Math.max(0, (t - line.startTime) / duration));
        return ratio * text.length;
    };

    const push = (payload) => {
        folium.net
            .fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            .then(() => {
                if (bridgeDown) {
                    bridgeDown = false;
                    folium.log.info('HaloBridge 已连上');
                }
            })
            .catch(() => {
                if (!bridgeDown) {
                    bridgeDown = true;
                    folium.log.info('HaloBridge 未运行，歌词先不发');
                }
            });
    };

    folium.every(60, () => {
        let state;
        try {
            state = folium.playback.getState();
        } catch {
            return;
        }
        if (!state || !state.song) return;

        let lines = [];
        try {
            lines = folium.lyrics.getLines() || [];
        } catch {
            lines = [];
        }

        const params = readParams();
        const clock = state.position + (params.offsetMs || 0) / 1000;
        const line = lineAt(lines, clock);
        const text = line ? line.fullText || '' : '';
        const lineIndex = line ? lines.indexOf(line) : -1;

        let windowStart = 0;
        if (params.followProgress && line && text.length > params.windowChars) {
            const sung = sungChars(line, clock);
            windowStart = sung - Math.floor(params.windowChars / 2);
            windowStart = Math.max(0, Math.min(windowStart, text.length - params.windowChars));
        }

        const payload = {
            state: state.state,
            title: state.song.title || '',
            artist: state.song.artist || '',
            text,
            lineIndex,
            position: Number(state.position.toFixed(2)),
            windowStart,
            entryEffect: params.entryEffect,
            ...params,
        };
        const key = `${payload.state}|${payload.title}|${text}|${windowStart}|${JSON.stringify(params)}`;
        const now = Date.now();
        if (key === lastKey && now - lastAt < 600) return;
        lastKey = key;
        lastAt = now;
        push(payload);
    });
}
