// mods/Just-Enough-Setting/lib/controller.mjs
// 模组的运行时总装：把宿主事件、歌词时钟、媒体会话接管层、标签页标题串起来，对外只暴露一份状态与一组动作。
//
// 数据流是单向的：
//
//   宿主事件 / stage 探针 / 配置参数 ──→ state ──→ composed（五个目标的文本）──→ 系统媒体 + document.title
//                                             └──→ notify() ──→ 面板 / HUD 重画
//
// 系统媒体与窗口标题是**宿主自己的界面状态**，不是 Folium 给模组的接口（见 mods/README.md 与
// 市场审查）。所以这两条输出全部挂在一次性的用户同意上（lib/consent.mjs）：
//   - 没同意：不装拦截、不写 document.title，连读都只读宿主发布过的值；
//   - 同意后：装拦截、按编排改写；撤销的那一刻把原型方法、宿主三行和标题一起还原。
// 同意记在本机，不进配置导出，也不会被别人导入的配置顶替。
//
// 只有「离散变化」（换歌、换行、改配置、播放状态、跳转）会走到 notify：歌词时钟自己做了边界去重，
// 进度条那种连续变化由诊断面板的低频 ticker 自己读快照，不进入这条通路。
//
// 两个例外都有明确开关（见 syncClockModes）：
//   - 编排里有「逐词歌词」片段 → 歌词时钟启用词边界排期（clock.setWordPrecision）；
//   - 编排里有「播放时长」片段 → 起一个 1Hz 的 ticker 重算进度条，文本没变就不会重发（见 outputSignature）。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const {
  readConfig, toParamPatch, offsetSeconds, normalizeLayout, serializeConfig, parseConfig,
  OPTION_DEFAULTS, DEFAULT_LAYOUT, findPreset, LAYOUT_TARGETS,
} = await import(`./config.mjs${VERSION}`);
const { composeAll, hasSmtcContent, hasText } = await import(`./compose.mjs${VERSION}`);
const { createLyricClock } = await import(`./clock.mjs${VERSION}`);
const { createMediaSessionBridge } = await import(`./media-session.mjs${VERSION}`);
const { createSteamBridge } = await import(`./steam-bridge.mjs${VERSION}`);
const { readHostConsent, writeHostConsent } = await import(`./consent.mjs${VERSION}`);

/** 秒 → `m:ss`。 */
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** 进度条片段的刷新间隔。1 秒够用：m:ss 秒针就是 1 秒一格，进度条格子只会更慢。 */
const PROGRESS_TICK_MS = 1000;

