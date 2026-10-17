/**
 * Folia · Folium mod — Auto skip
 *
 * 目标：Folia 0.7.20 起 / Folium 1.5 起（需要 playback.failed 事件）。
 *
 * ---------------------------------------------------------------------------
 * 一、原版做什么
 * ---------------------------------------------------------------------------
 * 0.7.20 起 Folia 自带「无法播放时自动跳过」（默认关闭，选项 → 播放控制 →
 * 播放队列）。打开后它会倒计时跳过一批受限、无法播放的歌曲。
 *
 * 有两类按设计永远不跳：需要登录，以及网络问题。遇到这两类时提示卡会一直停在
 * 屏幕上等人点。
 *
 * ---------------------------------------------------------------------------
 * 二、本模组做什么
 * ---------------------------------------------------------------------------
 * 只订阅宿主公开的 playback.failed 事件，按事件的 reason 分两类：
 *
 *   auth / network                      → 需要打开「登录 / 网络类也跳过」
 *   restricted / taken-down / unknown   → 默认跳过
 *
 * 三条克制规则：
 *
 *   · 宿主已经在倒计时（willAutoSkip 为 true）时完全不插手，避免重复跳歌；
 *   · 启动恢复上次会话时的失败（phase 为 restore）不跳，宿主自己也不跳；
 *   · 跳过动作只调用 playback.next()，不读取也不修改宿主界面。
 *
 * 后两条也是本模组相对原版设置的独有价值：原版设置关掉时它照样接住无法播放的
 * 歌曲并立即跳，而不用等倒计时。
 *
 * ---------------------------------------------------------------------------
 * 三、为什么不用 DOM
 * ---------------------------------------------------------------------------
 * 宿主的提示卡不是公开接口，按钮上的回调也不是。规范要求模组只操作自己的容器，
 * 所以本模组不查询宿主 DOM、不注入样式、不观察 body，也不依赖任何宿主内部符号。
 *
 * 本文件不 import 任何东西：模块从 folia-mod:// 协议加载。
 */

/** 日志前缀。宿主自己会再加一层 [Folium:<modId>]。 */
const LOG_PREFIX = '[auto-skip] ';

/** 设置项的默认值，同时也是唯一的一份「键清单」。 */
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  skipUnplayable: true,
  skipAuthNetwork: false,
  delayMs: 250,
  maxSkipsPerMinute: 8,
  /**
   * 连续跳过上限。默认 3：既不无限连跳，也比宿主自带的 2 宽松一点。
   * 设为 0 表示不限。
   */
  maxConsecutiveSkips: 3,
});

/** 宿主公开 reason 里属于「无法播放」的一类。 */
const UNPLAYABLE_REASONS = Object.freeze(['restricted', 'taken-down', 'unknown']);

/** 宿主公开 reason 里原版永不跳过的一类。 */
const AUTH_NETWORK_REASONS = Object.freeze(['auth', 'network']);

const RATE_WINDOW_MS = 60000;
/** 撞上限流后的退避时间。 */
const RATE_LIMIT_BACKOFF_MS = 5000;
/** 同一类告警最多每 30 秒说一次。 */
const WARN_COOLDOWN_MS = 30000;

/* ---- 纯函数 -------------------------------------------------------------- */

/** 折叠空白并去首尾空格。 */
function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * 歌曲的稳定标识。
 * 宿主给的 ref 是会话内有效的不透明句柄，比 id 更可靠；都没有时退回标题。
 */
function songKey(song) {
  if (!song || typeof song !== 'object') return '';
  if (typeof song.ref === 'string' && song.ref) return 'r:' + song.ref;
  if (song.id !== null && song.id !== undefined && String(song.id)) return 'i:' + String(song.id);
  const title = normalizeText(song.title);
  const artist = normalizeText(song.artist);
  if (title) return 't:' + title + '|' + artist;
  return '';
}

/** 按宿主语言给模组自己的文案挑一套。 */
function detectLocale() {
  let raw = '';
  try {
    if (typeof navigator !== 'undefined' && navigator && navigator.language) {
      raw = String(navigator.language);
    }
  } catch (err) {
    /* 拿不到就用默认 */
  }
  const lower = raw.toLowerCase();
  if (lower.indexOf('zh') === 0) return 'zh-CN';
  if (lower.indexOf('id') === 0) return 'id';
  return 'en';
}

