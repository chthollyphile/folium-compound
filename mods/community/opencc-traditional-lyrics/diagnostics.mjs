// Bounded, in-memory diagnostics. Only explicit public metadata is recorded; never raw API bodies or lyrics.
export const MOD_VERSION = '1.1.6';
export const REASONS = Object.freeze({
    timeout: '單次請求逾時', deadline: '已達整輪搜尋時間上限', network: '連線失敗或來源未回應',
    auth: '來源需要登入或登入已過期', restricted: '來源受地區或會員資格限制',
    'rate-limited': '已達請求上限，請稍後手動重新尋找', unavailable: '來源暫時不可用',
    empty: '來源沒有字幕', invalid: '字幕格式、時間軸或內容檢查未通過', instrumental: '來源標記為純音樂',
    'no-match': '沒有找到匹配的歌曲', 'no-provider': '沒有已設定且支援字幕搜尋的來源',
    'no-chinese': '候選沒有有效中文譯文', 'no-improvement': '沒有可安全套用的更完整中文字幕',
    'identity-unconfirmed': '歌曲名稱或版本證據不足', unaligned: '原歌詞與候選時間軸無法安全對齊',
    'timing-repaired': '缺失或無效的逐字資料已退回逐行時間',
    complete: '原字幕已有完整且格式正常的中文', unknown: '來源請求失敗',
});

const ERROR_CODES = new Set(['network', 'not-signed-in', 'session-expired', 'region-restricted', 'vip-required',
    'rate-limited', 'unsupported', 'unavailable', 'stale-ref', 'account-changed', 'aborted', 'not-found', 'invalid-arguments']);
const STATUS = { idle: '尚未搜尋', searching: '搜尋中（報告尚未完成）', selected: '已套用字幕',
    'kept-original': '保留原字幕', cancelled: '已取消', complete: '原字幕中文完整', unavailable: '搜尋介面不可用' };
const STAGES = { search: '搜尋歌曲', lyrics: '讀取字幕', 'candidate-match': '歌曲比對', 'lyric-quality': '字幕品質',
    selection: '套用結果', 'selection-retained': '保留既有選擇', deadline: '整輪逾時', finished: '搜尋結束', 'search-error': '搜尋錯誤' };
const DECISIONS = { 'identity-unconfirmed': REASONS['identity-unconfirmed'], 'metadata-eligible': '可讀取字幕以進一步核對',
    'source-mismatch': '回覆來源不符', 'candidate-limit': '本來源候選數量已達上限', duplicate: '同一候選已檢查，略過重複讀取',
    'empty-original-needs-exact-identity': '原詞空白，歌曲身分證據不足，不能替換整份字幕',
    'outside-playback-duration': '字幕超出播放歌曲的有效時間', 'complete-original': '原字幕中文已完整',
    'original-sequence-mismatch': '完整原詞內容或順序不一致', 'alignment-insufficient': '原詞與時間軸的對應證據不足',
    'exact-identity-fallback': '精確身分核對後套用整份備援', 'full-sequence-translation': '依完整原詞順序補入中文',
    'aligned-translation': '依原詞與時間軸對齊補入中文',
    'cached-choice-retained': '新結果未超過改善門檻，保留既有較完整字幕', ...REASONS };

export function errorReason(error) {
    if (error?.message === 'request-timeout') return 'timeout';
    if (['not-signed-in', 'session-expired'].includes(error?.code)) return 'auth';
    if (['region-restricted', 'vip-required'].includes(error?.code)) return 'restricted';
    if (error?.code === 'rate-limited') return 'rate-limited';
    if (error?.code === 'network') return 'network';
    if (['unsupported', 'unavailable', 'stale-ref', 'account-changed'].includes(error?.code)) return 'unavailable';
    return 'unknown';
}

