// mods/Just-Enough-Setting/ui/diagnostics.mjs
// 实时诊断：歌曲 / 歌曲 ID / 歌词行数 / 播放进度 / 当前歌词，以及模组自己的运行状态。
//
// 面板里它是「歌词不显示时看这里」的那块信息；播放页上它还能作为一个 HUD 叠出来。
// 播放页 HUD 同时是宿主歌词时钟的探针挂载点：stage 层在场时，模组才能拿到与页面上完全一致的
// 歌词时钟与行号（见 lib/clock.mjs），所以这个 stage 层始终注册，HUD 只是决定画不画。
//
// 刷新策略：一行一个文本节点，2Hz 定时器只写内容真的变了的节点。没有 React、没有列表重建，
// 也不把连续时间写进任何状态；行号变化由 controller 的通知驱动，不走定时器。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const { describeFragments, lineTranslation, wordsRevealed } = await import(`../lib/compose.mjs${VERSION}`);
const { MOD_VERSION } = await import(`../lib/config.mjs${VERSION}`);
const { el, setText } = await import(`./dom.mjs${VERSION}`);
const { steamStateText, steamDetailText } = await import(`./steam-section.mjs${VERSION}`);

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const REFRESH_MS = 500;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** 行号按人读的第几行显示（从 1 起）；没有当前行时给一个破折号。内部索引仍是 0 基。 */
const lineNumber = (index) => (index >= 0 ? String(index + 1) : '—');

/** 一行：标签 + 值（+ 可选的次要行）。 */
const createRow = (label, { mono = true } = {}) => {
  const value = el('div', {
    fontFamily: mono ? MONO : 'inherit',
    fontSize: '11px',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
    textAlign: 'right',
  });
  const sub = el('div', { fontFamily: MONO, fontSize: '10px', opacity: '0.6', lineHeight: '1.4', textAlign: 'right' });
  const node = el('div', {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '10px',
    borderBottom: '1px solid rgba(127, 127, 127, 0.14)',
    paddingBottom: '3px',
  }, el('div', { fontSize: '11px', opacity: '0.62', flex: '0 0 auto', whiteSpace: 'nowrap' }, label), el('div', { display: 'flex', flexDirection: 'column', minWidth: '0' }, value, sub));
  return { node, value, sub };
};

/**
 * 诊断视图。`variant: 'hud'` 是播放页上的半透明浮层版本，两套只差容器样式。
 */
