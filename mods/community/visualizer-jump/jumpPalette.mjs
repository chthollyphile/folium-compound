// mods/visualizer-jump/jumpPalette.mjs
// 跳一跳的取色：把主题的几个颜色翻成柱面、棱线、文字与小人的颜色。
//
// 模组跑在 `folia-mod://` 下 import 不到 src，所以解析 / 混色 / 亮度这三件是照
// `src/components/visualizer/colorMix.ts` 同一套口径再实现一遍（与 cinerama 镜像逐字
// 时序的做法一样）。与 src 那份唯一的差别：解析不了的颜色（hsl()、命名色）按原样
// 透传，不参与混色也不抛错。
//
// 柱面的颜色**由主题推**：以前是写死的 `rgba(223,231,255, α)`（暗主题）/
// `rgba(43,51,72, α)`（亮主题）——两个都是中性冷灰，暖色主题下柱子仍然是一片冷蓝白，
// 和整屏的调子是脱节的。现在面色 = 主题文字色掺一点强调色：暗主题下是「浅色带主题
// 色相」，亮主题下是「深色带主题色相」。浓淡交给 `fill-opacity` / `stroke-opacity`
// （见 jumpStage），色相则跟着主题走。
//
// 五种浓淡的比例沿用原来那五个 alpha（棱线 0.42、正面 0.17、侧面 0.08、次行 0.10 / 0.05）：
// 换掉的只是它们共用的那个色，画面结构不变。

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (from, to, amount) => from + (to - from) * amount;

/** 面色往强调色掺多少：字色为主，强调色只负责把色相带出来。 */
const FACE_ACCENT_MIX = 0.3;

/** 棱线再往强调色推一档：它是画面里唯一的高光，色相应该最先被看见。 */
const EDGE_ACCENT_MIX = 0.5;

const formatRgba = (channels, alpha) => [
    'rgba(',
    Math.round(clamp(channels.r, 0, 255)), ', ',
    Math.round(clamp(channels.g, 0, 255)), ', ',
    Math.round(clamp(channels.b, 0, 255)), ', ',
    clamp(alpha, 0, 1),
    ')',
].join('');

/** 读出一个颜色的三个通道：认 #rgb / #rrggbb / #rrggbbaa / rgb() / rgba()，其余返回 null。 */
const readChannels = (color) => {
    if (typeof color !== 'string') return null;
    const text = color.trim();
    if (text.startsWith('#')) {
        const hex = text.slice(1);
        const byte = (value) => Number.parseInt(value, 16);
        if (/^[0-9a-f]{3}$/i.test(hex)) {
            return { r: byte(hex[0] + hex[0]), g: byte(hex[1] + hex[1]), b: byte(hex[2] + hex[2]) };
        }
        if (/^[0-9a-f]{6}$/i.test(hex)) {
            return {
                r: byte(hex.slice(0, 2)),
                g: byte(hex.slice(2, 4)),
                b: byte(hex.slice(4, 6)),
            };
        }
        // #rrggbbaa：通道照读，末两位是 alpha，混色时不要。
        if (/^[0-9a-f]{8}$/i.test(hex)) {
            return {
                r: byte(hex.slice(0, 2)),
                g: byte(hex.slice(2, 4)),
                b: byte(hex.slice(4, 6)),
            };
        }
        return null;
    }
    const match = text.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part.trim()));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
};

/** 给一个颜色套上 alpha；解析不出来的按原样透传（它本来就是合法 CSS 颜色）。 */
const colorWithAlpha = (color, alpha) => {
    const channels = readChannels(color);
    return channels ? formatRgba(channels, alpha) : (typeof color === 'string' ? color.trim() : '');
};

/** 两色相混；有一头解析不出来就取能解析的那一头（透传的那一头原样返回）。 */
const mixColors = (from, to, amount, alpha = 1) => {
    const ratio = clamp(amount, 0, 1);
    const a = readChannels(from);
    const b = readChannels(to);
    if (!a && !b) return colorWithAlpha(from, alpha);
    if (!a) return colorWithAlpha(to, alpha);
    if (!b) return colorWithAlpha(from, alpha);
    return formatRgba({
        r: mix(a.r, b.r, ratio),
        g: mix(a.g, b.g, ratio),
        b: mix(a.b, b.b, ratio),
    }, alpha);
};

/** Rec.709 亮度（0…255）；解析不出来返回 null——此时不要猜，交给调用方回落。 */
const luminanceOf = (color) => {
    const channels = readChannels(color);
    if (!channels) return null;
    return channels.r * 0.2126 + channels.g * 0.7152 + channels.b * 0.0722;
};

/**
 * 主题是亮是暗。
 *
 * 优先用宿主给的 `theme.isDaylight`：它是宿主的判据，不该在这里重推一遍。
 * 只有在它缺失时才回落到背景色亮度（与旧口径同一个阈值 0.5），并且这一回落认
 * `rgb()` / `rgba()` —— 旧版只认 `#` 开头的字符串，主题一旦给 `rgb()` 就会被判成暗色，
 * 亮色主题下柱子会整片翻成浅色。
 */
const resolveThemeIsDark = (theme) => {
    if (typeof theme?.isDaylight === 'boolean') return !theme.isDaylight;
    const luma = luminanceOf(theme?.backgroundColor);
    return luma === null ? true : luma < 127.5;
};

/** 主题里那个「字色 / 强调色」：空值（旧存档、宿主没给）按明暗落回一个中性色。 */
const resolveInk = (theme, dark) => {
    const ink = typeof theme?.primaryColor === 'string' ? theme.primaryColor.trim() : '';
    return ink || (dark ? '#f3f5ff' : '#12151c');
};

const resolveAccent = (theme) => {
    const accent = typeof theme?.accentColor === 'string' ? theme.accentColor.trim() : '';
    return accent || '#8fc7ff';
};

/**
 * 一份调色板。形状与旧版一致（client 只消费这几个键），变的只是它们的来源：
 * 面色不再是写死的中性冷灰，而是从主题的 `primaryColor` / `accentColor` 推出来的。
 */
export const resolveJumpPalette = (theme, folium) => {
    const dark = resolveThemeIsDark(theme);
    const ink = resolveInk(theme, dark);
    const accent = resolveAccent(theme);
    const face = mixColors(ink, accent, FACE_ACCENT_MIX);
    const edge = mixColors(ink, accent, EDGE_ACCENT_MIX);
    return {
        dark,
        text: ink,
        accent,
        edge: colorWithAlpha(edge, 0.42),
        front: colorWithAlpha(face, 0.17),
        side: colorWithAlpha(face, 0.08),
        back: colorWithAlpha(face, 0.1),
        backSide: colorWithAlpha(face, 0.05),
        fontFamily: folium?.theme?.resolveFontStack(theme),
        fontWeight: folium?.theme?.resolveFontWeight(theme, 600),
    };
};
