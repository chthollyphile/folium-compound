// mods/spectrum-visualizer/client.mjs
//
// Folium 1.6 播放页图层模组（stageLayer）。
// 把原 spectrum-viewer 项目（viewer.js + viewer.css）的频谱显示逻辑做成
// Folia 播放页上的一个独立小组件：左下角（被挡时自动避让）的紧凑频谱卡，不占歌词区。
//
//   · 48 段频谱柱（平方映射到 bin，最高 16 kHz），与原 viewer.js 一致
//   · 柱色三档：低 #d8b975 / 中 #c3cf87 / 高 #95b1a1；空闲时对应暗色
//   · 一行迷你读数：输入功率 dB / 峰值频率 Hz
//     （宿主不暴露采样率，峰值与频率轴按设置里的"假定采样率"折算，默认 44.1 kHz ——
//     依据是 Folia 自己拿 Math.floor(freq / 21.5) 索引频谱数组划分频段，21.5 Hz/格）
//   · 自动避让：命中测试宿主元素，撞上"下一首预告"等遮挡时自动换位
//   · 可选背景透明：去掉卡片底色 / 毛玻璃 / 描边，只留频谱柱与读数
//   · 音频走 ctx.audio（getPower / getSpectrum）
//
// 与 visualizer 的区别：stageLayers 是播放页的叠加图层（歌词之上、控件之下，
// slot 'player.stage.front'），mount 的 ctx 是 FoliumStageContext，容器默认点击穿透。
//
// 声明方式（Folium 1.6，Folia >= 0.7.21）：帧循环、定时器一律走 ctx 的 onFrame / every ——
// 宿主在 mount 结束时自动停掉它们，不用（也不该）自己养 rAF / setInterval。
// 设置值从 settingsSections 句柄的 `handle.settings`（FoliumSettingAccess）读取，
// 不再用 1.5 及更早的 `handle.params`（Folium 2 起移除）。
// mod.json 已声明 `"folia": ">=0.7.21"`，更老的宿主会被宿主自己拦下并提示升级，
// 所以这里不做版本探测、也不留旧 API 的兜底。

const BARS = 48;

/* 柱色（on / off）—— 与原 viewer.css 同步 */
const COL_ON = ['#d8b975', '#c3cf87', '#95b1a1'];
const COL_OFF = ['#3d3a2f', '#373d2d', '#2c3833'];
const colOf = (i, on) =>
  on
    ? i < 12 ? COL_ON[0] : i < 30 ? COL_ON[1] : COL_ON[2]
    : i < 12 ? COL_OFF[0] : i < 30 ? COL_OFF[1] : COL_OFF[2];

/* 横轴频率刻度（与原 viewer.js 一致——0 / 中部三档 / 末端） */
const AXIS_TICKS = [0, 12, 24, 36, BARS - 1];
const fmtHz = (f) => {
  if (f >= 10000) return Math.round(f / 1000) + 'k';
  if (f >= 1000) return (f / 1000).toFixed(1) + 'k';
  return Math.round(f) + '';
};

/**
 * 计算频谱柱映射时覆盖的最高 bin（让最高柱落在 16 kHz 处）。
 *   specLen : ctx.audio.getSpectrum() 返回的 Uint8Array.length
 *   推断:   fftSize = specLen * 2；bin 频率分辨率 = sr / fftSize
 *   sr 假定 48 kHz（宿主不暴露时，与原 viewer.js 默认一致）。
 */
/**
 * 宿主不暴露 AudioContext，采样率只能假定。默认 44.1 kHz 的依据：
 * Folia 客户端自己就是拿 `Math.floor(freq / 21.5)` 去索引同一块频谱数组划分频段的
 * （20–150 / 150–400 / 400–1200 / 1000–3500 / 3500–12000 Hz），
 * 21.5 Hz/格 × 2048 点 ≈ 44.1 kHz。设置里可改成 48 kHz。
 */
const DEFAULT_SR = 44100;

/**
 * 从频谱数组长度反推分析参数（宿主每帧新给一块 Uint8Array，长度 = frequencyBinCount）：
 *   specLen : getSpectrum().length，= fftSize / 2
 *   fft     : fftSize = specLen * 2
 *   binHz   : 每格多少 Hz = 假定采样率 / fftSize（峰值频率与频率轴都靠它）
 */
const specInfo = (specLen, sampleRate) => {
  const len = specLen > 0 ? specLen : 1024;
  const sr = sampleRate > 0 ? sampleRate : DEFAULT_SR;
  return { specLen: len, fft: len * 2, binHz: sr / (len * 2) };
};

const computeTopBin = (specLen, sampleRate) => {
  const { specLen: len, binHz } = specInfo(specLen, sampleRate);
  return Math.min(len - 1, Math.max(64, Math.round(16000 / binHz)));
};

/* ============================================================
   播放页小组件 mount
   ============================================================ */

/* app.viewChanged 的当前视图。只有 'player' 才做避让扫描：
   首页（包括"主页半透明、播放页垫在下面"的情况）上，采样点命中的是首页的
   卡片 / 模糊层，永远找不到干净位，扫描纯属白烧主线程。 */
