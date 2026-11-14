// 随机池＋ · Folia 模组客户端
// 宿主自带的「每首歌随机歌词动画」只在内建样式里挑（候选 = 全部样式表 ∩ 内建白名单），
// 由模组注册的歌词样式（第三方动画模组提供的那些）进不了池。
// 本模组不改宿主，用公开 API 另建一套池：listModes 拿全部已注册样式（带 kind），
// 监听 playback.songChanged / lyrics.loaded，切歌时 setMode 换一种，池内超过 1 种时不连着重复。
//
// 0.7.26 / 0.7.28 双版本兼容：listModes / getMode / setMode 可能同步返回，也可能返回 Promise
// （宿主按上下文用 RPC 包装），这里统一用 settle() 兼容。
// 配置只存在模组自己的数据文件里（folium.storage + filesystem.data），不碰宿主自己的 localStorage。

const STORE_KEY = 'config';
const SWITCH_DELAY_MS = 0;
const VERIFY_DELAY_MS = 700;

const ZH = (() => {
  try {
    return String(navigator.language || 'zh-CN').toLowerCase().indexOf('zh') === 0;
  } catch (e) {
    return true;
  }
})();

const T = {
  tabZh: '随机池＋',
  tabEn: 'Random Pool+',
  onZh: '切歌时自动换样式',
  onEn: 'Switch style per song',
  allZh: '全选',
  allEn: 'All',
  builtinZh: '仅内建',
  builtinEn: 'Built-in',
  modOnlyZh: '仅模组',
  modOnlyEn: 'Mods only',
  noneZh: '清空',
  noneEn: 'Clear',
  rerollZh: '重抽一次',
  rerollEn: 'Shuffle',
  reloadZh: '重新读取',
  reloadEn: 'Reload',
  emptyZh: '没有拿到样式清单',
  emptyEn: 'Style list unavailable',
  hintZh: '宿主「设置→歌词动画→随机池」那页固定只有 17 个内建，模组样式进不去；这类模组样式只在本面板的池里。要立刻验证：点「仅模组」，下一首必定是 模组样式。',
  hintEn: 'The host settings page is fixed to 17 built-ins. Mod styles live only in this pool. Click "Mods only" to verify: the next song must use a mod-provided style.',
  builtinTagZh: '内建',
  builtinTagEn: 'built-in',
  modTagZh: '模组',
  modTagEn: 'mod',
  curZh: '当前',
  curEn: 'current',
  poolZh: '池',
  poolEn: 'pool',
  onStateZh: '已接管',
  onStateEn: 'active',
  offStateZh: '已暂停',
  offStateEn: 'paused',
  loadingZh: '读取中…',
  loadingEn: 'loading…'
};

function t(zh, en) {
  return ZH ? zh : en;
}

function errText(e) {
  return String((e && e.message) || e || 'unknown');
}

function isThenable(v) {
  return (
    v !== null &&
    (typeof v === 'object' || typeof v === 'function') &&
    typeof v.then === 'function'
  );
}

function labelOf(mode) {
  const label = mode && mode.label;
  if (typeof label === 'string' && label) return label;
  if (label && typeof label === 'object') {
    const pick = label['zh-CN'] || label.zh || label['en-US'] || label.en;
    if (pick) return String(pick);
  }
  if (mode && typeof mode.name === 'string' && mode.name) return mode.name;
  const id = mode && (mode.id || mode.mode);
  return id ? String(id) : '';
}