export const __internals = Object.freeze({
  LOG_PREFIX,
  DEFAULT_SETTINGS,
  UNPLAYABLE_REASONS,
  AUTH_NETWORK_REASONS,
  RATE_WINDOW_MS,
  RATE_LIMIT_BACKOFF_MS,
  WARN_COOLDOWN_MS,
  normalizeText,
  songKey,
  detectLocale,
});

/* ---- 三语文案 ------------------------------------------------------------ */

const TEXT = Object.freeze({
  'zh-CN': {
    sectionLabel: '自动跳过',
    sectionDesc:
      '补上原版不跳的登录 / 网络类失败，并在原版设置关闭时接住无法播放的歌曲。',
    gSkip: '跳过范围',
    gSafety: '安全阀',
    enabled: '启用自动跳过',
    enabledDesc: '总开关。关闭后本模组不介入任何播放失败。',
    skipUnplayable: '跳过无法播放的歌曲',
    skipUnplayableDesc:
      '受限、已下架，以及原因不明无法播放的歌曲。原版设置关闭时由本模组接住。',
    skipAuthNetwork: '登录 / 网络类也跳过',
    skipAuthNetworkDesc:
      '原版对「需要登录」和网络问题按设计永不跳过。打开后本模组接手这两类。' +
      '网络抖动时可能会跳过本来能放的歌。',
    delayMs: '跳过前延迟（毫秒）',
    delayMsDesc: '收到失败到调用下一首之间的等待，用来避免极端情况下连跳。',
    maxSkipsPerMinute: '每分钟最多跳过（首）',
    maxSkipsPerMinuteDesc: '一分钟内跳过达到这个数量后暂停，直到窗口滑过去。',
    maxConsecutiveSkips: '连续跳过上限（首）',
    maxConsecutiveSkipsDesc: '连续跳过这么多首后停下，避免整张列表被跳过。0 表示不限。',
    started: '已启用（Folia {folia} / Folium {major}.{minor}，上下文 {context}）',
    unsupported: '宿主 Folium 版本过低（需要 1.5 起才有 playback.failed），本模组不启用。',
    skipped: '已跳过：{reason}',
    skipFailed: '跳过失败：{reason}',
    skipAborted: '歌曲已换，取消这次跳过',
    rateLimited: '一分钟内已跳过 {count} 首，暂停自动跳过以避免无限连跳',
    capReached: '已达连续跳过上限（{max}），暂停自动跳过',
    recovery: '已恢复播放，连续跳过计数归零',
    dispose: '已停用',
  },
  en: {
    sectionLabel: 'Auto skip',
    sectionDesc:
      "Covers the sign-in and network failures the stock behaviour never skips, and picks up unplayable songs when the stock setting is off.",
    gSkip: 'What to skip',
    gSafety: 'Safety limits',
    enabled: 'Enable auto-skip',
    enabledDesc: 'Master switch. Off means the mod never acts on a playback failure.',
    skipUnplayable: 'Skip unplayable songs',
    skipUnplayableDesc:
      'Restricted, taken down, or failed for an unknown reason. Picked up by this mod when the stock setting is off.',
    skipAuthNetwork: 'Also skip sign-in / network',
    skipAuthNetworkDesc:
      'The stock behaviour never skips "sign in required" or network problems. When on, this mod takes those over. On a flaky network it may skip songs that would have played.',
    delayMs: 'Delay before skipping (ms)',
    delayMsDesc: 'How long to wait between the failure and advancing the queue.',
    maxSkipsPerMinute: 'Max skips per minute',
    maxSkipsPerMinuteDesc: 'Stop skipping once this many happened within a minute.',
    maxConsecutiveSkips: 'Max consecutive skips',
    maxConsecutiveSkipsDesc:
      'Stop after this many skips in a row, so a whole queue is never blown through. 0 means no limit.',
    started: 'enabled (Folia {folia} / Folium {major}.{minor}, context {context})',
    unsupported:
      'Host Folium is too old (playback.failed needs 1.5); the mod stays idle.',
    skipped: 'skipped: {reason}',
    skipFailed: 'could not skip: {reason}',
    skipAborted: 'song changed, dropping the queued skip',
    rateLimited: 'already skipped {count} songs this minute, pausing auto-skip',
    capReached: 'consecutive skip limit reached ({max}), pausing auto-skip',
    recovery: 'playback recovered, consecutive skip count reset',
    dispose: 'disabled',
  },
  id: {
    sectionLabel: 'Lewati otomatis',
    sectionDesc:
      'Menangani kegagalan login dan jaringan yang tidak pernah dilewati bawaan, serta lagu yang tidak dapat diputar saat pengaturan bawaan mati.',
    gSkip: 'Yang dilewati',
    gSafety: 'Batas aman',
    enabled: 'Aktifkan lewati otomatis',
    enabledDesc: 'Saklar utama. Jika mati, mod tidak menangani kegagalan apa pun.',
    skipUnplayable: 'Lewati lagu yang tidak dapat diputar',
    skipUnplayableDesc:
      'Terbatas, sudah dihapus, atau gagal karena alasan tidak diketahui.',
    skipAuthNetwork: 'Lewati juga login / jaringan',
    skipAuthNetworkDesc:
      'Bawaan tidak pernah melewati "perlu login" atau masalah jaringan. Jika aktif, mod ini mengambil alih keduanya.',
    delayMs: 'Jeda sebelum melewati (ms)',
    delayMsDesc: 'Lama menunggu antara kegagalan dan lanjut ke lagu berikutnya.',
    maxSkipsPerMinute: 'Maksimum lewati per menit',
    maxSkipsPerMinuteDesc: 'Berhenti melewati setelah sebanyak ini dalam satu menit.',
    maxConsecutiveSkips: 'Batas lewati berturut-turut',
    maxConsecutiveSkipsDesc:
      'Berhenti setelah sebanyak ini berturut-turut. 0 berarti tanpa batas.',
    started: 'aktif (Folia {folia} / Folium {major}.{minor}, konteks {context})',
    unsupported: 'Folium host terlalu lama (butuh 1.5); mod tidak aktif.',
    skipped: 'dilewati: {reason}',
    skipFailed: 'gagal melewati: {reason}',
    skipAborted: 'lagu berganti, melewati yang tertunda dibatalkan',
    rateLimited: 'sudah melewati {count} lagu semenit ini, jeda sementara',
    capReached: 'batas berturut-turut tercapai ({max}), jeda sementara',
    recovery: 'pemutaran pulih, hitungan dilewati direset',
    dispose: 'dinonaktifkan',
  },
});

