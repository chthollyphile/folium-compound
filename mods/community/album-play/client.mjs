/**
 * album-play — 专辑随机与专辑循环（Folium 1.7+）
 *
 * 宿主自带的随机是「歌曲级」的（src/components/app/playback/shuffle/shuffleRound.ts），循环只有
 * off / all / one，没有「专辑」这一层。这个模组用公开接口补上：
 *
 *   - 专辑随机：把队列按专辑分组，整张专辑作为一个单位洗牌，组内顺序不变；
 *   - 专辑循环：把队列换成当前专辑的曲目并设成列表循环，放完最后一首回到第一首；
 *   - 退出专辑循环也走同一个撤销（没有单独的「恢复原队列」入口）；
 *   - 「下一张专辑 / 上一张专辑」按队列顺序跳到相邻专辑的第一首，首尾回绕；
 *   - 「撤销上一次专辑操作」自己记住上一层队列，不依赖宿主那条 10 秒的可撤销提示
 *     （ui.toast 与它共用同一个提示通道，所以我们的成功提示会盖掉它）。
 *
 * 依赖 folium.playback.replaceQueue（Folium 1.7，权限 playback.queue）与
 * setLoopMode / playQueueItem（权限 playback.control）。
 */

const PAGE = 500; // getQueue 单页上限
const MAX_QUEUE = 5000; // replaceQueue 与共享 ref 池的上限