export default function activate(folium) {
  try {
    if (!folium) return;
    if (folium.env && folium.env.context && folium.env.context !== 'main') return;
  } catch (e) {
    return;
  }

  const V = folium && folium.visualizer;
  if (!V || typeof V.listModes !== 'function' || typeof V.setMode !== 'function') {
    try {
      folium.log && folium.log.warn && folium.log.warn('[random-pool-plus] visualizer API unavailable');
    } catch (e) {
      /* ignored */
    }
    return;
  }

  // 配置存档：folium.storage（模组自己的数据文件，对应 filesystem.data 权限）
  const storage = (function () {
    try {
      const s = folium && folium.storage;
      if (s && typeof s.get === 'function' && typeof s.set === 'function') return s;
    } catch (e) {
      /* ignored */
    }
    return null;
  })();

  const state = {
    cfg: { enabled: true, ids: null },
    lastId: '',
    timer: null,
    rerender: null,
    offs: [],
    modes: [],
    ready: false,
    cur: '',
    diag: ''
  };

  function log(text) {
    try {
      if (folium.log && typeof folium.log.info === 'function') folium.log.info('[random-pool-plus] ' + text);
    } catch (e) {
      /* ignored */
    }
  }

  // ---------- 样式清单 ----------
  function normalize(list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < list.length; i += 1) {
      const m = list[i];
      if (!m) continue;
      const rawId = typeof m === 'string' ? m : m.id || m.mode || m.key;
      if (typeof rawId !== 'string' || !rawId) continue;
      out.push({
        id: rawId,
        label: labelOf(m) || rawId,
        kind: m && m.kind === 'mod' ? 'mod' : m && m.kind === 'builtin' ? 'builtin' : 'builtin'
      });
    }
    out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'builtin' ? -1 : 1;
      return a.label.localeCompare(b.label, 'zh-CN');
    });
    return out;
    }

  function refreshModes() {
    state.lastRefresh = Date.now();
    let raw;
    try {
      raw = V.listModes();
    } catch (e) {
      state.diag = 'listModes 抛错: ' + errText(e);
      applyList([]);
      return;
    }
    if (isThenable(raw)) {
      raw.then(
        (v) => {
          if (Array.isArray(v)) {
            if (v.length === 0) state.diag = 'listModes 返回空数组';
            applyList(v);
          } else {
            state.diag = 'listModes Promise 返回 ' + typeof v;
            applyList([]);
          }
        },
        (e) => {
          state.diag = 'listModes Promise 失败: ' + errText(e);
          applyList([]);
        }
      );
      return;
    }
    if (Array.isArray(raw)) {
      if (raw.length === 0) state.diag = 'listModes 返回空数组';
      applyList(raw);
      return;
    }
    state.diag = 'listModes 返回 ' + (raw === null ? 'null' : typeof raw);
    applyList([]);
  }
  function applyList(arr) {
    state.modes = normalize(arr);
    state.ready = true;
    if (state.rerender) {
      try {
        state.rerender();
      } catch (e) {
        /* ignored */
      }
    }
  }

  // 清单重读放到切歌之后：listModes 会枚举全部样式，压在切歌瞬间会拖慢换样式
  function scheduleRefresh(ms) {
    if (state.refreshTimer) clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
      state.refreshTimer = null;
      refreshModes();
    }, ms == null ? 1500 : ms);
  }

  function refreshCurrent() {
    try {
      const m = V.getMode();
      if (isThenable(m)) {
        m.then(
          (v) => {
            state.cur = typeof v === 'string' ? v : '';
            if (state.rerender) state.rerender();
          },
          () => {
            state.cur = '';
          }
        );
      } else {
        state.cur = typeof m === 'string' ? m : '';
      }
    } catch (e) {
      state.cur = '';
    }
  }

  function allModes() {
    return state.modes;
  }

  function currentId() {
    return state.cur || '';
  }

  function poolIds() {
    const all = state.modes.map((m) => m.id);
    const chosen = state.cfg.ids;
    if (!Array.isArray(chosen)) return all;
    return all.filter((id) => chosen.indexOf(id) !== -1);
  }

  // ---------- 配置 ----------
  function normalizeCfg(raw) {
    const out = { enabled: true, ids: null };
    if (!raw || typeof raw !== 'object') return out;
    if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
    if (Array.isArray(raw.ids)) {
      const ids = [];
      for (let i = 0; i < raw.ids.length; i += 1) {
        if (typeof raw.ids[i] === 'string' && ids.indexOf(raw.ids[i]) === -1) ids.push(raw.ids[i]);
      }
      out.ids = ids;
    }
    return out;
  }

  function saveCfg() {
    const payload = { enabled: state.cfg.enabled, ids: state.cfg.ids };
    if (!storage) return;
    try {
      const p = storage.set(STORE_KEY, payload);
      if (isThenable(p)) p.then(null, (e) => log('save failed: ' + errText(e)));
    } catch (e) {
      log('save failed: ' + errText(e));
    }
  }

  function loadCfg() {
    if (!storage) return;
    const finish = (raw) => {
      state.cfg = normalizeCfg(raw);
      if (state.rerender) {
        try {
          state.rerender();
        } catch (e) {
          /* ignored */
        }
      }
      notify();
    };
    try {
      const got = storage.get(STORE_KEY);
      if (isThenable(got)) got.then(finish, (e) => log('load failed: ' + errText(e)));
      else finish(got);
    } catch (e) {
      log('load failed: ' + errText(e));
    }
  }

  // ---------- 抽选与切换 ----------
  // 以前是「均匀随机，只排掉当前这一个」：19 个样式里，隔两三首又撞上同一个是常态，
  // 看着就像随机不随机。改成洗牌袋（Fisher–Yates）：一整轮里每个样式各出现一次，
  // 一轮用完再重洗，且新一轮的第一抽不与上一轮最后一抽相同 —— 既均匀，又不会连着撞。
  function shuffleBag(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function kindOf(id) {
    for (let i = 0; i < state.modes.length; i += 1) {
      if (state.modes[i].id === id) return state.modes[i].kind;
    }
    return '';
  }

  function nextFromBag(ids, excludeId) {
    const sig = ids.join('|');
    if (!state.bag || state.bag.sig !== sig) state.bag = { sig: sig, list: [] };
    if (state.bag.list.length === 0) {
      const fresh = shuffleBag(ids);
      // 上一轮最后一个不能紧接着当这一轮的第一个：把撞上的那个换到队头（队尾取的是最后一个）
      const last = state.lastPicked || excludeId;
      if (fresh.length > 1 && last) {
        const at = fresh.indexOf(last);
        if (at === fresh.length - 1) {
          fresh[at] = fresh[0];
          fresh[0] = last;
        }
      }
      state.bag.list = fresh;
    }
    let picked = state.bag.list.pop();
    if (!picked) return null;
    /*
     * 再挡一道「刚用过」：袋里一共 19 个，跨轮交界那几抽仍可能撞上最近两首的样式。
     * 撞上了就从袋里换一个不在最近名单里的（袋里还有别的可换时才换）。
     */
    const recent = state.recent = Array.isArray(state.recent) ? state.recent : [];
    if (recent.indexOf(picked) !== -1 && state.bag.list.length > 0) {
      const at = state.bag.list.findIndex((id) => recent.indexOf(id) === -1);
      if (at !== -1) {
        // 换下来的那个塞回队头，不能塞队尾：队尾是下一抽。
        state.bag.list.unshift(picked);
        picked = state.bag.list.splice(at + 1, 1)[0];
      }
    }
    /*
     * 池里同时有内建和模组样式时，每 4 抽至少强制一次模组样式，
     * 否则 17/19 的概率下模组样式几乎看不见。
     * （旧写法用 `id.indexOf('mod:')` 判模组，可宿主给的 id 并不带这个前缀，
     *  这条强制其实从没生效过；现在按清单里的 kind 判。）
     */
    const mods = ids.filter((id) => kindOf(id) === 'mod');
    if (mods.length > 0 && mods.length < ids.length) {
      state.pickCount = (state.pickCount || 0) + 1;
      if (kindOf(picked) !== 'mod' && state.pickCount % 4 === 0) {
        const at = state.bag.list.findIndex((id) => kindOf(id) === 'mod');
        if (at !== -1) picked = state.bag.list.splice(at, 1)[0];
      }
    }
    recent.push(picked);
    while (recent.length > 3) recent.shift();
    state.lastPicked = picked;
    return picked;
  }

  function pick(excludeId) {
    const ids = poolIds();
    if (ids.length === 0) return null;
    if (ids.length === 1) return ids[0];
    return nextFromBag(ids, excludeId);
  }

  function now() {
    try {
      return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    } catch (e) {
      return Date.now();
    }
  }

  function pushHist(rec) {
    try {
      state.hist = Array.isArray(state.hist) ? state.hist : [];
      state.hist.push(rec);
      if (state.hist.length > 12) state.hist.shift();
    } catch (e) {
      /* ignored */
    }
  }

  function apply(target) {
    const next = target || pick(currentId());
    if (!next) return;
    const from = currentId();
    if (normId(next) === normId(from)) {
      log('skip same ' + next);
      return;
    }
    // 上一次 setMode 还挂着（宿主正在重建样式），这时再写一次就是两个样式连着重装
    if (state.applying) {
      log('skip: 上一次 setMode 尚未落地');
      return;
    }
    const t0 = now();
    try {
      const r = V.setMode(next);
      if (isThenable(r)) {
        state.applying = true;
        r.then(
          () => {
            state.applying = false;
            state.cur = next;
            log('mode -> ' + next);
            pushHist({ at: new Date().toISOString(), from: from, id: next, ms: Math.round(now() - t0) });
            notify();
          },
          (e) => {
            state.applying = false;
            log('setMode 失败: ' + errText(e));
          }
        );
        return;
      }
      state.cur = next;
      state.lastId = next;
      log('mode -> ' + next);
      pushHist({ at: new Date().toISOString(), from: from, id: next, ms: Math.round(now() - t0) });
    } catch (e) {
      log('setMode 失败: ' + errText(e));
      pushHist({ at: new Date().toISOString(), from: from, id: next, err: errText(e) });
    }
    notify();
  }

  function normId(id) {
    return String(id == null ? '' : id)
      .toLowerCase()
      .replace(/^(mod|builtin|visualizer)[:/]/, '');
  }

  function readCurrent(cb) {
    try {
      const m = V.getMode();
      if (isThenable(m)) {
        m.then(
          (v) => cb(typeof v === 'string' ? v : ''),
          () => cb(null)
        );
        return;
      }
      cb(typeof m === 'string' ? m : '');
    } catch (e) {
      cb(null);
    }
  }

  function scheduleSwitch(fn, ms) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    if (ms <= 0 && typeof queueMicrotask === 'function') {
      // 0 延迟：同一轮任务里就切，仅在微任务里排队，不跨帧
      state.timer = queueMicrotask(() => fn());
      return;
    }
    state.timer = setTimeout(() => {
      state.timer = null;
      fn();
    }, ms);
  }

  // 切歌：收到事件立刻抽签切换（SWITCH_DELAY_MS=0），同一首歌的重复事件直接忽略
  function newSong(key) {
    state.hits = (state.hits || 0) + 1;
    if (key != null && key === state.lastKey) return;
    state.lastKey = key == null ? null : key;
    state.songSeq = (state.songSeq || 0) + 1;
    state.desired = null;
    state.fixes = 0;
    scheduleSwitch(() => {
      if (!state.cfg.enabled) return;
      // 其它模组可能比本模组晚注册；但 listModes 会枚举全部样式，不压在切歌这一帧里
      if (!state.modes.length) refreshModes();
      else if (Date.now() - (state.lastRefresh || 0) > 20000) scheduleRefresh(1500);
      const next = pick(currentId());
      if (!next) return;
      state.desired = next;
      // 只在切歌瞬间写一次；不再安排播放中途补写（那是额外的重建，最容易被看成卡顿）
      apply(next);
    }, SWITCH_DELAY_MS);
  }

  // 歌词加载后确认一次：宿主若在切歌时自己写了样式，这里把它拉回我们选的那个
  function verifyApplied(delay) {
    if (state.verifyTimer) clearTimeout(state.verifyTimer);
    const seq = state.songSeq;
    state.verifyTimer = setTimeout(() => {
      state.verifyTimer = null;
      if (!state.cfg.enabled || state.desired == null) return;
      if (seq !== state.songSeq) return;
      readCurrent((cur) => {
        if (seq !== state.songSeq) return;
        if (typeof cur !== 'string' || normId(cur) === normId(state.desired)) return;
        if ((state.fixes || 0) >= 1) return;
        state.fixes = (state.fixes || 0) + 1;
        log('verify: ' + cur + ' -> ' + state.desired);
        apply(state.desired);
      });
    }, delay || VERIFY_DELAY_MS);
  }

  function onLyricsLoaded(key) {
    state.hits = (state.hits || 0) + 1;
    // 没收到切歌事件时（例如启动第一首）兜底抽一次，否则只做确认
    if (state.desired == null) {
      newSong(key);
      return;
    }
    verifyApplied(120);
  }

  function songKey(ev) {
    const s = ev && ev.song ? ev.song : ev;
    if (!s) return null;
    if (typeof s === 'string') return s;
    return s.id || s.songId || s.key || s.hash || s.title || null;
  }

  function notify() {
    // 切歌只更新状态行，不重建整个面板（重建 19 行 DOM 会在换歌瞬间卡一下）
    if (typeof state.refreshStatus === 'function') {
      try {
        state.refreshStatus();
        return;
      } catch (e) {
        /* 退回到整面板重绘 */
      }
    }
    if (typeof state.rerender === 'function') {
      try {
        state.rerender();
      } catch (e) {
        /* ignored */
      }
    }
  }

  // ---------- 切歌信号（全部走公开事件） ----------
  function listen(name, handler) {
    try {
      if (!folium.events || typeof folium.events.on !== 'function') return;
      const off = folium.events.on(name, (ev) => (handler || newSong)(ev));
      if (typeof off === 'function') state.offs.push(off);
    } catch (e) {
      log('events.on ' + name + ' 失败: ' + errText(e));
    }
  }

  // ---------- 播放器面板 ----------
  function renderPanel(container) {
    // 打开面板时若清单已陈旧（可能刚装了新样式），先重读一次再画
    if (!state.modes.length || Date.now() - (state.lastRefresh || 0) > 20000) {
      state.ready = false;
      refreshModes();
    }
    if (!container) return;

    const rowCss =
      'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;background:rgba(127,127,127,0.06)';
    const tagCss =
      'margin-left:auto;font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(127,127,127,0.18);opacity:0.85';
    const btnCss =
      'appearance:none;border:1px solid rgba(127,127,127,0.35);background:rgba(127,127,127,0.1);color:inherit;' +
      'border-radius:8px;padding:5px 10px;font:12px/1.4 system-ui,"Microsoft YaHei",sans-serif;cursor:pointer';

    function draw() {
      const modes = allModes();
      const chosen = poolIds();
      const cur = currentId();

      const root = document.createElement('div');
      root.style.cssText =
        'display:flex;flex-direction:column;gap:10px;box-sizing:border-box;width:100%;height:100%;' +
        'padding:12px;overflow:hidden;color:inherit;font:13px/1.5 system-ui,"Microsoft YaHei",sans-serif';

      const head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';

      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!state.cfg.enabled;
      chk.addEventListener('change', () => {
        state.cfg.enabled = chk.checked;
        saveCfg();
        draw();
      });
      const text = document.createElement('span');
      text.textContent = t(T.onZh, T.onEn);
      label.appendChild(chk);
      label.appendChild(text);
      head.appendChild(label);

      const status = document.createElement('div');
      status.style.cssText = 'margin-left:auto;font-size:12px;opacity:0.7';
      const statusText = () => {
        const ms = allModes();
        const chosenIds = poolIds();
        const curNow = currentId();
        const item = ms.filter((m) => m.id === curNow)[0];
        return (
          (state.cfg.enabled ? t(T.onStateZh, T.onStateEn) : t(T.offStateZh, T.offStateEn)) +
          ' · ' +
          t(T.poolZh, T.poolEn) +
          ' ' +
          chosenIds.length +
          '/' +
          ms.length +
          (curNow ? ' · ' + t(T.curZh, T.curEn) + ' ' + (item ? item.label : curNow) : '') +
          (!state.ready ? ' · ' + t(T.loadingZh, T.loadingEn) : '')
        );
      };
      status.textContent = statusText();
      state.refreshStatus = () => {
        status.textContent = statusText();
      };
      head.appendChild(status);
      root.appendChild(head);

      const tools = document.createElement('div');
      tools.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
      function addBtn(caption, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = btnCss;
        b.textContent = caption;
        b.addEventListener('click', fn);
        tools.appendChild(b);
      }
      const allIds = modes.map((m) => m.id);
      addBtn(t(T.allZh, T.allEn), () => {
        // 存 null 而不是 id 数组：之后新下载/新装的样式会自动并入全选
        state.cfg.ids = null;
        saveCfg();
        draw();
      });
      addBtn(t(T.builtinZh, T.builtinEn), () => {
        state.cfg.ids = modes.filter((m) => m.kind === 'builtin').map((m) => m.id);
        saveCfg();
        draw();
      });
      addBtn(t(T.modOnlyZh, T.modOnlyEn), () => {
        const modIds = modes.filter((m) => m.kind === 'mod').map((m) => m.id);
        if (!modIds.length) return;
        state.cfg.ids = modIds;
        saveCfg();
        apply(pick(cur));
        draw();
      });
      addBtn(t(T.noneZh, T.noneEn), () => {
        state.cfg.ids = [];
        saveCfg();
        draw();
      });
      addBtn(t(T.rerollZh, T.rerollEn), () => apply(pick(cur)));
      addBtn(t(T.reloadZh, T.reloadEn), () => {
        state.ready = false;
        refreshModes();
        draw();
      });
      root.appendChild(tools);

      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:6px;overflow:auto;flex:1 1 auto;min-height:0';
      if (modes.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'opacity:0.75;font-size:12px;line-height:1.6';
        empty.textContent = t(T.emptyZh, T.emptyEn) + (state.diag ? '：' + state.diag : '');
        list.appendChild(empty);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.style.cssText = btnCss + ';align-self:flex-start';
        retry.textContent = t('重新读取', 'Retry');
        retry.addEventListener('click', () => {
          state.ready = false;
          refreshModes();
          draw();
        });
        list.appendChild(retry);
      }
      modes.forEach((mode) => {
        const row = document.createElement('label');
        row.style.cssText = rowCss;
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = chosen.indexOf(mode.id) !== -1;
        box.addEventListener('change', () => {
          const base = Array.isArray(state.cfg.ids) ? state.cfg.ids.slice() : allIds.slice();
          const at = base.indexOf(mode.id);
          if (box.checked && at === -1) base.push(mode.id);
          if (!box.checked && at !== -1) base.splice(at, 1);
          state.cfg.ids = base;
          saveCfg();
          draw();
        });
        const name = document.createElement('span');
        name.textContent = mode.label;
        name.title = mode.id;
        const tag = document.createElement('span');
        tag.style.cssText = tagCss;
        tag.textContent = mode.kind === 'mod' ? t(T.modTagZh, T.modTagEn) : t(T.builtinTagZh, T.builtinTagEn);
        row.appendChild(box);
        row.appendChild(name);
        row.appendChild(tag);
        list.appendChild(row);
      });
      root.appendChild(list);

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;line-height:1.5;opacity:0.6';
      hint.textContent = t(T.hintZh, T.hintEn);
      root.appendChild(hint);

      container.innerHTML = '';
      container.appendChild(root);
    }

    state.rerender = draw;
    if (!state.ready) refreshModes();
    refreshCurrent();
    draw();

    return () => {
      state.rerender = null;
      state.refreshStatus = null;
      try {
        container.innerHTML = '';
      } catch (e) {
        /* ignored */
      }
    };
  }

  // ---------- 注册界面与命令 ----------
  function registerUi() {
    try {
      const tabs = folium.registries && folium.registries.playerPanelTabs;
      if (tabs && typeof tabs.register === 'function') {
        const handle = tabs.register({
          id: 'random-pool',
          label: { 'zh-CN': T.tabZh, en: T.tabEn },
          mount: (container) => {
            try {
              return renderPanel(container);
            } catch (e) {
              log('panel render 失败: ' + errText(e));
              return undefined;
            }
          }
        });
        if (handle && typeof handle.unregister === 'function') state.offs.push(() => handle.unregister());
      }
    } catch (e) {
      log('playerPanelTabs.register 失败: ' + errText(e));
    }

    try {
      const commands = folium.registries && folium.registries.commands;
      if (commands && typeof commands.register === 'function') {
        const h1 = commands.register({
          id: 'random-pool-reroll',
          group: 'visualizer',
          title: t('随机池＋：重抽一次', 'Random Pool+: shuffle now'),
          description: t('立刻从随机池里换一种歌词样式', 'Pick another style from the pool right away'),
          keywords: ['random', 'pool', 'visualizer', '随机', '样式'],
          run: () => apply(pick(currentId()))
        });
        const h2 = commands.register({
          id: 'random-pool-toggle',
          group: 'visualizer',
          title: t('随机池＋：开/关接管', 'Random Pool+: toggle'),
          description: t('开启或暂停每首歌自动换样式', 'Enable or pause per-song switching'),
          keywords: ['random', 'pool', 'toggle', '随机'],
          run: () => {
            state.cfg.enabled = !state.cfg.enabled;
            saveCfg();
            notify();
            if (state.cfg.enabled) apply(pick(currentId()));
          }
        });
        state.offs.push(() => {
          [h1, h2].forEach((h) => {
            try {
              if (h && typeof h.unregister === 'function') h.unregister();
            } catch (e) {
              /* ignored */
            }
          });
        });
      }
    } catch (e) {
      log('commands.register 失败: ' + errText(e));
    }
  }

  registerUi();
  listen('playback.songChanged', (ev) => newSong(songKey(ev)));
  listen('lyrics.loaded', (ev) => onLyricsLoaded(songKey(ev)));
  loadCfg();
  refreshModes();
  refreshCurrent();
  // 其它模组可能比本模组晚注册：稍后补读一次清单（之后每次切歌也会自动重读）
  try {
    setTimeout(() => {
      refreshModes();
    }, 3000);
  } catch (e) {
    /* ignored */
  }
  log(
    'ready · enabled=' +
      state.cfg.enabled +
      ' · ids=' +
      (Array.isArray(state.cfg.ids) ? state.cfg.ids.length : 'all') +
      ' · modes=' +
      state.modes.length +
      (state.diag ? ' · ' + state.diag : '')
  );

  return function dispose() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.verifyTimer) {
      clearTimeout(state.verifyTimer);
      state.verifyTimer = null;
    }
    state.offs.forEach((off) => {
      try {
        if (typeof off === 'function') off();
      } catch (e) {
        /* ignored */
      }
    });
    state.offs = [];
    state.rerender = null;
  };
}
