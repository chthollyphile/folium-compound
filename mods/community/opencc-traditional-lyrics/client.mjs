// Folium integration: settings, a command, and the synchronous lyric transform hook.
// Carry the host's content fingerprint into the dependency URL. A plain relative import
// stays in the ESM module cache when only client.mjs's ?v=... changes on a mod reload.
const converterUrl = new URL('./converter.mjs', import.meta.url);
converterUrl.search = new URL(import.meta.url).search;
const { getConverter, transformLines } = await import(converterUrl.href);
const selectorUrl = new URL('./selectChinese.mjs', import.meta.url);
selectorUrl.search = new URL(import.meta.url).search;
const { createChineseSelector } = await import(selectorUrl.href);

const label = (tw, cn, en) => ({ 'zh-TW': tw, 'zh-CN': cn, en });

export default function activate(folium) {
    // Export receives the lyrics already transformed by the main window. Its lyric services
    // are unavailable, so it must not try to refresh or apply a second conversion.
    if (folium.env.context !== 'main') return undefined;
    if (typeof folium.lyrics?.refresh !== 'function') {
        throw new Error('OpenCC 繁體字幕需要支援 lyrics.refresh 的 Folia 版本，請更新 Folia。');
    }
    const section = folium.registries.settingsSections.register({
        id: 'conversion',
        label: label('OpenCC 繁體字幕', 'OpenCC 繁体字幕', 'OpenCC Traditional Lyrics'),
        settings: [
            { key: 'enabled', type: 'boolean', defaultValue: true,
                label: label('啟用簡轉繁', '启用简转繁', 'Enable conversion') },
            { key: 'target', type: 'select', defaultValue: 'tw',
                label: label('繁體字形', '繁体字形', 'Traditional character variant'),
                options: [
                    { value: 'tw', label: label('臺灣繁體（預設）', '台湾繁体（默认）', 'Taiwan Traditional (default)') },
                    { value: 't', label: label('OpenCC 標準繁體', 'OpenCC 标准繁体', 'OpenCC Standard Traditional') },
                ] },
            { key: 'convertOriginal', type: 'boolean', defaultValue: true,
                label: label('轉換原文歌詞與和聲', '转换原文歌词与和声', 'Convert original lyrics and harmony') },
            { key: 'convertTranslation', type: 'boolean', defaultValue: true,
                label: label('轉換中文譯文', '转换中文译文', 'Convert Chinese translations') },
            { key: 'protectJapanese', type: 'boolean', defaultValue: true,
                label: label('保留含假名或韓文的原詞與譯文', '保留含假名或韩文的原词与译文', 'Preserve text containing kana or Hangul'),
                description: label('純漢字日文無法自動辨識；可關閉「轉換原文歌詞與和聲」，只轉中文譯文。',
                    '纯汉字日文无法自动识别；可关闭「转换原文歌词与和声」，只转中文译文。',
                    'Kanji-only Japanese cannot be detected. Turn off original lyric conversion to convert Chinese translations only.') },
            { key: 'autoSelectChinese', type: 'boolean', defaultValue: true,
                label: label('自動尋找中文字幕', '自动寻找中文字幕', 'Find Chinese subtitles automatically'),
                description: label('透過 Folia 已設定的來源搜尋同一首歌，依中文覆蓋率、格式與時間軸檢查選擇字幕；不保證譯意正確。',
                    '通过 Folia 已设置的来源搜索同一首歌，依中文覆盖率、格式与时间轴检查选择字幕；不保证译意正确。',
                    'Search configured Folia sources for matching songs and check Chinese coverage, format and timing. This does not verify translation meaning.') },
            { key: 'fallbackOnFailure', type: 'boolean', defaultValue: true,
                label: label('字幕載入失敗時自動改用其他來源', '字幕加载失败时自动改用其他来源', 'Try other sources when lyrics fail'),
                description: label('沒有可用字幕時自動嘗試其他結果；所有來源失敗後停止，不無限重試。',
                    '没有可用字幕时自动尝试其他结果；所有来源失败后停止，不无限重试。',
                    'Try alternatives when no usable lyrics are available. Stop when all attempts fail.') },
            { key: 'searchDepth', type: 'select', defaultValue: 'standard',
                label: label('字幕搜尋範圍', '字幕搜索范围', 'Subtitle search depth'),
                options: [
                    { value: 'standard', label: label('標準：每個來源最多 2 個版本', '标准：每个来源最多 2 个版本', 'Standard: up to 2 versions per source') },
                    { value: 'deep', label: label('深入：每個來源最多 4 個版本', '深入：每个来源最多 4 个版本', 'Deep: up to 4 versions per source') },
                ] },
        ],
    });
    // Warm the dictionary before the first synchronous hook, not on its timing budget.
    getConverter(section.settings.get().target);
    const refresh = () => {
        try {
            folium.lyrics.refresh();
        } catch (error) {
            // Early startup has no App actions yet. The first actual lyric load will run our hook.
            if (error?.message !== 'lyrics-unavailable-in-main-context') throw error;
        }
    };
    const selector = createChineseSelector(folium, () => section.settings.get(), refresh, getConverter());
    const sourceDisposers = [];
    const sourceCommands = [];
    const canSearch = typeof folium.omni?.searchSongs === 'function';
    const offTransform = folium.events.on('lyrics.transform', (event) => {
        event.lines = transformLines(selector.transform(event.song, event.lines), section.settings.get());
    }, { priority: 'low' });
    const offSettings = section.settings.onChange(() => {
        getConverter(section.settings.get().target);
        selector.settingsChanged();
        refresh();
    });
    const command = folium.registries.commands.register({
        id: 'toggle',
        label: label('切換繁體字幕', '切换繁体字幕', 'Toggle Traditional Lyrics'),
        keywords: ['OpenCC', '繁體', '繁体', '字幕', 'traditional'],
        run: () => { section.settings.set({ enabled: section.settings.get().enabled === false }); },
    });
    try {
        if (canSearch) {
            sourceDisposers.push(folium.events.on('lyrics.loaded', (event) => selector.loaded(event.song, event.lines)));
            sourceDisposers.push(folium.events.on('playback.songChanged', (event) => selector.songChanged(event.song)));
            sourceDisposers.push(folium.events.on('account.changed', () => selector.accountChanged()));
            for (const [id, labels, run] of [
                ['retry-chinese', label('重新尋找中文字幕', '重新寻找中文字幕', 'Find Chinese subtitles again'), () => selector.retry()],
                ['restore-lyrics', label('還原這首歌的原字幕', '还原这首歌的原字幕', 'Restore this song’s original lyrics'), () => selector.restore()],
                ['subtitle-status', label('查看字幕來源與中文覆蓋率', '查看字幕来源与中文覆盖率', 'Show subtitle sources and Chinese coverage'), () => selector.showStatus()],
            ]) sourceCommands.push(folium.registries.commands.register({ id, label: labels,
                keywords: ['OpenCC', '字幕', '中文', 'lyrics', 'Chinese'], run }));
        }
        refresh();
        if (canSearch) selector.start();
    } catch (error) {
        selector.dispose();
        sourceDisposers.forEach((off) => off());
        sourceCommands.forEach((entry) => entry.unregister());
        offSettings();
        offTransform();
        command.unregister();
        section.unregister();
        throw error;
    }
    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        selector.dispose();
        sourceDisposers.forEach((off) => off());
        sourceCommands.forEach((entry) => entry.unregister());
        offSettings();
        // Remove our hook BEFORE rebuilding; otherwise disabling leaves converted lyrics visible.
        offTransform();
        command.unregister();
        try {
            refresh();
        } finally {
            section.unregister();
        }
    };
}
