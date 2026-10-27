// mods/daily-30/capture.mjs
// The recorder: fetches each enabled platform's current list through the host's platform.raw, writes it
// through the main entry, and fills NetEase's server-side history when the account is new to the
// archive. It also owns the timer and the "something changed" signal the home tab listens to.

import { errorCode, fetchNeteaseDaily, SourceError } from './sources.mjs';
import { neteaseDate } from './dates.mjs';
import { platformTitle } from './songs.mjs';
import { createNeteaseBackfill } from './backfill.mjs';

// Platforms this mod records. NetEase only: the QQ route needed the host's own sign-in session, which a
// mod must not read (folium-compound review of issue #89).
export const PLATFORMS = ['netease'];

const sourceOf = () => fetchNeteaseDaily;

const errorMessage = (error) => (
    error instanceof Error ? error.message : String(error)
);

export const createCapture = ({ folium, settings }) => {
    const state = {
        running: false,
        lastRun: 0,
        lastError: null,
        results: {},
        lastBackfill: '',
    };
    const listeners = new Set();
    let current = null;
    let timer = null;
    let kickTimer = null;
    let retryTimer = null;
    let retries = 0;

    const notify = () => {
        for (const listener of [...listeners]) {
            try {
                listener();
            } catch (error) {
                folium.log.warn('[daily-30] a capture listener threw', error);
            }
        }
    };

    const save = async (platform, date, songs, extra = {}) => {
        const answer = await folium.rpc.call('archive.save', {
            platform,
            date,
            capturedAt: new Date().toISOString(),
            title: platformTitle(platform),
            songs,
            ...extra,
        });
        if (!answer?.ok) throw new SourceError('write', '无法写入每日推荐记录');
        return answer;
    };

    const capturePlatform = async (platform) => {
        if (platform === 'netease' && folium.account?.getState?.(platform)?.status === 'signed-out') {
            throw new SourceError('not-signed-in', '网易云音乐未登录');
        }
        const date = neteaseDate(new Date());
        const data = await sourceOf(platform)(folium);
        const songs = data.songs;
        const saved = await save(platform, date, songs);
        state.results[platform] = {
            ok: true,
            date,
            count: songs.length,
            changed: Boolean(saved.changed),
            at: Date.now(),
        };
        folium.log.info('[daily-30] captured', { platform, date, count: songs.length, changed: Boolean(saved.changed) });
    };

    const backfillNetease = createNeteaseBackfill({ folium, state, save });

    const captureAll = (reason = 'manual') => {
        if (current) return current;
        current = (async () => {
            state.running = true;
            state.lastError = null;
            notify();
            try {
                const values = settings.get();
                for (const platform of PLATFORMS) {
                    if (platform === 'netease' && values.captureNetease === false) continue;
                    try {
                        await capturePlatform(platform);
                    } catch (error) {
                        state.results[platform] = {
                            ok: false,
                            code: errorCode(error),
                            message: errorMessage(error),
                            at: Date.now(),
                        };
                        folium.log.info('[daily-30] capture skipped', { platform, code: errorCode(error) });
                    }
                }
                if (values.backfillNetease !== false && values.captureNetease !== false) await backfillNetease();
            } catch (error) {
                state.lastError = { code: errorCode(error), message: errorMessage(error) };
                folium.log.error('[daily-30] capture failed', error);
            } finally {
                state.running = false;
                state.lastRun = Date.now();
                current = null;
                notify();
                scheduleRetry();
                folium.log.info('[daily-30] capture finished', { reason, results: state.results });
            }
        })();
        return current;
    };

    const intervalMs = () => {
        const minutes = Number(settings.get().intervalMinutes);
        return (Number.isFinite(minutes) ? Math.min(240, Math.max(5, minutes)) : 30) * 60 * 1000;
    };

    const clearTimers = () => {
        if (timer) clearInterval(timer);
        if (kickTimer) clearTimeout(kickTimer);
        if (retryTimer) clearTimeout(retryTimer);
        timer = null;
        kickTimer = null;
        retryTimer = null;
    };

    // A network or rate-limit failure is worth one more try; anything else waits for the next interval.
    const scheduleRetry = () => {
        const retryable = Object.values(state.results).some((result) => (
            result && result.ok === false && (result.code === 'network' || result.code === 'rate-limited')
        ));
        if (!retryable) {
            retries = 0;
            return;
        }
        if (!settings.get().autoCapture || retries >= 3) return;
        retries += 1;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
            retryTimer = null;
            void captureAll('retry');
        }, 60_000);
    };

    const schedule = () => {
        clearTimers();
        retries = 0;
        if (!settings.get().autoCapture) return;
        kickTimer = setTimeout(() => {
            kickTimer = null;
            void captureAll('startup');
        }, 4000);
        timer = setInterval(() => { void captureAll('interval'); }, intervalMs());
    };

    const kick = (delay = 4000) => {
        if (!settings.get().autoCapture) return;
        if (kickTimer) clearTimeout(kickTimer);
        kickTimer = setTimeout(() => {
            kickTimer = null;
            void captureAll('account');
        }, delay);
    };

    const start = () => {
        schedule();
        const offSettings = settings.onChange?.(() => schedule());
        const offAccount = folium.events.on('account.changed', (account) => {
            if (account?.providerId === 'netease' && account?.status === 'signed-in') kick();
        });
        return () => {
            clearTimers();
            offSettings?.();
            offAccount?.();
        };
    };

    const captureNow = () => captureAll('manual');

    const getStatus = () => ({
        running: state.running,
        lastRun: state.lastRun,
        lastError: state.lastError,
        results: { ...state.results },
    });

    const subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return { start, getStatus, captureNow, subscribe };
};
