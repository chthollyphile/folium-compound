'use strict';

/**
 * 歌词行查找：按 startTime 建一次索引，播放中只做二分查找。
 * 宿主的 getPlaybackSnapshot() 每次返回新对象，所以缓存用内容签名，而不是数组引用。
 *
 * 返回对象 { text, kind }，kind 的取值：
 *  - 'lyric'     当前正在唱的一句歌词
 *  - 'intro'     前奏（第一句还没到）——text 为空，不显示
 *  - 'interlude' 间奏（两句之间的空隙，上一句已结束、下一句还没到）——text 为空，不显示
 *  - 'outro'     尾奏（最后一句已结束，但歌曲还没放完）——text 为空，不显示
 *  - 'ended'     歌曲已结束（位置过了时长），text 为空，交给渲染层显示等待态
 *  - 'none'      这首歌没有任何可用的歌词数据
 */

const NO_LYRIC_TEXT = '未检测到歌词';
/** 相邻两句之间的小空隙（≤ 这个秒数）视为连读，不切空——否则每句之间会清空一下（看起来闪一下）。 */
const LINE_GAP_TOLERANCE = 1.0;

const lyricLineText = (line) => String((line && (line.fullText || line.text)) || '').trim();
/** 行的有效结束时间：优先 renderHints.renderEndTime，其次 endTime，都没有就用下一行开始或 start+5s。
 *  若与下一行开始只差一点点，则延到下一行开始，避免句间闪空。 */
const lineEndOf = (line, nextStart) => {
  const start = Number(line && line.startTime) || 0;
  const renderEnd = Number(line && line.renderHints && line.renderHints.renderEndTime);
  const endTime = Number(line && line.endTime);
  const next = Number(nextStart);
  let end = start + 5;
  if (Number.isFinite(renderEnd) && renderEnd > start) end = renderEnd;
  else if (Number.isFinite(endTime) && endTime > start) end = endTime;
  else if (Number.isFinite(next) && next > start) end = next;
  // 小空隙 → 连到下一句开始，避免中间空一帧
  if (Number.isFinite(next) && next > end && next - end <= LINE_GAP_TOLERANCE) end = next;
  return end;
};

const createLyricResolver = () => {
  let lyricIndexCache = { key: '', entries: [] };

  const lyricIndexFor = (lines, songKey) => {
    const list = Array.isArray(lines) ? lines : [];
    const first = list[0];
    const last = list[list.length - 1];
    const key = [
      songKey,
      list.length,
      Number(first && first.startTime) || 0,
      Number(last && last.startTime) || 0,
      lyricLineText(first),
      lyricLineText(last),
    ].join('|');
    if (key === lyricIndexCache.key) return lyricIndexCache;

    const raw = [];
    for (const line of list) {
      const start = Number(line && line.startTime);
      if (Number.isFinite(start)) raw.push({ start, line });
    }
    // 正常情况下宿主已按时间排好；排序只在切歌/歌词更新时做一次，作为保险。
    raw.sort((a, b) => a.start - b.start);
    const entries = raw.map((item, index) => ({
      ...item,
      end: lineEndOf(item.line, raw[index + 1] && raw[index + 1].start),
    }));
    lyricIndexCache = { key, entries };
    return lyricIndexCache;
  };

  return (lines, position, songKey, duration) => {
    const index = lyricIndexFor(lines, songKey);
    if (index.entries.length === 0) {
      return { text: NO_LYRIC_TEXT, kind: 'none', translation: '', romanization: '', line: null };
    }

    const target = position + 0.001;
    const firstStart = index.entries[0].start;

    // 二分：最后一个 start <= target 的行
    let lo = 0;
    let hi = index.entries.length - 1;
    let currentIndex = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (index.entries[mid].start <= target) {
        currentIndex = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // 只有歌曲真正结束、或开头还没到第一句时才留空。
    if (Number.isFinite(duration) && duration > 0 && target >= duration - 0.5) {
      return { text: '', kind: 'ended', translation: '', romanization: '', line: null };
    }
    if (target < firstStart) return { text: '', kind: 'intro', translation: '', romanization: '', line: null };

    // 按“唱到哪句”显示：只要过了某句 startTime 就一直显示这句（不看句尾/间奏多长），
    // 直到下一句 start 到来。这样句间不会有一帧空白闪动。
    if (currentIndex >= 0) {
      const line = index.entries[currentIndex].line;
      const text = lyricLineText(line);
      if (text) {
        return {
          text,
          kind: 'lyric',
          translation: String(line.translation || '').trim(),
          romanization: String(line.romanization || '').trim(),
          line,
        };
      }
    }
    return { text: '', kind: 'interlude', translation: '', romanization: '', line: null };
  };
};

module.exports = { createLyricResolver, lyricLineText };
