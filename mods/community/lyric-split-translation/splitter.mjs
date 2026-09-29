// mods/lyric-split-translation/splitter.mjs
// Decides whether a lyric is "原文<分隔符>译文" and splits it. Pure: no host
// API, no DOM — the client entry can call it from the synchronous
// `lyrics.transform` hook, and the unit tests drive it directly.
//
// The decision is made over the whole lyric, never line by line:
//
//   系数 = (可分割 + 补偿 − 剔除行) / (总行数 − 剔除行) > 阈值
//
//   可分割   能按分隔符切出两侧非空文本的行
//   剔除行   分隔符数量达到上限的高风险行（可关）+ 分隔符行（可关）+ 空行（可关）
//            + 端部分隔符行（可关）+ 间奏行（可关；宿主在长间奏处自动插入的
//              「......」行由调用方经 `isInterludeLine` 谓词认出，本文件不认识宿主）
//   补偿     直接加到分子上的行数，给短歌词一点余量
//
// An excluded line is one the scoring does not see: it leaves the numerator
// and the denominator together, which is the subtraction above. (Counting a
// risky line as splittable and subtracting it again comes to the same thing;
// a blank line is never splittable, so including it would only drag the score
// down — turn off the matching switch if you want to count them.)
//
// A divider-only line is the blank-line case with a divider in it: " / " cleared
// `text.trim()` and so was counted as blank already, but a bare "/" did not, and
// those lines are exactly what fan-made lyric files use to mark a break. They
// are the lyric's own separators showing through, not lines that failed to
// split, so scoring them punishes a lyric for how it spells its blank lines.
//
// Two switches sit outside that formula:
//
//   useDominantDivider    the whole lyric is split with the one divider that
//                         pairs the most lines, not with whichever of the
//                         configured dividers a line happens to hit first
//   dropDividerOnlyLines  the break lines are removed from the output instead
//                         of being left on screen as blank lyrics
/** One divider as the user typed it: split on whitespace or commas, dedupe, longest first. */
export const parseDividers = (raw) => {
  const tokens = String(raw ?? '')
    .split(/[\s,，、]+/)
    .filter(Boolean);
  return [...new Set(tokens)].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
};

/*
 * The dividers a lyric file is likely to use, in the order a tie goes to: the plain slash, its
 * fullwidth twin, the two vertical bars, and the double slash. The old list also carried `￨`
 * (U+FFE8, halfwidth light vertical), which nobody types and which read as a third near-identical
 * bar for `pickDominantDivider` to choose between — three bars fighting over the same lines made
 * the dominant pick turn on a character the user never meant to list.
 */
export const DEFAULT_DIVIDERS = '/ ／ ｜ | //';

/* The earliest divider at or after `from`; the longest one wins a tie, so `//` beats `/`. */
const nextDivider = (text, dividers, from = 0) => {
  let best = null;
  dividers.forEach((divider) => {
    const index = text.indexOf(divider, from);
    if (index < 0) return;
    if (!best || index < best.index || (index === best.index && divider.length > best.divider.length)) {
      best = { index, divider };
    }
  });
  return best;
};

/** How many dividers a line holds, each counted once. */
export const countDividers = (text, dividers) => {
  let count = 0;
  let from = 0;
  for (;;) {
    const hit = nextDivider(text, dividers, from);
    if (!hit) return count;
    count += 1;
    from = hit.index + hit.divider.length;
  }
};

/**
 * True when the line holds nothing but whitespace and dividers — "/", " ／ ",
 * "//" and so on. `splitLineText` already refuses these (one side is always
 * blank), but they were still counted in the score's denominator whenever the
 * line was not wholly whitespace, so a lyric that marks breaks with a bare
 * divider could be judged too loosely to split. `parseDividers` splits on
 * whitespace, so a "divider" blanking out a line also covers em dashes,
 * tildes or anything else the user listed.
 */