export const createDiagnosticsView = ({ controller, t, variant = 'panel' }) => {
  const isHud = variant === 'hud';
  const rows = {
    // 版本自报放最前面：这一行是「更新完看不到新功能」这类问题的第一分诊点——
    // 面板上显示的版本就是真正在跑的那一版代码，对照 mod.json 就能立刻分辨是旧模块还在跑，还是新代码没生效。
    modVersion: createRow(t('diag.modVersion')),
    song: createRow(t('diag.song'), { mono: false }),
    songId: createRow(t('diag.songId')),
    source: createRow(t('diag.source')),
    lines: createRow(t('diag.lines')),
    progress: createRow(t('diag.progress')),
    current: createRow(t('diag.current'), { mono: false }),
    words: createRow(t('diag.words')),
    clock: createRow(t('diag.clock')),
    hostLine: createRow(t('diag.hostLine')),
    smtc: createRow(t('diag.smtc'), { mono: false }),
    pageTitle: createRow(t('diag.pageTitle'), { mono: false }),
    // Steam 两行：连接状态（它到底连上没有）与当前推送的文本（Steam 上真的会显示成什么）。
    // 这两件事常常被混为一谈——「面板上写着在线但好友列表没变」和「压根没登录」是两种毛病。
    steam: createRow(t('diag.steam'), { mono: false }),
    steamText: createRow(t('diag.steamText'), { mono: false }),
    layout: createRow(t('diag.layout'), { mono: false }),
  };
  rows.layout.node.title = t('hint.spaceGlyph');

  const root = el('div', isHud
    ? {
      position: 'fixed',
      left: '12px',
      top: '12px',
      zIndex: '40',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
      width: 'min(340px, 40vw)',
      padding: '8px 10px',
      borderRadius: '10px',
      background: 'rgba(0, 0, 0, 0.62)',
      color: '#ffffff',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
      fontFamily: MONO,
      // 诊断层不该吃掉点击：播放页上的按钮照常可点。
      pointerEvents: 'none',
    }
    : {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    });

  const title = el('div', {
    fontSize: '10px',
    opacity: '0.5',
    letterSpacing: '0.06em',
    marginBottom: '2px',
  }, t('diag.title'));
  root.append(title);
  // HUD 只留排查歌词 / 编排真正需要的几行，避免糊住半个播放页。
  Object.entries(rows).forEach(([key, row]) => {
    if (isHud && (key === 'modVersion' || key === 'source' || key === 'pageTitle' || key === 'layout' || key === 'steam' || key === 'steamText')) return;
    root.append(row.node);
  });

  const repaint = () => {
    const snapshot = controller.getSnapshot();
    const { song, line } = snapshot;
    const options = snapshot.config.options;

    // 版本自报：面板上写的版本就是这一份代码的版本（见 lib/config.mjs 的 MOD_VERSION）。
    const host = snapshot.host ?? {};
    setText(rows.modVersion.value, MOD_VERSION);
    setText(rows.modVersion.sub, [
      host.folium ? `Folium ${host.folium.major}.${host.folium.minor}` : '',
      host.folia ? `Folia ${host.folia}` : '',
    ].filter(Boolean).join(' · '));

    setText(rows.song.value, song ? song.title : t('diag.noSong'));
    setText(rows.songId.value, song?.id ? String(song.id) : t('diag.none'));
    setText(rows.source.value, song?.source ? String(song.source) : t('diag.none'));
    setText(rows.lines.value, snapshot.lineCount > 0 ? String(snapshot.lineCount) : `${snapshot.lineCount} · ${t('diag.noLyrics')}`);

    const percent = snapshot.duration > 0 ? Math.round((snapshot.position / snapshot.duration) * 100) : null;
    setText(rows.progress.value, `${formatTime(snapshot.position)} / ${formatTime(snapshot.duration)}${percent === null ? '' : ` (${percent}%)`}`);

    if (line) {
      setText(rows.current.value, `#${lineNumber(snapshot.lineIndex)} ${line.fullText}`);
      // 与编排走同一份取译文规则，面板上「有没有翻译」和系统媒体收到的必然一致。
      setText(rows.current.sub, lineTranslation(line));
    } else {
      setText(rows.current.value, snapshot.lineCount > 0 ? t('diag.none') : t('diag.noLyrics'));
      setText(rows.current.sub, '');
    }

    // 逐词进度：编排里有「逐词歌词」片段时，这一行直接告诉你它现在能拿到几个词。
    if (snapshot.wordCount > 0) {
      setText(rows.words.value, `${snapshot.revealedWords} / ${snapshot.wordCount}`);
      setText(rows.words.sub, snapshot.revealedWords > 0 ? wordsRevealed(line, snapshot.lineTime) : '');
    } else {
      setText(rows.words.value, line ? t('diag.noWordTiming') : t('diag.none'));
      setText(rows.words.sub, '');
    }

    const offset = options.lyricSyncMode === 'manual' ? options.manualOffsetSeconds : options.autoBaselineSeconds;
    setText(
      rows.clock.value,
      `${snapshot.lineSource === 'host' ? t('diag.clockHost') : t('diag.clockEstimated')}  ${snapshot.lineTime.toFixed(2)}s  ${offset >= 0 ? '+' : ''}${offset.toFixed(2)}s`,
    );

    if (snapshot.stageAttached) {
      rows.hostLine.node.style.display = '';
      setText(rows.hostLine.value, `${lineNumber(snapshot.hostLineIndex)} / ${lineNumber(snapshot.lineIndex)}`);
    } else {
      // 不在播放页时没有宿主行号可比；把这一行收起来，别让人误以为行号是 0。
      rows.hostLine.node.style.display = 'none';
    }

    const composed = snapshot.composed;
    const smtcText = [composed.smtcTitle, composed.smtcArtist, composed.smtcAlbum].filter(Boolean).join('  |  ');
    // 没同意时这一行只是「编排会长成什么样」：系统媒体那边仍是宿主自己的三行。
    if (!snapshot.smtcAvailable) setText(rows.smtc.value, t('status.unavailable'));
    else setText(rows.smtc.value, smtcText || t('diag.idle'));
    setText(rows.smtc.sub, !snapshot.hostConsent
      ? t('consent.notTakenOverShort')
      : snapshot.smtcAvailable
        ? `${options.enabled ? t('status.enabled') : t('status.disabled')}${options.sendArtwork ? '' : ' · no artwork'}`
        : '');
    setText(rows.pageTitle.value, snapshot.hostConsent && options.pageTitleEnabled && composed.pageTitle
      ? composed.pageTitle
      : t('diag.idle'));

    // Steam：一个在 Electron 主进程里跑的长连接，渲染侧只看得到轮询回来的那份快照。
    // 「在线但好友列表没变」和「压根没登录」是两种毛病，所以状态与推送文本分成两行。
    const steam = snapshot.steam?.status ?? null;
    if (!options.steamEnabled) {
      setText(rows.steam.value, t('steam.detail.disabled'));
      setText(rows.steam.sub, '');
      setText(rows.steamText.value, t('diag.idle'));
      setText(rows.steamText.sub, '');
    } else {
      setText(rows.steam.value, steamStateText(steam, t));
      // 明细里的换行在诊断行里换成 ·（一行一行的排版在这里放不下）。
      setText(rows.steam.sub, steamDetailText(steam, t, true).replace(/\n/gu, ' · '));
      const reported = steam?.playing || steam?.pending || '';
      setText(rows.steamText.value, reported || t('diag.none'));
      setText(rows.steamText.sub, steam?.available === false
        ? t('steam.state.unavailable')
        : t('steam.detail.maxLength', { count: steam?.maxLength ?? 0 }));
    }

    // 标题栏的编排描述：空格在这里显示成 ␣，所以「加了连接符却没看出区别」一眼就能定位。
    setText(rows.layout.value, describeFragments(snapshot.config.layout.smtcTitle, (kind) => t(`fragment.${kind}`)) || t('diag.none'));
  };

  repaint();
  const timer = setInterval(() => {
    // 窗口不可见时不刷新：Electron 后台窗口的定时器照跑，没必要为看不见的面板干耗。
    if (document.hidden) return;
    repaint();
  }, REFRESH_MS);

  return {
    root,
    repaint,
    dispose() {
      clearInterval(timer);
    },
  };
};

