// Cross-provider names: bilingual title forms and kana/Hepburn artist spellings, with version guards.
import jpCharacters from './vendor/opencc-jp-characters-1.4.2.mjs';

const JP_CHARACTERS = new Map(jpCharacters.split('|').map((entry) => entry.split(' ')));
const JP_SEARCH_CHARACTERS = new Map([...JP_CHARACTERS].map(([jp, traditional]) => [traditional, jp]));
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const PRESENTATION = /^(?:official(?:audio|video|musicvideo|lyrics?(?:video)?)|lyrics?(?:video)?|mv|hd|hq|4k|官方音源|官方音訊|官方影片)$/;
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
const VERSION_DETAIL = /\b(?:part|pt)\s*[.\dIVX]|\b(?:part|pt|ver(?:sion)?|remaster(?:ed)?|edit|mix|vol(?:ume)?)\b|\d{4}|第.{1,4}[部章]|[語语]版|バージョン|ヴァージョン/i;
const KANA_ROWS = [
    ['あいうえお', ['a','i','u','e','o']], ['かきくけこ', ['ka','ki','ku','ke','ko']],
    ['さしすせそ', ['sa','shi','su','se','so']], ['たちつてと', ['ta','chi','tsu','te','to']],
    ['なにぬねの', ['na','ni','nu','ne','no']], ['はひふへほ', ['ha','hi','fu','he','ho']],
    ['まみむめも', ['ma','mi','mu','me','mo']], ['やゆよ', ['ya','yu','yo']],
    ['らりるれろ', ['ra','ri','ru','re','ro']], ['わゐゑをん', ['wa','wi','we','wo','n']],
    ['がぎぐげご', ['ga','gi','gu','ge','go']], ['ざじずぜぞ', ['za','ji','zu','ze','zo']],
    ['だぢづでど', ['da','ji','zu','de','do']], ['ばびぶべぼ', ['ba','bi','bu','be','bo']],
    ['ぱぴぷぺぽ', ['pa','pi','pu','pe','po']], ['ぁぃぅぇぉゔ', ['a','i','u','e','o','vu']],
];
const KANA = new Map(KANA_ROWS.flatMap(([letters, sounds]) => Array.from(letters, (letter, i) => [letter, sounds[i]])));
const GLIDES = new Map(Object.entries({ き:'ky', ぎ:'gy', し:'sh', じ:'j', ち:'ch', ぢ:'j', に:'ny', ひ:'hy', び:'by', ぴ:'py', み:'my', り:'ry' }));

export function textKey(value, canonicalize = (text) => text) {
    const normalized = Array.from(String(value ?? '').normalize('NFKC'), (letter) => JP_CHARACTERS.get(letter) ?? letter).join('');
    return canonicalize(normalized).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function cleanTitle(title, canonicalize) {
    return String(title ?? '').normalize('NFKC').replace(/[（(\[【]([^）)\]】]*)[）)\]】]/g,
        (whole, inner) => {
            if (PRESENTATION.test(textKey(inner, canonicalize))) return '';
            // Normalize labels, never erase the recording version or its extra details.
            const tag = inner.trim().replace(/\s+(?:ver(?:sion)?\.?)\s*$/i, '').trim();
            const known = /^(?:acoustic|アコースティック|不插[電电])$/i.test(tag) ? 'acoustic'
                : /^(?:live|ライブ|ライヴ|現場|现场)$/i.test(tag) ? 'live'
                : /^(?:cover|翻唱)$/i.test(tag) ? 'cover' : null;
            return known ? `(${known})` : whole;
        }).trim();
}

/** Split only clear cross-script aliases. Same-language suffixes and version/part labels stay intact. */
export function titleForms(title, canonicalize) {
    const clean = cleanTitle(title, canonicalize);
    const forms = [clean];
    // Cover videos add the composer in brackets and the performer after '/'. Keep version labels.
    const cover = clean.match(/^(.+?)\s+[/|]\s+[^/|]+\bcover\s*$/i);
    if (cover && !VERSION_DETAIL.test(cover[1])) {
        forms.push(cover[1].replace(/\s*[（(]([^）)]+)[）)]\s*$/, (whole, credit) =>
            VERSION_DETAIL.test(credit) || VERSIONS.some((version) => version.test(credit)) ? whole : '').trim());
    }
    const bareCover = clean.replace(/\s*[（(\[【]\s*(?:cover|翻唱)\s*[）)\]】]\s*$/i, '').trim();
    if (bareCover !== clean) forms.push(bareCover);
    const qualifiers = [];
    const withoutQualifiers = clean.replace(/[（(\[【]([^）)\]】]*)[）)\]】]/g, (whole, inner) => {
        if (!VERSION_DETAIL.test(inner) && !VERSIONS.some(version => version.test(inner))) return whole;
        // Bilingual aliases often each repeat the same label. Keep that label once per alias.
        if (!qualifiers.some(qualifier => textKey(qualifier, canonicalize) === textKey(whole, canonicalize))) qualifiers.push(whole);
        return '';
    }).trim();
    if (!VERSION_DETAIL.test(withoutQualifiers) && !VERSIONS.some((version) => version.test(withoutQualifiers))) {
        let parts = withoutQualifiers.split(/\s+[-–—|/]\s+/).map((part) => part.trim()).filter(Boolean);
        const brackets = withoutQualifiers.match(/^(.+?)\s*[（(\[【]([^）)\]】]+)[）)\]】]$/);
        if (parts.length === 1 && brackets) parts = [brackets[1].trim(), brackets[2].trim()];
        if (parts.length >= 2 && parts.length <= 3 && parts.some((part) => CJK.test(part))
            && parts.some((part) => !CJK.test(part) && /\p{Script=Latin}/u.test(part))) {
            forms.push(...parts.map(part => [part, ...qualifiers].join(' ')));
        }
    }
    return [...new Set(forms.filter((form) => textKey(form, canonicalize)))];
}

