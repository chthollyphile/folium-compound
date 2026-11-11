// mods/lizi-imessage-504/stage.mjs
// The LIZI stage 504 "已发送" form, ported from its single-file page to a
// Folium visualizer. The visual layer is kept: the black set, the 3D phone,
// the iMessage bubbles that arrive line by line and light up character by
// character, the Dynamic Island, the voice message, the eight camera shots.
//
// What changed is only the communication layer. LIZI's page listened for
// `__c100` postMessages (init / tick / beat / live / setting) and posted
// `ready` / `activity` / `key` back. A Folium visualizer instead receives:
//   - ctx.lines (FoliumLine[]): built once per mount into the stage's
//     { t, dur, text, chars } shape;
//   - ctx.lyricTime: the lyric clock read every frame (no self-advancing);
//   - ctx.isPaused(): playback state;
//   - ctx.audio: power / bands / spectrum, replacing beat + live messages;
//   - ctx.getSettings(): the same four controls, declared in client.mjs;
//   - ctx.getTheme() / ctx.getCoverUrl() / ctx.getDuration() / ctx.getDisplay()
//     / ctx.getSurface(): accent, artwork, length, showText and transparent.
// The page's own rAF loop became ctx.onFrame, its resize listener became
// ctx.onResize, and its setTimeout/setInterval work is owned by this mount.

/** @typedef {import('../folium').FoliumClientApi} Folium */
/** @typedef {import('../folium').FoliumStageContext} FoliumStageContext */

import { STAGE_CSS } from './styles.mjs';
import { STAGE_HTML } from './markup.mjs';
import { createBeatDetector } from './beat.mjs';

const ANDROID = /Android/i.test(navigator.userAgent || '');

// The original page expanded the Dynamic Island once when the first song
// arrived and never again. A visualizer remounts per song, so remember it for
// the module's lifetime (the app session) instead of per mount.
let islandIntroDone = false;

const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const mmss = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  return Math.floor(s / 60) + ':' + pad2(Math.floor(s % 60));
};

const isSpace = (char) => /\s/u.test(char);

const charW = (cp) => {
  if (cp >= 0x2E80) return 16;
  if (cp === 32) return 4.6;
  if (cp >= 65 && cp <= 90) return 10.4;
  if (cp === 105 || cp === 108 || cp === 106 || cp === 116 || cp === 102 || cp === 114 ||
      cp === 46 || cp === 44 || cp === 58 || cp === 59 || cp === 39 || cp === 33 || cp === 124) return 5.2;
  return 8.9;
};

const estH = (text, tw) => {
  if (!text) return 0;
  let w = 0;
  let n = 1;
  const arr = Array.from(text);
  for (let i = 0; i < arr.length; i++) {
    const cw = charW(arr[i].codePointAt(0));
    if (w + cw > tw && w > 0) {
      n++;
      w = cw;
    } else {
      w += cw;
    }
  }
  return n * 22 + 16;
};

/*
 * Per-character start times for one FoliumLine, absolute on the lyric clock.
 * Word timings are used when the line's words cover its non-space characters;
 * otherwise the line's duration is spread over the characters (the original
 * page's fallback). Spaces get no time in the word path, exactly as before.
 */
const buildCharTimes = (line) => {
  const chars = Array.from(line.fullText || '');
  const n = chars.length;
  const out = new Array(n).fill(null);
  if (n === 0) return out;

  const visible = [];
  for (let i = 0; i < n; i++) {
    if (!isSpace(chars[i])) visible.push(i);
  }

  const fromWords = [];
  const words = Array.isArray(line.words) ? line.words : [];
  for (const word of words) {
    const wordChars = Array.from(word.text || '').filter((char) => !isSpace(char));
    const duration = Math.max(0.001, word.endTime - word.startTime);
    wordChars.forEach((_, index) => {
      fromWords.push(word.startTime + (duration * index) / wordChars.length);
    });
  }

  if (fromWords.length === visible.length && visible.length > 0) {
    visible.forEach((charIndex, index) => {
      out[charIndex] = fromWords[index];
    });
    return out;
  }

  const duration = (line.endTime - line.startTime) > 0 ? (line.endTime - line.startTime) : 3.4;
  for (let i = 0; i < n; i++) {
    out[i] = line.startTime + duration * 0.9 * i / Math.max(1, n);
  }
  return out;
};

/** One FoliumLine in the shape the stage's layout/reveal code already uses. */
const buildStageLine = (line) => {
  const start = Number(line.startTime);
  const end = Number(line.endTime);
  const t = isFinite(start) ? start : 0;
  const dur = isFinite(end) && end > t ? end - t : 0;
  return {
    t,
    dur,
    text: (line.fullText == null) ? '' : String(line.fullText),
    chars: buildCharTimes(line).map((time) => (time == null ? null : { t: time })),
  };
};