export const isDividerOnlyLine = (text, dividers) => (
  typeof text === 'string' && text.trim() !== '' && dividers.length > 0
  && text.split(/[\s\u3000]+/).every((token) => token === '' || dividers.includes(token))
);

/**
 * True when the line carries text but its divider sits at an end — "Yeah! Yeah! Yeah!/",
 * "/译文", "原文/". Both sides of a real 原文/译文 pair hold text, so these are not splits that
 * landed in the wrong place; they are ordinary lines with a decorative or stray mark at the edge
 * (a fan lyric's line-end slash, a leaked leading bracket). They are reported as their own class
 * so "the divider is on the wrong side" stops covering them, and, like a divider-only line, they
 * stay out of the score and are never rewritten.
 */
export const isEdgeDividerLine = (text, dividers) => {
  if (typeof text !== 'string' || dividers.length === 0) return false;
  if (text.trim() === '') return false;
  return dividers.some((divider) => (
    (text.startsWith(divider) && text.slice(divider.length).trim() !== '')
    || (text.endsWith(divider) && text.slice(0, -divider.length).trim() !== '')
  ));
};

/**
 * Splits one line at its first divider. Null when there is none, or when a side
 * is blank — either side, because a blank one means the divider was not this
 * lyric's original/translation separator but a break or a stray mark.
 */
export const splitLineText = (text, dividers) => {
  if (typeof text !== 'string' || dividers.length === 0) return null;
  const hit = nextDivider(text, dividers);
  if (!hit) return null;
  const original = text.slice(0, hit.index).trim();
  const translation = text.slice(hit.index + hit.divider.length).trim();
  if (!original || !translation) return null;
  return { original, translation, offset: hit.index, divider: hit.divider };
};

/**
 * A line whose divider is at an edge *and* that has no usable split in it. `原文/译文/` ends with
 * a divider too, but it splits fine, so it is not this: the edge mark only matters when nothing
 * else in the line pairs up.
 */
const isEdgeDividerOnlyLine = (text, dividers) => (
  isEdgeDividerLine(text, dividers) && splitLineText(text, dividers) === null
);

/**
 * The divider that pairs the most lines up, and how many lines it pairs. Ties
 * go to the divider the user listed first (`parseDividers` already sorted the
 * longest first), and lines with a blank side are not counted — those are the
 * same "split into the wrong place" cases that are refused everywhere else.
 */
export const pickDominantDivider = (lines, dividers, options = {}) => {
  if (dividers.length <= 1) {
    return dividers.length === 1 ? { divider: dividers[0], lines: 0 } : { divider: null, lines: 0 };
  }
  // `dividers` is dup-free, so a Map keyed by it is safe.
  const hits = new Map(dividers.map((divider) => [divider, 0]));
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    // Counted per line, not per divider occurrence: a line has a pairing only if it has one at all.
    dividers.forEach((divider) => {
      if (splitLineText(typeof line?.fullText === 'string' ? line.fullText : '', [divider], options)) {
        hits.set(divider, hits.get(divider) + 1);
      }
    });
  });
  // Strictly greater, so a tie keeps the earlier candidate: `dividers` is already in the order the
  // user typed them (longest first), and a lyric split evenly between two marks has no favourite.
  let divider = dividers[0];
  let best = hits.get(divider) ?? 0;
  dividers.forEach((candidate) => {
    if (hits.get(candidate) > best) {
      best = hits.get(candidate);
      divider = candidate;
    }
  });
  return { divider, lines: best };
};

/*
 * Everything up to `offset`: the part straddling it is clipped, the whitespace
 * `splitLineText` trimmed off the ends goes too, and blank entries are dropped.
 * `setText` gets the untouched original as its third argument, so a caller can
 * drop data that only made sense for the full part (a clipped word's syllables
 * no longer fit their timings).
 */
