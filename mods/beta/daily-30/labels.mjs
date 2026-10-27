// mods/daily-30/labels.mjs
// Small text table for the home tab and the mod panel. The host renders registry labels from their
// zh-CN/en objects; the page itself picks one language from ctx.locale, which is what a mod can see.

export const label = (zh, en) => ({ 'zh-CN': zh, en });

const zh = {
    title: '每日推荐',
    subtitle: '每天自动记录网易云音乐「每日推荐」。',
    netease: '网易云音乐',
    dateList: '日期',
    today: '今日',
    days: '天',
    dayOne: '天',
    songs: '首',
    songOne: '首',
    captureNow: '立即记录',
    capturing: '记录中…',
    refresh: '刷新',
    export: '导出 JSON',
    exporting: '导出中…',
    searchPlaceholder: '搜索全部记录（歌名 / 歌手 / 专辑）',
    searchResults: '搜索结果',
    dayList: '按日期',
    columnTitle: '标题',
    columnAlbum: '专辑',
    columnTime: '时长',
    noResults: '没有找到匹配的歌曲。',
    emptyTitle: '还没有记录',
    emptyBody: '在 Folia 里登录网易云音乐，登录后这里会自动记录每天的推荐；也可以点「立即记录」。',
    loginHint: '在 Folia 的设置里登录后，这里才会开始记录。',
    notSignedIn: '未登录',
    playAll: '播放全部',
    playing: '正在播放…',
    play: '播放',
    resolving: '正在解析…',
    noPlayable: '这些歌都无法解析播放。',
    partialPlay: '有 {n} 首歌无法解析，已播放其余歌曲。',
    queueRefused: '播放队列刚被改动，请再试一次。',
    lastChecked: '上次检查',
    never: '还没有检查',
    autoOff: '自动记录已关闭',
    backfilled: '补回',
    exported: '已导出到 {path}',
    exportEmpty: '还没有可以导出的记录。',
    recorded: '每日推荐已记录：{n} 首。',
    recordFailed: '每日推荐没有记录成功：{error}。',
    dayMissing: '这一天没有记录。',
    errorGeneric: '记录失败',
    errorCodes: {
        'not-signed-in': '未登录',
        'session-expired': '登录已失效',
        empty: '今天还没有歌',
        unsupported: '接口不可用',
        network: '网络错误',
        'rate-limited': '请求过于频繁',
        'vip-required': '需要会员',
        write: '写入失败',
        unknown: '未知错误',
    },
};

const en = {
    title: 'Daily Recommendation',
    subtitle: 'Records the NetEase Daily Recommendation every day.',
    netease: 'NetEase',
    dateList: 'Dates',
    today: 'Today',
    days: 'days',
    dayOne: 'day',
    songs: 'songs',
    songOne: 'song',
    captureNow: 'Record now',
    capturing: 'Recording…',
    refresh: 'Refresh',
    export: 'Export JSON',
    exporting: 'Exporting…',
    searchPlaceholder: 'Search all records (title / artist / album)',
    searchResults: 'Search results',
    dayList: 'By date',
    columnTitle: 'Title',
    columnAlbum: 'Album',
    columnTime: 'Time',
    noResults: 'No matching songs.',
    emptyTitle: 'Nothing recorded yet',
    emptyBody: 'Sign in to NetEase in Folia. Recommendations are then recorded here automatically, or use "Record now".',
    loginHint: 'Recording starts after you sign in to NetEase in Folia.',
    notSignedIn: 'Not signed in',
    playAll: 'Play all',
    playing: 'Playing…',
    play: 'Play',
    resolving: 'Resolving…',
    noPlayable: 'None of these songs could be resolved for playback.',
    partialPlay: '{n} songs could not be resolved; the rest are playing.',
    queueRefused: 'The play queue changed; try again.',
    lastChecked: 'Last check',
    never: 'Never checked',
    autoOff: 'Automatic recording is off',
    backfilled: 'recovered',
    exported: 'Exported to {path}',
    exportEmpty: 'There is nothing to export yet.',
    recorded: 'Recorded {n} songs for today.',
    recordFailed: 'Could not record today: {error}.',
    dayMissing: 'No record for this day.',
    errorGeneric: 'Recording failed',
    errorCodes: {
        'not-signed-in': 'not signed in',
        'session-expired': 'sign-in expired',
        empty: 'no songs yet',
        unsupported: 'interface unavailable',
        network: 'network error',
        'rate-limited': 'rate limited',
        'vip-required': 'membership required',
        write: 'could not write',
        unknown: 'unknown error',
    },
};

export const labels = (locale = 'zh-CN') => (String(locale).toLowerCase().startsWith('zh') ? zh : en);

export const fill = (text, values) => String(text).replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
));

export const songCount = (t, count) => `${count} ${count === 1 ? t.songOne : t.songs}`;

export const dayCount = (t, count) => `${count} ${count === 1 ? t.dayOne : t.days}`;

export const errorLabel = (t, code) => t.errorCodes[code] || t.errorCodes.unknown;
