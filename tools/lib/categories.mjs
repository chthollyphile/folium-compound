// tools/lib/categories.mjs
// The market's categories, in display order. A community mod's category is registered in community.json
// (`category`, chosen in the submission form and changeable in the update form), an official mod's in
// official-meta.json; Awesome-Folia entries may name one too. Tags, unlike categories, are derived from
// each manifest at build time (autoTagsOf) and need no registration.
//
// Folia reads the same ids from catalog.json (`categories`), so an id is never renamed once published.

export const CATEGORIES = Object.freeze([
    { id: 'visualizer', label: { 'zh-CN': '歌词动画', en: 'Lyric visualizers' } },
    { id: 'lyrics', label: { 'zh-CN': '歌词显示', en: 'Lyrics display' } },
    { id: 'playback', label: { 'zh-CN': '播放与队列', en: 'Playback & queue' } },
    { id: 'audio', label: { 'zh-CN': '音效', en: 'Sound' } },
    { id: 'interface', label: { 'zh-CN': '界面与交互', en: 'Interface' } },
    { id: 'background', label: { 'zh-CN': '背景与壁纸', en: 'Backgrounds' } },
    { id: 'system', label: { 'zh-CN': '系统集成', en: 'System integration' } },
    { id: 'data', label: { 'zh-CN': '数据与统计', en: 'Data & stats' } },
    { id: 'ai', label: { 'zh-CN': 'AI', en: 'AI tools' } },
    { id: 'sample', label: { 'zh-CN': '开发样例', en: 'Samples' } },
    { id: 'other', label: { 'zh-CN': '其他', en: 'Other' } },
]);

export const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

/** The category of an id, or `other` for one that is missing or unknown. */
export const categoryOf = (id) => (CATEGORY_IDS.has(id) ? id : 'other');

/** The form's dropdown text of a category ("歌词动画 / Lyric visualizers (visualizer)"). */
export const categoryFormOption = (category) => `${category.label['zh-CN']} / ${category.label.en} (${category.id})`;

/*
 * The category a form's dropdown names: its id in brackets at the end. Null for an empty field, "keep"
 * (the update form) or "none" (the awesome form); undefined for a value that names no category.
 */
export const parseCategory = (value) => {
    const text = String(value ?? '').trim();
    if (!text || /保持不变|不分类|\bkeep\b|\bnone\b/i.test(text)) return null;
    const id = /\(([a-z][a-z0-9-]*)\)\s*$/.exec(text)?.[1] ?? text;
    return CATEGORY_IDS.has(id) ? id : undefined;
};

/*
 * The tags a manifest earns by itself: what kind of code it has and which sensitive capabilities it uses.
 * The site shows them on the card and searches them; Folia shows them in its mods view.
 */
export const AUTO_TAGS = Object.freeze({
    node: { 'zh-CN': 'Node 入口', en: 'Node entry' },
    network: { 'zh-CN': '联网', en: 'Network' },
    embed: { 'zh-CN': '嵌入网页', en: 'Embeds pages' },
    visualizer: { 'zh-CN': '歌词样式', en: 'Visualizer' },
    stage: { 'zh-CN': '播放页图层', en: 'Player layers' },
    export: { 'zh-CN': '视频导出', en: 'Video export' },
    equalizer: { 'zh-CN': '均衡器', en: 'Equalizer' },
    queue: { 'zh-CN': '改播放队列', en: 'Queue' },
    platform: { 'zh-CN': '平台账号', en: 'Platform account' },
    experimental: { 'zh-CN': '实验接口', en: 'Experimental' },
});

export const autoTagsOf = (manifest) => {
    const permissions = new Set(Array.isArray(manifest?.permissions) ? manifest.permissions : []);
    const experimental = Array.isArray(manifest?.experimental) ? manifest.experimental : [];
    const has = (...ids) => ids.some((id) => permissions.has(id));
    const tags = [];
    if (typeof manifest?.main === 'string') tags.push('node');
    if (has('net.fetch')) tags.push('network');
    if (has('net.embed') || (Array.isArray(manifest?.embedOrigins) && manifest.embedOrigins.length > 0)) tags.push('embed');
    if ([...permissions].some((id) => id.startsWith('visualizer.')) || (manifest?.contributes && typeof manifest.contributes === 'object' && 'visualizers' in manifest.contributes)) tags.push('visualizer');
    if (has('stageLayers', 'ui.stage')) tags.push('stage');
    if (has('render.export')) tags.push('export');
    if (has('equalizer.control')) tags.push('equalizer');
    if (has('playback.queue')) tags.push('queue');
    if ([...permissions].some((id) => id.startsWith('platform.')) || experimental.includes('platform.raw')) tags.push('platform');
    if (experimental.length > 0) tags.push('experimental');
    return tags;
};