const LABEL = {
    'zh-CN': {
        section: '专辑播放',
        shuffle: '专辑随机播放',
        shuffleDesc: '按专辑洗牌：整张专辑保持连续，组内顺序不变',
        loop: '循环这张专辑',
        loopDesc: '把队列换成当前专辑并设为列表循环；退出时用「撤销上一次专辑操作」',
        undo: '撤销上一次专辑操作',
        undoDesc: '把播放队列和循环模式恢复到上一次专辑随机 / 专辑循环之前（在专辑循环里就是退出循环）',
        undone: '已撤销，队列已恢复',
        nothingToUndo: '没有可撤销的专辑操作',
        undoFailed: '撤销失败，队列没有恢复',
        pin: '保留当前专辑在最前',
        pinDesc: '专辑随机时，正在播放的这张专辑排在最前，播放不中断；关掉则连它一起洗',
        loopAll: '随机后设为列表循环',
        loopAllDesc: '专辑随机后把循环模式设为「列表循环」，一轮放完自动从头开始',
        tab: '专辑',
        panelTitle: '专辑播放',
        panelNow: '当前专辑',
        panelLoop: '专辑循环',
        panelOn: '开',
        panelOff: '关',
        panelShuffle: '专辑随机',
        panelLoopBtn: '循环本专辑',
        panelUndo: '撤销上一次',
        panelExitLoop: '退出专辑循环',
        panelPrev: '上一张',
        panelNext: '下一张',
        next: '下一张专辑',
        nextDesc: '按队列顺序跳到下一张专辑的第一首；到末尾后回到第一张',
        prev: '上一张专辑',
        prevDesc: '按队列顺序跳到上一张专辑的第一首；到开头后回到最后一张',
        jumped: '已切到专辑《{name}》',
        noOtherAlbum: '队列里只有这一张专辑，没有别的专辑可切',
        jumpFailed: '切歌失败，队列可能刚刚变过，请再试一次',
        panelHint: '专辑随机会把整个队列按专辑重排，专辑循环会暂时替换队列；两者都能用「撤销上一次」还原。上一张 / 下一张按队列顺序跳到相邻专辑的第一首。',
        unknownAlbum: '未知专辑',
        noSong: '当前没有播放的歌曲',
        needQueue: '只能在普通播放队列里使用（个人 FM / 外部 Stage 播放不支持）',
        onlyOneAlbum: '当前队列只有一张专辑，不需要随机',
        emptyQueue: '播放队列是空的',
        tooLong: '队列超过 5000 首，超出 replaceQueue 的上限，暂不支持整表重排',
        albumMissing: '队列里找不到当前歌曲所属的专辑',
        restoreFailed: '恢复原队列失败',
        changedOutside: '队列被其他操作修改，专辑循环已停止；队列保持当前内容，可用「撤销上一次专辑操作」还原',
        retry: '队列在读取时发生变化，请再试一次',
        reasonStage: '外部 Stage 播放正在占用播放器',
        reasonTransition: '正在做智能过渡，稍后再试',
        reasonStaleVersion: '队列刚刚变过',
        reasonStaleRef: '歌曲引用已失效，请重试',
        reasonNotQueueable: '有歌曲不能放进播放队列',
        reasonRateLimited: '操作太频繁，稍后再试',
    },
    'zh-TW': {
        section: '專輯播放',
        shuffle: '專輯隨機播放',
        shuffleDesc: '按專輯洗牌：整張專輯保持連續，組內順序不變',
        loop: '循環這張專輯',
        loopDesc: '把佇列換成目前專輯並設為清單循環；退出時用「復原上一次專輯操作」',
        undo: '復原上一次專輯操作',
        undoDesc: '把播放佇列和循環模式恢復到上一次專輯隨機 / 專輯循環之前（在專輯循環裡就是退出循環）',
        undone: '已復原，佇列已恢復',
        nothingToUndo: '沒有可復原的專輯操作',
        undoFailed: '復原失敗，佇列沒有恢復',
        pin: '保留目前專輯在最前',
        pinDesc: '專輯隨機時，正在播放的這張專輯排在最前，播放不中斷；關掉則連它一起洗',
        loopAll: '隨機後設為清單循環',
        loopAllDesc: '專輯隨機後把循環模式設為「清單循環」，一輪放完自動從頭開始',
        tab: '專輯',
        panelTitle: '專輯播放',
        panelNow: '目前專輯',
        panelLoop: '專輯循環',
        panelOn: '開',
        panelOff: '關',
        panelShuffle: '專輯隨機',
        panelLoopBtn: '循環本專輯',
        panelUndo: '復原上一次',
        panelExitLoop: '退出專輯循環',
        panelPrev: '上一張',
        panelNext: '下一張',
        next: '下一張專輯',
        nextDesc: '按佇列順序跳到下一張專輯的第一首；到結尾後回到第一張',
        prev: '上一張專輯',
        prevDesc: '按佇列順序跳到上一張專輯的第一首；到開頭後回到最後一張',
        jumped: '已切到專輯《{name}》',
        noOtherAlbum: '佇列裡只有這一張專輯，沒有別的專輯可切',
        jumpFailed: '切歌失敗，佇列可能剛剛變過，請再試一次',
        panelHint: '專輯隨機會把整個佇列按專輯重排，專輯循環會暫時替換佇列；兩者都能用「復原上一次」還原。上一張 / 下一張按佇列順序跳到相鄰專輯的第一首。',
        unknownAlbum: '未知專輯',
        noSong: '目前沒有播放的歌曲',
        needQueue: '只能在一般播放佇列裡使用（個人 FM / 外部 Stage 播放不支援）',
        onlyOneAlbum: '目前佇列只有一張專輯，不需要隨機',
        emptyQueue: '播放佇列是空的',
        tooLong: '佇列超過 5000 首，超出 replaceQueue 的上限，暫不支援整表重排',
        albumMissing: '佇列裡找不到目前歌曲所屬的專輯',
        restoreFailed: '恢復原佇列失敗',
        changedOutside: '佇列被其他操作修改，專輯循環已停止；佇列保持目前內容，可用「復原上一次專輯操作」還原',
        retry: '佇列在讀取時發生變化，請再試一次',
        reasonStage: '外部 Stage 播放正在佔用播放器',
        reasonTransition: '正在做智慧過渡，稍後再試',
        reasonStaleVersion: '佇列剛剛變過',
        reasonStaleRef: '歌曲引用已失效，請重試',
        reasonNotQueueable: '有歌曲不能放進播放佇列',
        reasonRateLimited: '操作太頻繁，稍後再試',
    },
    en: {
        section: 'Album playback',
        shuffle: 'Shuffle by album',
        shuffleDesc: 'Shuffle albums as whole blocks, keeping each album in its own order',
        loop: 'Repeat this album',
        loopDesc: 'Replace the queue with the current album and repeat it; leave it with “Undo the last album action”',
        undo: 'Undo the last album action',
        undoDesc: 'Put the play queue and the repeat mode back to what they were before the last album shuffle or album repeat (inside album repeat, this exits it)',
        undone: 'Undone; the previous queue is back',
        nothingToUndo: 'No album action to undo',
        undoFailed: 'Undo failed; the queue was not restored',
        pin: 'Keep the current album first',
        pinDesc: 'When shuffling, leave the album that is playing at the front so playback is not interrupted',
        loopAll: 'Turn on list repeat after shuffling',
        loopAllDesc: 'After an album shuffle, set the repeat mode to all so the round starts over',
        tab: 'Albums',
        panelTitle: 'Album playback',
        panelNow: 'Current album',
        panelLoop: 'Album repeat',
        panelOn: 'on',
        panelOff: 'off',
        panelShuffle: 'Shuffle albums',
        panelLoopBtn: 'Repeat album',
        panelUndo: 'Undo last',
        panelExitLoop: 'Exit album repeat',
        panelPrev: 'Previous',
        panelNext: 'Next',
        next: 'Next album',
        nextDesc: 'Jump to the first song of the next album in the queue, wrapping at the end',
        prev: 'Previous album',
        prevDesc: 'Jump to the first song of the previous album in the queue, wrapping at the start',
        jumped: 'Now playing album “{name}”',
        noOtherAlbum: 'The queue holds only this album; there is nothing else to switch to',
        jumpFailed: 'Could not switch songs; the queue may have just changed',
        panelHint: 'Album shuffle reorders the whole queue and album repeat replaces it for now; both can be reverted with “Undo last”. Previous / Next jump to the first song of the neighbouring album in queue order.',
        unknownAlbum: 'Unknown album',
        noSong: 'Nothing is playing',
        needQueue: 'Only works on the normal play queue (not Personal FM or external Stage playback)',
        onlyOneAlbum: 'The queue holds a single album; nothing to shuffle',
        emptyQueue: 'The play queue is empty',
        tooLong: 'The queue has more than 5000 songs, beyond replaceQueue; whole-queue reordering is not supported',
        albumMissing: 'The current song’s album is not in the queue',
        restoreFailed: 'Could not restore the previous queue',
        changedOutside: 'The queue changed elsewhere, so album repeat stopped; the queue keeps its current songs, and “Undo the last album action” can put it back',
        retry: 'The queue changed while being read; try again',
        reasonStage: 'External Stage playback holds the player',
        reasonTransition: 'An automix blend is under way; try again shortly',
        reasonStaleVersion: 'The queue just changed',
        reasonStaleRef: 'A song reference expired; try again',
        reasonNotQueueable: 'A song cannot be in the play queue',
        reasonRateLimited: 'Too many queue changes in a row; try again shortly',
    },
};

