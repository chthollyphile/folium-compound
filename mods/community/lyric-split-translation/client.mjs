// mods/lyric-split-translation/client.mjs
// Splits lyrics a lyric source delivered as one line per translation pair,
// "原文<分隔符>译文", into 原文 + 译文 — or drops the translation so the host
// shows the original alone.
//
// Whether a lyric is really in that shape is decided over the whole lyric, in
// the synchronous `lyrics.transform` hook (the host hands over every line at
// once):
//
//   (可分割 + 补偿 − 剔除行) / (总行数 − 剔除行) > 阈值
//
// 剔除行（多个分隔符的高风险行、只含分隔符的行、空行）和阈值都能自己配，见下面的设置分区；
// 「评估当前歌词」命令把这一次算出来的数字直接报出来，方便调参。
//
// The text work itself lives in splitter.mjs, which knows nothing about Folium.

import { DEFAULT_DIVIDERS, parseDividers, splitTranslationLines } from './splitter.mjs';

/* The command reports in the UI language; settings labels are localized by the host. */
const isChinese = () => /^zh/i.test(typeof document === 'undefined' ? '' : document.documentElement.lang || navigator?.language || '');
const pick = (label) => (isChinese() ? label['zh-CN'] : label.en);

/** Reads the settings into the options splitter.mjs expects; dividers are parsed once per change. */
const readOptions = (values) => ({
  dividers: parseDividers(values.dividers || DEFAULT_DIVIDERS),
  mode: values.mode,
  threshold: values.threshold,
  compensation: values.compensation,
  excludeEmptyLines: values.excludeEmptyLines,
  excludeDividerOnlyLines: values.excludeDividerOnlyLines,
  excludeEdgeDividerLines: values.excludeEdgeDividerLines,
  excludeInterludeLines: values.excludeInterludeLines,
  excludeMultiDivider: values.excludeMultiDivider,
  multiDividerLimit: values.multiDividerLimit,
  overwriteTranslation: values.overwriteTranslation,
  useDominantDivider: values.useDominantDivider,
  dropDividerOnlyLines: values.dropDividerOnlyLines,
});

/*
 * The host inserts `......` lines at instrumental gaps longer than three seconds
 * (`INTERLUDE_FULL_TEXT` in src/utils/lyrics/parserCore.ts). The mod surface never hands over
 * that constant, so the text is matched here, once; the splitter only receives the predicate and
 * stays host-agnostic.
 */
const isHostInterlude = (line) => line?.fullText === '......';