/** Exact phonetic normalization, not artist-name translation or fuzzy matching. Kanji is not guessed. */
export function artistKey(value, canonicalize) {
    const clean = String(value ?? '').normalize('NFKC').replace(/\s*[-–—]\s*Topic\s*$/i, '').trim();
    if (!/^[\p{Script=Hiragana}\p{Script=Katakana}ー\s・]+$/u.test(clean)) return textKey(clean, canonicalize);
    const kana = Array.from(clean.replace(/[\s・]/g, ''), (letter) => {
        const code = letter.codePointAt(0);
        return code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : letter;
    });
    let output = '';
    let double = false;
    for (let i = 0; i < kana.length; i++) {
        const letter = kana[i];
        if (letter === 'っ') { double = true; continue; }
        if (letter === 'ー') { output += output.match(/[aeiou]$/)?.[0] ?? ''; continue; }
        let sound = KANA.get(letter);
        if (GLIDES.has(letter) && /[ゃゅょ]/.test(kana[i + 1] ?? '')) {
            sound = GLIDES.get(letter) + ({ ゃ:'a', ゅ:'u', ょ:'o' })[kana[++i]];
        }
        if (!sound) return textKey(clean, canonicalize);
        if (double && /^[bcdfghjklmnpqrstvwxyz]/.test(sound)) output += sound.startsWith('ch') ? 't' : sound[0];
        double = false;
        output += sound;
    }
    return output;
}

function artistMatch(left, right, canonicalize) {
    if (!left || !right) return 0;
    const leftKey = artistKey(left, canonicalize); const rightKey = artistKey(right, canonicalize);
    if (!leftKey || !rightKey) return 0;
    if (leftKey === rightKey) return 1;
    // Japanese names may reverse the two Latin tokens. Require an exact kana reading,
    // never reorder two Latin artist names or guess the reading of kanji.
    const kanaName = value => /^[\p{Script=Hiragana}\p{Script=Katakana}ー\s・]+$/u.test(String(value).normalize('NFKC').trim());
    const reversedLatin = value => {
        const name = String(value).normalize('NFKC').replace(/\s*[-–—]\s*Topic\s*$/i, '').trim();
        return /^[A-Za-z]+\s+[A-Za-z]+$/.test(name) ? textKey(name.split(/\s+/).reverse().join(''), canonicalize) : null;
    };
    if ((kanaName(right) && reversedLatin(left) === rightKey)
        || (kanaName(left) && reversedLatin(right) === leftKey)) return 1;
    const split = (value) => [...new Set(value.split(/\s*(?:\/|、|,|，|&|;|；|\bfeat\.?|\bfeaturing\b)\s*/i)
        .map((part) => artistKey(part, canonicalize)).filter(Boolean))];
    const a = split(left); const b = split(right);
    if (a.length === b.length && a.every((part) => b.includes(part))) return 1;
    return a.some((part) => b.includes(part)) ? 0.9 : 0;
}

function similarity(left, right) {
    if (left === right) return left ? 1 : 0;
    if (left.length < 3 || right.length < 3) return 0;
    const pairs = (text) => new Set(Array.from({ length: text.length - 1 }, (_, i) => text.slice(i, i + 2)));
    const a = pairs(left); const b = pairs(right);
    return 2 * [...a].filter((pair) => b.has(pair)).length / (a.size + b.size);
}

function songTitleForms(song, canonicalize) {
    const forms = titleForms(song.title, canonicalize);
    const artist = artistKey(song.artist, canonicalize);
    // Video titles also use "Artist - Song". Do not treat the artist prefix as a song alias.
    return forms.filter((form, i) => i === 0 || !artist || artistKey(form, canonicalize) !== artist);
}

