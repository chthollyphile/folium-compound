// Conservative song matching and measurable subtitle quality; no semantic/AI judgment is claimed.
const HAN = /\p{Script=Han}/u;
const FOREIGN_CJK = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CHINESE_LANGUAGE = /^(?:zh|cmn|yue)(?:-|$)/i;
const CREDIT = /^(?:作[詞词曲]|[編编]曲|[詞词曲]|翻[譯译]|[譯译]|[譯译]者|制作|製作|歌[詞词]|lyrics?|translated?\s+by|translation|composer|arranger|vocal)\s*[:：]/i;
const BAD_TEXT = /\ufffd|[\u0000-\u0008\u000b\u000c\u000e-\u001f]|https?:\/\/|<\/?(?:html|script|body|div)\b|暂无翻译|暫無翻譯|翻译未提供|翻譯未提供|翻译加载失败|翻譯載入失敗/i;
const VERSIONS = [
    /\blive\b|現場|现场|演唱[會会]|ライブ|ライヴ/i,
    /\bremix\b|混音|リミックス/i,
    /\bacoustic\b|不插電|不插电|アコースティック/i,
    /\b(?:instrumental|karaoke|off\s*vocal)\b|伴奏|純音樂|纯音乐|カラオケ|インスト/i,
    /\b(?:cover|covered\s+by)\b|翻唱/i,
    /\b(?:sped\s*up|speed\s*up|nightcore)\b|加速/i,
    /\b(?:slowed|slow\s*version)\b|慢速/i,
    /\b(?:radio\s*edit|short\s*ver(?:sion)?|tv\s*(?:size|ver(?:sion)?))\b|短版/i,
];

export const LIMITS = Object.freeze({ lines: 2500, text: 2048 });

export function textKey(value, canonicalize = (text) => text) {
    return canonicalize(String(value ?? '').normalize('NFKC')).toLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '');
}

export function songKey(song) {
    if (!song || !String(song.title ?? '').trim()) return null;
    return song.id !== null && song.id !== undefined
        ? JSON.stringify([song.source ?? '', String(song.id)])
        : JSON.stringify([song.source ?? '', song.title, song.artist ?? '', song.album ?? '']);
}

function titleKey(title, canonicalize) {
    // Only presentation labels are disposable. Part numbers, remaster years, languages and
    // other version information inside brackets are part of a song's identity.
    const presentation = /^(?:official(?:audio|video|musicvideo|lyrics?(?:video)?)|lyrics?(?:video)?|mv|hd|hq|4k|官方音源|官方音訊|官方影片)$/;
    return textKey(String(title ?? '').replace(/[（(\[【]([^）)\]】]*)[）)\]】]/g,
        (whole, inner) => presentation.test(textKey(inner, canonicalize)) ? '' : whole), canonicalize);
}

function similarity(left, right) {
    if (left === right) return left ? 1 : 0;
    if (left.length < 3 || right.length < 3) return 0;
    const a = new Set(Array.from({ length: left.length - 1 }, (_, i) => left.slice(i, i + 2)));
    const b = new Set(Array.from({ length: right.length - 1 }, (_, i) => right.slice(i, i + 2)));
    return 2 * [...a].filter((pair) => b.has(pair)).length / (a.size + b.size);
}

function artistMatch(left, right, canonicalize) {
    if (!left || !right) return 0;
    if (textKey(left, canonicalize) === textKey(right, canonicalize)) return 1;
    const split = (value) => value.split(/\s*(?:\/|、|,|，|&|;|；|\bfeat\.?|\bfeaturing\b)\s*/i)
        .map((part) => textKey(part, canonicalize)).filter(Boolean);
    const a = split(left);
    const b = split(right);
    return a.some((part) => b.includes(part)) ? 0.9 : 0;
}

