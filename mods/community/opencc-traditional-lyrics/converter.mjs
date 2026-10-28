import { Converter } from './vendor/opencc-cn2t-1.4.2.mjs';

// Convert whole lyric phrases, then project their text back onto the original timed spans.
const converters = new Map();
// Script_Extensions also classifies 。、「」 as Japanese; Chinese punctuation must not skip a line.
const NON_CHINESE_SCRIPT = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const HAN = /\p{Script=Han}/u;

export function getConverter(target = 'tw') {
    const mode = target === 't' ? 't' : 'tw';
    if (!converters.has(mode)) converters.set(mode, Converter({ from: 'cn', to: mode }));
    return converters.get(mode);
}

function mayConvert(text, protectJapanese) {
    return typeof text === 'string' && HAN.test(text)
        && (!protectJapanese || !NON_CHINESE_SCRIPT.test(text));
}

// OpenCC s2t/s2tw preserve code point counts. Use code point boundaries, not UTF-16 indices:
// a compatibility ideograph can become an astral character (or the other way round).
function projection(source, target) {
    const from = Array.from(source);
    const to = Array.from(target);
    if (from.length !== to.length) throw new Error('OpenCC changed the character count; refusing to shift lyric timings');
    const boundaries = new Map([[0, 0]]);
    let a = 0;
    let b = 0;
    for (let i = 0; i < from.length; i += 1) {
        a += from[i].length;
        b += to[i].length;
        boundaries.set(a, b);
    }
    return (start, end) => {
        const left = boundaries.get(start);
        const right = boundaries.get(end);
        return left === undefined || right === undefined ? undefined : target.slice(left, right);
    };
}

function changedArray(original, mapped) {
    return mapped.some((item, i) => item !== original[i]) ? mapped : original;
}

// Spans may omit the spaces represented by TTML's endsWithSpace flag. Match in order,
// allowing these gaps. Nonmatching source annotations keep their own conversion context.
function timedSpans(spans, source, target, convert) {
    if (!Array.isArray(spans) || spans.length === 0) return spans;
    const slice = projection(source, target);
    let cursor = 0;
    return changedArray(spans, spans.map((span) => {
        const start = source.indexOf(span.text, cursor);
        let text;
        if (start >= 0) {
            text = slice(start, start + span.text.length);
            cursor = start + span.text.length;
        }
        text ??= convert(span.text);
        const syllables = timedSpans(span.syllables, span.text, text, convert);
        if (text === span.text && syllables === span.syllables) return span;
        return { ...span, text, ...(syllables ? { syllables } : {}) };
    }));
}

function alternateTexts(alternates, convert, options) {
    if (!Array.isArray(alternates)) return alternates;
    return changedArray(alternates, alternates.map((alternate) => {
        // Romanizations and explicitly non-Chinese translations are not Chinese subtitles.
        if (alternate.role !== 'translation'
            || (alternate.language && !/^(zh|cmn|yue)(?:-|$)/i.test(alternate.language))
            || /(?:^|-)Latn(?:-|$)/i.test(alternate.language ?? '')
            || !mayConvert(alternate.text, options.protectJapanese !== false)) return alternate;
        const text = convert(alternate.text);
        const syllables = timedSpans(alternate.syllables, alternate.text, text, convert);
        if (text === alternate.text && syllables === alternate.syllables) return alternate;
        return { ...alternate, text, ...(syllables ? { syllables } : {}) };
    }));
}

function rewriteVocal(vocal, textKey, convert, options) {
    const original = vocal[textKey];
    const patch = {};
    if (options.convertOriginal !== false && mayConvert(original, options.protectJapanese !== false)) {
        const text = convert(original);
        const words = timedSpans(vocal.words, original, text, convert);
        if (text !== original) patch[textKey] = text;
        if (words !== vocal.words) patch.words = words;
        if (Array.isArray(vocal.wordSegments)) {
            if (vocal.wordSegments.join('') === original) {
                const slice = projection(original, text);
                let cursor = 0;
                const segments = vocal.wordSegments.map((segment) => {
                    const start = cursor;
                    cursor += segment.length;
                    return slice(start, cursor);
                });
                if (segments.every((part) => typeof part === 'string')) {
                    const next = changedArray(vocal.wordSegments, segments);
                    if (next !== vocal.wordSegments) patch.wordSegments = next;
                } else {
                    patch.wordSegments = undefined;
                }
            } else {
                patch.wordSegments = undefined;
            }
        }
    }
    if (options.convertTranslation !== false) {
        if (mayConvert(vocal.translation, options.protectJapanese !== false)) {
            const translation = convert(vocal.translation);
            if (translation !== vocal.translation) patch.translation = translation;
        }
        const alternates = alternateTexts(vocal.alternateTexts, convert, options);
        if (alternates !== vocal.alternateTexts) patch.alternateTexts = alternates;
    }
    return Object.keys(patch).length ? { ...vocal, ...patch } : vocal;
}

export function transformLines(lines, options = {}) {
    if (options.enabled === false || !Array.isArray(lines) || lines.length === 0) return lines;
    const convert = getConverter(options.target);
    return changedArray(lines, lines.map((line) => {
        let next = rewriteVocal(line, 'fullText', convert, options);
        if (Array.isArray(line.backgroundVocals)) {
            const vocals = changedArray(line.backgroundVocals, line.backgroundVocals.map(
                (vocal) => rewriteVocal(vocal, 'text', convert, options),
            ));
            if (vocals !== line.backgroundVocals) next = { ...next, backgroundVocals: vocals };
        }
        return next;
    }));
}