export function matchSong(target, candidate, duration = 0, candidateDuration = 0, canonicalize) {
    if (!candidate?.ref || !candidate.source) return 0;
    const a = String(target?.title ?? ''); const b = String(candidate.title ?? '');
    if (VERSIONS.some((version) => version.test(a) !== version.test(b))) return 0;
    const left = songTitleForms(target, canonicalize).map((form) => textKey(form, canonicalize));
    const right = songTitleForms(candidate, canonicalize).map((form) => textKey(form, canonicalize));
    const exact = left.some((form) => right.includes(form));
    const title = Math.max(0, ...left.flatMap((one) => right.map((two) => similarity(one, two))));
    if (title < 0.9) return 0;
    const artist = artistMatch(target.artist, candidate.artist, canonicalize);
    const durationDiff = duration > 0 && candidateDuration > 0 ? Math.abs(duration - candidateDuration) : 0;
    const usualLimit = Math.max(4, Math.min(8, duration * 0.03));
    const videoOffset = durationDiff > usualLimit && (target.source === 'ytm' || candidate.source === 'ytm')
        && durationDiff <= 18 && exact && artist === 1;
    if (durationDiff > usualLimit && !videoOffset) return 0;
    if (!artist) {
        if (target.artist || !candidate.artist || !exact || !(duration > 0 && candidateDuration > 0) || durationDiff > 3) return 0;
        return 0.9;
    }
    if (exact && artist === 1 && !videoOffset) return 1;
    return Math.min(0.97, 0.7 * title + 0.3 * artist);
}

/** Unknown aliases are read only for translations; original text/timing must prove the match later. */
export function probeSong(target, candidate, duration = 0, candidateDuration = 0, canonicalize, hasOriginal = false) {
    const match = matchSong(target, candidate, duration, candidateDuration, canonicalize);
    if (match >= 0.9) return { match, translationOnly: false };
    if (!hasOriginal || !candidate?.ref || !candidate.source) return null;
    const a = String(target?.title ?? ''); const b = String(candidate.title ?? '');
    if (VERSIONS.some((version) => version.test(a) !== version.test(b))) {
        // Acoustic/live/cover recordings may share a translation, never their audio or timeline.
        // Only read these candidates; chooseLyrics must prove the entire original text sequence.
        if (VERSIONS.some((version, index) => ![0, 2, 4].includes(index) && version.test(a) !== version.test(b))) return null;
        const stems = song => songTitleForms(song, canonicalize).map(form => textKey(form.replace(
            /\s*[（(\[【]\s*(?:acoustic|live|cover)\s*[）)\]】]/gi, ''), canonicalize));
        if (!stems(target).some(form => stems(candidate).includes(form))) return null;
        return { match: 0.9, translationOnly: true, originalTextOnly: true };
    }
    const left = songTitleForms(target, canonicalize).map((form) => textKey(form, canonicalize));
    const right = songTitleForms(candidate, canonicalize).map((form) => textKey(form, canonicalize));
    if (!left.some((form) => right.includes(form))) return null;
    const limit = target.source === 'ytm' || candidate.source === 'ytm' ? 18 : Math.max(4, Math.min(8, duration * 0.03));
    if (duration > 0 && candidateDuration > 0 && Math.abs(duration - candidateDuration) > limit) return null;
    return { match: 0.9, translationOnly: true };
}

/** Observable matcher inputs for diagnostics; this never changes acceptance thresholds. */
export function describeMatch(target, candidate, duration = 0, candidateDuration = 0, canonicalize) {
    const left = songTitleForms(target, canonicalize).map(form => textKey(form, canonicalize));
    const right = songTitleForms(candidate, canonicalize).map(form => textKey(form, canonicalize));
    return { targetTitleForms: left, candidateTitleForms: right,
        exactTitle: left.some(form => right.includes(form)),
        titleSimilarity: Math.max(0, ...left.flatMap(one => right.map(two => similarity(one, two)))),
        artistAgreement: artistMatch(target.artist, candidate.artist, canonicalize),
        targetArtistKey: artistKey(target.artist, canonicalize), candidateArtistKey: artistKey(candidate.artist, canonicalize),
        versionDifferences: VERSIONS.map((version, i) => version.test(String(target.title ?? '')) !== version.test(String(candidate.title ?? '')) ?
            ['live', 'remix', 'acoustic', 'instrumental', 'cover', 'sped-up', 'slowed', 'tv-size'][i] ?? `version-${i}` : null).filter(Boolean),
        durationDifferenceSeconds: duration > 0 && candidateDuration > 0 ? Math.abs(duration - candidateDuration) : null };
}

export function searchQueries(song, canonicalize) {
    const forms = songTitleForms(song, canonicalize);
    const title = forms.find((form) => CJK.test(form) && !/\p{Script=Latin}/u.test(form.replace(
        /[（(\[【]([^）)\]】]*)[）)\]】]/g,
        (whole, inner) => VERSION_DETAIL.test(inner) || VERSIONS.some(version => version.test(inner)) ? '' : whole)))
        ?? forms[1] ?? forms[0] ?? '';
    const artist = String(song.artist ?? '').replace(/\s*[-–—]\s*Topic\s*$/i, '').trim();
    const japaneseTitle = Array.from(canonicalize ? canonicalize(title) : title,
        (letter) => JP_SEARCH_CHARACTERS.get(letter) ?? letter).join('');
    return [...new Set([`${title} ${artist}`, ...(japaneseTitle !== title ? [japaneseTitle] : []), title, `${song.title} ${artist}`]
        .map((query) => query.trim().slice(0, 200)).filter(Boolean))].slice(0, 3);
}
