// Conservative song matching and measurable subtitle quality; no semantic/AI judgment is claimed.
const HAN = /\p{Script=Han}/u;
const FOREIGN_CJK = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const CHINESE_LANGUAGE = /^(?:zh|cmn|yue)(?:-|$)/i;
const CREDIT = /^(?:作[詞词曲]|[編编]曲|[詞词曲]|翻[譯译]|[譯译]|[譯译]者|制作|製作|歌[詞词]|lyrics?|translated?\s+by|translation|composer|arranger|vocal)\s*[:：]/i;
const BAD_TEXT = /\ufffd|[\u0000-\u0008\u000b\u000c\u000e-\u001f]|https?:\/\/|<\/?(?:html|script|body|div)\b|暂无翻译|暫無翻譯|翻译未提供|翻譯未提供|翻译加载失败|翻譯載入失敗/i;
const matchUrl = new URL('./songMatch.mjs', import.meta.url);
matchUrl.search = new URL(import.meta.url).search;
const matching = await import(matchUrl.href);
export const textKey = matching.textKey;
export const matchSong = matching.matchSong;
export const searchQueries = matching.searchQueries;
export const probeSong = matching.probeSong;
export const describeMatch = matching.describeMatch;
export const LIMITS = Object.freeze({ lines: 2500, text: 2048 });

export function songKey(song) {
    if (!song || !String(song.title ?? '').trim()) return null;
    return song.id !== null && song.id !== undefined
        ? JSON.stringify([song.source ?? '', String(song.id)])
        : JSON.stringify([song.source ?? '', song.title, song.artist ?? '', song.album ?? '']);
}

/** Recover a timed line whose missing/broken foreground words would leave its animation waiting. */
export function repairWordTimings(lines, duration = 0) {
    if (!Array.isArray(lines) || lines.length > LIMITS.lines) return lines;
    let changed = false;
    const validSpan = (span) => typeof span?.text === 'string'
        && Number.isFinite(span.startTime) && Number.isFinite(span.endTime)
        && span.startTime >= 0 && span.endTime >= span.startTime;
    const next = lines.map((original, index) => {
        let line = original;
        if (typeof line?.fullText !== 'string' || !/[\p{L}\p{N}]/u.test(line.fullText)
            || !Number.isFinite(line.startTime) || line.startTime < 0) return line;
        if (!Number.isFinite(line.endTime) || line.endTime <= line.startTime) {
            const nextStart = lines[index + 1]?.startTime;
            const lastKnown = index === lines.length - 1
                && (index === 0 || lines[index - 1]?.startTime < line.startTime);
            const end = Number.isFinite(nextStart) && nextStart > line.startTime ? nextStart
                : lastKnown && Number.isFinite(duration) && duration > line.startTime ? duration : null;
            if (end === null) return line;
            line = { ...line, endTime: end }; changed = true;
        }
        const words = line.words;
        const activeSpan = span => validSpan(span) && /[\p{L}\p{N}]/u.test(span.text)
            && span.endTime > span.startTime && span.endTime > line.startTime && span.startTime < line.endTime;
        const usableWord = word => {
            if (!validSpan(word) || word.endTime < line.startTime - 2 || word.startTime > line.endTime + 2) return false;
            const syllables = word.syllables;
            return !Array.isArray(syllables) || syllables.length === 0 || (syllables.every(validSpan)
                && (!/[\p{L}\p{N}]/u.test(word.text) || syllables.some(activeSpan)));
        };
        if (Array.isArray(words) && words.some(activeSpan) && words.every(usableWord)) return line;
        changed = true;
        // Preserve proven line bounds; do not invent missing karaoke timestamps.
        return { ...line, words: [{ text: line.fullText, startTime: line.startTime, endTime: line.endTime }] };
    });
    return changed ? next : lines;
}