// The eight camera positions from the original page.
const SHOTS = [
  { n: 'tight-l', rx: 5, ry: -7, rz: -1.4, s: 1.95, ox: -4.0, d: 1150, e: 'cubic-bezier(.62,.02,.18,1)' },
  { n: 'tight-r', rx: 2, ry: 8, rz: 1.1, s: 1.70, ox: 4.0, d: 900, e: 'cubic-bezier(.72,0,.14,1)' },
  { n: 'angle', rx: 10, ry: 5, rz: -2.2, s: 1.46, ox: 0.0, d: 1320, e: 'cubic-bezier(.25,1.06,.32,1)' },
  { n: 'extreme', rx: 1, ry: -4, rz: 0.7, s: 2.15, ox: -2.0, d: 1520, e: 'cubic-bezier(.38,1.08,.30,1)' },
  { n: 'low', rx: -9, ry: 6, rz: 1.6, s: 1.60, ox: 2.5, d: 1200, e: 'cubic-bezier(.30,.92,.26,1)' },
  { n: 'breathe', rx: 7, ry: -10, rz: -1.0, s: 1.18, ox: 0.0, d: 1440, e: 'cubic-bezier(.58,.02,.20,1)' },
  { n: 'macro', rx: 0, ry: 11, rz: 2.0, s: 2.05, ox: -3.0, d: 1660, e: 'cubic-bezier(.50,0,.12,1)' },
  { n: 'drift', rx: 4, ry: -6, rz: -2.6, s: 1.52, ox: 3.0, d: 1780, e: 'cubic-bezier(.55,0,.20,1)' },
];

/**
 * Mounts the 504 stage into a Folium visualizer container.
 * @param {Folium} folium
 * @param {HTMLElement} container
 * @param {FoliumStageContext} ctx
 * @returns {() => void}
 */