/**
 * 注册成 stage 层用的挂载函数（需要 `stageLayers` 权限）。
 *
 * 无论 HUD 开没开，这个层都要挂上去：它是宿主歌词时钟的探针。HUD 开关只决定画不画那半透明浮层。
 * stage 上下文里没有 locale（FoliumStageContext 不带语言），所以文案从 `getTranslator()` 现取，
 * 由调用方按 `<html lang>` 造，语言换了下次挂载就跟着换。
 *
 * 预览和静态帧（设置里的试看、透明导出）里也有这个上下文，但那不是真的播放时钟——
 * 拿它去驱动系统媒体会把歌词钉在预览那一帧上。这种上下文只画浮层，不接探针。
 */
export const createDiagnosticsStageMount = ({ controller, getTranslator }) => (container, ctx) => {
  const live = ctx?.isPreview !== true && ctx?.staticMode !== true;
  if (live) controller.attachStageClock(ctx);

  let view = null;
  const sync = () => {
    const enabled = controller.getConfig().options.hudEnabled;
    if (enabled && !view) {
      view = createDiagnosticsView({ controller, t: getTranslator(), variant: 'hud' });
      container.append(view.root);
    } else if (!enabled && view) {
      view.dispose();
      view.root.remove();
      view = null;
    }
  };

  const off = controller.subscribe(sync);
  sync();

  return () => {
    off();
    view?.dispose();
    view?.root.remove();
    view = null;
    if (live) controller.detachStageClock();
  };
};