export function safeText(value, max = 300) {
    if (typeof value !== 'string') return '';
    return value.replace(/(?:https?|file|folia-mod):\/\/[^\s<>"']+/gi, '[網址已省略]')
        .replace(/\b(?:Bearer\s+\S+|(?:cookie|token|password|authorization|credential|session|api[_-]?key)\s*[=:]\s*[^\s,;]+)/gi, '[敏感欄位已省略]')
        .replace(/[A-Za-z]:[\\/][^\s<>"']+|\/(?:home|Users|workspace|root)\/[^\s<>"']+/g, '[本機路徑已省略]')
        .replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max);
}

export function describeSong(song, duration = 0) {
    return { source: safeText(song?.source, 80), title: safeText(song?.title), artist: safeText(song?.artist),
        album: safeText(song?.album), durationSeconds: Number.isFinite(duration) ? duration : 0 };
}

export function safeError(error) {
    const reason = errorReason(error);
    const origin = ['plugin-budget', 'plugin-timeout'].includes(error?.diagnosticOrigin) ? error.diagnosticOrigin : 'folia-source';
    return { code: ERROR_CODES.has(error?.code) ? error.code : reason,
        reason, message: REASONS[reason],
        origin,
        originLabel: origin === 'plugin-budget' ? '插件自身每分鐘請求額度' : origin === 'plugin-timeout' ? '插件單次等待上限' : 'Folia 公開介面（宿主或來源）',
        ...(Number.isFinite(error?.retryAfterMs) ? { retryAfterMs: error.retryAfterMs } : {}),
        detail: (reason === 'rate-limited' && origin === 'folia-source' ? '可能是 Folia 宿主配額或平台限流；介面沒有提供進一步區分。' : '')
            + '只記錄 Folia 公開介面提供的錯誤碼；未提供的 HTTP 狀態、底層回應與堆疊無法還原。' };
}

export function beginReport(song, duration, settings, baseline, host, limits, trigger) {
    return { schemaVersion: 1, modVersion: MOD_VERSION,
        host: { folia: safeText(host?.folia, 80) || null,
            folium: host?.folium ? { major: host.folium.major, minor: host.folium.minor } : null },
        song: describeSong(song, duration), startedAt: new Date().toISOString(), finishedAt: null,
        status: 'searching', trigger, baseline, settings: {
            autoSelectChinese: settings.autoSelectChinese !== false, fallbackOnFailure: settings.fallbackOnFailure !== false,
            searchDepth: settings.searchDepth === 'deep' ? 'deep' : 'standard', enabled: settings.enabled !== false,
            convertTranslation: settings.convertTranslation !== false, target: settings.target === 't' ? 't' : 'tw' },
        limits: { requestMs: limits.requestMs, runMs: limits.runMs, requestsPerMinute: limits.requestsPerMinute,
            maximumProviders: limits.providers, candidatesPerProvider: settings.searchDepth === 'deep' ? 4 : 2 },
        providers: [], decisions: [], events: [], droppedEvents: 0,
        notice: '各原因按搜尋、候選與請求分別計數，可能重疊，不能相加當成歌曲數。報告只含本次模組啟用後可觀測的紀錄，不含帳號、憑證、原始回應或整份歌詞。' };
}

export function record(report, stage, details = {}) {
    if (!report) return null;
    // 6 providers × 3 searches × 8 candidate checks plus requests stay comfortably below this cap.
    if (report.events.length >= 600) { report.droppedEvents++; return null; }
    const event = { sequence: report.events.length + 1, at: new Date().toISOString(), stage, ...details };
    report.events.push(event);
    return event;
}

export function finishReport(report, status, reason) {
    if (!report || report.finishedAt) return;
    report.status = status; report.finishedAt = new Date().toISOString();
    if (reason) report.stopReason = reason;
    record(report, 'finished', { status, ...(reason ? { reason } : {}) });
}

export function formatReport(report) {
    const time = value => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '尚無紀錄';
    const text = [`OpenCC v${MOD_VERSION} 完整診斷報告`, `產生時間：${time(report.generatedAt)}（臺灣時間；JSON 保留 UTC 時戳）`,
        `Folia：${report.host?.folia ?? '介面未提供版本'}；狀態：${STATUS[report.status] ?? report.status}`,
        `歌曲：${report.song?.title || '目前沒有歌曲'} / ${report.song?.artist || '未知歌手'}`,
        `播放來源：${report.song?.source || '未知'}；長度：${report.song?.durationSeconds ?? 0} 秒`,
        `搜尋開始：${time(report.startedAt)}；結束：${report.finishedAt ? time(report.finishedAt) : '尚未完成'}`,
        `目前選擇：${report.selection?.strategy ?? 'original'}；中文覆蓋率：${Math.round((report.selection?.metrics?.coverage ?? 0) * 100)}%`,
        `失敗或無效結果：${report.failedResults ?? 0}（不是搜尋結果總數）`,
        `事件數：${report.events?.length ?? 0}；超出上限未保存：${report.droppedEvents ?? 0}`,
        report.notice, '品質評分只檢查完整度、格式與時間，不代表翻譯語意審核。',
        report.explanation || '', '', '── 逐筆搜尋與錯誤 ──'];
    for (const event of report.events ?? []) {
        const details = [event.provider, event.query ? `查詢「${event.query}」` : '',
            event.song ? `${event.song.title} / ${event.song.artist}` : '', event.status || event.outcome || '',
            Number.isFinite(event.elapsedMs) ? `${event.elapsedMs} ms` : '',
            event.reason ? DECISIONS[event.reason] ?? event.reason : '',
            event.error ? `${event.error.message}；錯誤碼 ${event.error.code}；來自 ${event.error.originLabel ?? event.error.origin}` : '',
            event.metrics ? `中文 ${Math.round(event.metrics.coverage * 100)}%，${event.metrics.translated}/${event.metrics.total} 行` : '',
        ].filter(Boolean).join('；');
        text.push(`#${event.sequence} ${time(event.at)} [${STAGES[event.stage] ?? event.stage}] ${details}`);
    }
    if (report.decisions?.length) text.push('', '── 對齊與套用判定 ──');
    for (const decision of report.decisions ?? []) {
        text.push(`${decision.source}：${DECISIONS[decision.reason] ?? decision.reason}`
            + (decision.alignment ? `；錨點 ${decision.alignment.anchors}，對應覆蓋 ${Math.round(decision.alignment.coverage * 100)}%，時間差 ${decision.alignment.offset} 秒` : ''));
    }
    text.push('', '── 完整結構化紀錄 ──', JSON.stringify(report, null, 2));
    return text.filter(item => item !== undefined).join('\n');
}
