// mods/Just-Enough-Setting/lib/clock.mjs
// 歌词时钟：决定「现在唱到哪一句」。
//
// 两条时间来源，优先级从高到低：
//
//   1. 宿主歌词时钟——播放页上的 stage 层拿到的 FoliumStageContext 同时给出宿主自己的歌词时钟
//      （ctx.lyricTime，已经算进了用户对这首歌的歌词偏移）和宿主自己的行号（ctx.getLineIndex）。
//      这是唯一精确的来源。
//   2. 播放进度估算——不在播放页时用 folium.playback.getState().position 加上一个基准偏移。
//      它读不到每首歌各自的歌词偏移，所以只能靠「页面歌词基准微调」粗调。
//
// 行号本身由模组自己按 `line.startTime` 二分查找得出，两条路径共用同一份逻辑：这样手动延迟
// （±3 秒滑杆）在两种模式下都成立，而不是只有其中一种能拖。
//
// 排期：不轮询。定了当前行之后，用一次 setTimeout 精确睡到下一行的 startTime（自动模式的核心），
// 醒来重算并再排下一行；暂停、切歌、跳转、换歌词、改延迟都会重排。
//
// 逐词歌词（片段 word）要的不只是行边界，还要行内每个词的 startTime。编排里出现 word 片段时，
// 调用方打开 wordPrecision，排期目标的取法就变成「下一个行边界与下一个词边界里更早的那个」——
// 依然是「排到下一个时间戳」而不是「每 100ms 问一次」，精度和开销都不变。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const { revealedWordCount } = await import(`./compose.mjs${VERSION}`);

/** 二分找出最后一个 `startTime <= time` 的行；没有这样的行时返回 -1。 */
const lastLineAt = (lines, time) => {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startTime <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
};

const clampDelay = (milliseconds) => Math.min(Math.max(milliseconds, 24), 60000);

