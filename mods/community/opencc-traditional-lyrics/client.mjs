// Folium integration: settings, a command, and the synchronous lyric transform hook.
// Carry the host's content fingerprint into the dependency URL. A plain relative import
// stays in the ESM module cache when only client.mjs's ?v=... changes on a mod reload.
const converterUrl = new URL('./converter.mjs', import.meta.url);
converterUrl.search = new URL(import.meta.url).search;
const { getConverter, transformLines } = await import(converterUrl.href);

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
    const offTransform = folium.events.on('lyrics.transform', (event) => {
        event.lines = transformLines(event.lines, section.settings.get());
    }, { priority: 'low' });
    const offSettings = section.settings.onChange(() => {
        getConverter(section.settings.get().target);
        refresh();
    });
    const command = folium.registries.commands.register({
        id: 'toggle',
        label: label('切換繁體字幕', '切换繁体字幕', 'Toggle Traditional Lyrics'),
        keywords: ['OpenCC', '繁體', '繁体', '字幕', 'traditional'],
        run: () => { section.settings.set({ enabled: section.settings.get().enabled === false }); },
    });
    try {
        refresh();
    } catch (error) {
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