/** A matching title alone is insufficient: artists, version markers and known durations also agree. */
export function matchSong(target, candidate, duration = 0, candidateDuration = 0, canonicalize) {
    if (!candidate?.ref || !candidate.source) return 0;
    const a = String(target?.title ?? '');
    const b = String(candidate.title ?? '');
    if (VERSIONS.some((version) => version.test(a) !== version.test(b))) return 0;
    const leftTitle = titleKey(a, canonicalize);
    const rightTitle = titleKey(b, canonicalize);
    const title = similarity(leftTitle, rightTitle);
    if (title < 0.9) return 0;
    const artist = artistMatch(target.artist, candidate.artist, canonicalize);
    if (duration > 0 && candidateDuration > 0
        && Math.abs(duration - candidateDuration) > Math.max(4, Math.min(8, duration * 0.03))) return 0;
    // Missing artist metadata needs an exact title AND independently matching duration.
    if (!artist) {
        if (target.artist || !candidate.artist || title !== 1 || !(duration > 0 && candidateDuration > 0)
            || Math.abs(duration - candidateDuration) > 3) return 0;
        return 0.9;
    }
    if (leftTitle === rightTitle && artist === 1) return 1;
    // A very long title differing by one word can otherwise exceed .98: that is still fuzzy,
    // and must never qualify for whole-document fallback without original lines to cross-check.
    return Math.min(0.97, 0.7 * title + 0.3 * artist);
}

function contentLine(line) {
    return typeof line?.fullText === 'string' && !!line.fullText.trim() && !CREDIT.test(line.fullText.trim());
}

export function isChineseText(text, language) {
    if (language && (!CHINESE_LANGUAGE.test(language) || /(?:^|-)Latn(?:-|$)/i.test(language))) return false;
    if (typeof text !== 'string' || !HAN.test(text) || FOREIGN_CJK.test(text)) return false;
    const letters = text.match(/\p{L}/gu) ?? [];
    const han = letters.filter((letter) => HAN.test(letter)).length;
    return han / Math.max(1, letters.length) >= 0.35;
}

export function translationQuality(text, original = '', language, canonicalize) {
    if (!isChineseText(text, language) || text.length > LIMITS.text || BAD_TEXT.test(text)
        || CREDIT.test(text.trim()) || /(.)\1{5}/u.test(text)
        || text.length > Math.max(120, original.length * 10)) return 0;
    if (textKey(text, canonicalize) === textKey(original, canonicalize)) return 0;
    return text.length > Math.max(80, original.length * 6) ? 0.7 : 1;
}

/** Explicit language labels take precedence; unlabelled kanji-only text remains inherently ambiguous. */
export function chineseTranslation(line, canonicalize) {
    const labelledPrimary = line.alternateTexts?.find((item) => item.role === 'translation'
        && item.text === line.translation && item.language);
    const options = [
        { text: line.translation, language: labelledPrimary?.language },
        ...(Array.isArray(line.alternateTexts) ? line.alternateTexts.filter((item) => item.role === 'translation') : []),
    ];
    let best = { text: '', quality: 0 };
    for (const option of options) {
        const quality = translationQuality(option.text, line.fullText, option.language, canonicalize);
        if (quality > best.quality) best = { text: option.text.trim(), quality };
    }
    return best;
}

export function analyzeLyrics(lines, duration = 0, canonicalize) {
    const invalid = { usable: false, coverage: 0, translated: 0, total: 0, score: 0, quality: 0, nativeChinese: false };
    if (!Array.isArray(lines) || !lines.length || lines.length > LIMITS.lines) return invalid;
    const content = lines.filter(contentLine);
    if (!content.length) return invalid;
    let previous = -Infinity;
    let characters = 0;
    for (const line of lines) {
        characters += String(line?.fullText ?? '').length + String(line?.translation ?? '').length
            + (line?.alternateTexts ?? []).reduce((sum, item) => sum + String(item.text ?? '').length, 0);
        if (typeof line.fullText !== 'string' || line.fullText.length > LIMITS.text
            || BAD_TEXT.test(line.fullText) || !Number.isFinite(line.startTime) || !Number.isFinite(line.endTime)
            || line.startTime < 0 || line.endTime < line.startTime || line.startTime < previous
            || line.endTime > 86400 || characters > 200000
            || (duration > 0 && (line.startTime > duration + 5 || line.endTime > duration + 10))) return invalid;
        previous = line.startTime;
    }
    // A whole plain-text document at t=0 is unsuitable for switching timed subtitles.
    if (content.length > 2 && new Set(content.map((line) => line.startTime)).size < 2) return invalid;
    const nativeChinese = !content.some((line) => FOREIGN_CJK.test(line.fullText))
        && content.filter((line) => isChineseText(line.fullText)).length / content.length >= 0.7;
    const translations = content.map((line) => chineseTranslation(line, canonicalize));
    const translated = translations.filter((item) => item.quality > 0).length;
    const chinese = content.filter((line, i) => translations[i].quality > 0 || (nativeChinese && isChineseText(line.fullText))).length;
    let quality = translated ? translations.reduce((sum, item) => sum + item.quality, 0) / translated : 1;
    const originalCount = new Set(content.map((line) => textKey(line.fullText, canonicalize))).size;
    const translationCount = new Set(translations.filter((item) => item.quality > 0).map((item) => textKey(item.text, canonicalize))).size;
    // A source repeating one Chinese sentence over many different original lines is suspect, not "more translated".
    if (translated >= 6 && originalCount >= 6 && translationCount <= Math.max(1, translated * 0.15)) quality *= 0.25;
    const coverage = chinese / content.length;
    return { usable: true, coverage, translated, total: content.length, quality, nativeChinese,
        score: coverage * 80 * quality + 10 * quality + 10 };
}