export const createLyricClock = ({ folium, getOffsetSeconds, onLineChange, log }) => {
  let ownLines = [];
  let stage = null;
  let stageDisposer = null;
  let timer = null;
  let signature = null;
  /** 编排里有逐词歌词片段时为真：排期要额外照顾行内的词边界。 */
  let wordPrecision = false;

  const readPlayback = () => {
    try {
      return folium.playback?.getState?.() ?? null;
    } catch (error) {
      log?.warn?.('playback state unavailable', error);
      return null;
    }
  };

  // stage 层挂载时以它的歌词为准：宿主可能通过 lyrics.transform 改写过，那份才是屏幕上真正在显示的。
  const lines = () => (stage && Array.isArray(stage.lines) ? stage.lines : ownLines);

  const isPaused = () => {
    if (stage) return Boolean(stage.isPaused());
    return readPlayback()?.state !== 'playing';
  };

  const lyricTime = () => {
    // `ctx.lyricTime` 是宿主给舞台层的那只钟（Folium 1.5 叫 `ctx.currentTime`）：get() 拿当前时间。
    const base = stage ? stage.lyricTime.get() : (readPlayback()?.position ?? 0);
    const seconds = Number.isFinite(base) ? base : 0;
    const offset = Number(getOffsetSeconds()) || 0;
    return seconds + offset;
  };

  const currentLine = (time, allLines, index) => {
    if (index >= 0) return allLines[index];
    // 行间空隙（前奏、间奏）保留刚唱完的一句，避免系统媒体上的歌词一闪一闪地清空。
    const helper = folium.lyrics?.getRecentCompletedLine;
    if (typeof helper === 'function') {
      try {
        return helper(allLines, -1, time) ?? null;
      } catch (error) {
        log?.warn?.('getRecentCompletedLine failed', error);
      }
    }
    return null;
  };

  /** 当前行里已经唱到几个词（0 基索引的「最后一个是第几个」对使用者没意义，所以给计数）。 */
  const lineWordState = (line, time) => {
    const words = line && Array.isArray(line.words) ? line.words : [];
    return { wordCount: words.length, revealedWords: revealedWordCount(line, time) };
  };

  const resolve = () => {
    const allLines = lines();
    const time = lyricTime();
    const index = allLines.length > 0 ? lastLineAt(allLines, time) : -1;
    const line = allLines.length > 0 ? currentLine(time, allLines, index) : null;
    return {
      index,
      line,
      time,
      lineCount: allLines.length,
      ...lineWordState(line, time),
    };
  };

  /**
   * 只在「当前是哪一句」真的变了时才通知，避免宿主设置变化引起的高频回调带动下游重画。
   * 开了逐词精度时把「已唱出几个词」也纳入判据——同一句里词往前走了也必须通知。
   */
  const refresh = (force = false) => {
    const next = resolve();
    const key = `${next.index}|${next.line?.id ?? ''}|${next.line?.fullText ?? ''}`
      + (wordPrecision ? `|w${next.revealedWords}` : '');
    if (!force && key === signature) return;
    signature = key;
    onLineChange({ ...next, source: stage ? 'host' : 'estimated' });
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /** 当前行里下一个还没到的词时间戳；没有逐词时间时给 null。 */
  const nextWordTime = (time) => {
    if (!wordPrecision) return null;
    const allLines = lines();
    const index = allLines.length > 0 ? lastLineAt(allLines, time) : -1;
    const words = index >= 0 && Array.isArray(allLines[index]?.words) ? allLines[index].words : null;
    if (!words || words.length === 0) return null;
    const upcoming = words.find((word) => Number.isFinite(word?.startTime) && word.startTime > time);
    return upcoming ? upcoming.startTime : null;
  };

  const schedule = () => {
    clearTimer();
    const allLines = lines();
    if (allLines.length === 0 || isPaused()) return;

    const time = lyricTime();
    const nextIndex = lastLineAt(allLines, time) + 1;
    const lineStart = allLines[nextIndex] && Number.isFinite(allLines[nextIndex].startTime)
      ? allLines[nextIndex].startTime
      : null;
    const wordStart = nextWordTime(time);
    // 行边界与词边界取更早的那个：一行里几个词之间也要按时醒来。
    const target = lineStart === null ? wordStart
      : (wordStart === null ? lineStart : Math.min(lineStart, wordStart));
    if (target === null) return;

    // 到下一个时间戳的距离就是这一觉的长度；+12ms 抵消 setTimeout 的调度抖动，避免醒得比时间戳早。
    const delay = clampDelay((target - time) * 1000 + 12);
    timer = setTimeout(() => {
      timer = null;
      refresh();
      schedule();
    }, delay);
  };

  return {
    /** 新歌词到达（lyrics.loaded）：强制重算，因为行对象整体换了。 */
    setLines(next) {
      ownLines = Array.isArray(next) ? next : [];
      refresh(true);
      schedule();
    },

    /** 播放页的 stage 层挂载：接上宿主歌词时钟，切到精确模式。 */
    attachStage(context) {
      stageDisposer?.();
      stage = context;
      // `ctx.onChange` 是舞台上下文的「行号 / 暂停 / 主题 / 封面 / 显示设置…变了」（1.5 叫 ctx.subscribe）。
      stageDisposer = context.onChange(() => {
        refresh();
        schedule();
      });
      refresh(true);
      schedule();
    },

    /** stage 层卸载：退回估算模式。 */
    detachStage() {
      stageDisposer?.();
      stageDisposer = null;
      stage = null;
      refresh(true);
      schedule();
    },

    /** 播放状态、进度、延迟偏移变化后调用：重算当前行并重排下一行。 */
    poke() {
      refresh();
      schedule();
    },

    /**
     * 编排里有没有逐词歌词片段。由 controller 在配置变化时告知：没有就完全走原路
     * （行边界排期 + 行级去重），有才启用词边界排期，避免给不用这个功能的人多付代价。
     */
    setWordPrecision(next) {
      const value = Boolean(next);
      if (value === wordPrecision) return;
      wordPrecision = value;
      signature = null;
      refresh(true);
      schedule();
    },

    /** 只读快照，供诊断面板显示；不触发通知。 */
    peek() {
      const next = resolve();
      return {
        ...next,
        source: stage ? 'host' : 'estimated',
        hostIndex: stage ? stage.getLineIndex() : -1,
      };
    },

    dispose() {
      clearTimer();
      stageDisposer?.();
      stageDisposer = null;
      stage = null;
    },
  };
};
