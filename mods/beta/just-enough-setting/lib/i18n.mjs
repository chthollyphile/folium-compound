// mods/Just-Enough-Setting/lib/i18n.mjs
// 模组自带的文案表。
//
// 宿主只负责翻译注册表条目的 label / description；面板里由模组自己画的 DOM 得自己翻译。
// 语言取面板 ctx.locale（FoliumPanelContext），拿不到时退回 <html lang> / navigator.language，
// 再拿不到按 en 处理；查不到的词条按 精确语言 → zh-CN → en → 任意一条 回退，与宿主对 FoliumLabel 的规则一致。

const DICT = Object.freeze({
  'zh-CN': {
    'panel.title': 'SMTC 设置',
    'panel.subtitle': '系统媒体三行与标签页标题，全部由片段列表编排。',

    'group.switches': '开关',
    'group.lyricSync': '歌词同步',
    'group.smtc': '系统媒体（SMTC）',
    'group.pageTitle': '网页标题',
    'group.steam': 'Steam',
    'group.presets': '快速预设',
    'group.io': '导入 / 导出',
    'group.diagnostics': '诊断信息',

    'group.consent': '接管范围（需要你同意）',
    'consent.hint': '系统媒体三行与窗口标题都是 Folia 自己的界面状态。模组默认一次都不碰，只有你在这里同意之后才接管。',
    'consent.denied': '当前未接管：系统媒体和窗口标题完全由 Folia 自己决定。',
    'consent.point1': '同意后，模组会替换页面里 MediaSession 的 metadata 写入入口，把 Folia 交给系统的歌名 / 歌手 / 专辑换成你的编排——这就是系统媒体浮窗显示的那三行。',
    'consent.point2': '「自定义标签页标题」打开时，模组还会改写窗口标题。',
    'consent.point3': '这两处都不是 Folia 给模组的公开接口。同意只记在这台机器上：不随配置导出，也不会被别人分享的配置顶替；随时可以撤销，撤销后立刻把 Folia 原本的值放回去。',
    'consent.grant': '我了解，允许接管',
    'consent.grantConfirm': '确认允许',
    'consent.revoke': '撤销同意',
    'consent.revokeConfirm': '确认撤销',
    'consent.granted': '已同意接管：下面「启用 SMTC 自定义」等开关决定改写哪些内容。',
    'consent.grantedToast': '已接管：系统媒体与窗口标题现在按你的编排走。',
    'consent.revokedToast': '已撤销：系统媒体与窗口标题已还原成 Folia 自己的值。',
    'consent.notStored': '这台机器存不下同意记录（隐私模式或存储被禁用），本次只在当前会话里生效。',
    'consent.notTakenOverShort': '未接管（还没有同意）',

    'option.enabled': '启用 SMTC 自定义',
    'option.enabledHint': '关闭后系统媒体恢复宿主原本的标题、歌手与专辑。需要先在上面同意接管。',
    'option.artwork': '向系统媒体发送封面',
    'option.artworkHint': '关闭后媒体浮窗只显示文字，不发送专辑图。',
    'option.pageTitle': '自定义标签页标题',
    'option.pageTitleHint': '关闭后恢复 Folia 原本的窗口标题。需要先在上面同意接管。',
    'option.hud': '播放页诊断 HUD',
    'option.hudHint': '在播放页左上角叠加实时诊断，排查歌词不显示时最有用。',

    'option.syncMode': '歌词延迟',
    'option.syncAuto': '自动（精确排期到行时间戳）',
    'option.syncManual': '手动（±3 秒）',
    'option.autoBaseline': '页面歌词基准微调',
    'option.autoBaselineHint': '自动模式下换算歌词时间的基准偏移。只有宿主歌词时钟不可用（不在播放页）时才会用上。',
    'option.manualOffset': '手动延迟',
    'option.manualOffsetHint': '整体推迟（正值）或提前（负值）系统媒体里的歌词。',

    'target.smtcTitle': '标题栏',
    'target.smtcArtist': '歌手栏',
    'target.smtcAlbum': '专辑栏',
    'target.pageTitle': '标签页标题',
    'target.steamText': 'Steam「正在玩」',
    'target.smtcTitleHint': '系统媒体第一行。',
    'target.smtcArtistHint': '系统媒体第二行。',
    'target.smtcAlbumHint': '系统媒体第三行。',
    'target.pageTitleHint': '窗口与标签页标题。',
    'target.steamTextHint': '好友列表里那句「正在玩」，只有一行，写短一点。',

    'fragment.song': '歌曲名',
    'fragment.artist': '歌手',
    'fragment.album': '专辑',
    'fragment.lyric': '歌词',
    'fragment.translation': '翻译',
    'fragment.word': '逐词歌词',
    'fragment.progress': '播放时长',
    'fragment.site': '网站名称',
    'fragment.connector': '连接符',
    'fragment.customPlaceholder': '自定义文本',
    'fragment.progressPlaceholder': '{elapsed} {bar} {total}',
    'fragment.progressTitle': '进度模板：{elapsed} 已播放 · {total} 总时长 · {remaining} 剩余 · {percent} 百分比 · {bar} 进度条（可写 {bar:20} 定长度、{bar:20:▓░} 换字符）',
    'fragment.spaceHint': '想用空格做分隔时就填一个空格——它和「 - 」一样会被保留。',
    'fragment.add': '添加片段',
    'fragment.addPlaceholder': '选择片段类型',
    'fragment.remove': '移除片段',
    'fragment.moveLeft': '前移',
    'fragment.moveRight': '后移',
    'fragment.drag': '拖拽排序',

    'option.steamEnabled': '把播放状态发到 Steam',
    'option.steamEnabledHint': '登录你自己的账号，把下面那一行发成好友列表里的「正在玩」。默认关闭。',

    'steam.intro': 'Steam 上没有 Folia 这个游戏，所以走的是「登录你的账号，把状态报成非 Steam 游戏」这条路。密码只在登录那一刻用一次，不落盘、不进配置导出；刷新令牌存在模组自己的数据目录里，下次启用会自动登录。',
    'steam.account': '账号名',
    'steam.accountHint': '只用来预填登录框，会随「视觉配置」一起导出，所以别在这里写密码。',
    'steam.accountPlaceholder': '你的 Steam 账号名',
    'steam.password': '密码',
    'steam.passwordHint': '登录成功后就不需要它了（之后靠刷新令牌）。',
    'steam.passwordPlaceholder': '只在这次登录里用一次',
    'steam.guard': 'Steam Guard 验证码',
    'steam.guardHint': '邮箱验证码或手机令牌的 5 位码；可以现在就填，也可以等提示「需要验证码」时再填。',
    'steam.guardPlaceholder': '5 位字母数字',
    'steam.login': '登录 Steam',
    'steam.submitGuard': '提交验证码',
    'steam.logout': '断开连接',
    'steam.forget': '忘记凭据',
    'steam.forgetConfirm': '再点一次清除本机凭据',

    'steam.state.unknown': '状态未知',
    'steam.state.unavailable': '不可用',
    'steam.state.idle': '未连接',
    'steam.state.connecting': '登录中…',
    'steam.state.guard': '需要验证码',
    'steam.state.online': '在线',
    'steam.state.error': '登录出错',

    'steam.detail.loading': '正在读取连接状态…',
    'steam.detail.noMain': '当前宿主没有暴露主进程入口，这一项用不了。',
    'steam.detail.disabled': '打开上面的开关后才会连接。',
    'steam.detail.idle': '填账号名与密码，或打开开关让它用上次的令牌自动登录。',
    'steam.detail.connecting': '正在连接 Steam 网络…',
    'steam.detail.guardEmail': 'Steam 往你邮箱发了验证码，填到下面提交。',
    'steam.detail.guardMobile': '请填手机上 Steam 令牌显示的验证码。',
    'steam.detail.guardWrong': '上一个验证码不对，再试一次。',
    'steam.detail.online': '已登录为 {name}',
    'steam.detail.playing': '已推送：{text}',
    'steam.detail.playingEmpty': '还没有推送任何内容。',
    'steam.detail.pending': '等到线上再推：{text}',
    'steam.detail.maxLength': '上限 {count} 字符',

    'steam.err.accountRequired': '请先填账号名',
    'steam.err.passwordRequired': '请填密码',
    'steam.err.guardRequired': '请填验证码',
    'steam.err.guardTimeout': '等验证码等到超时了，重新登录一次吧',
    'steam.err.guardNotPending': '现在没有在等验证码',
    'steam.err.guardWrong': '验证码不对，再试一次',
    'steam.err.dependency': 'Steam 连接器没有打包进来（模组目录里缺 steam/vendor.cjs）。',
    'steam.err.generic': '登录失败：{message}',
    'steam.err.notOk': '这一步没有成功，看下面的状态行',

    'steam.eresult.invalidPassword': '账号名或密码不对',
    'steam.eresult.rateLimit': '请求太频繁了，过一会儿再试',
    'steam.eresult.needEmail': '这个账号需要邮箱验证码',
    'steam.eresult.needTwoFactor': '这个账号需要手机令牌',
    'steam.eresult.badAuthCode': '邮箱验证码不对',
    'steam.eresult.badTwoFactor': '手机令牌验证码不对',
    'steam.eresult.accountNotFound': '找不到这个账号',
    'steam.eresult.serviceUnavailable': 'Steam 服务暂时不可用，稍后再试',

    'message.steamLoggedIn': '已登录 Steam',
    'message.steamLoginFailed': 'Steam 登录没有成功',
    'message.steamGuardSubmitted': '验证码已提交',
    'message.steamLoggedOut': '已断开 Steam 连接（令牌保留，下次自动登录）',
    'message.steamForgotten': '本机的 Steam 凭据已清除',

    'hint.preview': '预览',
    'hint.empty': '空栏：这一栏不发任何内容。',
    'hint.allEmpty': '三栏全空时将不接管系统媒体信息。',
    'hint.edgeSpace': '含两端空白',
    'hint.progressTemplate': '进度模板：{elapsed} 已播放 · {total} 总时长 · {remaining} 剩余 · {percent} 百分比 · {bar} 进度条（{bar:20} 定长度、{bar:20:▓░} 换字符）。留空即用默认。',
    'hint.spaceGlyph': '␣ 代表一个空格字符',

    'action.copy': '复制',
    'action.download': '下载',
    'action.importText': '从文本导入',
    'action.pickFile': '选择文件…',
    'action.reset': '恢复默认',
    'action.resetConfirm': '再点一次确认恢复默认',
    'action.cancel': '取消',
    'action.exportTitle': '导出 JSON',
    'action.importTitle': '导入 JSON',
    'action.importHint': '粘贴配置 JSON，或选择一个 .json 文件；导入会覆盖当前的编排与选项。',
    'action.saveFile': '导出文件名',

    'message.copied': '配置已复制到剪贴板',
    'message.copyFailed': '复制失败，请手动选中文本复制',
    'message.downloaded': '已导出配置文件',
    'message.imported': '配置已导入',
    'message.importFailed': '导入失败',
    'message.reset': '已恢复默认配置',
    'message.presetApplied': '已套用预设',
    'message.fileFailed': '读取文件失败',
    'message.panelOpened': '已打开 SMTC 设置面板',

    'diag.title': '诊断信息',
    'diag.modVersion': '模组版本',
    'diag.song': '歌曲',
    'diag.songId': '歌曲 ID',
    'diag.source': '来源',
    'diag.lines': '歌词行数',
    'diag.progress': '播放进度',
    'diag.current': '当前歌词',
    'diag.words': '逐词进度',
    'diag.layout': '标题栏编排',
    'diag.clock': '歌词时钟',
    'diag.hostLine': '宿主行号',
    'diag.smtc': '系统媒体',
    'diag.pageTitle': '标签页',
    'diag.steam': 'Steam 连接',
    'diag.steamText': 'Steam 推送',
    'diag.clockHost': '宿主歌词时钟（精确）',
    'diag.clockEstimated': '按播放进度估算',
    'diag.noSong': '没有正在播放的歌曲',
    'diag.noLyrics': '没有歌词数据',
    'diag.noWordTiming': '本行没有逐词时间',
    'diag.none': '—',
    'diag.idle': '未接管',

    'status.enabled': 'SMTC 自定义已开启',
    'status.disabled': 'SMTC 自定义已关闭',
    'status.unavailable': '当前环境没有系统媒体接口',
  },

  en: {
    'panel.title': 'SMTC settings',
    'panel.subtitle': 'The three system media rows and the tab title, all composed from fragment lists.',

    'group.switches': 'Switches',
    'group.lyricSync': 'Lyric sync',
    'group.smtc': 'System media (SMTC)',
    'group.pageTitle': 'Web page title',
    'group.steam': 'Steam',
    'group.presets': 'Quick presets',
    'group.io': 'Import / export',
    'group.diagnostics': 'Diagnostics',

    'group.consent': 'Host takeover (needs your consent)',
    'consent.hint': 'The three system media rows and the window title are Folia’s own interface state. The mod touches neither until you agree here.',
    'consent.denied': 'Not taken over: Folia decides the system media panel and the window title.',
    'consent.point1': 'Once you agree, the mod replaces the page’s MediaSession metadata setter, so the song / artist / album Folia hands to the system become your layout — that is what the system media flyout shows.',
    'consent.point2': 'With “Customize the tab title” on, the mod also rewrites the window title.',
    'consent.point3': 'Neither is a public Folium interface for mods. Your consent is stored on this machine only: it never leaves with an exported config and is never granted by importing someone else’s. Revoke it any time and Folia’s own values are put back at once.',
    'consent.grant': 'I understand — allow',
    'consent.grantConfirm': 'Confirm allow',
    'consent.revoke': 'Revoke consent',
    'consent.revokeConfirm': 'Confirm revoke',
    'consent.granted': 'Taken over: the switches below decide what gets rewritten.',
    'consent.grantedToast': 'Taken over — the system media panel and the window title now follow your layout.',
    'consent.revokedToast': 'Revoked — Folia’s own values are back.',
    'consent.notStored': 'This machine cannot store the consent (private mode or storage disabled); it only holds for this session.',
    'consent.notTakenOverShort': 'not taken over (no consent)',

    'option.enabled': 'Customize the system media panel',
    'option.enabledHint': 'Off restores the host title, artist and album. Needs the consent above.',
    'option.artwork': 'Send cover art to the system media panel',
    'option.artworkHint': 'Off sends text only, without the album thumbnail.',
    'option.pageTitle': 'Customize the tab title',
    'option.pageTitleHint': 'Off restores the plain Folia window title. Needs the consent above.',
    'option.hud': 'Diagnostics HUD on the player page',
    'option.hudHint': 'Overlays live diagnostics in the top-left corner of the player page.',

    'option.syncMode': 'Lyric delay',
    'option.syncAuto': 'Auto (scheduled to line timestamps)',
    'option.syncManual': 'Manual (±3 s)',
    'option.autoBaseline': 'Page lyric baseline fine-tune',
    'option.autoBaselineHint': 'The base offset used to turn playback time into lyric time. Only used when the host lyric clock is unavailable (not on the player page).',
    'option.manualOffset': 'Manual delay',
    'option.manualOffsetHint': 'Delays (positive) or advances (negative) the lyric shown in the system media panel.',

    'target.smtcTitle': 'Title row',
    'target.smtcArtist': 'Artist row',
    'target.smtcAlbum': 'Album row',
    'target.pageTitle': 'Tab title',
    'target.steamText': 'Steam “playing”',
    'target.smtcTitleHint': 'First system media row.',
    'target.smtcArtistHint': 'Second system media row.',
    'target.smtcAlbumHint': 'Third system media row.',
    'target.pageTitleHint': 'Window and tab title.',
    'target.steamTextHint': 'The single “playing” line your friends see — keep it short.',

    'fragment.song': 'Song',
    'fragment.artist': 'Artist',
    'fragment.album': 'Album',
    'fragment.lyric': 'Lyric',
    'fragment.translation': 'Translation',
    'fragment.word': 'Word-by-word lyric',
    'fragment.progress': 'Playback time',
    'fragment.site': 'Site name',
    'fragment.connector': 'Separator',
    'fragment.customPlaceholder': 'Custom text',
    'fragment.progressPlaceholder': '{elapsed} {bar} {total}',
    'fragment.progressTitle': 'Progress template: {elapsed} elapsed · {total} total · {remaining} remaining · {percent} percent · {bar} the bar (use {bar:20} for a length, {bar:20:▓░} for other characters)',
    'fragment.spaceHint': 'A single space works as a separator too — it is kept just like “ - ”.',
    'fragment.add': 'Add fragment',
    'fragment.addPlaceholder': 'Pick a fragment type',
    'fragment.remove': 'Remove fragment',
    'fragment.moveLeft': 'Move earlier',
    'fragment.moveRight': 'Move later',
    'fragment.drag': 'Drag to reorder',

    'option.steamEnabled': 'Report playback to Steam',
    'option.steamEnabledHint': 'Logs into your own account and reports the row below as the “playing” line in your friends list. Off by default.',

    'steam.intro': 'Folia is not a game on Steam, so this goes the other way round: it logs into your account and reports the state as a non-Steam game. The password is used once, at sign-in, and is never written to disk or exported; the refresh token is stored in the mod’s own data folder so the next launch signs in by itself.',
    'steam.account': 'Account name',
    'steam.accountHint': 'Only used to pre-fill the sign-in box. It is exported with your visual config, so never put a password here.',
    'steam.accountPlaceholder': 'Your Steam account name',
    'steam.password': 'Password',
    'steam.passwordHint': 'Not needed after the first successful sign-in — the refresh token takes over.',
    'steam.passwordPlaceholder': 'Used once, for this sign-in',
    'steam.guard': 'Steam Guard code',
    'steam.guardHint': 'The 5-character code from email or the mobile authenticator. You can fill it now, or wait until the panel asks for it.',
    'steam.guardPlaceholder': '5 letters or digits',
    'steam.login': 'Sign in to Steam',
    'steam.submitGuard': 'Submit code',
    'steam.logout': 'Disconnect',
    'steam.forget': 'Forget credentials',
    'steam.forgetConfirm': 'Click again to wipe them from this machine',

    'steam.state.unknown': 'Unknown',
    'steam.state.unavailable': 'Unavailable',
    'steam.state.idle': 'Not connected',
    'steam.state.connecting': 'Signing in…',
    'steam.state.guard': 'Code required',
    'steam.state.online': 'Online',
    'steam.state.error': 'Sign-in failed',

    'steam.detail.loading': 'Reading the connection state…',
    'steam.detail.noMain': 'This host does not expose a main-process entry, so this cannot work.',
    'steam.detail.disabled': 'Turn the switch above on to connect.',
    'steam.detail.idle': 'Fill in the account name and password, or switch it on to reuse the saved token.',
    'steam.detail.connecting': 'Connecting to the Steam network…',
    'steam.detail.guardEmail': 'Steam emailed you a code — type it below and submit.',
    'steam.detail.guardMobile': 'Enter the code shown by the Steam mobile authenticator.',
    'steam.detail.guardWrong': 'That code was rejected — try the next one.',
    'steam.detail.online': 'Signed in as {name}',
    'steam.detail.playing': 'Reported: {text}',
    'steam.detail.playingEmpty': 'Nothing reported yet.',
    'steam.detail.pending': 'Will be reported once online: {text}',
    'steam.detail.maxLength': 'up to {count} characters',

    'steam.err.accountRequired': 'An account name is required',
    'steam.err.passwordRequired': 'A password is required',
    'steam.err.guardRequired': 'A code is required',
    'steam.err.guardTimeout': 'Waited too long for the code — sign in again',
    'steam.err.guardNotPending': 'No code is being awaited right now',
    'steam.err.guardWrong': 'That code was rejected — try again',
    'steam.err.dependency': 'The Steam connector was not bundled (steam/vendor.cjs is missing from the mod folder).',
    'steam.err.generic': 'Sign-in failed: {message}',
    'steam.err.notOk': 'That step did not go through — see the status line below',

    'steam.eresult.invalidPassword': 'Wrong account name or password',
    'steam.eresult.rateLimit': 'Too many attempts — try again in a while',
    'steam.eresult.needEmail': 'This account needs an emailed code',
    'steam.eresult.needTwoFactor': 'This account needs a mobile authenticator code',
    'steam.eresult.badAuthCode': 'Wrong emailed code',
    'steam.eresult.badTwoFactor': 'Wrong authenticator code',
    'steam.eresult.accountNotFound': 'No such account',
    'steam.eresult.serviceUnavailable': 'Steam is temporarily unavailable — try again later',

    'message.steamLoggedIn': 'Signed in to Steam',
    'message.steamLoginFailed': 'Steam sign-in did not go through',
    'message.steamGuardSubmitted': 'Code submitted',
    'message.steamLoggedOut': 'Disconnected from Steam (token kept for next time)',
    'message.steamForgotten': 'Steam credentials wiped from this machine',

    'hint.preview': 'Preview',
    'hint.empty': 'Empty row: sends nothing.',
    'hint.allEmpty': 'With all three rows empty the mod leaves the system media panel alone.',
    'hint.edgeSpace': 'keeps edge whitespace',
    'hint.progressTemplate': 'Progress template: {elapsed} elapsed · {total} total · {remaining} remaining · {percent} percent · {bar} the bar ({bar:20} for a length, {bar:20:▓░} for other characters). Empty means the default.',
    'hint.spaceGlyph': '␣ stands for one space character',

    'action.copy': 'Copy',
    'action.download': 'Download',
    'action.importText': 'Import from text',
    'action.pickFile': 'Choose a file…',
    'action.reset': 'Restore defaults',
    'action.resetConfirm': 'Click again to restore defaults',
    'action.cancel': 'Cancel',
    'action.exportTitle': 'Export JSON',
    'action.importTitle': 'Import JSON',
    'action.importHint': 'Paste a config JSON, or pick a .json file. Importing replaces the current layout and options.',
    'action.saveFile': 'Export file name',

    'message.copied': 'Config copied to the clipboard',
    'message.copyFailed': 'Copy failed — select the text and copy it manually',
    'message.downloaded': 'Config file exported',
    'message.imported': 'Config imported',
    'message.importFailed': 'Import failed',
    'message.reset': 'Defaults restored',
    'message.presetApplied': 'Preset applied',
    'message.fileFailed': 'Could not read the file',
    'message.panelOpened': 'SMTC settings panel opened',

    'diag.title': 'Diagnostics',
    'diag.modVersion': 'Mod version',
    'diag.song': 'Song',
    'diag.songId': 'Song ID',
    'diag.source': 'Source',
    'diag.lines': 'Lyric lines',
    'diag.progress': 'Progress',
    'diag.current': 'Current lyric',
    'diag.words': 'Word progress',
    'diag.layout': 'Title row layout',
    'diag.clock': 'Lyric clock',
    'diag.hostLine': 'Host line index',
    'diag.smtc': 'System media',
    'diag.pageTitle': 'Tab title',
    'diag.steam': 'Steam link',
    'diag.steamText': 'Steam “playing”',
    'diag.clockHost': 'Host lyric clock (exact)',
    'diag.clockEstimated': 'Estimated from playback time',
    'diag.noSong': 'Nothing is playing',
    'diag.noLyrics': 'no lyric data',
    'diag.noWordTiming': 'no word timing on this line',
    'diag.none': '—',
    'diag.idle': 'not taken over',

    'status.enabled': 'SMTC customization on',
    'status.disabled': 'SMTC customization off',
    'status.unavailable': 'No system media API in this environment',
  },
});