/** Track text/timing changes, while ignoring host segmentation/render-hint rebuilds. Called only for a new array. */
export function lyricsKey(lines) {
    if (!Array.isArray(lines) || lines.length > LIMITS.lines) return 'invalid';
    return JSON.stringify(lines.map((line) => [line.fullText, line.startTime, line.endTime,
        line.translation, line.alternateTexts?.map((text) => [text.role, text.language, text.text])]));
}

function putTranslation(line, text) {
    const alternates = (line.alternateTexts ?? []).filter((item) => item.role !== 'translation'
        || (item.language && (!CHINESE_LANGUAGE.test(item.language) || /(?:^|-)Latn(?:-|$)/i.test(item.language))));
    return { ...line, translation: text,
        alternateTexts: [...alternates, { role: 'translation', language: 'zh', text }] };
}

/** Borrow translations only from equal original lines within two seconds, keeping every original word time. */
export function mergeTranslations(base, donor, canonicalize, replaceWeak = false) {
    const byText = new Map();
    donor.forEach((line) => {
        if (!contentLine(line)) return;
        const translation = chineseTranslation(line, canonicalize);
        if (!translation.quality) return;
        const key = textKey(line.fullText, canonicalize);
        if (!byText.has(key)) byText.set(key, []);
        byText.get(key).push({ line, translation, used: false });
    });
    let changed = false;
    const lines = base.map((line) => {
        const options = byText.get(textKey(line.fullText, canonicalize)) ?? [];
        const match = options.filter((option) => !option.used && Math.abs(option.line.startTime - line.startTime) <= 2)
            .sort((a, b) => Math.abs(a.line.startTime - line.startTime) - Math.abs(b.line.startTime - line.startTime))[0];
        if (!match) return line;
        match.used = true;
        if (!replaceWeak && chineseTranslation(line, canonicalize).quality >= match.translation.quality) return line;
        if (line.translation === match.translation.text) return line;
        changed = true;
        return putTranslation(line, match.translation.text);
    });
    return changed ? lines : base;
}

/** Fill missing/invalid translations in a valid original; replace the document only when it is unusable. */
export function chooseLyrics(base, candidates, duration = 0, canonicalize) {
    const initial = analyzeLyrics(base, duration, canonicalize);
    let lines = base;
    let metrics = initial;
    const sources = [];
    const ordered = candidates.map((candidate) => ({ ...candidate,
        metrics: analyzeLyrics(candidate.lines, duration, canonicalize) }))
        .filter((candidate) => candidate.metrics.usable && candidate.metrics.quality >= 0.6 && candidate.match >= 0.9)
        .sort((a, b) => b.metrics.score - a.metrics.score || b.match - a.match);
    for (const candidate of ordered) {
        if (!initial.usable) {
            // With no original to cross-check, require exact title and artist agreement.
            if (candidate.match < 0.98 || (metrics.usable && candidate.metrics.score <= metrics.score + 1)) continue;
            lines = candidate.lines;
            metrics = candidate.metrics;
            sources.splice(0, sources.length, candidate.source);
            continue;
        }
        if (initial.nativeChinese && initial.coverage === 1) break;
        const merged = mergeTranslations(lines, candidate.lines, canonicalize, metrics.quality < 0.6);
        const next = analyzeLyrics(merged, duration, canonicalize);
        if (merged !== lines && next.score > metrics.score + 1) {
            lines = merged;
            metrics = next;
            sources.push(candidate.source);
        }
    }
    return { lines, metrics, sources, changed: lines !== base };
}