const REASON_TEXT = {
    stage: 'reasonStage',
    transition: 'reasonTransition',
    'stale-version': 'reasonStaleVersion',
    'stale-ref': 'reasonStaleRef',
    'not-queueable': 'reasonNotQueueable',
    'rate-limited': 'reasonRateLimited',
};

export default function activate(folium) {
    if (folium.env && folium.env.context === 'export') return; // 导出窗口里没有播放控制

    const { playback, ui, events, registries } = folium;
    const hostMinor = folium.host && folium.host.folium ? folium.host.folium.minor : 0;
    // 宿主没给出界面语言接口；用浏览器语言猜一下，猜不到就中文。
    const guessLocale = () => {
        const raw = (typeof navigator !== 'undefined' && navigator.language) || 'zh-CN';
        if (LABEL[raw]) return raw;
        if (raw.startsWith('zh-TW') || raw.startsWith('zh-HK') || raw.startsWith('zh-Hant')) return 'zh-TW';
        if (raw.startsWith('zh')) return 'zh-CN';
        return 'en';
    };
    const t = (key) => {
        const locale = guessLocale();
        return LABEL[locale][key] || LABEL['zh-CN'][key];
    };
    /** 同上，另外把 {name} 这类占位符换掉。 */
    const tf = (key, vars) => {
        const text = t(key);
        return typeof text === 'string'
            ? text.replace(/\{(\w+)\}/g, (whole, name) => (vars && name in vars ? String(vars[name]) : whole))
            : text;
    };

    if (hostMinor < 7) {
        if (folium.log && folium.log.error) folium.log.error('album-play 需要 Folium 1.7 及以上（replaceQueue）');
        ui.toast('专辑播放需要 Folia 的 Folium 1.7 及以上', { type: 'error' });
        return;
    }

    // 专辑循环进行中的状态；只活在内存里（模组重载后恢复要靠宿主的撤销提示）
    let albumLoop = null;
    let refreshPanel = null;
    /** 上一次整表替换之前的队列，供「撤销上一次专辑操作」用；只留一层，存在内存里。 */
    let lastUndo = null;

    // ------------------------------------------------------------------ 队列

    /** 同步读完整个播放队列；读取期间 version 变化就放弃。 */
    function readWholeQueue() {
        const first = playback.getQueue({ offset: 0, limit: PAGE });
        const songs = [];
        const version = first.version;
        const length = first.length;
        let currentIndex = first.currentIndex;

        if (length > MAX_QUEUE) throw new Error(t('tooLong'));

        for (let offset = 0; offset < length; offset += PAGE) {
            const page = offset === 0 ? first : playback.getQueue({ offset, limit: PAGE });
            if (page.version !== version) throw new Error(t('retry'));
            for (const item of page.items) songs.push(item.song);
            if (page.items.length === 0) break;
        }
        if (songs.length !== length) throw new Error(t('retry'));
        return { songs, version, kind: first.kind, currentIndex };
    }

    function songKeyOf(song) {
        return `${song && song.source ? song.source : ''}|${song && song.id ? song.id : ''}|${song && song.ref ? song.ref : ''}|${song && song.title ? song.title : ''}`;
    }

    /** 专辑分组键：同来源 + 专辑名（不区分大小写）；没有专辑名的歌各自成组，免得被凑成一张假专辑。 */
    function albumKeyOf(song) {
        const album = song && typeof song.album === 'string' ? song.album.trim() : '';
        if (!album) return `~single:${songKeyOf(song)}`;
        return `${song && song.source ? song.source : ''}|${album.toLocaleLowerCase()}`;
    }

    /** 按队列顺序分组：返回 [{ key, album, songs }]。 */
    function groupByAlbum(songs) {
        const map = new Map();
        const groups = [];
        for (const song of songs) {
            const key = albumKeyOf(song);
            let group = map.get(key);
            if (!group) {
                const album = song && typeof song.album === 'string' ? song.album.trim() : '';
                group = { key, album, songs: [] };
                map.set(key, group);
                groups.push(group);
            }
            group.songs.push(song);
        }
        return groups;
    }

    function shuffleInPlace(list, random = Math.random) {
        for (let index = list.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(random() * (index + 1));
            const temp = list[index];
            list[index] = list[swap];
            list[swap] = temp;
        }
        return list;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

    /** 等下一次队列变化（智能过渡结束时会补发一次）；超时也放行。 */
    function waitForQueueChange(timeoutMs) {
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                try {
                    dispose();
                } catch (error) {
                    /* 忽略 */
                }
                resolve();
            };
            const dispose = events.on('playback.queueChanged', finish);
            setTimeout(finish, timeoutMs);
        });
    }

    function reasonText(reason) {
        const key = REASON_TEXT[reason];
        return key ? t(key) : String(reason || 'unknown');
    }

    /**
     * 读取队列、用 plan 算出新队列、整表替换；遇到 stale / 限流 / 智能过渡时按契约重试。
     * plan 抛错时提示一次并返回 null。recordUndo=false 时不占用撤销栈（内部恢复用）。
     */
    async function applyQueue(plan, { recordUndo = true } = {}) {
        let lastReason = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
            let snap;
            let songs;
            try {
                snap = readWholeQueue();
                songs = plan(snap);
            } catch (error) {
                ui.toast(String((error && error.message) || error), { type: 'error' });
                return null;
            }
            if (!songs) return null;

            const result = await playback.replaceQueue(songs, { expectedVersion: snap.version });
            if (result.status === 'replaced') {
                // 记下替换前的队列与循环模式，随时可以自己还原，不依赖宿主那条 10 秒提示。
                if (recordUndo) lastUndo = { songs: snap.songs.slice(), loopMode: playback.getLoopMode() };
                return { result, snap };
            }
            lastReason = result.reason;

            if (result.reason === 'rate-limited') {
                await sleep((result.retryAfterMs || 400) + 60);
                continue;
            }
            if (result.reason === 'stale-version' || result.reason === 'stale-ref') continue;
            if (result.reason === 'transition') {
                await waitForQueueChange(25000);
                continue;
            }
            break;
        }
        ui.toast(`队列替换失败：${reasonText(lastReason)}`, { type: 'error' });
        return null;
    }

    // ------------------------------------------------------------ 设置分区

    const section = registries.settingsSections.register({
        id: 'options',
        label: { 'zh-CN': '专辑播放', 'zh-TW': '專輯播放', en: 'Album playback' },
        description: {
            'zh-CN': '专辑随机与专辑循环的行为开关；命令和播放器面板里的「专辑」标签页会立即使用这些设置。',
            en: 'Behaviour of album shuffle and album repeat; the commands and the Albums player-panel tab use these right away.',
        },
        settings: [
            {
                key: 'pinCurrentAlbum',
                type: 'boolean',
                label: { 'zh-CN': '保留当前专辑在最前', 'zh-TW': '保留目前專輯在最前', en: 'Keep the current album first' },
                description: {
                    'zh-CN': '专辑随机时，正在播放的这张专辑排在最前，播放不中断；关掉则连它一起洗。',
                    en: 'Leave the album that is playing at the front so playback is not interrupted; off shuffles it too.',
                },
                defaultValue: true,
            },
            {
                key: 'loopAll',
                type: 'boolean',
                label: { 'zh-CN': '随机后设为列表循环', 'zh-TW': '隨機後設為清單循環', en: 'Turn on list repeat after shuffling' },
                description: {
                    'zh-CN': '专辑随机后把循环模式设为「列表循环」，一轮放完自动从头开始。',
                    en: 'After an album shuffle, set the repeat mode to all so the round starts over.',
                },
                defaultValue: true,
            },
        ],
    });

    function getOptions() {
        const values = section.settings.get();
        return {
            pinCurrentAlbum: values.pinCurrentAlbum !== false,
            loopAll: values.loopAll !== false,
        };
    }

    // -------------------------------------------------------------- 动作

    async function albumShuffle() {
        const options = getOptions();
        const current = playback.getState().song;
        const currentKey = current ? albumKeyOf(current) : null;

        const outcome = await applyQueue((snap) => {
            if (snap.kind !== 'queue') throw new Error(t('needQueue'));
            if (snap.songs.length === 0) throw new Error(t('emptyQueue'));

            const groups = groupByAlbum(snap.songs);
            if (groups.length < 2) throw new Error(t('onlyOneAlbum'));

            // 置顶时把当前专辑摘出来只洗其余专辑；否则所有专辑一起洗。
            const pinned = options.pinCurrentAlbum && currentKey ? groups.find((group) => group.key === currentKey) : null;
            const rest = pinned ? groups.filter((group) => group !== pinned) : groups.slice();
            if (rest.length > 1) shuffleInPlace(rest);

            const ordered = pinned ? [pinned, ...rest] : rest;
            return ordered.flatMap((group) => group.songs);
        });
        if (!outcome) return { message: '未改动队列' };

        if (options.loopAll) playback.setLoopMode('all');

        const albums = groupByAlbum(outcome.snap.songs).length;
        const count = outcome.snap.songs.length;
        // 这条 toast 会盖掉宿主「某模组替换了队列」的可撤销提示条（同一个提示通道），
        // 是有意为之：模组自己记着上一层队列，撤销用「撤销上一次专辑操作」。
        ui.toast(`已按专辑随机：${albums} 张专辑 / ${count} 首`, { type: 'success' });
        return { message: `按专辑随机：${albums} 张专辑，${count} 首` };
    }

    async function albumLoopStart() {
        const current = playback.getState().song;
        if (!current) {
            ui.toast(t('noSong'), { type: 'error' });
            return { message: t('noSong') };
        }
        const key = albumKeyOf(current);
        const previousLoopMode = playback.getLoopMode();

        const outcome = await applyQueue((snap) => {
            if (snap.kind !== 'queue') throw new Error(t('needQueue'));
            const group = groupByAlbum(snap.songs).find((entry) => entry.key === key);
            if (!group) throw new Error(t('albumMissing'));
            return group.songs.slice();
        });
        if (!outcome) return { message: '未进入专辑循环' };

        const group = groupByAlbum(outcome.snap.songs).find((entry) => entry.key === key);
        albumLoop = {
            key,
            album: group ? group.album : '',
            count: group ? group.songs.length : outcome.snap.songs.length,
            previous: { songs: outcome.snap.songs, loopMode: previousLoopMode },
        };
        playback.setLoopMode('all');
        const name = albumLoop.album || t('unknownAlbum');
        // 同上：会盖掉宿主的可撤销提示，撤销走命令面板。
        ui.toast(`循环专辑《${name}》：${albumLoop.count} 首`, { type: 'success' });
        refreshPanel && refreshPanel();
        return { message: `循环专辑《${name}》：${albumLoop.count} 首` };
    }

    /** 当前专辑在分组里的位置；当前歌不在队列里就返回 -1。 */
    function currentGroupPosition(snap, groups) {
        if (snap.currentIndex >= 0 && snap.currentIndex < snap.songs.length) {
            const key = albumKeyOf(snap.songs[snap.currentIndex]);
            const pos = groups.findIndex((group) => group.key === key);
            if (pos >= 0) return pos;
        }
        // currentIndex 对不上（队列变过 / 当前歌不在队列里）时，按歌本身再找一次。
        const current = playback.getState().song;
        if (!current) return -1;
        const key = songKeyOf(current);
        for (let pos = 0; pos < groups.length; pos += 1) {
            if (groups[pos].songs.some((song) => songKeyOf(song) === key)) return pos;
        }
        return -1;
    }

    /**
     * step=+1 下一张、-1 上一张：按队列顺序跳到相邻专辑的第一首，首尾回绕。
     * 只改播放位置，不动队列，所以不占用撤销栈。
     */
    async function albumStep(step) {
        // 专辑循环里队列只剩这一张专辑：先退回原队列，再在原来的顺序里找相邻专辑。
        if (albumLoop) {
            const exited = await exitAlbumLoopKeepingMode();
            if (!exited) return { message: t('restoreFailed') };
        }

        let snap;
        try {
            snap = readWholeQueue();
        } catch (error) {
            const message = String((error && error.message) || error);
            ui.toast(message, { type: 'error' });
            return { message };
        }
        if (snap.kind !== 'queue') {
            ui.toast(t('needQueue'), { type: 'error' });
            return { message: t('needQueue') };
        }
        if (snap.songs.length === 0) {
            ui.toast(t('emptyQueue'), { type: 'error' });
            return { message: t('emptyQueue') };
        }

        const groups = groupByAlbum(snap.songs);
        if (groups.length < 2) {
            ui.toast(t('noOtherAlbum'), { type: 'info' });
            return { message: t('noOtherAlbum') };
        }

        const pos = currentGroupPosition(snap, groups);
        const target = pos < 0
            ? (step > 0 ? 0 : groups.length - 1)
            : (pos + step + groups.length) % groups.length;
        const group = groups[target];
        const index = snap.songs.indexOf(group.songs[0]);
        if (index < 0) {
            ui.toast(t('retry'), { type: 'error' });
            return { message: t('retry') };
        }

        let jumped = false;
        try {
            jumped = await playback.playQueueItem(index);
        } catch (error) {
            jumped = false;
        }
        if (!jumped) {
            ui.toast(t('jumpFailed'), { type: 'error' });
            return { message: t('jumpFailed') };
        }
        refreshPanel && refreshPanel();
        const message = tf('jumped', { name: group.album || t('unknownAlbum') });
        ui.toast(message, { type: 'success' });
        return { message };
    }

    /**
     * 用户自己把循环模式改掉时静默退出专辑循环：队列恢复，但保留用户刚选的循环模式。
     * 不占用撤销栈——这一层留给「撤销上一次专辑操作」表示进循环之前的状态。
     */
    async function exitAlbumLoopKeepingMode() {
        const loop = albumLoop;
        if (!loop) return true;
        albumLoop = null;
        refreshPanel && refreshPanel();

        const outcome = await applyQueue(() => loop.previous.songs, { recordUndo: false });
        if (!outcome) {
            albumLoop = loop;
            refreshPanel && refreshPanel();
            ui.toast(t('restoreFailed'), { type: 'error' });
            return false;
        }
        return true;
    }

    /**
     * 撤销上一次整表替换（专辑随机或进入专辑循环前）。只留一层，比宿主提示条活得久。
     */
    async function albumUndo() {
        const undo = lastUndo;
        if (!undo) {
            ui.toast(t('nothingToUndo'), { type: 'info' });
            return { message: t('nothingToUndo') };
        }
        albumLoop = null;
        const outcome = await applyQueue(() => undo.songs);
        if (!outcome) {
            refreshPanel && refreshPanel();
            ui.toast(t('undoFailed'), { type: 'error' });
            return { message: t('undoFailed') };
        }
        // applyQueue 成功时会记下它替换前的队列，这里撤销完了就把这层丢掉。
        lastUndo = null;
        playback.setLoopMode(undo.loopMode);
        ui.toast(t('undone'), { type: 'success' });
        refreshPanel && refreshPanel();
        return { message: t('undone') };
    }

    // ------------------------------------------------------------ 事件

    events.on('playback.queueChanged', (event) => {
        if (albumLoop && !event.byThisMod) {
            albumLoop = null;
            ui.toast(t('changedOutside'), { type: 'info' });
        }
        refreshPanel && refreshPanel();
    });

    events.on('playback.loopModeChanged', (event) => {
        if (albumLoop && event.mode !== 'all') {
            // 用户自己关掉了列表循环：恢复原队列，但尊重用户选的循环模式
            void exitAlbumLoopKeepingMode();
        }
        refreshPanel && refreshPanel();
    });

    events.on('playback.songChanged', () => {
        refreshPanel && refreshPanel();
    });

    // ------------------------------------------------------------ 命令

    const commandLabel = (zh, tw, en) => ({ 'zh-CN': zh, 'zh-TW': tw, en });

    registries.commands.register({
        id: 'album-shuffle',
        label: commandLabel('专辑随机播放', '專輯隨機播放', 'Shuffle by album'),
        description: {
            'zh-CN': t('shuffleDesc'),
            en: LABEL.en.shuffleDesc,
        },
        keywords: ['专辑', '專輯', '随机', '隨機', 'album', 'shuffle'],
        run: () => albumShuffle(),
    });

    registries.commands.register({
        id: 'album-loop',
        label: commandLabel('循环这张专辑', '循環這張專輯', 'Repeat this album'),
        description: {
            'zh-CN': t('loopDesc'),
            en: LABEL.en.loopDesc,
        },
        keywords: ['专辑', '專輯', '循环', '循環', 'album', 'repeat', 'loop'],
        run: () => albumLoopStart(),
    });

    registries.commands.register({
        id: 'album-prev',
        label: commandLabel(LABEL['zh-CN'].prev, LABEL['zh-TW'].prev, LABEL.en.prev),
        description: {
            'zh-CN': t('prevDesc'),
            en: LABEL.en.prevDesc,
        },
        keywords: ['专辑', '專輯', '上一张', '上一張', 'album', 'previous', 'prev'],
        run: () => albumStep(-1),
    });

    registries.commands.register({
        id: 'album-next',
        label: commandLabel(LABEL['zh-CN'].next, LABEL['zh-TW'].next, LABEL.en.next),
        description: {
            'zh-CN': t('nextDesc'),
            en: LABEL.en.nextDesc,
        },
        keywords: ['专辑', '專輯', '下一张', '下一張', 'album', 'next'],
        run: () => albumStep(1),
    });

    registries.commands.register({
        id: 'album-undo',
        label: commandLabel('撤销上一次专辑操作', '復原上一次專輯操作', 'Undo the last album action'),
        description: {
            'zh-CN': t('undoDesc'),
            en: LABEL.en.undoDesc,
        },
        keywords: ['专辑', '專輯', '撤销', '復原', '恢复', 'album', 'undo', 'restore'],
        run: () => albumUndo(),
    });

    // -------------------------------------------------------- 播放器面板

    registries.playerPanelTabs.register({
        id: 'albums',
        label: commandLabel('专辑', '專輯', 'Albums'),
        icon: 'disc',
        order: 700,
        mount: (container, ctx) => {
            const style = document.createElement('style');
            style.textContent = `
                /* 中文字体放在主题字体前面：主题字体多半是 Latin 优先，缺「复」这类字时会掉到
                   日文字体里，同一个字又窄又扁，和旁边的字对不上。 */
                .ap-root { font-family: "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", var(--folium-font, system-ui), sans-serif; color: var(--folium-primary, inherit); display: flex; flex-direction: column; gap: 12px; padding: 4px 2px; }
                .ap-title { font-size: 15px; font-weight: 600; }
                .ap-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: 13px; }
                .ap-label { opacity: .62; flex: none; }
                .ap-value { text-align: right; word-break: break-word; }
                .ap-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
                .ap-btn { appearance: none; border: 1px solid color-mix(in srgb, var(--folium-primary, #ccc) 24%, transparent); background: color-mix(in srgb, var(--folium-primary, #ccc) 8%, transparent); color: inherit; font: inherit; font-size: 12.5px; padding: 7px 8px; border-radius: 999px; cursor: pointer; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .ap-btn:hover { background: color-mix(in srgb, var(--folium-accent, #888) 22%, transparent); }
                .ap-btn:disabled { opacity: .45; cursor: default; }
                .ap-btn.ap-on { border-color: color-mix(in srgb, var(--folium-accent, #888) 60%, transparent); background: color-mix(in srgb, var(--folium-accent, #888) 26%, transparent); }
                .ap-hint { font-size: 11.5px; line-height: 1.55; opacity: .5; }
            `;
            container.appendChild(style);

            const root = document.createElement('div');
            root.className = 'ap-root';
            const title = document.createElement('div');
            title.className = 'ap-title';
            title.textContent = t('panelTitle');
            root.appendChild(title);

            const albumRow = document.createElement('div');
            albumRow.className = 'ap-row';
            const albumLabel = document.createElement('span');
            albumLabel.className = 'ap-label';
            albumLabel.textContent = t('panelNow');
            const albumValue = document.createElement('span');
            albumValue.className = 'ap-value';
            albumRow.append(albumLabel, albumValue);
            root.appendChild(albumRow);

            const loopRow = document.createElement('div');
            loopRow.className = 'ap-row';
            const loopLabel = document.createElement('span');
            loopLabel.className = 'ap-label';
            loopLabel.textContent = t('panelLoop');
            const loopValue = document.createElement('span');
            loopValue.className = 'ap-value';
            loopRow.append(loopLabel, loopValue);
            root.appendChild(loopRow);

            const actions = document.createElement('div');
            actions.className = 'ap-actions';
            const shuffleButton = document.createElement('button');
            shuffleButton.className = 'ap-btn';
            shuffleButton.type = 'button';
            shuffleButton.textContent = t('panelShuffle');
            shuffleButton.addEventListener('click', () => {
                void albumShuffle();
            });
            const loopButton = document.createElement('button');
            loopButton.className = 'ap-btn';
            loopButton.type = 'button';
            loopButton.textContent = t('panelLoopBtn');
            loopButton.addEventListener('click', () => {
                void albumLoopStart();
            });
            // 在专辑循环里，这个按钮就是「退出循环」；其余时候是普通的撤销。
            const undoButton = document.createElement('button');
            undoButton.className = 'ap-btn';
            undoButton.type = 'button';
            undoButton.textContent = t('panelUndo');
            undoButton.addEventListener('click', () => {
                void albumUndo();
            });
            const prevButton = document.createElement('button');
            prevButton.className = 'ap-btn';
            prevButton.type = 'button';
            prevButton.textContent = t('panelPrev');
            prevButton.addEventListener('click', () => {
                void albumStep(-1);
            });
            const nextButton = document.createElement('button');
            nextButton.className = 'ap-btn';
            nextButton.type = 'button';
            nextButton.textContent = t('panelNext');
            nextButton.addEventListener('click', () => {
                void albumStep(1);
            });
            actions.append(shuffleButton, loopButton, undoButton, prevButton, nextButton);
            root.appendChild(actions);

            const hint = document.createElement('div');
            hint.className = 'ap-hint';
            hint.textContent = t('panelHint');
            root.appendChild(hint);

            container.appendChild(root);

            const render = () => {
                let album = '';
                try {
                    const state = playback.getState();
                    album = state.song && state.song.album ? state.song.album : '';
                } catch (error) {
                    album = '';
                }
                albumValue.textContent = album || t('noSong');
                loopValue.textContent = albumLoop ? `${t('panelOn')} · ${albumLoop.count}` : t('panelOff');
                loopButton.classList.toggle('ap-on', Boolean(albumLoop));
                undoButton.textContent = albumLoop ? t('panelExitLoop') : t('panelUndo');
                undoButton.disabled = !albumLoop && !lastUndo;
            };
            render();
            refreshPanel = render;

            const disposers = [];
            if (typeof ctx.onChange === 'function') disposers.push(ctx.onChange(render));
            if (typeof ctx.onDispose === 'function') {
                ctx.onDispose(() => {
                    for (const dispose of disposers) {
                        try {
                            dispose();
                        } catch (error) {
                            /* 忽略 */
                        }
                    }
                    if (refreshPanel === render) refreshPanel = null;
                });
            }
            return () => {
                if (refreshPanel === render) refreshPanel = null;
            };
        },
    });

    return () => {
        refreshPanel = null;
        albumLoop = null;
    };
}