const resolveLocale = (locale) => {
  const raw = String(locale || document.documentElement.lang || navigator.language || '').toLowerCase();
  if (raw.startsWith('zh')) return 'zh-CN';
  if (raw.startsWith('en')) return 'en';
  return raw ? raw : 'en';
};

// 精确语言查不到时按宿主的回退顺序走（先 en，再任意一条），保证永远拿得到字符串而不是 key。
const pick = (locale, key) => {
  const table = DICT[locale];
  if (table && table[key] !== undefined) return table[key];
  if (DICT.en[key] !== undefined) return DICT.en[key];
  return Object.values(DICT).map((entry) => entry[key]).find((value) => value !== undefined) ?? key;
};

/**
 * 造一个翻译函数：`t('panel.title')`，第二参数可以给 `{ name: '…' }` 做 `{name}` 插值。
 * 面板每次挂载时按当时的 locale 造一次，语言切换由宿主重新挂载承担。
 */
export const createTranslator = (locale) => {
  const resolved = resolveLocale(locale);
  return (key, values) => {
    const template = pick(resolved, key);
    if (!values) return template;
    return Object.keys(values).reduce(
      (text, name) => text.replaceAll(`{${name}}`, String(values[name])),
      template,
    );
  };
};

/**
 * 取 FoliumLabel（`{ 'zh-CN': …, en: … }`）里的文本，规则与宿主一致：
 * 精确语言 → en → 任意一条。预设名、片段类型名这类定义在 lib/config.mjs 里的标签走这里。
 */
export const pickLabel = (label, locale) => {
  if (typeof label === 'string') return label;
  if (!label || typeof label !== 'object') return '';
  const resolved = resolveLocale(locale);
  if (typeof label[resolved] === 'string') return label[resolved];
  if (typeof label.en === 'string') return label.en;
  const found = Object.values(label).find((value) => typeof value === 'string');
  return found ?? '';
};