const cutAt = (items, offset, getText, setText) => {
  const parts = [];
  let cursor = 0;
  for (const item of items) {
    if (cursor >= offset) break;
    const text = getText(item);
    parts.push({ item, text: text.slice(0, Math.max(0, offset - cursor)) });
    cursor += text.length;
  }
  while (parts.length > 0 && parts[0].text.trim() === '') parts.shift();
  while (parts.length > 0 && parts[parts.length - 1].text.trim() === '') parts.pop();
  if (parts.length > 0) {
    parts[0].text = parts[0].text.replace(/^\s+/, '');
    const last = parts.length - 1;
    parts[last].text = parts[last].text.replace(/\s+$/, '');
  }
  return parts
    .filter((part) => part.text !== '')
    .map((part) => setText(part.item, part.text, getText(part.item)));
};

/*
 * The timed words up to `offset`. Null when the words do not make up the line
 * text: guessing timings then is worse than one word covering the whole line,
 * which is what the host builds instead.
 */
const headWords = (words, offset, fullText) => {
  if (!Array.isArray(words) || words.length === 0) return null;
  const joined = words.reduce((sum, word) => sum + String(word?.text ?? '').length, 0);
  if (joined !== fullText.length) return null;
  const cut = cutAt(words, offset, (word) => String(word?.text ?? ''), (word, text, original) => ({
    text,
    startTime: word.startTime,
    endTime: word.endTime,
    ...(text === original && Array.isArray(word.syllables) ? { syllables: word.syllables } : {}),
  }));
  return cut.length > 0 ? cut : null;
};

/** The saved word split up to `offset`; null when it no longer joins into the new text. */
const headSegments = (segments, offset) => {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const cut = cutAt(segments, offset, (segment) => String(segment ?? ''), (_segment, text) => text);
  return cut.length > 0 ? cut : null;
};

/*
 * One line rewritten as 原文 (+ 译文). Timed words and the saved word split are
 * cut at the divider; the host recomputes render hints and drops a split that
 * no longer joins back to the text, so a bad cut degrades to one whole-line word.
 */
const rewriteLine = (line, split, options) => {
  const words = headWords(line.words, split.offset, line.fullText);
  const wordSegments = headSegments(line.wordSegments, split.offset);
  const next = { ...line, fullText: split.original };
  next.words = words ?? [{ text: split.original, startTime: line.startTime, endTime: line.endTime }];
  if (wordSegments && wordSegments.join('') === split.original) next.wordSegments = wordSegments;
  else delete next.wordSegments;
  if (options.mode === 'split') next.translation = split.translation;
  else delete next.translation;
  return next;
};

/**
 * What a line is as far as the scoring is concerned. Reported per line with the
 * rest of the stats so a surprising score can be traced back to the lines that
 * produced it.
 *
 * The classes are read off the same flags the score uses, with each switch
 * applied: a class the user turned off reports as what it falls back to, which
 * is what `kinds` has always meant. The order matters only where two flags can
 * both be set — a divisible-by-nothing break line is `risky` before it is
 * `dividerOnly`, matching how `excluded` counts it once, and an interlude line
 * reports as `interlude` before anything a divider would say about it.
 */
const lineKind = (entry, options) => {
  if (entry.risky) return 'risky';
  if (entry.dividerOnly) return options.excludeDividerOnlyLines === false ? 'plain' : 'dividerOnly';
  if (entry.blank) return options.excludeEmptyLines === false ? 'plain' : 'blank';
  if (entry.interlude) return options.excludeInterludeLines === false ? 'plain' : 'interlude';
  if (entry.edgeDivider) return options.excludeEdgeDividerLines === false ? 'plain' : 'edgeDivider';
  return entry.splittable ? 'splittable' : 'plain';
};

/**
 * Scores a whole lyric and, when it clears the threshold, returns the rewritten
 * lines with the translations filled in.
 *
 * `dropDividerOnlyLines` is the one switch that changes the line count rather
 * than the score: the score never sees those lines anyway, so removing them is
 * purely about what reaches the screen. Everything else comes back untouched.
 */
