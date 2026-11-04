// Host-owned settings panel: persistent selectable text, user-initiated clipboard write and local download.
const words = (locale, tw, cn, en) => locale === 'zh-TW' ? tw : locale?.startsWith('zh') ? cn : en;

export async function copyReport(text, container) {
    const doc = container?.ownerDocument ?? globalThis.document;
    if (!doc) return false;
    const nav = doc.defaultView?.navigator ?? globalThis.navigator;
    try {
        if (typeof nav?.clipboard?.writeText === 'function') { await nav.clipboard.writeText(text); return true; }
    } catch { /* A denied Clipboard API still permits manual selection or the legacy copy command. */ }
    const previous = doc.activeElement;
    const input = doc.createElement('textarea');
    input.value = text; input.readOnly = true;
    input.style.cssText = 'position:fixed;left:-10000px;top:0;';
    (container ?? doc.body).append(input);
    input.select();
    let copied = false;
    try { copied = doc.execCommand?.('copy') === true; } catch { /* Leave the full report available for manual copy. */ }
    input.remove();
    previous?.focus?.({ preventScroll: true });
    return copied;
}

export function downloadReport(report, doc = globalThis.document) {
    if (!doc?.body) return false;
    const view = doc.defaultView ?? globalThis;
    if (typeof view.URL?.createObjectURL !== 'function' || typeof view.Blob !== 'function') return false;
    const url = view.URL.createObjectURL(new view.Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = `opencc-diagnostic-${report.modVersion}-${report.generatedAt.replace(/[:.]/g, '-')}.json`;
    link.style.display = 'none'; doc.body.append(link);
    try { link.click(); } finally {
        link.remove();
        // The browser consumes the URL asynchronously; immediate revocation can produce an empty download.
        view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
    }
    return true;
}

export function mountDiagnostics(selector) {
    return (container, ctx) => {
        const doc = container.ownerDocument;
        const w = (tw, cn, en) => words(ctx?.locale, tw, cn, en);
        const root = doc.createElement('div'); root.dataset.openccDiagnostics = '';
        const style = doc.createElement('style');
        style.textContent = `
            [data-opencc-diagnostics] { font-family: var(--folium-font, system-ui); color: var(--folium-primary, inherit); font-size:14px; line-height:1.55; }
            [data-opencc-diagnostics] p { margin:0 0 12px; opacity:.8; }
            [data-opencc-diagnostics] .actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
            [data-opencc-diagnostics] button { font:inherit; color:inherit; border:1px solid #80808066; border-radius:8px; padding:7px 12px; background:#80808022; cursor:pointer; }
            [data-opencc-diagnostics] button:focus-visible, [data-opencc-diagnostics] textarea:focus-visible { outline:2px solid var(--folium-accent, #9693ee); outline-offset:2px; }
            [data-opencc-diagnostics] textarea { box-sizing:border-box; display:block; width:100%; height:360px; min-height:160px; max-height:70vh; resize:vertical; overflow:auto; user-select:text; font:12px/1.6 ui-monospace,monospace; color:inherit; background:#00000018; border:1px solid #80808066; border-radius:8px; padding:12px; white-space:pre-wrap; overflow-wrap:anywhere; }
            [data-opencc-diagnostics] textarea[hidden] { display:none; }
            [data-opencc-diagnostics] .status { min-height:24px; margin-top:8px; }
        `;
        const intro = doc.createElement('p');
        intro.textContent = w('這首歌的完整搜尋與錯誤紀錄。搜尋中會持續更新；只記錄目前啟用期間，不包含帳號、憑證或整份歌詞。',
            '这首歌的完整搜索与错误记录。搜索中会持续更新；只记录当前启用期间，不包含账号、凭据或整份歌词。',
            'Full search and error history for this song, updated during a search. This session only; no accounts, credentials or lyric documents.');
        const actions = doc.createElement('div'); actions.className = 'actions';
        const output = doc.createElement('textarea'); output.readOnly = true; output.spellcheck = false;
        output.setAttribute('aria-label', w('完整診斷報告', '完整诊断报告', 'Full diagnostic report'));
        const status = doc.createElement('div'); status.className = 'status'; status.setAttribute('role', 'status');
        let ended = false;
        let visibility;
        const render = () => {
            if (ended) return;
            const at = output.scrollTop; const from = output.selectionStart; const to = output.selectionEnd;
            output.value = selector.reportText();
            const visible = ctx?.settings?.get?.().reportVisible !== false;
            output.hidden = !visible;
            if (visibility) visibility.textContent = visible ? w('收合報告', '收起报告', 'Collapse report') : w('顯示報告', '显示报告', 'Show report');
            output.scrollTop = at;
            if (doc.activeElement === output || container.getRootNode()?.activeElement === output) output.setSelectionRange(from, to);
        };
        const button = (title, fn) => {
            const node = doc.createElement('button'); node.type = 'button'; node.textContent = title;
            node.onclick = () => {
                Promise.resolve().then(fn).catch(() => { if (!ended) status.textContent = w('操作未完成，可選取下方報告手動複製。', '操作未完成，可选取下方报告手动复制。', 'Action failed. Select the report below to copy it manually.'); });
            };
            actions.append(node);
            return node;
        };
        visibility = button(w('收合報告', '收起报告', 'Collapse report'), () => {
            ctx?.settings?.set?.({ reportVisible: ctx.settings.get().reportVisible === false }); render();
        });
        button(w('重新整理報告', '刷新报告', 'Refresh report'), render);
        button(w('複製完整報告', '复制完整报告', 'Copy full report'), async () => {
            const copied = await copyReport(selector.reportText(), container);
            if (!ended) status.textContent = copied ? w('已複製完整報告。', '已复制完整报告。', 'Full report copied.')
                : w('無法自動複製；請點選報告後按 Ctrl+A、Ctrl+C。', '无法自动复制；请点击报告后按 Ctrl+A、Ctrl+C。', 'Copy unavailable. Select the report and press Ctrl+A, Ctrl+C.');
            if (!copied && !ended) {
                ctx?.settings?.set?.({ reportVisible: true }); render(); output.focus(); output.select();
            }
        });
        button(w('下載報告（JSON）', '下载报告（JSON）', 'Download report (JSON)'), () => {
            const requested = downloadReport(selector.getReport(), doc);
            if (!ended) status.textContent = requested ? w('已送出報告下載。', '已请求下载报告。', 'Report download requested.')
                : w('下載不可用；請複製完整報告。', '下载不可用；请复制完整报告。', 'Download unavailable. Copy the full report instead.');
        });
        root.append(intro, actions, output, status); container.append(style, root); render();
        const off = selector.subscribeReport(render);
        const offSettings = ctx?.settings?.onChange?.(render);
        return () => { ended = true; off(); offSettings?.(); root.remove(); style.remove(); };
    };
}