function contentLine(line) {
    return typeof line?.fullText === 'string' && /[\p{L}\p{N}]/u.test(line.fullText) && !CREDIT.test(line.fullText.trim());
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

function lyricBlocks(lines, canonicalize, translatedOnly = false) {
    let position = 0;
    const content = lines.filter(contentLine).map((line) => {
        const key = textKey(line.fullText, canonicalize);
        const item = { line, key, position, translation: chineseTranslation(line, canonicalize) };
        position += key.length;
        return item;
    });
    const blocks = [];
    for (let start = 0; start < content.length; start++) {
        let key = '';
        for (let end = start; end < Math.min(content.length, start + 3); end++) {
            key += content[end].key;
            if (key.length > 1024) break;
            const parts = content.slice(start, end + 1);
            if (translatedOnly && parts.some((part) => !part.translation.quality)) continue;
            blocks.push({ key, start, end: end + 1, position: content[start].position, time: content[start].line.startTime,
                translation: { text: parts.map((part) => part.translation.text).join(' '),
                    quality: Math.min(...parts.map((part) => part.translation.quality)) } });
        }
    }
    return { content, blocks };
}

/** Require multiple distinct, ordered original phrases to infer a constant cross-source timing offset. */
export function alignLyrics(base, donor, canonicalize) {
    const none = { safe: false, offset: 0, coverage: 0, anchors: 0 };
    const a = lyricBlocks(base, canonicalize); const b = lyricBlocks(donor, canonicalize);
    const unique = (blocks) => {
        const map = new Map();
        for (const block of blocks) {
            if (block.key.length < 4) continue;
            map.set(block.key, map.has(block.key) ? null : block);
        }
        return map;
    };
    const left = unique(a.blocks); const right = unique(b.blocks);
    const pairs = [...left.values()].filter(Boolean).filter((block) => right.get(block.key))
        .map((one) => ({ a: one, b: right.get(one.key) }))
        .sort((x, y) => x.a.start - y.a.start || (x.a.end - x.a.start + x.b.end - x.b.start) - (y.a.end - y.a.start + y.b.end - y.b.start));
    const anchors = [];
    let aEnd = 0; let bEnd = 0;
    for (const pair of pairs) {
        if (pair.a.start < aEnd || pair.b.start < bEnd) continue;
        anchors.push(pair); aEnd = pair.a.end; bEnd = pair.b.end;
    }
    if (anchors.length < 3) return none;
    const offsets = anchors.map((pair) => pair.a.time - pair.b.time).sort((x, y) => x - y);
    const middle = Math.floor(offsets.length / 2);
    const offset = offsets.length % 2 ? offsets[middle] : (offsets[middle - 1] + offsets[middle]) / 2;
    if (Math.abs(offset) > 12 || offsets.some((value) => Math.abs(value - offset) > 2)) return none;
    const aText = a.content.map((item) => item.key).join(''); const bText = b.content.map((item) => item.key).join('');
    if (anchors.reduce((sum, pair) => sum + pair.a.key.length, 0) < 24) return none;
    // Check repeated sections too: identical concatenated text does not prove that later choruses
    // have the same timing. Unique phrases infer the offset; timed ordered matches prove coverage.
    const byKey = new Map();
    for (const block of b.blocks) {
        if (!byKey.has(block.key)) byKey.set(block.key, []);
        byKey.get(block.key).push(block);
    }
    let matched = 0; aEnd = 0; bEnd = 0;
    const sameSegmentation = a.content.length === b.content.length
        && a.content.every((item, i) => item.key === b.content[i].key);
    if (sameSegmentation) {
        matched = a.content.reduce((sum, item, i) => sum
            + (Math.abs(item.line.startTime - b.content[i].line.startTime - offset) <= 2 ? item.key.length : 0), 0);
    }
    for (const block of a.blocks) {
        if (sameSegmentation) break;
        if (block.start < aEnd) continue;
        const options = byKey.get(block.key) ?? [];
        const match = options.find((other) => other.start >= bEnd
            && (aText !== bText || other.position === block.position)
            && Math.abs(block.time - other.time - offset) <= 2);
        if (!match) continue;
        matched += block.key.length; aEnd = block.end; bEnd = match.end;
    }
    const coverage = Math.min(matched / Math.max(1, aText.length), matched / Math.max(1, bText.length));
    return { safe: coverage >= 0.7, offset, coverage, anchors: anchors.length };
}

/** An entire equal, ordered original is independent evidence when two recordings have different clocks. */
function sameOriginalSequence(base, donor, canonicalize) {
    const keys = lines => lines.filter(contentLine).map(line => textKey(line.fullText, canonicalize));
    const a = keys(base); const b = keys(donor);
    const text = a.join('');
    return text.length >= 24 && text === b.join('')
        && new Set(a.filter(key => key.length >= 4)).size >= 3
        && new Set(b.filter(key => key.length >= 4)).size >= 3;
}

/** Borrow translations only from equal original lines within two seconds, keeping every original word time. */
export function mergeTranslations(base, donor, canonicalize, replaceWeak = false, offset = 0, allowGroups = false, orderedText = false) {
    if (orderedText && !sameOriginalSequence(base, donor, canonicalize)) return base;
    const positions = orderedText ? new Map(lyricBlocks(base, canonicalize).content.map(item => [item.line, item.position])) : null;
    const byText = new Map();
    lyricBlocks(donor, canonicalize, true).blocks.forEach((block) => {
        const { key } = block;
        if (!byText.has(key)) byText.set(key, []);
        byText.get(key).push(block);
    });
    const used = new Set();
    const baseContent = base.filter(contentLine);
    const assigned = new Set();
    let changed = false;
    const lines = base.map((line) => {
        const options = byText.get(textKey(line.fullText, canonicalize)) ?? [];
        const match = options.filter((option) => {
            for (let i = option.start; i < option.end; i++) if (used.has(i)) return false;
            return orderedText ? option.position === positions.get(line) : Math.abs(option.time + offset - line.startTime) <= 2;
        }).sort((a, b) => Math.abs(a.time + offset - line.startTime) - Math.abs(b.time + offset - line.startTime))[0];
        if (!match) return line;
        for (let i = match.start; i < match.end; i++) used.add(i);
        assigned.add(line);
        if (!replaceWeak && chineseTranslation(line, canonicalize).quality >= match.translation.quality) return line;
        if (line.translation === match.translation.text) return line;
        changed = true;
        return putTranslation(line, match.translation.text);
    });
    if (allowGroups) {
        // A complete verified translation can span several original animated fragments.
        // Show that sentence across its fragments, keeping the source words and line timing.
        const indexByLine = new Map(base.map((line, index) => [line, index]));
        for (const block of lyricBlocks(base, canonicalize).blocks) {
            if (block.end - block.start < 2) continue;
            const parts = baseContent.slice(block.start, block.end);
            if (parts.some((line) => assigned.has(line) || (!replaceWeak && chineseTranslation(line, canonicalize).quality > 0))) continue;
            const match = (byText.get(block.key) ?? []).find((option) => {
                for (let i = option.start; i < option.end; i++) if (used.has(i)) return false;
                return orderedText ? option.position === block.position : Math.abs(option.time + offset - block.time) <= 2;
            });
            if (!match) continue;
            for (let i = match.start; i < match.end; i++) used.add(i);
            for (const line of parts) {
                assigned.add(line);
                lines[indexByLine.get(line)] = putTranslation(line, match.translation.text);
            }
            changed = true;
        }
    }
    return changed ? lines : base;
}

/** Preserve an existing animation timeline; exact-match fallback is for empty/invalid loads only. */
export function chooseLyrics(base, candidates, duration = 0, canonicalize) {
    const initial = analyzeLyrics(base, duration, canonicalize);
    let lines = base;
    let metrics = initial;
    const sources = [];
    let strategy = 'original';
    let chosenOffset = 0;
    let sequenceMatched = false;
    const decisions = [];
    const ordered = candidates.map((candidate) => ({ ...candidate, lines: repairWordTimings(candidate.lines, candidate.duration ?? duration) }))
        .map((candidate) => ({ ...candidate, metrics: analyzeLyrics(candidate.lines, candidate.duration ?? duration, canonicalize) }))
        .filter((candidate) => candidate.metrics.usable && candidate.metrics.quality >= 0.6 && candidate.match >= 0.9)
        .sort((a, b) => b.metrics.score - a.metrics.score || b.match - a.match);
    for (const candidate of ordered) {
        const decision = { source: candidate.source, match: candidate.match,
            translationOnly: Boolean(candidate.translationOnly), originalTextOnly: Boolean(candidate.originalTextOnly),
            metrics: candidate.metrics, outcome: 'rejected' };
        decisions.push(decision);
        if (!initial.usable) {
            // With no original to cross-check, require exact title and artist agreement.
            if (candidate.translationOnly || candidate.match < 0.98
                || !analyzeLyrics(candidate.lines, duration, canonicalize).usable
                || (metrics.usable && candidate.metrics.score <= metrics.score + 1)) {
                decision.reason = candidate.translationOnly || candidate.match < 0.98 ? 'empty-original-needs-exact-identity'
                    : !analyzeLyrics(candidate.lines, duration, canonicalize).usable ? 'outside-playback-duration' : 'no-improvement';
                continue;
            }
            lines = candidate.lines;
            metrics = candidate.metrics;
            sources.splice(0, sources.length, candidate.source);
            strategy = 'replaced';
            decision.outcome = 'applied'; decision.reason = 'exact-identity-fallback';
            continue;
        }
        if (initial.nativeChinese && initial.coverage === 1) { decision.reason = 'complete-original'; break; }
        const alignment = alignLyrics(lines, candidate.lines, canonicalize);
        const sameSequence = sameOriginalSequence(lines, candidate.lines, canonicalize);
        decision.alignment = alignment; decision.sameOriginalSequence = sameSequence;
        if (candidate.originalTextOnly && !sameSequence) { decision.reason = 'original-sequence-mismatch'; continue; }
        if (candidate.translationOnly && !sameSequence && (!alignment.safe || alignment.coverage < 0.85)) {
            decision.reason = 'alignment-insufficient'; continue;
        }
        const offset = alignment.safe ? alignment.offset : 0;
        const orderedText = sameSequence && (candidate.originalTextOnly || !alignment.safe);
        const merged = mergeTranslations(lines, candidate.lines, canonicalize, metrics.quality < 0.6, offset, alignment.safe || sameSequence, orderedText);
        const next = analyzeLyrics(merged, duration, canonicalize);
        if (merged !== lines && next.score > metrics.score + 1) {
            lines = merged;
            metrics = next;
            sources.push(candidate.source);
            if (strategy === 'original') strategy = 'merged';
            chosenOffset = offset;
            sequenceMatched ||= orderedText;
            decision.outcome = 'applied'; decision.reason = orderedText ? 'full-sequence-translation' : 'aligned-translation';
        } else decision.reason = !sameSequence && !alignment.safe ? 'alignment-insufficient' : 'no-improvement';
    }
    return { lines, metrics, sources, changed: lines !== base, strategy, offset: chosenOffset, sequenceMatched, decisions };
}
