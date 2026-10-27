// mods/daily-30/uiRender.mjs
// Draws one state of the home tab into the elements ui.mjs created. Keeping the drawing here means the
// mount, data loading and playback wiring in ui.mjs stay readable, and a refresh only replaces content.

import { dayLabel, dateRow, el, emptyBlock, headRow, songRow } from './uiParts.mjs';
import { dayCount, errorLabel, songCount } from './labels.mjs';
import { formatClock } from './dates.mjs';

export const renderPage = ({ state, t, locale, nodes, handlers, report, autoCapture }) => {
    const {
        record, refresh, exportButton, playAll, status, dates,
        dayTitle, dayMeta, songs, footStatus, footAuto,
    } = nodes;

    record.disabled = state.busy === 'capture' || report.running;
    record.textContent = state.busy === 'capture' || report.running ? t.capturing : t.captureNow;
    refresh.disabled = state.busy === 'load';
    exportButton.disabled = state.busy === 'export';
    exportButton.textContent = state.busy === 'export' ? t.exporting : t.export;
    playAll.disabled = state.busy === 'play' || !state.day;

    status.replaceChildren();
    const result = report.results.netease;
    if (result) {
        const item = el('span');
        item.append(el('span', 'd30-dot'));
        if (result.ok) item.append(`${t.netease}: ${songCount(t, result.count)}`);
        else {
            item.append(`${t.netease}: ${errorLabel(t, result.code)}`);
            item.classList.add('d30-error');
        }
        status.append(item);
    }
    if (state.days.length) status.append(el('span', '', dayCount(t, state.days.length)));
    if (state.error) status.append(el('span', 'd30-error', `${t.errorGeneric}: ${state.error}`));
    if (!status.childNodes.length) status.append(el('span', '', t.never));

    footStatus.textContent = report.lastRun ? `${t.lastChecked} ${formatClock(report.lastRun, locale)}` : t.never;
    footAuto.textContent = autoCapture === false ? t.autoOff : '';

    dates.replaceChildren();
    if (!state.days.length) dates.append(el('p', 'd30-section-note', t.emptyBody));
    for (const day of state.days) {
        dates.append(dateRow(day, day.date === state.date, t, locale, (date) => {
            void handlers.selectDate(date);
        }));
    }

    dayMeta.classList.toggle('d30-hidden', Boolean(state.query) || !state.day);
    playAll.classList.toggle('d30-hidden', Boolean(state.query) || !state.day);
    dayTitle.textContent = state.query
        ? t.searchResults
        : state.date ? dayLabel(state.date, locale) : t.title;
    dayMeta.textContent = state.day
        ? `${songCount(t, state.day.songs.length)}${state.day.backfilled ? ` · ${t.backfilled}` : ''}`
        : '';

    songs.replaceChildren();
    if (state.query) {
        if (!state.results.length) {
            songs.append(el('p', 'd30-section-note', state.busy === 'search' ? t.resolving : t.noResults));
        } else {
            let last = '';
            for (const hit of state.results) {
                if (hit.date !== last) {
                    songs.append(el('div', 'd30-searchrow', dayLabel(hit.date, locale)));
                    last = hit.date;
                }
                songs.append(songRow(hit.song, hit.position, t, () => void handlers.playOne(hit.song)));
            }
        }
        return;
    }
    if (!state.days.length) {
        songs.append(emptyBlock(t.emptyTitle, t.emptyBody));
        return;
    }
    if (!state.day) {
        songs.append(emptyBlock(t.emptyTitle, state.date ? t.dayMissing : t.emptyTitle));
        return;
    }
    songs.append(headRow(t));
    state.day.songs.forEach((song, position) => {
        songs.append(songRow(song, position, t, () => void handlers.playOne(song)));
    });
};
