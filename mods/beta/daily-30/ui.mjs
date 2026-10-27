// mods/daily-30/ui.mjs
// The home tab: a date list on the left, the selected day's songs on the right, and a search over every
// recorded day. It reads and writes the archive only through the main entry's rpc, so it works with the
// same data whether or not another window is open.

import { CSS } from './uiCss.mjs';
import { fill, label, labels } from './labels.mjs';
import { el, button } from './uiParts.mjs';
import { playDay, playSong } from './uiPlayback.mjs';
import { renderPage } from './uiRender.mjs';

const messageOf = (error) => (error instanceof Error ? error.message : String(error));

const mountPage = (folium, capture, settings, container, ctx) => {
    const locale = ctx.locale || 'zh-CN';
    const t = labels(locale);
    const state = { date: '', days: [], day: null, query: '', results: [], busy: '', error: '' };
    let timer = 0;
    let searchSeq = 0;
    let refreshing = false;

    const style = document.createElement('style');
    style.textContent = CSS;
    const root = el('section', 'd30');
    const head = el('header', 'd30-head');
    const heading = el('div');
    heading.append(el('h1', '', t.title), el('p', '', t.subtitle));
    const actions = el('div', 'd30-actions');
    const record = button('d30-btn primary', t.captureNow, () => void recordNow());
    const refresh = button('d30-btn', t.refresh, () => void loadDays());
    const exportButton = button('d30-btn', t.export, () => void exportAll());
    actions.append(record, refresh, exportButton);
    head.append(heading, actions);
    const status = el('div', 'd30-status');
    const grid = el('div', 'd30-grid');
    const side = el('aside', 'd30-side');
    const search = document.createElement('input');
    search.className = 'd30-search';
    search.placeholder = t.searchPlaceholder;
    search.type = 'search';
    search.spellcheck = false;
    const dates = el('div', 'd30-dates');
    side.append(el('h2', 'd30-sidetitle', t.dateList), search, dates);
    const main = el('main', 'd30-main');
    const dayHead = el('div', 'd30-dayhead');
    const dayTitle = el('h2');
    const dayMeta = el('span', 'd30-badge');
    const playAll = button('d30-btn primary', t.playAll, () => void playDayAction());
    dayHead.append(dayTitle, dayMeta, el('span', 'grow'), playAll);
    const songs = el('div', 'd30-songs');
    main.append(dayHead, songs);
    grid.append(side, main);
    const foot = el('footer', 'd30-foot');
    const footStatus = el('span');
    const footAuto = el('span');
    foot.append(footStatus, footAuto);
    root.append(head, status, grid, foot);
    container.append(style, root);

    const nodes = { record, refresh, exportButton, playAll, status, dates, dayTitle, dayMeta, songs, footStatus, footAuto };
    const render = () => renderPage({
        state,
        t,
        locale,
        nodes,
        handlers: { selectDate, playOne },
        report: capture.getStatus(),
        autoCapture: settings.get().autoCapture,
    });

    const loadDay = async () => {
        if (!state.date) {
            state.day = null;
            return;
        }
        try {
            state.day = await folium.rpc.call('archive.get', 'netease', state.date);
        } catch (error) {
            state.day = null;
            folium.log.warn('[daily-30] could not read a day', error);
        }
    };

    const loadDays = async ({ quiet = false } = {}) => {
        if (refreshing) return;
        refreshing = true;
        if (!quiet) {
            state.busy = 'load';
            render();
        }
        state.error = '';
        try {
            const days = await folium.rpc.call('archive.list');
            state.days = (Array.isArray(days) ? days : []).filter((day) => day?.platform === 'netease');
            if (!state.date || !state.days.some((day) => day.date === state.date)) {
                state.date = state.days[0]?.date || '';
            }
            await loadDay();
        } catch (error) {
            state.error = messageOf(error);
            folium.log.warn('[daily-30] could not read the archive', error);
        } finally {
            refreshing = false;
            if (!quiet) state.busy = '';
            render();
        }
    };

    const selectDate = async (date) => {
        state.date = date;
        state.query = '';
        state.results = [];
        search.value = '';
        await loadDay();
        render();
    };

    const recordNow = async () => {
        if (state.busy || capture.getStatus().running) return;
        state.busy = 'capture';
        render();
        try {
            await capture.captureNow();
            await loadDays({ quiet: true });
        } finally {
            state.busy = '';
            render();
        }
    };

    const exportAll = async () => {
        if (state.busy) return;
        state.busy = 'export';
        render();
        try {
            const result = await folium.rpc.call('archive.export');
            folium.ui.toast(fill(t.exported, { path: result.path }), { type: 'success' });
        } catch (error) {
            const message = messageOf(error);
            folium.ui.toast(message.includes('nothing-to-export') ? t.exportEmpty : message, { type: 'error' });
        } finally {
            state.busy = '';
            render();
        }
    };

    const playDayAction = async () => {
        if (!state.day || state.busy) return;
        state.busy = 'play';
        render();
        try {
            const result = await playDay(folium, t, state.day);
            folium.ui.toast(t.playing, { type: 'success' });
            if (result.missing > 0) folium.ui.toast(fill(t.partialPlay, { n: result.missing }), { type: 'info' });
        } catch (error) {
            folium.ui.toast(messageOf(error), { type: 'error' });
            folium.log.warn('[daily-30] play day failed', error);
        } finally {
            state.busy = '';
            render();
        }
    };

    const playOne = async (song) => {
        if (state.busy) return;
        state.busy = 'play';
        render();
        try {
            await playSong(folium, t, song);
        } catch (error) {
            folium.ui.toast(messageOf(error), { type: 'error' });
            folium.log.warn('[daily-30] play song failed', error);
        } finally {
            state.busy = '';
            render();
        }
    };

    const runSearch = async (value) => {
        const query = value.trim();
        state.query = query;
        const seq = ++searchSeq;
        if (!query) {
            state.results = [];
            render();
            return;
        }
        state.busy = 'search';
        render();
        try {
            const results = await folium.rpc.call('archive.search', query);
            if (seq === searchSeq) state.results = Array.isArray(results) ? results : [];
        } catch (error) {
            if (seq === searchSeq) {
                state.results = [];
                folium.log.warn('[daily-30] search failed', error);
            }
        } finally {
            if (seq === searchSeq) {
                state.busy = '';
                render();
            }
        }
    };

    search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { void runSearch(search.value); }, 250);
    });
    search.addEventListener('keydown', (event) => event.stopPropagation());

    const offCapture = capture.subscribe(() => {
        if (capture.getStatus().running) {
            render();
            return;
        }
        void loadDays({ quiet: true });
    });
    const offSettings = settings.onChange?.(() => render());
    void loadDays();
    return () => {
        offCapture();
        offSettings?.();
        clearTimeout(timer);
    };
};

export const registerHomeTab = (folium, capture, settings) => folium.registries.homeTabs.register({
    id: 'daily-30',
    label: label('每日推荐', 'Daily Recommendation'),
    order: 210,
    mount: (container, ctx) => mountPage(folium, capture, settings, container, ctx),
});
