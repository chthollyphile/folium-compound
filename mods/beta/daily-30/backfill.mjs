// mods/daily-30/backfill.mjs
// Fills NetEase days the archive missed while Folia was closed. The server keeps a short history, so this
// runs once per day, never overwrites an existing day, and stays silent when the account cannot read it.

import { neteaseDate } from './dates.mjs';
import { errorCode, fetchNeteaseHistoryDates, fetchNeteaseHistoryDay } from './sources.mjs';

export const createNeteaseBackfill = ({ folium, state, save }) => async () => {
    const today = neteaseDate(new Date());
    if (state.lastBackfill === today) return;
    state.lastBackfill = today;
    if (folium.account?.getState?.('netease')?.status === 'signed-out') return;

    let dates;
    try {
        dates = await fetchNeteaseHistoryDates(folium);
    } catch (error) {
        folium.log.info('[daily-30] NetEase history is not available', { code: errorCode(error) });
        return;
    }
    if (!dates.length) return;

    let existing;
    try {
        const days = await folium.rpc.call('archive.list');
        existing = new Set((Array.isArray(days) ? days : [])
            .filter((day) => day?.platform === 'netease')
            .map((day) => day.date));
    } catch (error) {
        folium.log.warn('[daily-30] could not read the archive before backfilling', error);
        return;
    }

    for (const date of dates) {
        if (date === today || existing.has(date)) continue;
        try {
            const songs = await fetchNeteaseHistoryDay(folium, date);
            if (!songs.length) continue;
            await save('netease', date, songs, { backfilled: true });
            existing.add(date);
            folium.log.info('[daily-30] backfilled NetEase day', { date, count: songs.length });
        } catch (error) {
            folium.log.info('[daily-30] could not backfill a NetEase day', { date, code: errorCode(error) });
        }
    }
};
