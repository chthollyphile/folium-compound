// mods/daily-30/dates.mjs
// The recommendation day follows Beijing time: NetEase's 每日推荐 changes at 06:00, and before that the
// list is still the previous day's. Dates are stored as YYYY-MM-DD strings, so the archive stays
// readable and sorts without a timezone.

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, '0');

const formatDay = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

const beijingParts = (now) => {
    const shifted = new Date(now.getTime() + BEIJING_OFFSET_MS);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours(),
    };
};

/** The Beijing date NetEase labels its daily recommendation with (changes at 06:00). */
export const neteaseDate = (now = new Date()) => {
    const parts = beijingParts(now);
    if (parts.hour >= 6) return formatDay(parts.year, parts.month, parts.day);
    const previous = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - DAY_MS);
    return formatDay(previous.getUTCFullYear(), previous.getUTCMonth() + 1, previous.getUTCDate());
};

/** A date as a localised weekday, e.g. 周五 or Fri. */
export const weekday = (date, locale = 'zh-CN') => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date));
    if (!match) return '';
    const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 4));
    try {
        return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'Asia/Shanghai' }).format(value);
    } catch {
        return '';
    }
};

export const formatClock = (time, locale = 'zh-CN') => {
    if (!time) return '';
    try {
        return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(time));
    } catch {
        return '';
    }
};

export const formatDuration = (seconds) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${pad(total % 60)}`;
};