/** 把 {name} 占位符替换掉。 */
function format(template, values) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, function (whole, name) {
    const v = values ? values[name] : undefined;
    return v === undefined || v === null ? whole : String(v);
  });
}

/* ---- 入口 ---------------------------------------------------------------- */

/**
 * 模组入口。宿主在停用本模组时会调用返回的 dispose。
 */
export default function activate(folium) {
  const locale = detectLocale();
  const T = TEXT[locale] || TEXT.en;

  function say(level, message) {
    try {
      if (folium && folium.log && typeof folium.log[level] === 'function') {
        folium.log[level](LOG_PREFIX + message);
      }
    } catch (err) {
      /* 日志绝不能影响跳过 */
    }
  }
  function info(message) {
    say('info', message);
  }
  function warn(message) {
    say('warn', message);
  }
  function fail(message, err) {
    say('error', err ? message + ' — ' + (err && err.message ? err.message : String(err)) : message);
  }

  /* ---- 能力检测 ---------------------------------------------------------- */

  let hostFolium = null;
  try {
    hostFolium = folium && folium.host ? folium.host.folium : null;
  } catch (err) {
    hostFolium = null;
  }
  const major = hostFolium && Number(hostFolium.major);
  const minor = hostFolium && Number(hostFolium.minor);
  const supported =
    Number.isFinite(major) &&
    Number.isFinite(minor) &&
    (major > 1 || (major === 1 && minor >= 5));

  if (!supported) {
    warn(T.unsupported);
    return function dispose() {};
  }

  /* ---- 设置 -------------------------------------------------------------- */

  const GROUPS = Object.freeze({
    skip: { 'zh-CN': T.gSkip, en: T.gSkip, id: T.gSkip },
    safety: { 'zh-CN': T.gSafety, en: T.gSafety, id: T.gSafety },
  });

  let params = null;
  try {
    if (folium && folium.registries && folium.registries.settingsSections) {
      const handle = folium.registries.settingsSections.register({
        id: 'settings',
        label: { 'zh-CN': T.sectionLabel, en: T.sectionLabel, id: T.sectionLabel },
        description: { 'zh-CN': T.sectionDesc, en: T.sectionDesc, id: T.sectionDesc },
        settings: [
          {
            key: 'enabled',
            type: 'boolean',
            label: { 'zh-CN': T.enabled, en: T.enabled, id: T.enabled },
            description: { 'zh-CN': T.enabledDesc, en: T.enabledDesc, id: T.enabledDesc },
            group: GROUPS.skip,
            defaultValue: DEFAULT_SETTINGS.enabled,
          },
          {
            key: 'skipUnplayable',
            type: 'boolean',
            label: { 'zh-CN': T.skipUnplayable, en: T.skipUnplayable, id: T.skipUnplayable },
            description: {
              'zh-CN': T.skipUnplayableDesc,
              en: T.skipUnplayableDesc,
              id: T.skipUnplayableDesc,
            },
            group: GROUPS.skip,
            defaultValue: DEFAULT_SETTINGS.skipUnplayable,
          },
          {
            key: 'skipAuthNetwork',
            type: 'boolean',
            label: { 'zh-CN': T.skipAuthNetwork, en: T.skipAuthNetwork, id: T.skipAuthNetwork },
            description: {
              'zh-CN': T.skipAuthNetworkDesc,
              en: T.skipAuthNetworkDesc,
              id: T.skipAuthNetworkDesc,
            },
            group: GROUPS.skip,
            defaultValue: DEFAULT_SETTINGS.skipAuthNetwork,
          },
          {
            key: 'delayMs',
            type: 'number',
            label: { 'zh-CN': T.delayMs, en: T.delayMs, id: T.delayMs },
            description: { 'zh-CN': T.delayMsDesc, en: T.delayMsDesc, id: T.delayMsDesc },
            group: GROUPS.safety,
            min: 0,
            max: 5000,
            step: 50,
            defaultValue: DEFAULT_SETTINGS.delayMs,
          },
          {
            key: 'maxSkipsPerMinute',
            type: 'number',
            label: {
              'zh-CN': T.maxSkipsPerMinute,
              en: T.maxSkipsPerMinute,
              id: T.maxSkipsPerMinute,
            },
            description: {
              'zh-CN': T.maxSkipsPerMinuteDesc,
              en: T.maxSkipsPerMinuteDesc,
              id: T.maxSkipsPerMinuteDesc,
            },
            group: GROUPS.safety,
            min: 1,
            max: 60,
            step: 1,
            defaultValue: DEFAULT_SETTINGS.maxSkipsPerMinute,
          },
          {
            key: 'maxConsecutiveSkips',
            type: 'number',
            label: {
              'zh-CN': T.maxConsecutiveSkips,
              en: T.maxConsecutiveSkips,
              id: T.maxConsecutiveSkips,
            },
            description: {
              'zh-CN': T.maxConsecutiveSkipsDesc,
              en: T.maxConsecutiveSkipsDesc,
              id: T.maxConsecutiveSkipsDesc,
            },
            group: GROUPS.safety,
            min: 0,
            max: 50,
            step: 1,
            defaultValue: DEFAULT_SETTINGS.maxConsecutiveSkips,
          },
        ],
      });
      params = handle && handle.params ? handle.params : null;
    }
  } catch (err) {
    fail('注册设置区块失败（不影响自动跳过）', err);
  }

  function readSettings() {
    const out = {};
    const keys = Object.keys(DEFAULT_SETTINGS);
    for (let i = 0; i < keys.length; i += 1) out[keys[i]] = DEFAULT_SETTINGS[keys[i]];
    if (!params) return out;
    try {
      const v = params.get();
      if (!v || typeof v !== 'object') return out;
      if (typeof v.enabled === 'boolean') out.enabled = v.enabled;
      if (typeof v.skipUnplayable === 'boolean') out.skipUnplayable = v.skipUnplayable;
      if (typeof v.skipAuthNetwork === 'boolean') out.skipAuthNetwork = v.skipAuthNetwork;
      if (typeof v.delayMs === 'number' && Number.isFinite(v.delayMs)) {
        out.delayMs = Math.max(0, Math.min(5000, v.delayMs));
      }
      if (typeof v.maxSkipsPerMinute === 'number' && Number.isFinite(v.maxSkipsPerMinute)) {
        out.maxSkipsPerMinute = Math.max(1, Math.min(60, v.maxSkipsPerMinute));
      }
      if (
        typeof v.maxConsecutiveSkips === 'number' &&
        Number.isFinite(v.maxConsecutiveSkips)
      ) {
        out.maxConsecutiveSkips = Math.max(0, Math.min(50, v.maxConsecutiveSkips));
      }
    } catch (err) {
      /* 读不到就用默认值 */
    }
    return out;
  }

  /* ---- 运行时状态 -------------------------------------------------------- */

  /** 最近跳过的时刻，用来算每分钟上限。 */
  let recentSkips = [];
  /** 连续自动跳过计数；下一次真正播起来时归零。 */
  let consecutiveSkips = 0;
  /** 已经为哪首歌排过队，防止同一首歌被排两次。 */
  let plannedSkipFor = null;
  /** 被安全阀拦下时的退避截止时刻。 */
  let pendingUntil = 0;
  let pendingSkipTimer = null;
  let lastWarnAt = 0;
  let disposed = false;
  let skipsDone = 0;

  function pruneSkips() {
    const cutoff = Date.now() - RATE_WINDOW_MS;
    const kept = [];
    for (let i = 0; i < recentSkips.length; i += 1) {
      if (recentSkips[i] >= cutoff) kept.push(recentSkips[i]);
    }
    recentSkips = kept;
  }

  function rateLimited(s) {
    pruneSkips();
    return recentSkips.length >= s.maxSkipsPerMinute;
  }

  function capReached(s) {
    return s.maxConsecutiveSkips > 0 && consecutiveSkips >= s.maxConsecutiveSkips;
  }

  function noteSkip() {
    recentSkips.push(Date.now());
    consecutiveSkips += 1;
    skipsDone += 1;
  }

  /** 同一类告警最多每 WARN_COOLDOWN_MS 说一次，免得刷屏。 */
  function warnThrottled(message) {
    const now = Date.now();
    if (now - lastWarnAt < WARN_COOLDOWN_MS) return;
    lastWarnAt = now;
    warn(message);
  }

  function currentSongKey() {
    try {
      if (!folium || !folium.playback || typeof folium.playback.getState !== 'function') {
        return '';
      }
      const snap = folium.playback.getState();
      return snap ? songKey(snap.song) : '';
    } catch (err) {
      return '';
    }
  }

  /** 推进到下一首。这是本模组唯一会改动播放状态的动作。 */
  function advanceQueue(reason) {
    try {
      if (folium && folium.playback && typeof folium.playback.next === 'function') {
        folium.playback.next();
        info(T.skipped.replace('{reason}', reason));
        return true;
      }
    } catch (err) {
      fail('调用 playback.next() 失败', err);
    }
    return false;
  }

  /**
   * 真正执行一次跳过。限流与连跳上限在这里兜底，任何路径都绕不过去。
   * 记账（noteSkip / 退避）发生在提前返回之前：被拦下也算出手过，
   * 否则同一首歌会被反复排进队列。
   */
  function performSkip(reason, settings) {
    const s = settings || readSettings();
    if (!s.enabled) return false;
    if (rateLimited(s)) {
      warnThrottled(T.rateLimited.replace('{count}', String(recentSkips.length)));
      pendingUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      return false;
    }
    if (capReached(s)) {
      warnThrottled(T.capReached.replace('{max}', String(s.maxConsecutiveSkips)));
      pendingUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      return false;
    }
    noteSkip();
    pendingUntil = Date.now() + s.delayMs;
    if (!advanceQueue(reason)) {
      warn(T.skipFailed.replace('{reason}', reason));
      return false;
    }
    return true;
  }

  function clearPendingTimer() {
    if (pendingSkipTimer) {
      clearTimeout(pendingSkipTimer);
      pendingSkipTimer = null;
    }
  }

  /* ---- 事件 -------------------------------------------------------------- */

  /**
   * 一次播放失败。宿主在它自己重试结束后报一次。
   *
   * 不插手的两种情况：
   *   willAutoSkip —— 宿主已经在倒计时跳过，本模组再动一次就会跳两首；
   *   phase 为 restore —— 启动恢复上次会话，宿主有意不跳。
   */
  function onPlaybackFailed(ev) {
    if (disposed || !ev || typeof ev !== 'object') return;

    const s = readSettings();
    if (!s.enabled) return;

    if (ev.phase === 'restore') return;
    if (ev.willAutoSkip === true) return;

    const reason = typeof ev.reason === 'string' && ev.reason ? ev.reason : 'unknown';

    let wanted = false;
    if (AUTH_NETWORK_REASONS.indexOf(reason) !== -1) {
      wanted = s.skipAuthNetwork;
    } else if (UNPLAYABLE_REASONS.indexOf(reason) !== -1) {
      wanted = s.skipUnplayable;
    } else {
      return;
    }
    if (!wanted) return;

    if (Date.now() < pendingUntil) return;

    const key = songKey(ev.song) || 'unknown-song';
    if (plannedSkipFor === key) return;
    plannedSkipFor = key;

    const delay = Math.max(0, Math.min(5000, s.delayMs));
    clearPendingTimer();
    pendingSkipTimer = setTimeout(function () {
      pendingSkipTimer = null;
      if (disposed) return;
      // 延迟期间歌曲可能已经换了，那这次跳过就作废。
      const nowKey = currentSongKey();
      if (nowKey && nowKey !== key) {
        info(T.skipAborted);
        plannedSkipFor = null;
        return;
      }
      performSkip(reason, readSettings());
      plannedSkipFor = null;
    }, delay);
  }

  /** 换歌时作废尚未执行的跳过。 */
  function onSongChanged() {
    if (disposed) return;
    if (plannedSkipFor) {
      clearPendingTimer();
      plannedSkipFor = null;
    }
  }

  /** 真正播起来了，连续跳过计数归零。 */
  function onStateChanged(payload) {
    if (disposed) return;
    const state = payload && payload.state;
    if (state === 'playing' && consecutiveSkips !== 0) {
      consecutiveSkips = 0;
      info(T.recovery);
    }
  }

  const disposers = [];
  function subscribe(type, handler) {
    try {
      if (!folium || !folium.events || typeof folium.events.on !== 'function') return;
      const off = folium.events.on(type, handler);
      if (typeof off === 'function') disposers.push(off);
    } catch (err) {
      fail('订阅 ' + type + ' 失败', err);
    }
  }

  subscribe('playback.failed', onPlaybackFailed);
  subscribe('playback.songChanged', onSongChanged);
  subscribe('playback.stateChanged', onStateChanged);

  let paramsOff = null;
  try {
    if (params && typeof params.subscribe === 'function') {
      paramsOff = params.subscribe(function () {
        /* 设置随时可读，这里只是保持订阅存活 */
      });
    }
  } catch (err) {
    /* 订阅设置失败不影响功能 */
  }

  info(
    T.started
      .replace('{folia}', String((folium.host && folium.host.folia) || '?'))
      .replace('{major}', String(major))
      .replace('{minor}', String(minor))
      .replace('{context}', String((folium.env && folium.env.context) || '?'))
  );

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearPendingTimer();
    for (let i = 0; i < disposers.length; i += 1) {
      try {
        disposers[i]();
      } catch (err) {
        /* 忽略 */
      }
    }
    disposers.length = 0;
    if (typeof paramsOff === 'function') {
      try {
        paramsOff();
      } catch (err) {
        /* 忽略 */
      }
      paramsOff = null;
    }
    recentSkips = [];
    consecutiveSkips = 0;
    info(T.dispose + '（本次会话共跳过 ' + skipsDone + ' 首）');
  }

  return dispose;
}