export const splitTranslationLines = (lines, options = {}) => {
  const threshold = Number(options.threshold) || 0;
  const compensation = Number(options.compensation) || 0;
  const limit = Number(options.multiDividerLimit) || 2;
  const list = (Array.isArray(lines) ? lines : []).filter((line) => line);
  const dropDividerOnly = options.dropDividerOnlyLines === true;
  /*
   * The whole lyric is split with one divider, not with whichever of the user's
   * dividers happens to appear first: a lyric that mixes "/" and "//" would
   * otherwise pick a different one per line, and the two are rarely the same
   * kind of mark. The most frequent one is the lyric's own separator; the rest
   * are content (or typos), and lines carrying them stay whole.
   */
  const dividers = Array.isArray(options.dividers) ? options.dividers : [];
  const dominant = options.useDominantDivider !== false && dividers.length > 1
    ? pickDominantDivider(list, dividers, options)
    : null;
  const used = dominant && dominant.divider ? [dominant.divider] : dividers;

  const decisions = list.map((line) => {
    const text = typeof line?.fullText === 'string' ? line.fullText : '';
    const split = splitLineText(text, used, options);
    const blank = text.trim() === '';
    // A risky line is one the split itself sees too many dividers in, so this reads `used`: the
    // candidates that lost `pickDominantDivider` are content, and `and/or` must not read as a
    // risky line just because `/` is still in the box.
    //
    // Divider-only is different, and reads every candidate. It is the one judgment the report has
    // to keep stable as the split moves: these are the lines the user can see on the player as
    // empty lyrics, and 剔除/删除 have to be able to name them whichever candidate won. Scoring
    // them on `used` alone made the switch depend on a tie the user never sees — a lyric whose
    // breaks were spelled `／` stopped counting them the moment `pickDominantDivider` handed the
    // split to a `/` that paired nothing, so the report said "excluded 0" beside a denominator
    // those very lines were still sitting in.
    //
    // Detected whether or not the switch excludes them: "0 excluded, and there were none" reads
    // very differently from "0 excluded, because you turned the switch off".
    const dividerOnly = !blank && isDividerOnlyLine(text, dividers);
    // An edge mark is only interesting when the line did not split: "原文/译文/" ends with a
    // divider too, and it is a perfectly good pair. Read off `used` for the same reason as
    // `risky` — a candidate that lost the dominant pick is content, not an edge mark.
    const edgeDivider = split === null && isEdgeDividerOnlyLine(text, used);
    // The host's interlude insertions ("......" at instrumental gaps) are not lyric lines that
    // failed to split, and with no divider in them they are none of the other classes either;
    // left as plain they only drag the denominator down. The caller names them with a predicate
    // so this file stays host-agnostic. Detected whether or not the switch excludes them, for
    // the same reason as divider-only above.
    const interlude = typeof options.isInterludeLine === 'function' && options.isInterludeLine(line) === true;
    return {
      line,
      split,
      risky: options.excludeMultiDivider !== false && countDividers(text, used) >= limit,
      blank,
      dividerOnly,
      edgeDivider,
      interlude,
    };
  });

  /*
   * Every line lands in exactly one of these classes, and the report reads them straight off. A
   * line that pairs up is `splittable`; one that does not is blank, a break mark (divider-only),
   * an edge mark, or a leftover line with no divider at all. The old `blankSided` blended the last
   * two: `Yeah! Yeah! Yeah!/` and `原文/` were reported as "split into the wrong place", which is
   * not what they are — nothing in them was ever going to pair up, they are lines that happen to
   * end in the lyric's divider. The user could see the number move with the switches and could not
   * make it mean anything, because it never named a real class.
   */
  const scored = decisions.map((decision) => ({
    ...decision,
    splittable: decision.split !== null,
  }));

  const dropped = dropDividerOnly ? scored.filter((entry) => entry.dividerOnly).length : 0;
  const kept = dropped > 0 ? scored.filter((entry) => !entry.dividerOnly) : scored;

  // Each class is detected whether or not its switch excludes it, so the diagnostics command can
  // report "there were 3, you chose to count them" instead of falling silent. `excluded` is the
  // union the switches actually gate, so a line that is both risky and divider-only counts once.
  //
  // Every figure here is read off `scored` — the lyric as it came in — and `dropped` is what was
  // then removed. `total` used to be `kept.length`, and that one asymmetry is what made the
  // report unable to close: 总 68 with 8 lines already deleted, 120 行 of buckets and 剔除 0 with
  // the eighth line plainly excluded. What the split saw has to stay readable after the split
  // changed it.
  const count = (predicate) => scored.filter(predicate).length;
  const isBlankExcluded = (entry) => entry.blank && options.excludeEmptyLines !== false;
  const isDividerOnlyExcluded = (entry) => entry.dividerOnly && options.excludeDividerOnlyLines !== false;
  const isEdgeDividerExcluded = (entry) => entry.edgeDivider && options.excludeEdgeDividerLines !== false;
  const isInterludeExcluded = (entry) => entry.interlude && options.excludeInterludeLines !== false;
  const total = scored.length;
  const risky = count((entry) => entry.risky);
  const blank = count((entry) => entry.blank);
  const dividerOnly = count((entry) => entry.dividerOnly);
  // `原文/`, `/译文` and `Yeah! Yeah! Yeah!/`: a divider at one end with text on the other. They
  // never pair up, so they are listed, not counted as splittable — and they are excluded by their
  // own switch so a lyric full of trailing slashes stops dragging the score down.
  const edgeDivider = count((entry) => entry.edgeDivider);
  // The host's "......" insertions: counted whether or not the switch excludes them, so the
  // report can say "there were 2, you chose to count them" instead of folding them into plain.
  const interlude = count((entry) => entry.interlude);
  // A line with no divider at all: counted in the denominator, never in the numerator. The
  // report names it so `total` minus the listed buckets accounts for every line.
  const plain = count((entry) => !entry.splittable && !entry.blank && !entry.dividerOnly && !entry.edgeDivider && !entry.interlude);
  const excluded = count((entry) => entry.risky || isBlankExcluded(entry) || isDividerOnlyExcluded(entry) || isEdgeDividerExcluded(entry) || isInterludeExcluded(entry));
  const splittable = count((entry) => entry.splittable && !entry.risky && !isBlankExcluded(entry) && !isDividerOnlyExcluded(entry) && !isEdgeDividerExcluded(entry) && !isInterludeExcluded(entry));
  const base = total - excluded;
  const ratio = base > 0 ? (splittable + compensation) / base : 0;
  const triggered = ratio > threshold;
  const kinds = kept.map((entry) => lineKind(entry, options));

  const stats = {
    total, splittable, plain, risky, blank, dividerOnly, edgeDivider, interlude, excluded, dropped, ratio, triggered, threshold,
    dividerMode: dominant ? 'dominant' : (options.useDominantDivider === false ? 'configured' : 'single'),
    divider: dominant ? dominant.divider : (dividers.length === 1 ? dividers[0] : null),
    // Zero here, and overwritten below when the rewrite ran. It used to be added to `stats` only
    // on the triggered path, so the not-triggered return carried `undefined` and the report it
    // feeds printed "实际改写 undefined 行" — the number the user was reading to work out whether
    // the split had happened at all.
    rewritten: 0,
    kinds,
  };
  if (!triggered) return { lines: dropped > 0 ? kept.map((entry) => entry.line) : list, stats, rewritten: 0 };

  let rewritten = 0;
  const next = kept.map((entry) => {
    const { line, split } = entry;
    const kind = lineKind(entry, options);
    // A class the user turned OFF is still not rewritten: the switch says whether to count it, and
    // a line with no usable split was never going to be rewritten anyway.
    if (kind !== 'splittable') return line;
    if (line.translation && options.overwriteTranslation !== true) return line;
    rewritten += 1;
    return rewriteLine(line, split, options);
  });
  return { lines: next, stats: { ...stats, rewritten }, rewritten };
};