let appView = 'player';
let notifyViewBack = null;   // 由 mount 填：回到播放页时立即补扫一次

const mountStageWidget = (section, container, ctx, logger) => {
  /* 设置值：1.6 的 settingsSections 句柄把 FoliumSettingAccess 放在 `.settings`
     （1.5 及更早叫 `.params`，Folium 2 移除；本版本不再读旧名）。values 在值变化前是同一个对象。 */
  const values = section.settings;
  const opts = () => values.get();

  /* ctx.audio：宿主的音频分析器（Folium 1.2+；本模组最低 1.6，恒存在）。 */
  const getAudio = () => ctx.audio;

  /* 首页期间不扫描，切回播放页时补一次定位。 */
  const onViewBack = () => schedulePlace(true);
  notifyViewBack = onViewBack;

  /* 走宿主的日志通道（落到 %APPDATA%\Folia\logs）：避让挪位、采样率兜底各记一行，
     出问题时可以直接看日志。 */
  const log = (msg) => {
    try { if (logger && typeof logger.info === 'function') logger.info(msg); } catch (_) {}
  };

  /* 宿主不给采样率，靠设置项假定；峰值频率与频率轴都从这里取值。
     填多少用多少，非正值退回 DEFAULT_SR —— 生效值只写一行日志，方便核对。 */
  let lastSr = -1;
  const sampleRate = () => {
    const v = Number(opts().sampleRate);
    const sr = v > 0 ? v : DEFAULT_SR;
    if (sr !== lastSr) {
      lastSr = sr;
      log(`假定采样率 = ${sr} Hz（峰值频率与频率轴按它折算）`);
    }
    return sr;
  };

  /* ---- DOM 骨架：紧凑卡片 ---- */
  const shell = document.createElement('div');
  shell.className = 'sv-widget';
  /* 定位：不用 left/bottom，坐标由下面的 autoPlace() 算好后写成 transform —— 自动避让
     只动自己，不改写宿主 DOM / 样式；autoAvoid 关闭时退回固定左下位。
     图层容器本身点击穿透，这里纯显示也不接管事件（顺带让命中测试不会命中自己）。 */
  shell.style.cssText = [
    'position:absolute',
    'left:0', 'top:0',
    'transform:translate(0px,0px)',
    'transition:transform .18s ease,opacity .25s ease',
    'opacity:0',
    'width:264px',
    'padding:10px 12px 9px',
    'border-radius:10px',
    'background:rgba(8,12,9,.42)',
    'box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)',
    'backdrop-filter:blur(6px)',
    'pointer-events:none',
    'color:#e6eadf',
    'font:12px/1.4 system-ui,"PingFang SC","Microsoft YaHei","Noto Sans SC",Arial,sans-serif',
  ].join(';');

  shell.innerHTML = `
    <div class="sv-cap" style="
      font-size:10px;letter-spacing:1px;
      color:rgba(230,234,223,.62);margin-bottom:6px;
    ">频谱 / SPECTRUM</div>

    <div class="sv-meters" style="
      display:flex;gap:0;margin-bottom:6px;
    ">
      ${meterHtml('功率', 'dB', 'power')}
      ${meterHtml('峰值', 'Hz', 'peak')}
    </div>

    <div class="sv-spec-wrap" style="position:relative;">
      <canvas class="sv-spec" style="display:block;width:100%;height:56px;"></canvas>
      <div class="sv-axis" style="position:relative;height:12px;margin-top:3px;"></div>
    </div>
  `;

  const canvas = shell.querySelector('canvas.sv-spec');
  const sg = canvas.getContext('2d');
  const axisEl = shell.querySelector('.sv-axis');
  /* ⚠️ 选择器注意：data-meter 挂在承载数值的 <span> 自己身上（单位 <small> 是兄弟节点），
     写成 [data-meter="x"] strong 这类带祖先/后代的组合会取到 null*/
  const powerEl = shell.querySelector('[data-meter="power"]');
  const peakEl = shell.querySelector('[data-meter="peak"]');

  container.appendChild(shell);

  /* ---- 外观：背景透明开关（每帧读一次设置，值变了才写样式） ---- */
  let transparentSkin = null;
  const applySkin = () => {
    const on = opts().transparentBg === true;
    if (on === transparentSkin) return;
    transparentSkin = on;
    shell.style.background = on ? 'transparent' : 'rgba(8,12,9,.42)';
    shell.style.boxShadow = on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.07)';
    for (const p of ['backdrop-filter', '-webkit-backdrop-filter']) {
      try { shell.style.setProperty(p, on ? 'none' : 'blur(6px)'); } catch (_) {}
    }
  };
  applySkin();

  /* ---- 高 DPI 适配 ----
     CSS 尺寸缓存在这里，paint() 每帧直接用 —— 不在帧循环里读 clientWidth/Height，
     避免把宿主拖动时整棵 DOM 的布局回算拽进帧循环。 */
  let viewW = 0, viewH = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    viewW = rect.width;
    viewH = rect.height;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * d));
    canvas.height = Math.max(1, Math.round(rect.height * d));
    sg.setTransform(d, 0, 0, d, 0, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  /* ============================================================
     自动避让（autoAvoid）
     ------------------------------------------------------------
     宿主既不给"下一首预告"这类元素的句柄，也没暴露舞台安全区，所以这里用
     「命中测试 + 候选位打分」做通用避让，全程只动自己的 transform，
     不碰宿主的 DOM / 样式：

       1) 在自己的矩形内打点阵，用 getRootNode().elementsFromPoint 采样
          （本组件 pointer-events:none，命中测试不会命中自己）；
       2) 过滤掉容器自身及其祖先、铺满舞台的背景/歌词层（面积阈值）、
          以及不可见元素，剩下的"紧凑块"才算遮挡物；
       3) 默认位（左下角）被挡 → 按候选序列（左下 → 逐级上移 → 左上 →
          右侧同样两档）挑第一个 0 命中的位置；
       4) 400 ms 基准轮询（一个干净位都找不到时指数退避到 4 s）+ 容器
          ResizeObserver + container 子树 childList 变化即时重算；连续两轮
          被挡才挪（≈ 800 ms），挪完 1.2 s 冷却，
          避免歌词逐句刷新时来回跳。
     ============================================================ */
  const AVOID = {
    mx: 24,           // 左边距（与旧的固定位一致）
    my: 24,           // 上边距
    /* 默认底边距：刻意贴到最低，让"下一首预告"这类底部元素真的压住组件，
       再由避让把它顶上去 —— 这既是最省空间的摆法，也方便自测避让。 */
    bottom: 20,
    step: 16,         // 逐级上移的步长（小步让位，观感更稳）
    maxLift: 200,     // 最多抬高多少 px：宁可略微压住，也不要让组件躲到很远的地方
    interval: 400,    // 基准轮询间隔（ms）
    retryMax: 4000,   // 找不到干净位时指数退避的上限（ms）
    forcedGap: 120,   // urgent 重算（尺寸变化 / 切回播放页）的最小间隔（ms）
    settle: 8000,     // 没有可用位置时的静默期（ms）
    bleedRatio: 0.6,  // 面积 ≥ 舞台 60% 的元素按背景层处理，不算遮挡
    minArea: 400,     // 小于 20×20 的元素忽略
    cols: 4, rows: 3, // 候选位打分的点阵
    coarseCols: 3, coarseRows: 2, // 判断「当前位置是否被挡」的稀疏点阵
    smoothBack: 3000, // 位置连续干净多久才考虑回到默认位
    cooldown: 1200,   // 两次挪位之间的最小间隔
  };

  const hitRoot = (() => {
    try {
      const r = container.getRootNode && container.getRootNode();
      if (r && typeof r.elementsFromPoint === 'function') return r;
    } catch (_) {}
    return null;
  })();

  /* 采样点上的元素链：优先问 shadow root —— 图层在 ShadowRoot 里，只有它看得到兄弟层；
     拿不到结果时才回落到 document 兜外部浮层。两者都问会让每次采样多一倍开销。 */
  const hitAt = (x, y) => {
    if (hitRoot) {
      try {
        const list = hitRoot.elementsFromPoint(x, y);
        if (list && list.length) return list;
      } catch (_) {}
    }
    try {
      return document.elementsFromPoint ? document.elementsFromPoint(x, y) : [];
    } catch (_) {
      return [];
    }
  };

  /* node 是 container 自己或它的祖先吗（舞台根 / 播放器根都算，不算遮挡物）。 */
  const coversContainer = (node) => {
    let n = container;
    while (n) {
      if (n === node) return true;
      n = n.parentNode || n.host || null;
    }
    return false;
  };

  /* 元素是不是真的"画了东西"：有背景色/背景图、本身是媒体元素、或自带文字。
     宿主不少卡片外面套着透明布局壳（padding / 包裹层），命中它们并不等于被遮住；
     不过滤的话避让会把组件一路顶得很远。 */
  const paints = (node, cs) => {
    const tag = node.tagName;
    if (tag === 'IMG' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'PICTURE') return true;
    if (cs) {
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
      const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || '');
      if (m) {
        const p = m[1].split(',').map(Number);
        if ((p.length > 3 ? p[3] : 1) > 0.08) return true;
      }
      if ((parseFloat(cs.borderTopWidth) || 0) > 0) return true;
    }
    return node.children.length === 0 && (node.textContent || '').trim().length > 0;
  };

  const describe = (node) => {
    const cls = typeof node.className === 'string' && node.className.trim()
      ? '.' + node.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    return node.tagName.toLowerCase() + (node.id ? '#' + node.id : '') + cls;
  };

  /* 一个节点在一轮扫描内的只读快照。三个昂贵成员都按需求：
       矩形 —— 先拿，面积过滤要用；
       样式 —— 只有面积过关的节点才 getComputedStyle；
       绘制 —— 只有可见、且不是容器祖先的节点才算。
     旧写法拿到节点就一并求样式和 paints，结果给每个命中的小图标、
     透明布局壳都做了一遍样式解析。 */
  const nodeInfo = (node, cache) => {
    let info = cache.get(node);
    if (!info) {
      let rect = null;
      try { rect = node.getBoundingClientRect(); } catch (_) {}
      info = { rect, cs: null, covers: null, paints: null };
      cache.set(node, info);
    }
    return info;
  };

  const styleOf = (info, node) => {
    if (info.cs === null) {
      try { info.cs = window.getComputedStyle(node); } catch (_) { info.cs = false; }
    }
    return info.cs || null;
  };

  const paintOf = (info, node, cs) => {
    if (info.paints === null) info.paints = paints(node, cs || styleOf(info, node));
    return info.paints;
  };

  /* 一个采样点上有没有"真的挡住"的元素。顺序按代价排：
     矩形 → 面积/背景层 → 样式 → 容器祖先 → 是否画了东西。 */
  const blockerAt = (x, y, cache, stageArea, out, bg) => {
    for (const node of hitAt(x, y)) {
      if (!node || node.nodeType !== 1) continue;
      if (node === shell || shell.contains(node)) continue;
      if (bg && bg.has(node)) continue;
      const info = nodeInfo(node, cache);
      const nr = info.rect;
      if (!nr || nr.width * nr.height < AVOID.minArea) continue;
      if (stageArea > 0 && nr.width * nr.height >= stageArea * AVOID.bleedRatio) continue;
      const cs = styleOf(info, node);
      if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) continue;
      if (info.covers === null) info.covers = coversContainer(node);
      if (info.covers) continue;
      if (!paintOf(info, node, cs)) continue;   // 透明布局壳不算遮挡
      if (out && out.length < 3) out.push(describe(node));
      return true;
    }
    return false;
  };

  /* 矩形被挡得多厉害：命中点越多越"挡"，0 = 干净。
     out 传数组时顺带记下遮挡物描述，只用于日志诊断。
     coarse=true 用 3×2 稀疏点阵，只回答「是否被挡」。 */
  const scoreRect = (r, cRect, out, cache, coarse, bg) => {
    if (!r.width || !r.height) return Number.MAX_SAFE_INTEGER;
    const stageArea = cRect.width * cRect.height;
    const cols = coarse ? AVOID.coarseCols : AVOID.cols;
    const rows = coarse ? AVOID.coarseRows : AVOID.rows;
    let hits = 0;
    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        const x = r.left + ((ix + 0.5) / cols) * r.width;
        const y = r.top + ((iy + 0.5) / rows) * r.height;
        if (blockerAt(x, y, cache, stageArea, out, bg)) hits += 1;
      }
    }
    return hits;
  };

  /* 只用中心点判断"这个候选像不像干净的"：26 个候选 26 次命中测试。 */
  const centerHits = (r, cRect, cache, bg) => {
    const stageArea = cRect.width * cRect.height;
    return blockerAt(r.left + r.width / 2, r.top + r.height / 2, cache, stageArea, null, bg) ? 1 : 0;
  };

  /* 背景装饰识别：海报渐变、阴影、暗角这类铺满舞台的层，会在几乎所有采样点上
     出现。它们不是"挡住组件的 UI"，不该把组件推到别处 —— 先在舞台网格上探一遍，
     出现率 ≥ 60% 的节点按背景忽略。每次扫描现算，布局变了自然跟着变。 */
  const findBackground = (cRect) => {
    const cols = 4, rows = 3;
    const hits = new Map();
    let points = 0;
    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        points += 1;
        const x = cRect.left + ((ix + 0.5) / cols) * cRect.width;
        const y = cRect.top + ((iy + 0.5) / rows) * cRect.height;
        const seen = new Set();
        for (const node of hitAt(x, y)) {
          if (!node || node.nodeType !== 1 || seen.has(node)) continue;
          seen.add(node);
          if (node === shell || shell.contains(node)) continue;
          hits.set(node, (hits.get(node) || 0) + 1);
        }
      }
    }
    const bg = new Set();
    const limit = points * 0.6;
    for (const [node, n] of hits) {
      if (n >= limit) bg.add(node);
    }
    return bg;
  };

  /* 挑候选位：先按中心点排序，再对最有希望的 4 个做 3×2 粗筛 + 4×3 复核。
     返回第一个 0 命中的下标，没有则 -1。
     全被挡时最坏约 26 + 4×6 = 50 次命中测试（原来 26×12 = 312 次）。 */
  const pickSpot = (spots, cRect, cache, bg) => {
    const order = spots
      .map((sp, i) => ({ i, c: centerHits(sp, cRect, cache, bg) }))
      .sort((a, b) => a.c - b.c || a.i - b.i);
    const limit = Math.min(order.length, 4);
    for (let k = 0; k < limit; k += 1) {
      const i = order[k].i;
      if (scoreRect(spots[i], cRect, null, cache, true, bg) !== 0) continue;
      if (scoreRect(spots[i], cRect, null, cache, false, bg) === 0) return i;
    }
    return -1;
  };

  /* 候选位，按偏好排序：左下角默认位 → 同列每 AVOID.step 像素上移一格 → 右侧同样一列。
     ⚠️ 步长就是 AVOID.step 本身（以前误写成 `组件高度 + step`，一次让位就抬 116px，
     看起来像"躲得老远"）；抬升总量再受 AVOID.maxLift 限制。 */
  const candidates = (cRect, w, h) => {
    const yMin = cRect.top + 8;
    const yMax = Math.max(yMin, cRect.bottom - 8 - h);
    const clampTop = (v) => Math.min(Math.max(v, yMin), yMax);
    const xMin = cRect.left + 8;
    const xMax = Math.max(xMin, cRect.right - 8 - w);
    const clampLeft = (v) => Math.min(Math.max(v, xMin), xMax);
    const yDefault = cRect.bottom - AVOID.bottom - h;
    const yLimit = Math.max(cRect.top + AVOID.my, yDefault - AVOID.maxLift);

    const out = [];
    const push = (left, top) => {
      const c = { left: clampLeft(left), top: clampTop(top), width: w, height: h };
      const last = out[out.length - 1];
      if (last && Math.abs(last.left - c.left) < 1 && Math.abs(last.top - c.top) < 1) return;
      out.push(c);
    };
    for (const anchor of [cRect.left + AVOID.mx, cRect.right - AVOID.mx - w]) {
      for (let y = yDefault; y >= yLimit; y -= AVOID.step) push(anchor, y);
    }
    return out;
  };

  let curDx = 0, curDy = 0;
  let curIndex = -1;       // 当前落在候选序列的哪一档
  let blocked = 0;         // 连续被遮挡的轮数
  let cleanSince = 0;      // 当前位置连续干净的起点
  let cooldownUntil = 0;
  let revealed = false;
  let legacyFix = false;
  let nextScan = 0;        // 下一次允许扫描的时间
  let lastForced = 0;      // 上一次 urgent 重算的时间
  let lastSlowLog = 0;     // 慢扫描日志限速
  let lastSettleLog = 0;   // 静默原因日志限速

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    shell.style.opacity = '1';
  };
  const revealTimer = setTimeout(reveal, 900);   // 兜底：算不出位置也得先显出来

  const autoPlace = (now, forced) => {
    /* 关掉自动避让 → 退回 0.2.x 的固定左下位。 */
    if (opts().autoAvoid === false) {
      if (!legacyFix) {
        legacyFix = true;
        curDx = 0; curDy = 0; curIndex = -1;
        shell.style.transform = 'none';
        shell.style.top = 'auto';
        shell.style.left = AVOID.mx + 'px';
        shell.style.bottom = AVOID.bottom + 'px';
      }
      reveal();
      return;
    }
    if (legacyFix) {
      legacyFix = false;
      shell.style.top = '0';
      shell.style.left = '0';
      shell.style.bottom = 'auto';
    }

    /* 只在真正的播放页做避让。首页（尤其半透明主页）会把播放页垫在下面：
       此时命中测试打到的是首页卡片和模糊层，一个干净位都找不到 —— 原来每个
       400 ms 周期都要把 26 个候选全量重扫一遍，主线程就被这顿空转拖住了。 */
    if (appView !== 'player') {
      nextScan = now + AVOID.retryMax;
      return;
    }

    /* 播放器面板展开、盖住舞台时不挪：挪了也看不见。 */
    const display = typeof ctx.getDisplay === 'function' ? ctx.getDisplay() : null;
    if (display && display.isPanelOpen) {
      nextScan = now + AVOID.retryMax;
      return;
    }

    /* urgent（容器尺寸变化 / 切回播放页）立即算；轮询与子树变化遵守 nextScan。
       歌词逐句刷新都会改子树，不能每次都当成"必须立刻重扫"。 */
    if (forced) {
      if (now - lastForced < AVOID.forcedGap) return;
      lastForced = now;
    } else if (now < nextScan) {
      return;
    }

    const cRect = container.getBoundingClientRect();
    if (cRect.width < 160 || cRect.height < 100) return;   // 舞台还没量出来 / 太小，别折腾

    const cur = shell.getBoundingClientRect();
    const w = cur.width, h = cur.height;
    if (w < 60 || h < 40) return;

    const scanStart = performance.now();
    /* 一轮扫描共用一个节点缓存：同一节点被多个采样点命中时只求一次矩形/样式。 */
    const cache = new Map();

    /* transform 是纯平移，减掉当前偏移就能还原"未偏移"的基准位。 */
    const baseLeft = cur.left - curDx;
    const baseTop = cur.top - curDy;
    /* 当前位置只做稀疏采样：只需要知道"有没有被挡"。 */
    let curScore = scoreRect(cur, cRect, null, cache, true);

    /* 被挡时才去分辨"真遮挡"和"背景装饰"（海报渐变、暗角、阴影……）。
       findBackground 只探 12 个点，比把 26 个候选全扫一遍便宜得多。 */
    let bg = null;
    if (curScore > 0) {
      bg = findBackground(cRect);
      if (bg.size) {
        const relaxed = scoreRect(cur, cRect, null, cache, true, bg);
        if (relaxed !== curScore) curScore = relaxed;
      }
    }

    if (curScore > 0) { blocked += 1; cleanSince = 0; }
    else { blocked = 0; if (!cleanSince) cleanSince = now; }

    const spots = candidates(cRect, w, h);

    let target = -1;
    let settled = false;
    if (curIndex < 0) {
      /* 首次定位：默认位（左下角）优先，被挡就往后挑；一个干净位都没有也先回默认位。 */
      const pick = pickSpot(spots, cRect, cache, bg);
      target = pick >= 0 ? pick : 0;
    } else if (curScore === 0) {
      /* 没被挡：只有当前位置排在默认位之后、且已连续干净 3 s，才考虑回到默认位。 */
      if (curIndex > 0 && now - cleanSince > AVOID.smoothBack && now >= cooldownUntil) {
        const pick = pickSpot(spots, cRect, cache, bg);
        if (pick >= 0 && pick < curIndex) target = pick;
      }
    } else if (blocked >= 2 && now >= cooldownUntil) {
      /* 被挡：找得到干净位才挪；一个都没有（或已经站在最干净的位置）就静默一段，
         别再每 400 ms 把 26 个候选重扫一遍 —— 满屏元素时这正是卡顿的来源。 */
      const pick = pickSpot(spots, cRect, cache, bg);
      if (pick >= 0 && pick !== curIndex) target = pick;
      else settled = true;
    }

    /* 慢扫描留痕：只在 >8 ms 且距上次 >5 s 时写一行，便于确认线上表现。 */
    const scanMs = performance.now() - scanStart;
    if (scanMs > 8 && now - lastSlowLog > 5000) {
      lastSlowLog = now;
      log(
        `避让扫描 ${scanMs.toFixed(1)}ms：视图=${appView}，` +
        `候选 ${spots.length}，blocked=${blocked}，target=${target}，settled=${settled}`,
      );
    }

    if (settled) {
      /* 已经尽力了：先停 8 s。容器尺寸变化 / 切回播放页仍会立即重算。
         每 30 s 记一次挡住当前位置的元素，方便判断是不是判定过严。 */
      if (now - lastSettleLog > 30000) {
        lastSettleLog = now;
        const blockers = [];
        scoreRect(cur, cRect, blockers, cache, true, bg);
        log(
          '没有干净位，先停 8s；当前位置的遮挡物：' +
          (blockers.length ? blockers.join(' / ') : '（未采集到）'),
        );
      }
      nextScan = now + AVOID.settle;
      reveal();
      return;
    }

    if (target < 0) {
      /* 还在等「连续两轮」确认：保持基准间隔，下一轮再判。 */
      nextScan = now + AVOID.interval;
      reveal();
      return;
    }

    const dx = Math.round(spots[target].left - baseLeft);
    const dy = Math.round(spots[target].top - baseTop);
    if (dx !== curDx || dy !== curDy) {
      const blockers = [];
      if (curIndex >= 0 && curScore > 0) scoreRect(cur, cRect, blockers, cache, true, bg);
      const lift = Math.max(0, Math.round(spots[0].top - spots[target].top));
      log(
        `自动避让：相对默认位抬高 ${lift}px` +
        (lift === 0 ? '' : `（步长 ${AVOID.step}px）`) +
        (blockers.length ? `，挡住原位置的是 ${blockers.join(' / ')}` : '，初始定位'),
      );
      curDx = dx; curDy = dy;
      shell.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    curIndex = target;
    blocked = 0;
    cleanSince = now;
    cooldownUntil = now + AVOID.cooldown;
    nextScan = now + AVOID.interval;
    reveal();
  };

  /* 挂载时同步定位一次，避免第一帧闪在容器左上角。 */
  autoPlace(performance.now(), true);

  let placeQueued = false;
  let placeUrgent = false;
  const schedulePlace = (urgent) => {
    if (urgent) placeUrgent = true;
    if (placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => {
      placeQueued = false;
      const u = placeUrgent;
      placeUrgent = false;
      autoPlace(performance.now(), u);
    });
  };
  /* 舞台尺寸变化 / 子树增删（下一首预告滑入、歌词换行）→ 立刻重算。 */
  const co = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedulePlace(true)) : null;
  if (co) co.observe(container);
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver((records) => {
        for (const rec of records) {
          const t = rec.target;
          if (t === shell || (t && shell.contains(t))) continue;   // 自己内部的刷新不算
          schedulePlace(false);
          return;
        }
      })
    : null;
  if (mo) mo.observe(container, { childList: true, subtree: true });

  /* ---- 频率轴 ---- */
  let axisSpecLen = -1;
  let axisSr = -1;
  const buildAxis = () => {
    let specLen = 1024;
    const a = getAudio();
    if (a && typeof a.getSpectrum === 'function') {
      const s = a.getSpectrum();
      if (s && s.length) specLen = s.length;
    }
    const sr = sampleRate();
    const top = computeTopBin(specLen, sr);
    const { binHz } = specInfo(specLen, sr);
    axisEl.innerHTML = '';
    for (const i of AXIS_TICKS) {
      const f = Math.pow(i / (BARS - 1), 2) * top * binHz;
      const span = document.createElement('span');
      span.style.cssText =
        'position:absolute;top:0;font:9px/1 Consolas,"Cascadia Mono",monospace;' +
        'color:rgba(230,234,223,.45);white-space:nowrap;';
      if (i === 0) {
        span.style.left = '0'; span.style.transform = 'none';
      } else if (i === BARS - 1) {
        span.style.right = '0'; span.style.transform = 'none';
      } else {
        span.style.left = ((i + 0.5) / BARS * 100) + '%';
        span.style.transform = 'translateX(-50%)';
      }
      span.textContent = i === 0 ? '0' : fmtHz(f);
      axisEl.appendChild(span);
    }
    axisSpecLen = specLen;
    axisSr = sr;
  };
  buildAxis();

  /* ---- 读数（限速 120 ms，与原 viewer.js 一致） ---- */
  let lastRead = 0;
  const readMeters = (now) => {
    if (now - lastRead <= 120) return;
    lastRead = now;

    const a = getAudio();
    let power = 0;
    let peakHz = 0;

    if (a) {
      if (typeof a.getPower === 'function') power = a.getPower();
      if (typeof a.getSpectrum === 'function') {
        const s = a.getSpectrum();
        if (s && s.length) {
          let peak = 0, peakIndex = 0;
          for (let i = 0; i < s.length; i += 1) {
            if (s[i] > peak) { peak = s[i]; peakIndex = i; }
          }
          peakHz = peak > 0 ? Math.round(peakIndex * specInfo(s.length, sampleRate()).binHz) : 0;
        }
      }
    }

    const db = Math.round(-60 + 60 * Math.max(0, Math.min(1, Number(power) || 0)));
    const powerText = String(db);
    if (powerEl.textContent !== powerText) powerEl.textContent = powerText;

    const peakText = peakHz > 0
      ? (peakHz >= 1000 ? (peakHz / 1000).toFixed(1) + 'k' : String(peakHz))
      : '—';
    if (peakEl.textContent !== peakText) peakEl.textContent = peakText;
  };

  /* ---- 主绘制 ---- */
  const paint = () => {
    applySkin();
    const w = viewW;
    const h = viewH;
    if (!w || !h) { readMeters(performance.now()); return; }
    sg.clearRect(0, 0, w, h);

    const a = getAudio();
    let spectrum = null;
    if (a && typeof a.getSpectrum === 'function') {
      const s = a.getSpectrum();
      if (s && s.length) spectrum = s;
    }

    /* 频谱长度（fftSize）或假定采样率变了都要重建频率轴。 */
    if (spectrum && (spectrum.length !== axisSpecLen || sampleRate() !== axisSr)) buildAxis();

    const hasSignal = !!spectrum;
    const idleBase = opts().showIdleBase !== false;
    const bw = w / BARS;
    const specLen = spectrum ? spectrum.length : 1024;
    const top = computeTopBin(specLen, sampleRate());

    if (hasSignal) {
      for (let i = 0; i < BARS; i += 1) {
        const bin = Math.min(specLen - 1, Math.floor(Math.pow(i / (BARS - 1), 2) * top));
        const v = spectrum[bin] / 255;
        const bh = Math.max(2, v * h);
        sg.fillStyle = colOf(i, true);
        sg.fillRect(i * bw, h - bh, bw - 3, bh);
      }
    } else if (idleBase) {
      for (let i = 0; i < BARS; i += 1) {
        sg.fillStyle = colOf(i, false);
        sg.fillRect(i * bw, h - 2, bw - 3, 2);
      }
    }

    readMeters(performance.now());
  };

  /* ---- 帧循环：音频数值每帧刷新、无事件通知，只能在帧里主动读。
     ctx.onFrame 跑在宿主自己的帧循环上（多模组共享），mount 结束自动停。 ---- */
  const stopFrame = ctx.onFrame(() => paint());

  /* ---- 避让轮询（400 ms）：同样走 ctx.every，由宿主在 mount 结束时停掉 ---- */
  const stopPlaceTimer = ctx.every(AVOID.interval, () => autoPlace(performance.now()));

  /* ---- 卸载 ---- */
  return () => {
    stopFrame();
    stopPlaceTimer();
    if (notifyViewBack === onViewBack) notifyViewBack = null;
    clearTimeout(revealTimer);
    try { ro.disconnect(); } catch (_) {}
    try { co && co.disconnect(); } catch (_) {}
    try { mo && mo.disconnect(); } catch (_) {}
    try { shell.remove(); } catch (_) {}
  };
};