export default function activate(folium) {
  if (folium.env.context !== 'main') return undefined;

  const settings = folium.registries.settingsSections.register({
    id: 'split-prefs',
    label: { 'zh-CN': '拆分单行双语歌词', en: 'Split Translation' },
    description: {
      'zh-CN': '整首一起评估：系数 =（可分割 + 补偿 − 剔除行）/（总行数 − 剔除行），大于阈值才拆分。参数变更不追溯正在播放的歌词，下一次歌词载入时生效。',
      en: 'The whole lyric is scored: (splittable + compensation − excluded) / (total − excluded), split only above the threshold. Setting changes are not retroactive to the playing lyric; they apply when the next lyric loads.',
    },
    settings: [
      {
        key: 'dividers',
        type: 'text',
        label: { 'zh-CN': '分隔符', en: 'Dividers' },
        description: {
          'zh-CN': '用空格或逗号分开，例如「/ ／ ｜」。每一个都是**普通字符串**，按字面匹配，不是正则，也不需要转义：填「.」就只会匹配真正的句点，填「/」只匹配斜杠。每个候选整串参与匹配，所以「//」和「/」是两个不同的分隔符，长的优先。',
          en: 'Separate them with spaces or commas, e.g. "/ ／ ｜". Each one is a literal string, matched exactly — not a regex, no escaping: "." matches a real period and "/" only a slash. A candidate matches as a whole, so "//" and "/" are two different dividers and the longer one wins.',
        },
        placeholder: DEFAULT_DIVIDERS,
        defaultValue: DEFAULT_DIVIDERS,
        group: { 'zh-CN': '识别', en: 'Detection' },
      },
      {
        key: 'useDominantDivider',
        type: 'boolean',
        label: { 'zh-CN': '只用最高频的单一分隔符', en: 'Use the most frequent divider only' },
        description: {
          'zh-CN': '评估完再用：按填进来的分隔符逐首数，命中行数最多的那一个拿来做整首的切分，其他分隔符当成正文。填一个分隔符时无差别。',
          en: 'After evaluation: the divider that pairs the most lines is used for the whole lyric, the rest count as content. No effect when a single divider is configured.',
        },
        defaultValue: true,
        group: { 'zh-CN': '识别', en: 'Detection' },
      },
      {
        key: 'threshold',
        type: 'number',
        label: { 'zh-CN': '触发阈值', en: 'Threshold' },
        description: { 'zh-CN': '系数大于该值才拆分。', en: 'Split only when the score is above this.' },
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.8,
        group: { 'zh-CN': '触发条件', en: 'Trigger' },
      },
      {
        key: 'compensation',
        type: 'number',
        label: { 'zh-CN': '补偿行数', en: 'Compensation (lines)' },
        description: { 'zh-CN': '直接加到分子上的行数，歌词很短时给一点余量。', en: 'Lines added to the numerator; gives short lyrics some slack.' },
        min: 0,
        max: 20,
        step: 1,
        defaultValue: 4,
        group: { 'zh-CN': '触发条件', en: 'Trigger' },
      },
      {
        key: 'excludeMultiDivider',
        type: 'boolean',
        label: { 'zh-CN': '剔除高风险行（多个分隔符）', en: 'Exclude risky lines (several dividers)' },
        defaultValue: true,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'multiDividerLimit',
        type: 'number',
        label: { 'zh-CN': '高风险行的分隔符数量', en: 'Dividers that make a line risky' },
        description: { 'zh-CN': '一行里分隔符达到这个数量就算高风险。', en: 'A line with this many dividers counts as risky.' },
        min: 2,
        max: 5,
        step: 1,
        defaultValue: 2,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'excludeEmptyLines',
        type: 'boolean',
        label: { 'zh-CN': '剔除空行', en: 'Exclude blank lines' },
        defaultValue: true,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'excludeDividerOnlyLines',
        type: 'boolean',
        label: { 'zh-CN': '剔除分隔符行', en: 'Exclude divider-only lines' },
        description: {
          'zh-CN': '整行只有空字符和分隔符的行（「/」「／」这种段落分隔），和空行一样不参与系数，也不被改写。',
          en: 'Lines holding nothing but whitespace and dividers (a bare "/" marking a break) stay out of the score and are not rewritten, like blank lines.',
        },
        defaultValue: true,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'excludeEdgeDividerLines',
        type: 'boolean',
        label: { 'zh-CN': '剔除端部分隔符行', en: 'Exclude edge-divider lines' },
        description: {
          'zh-CN': '分隔符只出现在行首或行尾、另一侧是正文的行（「原文/」「/译文」这种），配对不成立，和空行一样不参与系数、不被改写。',
          en: 'Lines where the divider only sits at one end with text on the other ("原文/", "/译文"): nothing pairs up, so they stay out of the score like blank lines and are not rewritten.',
        },
        defaultValue: true,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'excludeInterludeLines',
        type: 'boolean',
        label: { 'zh-CN': '剔除间奏行', en: 'Exclude interlude lines' },
        description: {
          'zh-CN': '宿主在长间奏处自动插入的「......」行，不是没拆开的歌词，和空行一样不参与系数、不被改写。',
          en: 'The "......" lines the host inserts at long instrumental gaps are not lyrics that failed to split; they stay out of the score like blank lines and are not rewritten.',
        },
        defaultValue: true,
        group: { 'zh-CN': '剔除行', en: 'Excluded lines' },
      },
      {
        key: 'mode',
        type: 'select',
        label: { 'zh-CN': '拆分后的处理', en: 'What to do with the translation' },
        options: [
          { value: 'split', label: { 'zh-CN': '拆成译文', en: 'Keep it as translation' } },
          { value: 'drop', label: { 'zh-CN': '丢弃译文', en: 'Drop it' } },
        ],
        defaultValue: 'split',
        group: { 'zh-CN': '改写', en: 'Rewriting' },
      },
      {
        key: 'dropDividerOnlyLines',
        type: 'boolean',
        label: { 'zh-CN': '删除只有分隔符和空字符的行', en: 'Delete divider-only lines' },
        description: {
          'zh-CN': '把整行只有空字符和分隔符的行从歌词里去掉，而不是留在播放页上当一行空歌词。',
          en: 'Removes the lines holding nothing but whitespace and dividers instead of leaving them on the player as empty lyrics.',
        },
        defaultValue: false,
        group: { 'zh-CN': '改写', en: 'Rewriting' },
      },
      {
        key: 'overwriteTranslation',
        type: 'boolean',
        label: { 'zh-CN': '覆盖已有译文', en: 'Overwrite an existing translation' },
        description: {
          'zh-CN': '默认只给没有译文的行补上译文。',
          en: 'By default only lines without a translation get one.',
        },
        defaultValue: false,
        group: { 'zh-CN': '改写', en: 'Rewriting' },
      },
    ],
  });

  let options = readOptions(settings.params.get());
  // Last evaluation, for the diagnostics command: the lyric as it came in plus the stats of
  // scoring it. A settings change re-scores `lines` in place, so the evaluate command answers
  // for the settings now in force — a stale ratio printed next to the new compensation and the
  // new switch labels could not be reproduced from the settings form. The lyric on screen
  // follows on the next load: `lyrics.transform` runs once per load, so the rewrite itself
  // cannot be replayed here.
  let last = null;
  const evaluate = (lines) => splitTranslationLines(lines, { ...options, isInterludeLine: isHostInterlude });

  settings.params.subscribe(() => {
    options = readOptions(settings.params.get());
    if (last) last = { ...last, stats: evaluate(last.lines).stats };
  });

  folium.events.on('lyrics.transform', (event) => {
    if (event.lines.length === 0) return;
    const result = evaluate(event.lines);
    last = { song: event.song, lines: event.lines, stats: result.stats };
    if (result.rewritten > 0 || result.lines !== event.lines) event.lines = result.lines;
  });

  /*
   * The report is two lines: the verdict first, the numbers under it. One long line had the
   * conclusion — triggered or not, and how many lines were actually rewritten — buried at the far
   * end, past four buckets the user has to read to reach it. What the switch did is the answer;
   * everything else is the evidence for it.
   */
  const report = () => {
    if (!last) {
      return pick({ 'zh-CN': '还没有评估过歌词：先打开一首带歌词的歌曲。', en: 'No lyric evaluated yet: play a song with lyrics first.' });
    }
    const { stats } = last;
    const zh = isChinese();
    const name = last.song ? `${last.song.title ?? ''}${last.song.artist ? ` — ${last.song.artist}` : ''}` : '';
    // The compensation sits next to the numbers it moved, not only in the settings form: two users
    // comparing "0.79, not triggered" against the same lyric at "0.83, triggered" have no way to
    // tell the difference was the switch and not the song. Zero is the settings default, so it is
    // left out rather than printed on every report.
    const score = zh
      ? `${stats.ratio.toFixed(2)}（阈值 ${stats.threshold}${options.compensation > 0 ? `，补偿 ${options.compensation}` : ''}）`
      : `${stats.ratio.toFixed(2)} (threshold ${stats.threshold}${options.compensation > 0 ? `, compensation ${options.compensation}` : ''})`;
    // Which divider the split ran on, and what that leaves whole. Only worth saying when the lyric
    // actually had more than one candidate.
    const divider = stats.dividerMode !== 'dominant' ? ''
      : zh ? `，按「${stats.divider}」切分` : `, splitting on "${stats.divider}"`;
    /*
     * Every line lands in exactly one of `splittable` / an excluded bucket / `plain`, and the
     * buckets sum to `excluded`, so the two lines add up to `total` and cannot describe two
     * different lyrics at once. Each bucket also names the switch that let it off the books:
     * "none" and "10, counted" are different answers, and the second is why the same lyric scores
     * above the threshold one moment and below it the next — which is exactly what the user is
     * hunting for when the number seems not to move.
     */
    const bucket = (label, n, off) => (
      zh ? `${label} ${n}${off ? '（已计入）' : ''}` : `${n} ${label}${off ? ' (counted)' : ''}`
    );
    const bucketList = [
      bucket(zh ? '高风险' : 'risky', stats.risky, options.excludeMultiDivider === false),
      bucket(zh ? '空行' : 'blank', stats.blank, options.excludeEmptyLines === false),
      bucket(zh ? '分隔符行' : 'divider-only', stats.dividerOnly, options.excludeDividerOnlyLines === false),
      bucket(zh ? '端部分隔符行' : 'edge-divider', stats.edgeDivider, options.excludeEdgeDividerLines === false),
      bucket(zh ? '间奏行' : 'interlude', stats.interlude, options.excludeInterludeLines === false),
    ].join(zh ? '、' : ', ');
    const buckets = zh
      ? `剔除 ${stats.excluded}（${bucketList}）`
      : `excluded ${stats.excluded} (${bucketList})`;
    const plain = zh ? `、无分隔符 ${stats.plain}` : `, ${stats.plain} plain`;
    const dropped = stats.dropped > 0
      ? (zh
        ? `，已删掉分隔符行 ${stats.dropped} 行（只在播放页移除）`
        : `, ${stats.dropped} divider-only lines deleted (off the player only)`)
      : '';
    const verdict = zh
      ? `${name ? `${name}：` : ''}系数 ${score}${stats.triggered ? '已触发' : '未触发'}，实际改写 ${stats.rewritten} 行${dropped}${divider}。`
      : `${name ? `${name}: ` : ''}score ${score}, ${stats.triggered ? 'triggered' : 'not triggered'}, ${stats.rewritten} rewritten${dropped}${divider}.`;
    const detail = zh
      ? `共 ${stats.total} 行，可分割 ${stats.splittable}，${buckets}${plain}。`
      : `${stats.total} lines, ${stats.splittable} splittable, ${buckets}${plain}.`;
    return `${verdict}\n${detail}`;
  };

  folium.registries.commands.register({
    id: 'evaluate',
    label: { 'zh-CN': '评估当前歌词', en: 'Evaluate the current lyrics' },
    description: {
      'zh-CN': '报出这首歌的行数、可分割行数、剔除行数与系数，以及是否已触发拆分。',
      en: 'Reports the line counts, the score and whether the split triggered for this song.',
    },
    keywords: ['lyrics', 'split', 'translation', '歌词', '分割', '译文', 'geci', 'fenge'],
    run: () => ({ message: report() }),
  });
}