export const mountDelivered = (folium, container, ctx) => {
  const doc = container.ownerDocument;

  const root = doc.createElement('div');
  root.className = 'lizi504-root';
  root.innerHTML = STAGE_HTML;

  const style = doc.createElement('style');
  style.textContent = STAGE_CSS;

  container.appendChild(style);
  container.appendChild(root);

  const q = (name) => root.querySelector(`[data-l="${name}"]`);
  const refs = {
    anchor: q('anchor'),
    tilt: q('tilt'),
    par: q('par'),
    layers: q('layers'),
    screen: q('screen'),
    chat: q('chat'),
    thread: q('thread'),
    stamp: q('stamp'),
    typing: q('typing'),
    empty: q('empty'),
    island: q('island'),
    islWave: q('islWave'),
    islCh: q('islCh'),
    islImg: q('islImg'),
    avImg: q('avImg'),
    avCh: q('avCh'),
    recWave: q('recWave'),
    recT: q('recT'),
    glow: q('glow'),
    grain: q('grain'),
    meta: q('meta'),
    mBar: q('mBar'),
    mCur: q('mCur'),
    mDur: q('mDur'),
    clock: q('clock'),
    navN: q('navN'),
    hdN: q('hdN'),
    mN: q('mN'),
    mA: q('mA'),
    islN: q('islN'),
    islA: q('islA'),
  };

  const RM = (() => {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  })();

  const colorProbe = doc.createElement('canvas').getContext('2d');

  let disposed = false;
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };
  const clearTimers = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
  };

  // State names follow the original page so the visual code stays legible.
  const S = { lines: [], idx: -1, t: 0, playing: true, frames: 0, js: 0, err: '' };
  let P = { mode: 'auto', shot: '0', every: '1', meta: false };
  let STATIC = Boolean(ctx.staticMode);
  let W = 0;
  let H = 0;
  let K = 1;
  let PORTRAIT = false;
  let CW = 350;
  let CH = 470;
  let TW = 272;
  const GAP = 9;
  let songDur = 0;
  let offs = [];
  let hgt = [];
  let bubbles = {};
  let curIdx = -2;
  let TEXTW = 240;
  let noiseSeed = 0;
  let lastNow = performance.now();
  let lastRecT = 0;
  let lastBar = -1;
  let lastBarsAt = 0;
  let recProgress = -1;
  let barsRec = [];
  let barsIsl = [];
  let tiltX = 0;
  let tiltY = 0;
  let tiltTX = 0;
  let tiltTY = 0;
  let tiltOn = false;
  let tiltPX = -99;
  let tiltPY = -99;
  let shotIdx = -1;
  let lastBucket = -9999;
  let settleTimer = 0;
  let settleToken = 0;
  let chatTopLocal = 222;
  let threadTY = 0;
  let anchorPx = 0;
  let metaZoomHide = false;
  let freeRX = 9;
  let freeRY = 22;
  let freeS = 1.35;
  let freeDrag = null;
  let grainDone = false;
  let staticStageIndex = -1;
  let staticTime = 0;
  let stageIndexOfOriginal = new Map();
  let displayName = '未知歌曲';
  let reportedError = false;
  let lastErrAt = 0;

  const beat = createBeatDetector();

  const fail = (error) => {
    try {
      S.err = String((error && error.message) || error);
    } catch {
      S.err = 'error';
    }
    const now = performance.now();
    if (now - lastErrAt > 1000) {
      lastErrAt = now;
      try {
        console.error('[lizi-imessage-504]', error);
      } catch {
        // Logging must never take the stage down.
      }
      if (!reportedError) {
        reportedError = true;
        try {
          folium.log.error('stage 504 error', error);
        } catch {
          // The mod is already stopping; the host has its own report.
        }
      }
    }
  };

  const measure = () => {
    W = container.clientWidth || window.innerWidth || 1440;
    H = container.clientHeight || window.innerHeight || 900;
    if (!isFinite(W) || W <= 0) W = 1440;
    if (!isFinite(H) || H <= 0) H = 900;
  };

  const toRGB = (value) => {
    if (!Array.isArray(value) || value.length < 3) return null;
    let r = Math.round(Number(value[0]));
    let g = Math.round(Number(value[1]));
    let b = Math.round(Number(value[2]));
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) return null;
    r = clamp(r, 0, 255) | 0;
    g = clamp(g, 0, 255) | 0;
    b = clamp(b, 0, 255) | 0;
    if (r + g + b < 26) return null;
    return [r, g, b];
  };

  // Let the browser parse any CSS color (hex, rgb(), hsl(), named) for us.
  const cssToRGB = (value) => {
    if (!colorProbe || typeof value !== 'string') return null;
    try {
      colorProbe.fillStyle = '#000000';
      colorProbe.fillStyle = value;
      const text = String(colorProbe.fillStyle);
      if (text.charAt(0) === '#') {
        if (text.length === 7) {
          return [parseInt(text.slice(1, 3), 16), parseInt(text.slice(3, 5), 16), parseInt(text.slice(5, 7), 16)];
        }
        if (text.length === 4) {
          return [parseInt(text.charAt(1) + text.charAt(1), 16), parseInt(text.charAt(2) + text.charAt(2), 16), parseInt(text.charAt(3) + text.charAt(3), 16)];
        }
        if (text.length === 9) {
          return [parseInt(text.slice(1, 3), 16), parseInt(text.slice(3, 5), 16), parseInt(text.slice(5, 7), 16)];
        }
        return null;
      }
      const match = /^rgba?\(([^)]+)\)$/i.exec(text);
      if (!match) return null;
      const parts = match[1].split(',').map((part) => Number(part.trim()));
      return parts.length >= 3 ? [parts[0], parts[1], parts[2]] : null;
    } catch {
      return null;
    }
  };

  const accentRGB = (value) => toRGB(cssToRGB(value)) || [150, 165, 255];

  const applyTheme = (theme) => {
    const color = accentRGB(theme && theme.accentColor);
    root.style.setProperty('--ac', color[0] + ',' + color[1] + ',' + color[2]);
  };

  const applyDisplay = (display) => {
    const showText = !(display && display.showText === false);
    root.classList.toggle('no-text', !showText);
  };

  const applySurface = (surface) => {
    const hide = Boolean(surface && (surface.transparent || surface.hostBackground));
    root.classList.toggle('no-bg', hide);
  };

  const readSettings = (values) => {
    const value = values || {};
    const mode = (value.mode === 'hold' || value.mode === 'free') ? value.mode : 'auto';
    const shot = /^[0-7]$/.test(String(value.shot)) ? String(value.shot) : '0';
    const every = /^[1-4]$/.test(String(value.every)) ? String(value.every) : '1';
    const meta = value.meta === true || value.meta === 'true' || value.meta === 1 || value.meta === '1';
    return { mode, shot, every, meta };
  };

  const syncFreeClass = () => {
    root.classList.toggle('free', P.mode === 'free' && !PORTRAIT && !STATIC);
  };

  const syncMeta = () => {
    const want = P.meta === true;
    refs.meta.style.opacity = (want && !metaZoomHide) ? '1' : '0';
  };

  const setArt = (url, name) => {
    const initial = (name && name.length) ? Array.from(name)[0] : '♪';
    refs.avCh.textContent = initial;
    refs.islCh.textContent = initial;

    const ok = !!(url && typeof url === 'string' && url.length > 4);
    refs.avImg.style.display = 'none';
    refs.islImg.style.display = 'none';
    if (!ok) return;

    refs.avImg.onload = () => { refs.avImg.style.display = 'block'; };
    refs.avImg.onerror = () => { refs.avImg.style.display = 'none'; };
    refs.avImg.src = url;
    refs.islImg.onload = () => { refs.islImg.style.display = 'block'; };
    refs.islImg.onerror = () => { refs.islImg.style.display = 'none'; };
    refs.islImg.src = url;
  };

  const applySong = () => {
    const song = ctx.song;
    displayName = (song && song.title ? String(song.title).trim() : '') || '未知歌曲';
    const artist = (song && song.artist ? String(song.artist).trim() : '') || '未知歌手';

    refs.hdN.textContent = displayName;
    refs.navN.textContent = artist;
    refs.mN.textContent = displayName;
    refs.mA.textContent = artist;
    refs.islN.textContent = displayName;
    refs.islA.textContent = artist;
    refs.meta.classList.add('on');
    setArt(ctx.getCoverUrl(), displayName);
    syncMeta();
  };

  const applyDuration = (duration) => {
    const dur = Number(duration);
    songDur = (isFinite(dur) && dur > 0) ? dur : 0;
    refs.mDur.textContent = songDur ? mmss(songDur) : '—';
  };

  const clearBubbles = () => {
    const keys = Object.keys(bubbles);
    for (const key of keys) {
      const bubble = bubbles[key];
      if (bubble && bubble.el && bubble.el.parentNode) bubble.el.parentNode.removeChild(bubble.el);
    }
    bubbles = {};
  };

  const layout = () => {
    TEXTW = Math.max(80, TW - 28);
    clearBubbles();
    offs = [];
    hgt = [];
    let y = 0;
    for (let i = 0; i < S.lines.length; i++) {
      const text = S.lines[i].text || '';
      const height = text ? estH(text, TEXTW) : 0;
      hgt.push(height);
      offs.push(y);
      if (height > 0) y += height + GAP;
    }
    refs.stamp.style.opacity = S.lines.length ? '1' : '0';
    refs.empty.classList.toggle('on', S.lines.length === 0);
    curIdx = -2;
  };

  const lineTimes = (line) => {
    const chars = Array.from(line.text || '');
    const n = chars.length;
    const out = [];
    const cs = line.chars;
    if (cs && cs.length) {
      const first = cs[0];
      const relative = !!(first && isFinite(Number(first.t)) && Number(first.t) < line.t - 0.08);
      for (let i = 0; i < n; i++) {
        const index = cs.length === n ? i : Math.min(cs.length - 1, Math.floor(i * cs.length / n));
        const record = cs[index];
        const time = (record && typeof record === 'object') ? Number(record.t) : NaN;
        out.push(isFinite(time) ? (relative ? line.t + time : time) : null);
      }
      return out;
    }
    const duration = line.dur > 0 ? line.dur : 3.4;
    for (let i = 0; i < n; i++) out.push(line.t + duration * 0.9 * i / Math.max(1, n));
    return out;
  };

  const idxAt = (time) => {
    const lines = S.lines;
    let lo = 0;
    let hi = lines.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= time + 0.02) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  };

  const fadeFor = (index) => {
    if (curIdx < 0) return 1;
    return clamp(1 - Math.abs(index - curIdx) * 0.10, 0.44, 1);
  };

  const makeBubble = (index) => {
    const line = S.lines[index];
    const el = doc.createElement('div');
    el.className = 'bub ' + (index % 2 === 0 ? 'r' : 'l');
    el.style.top = offs[index] + 'px';
    const chars = Array.from(line.text || '');
    const times = lineTimes(line);
    const spans = [];
    for (let i = 0; i < chars.length; i++) {
      const span = doc.createElement('span');
      span.textContent = chars[i] === ' ' ? ' ' : chars[i];
      el.appendChild(span);
      spans.push({ el: span, t: times[i], on: false });
      if (times[i] != null && S.t >= times[i]) {
        span.className = 'on';
        spans[i].on = true;
      }
    }

    const target = fadeFor(index);
    if (STATIC) {
      el.style.opacity = String(target);
      el.style.transform = 'none';
    } else {
      el.style.opacity = '0';
      el.style.transform = 'translateY(15px) scale(.94)';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el.isConnected) return;
          el.style.opacity = String(target);
          el.style.transform = 'none';
        });
      });
    }
    return { el, spans, want: target };
  };

  const windowRange = (index) => {
    const base = index < 0 ? 0 : index;
    return [Math.max(0, base - 8), Math.min(S.lines.length - 1, base + 1)];
  };

  const paintWindow = (index) => {
    const range = windowRange(index);
    const lo = range[0];
    const hi = range[1];
    const keys = Object.keys(bubbles);
    for (const key of keys) {
      const value = +key;
      if (value < lo || value > hi) {
        if (bubbles[value] && bubbles[value].el.parentNode) bubbles[value].el.parentNode.removeChild(bubbles[value].el);
        delete bubbles[value];
      }
    }
    for (let j = lo; j <= hi; j++) {
      if (bubbles[j]) continue;
      if (!S.lines[j] || !S.lines[j].text) continue;
      if (S.lines[j].t > S.t + 0.02) continue;
      bubbles[j] = makeBubble(j);
      refs.thread.appendChild(bubbles[j].el);
    }
  };

  const ensureBubble = (index) => {
    if (index < 0 || index >= S.lines.length) return;
    if (bubbles[index]) return;
    if (!S.lines[index] || !S.lines[index].text) return;
    const lo = curIdx < 0 ? 0 : curIdx - 8;
    if (index < lo || index > curIdx + 1) return;
    bubbles[index] = makeBubble(index);
    refs.thread.appendChild(bubbles[index].el);
  };

  const restyle = () => {
    const keys = Object.keys(bubbles);
    for (const key of keys) {
      const index = +key;
      const bubble = bubbles[index];
      if (!bubble) continue;
      const target = fadeFor(index);
      bubble.want = target;
      bubble.el.style.opacity = String(target);
      const current = (index === curIdx);
      if (bubble.__cur !== current) {
        bubble.__cur = current;
        bubble.el.className = 'bub ' + (index % 2 === 0 ? 'r' : 'l') + (current ? ' cur' : '');
      }
    }
  };

  const reveal = (bubble, time) => {
    if (!bubble) return;
    const spans = bubble.spans;
    for (let i = 0; i < spans.length; i++) {
      const on = spans[i].t != null && time >= spans[i].t;
      if (on !== spans[i].on) {
        spans[i].on = on;
        spans[i].el.className = on ? 'on' : '';
      }
    }
  };

  let typingAt = -99;
  let typingOn = false;
  const updateTyping = () => {
    const next = curIdx + 1;
    let show = false;
    if (S.playing && next >= 0 && next < S.lines.length && S.lines[next].text) {
      const gap = S.lines[next].t - S.t;
      if (gap > 0.2 && gap < 2.6) show = true;
    }
    if (show) {
      if (typingAt !== next) {
        typingAt = next;
        refs.typing.style.top = (offs[next] || 0) + 'px';
        refs.typing.className = 'typing ' + (next % 2 === 0 ? 'r' : 'l');
      }
      if (!typingOn) {
        typingOn = true;
        refs.typing.classList.add('on');
      }
    } else if (typingOn || typingAt !== -99) {
      typingOn = false;
      typingAt = -99;
      refs.typing.classList.remove('on');
    }
  };

  const shotTransform = (shot, scale, px, py) => (
    'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0) ' +
    'rotateX(' + shot.rx + 'deg) rotateY(' + shot.ry + 'deg) rotateZ(' + shot.rz + 'deg) ' +
    'scale(' + scale + ')'
  );

  const applyShot = (index, force) => {
    if (RM || !refs.tilt) return;
    if (index < 0) return;
    if (PORTRAIT) {
      refs.tilt.style.transform = '';
      return;
    }
    if (P.mode === 'free') return;

    let shotIndex;
    let shot;
    if (P.mode === 'hold') {
      shotIndex = clamp(parseInt(P.shot, 10) || 0, 0, SHOTS.length - 1);
    } else {
      const every = Math.max(1, parseInt(P.every, 10) || 1);
      const bucket = Math.floor(index / every);
      if (!force && bucket === lastBucket) {
        shotIndex = shotIdx;
      } else {
        if (bucket !== lastBucket) lastBucket = bucket;
        shotIndex = ((bucket % SHOTS.length) + SHOTS.length) % SHOTS.length;
      }
    }
    shot = SHOTS[shotIndex];

    const same = (shotIndex === shotIdx) && !force;
    const duration = same ? 780 : shot.d;
    const ease = same ? 'cubic-bezier(.33,.7,.3,1)' : shot.e;
    const scale = shot.s;
    const w = W || 1440;
    const h = H || 900;

    const bubbleHeight = (hgt[index] > 0) ? hgt[index] : 44;
    const bubbleY = chatTopLocal + threadTY + (offs[index] || 0) + bubbleHeight * 0.5;
    const dy = bubbleY - 422;

    if (P.mode === 'hold') {
      refs.tilt.style.transition = STATIC ? 'none' : 'transform ' + (force ? 900 : 420) + 'ms cubic-bezier(.33,.72,.28,1)';
      refs.tilt.style.transform = shotTransform(shot, scale, w * 0.5 - anchorPx, 0);
      shotIdx = shotIndex;
      metaZoomHide = (scale > 1.55);
      syncMeta();
      return;
    }

    const px = (w * 0.5 - anchorPx) + (shot.ox || 0) * w / 100;
    const py = (h * 0.58 - h * 0.5) - dy * K * scale;

    refs.tilt.style.transition = STATIC ? 'none' : 'transform ' + duration + 'ms ' + ease;
    refs.tilt.style.transform = shotTransform(shot, scale, px, py);
    shotIdx = shotIndex;
    metaZoomHide = (scale > 1.55);
    syncMeta();

    if (same || STATIC) return;

    const token = ++settleToken;
    if (settleTimer) {
      clearTimeout(settleTimer);
      timers.delete(settleTimer);
      settleTimer = 0;
    }
    settleTimer = later(() => {
      settleTimer = 0;
      if (token !== settleToken || P.mode === 'free') return;
      const dx = (shotIndex % 2 ? 1.4 : -1.4);
      const dy2 = (shotIndex % 3 ? -1.1 : 1.1);
      refs.tilt.style.transition = 'transform 300ms cubic-bezier(.28,.9,.36,1)';
      refs.tilt.style.transform = shotTransform(shot, scale, px + dx, py + dy2);
    }, Math.max(200, duration - 140));
  };

  const rezoom = () => {
    if (curIdx >= 0) applyShot(curIdx, true);
  };

  const applyFree = () => {
    if (!refs.tilt) return;
    const w = W || 1440;
    const px = w * 0.5 - anchorPx;
    refs.tilt.style.transition = STATIC ? 'none' : 'transform 90ms linear';
    refs.tilt.style.transform =
      'translate3d(' + px.toFixed(1) + 'px,0,0) ' +
      'rotateX(' + freeRX.toFixed(2) + 'deg) ' +
      'rotateY(' + freeRY.toFixed(2) + 'deg) rotateZ(0deg) ' +
      'scale(' + freeS.toFixed(3) + ')';
    metaZoomHide = (freeS > 1.55);
    syncMeta();
  };

  const enterFree = () => {
    const shot = SHOTS[clamp(shotIdx < 0 ? 0 : shotIdx, 0, SHOTS.length - 1)];
    freeRX = shot.rx;
    freeRY = shot.ry;
    freeS = shot.s;
    applyFree();
  };

  const endDrag = () => {
    if (!freeDrag) return;
    freeDrag = null;
    root.classList.remove('dragging');
  };

  const setIdx = (index) => {
    const previous = curIdx;
    curIdx = index;
    S.idx = index;
    const height = (index >= 0 && hgt[index]) ? hgt[index] : 0;
    const translate = CH * 0.72 - height - (index >= 0 ? (offs[index] || 0) : 0);
    const jump = Math.abs(index - previous) > 3 || previous === -2 || index < previous;
    threadTY = translate;
    refs.thread.style.transitionDuration = (STATIC || jump) ? '0s' : '.56s';
    refs.thread.style.transform = 'translate3d(0,' + (Math.round(translate * 10) / 10) + 'px,0)';
    paintWindow(index);
    restyle();
    if (index >= 0) applyShot(index);
  };

  const applySettings = (values) => {
    const next = readSettings(values);
    const previous = P;
    P = next;
    if (P.mode !== previous.mode) {
      endDrag();
      if (P.mode === 'free') enterFree();
      else {
        lastBucket = -9999;
        rezoom();
      }
    } else if (P.shot !== previous.shot && P.mode === 'hold') {
      lastBucket = -9999;
      rezoom();
    } else if (P.every !== previous.every && P.mode === 'auto') {
      lastBucket = -9999;
      rezoom();
    }
    if (P.meta !== previous.meta) syncMeta();
    syncFreeClass();
  };

  const buildLayers = () => {
    const layerEl = refs.layers;
    if (!layerEl) return;

    while (layerEl.firstChild) layerEl.removeChild(layerEl.firstChild);

    let count;
    let gap;
    if (ANDROID) {
      let k = K;
      if (!isFinite(k) || k <= 0) k = 0.56;
      const need = 2.6 / (k * 1.18);
      count = Math.min(20, Math.max(8, Math.floor(58.8 / need)));
      gap = 58.8 / count;
    } else {
      count = 40;
      gap = 1.47;
    }

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const z = -(i + 1) * gap;
      const layer = doc.createElement('i');
      const lum = 0.28 + 0.72 * Math.pow(t, 0.75);
      layer.style.transform = 'translateZ(' + z.toFixed(2) + 'px)';
      layer.style.background = 'rgb(' + Math.round(10 + 74 * lum) + ',' +
        Math.round(10 + 74 * lum) + ',' + Math.round(13 + 82 * lum) + ')';
      layerEl.appendChild(layer);
    }

    const back = doc.createElement('i');
    back.style.transform = ANDROID
      ? 'translateZ(' + (-(58.8 + gap)).toFixed(2) + 'px)'
      : 'translateZ(-60px)';
    back.style.background = 'radial-gradient(72% 50% at 32% 30%,#2a2a33,#0e0e12 72%)';
    layerEl.appendChild(back);
  };

  const fit = () => {
    if (disposed) return;
    const w = W > 0 ? W : 1440;
    const h = H > 0 ? H : 900;
    const portrait = (w / h) < 0.9;
    PORTRAIT = portrait;
    root.classList.toggle('portrait', portrait);
    root.classList.toggle('narrow', w <= 1100);

    let k;
    if (portrait) {
      k = Math.min(w / 390, h / 844);
      refs.anchor.style.left = '';
      // The portrait CSS flattens the phone; drop any inline camera transform
      // left over from a landscape layout so it can take effect.
      refs.tilt.style.transform = '';
      refs.tilt.style.transition = '';
    } else {
      k = Math.min((h * 0.82) / 844, (w * 0.46) / 390, 1.26);
      refs.anchor.style.left = w > 1180 ? '62%' : '56%';
    }
    root.style.setProperty('--k', String(k));
    K = k;

    buildLayers();

    const cw = refs.chat.clientWidth || 350;
    const ch = refs.chat.clientHeight || 470;
    const changed = (cw !== CW || ch !== CH);
    CW = cw;
    CH = ch;
    TW = Math.max(120, Math.round((CW - 24) * 0.76));
    root.style.setProperty('--bw', TW + 'px');
    if (changed) layout();

    try {
      chatTopLocal = 6 + refs.chat.offsetTop;
      anchorPx = (w > 1180 ? 0.62 : 0.56) * w;
    } catch {
      // Layout reads are best-effort; the next frame/resize retries.
    }
    syncFreeClass();
  };

  const grain = () => {
    if (grainDone) return;
    grainDone = true;
    try {
      const canvas = refs.grain;
      const w = W || 1440;
      const h = H || 900;
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d');
      if (!context) return;
      const tile = doc.createElement('canvas');
      tile.width = tile.height = 96;
      const tileContext = tile.getContext('2d');
      if (!tileContext) return;
      const image = tileContext.createImageData(96, 96);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = 100 + (Math.random() * 150 | 0);
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 12;
      }
      tileContext.putImageData(image, 0, 0);
      context.fillStyle = context.createPattern(tile, 'repeat');
      context.fillRect(0, 0, w, h);
    } catch {
      // The grain is optional; a failed canvas must not break the stage.
    }
  };

  const mkBars = (host, count) => {
    host.innerHTML = '';
    const out = [];
    for (let i = 0; i < count; i++) {
      const bar = doc.createElement('i');
      host.appendChild(bar);
      out.push(bar);
    }
    return out;
  };

  const setBars = (bars, amp, phase) => {
    const n = bars.length;
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? i / (n - 1) : 0;
      const env = 0.42 + 0.58 * Math.sin(Math.PI * (0.12 + 0.78 * x));
      const wob = 0.4 + 0.6 * Math.abs(Math.sin(i * 1.9 + phase * 1.7));
      const value = amp * env * wob;
      const scale = clamp(value * 1.75 + 0.18, 0.18, 1);
      bars[i].style.transform = 'scaleY(' + scale.toFixed(2) + ')';
    }
  };

  const setRecProgress = (progress) => {
    const p = clamp(progress, 0, 1);
    if (Math.abs(p - recProgress) < 0.012 && recProgress >= 0) return;
    recProgress = p;
    const limit = Math.round(p * barsRec.length);
    for (let i = 0; i < barsRec.length; i++) {
      const on = i < limit;
      if (barsRec[i].__ps !== on) {
        barsRec[i].__ps = on;
        barsRec[i].className = on ? 'ps' : '';
      }
    }
  };

  const updateBars = (beatOn) => {
    const bands = ctx.audio.getBands() || {};
    const power = Number(ctx.audio.getPower()) || 0;
    const bass = Number(bands.bass) || 0;
    const mid = Number(bands.mid) || 0;
    const treble = Number(bands.treble) || 0;
    const amp = clamp(bass * 0.5 + mid * 0.28 + treble * 0.22 + power * 0.26 + 0.04, 0.03, 1);

    noiseSeed += 0.35;
    setBars(barsRec, S.playing ? amp : 0.02, noiseSeed);
    setBars(barsIsl, S.playing ? amp * 0.9 : 0.06, noiseSeed + 1.3);

    if (beatOn && S.playing) {
      const level = clamp(Math.max(power, bass), 0, 1);
      noiseSeed += 0.5;
      setBars(barsRec, clamp(level * 0.9 + 0.16, 0, 1), noiseSeed + 0.4);
      setBars(barsIsl, clamp(level * 0.85 + 0.2, 0, 1), noiseSeed + 1.7);
    }
  };

  const expandIslandOnce = () => {
    if (RM || islandIntroDone || STATIC || ctx.isPreview) return;
    islandIntroDone = true;
    refs.island.classList.add('open');
    if (refs.screen) refs.screen.classList.add('island-open');
    later(() => {
      refs.island.classList.remove('open');
      if (refs.screen) refs.screen.classList.remove('island-open');
    }, 2000);
  };

  const tickClock = () => {
    try {
      const date = new Date();
      refs.clock.textContent = date.getHours() + ':' + pad2(date.getMinutes());
      refs.stamp.textContent = '今天 ' + date.getHours() + ':' + pad2(date.getMinutes());
    } catch {
      // A clock is decorative.
    }
  };

  const frame = (now) => {
    if (disposed) return;
    const jsStart = performance.now();
    try {
      let dt = (now - lastNow) / 1000;
      lastNow = now;
      if (!isFinite(dt) || dt < 0) dt = 0;
      if (dt > 0.05) dt = 0.05;

      let index;
      if (STATIC) {
        // A still frame may still show the "typing…" bubble that belongs to
        // this instant; the .static CSS keeps its dots from animating.
        S.playing = true;
        S.t = staticTime;
        index = staticStageIndex;
      } else {
        S.playing = !ctx.isPaused();
        S.t = ctx.lyricTime.get();
        index = idxAt(S.t);
      }

      if (index !== curIdx) setIdx(index);

      if (index >= 0) {
        ensureBubble(index);
        const next = index + 1;
        if (next < S.lines.length && S.lines[next].t <= S.t + 0.02) ensureBubble(next);
      }

      const bubble = bubbles[curIdx];
      if (bubble) reveal(bubble, S.t);

      updateTyping();

      if (songDur > 0) {
        const progress = clamp(S.t / songDur, 0, 1);
        if (Math.abs(progress - lastBar) > 0.0012) {
          lastBar = progress;
          refs.mBar.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
          setRecProgress(progress);
        }
      }

      if (now - lastRecT > 260) {
        lastRecT = now;
        refs.recT.textContent = mmss(S.t);
        refs.mCur.textContent = mmss(S.t);
      }

      if (!STATIC) {
        if (tiltOn && refs.par && !RM) {
          tiltX += (tiltTX - tiltX) * 0.055;
          tiltY += (tiltTY - tiltY) * 0.055;
          if (Math.abs(tiltX - tiltPX) > 0.02 || Math.abs(tiltY - tiltPY) > 0.02) {
            tiltPX = tiltX;
            tiltPY = tiltY;
            refs.par.style.transform = 'rotateY(' + tiltX.toFixed(2) + 'deg) rotateX(' + (-tiltY).toFixed(2) + 'deg)';
          }
        }

        if (now - lastBarsAt >= 40) {
          lastBarsAt = now;
          const beatOn = S.playing ? beat.step(ctx.audio, S.t, dt, 1) : false;
          updateBars(beatOn);
        }
      }

      S.frames++;
    } catch (error) {
      fail(error);
    }
    S.js = performance.now() - jsStart;
  };

  const onResize = (size) => {
    if (disposed) return;
    try {
      W = size.width;
      H = size.height;
      fit();
      grainDone = false;
      grain();
    } catch (error) {
      fail(error);
    }
  };

  const onChange = () => {
    if (disposed) return;
    try {
      const theme = ctx.getTheme();
      if (theme !== lastTheme) {
        lastTheme = theme;
        applyTheme(theme);
      }
      const display = ctx.getDisplay();
      if (display !== lastDisplay) {
        lastDisplay = display;
        applyDisplay(display);
      }
      const settings = ctx.getSettings();
      if (settings !== lastSettings) {
        lastSettings = settings;
        applySettings(settings);
      }
      const cover = ctx.getCoverUrl();
      if (cover !== lastCover) {
        lastCover = cover;
        setArt(cover, displayName);
      }
      const duration = ctx.getDuration();
      if (duration !== lastDuration) {
        lastDuration = duration;
        applyDuration(duration);
      }
      const surface = ctx.getSurface();
      if (surface !== lastSurface) {
        lastSurface = surface;
        applySurface(surface);
      }
    } catch (error) {
      fail(error);
    }
  };

  const onPointerDown = (event) => {
    if (P.mode !== 'free' || PORTRAIT || STATIC) return;
    if (event.button !== undefined && event.button !== 0) return;
    freeDrag = { x: event.clientX, y: event.clientY, rx: freeRX, ry: freeRY };
    root.classList.add('dragging');
    try {
      container.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a convenience; dragging still works while inside.
    }
  };

  const onPointerMove = (event) => {
    if (!RM && W > 0 && H > 0) {
      const rect = container.getBoundingClientRect();
      const width = rect.width || W;
      const height = rect.height || H;
      if (width > 0 && height > 0) {
        tiltOn = true;
        const nx = ((event.clientX - rect.left) / width) - 0.5;
        const ny = ((event.clientY - rect.top) / height) - 0.5;
        tiltTX = clamp(nx, -0.5, 0.5) * 5.4;
        tiltTY = clamp(ny, -0.5, 0.5) * -3.6;
      }
    }

    if (!freeDrag) return;
    const dx = event.clientX - freeDrag.x;
    const dy = event.clientY - freeDrag.y;
    freeRY = clamp(freeDrag.ry + dx * 0.26, -62, 62);
    freeRX = clamp(freeDrag.rx - dy * 0.20, -34, 34);
    applyFree();
  };

  const onPointerUp = () => {
    endDrag();
  };

  const onWheel = (event) => {
    if (P.mode !== 'free' || PORTRAIT || STATIC) return;
    event.preventDefault();
    freeS = clamp(freeS * (event.deltaY > 0 ? 0.93 : 1.075), 0.80, 2.60);
    applyFree();
  };

  // --- Initial state -----------------------------------------------------

  const theme0 = ctx.getTheme();
  const display0 = ctx.getDisplay();
  const surface0 = ctx.getSurface();
  const duration0 = ctx.getDuration();
  const settings0 = ctx.getSettings();

  P = readSettings(settings0);
  root.classList.toggle('static', STATIC);
  applyTheme(theme0);
  applyDisplay(display0);
  applySurface(surface0);

  const entries = ctx.lines.map((line, index) => ({ index, stage: buildStageLine(line) }));
  entries.sort((a, b) => a.stage.t - b.stage.t);
  S.lines = entries.map((entry) => entry.stage);
  stageIndexOfOriginal = new Map(entries.map((entry, index) => [entry.index, index]));

  applySong();
  applyDuration(duration0);

  barsRec = mkBars(refs.recWave, 40);
  barsIsl = mkBars(refs.islWave, 4);
  refs.recWave.style.width = (barsRec.length * 2.5) + 'px';
  refs.recWave.style.minWidth = (barsRec.length * 2.5) + 'px';
  for (let i = 0; i < barsRec.length; i++) {
    barsRec[i].style.left = (i * 2.5 + 0.5).toFixed(1) + 'px';
  }

  measure();
  fit();
  layout();

  if (STATIC) {
    const hostIndex = ctx.staticLineIndex != null ? ctx.staticLineIndex : ctx.getLineIndex();
    staticStageIndex = hostIndex >= 0 ? (stageIndexOfOriginal.get(hostIndex) ?? hostIndex) : -1;
    const line = staticStageIndex >= 0 ? S.lines[staticStageIndex] : null;
    staticTime = line ? line.t + Math.max(0.001, line.dur) * 0.55 : 0;
    S.t = staticTime;
    S.idx = staticStageIndex;
    setBars(barsRec, 0.38, 1.2);
    setBars(barsIsl, 0.32, 2.1);
  } else {
    S.t = ctx.lyricTime.get();
    S.idx = idxAt(S.t);
    S.playing = !ctx.isPaused();
  }

  setIdx(S.idx);
  syncFreeClass();
  tickClock();

  let lastTheme = theme0;
  let lastDisplay = display0;
  let lastSettings = settings0;
  let lastCover = ctx.getCoverUrl();
  let lastDuration = duration0;
  let lastSurface = surface0;

  const stopResize = ctx.onResize(onResize);
  const stopFrame = ctx.onFrame(frame);
  const stopChange = ctx.onChange(onChange);
  const stopClock = ctx.every(15000, tickClock);

  const rafId = requestAnimationFrame(() => {
    if (disposed) return;
    measure();
    fit();
    grainDone = false;
    grain();
  });

  grain();
  if (!STATIC && !ctx.isPreview) later(expandIslandOnce, 260);

  container.addEventListener('pointerdown', onPointerDown, { passive: true });
  container.addEventListener('pointermove', onPointerMove, { passive: true });
  container.addEventListener('pointerup', onPointerUp, { passive: true });
  container.addEventListener('pointercancel', onPointerUp, { passive: true });
  container.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('blur', endDrag);

  return () => {
    if (disposed) return;
    disposed = true;
    clearTimers();
    cancelAnimationFrame(rafId);
    stopResize();
    stopFrame();
    stopChange();
    stopClock();
    container.removeEventListener('pointerdown', onPointerDown);
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerup', onPointerUp);
    container.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('wheel', onWheel);
    window.removeEventListener('blur', endDrag);
    clearBubbles();
    root.remove();
    style.remove();
  };
};