/* ---- 迷你读数格（HTML 模板）。data-meter 挂在"数值"<span> 上，单位 <small> 是它的兄弟节点：
       刷新数值时只改 span 的 textContent，单位不会被冲掉。
       （旧版把 data-meter 放在 <strong> 上、用 innerHTML 写值，第一次读数就把 dB / Hz 抹了。） ---- */
const meterHtml = (label, unit, key) => `
  <div style="flex:1 1 0;min-width:0;padding-right:8px;">
    <span style="display:block;font-size:9px;color:rgba(230,234,223,.55);">${label}</span>
    <strong style="
      display:block;font:600 14px/1.3 Consolas,"Cascadia Mono",monospace;
      color:#f2f7ea;margin-top:2px;"><span data-meter="${key}">—</span>${unit ? `<small style="font-size:9px;color:rgba(230,234,223,.55);margin-left:2px;">${unit}</small>` : ''}</strong>
  </div>
`;

/* ============================================================
   默认导出 activate(folium)
   ============================================================ */

export default function activate(folium) {
  /* 本模组按 Folium 1.6 的声明方式写：ctx.audio、ctx.onFrame / ctx.every、
     settingsSections 句柄的 `.settings`（不再是 `.params`）。mod.json 声明了
     `"folia": ">=0.7.21"`，老宿主在加载前就会被拦下，这里不需要版本探测。 */

  /* 设置分区（句柄上的 `.settings` 就是 FoliumSettingAccess） */
  const section = folium.registries.settingsSections.register({
    id: 'spectrum-visualizer',
    label: { 'zh-CN': '频谱可视化', en: 'Spectrum visualizer' },
    description: {
      'zh-CN': '播放页左下角的频谱小组件，带自动避让；算法与配色与原 spectrum-viewer 一致。',
      'en': 'A compact spectrum widget on the player page with auto-avoid; algorithm and palette match the standalone spectrum-viewer.',
    },
    settings: [
      {
        key: 'showIdleBase',
        type: 'boolean',
        label: { 'zh-CN': '空闲时画底座', en: 'Idle base bar' },
        description: {
          'zh-CN': '无音频信号时是否在频谱柱最低位画一条暗色线条。',
          'en': 'When there is no audio signal, paint a thin dark bar at the bottom of the spectrum.',
        },
        defaultValue: true,
      },
      {
        key: 'autoAvoid',
        type: 'boolean',
        label: { 'zh-CN': '自动避让', en: 'Auto avoid' },
        description: {
          'zh-CN': '检测宿主元素（如下一首预告、播放控件）是否挡住组件：被挡住时自动上移或换到右侧，躲开后回到左下角默认位。关掉则固定停在左下角。',
          'en': 'Detect host elements (next-track preview, controls) overlapping the widget; move up or to the right when blocked, and return to the default bottom-left corner once clear. Turn off to pin it at the bottom-left.',
        },
        defaultValue: true,
      },
      {
        key: 'sampleRate',
        type: 'number',
        label: { 'zh-CN': '假定采样率（Hz）', en: 'Assumed sample rate (Hz)' },
        description: {
          'zh-CN': '宿主不暴露 AudioContext 采样率，峰值频率与频率轴按它折算。默认 44100（Folia 内部按 21.5 Hz/格划分频段，即 44100/2048）。填多少用多少，填 0 或非法值则退回 44100。',
          'en': 'The host does not expose the AudioContext sample rate, so peak frequency and the frequency axis are derived from this. Default 44100 (Folia itself indexes the spectrum at 21.5 Hz/bin = 44100/2048). Whatever you enter is used as-is; 0 or an invalid value falls back to 44100.',
        },
        min: 8000,
        max: 192000,
        step: 100,
        defaultValue: DEFAULT_SR,
      },
      {
        key: 'transparentBg',
        type: 'boolean',
        label: { 'zh-CN': '背景透明', en: 'Transparent background' },
        description: {
          'zh-CN': '去掉卡片底色、毛玻璃与描边，只留频谱柱和读数 —— 直接叠在封面/视频画面上（歌词区依旧不占）。',
          'en': 'Drop the card fill, blur and hairline border so only the bars and readouts remain, sitting straight on the artwork.',
        },
        defaultValue: false,
      },
    ],
  });

  /* 注册播放页图层：歌词之上、播放器控件之下。
     需要 mod.json 里的 `stageLayers` 权限（1.5 及更早叫 `ui.stage`，Folium 2 移除）。 */
  const offView = folium.events.on('app.viewChanged', (event) => {
    appView = event && typeof event.view === 'string' ? event.view : 'player';
    if (appView === 'player' && notifyViewBack) notifyViewBack();
  });

  const layerHandle = folium.registries.stageLayers.register({
    id: 'spectrum-widget',
    slot: 'player.stage.front',
    mount: (container, ctx) => mountStageWidget(section, container, ctx, folium.log),
  });

  /* 卸载：返回函数即 1.6 / 2.0 的规范写法（不再用 { dispose }）。 */
  return () => {
    try { offView(); } catch (_) {}
    try { layerHandle.unregister(); } catch (_) {}
    try { section.unregister(); } catch (_) {}
  };
}
