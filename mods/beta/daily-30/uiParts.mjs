// mods/daily-30/uiParts.mjs
// DOM pieces for the home tab. Text from a platform is always assigned through textContent, never
// through innerHTML, so a song title cannot become markup.

import { formatDuration, neteaseDate, weekday } from './dates.mjs';
import { songCount } from './labels.mjs';

export const el = (tag, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
};

export const button = (className, text, onClick) => {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
};

export const dayLabel = (date, locale) => {
    const name = weekday(date, locale);
    return name ? `${date} · ${name}` : date;
};

export const dateRow = (day, selected, t, locale, onSelect) => {
    const node = button('d30-date', '', () => onSelect(day.date));
    node.setAttribute('aria-current', selected ? 'true' : 'false');
    const left = el('span');
    left.append(el('span', 'day', dayLabel(day.date, locale)));
    const meta = el('span', 'meta', `${songCount(t, day.count)}${day.backfilled ? ` · ${t.backfilled}` : ''}`);
    left.append(meta);
    const right = el('span');
    if (day.date === neteaseDate(new Date())) {
        right.append(el('span', 'd30-badge accent', t.today));
    } else if (day.backfilled) {
        right.append(el('span', 'd30-badge', t.backfilled));
    }
    node.append(left, right);
    return node;
};

export const songRow = (song, position, t, onPlay) => {
    const row = el('div', 'd30-row');
    row.append(el('span', 'd30-index', String(position + 1)));
    const cover = el('img', 'd30-cover');
    cover.alt = '';
    cover.loading = 'lazy';
    cover.referrerPolicy = 'no-referrer';
    if (song.cover) {
        cover.src = song.cover;
        cover.addEventListener('error', () => cover.classList.add('hidden'), { once: true });
    } else {
        cover.classList.add('hidden');
    }
    row.append(cover);
    const title = el('span', 'd30-title');
    title.append(el('span', 'name', song.name), el('span', 'artist', song.artist || '—'));
    row.append(title);
    row.append(el('span', 'd30-album', song.album || ''));
    row.append(el('span', 'd30-time', formatDuration(song.duration)));
    const play = button('d30-play', t.play, () => onPlay(song));
    play.title = `${t.play} ${song.name}`;
    play.setAttribute('aria-label', `${t.play} ${song.name}`);
    row.append(play);
    return row;
};

export const headRow = (t) => {
    const row = el('div', 'd30-row head');
    row.append(
        el('span', 'd30-index', '#'),
        el('span', 'd30-cover', ''),
        el('span', 'd30-title', t.columnTitle),
        el('span', 'd30-album', t.columnAlbum),
        el('span', 'd30-time', t.columnTime),
        el('span', 'd30-play', ''),
    );
    return row;
};

export const emptyBlock = (title, body) => {
    const root = el('div', 'd30-empty');
    root.append(el('h2', '', title), el('p', '', body));
    return root;
};
