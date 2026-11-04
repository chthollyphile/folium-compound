// All online reads go through Folia's public Omni API; no credentials, raw endpoints or persistent lyrics.
const qualityUrl = new URL('./lyricQuality.mjs', import.meta.url);
qualityUrl.search = new URL(import.meta.url).search;
const { songKey, lyricsKey, analyzeLyrics, chooseLyrics, probeSong, describeMatch, searchQueries, repairWordTimings } = await import(qualityUrl.href);
const diagnosticsUrl = new URL('./diagnostics.mjs', import.meta.url);
diagnosticsUrl.search = new URL(import.meta.url).search;
const { MOD_VERSION, REASONS, errorReason, safeText, safeError, describeSong, beginReport, record, finishReport, formatReport } = await import(diagnosticsUrl.href);

const DEFAULTS = Object.freeze({ requestMs: 7000, runMs: 40000, cacheMs: 600000,
    cacheSize: 8, providers: 6, requestsPerMinute: 60 });

const aborted = () => Object.assign(new Error('aborted'), { code: 'aborted' });
function note(entry, reason, failed = true) {
    if (failed) entry.failures++;
    entry.reasons[reason] = (entry.reasons[reason] ?? 0) + 1;
}

export function createChineseSelector(folium, getSettings, refresh, canonicalize, overrides = {}) {
    const limits = { ...DEFAULTS, ...overrides };
    const available = typeof folium.omni?.listProviders === 'function'
        && typeof folium.omni?.searchSongs === 'function' && typeof folium.omni?.getLyrics === 'function';
    const entries = new Map();
    const requests = [];
    const reportListeners = new Set();
    let focus = null;
    let active = null;
    let stopped = false;
    let settingsKey = selectionSettingsKey();

    function notifyReport() {
        for (const listener of reportListeners) {
            try { listener(); } catch { /* Report viewers cannot interrupt playback or a search. */ }
        }
    }

    function selectionSettingsKey() {
        const settings = getSettings();
        return JSON.stringify([settings.autoSelectChinese !== false, settings.fallbackOnFailure !== false, settings.searchDepth]);
    }

    function durationOf(song) {
        // The audio engine may still report the outgoing track while the next song's lyrics load.
        try {
            const described = (folium.omni?.describeSong?.(song)?.durationMs ?? 0) / 1000;
            if (Number.isFinite(described) && described > 0) return described;
        } catch { /* Use the current playback duration when metadata is unavailable. */ }
        const current = playbackState();
        if (songKey(current?.song) === songKey(song) && Number.isFinite(current?.duration) && current.duration > 0) return current.duration;
        return 0;
    }

    function playbackState() {
        try { return folium.playback?.getState?.(); } catch (error) {
            if (error?.message !== 'playback-unavailable-in-main-context') throw error;
            return null; // App actions are registered after early mod activation.
        }
    }

    function cancel(reason = 'track-changed') {
        if (active) {
            active.entry.status = active.entry.choice?.changed ? 'selected' : 'kept-original';
            finishReport(active.report, 'cancelled', reason);
            active.controller.abort();
            active = null;
            notifyReport();
        }
    }

    function getEntry(song, base) {
        const key = songKey(song);
        if (!key) return null;
        let entry = entries.get(key);
        if (!entry) {
            entry = { key, song, base: base ?? [], baseKey: lyricsKey(base ?? []), choice: null,
                revision: 0, completed: 0, manualOriginal: false, knownComplete: false, forceSearch: false, status: 'idle', failures: 0, reasons: {} };
            entries.set(key, entry);
        }
        entry.song = song; // A fresh ref may replace an expired one for the same portable identity.
        if (base && base !== entry.base) {
            const nextKey = lyricsKey(base);
            if (nextKey !== entry.baseKey) {
                if (active?.entry === entry) cancel('lyrics-reloaded');
                entry.revision++;
                entry.choice = null;
                entry.completed = 0;
                entry.knownComplete = false;
                entry.status = 'idle';
                entry.failures = 0;
                entry.reasons = {};
                entry.report = null;
                entry.baseKey = nextKey;
            } else if (entry.choice?.changed) {
                // Preserve new host word segmentation/ruby data when the text and timing are unchanged.
                // Do not rerun full alignment inside the synchronous transform hook.
                if (entry.choice.strategy === 'merged' && base.length === entry.choice.lines.length) {
                    entry.choice = { ...entry.choice, lines: base.map((line, i) => {
                        const chosen = entry.choice.lines[i];
                        return chosen === entry.base[i] ? line : { ...line, translation: chosen.translation, alternateTexts: chosen.alternateTexts };
                    }) };
                }
            }
            entry.base = base;
        }
        // LRU bounded to eight songs. A pending job owns its entry even if an old cache is evicted.
        entries.delete(key);
        entries.set(key, entry);
        while (entries.size > limits.cacheSize) entries.delete(entries.keys().next().value);
        return entry;
    }

    function wanted(entry) {
        const settings = getSettings();
        return available && !stopped && !entry.manualOriginal && (!entry.knownComplete || entry.forceSearch) && (settings.autoSelectChinese !== false
            || (settings.fallbackOnFailure !== false && !analyzeLyrics(entry.base, durationOf(entry.song), canonicalize).usable));
    }

    function consumeRequest() {
        const now = Date.now();
        while (requests.length && requests[0] <= now - 60000) requests.shift();
        if (requests.length >= limits.requestsPerMinute) throw Object.assign(new Error('rate-limited'), {
            code: 'rate-limited', diagnosticOrigin: 'plugin-budget', retryAfterMs: Math.max(0, requests[0] + 60000 - now) });
        requests.push(now);
    }

    // Aborting stops this plugin waiting even when a provider ignores AbortSignal. Late results never commit.
    async function request(job, context, action) {
        if (!isCurrent(job)) throw aborted();
        const started = Date.now();
        const event = record(job.report, context.stage, { ...context, status: 'pending' });
        try { consumeRequest(); } catch (error) {
            if (event) Object.assign(event, { status: 'blocked', elapsedMs: 0, error: safeError(error) });
            notifyReport(); throw error;
        }
        notifyReport();
        const controller = new AbortController();
        let timeout;
        let onAbort;
        const failure = new Promise((_, reject) => {
            onAbort = () => { controller.abort(); reject(aborted()); };
            job.controller.signal.addEventListener('abort', onAbort, { once: true });
            timeout = setTimeout(() => {
                controller.abort();
                reject(Object.assign(new Error('request-timeout'), { code: 'network', diagnosticOrigin: 'plugin-timeout' }));
            }, limits.requestMs);
        });
        try {
            const value = await Promise.race([Promise.resolve().then(() => {
                if (controller.signal.aborted) throw aborted();
                return action(controller.signal);
            }), failure]);
            if (event) Object.assign(event, { status: 'success', elapsedMs: Date.now() - started,
                ...(context.stage === 'search' ? { resultsReturned: Array.isArray(value?.items) ? value.items.length : 0 } : {}) });
            return value;
        } catch (error) {
            if (event) Object.assign(event, { status: error?.code === 'aborted' ? 'cancelled' : 'failed',
                elapsedMs: Date.now() - started, error: safeError(error) });
            throw error;
        } finally {
            clearTimeout(timeout);
            job.controller.signal.removeEventListener('abort', onAbort);
            notifyReport();
        }
    }

    function isCurrent(job) {
        return !stopped && active === job && !job.controller.signal.aborted && focus === job.entry.key
            && job.revision === job.entry.revision && wanted(job.entry);
    }

    function describeDuration(song) {
        try { return (folium.omni.describeSong?.(song)?.durationMs ?? 0) / 1000; } catch { return 0; }
    }

    function updateChoice(job) {
        if (!isCurrent(job)) return;
        const choice = chooseLyrics(job.entry.base, job.candidates, job.duration, canonicalize);
        job.report.decisions = choice.decisions;
        // An explicit retry must not replace a good cached answer with a partial first response.
        if (job.entry.choice?.changed && choice.metrics.score <= job.entry.choice.metrics.score + 1) {
            job.report.decisions = choice.decisions.map(decision => decision.outcome === 'applied'
                ? { ...decision, outcome: 'not-applied', proposedReason: decision.reason, reason: 'cached-choice-retained' } : decision);
            record(job.report, 'selection-retained', { reason: 'cached-choice-retained', metrics: job.entry.choice.metrics,
                proposedMetrics: choice.metrics });
            notifyReport(); return;
        }
        // Refresh only when the visible answer changes, not after every unsuccessful attempt.
        if (lyricsKey(choice.lines) !== lyricsKey(job.entry.choice?.lines ?? job.entry.base)) {
            job.entry.choice = choice;
            record(job.report, 'selection', { strategy: choice.strategy, metrics: choice.metrics, sources: choice.sources.map(source => safeText(source)) });
            refresh();
        } else if (!job.entry.choice) job.entry.choice = choice;
        notifyReport();
    }

    async function run(entry, announce = false) {
        if (stopped || focus !== entry.key || active?.entry === entry) return;
        if (entry.completed && Date.now() - entry.completed < limits.cacheMs) return;
        const baseline = analyzeLyrics(entry.base, durationOf(entry.song), canonicalize);
        entry.knownComplete = baseline.usable && baseline.coverage === 1 && baseline.quality >= 0.95;
        if (!wanted(entry)) {
            if (entry.knownComplete) {
                entry.completed = Date.now();
                entry.reasons = { complete: 1 };
                entry.failures = 0;
                entry.report = beginReport(entry.song, durationOf(entry.song), getSettings(), baseline, folium.host, limits, 'original-complete');
                finishReport(entry.report, 'complete');
                notifyReport();
            }
            return;
        }
        cancel();
        const job = { entry, revision: entry.revision, controller: new AbortController(), candidates: [], duration: durationOf(entry.song) };
        job.report = beginReport(entry.song, job.duration, getSettings(), baseline, folium.host, limits, announce ? 'manual-retry' : 'automatic');
        entry.report = job.report;
        active = job;
        entry.status = 'searching';
        entry.failures = 0;
        entry.reasons = {};
        notifyReport();
        const deadline = setTimeout(() => {
            note(entry, 'deadline', false); record(job.report, 'deadline', { limitMs: limits.runMs }); job.controller.abort();
        }, limits.runMs);
        try {
            const listed = folium.omni.listProviders();
            const providers = listed.filter((provider) => provider.configured
                && provider.supports?.search && provider.supports?.lyrics).slice(0, limits.providers);
            job.report.providers = listed.slice(0, 50).map(provider => ({ id: safeText(provider.providerId, 80),
                name: safeText(provider.displayName, 100), configured: Boolean(provider.configured),
                search: Boolean(provider.supports?.search), lyrics: Boolean(provider.supports?.lyrics),
                included: providers.includes(provider) }));
            if (!providers.length) note(entry, 'no-provider', false);
            const queries = searchQueries(entry.song, canonicalize);
            const perSource = getSettings().searchDepth === 'deep' ? 4 : 2;
            const seen = new Set();
            let cursor = 0;
            const worker = async () => {
                while (isCurrent(job) && cursor < providers.length) {
                    const provider = providers[cursor++];
                    let attempted = 0;
                    let blocked = false;
                    for (const query of queries) {
                        if (!isCurrent(job) || attempted >= perSource || blocked) break;
                        try {
                            const context = { provider: safeText(provider.providerId, 80), query: safeText(query, 200) };
                            const page = await request(job, { stage: 'search', ...context }, (signal) => folium.omni.searchSongs(query, {
                                providerId: provider.providerId, limit: 8, signal,
                            }));
                            if (!isCurrent(job)) return;
                            const checked = (Array.isArray(page?.items) ? page.items : []).slice(0, 8).map(song => {
                                const duration = describeDuration(song);
                                const evidence = song.source === provider.providerId ? probeSong(entry.song, song, job.duration, duration, canonicalize, baseline.usable) : null;
                                const detail = describeMatch(describeSong(entry.song), describeSong(song), job.duration, duration, canonicalize);
                                // Normalized values can still contain source-supplied text: sanitize every string.
                                const comparison = { ...detail,
                                    targetTitleForms: detail.targetTitleForms.map(form => safeText(form)),
                                    candidateTitleForms: detail.candidateTitleForms.map(form => safeText(form)),
                                    targetArtistKey: safeText(detail.targetArtistKey), candidateArtistKey: safeText(detail.candidateArtistKey) };
                                const event = record(job.report, 'candidate-match', { ...context, song: describeSong(song, duration),
                                    comparison, evidence, outcome: evidence ? 'eligible' : 'rejected',
                                    reason: song.source !== provider.providerId ? 'source-mismatch' : evidence ? 'metadata-eligible' : 'identity-unconfirmed' });
                                return { song, evidence, event };
                            });
                            const matches = checked.filter(item => item.evidence)
                                .sort((a, b) => b.evidence.match - a.evidence.match).slice(0, perSource);
                            for (const item of checked) if (item.evidence && !matches.includes(item) && item.event) {
                                item.event.outcome = 'skipped'; item.event.reason = 'candidate-limit';
                            }
                            if (!matches.length) note(entry, page?.items?.length ? 'identity-unconfirmed' : 'no-match', false);
                            for (const item of matches) {
                                if (!isCurrent(job)) return;
                                const identity = songKey(item.song);
                                if (seen.has(identity)) { if (item.event) { item.event.outcome = 'skipped'; item.event.reason = 'duplicate'; } continue; }
                                seen.add(identity);
                                if (attempted >= perSource) {
                                    if (item.event) { item.event.outcome = 'skipped'; item.event.reason = 'candidate-limit'; }
                                    continue;
                                }
                                attempted++;
                                if (item.event) item.event.outcome = 'lyrics-requested';
                                try {
                                    const result = await request(job, { stage: 'lyrics', ...context, song: describeSong(item.song, describeDuration(item.song)) },
                                        (signal) => folium.omni.getLyrics(item.song, { signal }));
                                    if (!isCurrent(job)) return;
                                    const candidateDuration = describeDuration(item.song);
                                    const candidateLines = repairWordTimings(result?.lines, candidateDuration || job.duration);
                                    const metrics = analyzeLyrics(candidateLines, candidateDuration || job.duration, canonicalize);
                                    const inspected = record(job.report, 'lyric-quality', { ...context, song: describeSong(item.song, candidateDuration),
                                        lineCount: result?.lines?.length ?? 0, metrics, timingRepaired: candidateLines !== result?.lines, outcome: 'eligible' });
                                    const reject = (reason, failed = true) => {
                                        note(entry, reason, failed);
                                        if (inspected) { inspected.outcome = 'rejected'; inspected.reason = reason; }
                                    };
                                    if (result?.isPureMusic) { reject('instrumental'); continue; }
                                    if (!result?.lines?.length) { reject('empty'); continue; }
                                    if (!metrics.usable || metrics.quality < 0.6) { reject('invalid'); continue; }
                                    if (!metrics.coverage) {
                                        note(entry, 'no-chinese', false);
                                        if (baseline.usable) { if (inspected) { inspected.outcome = 'rejected'; inspected.reason = 'no-chinese'; } continue; }
                                    }
                                    if (candidateLines !== result.lines) note(entry, 'timing-repaired', false);
                                    job.candidates.push({ lines: candidateLines, ...item.evidence, duration: candidateDuration || job.duration,
                                        source: safeText(`${provider.displayName || provider.providerId} · ${item.song.title}`, 400) });
                                    updateChoice(job);
                                } catch (error) {
                                    if (!isCurrent(job)) return;
                                    note(entry, errorReason(error));
                                    if (['rate-limited', 'not-signed-in', 'session-expired', 'account-changed', 'region-restricted'].includes(error?.code)) { blocked = true; break; }
                                }
                            }
                        } catch (error) {
                            if (!isCurrent(job)) return;
                            note(entry, errorReason(error));
                            if (['rate-limited', 'not-signed-in', 'session-expired', 'account-changed', 'region-restricted'].includes(error?.code)) blocked = true;
                        }
                        if (entry.choice?.metrics.coverage === 1 && entry.choice.metrics.quality >= 0.95) break;
                    }
                }
            };
            await Promise.all([worker(), worker()]);
        } catch (error) {
            if (isCurrent(job)) {
                note(entry, errorReason(error));
                record(job.report, 'search-error', { error: safeError(error) });
                folium.log?.warn?.('[OpenCC] 字幕搜尋未完成', error);
            }
        } finally {
            clearTimeout(deadline);
            if (active === job) {
                // A deadline keeps any successfully selected subtitles, and never retries in a loop.
                entry.completed = Date.now();
                entry.status = entry.choice?.changed ? 'selected' : 'kept-original';
                if (!entry.choice?.changed && job.candidates.length) note(entry,
                    job.report.decisions.some(item => ['alignment-insufficient', 'original-sequence-mismatch'].includes(item.reason)) ? 'unaligned' : 'no-improvement', false);
                finishReport(job.report, entry.status, entry.reasons.deadline ? 'deadline' : undefined);
                active = null;
                notifyReport();
                if (!stopped && focus === entry.key) folium.log?.info?.('[OpenCC] 字幕搜尋結束', {
                    version: '1.1.6', song: entry.song.title, artist: entry.song.artist, duration: job.duration,
                    originalLines: entry.base.length, selectedLines: entry.choice?.lines.length ?? entry.base.length,
                    candidatesRead: job.candidates.length, status: entry.status, sources: entry.choice?.sources ?? [],
                    coverage: entry.choice?.metrics.coverage ?? baseline.coverage, failedResults: entry.failures, reasons: entry.reasons,
                });
                if (announce && !stopped && focus === entry.key) showStatus();
            }
        }
    }

    function queue(entry, announce = false) {
        queueMicrotask(() => {
            if (!stopped && focus === entry.key && entries.get(entry.key) === entry) {
                void run(entry, announce).catch((error) => folium.log?.warn?.('[OpenCC] 無法啟動字幕搜尋', error));
            }
        });
    }

    function loaded(song, lines) {
        if (stopped) return;
        const key = songKey(song);
        if (focus !== key) cancel();
        focus = key;
        // lyrics.loaded carries transformed data; prefer the raw base captured by transform().
        const entry = entries.get(key) ?? getEntry(song, lines);
        if (!entry) return;
        entry.song = song;
        queue(entry);
    }

    function showStatus() {
        const entry = entries.get(focus);
        let message;
        if (!available) message = '此 Folia 版本未提供字幕搜尋介面，請更新 Folia；簡轉繁仍可使用。';
        else if (!entry) message = '目前沒有可搜尋的歌曲。';
        else if (entry.manualOriginal) message = '這首歌已還原原字幕，自動選字幕暫停；可用「重新尋找中文字幕」恢復。';
        else if (getSettings().autoSelectChinese === false && getSettings().fallbackOnFailure === false) message = '自動尋找與載入失敗備援目前已關閉；簡轉繁仍依設定生效。';
        else if (entry.status === 'searching') message = '正在搜尋中文字幕；失敗的來源會自動跳過。';
        else {
            const metrics = entry.choice?.metrics ?? analyzeLyrics(entry.base, durationOf(entry.song), canonicalize);
            message = `${entry.choice?.changed ? `字幕來源：${[...new Set(entry.choice.sources)].join('、')}` : '保留原字幕'}；中文覆蓋率 ${Math.round(metrics.coverage * 100)}%`;
            if (entry.choice?.strategy === 'replaced') message += '；已改用經歌詞內容與時間軸核對的中文字幕版本';
            if (entry.choice?.sequenceMatched) message += '；中文依完整原詞順序補入，保留播放版本的動畫時間';
            if (Math.abs(entry.choice?.offset ?? 0) >= 0.1) message += `；已對齊時間差 ${entry.choice.offset > 0 ? '+' : ''}${entry.choice.offset.toFixed(1)} 秒`;
            if (entry.failures) message += `；已跳過 ${entry.failures} 個失敗或無效結果`;
            if (entry.repairedTiming) message += '；原詞時間資料缺失或無效，已依有效詞、下一句或歌曲長度恢復基本顯示';
            const reasons = Object.entries(entry.reasons).map(([reason, count]) => `${REASONS[reason] ?? REASONS.unknown}${count > 1 ? `（${count} 次）` : ''}`);
            if (reasons.length) message += `；搜尋情況：${reasons.join('、')}`;
            message += '。品質評分只檢查完整度與格式，不代表語意審核。';
            if (metrics.coverage > 0) message += ' 若仍未顯示中文，請在歌詞樣式的「字幕」選擇「翻譯」或「兩者」。';
        }
        if (entry) folium.log?.info?.('[OpenCC] 字幕診斷 v1.1.6', {
            song: entry.song.title, artist: entry.song.artist, duration: durationOf(entry.song), status: entry.status,
            original: analyzeLyrics(entry.base, durationOf(entry.song), canonicalize),
            selected: entry.choice?.metrics ?? null, strategy: entry.choice?.strategy ?? 'original', sequenceMatched: entry.choice?.sequenceMatched ?? false,
            offset: entry.choice?.offset ?? 0, sources: entry.choice?.sources ?? [], reasons: entry.reasons,
        });
        message = `OpenCC v${MOD_VERSION}：${message}`;
        folium.ui?.toast?.(message, { type: 'info', durationMs: 12000 });
        return message;
    }

    function getReport() {
        const entry = entries.get(focus);
        const duration = entry ? durationOf(entry.song) : 0;
        const metrics = entry ? entry.choice?.metrics ?? analyzeLyrics(entry.base, duration, canonicalize) : null;
        const explanation = !available ? '此 Folia 未提供字幕搜尋介面。' : !entry ? '目前沒有歌曲，尚無診斷紀錄。'
            : entry.manualOriginal ? '此歌已手動還原原字幕；下方保留最後一輪的紀錄。'
            : !wanted(entry) && !entry.knownComplete ? '依目前設定未啟動搜尋；下方若有紀錄，屬於最後一輪。'
            : !entry.report ? '尚未開始搜尋；報告功能不會自行發出網路請求。' : '';
        const report = { ...(entry?.report ?? { schemaVersion: 1, modVersion: MOD_VERSION,
            host: { folia: safeText(folium.host?.folia, 80) || null }, song: describeSong(entry?.song, duration),
            status: available ? 'idle' : 'unavailable', startedAt: null, finishedAt: null, events: [], decisions: [],
            notice: '只包含本次啟用後可觀測的紀錄；不含帳號、憑證、原始回應或整份歌詞。' }),
            generatedAt: new Date().toISOString(), explanation,
            currentState: entry?.manualOriginal ? 'manual-original' : entry?.status ?? 'no-song',
            failedResults: entry?.failures ?? 0,
            reasons: Object.entries(entry?.reasons ?? {}).map(([code, count]) => ({ code, label: REASONS[code] ?? REASONS.unknown, count })),
            selection: { strategy: entry?.choice?.strategy ?? 'original', metrics,
                sources: entry?.choice?.sources.map(source => safeText(source, 400)) ?? [],
                sequenceMatched: entry?.choice?.sequenceMatched ?? false, offsetSeconds: entry?.choice?.offset ?? 0,
                repairedOriginalTiming: entry?.repairedTiming ?? false },
        };
        // Return a detached snapshot: exporting or a caller's edits cannot mutate a live search.
        return JSON.parse(JSON.stringify(report));
    }

    return {
        start() {
            const current = playbackState();
            if (current?.song) loaded(current.song, folium.lyrics.getLines());
        },
        transform(song, lines) {
            const display = repairWordTimings(lines, durationOf(song));
            const entry = getEntry(song, display);
            if (entry && display !== lines && !entry.repairedTiming) {
                folium.log?.info?.('[OpenCC] 以原有逐行時間修復缺失或無效的逐字顯示資料', { song: song.title });
            }
            if (entry) entry.repairedTiming = display !== lines;
            // A failed load can leave the store null -> null, so no lyrics.loaded notification follows.
            // The empty transform is still guaranteed by the host. Start after the synchronous hook returns.
            if (entry && focus === entry.key) queue(entry);
            return entry && wanted(entry) && entry.choice?.changed ? entry.choice.lines : display;
        },
        loaded,
        songChanged(song) {
            const key = songKey(song);
            if (focus !== key) cancel();
            focus = key;
            const entry = entries.get(key);
            if (entry) queue(entry);
            notifyReport();
        },
        settingsChanged() {
            const next = selectionSettingsKey();
            if (next === settingsKey) return;
            settingsKey = next;
            cancel('settings-changed');
            for (const entry of entries.values()) {
                entry.completed = 0; entry.choice = null; entry.revision++;
                entry.status = 'idle'; entry.failures = 0; entry.reasons = {};
                entry.report = null;
            }
            const entry = entries.get(focus);
            if (entry) queue(entry);
            notifyReport();
        },
        retry() {
            const entry = entries.get(focus);
            if (!entry) return showStatus();
            cancel('manual-retry');
            entry.manualOriginal = false;
            entry.forceSearch = true;
            entry.completed = 0;
            entry.revision++;
            if (!wanted(entry)) {
                folium.ui?.toast?.('請先啟用「自動尋找中文字幕」；載入失敗時也可啟用自動改用其他字幕。', { type: 'info' });
                return;
            }
            queue(entry, true);
        },
        restore() {
            const entry = entries.get(focus);
            if (!entry) return;
            cancel('manual-original');
            entry.manualOriginal = true;
            entry.choice = null;
            entry.revision++;
            refresh();
            showStatus();
            notifyReport();
        },
        accountChanged() {
            cancel('account-changed');
            entries.clear();
            notifyReport();
            refresh();
            const current = playbackState();
            if (current?.song) loaded(current.song, folium.lyrics.getLines());
        },
        showStatus,
        getReport,
        reportText() { return formatReport(getReport()); },
        subscribeReport(listener) { reportListeners.add(listener); return () => reportListeners.delete(listener); },
        dispose() { stopped = true; cancel('disabled'); entries.clear(); notifyReport(); reportListeners.clear(); },
    };
}
