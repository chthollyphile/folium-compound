// LX metadata, HTTP options and audio quality normalization shared by the adapter and tests.
export const MAX_SCRIPT_BYTES = 256 * 1024;
export const PLATFORMS = { wy: 'netease', tx: 'qq', kg: 'kugou' };
const QUALITY_ORDER = ['128k', '192k', '320k', 'flac', 'flac24bit', 'hires'];

export function scriptInfo(rawScript) {
    if (typeof rawScript !== 'string' || new TextEncoder().encode(rawScript).length > MAX_SCRIPT_BYTES) {
        throw new Error('LX: script exceeds 256 KiB');
    }
    const header = rawScript.match(/^\s*\/\*[\s\S]*?\*\//)?.[0] ?? '';
    const fields = Object.fromEntries(['name', 'description', 'version', 'author', 'homepage'].map(key => (
        [key, header.match(new RegExp(`@${key}\\s+([^\\r\\n]*)`))?.[1].replace(/\s*\*\/$/, '').trim() ?? '']
    )));
    if (!fields.name) throw new Error('LX: missing @name script header (QingMusic JSON is not an LX script)');
    return { ...fields, rawScript };
}

export function httpUrl(value) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('LX: expected an HTTP(S) URL without credentials');
    }
    return url.href;
}

export function sourcesOf(data) {
    if (!data || data.status === false || typeof data.sources !== 'object') throw new Error('LX: initialization failed');
    const sources = {};
    for (const id of Object.keys(PLATFORMS)) {
        const source = data.sources?.[id];
        if (source?.type !== 'music' || !source.actions?.includes('musicUrl')) continue;
        const qualitys = QUALITY_ORDER.filter(quality => source.qualitys?.includes(quality));
        if (qualitys.length) sources[id] = { actions: ['musicUrl', ...(source.actions.includes('lyric') ? ['lyric'] : [])], qualitys };
    }
    if (!Object.keys(sources).length) throw new Error('LX: no compatible wy / tx / kg source or audio quality');
    return sources;
}

export function qualityOf(requested, available) {
    const candidates = {
        standard: ['128k'], high: ['320k', '192k', '128k'],
        lossless: ['flac', '320k', '192k', '128k'],
        hires: ['flac24bit', 'hires', 'flac', '320k', '192k', '128k'],
    }[requested] ?? ['320k', '128k'];
    const quality = candidates.find(item => available.includes(item));
    if (!quality) throw new Error('LX: requested audio quality is not supported');
    return quality;
}

export function musicInfoOf(source, song) {
    return {
        id: song.id, songmid: song.id, ...(source === 'kg' ? { hash: song.id } : {}),
        name: song.title, singer: song.artists.join(' / '), albumName: song.album ?? '',
        interval: (song.durationMs ?? 0) / 1000, source,
    };
}

export function requestOptions(options = {}) {
    const headers = { ...options.headers };
    let body = options.body;
    if (options.formData) throw new Error('LX: multipart formData is not supported');
    if (options.form) {
        body = new URLSearchParams(options.form).toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (body && typeof body === 'object') {
        body = JSON.stringify(body);
        if (!Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
    }
    if (body !== undefined && typeof body !== 'string') throw new Error('LX: unsupported HTTP body');
    if (body?.length > 256 * 1024) throw new Error('LX: request body too large');
    return { method: String(options.method ?? 'GET').toUpperCase(), headers, body, timeoutMs: Math.min(30000, Math.max(1000, Number(options.timeout) || 15000)) };
}