export const createController = ({ folium, settings, log }) => {
  const listeners = new Set();
  const media = createMediaSessionBridge({ log });
  // 系统媒体是被「拦截改写」的（宿主自己会发），Steam 是要「主动发出去」的（走 main 入口）。
  const steam = createSteamBridge({ folium, log });

  /** 宿主版本，只给诊断面板看。宿主信息拿不到时退化成空值，不影响任何功能。 */
  const readHostInfo = () => {
    try {
      return { folium: folium.host?.folium ?? null, folia: folium.host?.folia ?? null };
    } catch {
      return { folium: null, folia: null };
    }
  };

  const originalTitle = document.title;
  /** 用户是否同意接管宿主界面。没同意时下面所有写宿主的分支都不走（见 syncHostSurface）。 */
  let hostConsent = readHostConsent();
  /** 标题现在是不是模组写的：只有写过才在撤销 / 停用时还原，免得把宿主自己的标题改掉。 */
  let titleOwned = false;
  let started = false;
  let notifyHandle = null;
  let progressTimer = null;
  /** 用刷新令牌恢复会话只做一次；之后的重连由 main 侧的 autoRelogin 负责。 */
  let steamRestoreRequested = false;
  /** 上一次真正发出去的文本 + 开关：进度条拖动会高频触发同步，内容没变就不该打扰系统。 */
  let outputSignature = null;

  const state = {
    song: null,
    lines: [],
    playbackState: 'stopped',
    position: 0,
    duration: 0,
    line: { index: -1, line: null, time: 0, source: 'estimated', hostIndex: -1, lineCount: 0, revealedWords: 0, wordCount: 0 },
    composed: { smtcTitle: '', smtcArtist: '', smtcAlbum: '', pageTitle: '', steamText: '' },
    config: { layout: normalizeLayout(null), options: { ...OPTION_DEFAULTS } },
    smtcAvailable: media.available,
    smtcApplied: false,
    stageAttached: false,
  };

  const notify = () => {
    if (notifyHandle !== null) return;
    notifyHandle = setTimeout(() => {
      notifyHandle = null;
      listeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          log?.error?.('panel listener failed', error);
        }
      });
    }, 0);
  };

  const readPlayback = () => {
    try {
      return folium.playback?.getState?.() ?? null;
    } catch (error) {
      log?.warn?.('playback state unavailable', error);
      return null;
    }
  };

  const refreshPlayback = () => {
    const playback = readPlayback();
    if (!playback) return;
    state.song = playback.song ?? state.song;
    state.playbackState = playback.state ?? 'stopped';
    state.position = Number.isFinite(playback.position) ? playback.position : 0;
    state.duration = Number.isFinite(playback.duration) ? playback.duration : 0;
  };

  const readSettings = () => {
    let values = {};
    try {
      values = settings.get() ?? {};
    } catch (error) {
      log?.warn?.('could not read the mod settings', error);
    }
    return readConfig(values);
  };

  /** 编排里用到某个片段类型没有。 */
  const layoutUses = (kind) => LAYOUT_TARGETS.some((target) => (state.config.layout[target] ?? [])
    .some((fragment) => fragment && fragment.kind === kind));

  /**
   * 同意状态 → 是否真的接管宿主的那两处界面。
   * 同意：装上 MediaSession 的拦截；撤销：把原型方法、宿主发布过的三行和标题一起还原。
   * 没同意时这里全程是「不碰」——连 detach 都只是把已经装上的东西拆掉。
   */
  const syncHostSurface = () => {
    if (hostConsent) {
      if (media.available) state.smtcApplied = media.install();
      return;
    }
    media.detach();
    state.smtcApplied = false;
    if (titleOwned) {
      document.title = originalTitle;
      titleOwned = false;
    }
  };

  /** 窗口标题：只有同意之后才写；开关关掉或编排为空时还原，而且只还原自己写过的那次。 */
  const syncTitle = (composed, options) => {
    if (!hostConsent) return;
    const wanted = options.enabled && options.pageTitleEnabled && hasText(composed.pageTitle)
      ? composed.pageTitle
      : '';
    if (wanted) {
      if (document.title !== wanted) document.title = wanted;
      titleOwned = true;
      return;
    }
    if (titleOwned) {
      document.title = originalTitle;
      titleOwned = false;
    }
  };

  /** 编排与选项 → 系统媒体 + 标签页标题。内容没变时跳过，避免重复打扰系统。 */
  const syncOutputs = () => {
    const composed = composeAll(state.config.layout, {
      song: state.song,
      line: state.line.line,
      // 逐词歌词按歌词时钟（含用户偏移）推进；播放时长按真实播放进度。
      wordTime: state.line.time,
      position: state.position,
      duration: state.duration,
    });
    state.composed = composed;

    const active = hasSmtcContent(composed);
    // steamText 也进签名：它和系统媒体读的是同一份编排，但发往两个完全不同的地方。
    // steamEnabled 一起进来，是为了让"关掉开关"这一刻也走一次，好把 Steam 上的状态清掉。
    const signature = [
      composed.smtcTitle,
      composed.smtcArtist,
      composed.smtcAlbum,
      composed.pageTitle,
      composed.steamText,
      String(state.config.options.enabled),
      String(state.config.options.sendArtwork),
      String(state.config.options.pageTitleEnabled),
      String(state.config.options.steamEnabled),
      String(active),
    ].join('\u0000');

    if (signature !== outputSignature) {
      outputSignature = signature;
      state.smtcApplied = media.publish({
        composed,
        active,
        isEnabled: state.config.options.enabled,
        wantsArtwork: state.config.options.sendArtwork,
      });
      // 标签页标题是宿主自己的状态（不是「容器以外的宿主 DOM」，而是这个页面的标题本身），
      // 和系统媒体一样只有用户同意之后才写；没同意时 syncTitle 一次都不碰。
      syncTitle(composed, state.config.options);

      // Steam：关掉开关时推空串，让 main 侧把"正在玩"清掉，不留一个停在上一首歌的状态。
      steam.publish(state.config.options.steamEnabled ? composed.steamText : '');
    }

    notify();
  };

  const clock = createLyricClock({
    folium,
    log,
    getOffsetSeconds: () => offsetSeconds(state.config.options),
    onLineChange: (next) => {
      state.line = next;
      syncOutputs();
    },
  });

  /**
   * 进度条片段的秒针：重读播放进度再拼一次；文本没变时 syncOutputs 自己会跳过，
   * 所以这里 1Hz 空转的代价只是算一遍字符串。暂停时不空转——位置不会动，醒了也白醒。
   */
  const tickProgress = () => {
    if (document.hidden || state.playbackState !== 'playing') return;
    refreshPlayback();
    syncOutputs();
  };

  /**
   * 编排里有没有「逐词歌词」/「播放时长」片段：决定歌词时钟要不要词精度、要不要起进度 ticker。
   * 不用这两个片段的人走的是和以前完全一样的老路。
   */
  const syncClockModes = () => {
    clock.setWordPrecision(layoutUses('word'));
    const wantsProgress = layoutUses('progress');
    if (wantsProgress && progressTimer === null) {
      progressTimer = setInterval(tickProgress, PROGRESS_TICK_MS);
    } else if (!wantsProgress && progressTimer !== null) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  };

  const upsertConfig = (patch) => {
    try {
      settings.set(patch);
    } catch (error) {
      log?.error?.('could not write the mod settings', error);
      return false;
    }
    state.config = readSettings();
    // 延迟偏移变了要重排下一行的时间点；编排变了只需要重发文本。
    clock.poke();
    syncClockModes();
    syncSteamEnabled();
    syncOutputs();
    return true;
  };

  /**
   * Steam 开关：打开时开始轮询、并用刷新令牌恢复一次会话；关掉时停止轮询。
   * 「把 Steam 上的状态清掉」那一步在 syncOutputs 里 —— 只有它拿得到编排结果。
   */
  const syncSteamEnabled = () => {
    if (state.config.options.steamEnabled) {
      if (!steamRestoreRequested) {
        steamRestoreRequested = true;
        void steam.restore();
      }
      steam.start();
    } else {
      steam.stop();
    }
  };

  const handleSongChanged = (event) => {
    state.song = event?.song ?? null;
    // 上一首的歌词不能留着：宁可先空一拍，也不要让系统媒体显示串台的歌词。
    state.lines = [];
    clock.setLines([]);
    refreshPlayback();
    clock.poke();
    syncOutputs();
  };

  const handleLyricsLoaded = (event) => {
    state.lines = Array.isArray(event?.lines) ? event.lines : [];
    if (event?.song) state.song = event.song;
    clock.setLines(state.lines);
    refreshPlayback();
    syncOutputs();
  };

  const handlePlaybackChanged = () => {
    refreshPlayback();
    clock.poke();
    syncOutputs();
  };

  const subscriptions = [];

  return {
    /** 装上接管层、订阅宿主事件、推一次初始状态。 */
    start() {
      if (started) return;
      started = true;
      state.config = readSettings();
      syncClockModes();
      syncSteamEnabled();
      // 只有用户同意过才装拦截；没同意时这里什么都不做，宿主的三行和标题原样不动。
      syncHostSurface();
      if (hostConsent && !media.available) {
        log?.warn?.('no Media Session API in this environment; only the tab title can be customized');
      }
      refreshPlayback();
      subscriptions.push(
        folium.events.on('playback.songChanged', handleSongChanged),
        folium.events.on('lyrics.loaded', handleLyricsLoaded),
        folium.events.on('playback.stateChanged', handlePlaybackChanged),
        folium.events.on('playback.seeked', handlePlaybackChanged),
        settings.onChange(() => {
          state.config = readSettings();
          clock.poke();
          syncClockModes();
          syncSteamEnabled();
          syncOutputs();
        }),
        // Steam 的连接状态在 main 侧，这里只能等轮询拿回来；拿到了就让面板重画。
        steam.subscribe(() => notify()),
      );
      syncOutputs();
    },

    dispose() {
      subscriptions.splice(0).forEach((off) => {
        try {
          off();
        } catch (error) {
          log?.warn?.('could not unsubscribe', error);
        }
      });
      if (progressTimer !== null) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
      clock.dispose();
      media.dispose();
      steam.dispose();
      // 只还原自己写过的标题：没写过就别去碰宿主当前的值。
      if (titleOwned) {
        document.title = originalTitle;
        titleOwned = false;
      }
      if (notifyHandle !== null) {
        clearTimeout(notifyHandle);
        notifyHandle = null;
      }
      listeners.clear();
      started = false;
    },

    // ---- 接管同意（系统媒体三行 + 窗口标题）

    /** 用户是否已经同意模组接管宿主界面。 */
    getHostConsent() {
      return hostConsent;
    },

    /**
     * 记下用户的选择并立刻生效：同意 → 装拦截、开始改写；撤销 → 原型方法、宿主三行与标题一起还原。
     * 返回 false 表示本机存不下（隐私模式、存储被禁用），这次只在当前会话里生效。
     */
    setHostConsent(granted) {
      const next = Boolean(granted);
      const stored = next === hostConsent ? true : writeHostConsent(next);
      hostConsent = next;
      // 同意状态变了 = 输出对象变了：清掉去重签名，让 syncOutputs 无条件再发一次。
      outputSignature = null;
      syncHostSurface();
      syncOutputs();
      notify();
      return stored;
    },

    // ---- 舞台探针（同时是播放页 HUD 的挂载点）
    attachStageClock(context) {
      state.stageAttached = true;
      clock.attachStage(context);
      notify();
    },

    detachStageClock() {
      state.stageAttached = false;
      clock.detachStage();
      notify();
    },

    // ---- 配置读写
    getConfig() {
      return { layout: state.config.layout, options: { ...state.config.options } };
    },

    /** 单个选项：`settings.set` 会校验并落盘，随后 settings.onChange 会把配置重新读回来。 */
    setOption(key, value) {
      return upsertConfig({ [key]: value });
    },

    setLayout(layout) {
      return upsertConfig(toParamPatch({ layout, options: state.config.options }));
    },

    applyPreset(id) {
      const preset = findPreset(id);
      if (!preset) return false;
      return upsertConfig(toParamPatch({
        layout: preset.layout,
        options: { ...state.config.options, ...preset.options },
      }));
    },

    resetConfig() {
      return upsertConfig(toParamPatch({ layout: DEFAULT_LAYOUT, options: OPTION_DEFAULTS }));
    },

    /** 导出：当前完整配置的 JSON 文本。 */
    getConfigText() {
      return serializeConfig(this.getConfig());
    },

    /** 导入：抛错表示内容不是可用的配置，调用方负责提示。 */
    importConfigText(source) {
      const parsed = parseConfig(source);
      return upsertConfig(toParamPatch({
        layout: parsed.layout,
        // 只带编排的裸对象导入时保留用户现在的选项，不悄悄重置。
        options: parsed.options ? { ...state.config.options, ...parsed.options } : state.config.options,
      }));
    },

    // ---- Steam
    //
    // 这一组动作都要过网络，全是异步的；调用方不用自己的返回值判断结果，轮询会把
    // main 侧的连接状态带回来（bridge 取到新状态就会让面板重画）。
    getSteamSnapshot() {
      return steam.getSnapshot();
    },

    steamLogin(details) {
      return steam.login(details);
    },

    steamSubmitGuard(code) {
      return steam.submitGuard(code);
    },

    steamLogout() {
      return steam.logout();
    },

    steamForget() {
      return steam.forget();
    },

    // ---- 只读快照
    getSnapshot() {
      const peek = clock.peek();
      return {
        song: state.song,
        lines: state.lines,
        lineIndex: peek.index,
        line: peek.line,
        lineTime: peek.time,
        lineSource: peek.source,
        hostLineIndex: peek.hostIndex,
        lineCount: peek.lineCount,
        revealedWords: peek.revealedWords,
        wordCount: peek.wordCount,
        playbackState: state.playbackState,
        position: state.position,
        duration: state.duration,
        composed: state.composed,
        config: this.getConfig(),
        smtcAvailable: state.smtcAvailable,
        smtcApplied: state.smtcApplied,
        hostConsent,
        media: media.describe(),
        stageAttached: state.stageAttached,
        // Steam 在 main 侧，这里给的是最近一次轮询到的状态快照。
        steam: steam.getSnapshot(),
        // 版本自报：诊断面板用它回答「加载进来的到底是哪一版」。
        host: readHostInfo(),
      };
    },

    /**
     * 面板预览用：片段真正读得到的那几样东西。字段与 syncOutputs 的 context 一致——
     * 预览和系统媒体共用同一条拼接规则、同一份取词逻辑，只有「读的是哪一瞬的时间」
     * 差着不到一帧（预览取当下，系统媒体取最后一次通知的时刻）。
     */
    getContext() {
      const peek = clock.peek();
      return {
        song: state.song,
        line: peek.line,
        wordTime: peek.time,
        position: state.position,
        duration: state.duration,
      };
    },

    /** 命令面板里的单行状态摘要。 */
    describeStatus() {
      const snapshot = this.getSnapshot();
      const song = snapshot.song;
      const songText = song ? `${song.title}${song.artist ? ` — ${song.artist}` : ''}` : 'no song';
      const progress = snapshot.duration > 0
        ? `${formatTime(snapshot.position)}/${formatTime(snapshot.duration)}`
        : formatTime(snapshot.position);
      const lyric = snapshot.line ? snapshot.line.fullText : '—';
      return `${songText} · ${snapshot.lineCount} lines · ${progress} · ${lyric}`;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    formatTime,
  };
};
