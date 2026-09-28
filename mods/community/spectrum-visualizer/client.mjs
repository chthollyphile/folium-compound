// mods/spectrum-visualizer/client.mjs
//
// Folium 1.2+ 播放页图层模组（stageLayer）。
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
//   · 音频走 ctx.audio（getPower / getSpectrum，Folium 1.2+）
//
// 与 visualizer 的区别：stageLayers 是播放页的叠加图层（歌词之上、控件之下，
// slot 'player.stage.front'），mount 只收 container（ctx 可能有也可能没有），
// 容器默认点击穿透 —— 纯显示组件正好。
//
// 渲染驱动：官方文档明确"音频数值每帧刷新、无事件通知，需在帧循环里主动读取"，
// 所以这里用 requestAnimationFrame 自驱循环（visualizer 用歌钟是因为它要跟歌词；
// 频谱是连续信号，rAF 更自然，也顺带兼容 mount 不给 ctx 的情况）。

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

const mountStageWidget = (settings, container, ctx, logger) => {
  /* ctx / audio 都是可选的（sample-rickroll 的 mount 只收 container），
     全部做防御式访问：拿不到就画空闲底座、读数显示 n/a。 */
  const audio = ctx && ctx.audio ? ctx.audio : null;
  const getAudio = () => (ctx && ctx.audio ? ctx.audio : audio);

  /* 走宿主的日志通道（落到 %APPDATA%\Folia\logs）：避让挪位、采样率兜底各记一行，
     出问题时可以直接看日志，不用猜。 */
  const log = (msg) => {
    try { if (logger && typeof logger.info === 'function') logger.info(msg); } catch (_) {}
  };

  /* 宿主不给采样率，靠设置项假定；峰值频率与频率轴都从这里取值。
     填多少用多少，非正值退回 DEFAULT_SR —— 生效值只写一行日志，方便核对
     （宿主会把 number 型设置项写歪，日志里能看出实际吃进去的是哪个数）。 */
  let lastSr = -1;
  const sampleRate = () => {
    const v = Number(settings.params.get().sampleRate);
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
     写成 [data-meter="x"] strong 这类带祖先/后代的组合会取到 null
     （0.1.0 就是在这里崩的），一律用属性选择器直接取。 */
  const powerEl = shell.querySelector('[data-meter="power"]');
  const peakEl = shell.querySelector('[data-meter="peak"]');

  container.appendChild(shell);

  /* ---- 外观：背景透明开关（每帧读一次设置，值变了才写样式） ---- */
  let transparentSkin = null;
  const applySkin = () => {
    const on = settings.params.get().transparentBg === true;
    if (on === transparentSkin) return;
    transparentSkin = on;
    shell.style.background = on ? 'transparent' : 'rgba(8,12,9,.42)';
    shell.style.boxShadow = on ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.07)';
    for (const p of ['backdrop-filter', '-webkit-backdrop-filter']) {
      try { shell.style.setProperty(p, on ? 'none' : 'blur(6px)'); } catch (_) {}
    }
  };
  applySkin();

  /* ---- 高 DPI 适配 ---- */
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
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
       4) 400 ms 轮询 + 容器 ResizeObserver + container 子树 childList 变化
          即时重算；连续两轮被挡才挪（≈ 800 ms），挪完 1.2 s 冷却，
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
    interval: 400,    // 轮询间隔（ms）
    bleedRatio: 0.6,  // 面积 ≥ 舞台 60% 的元素按背景层处理，不算遮挡
    minArea: 400,     // 小于 20×20 的元素忽略
    cols: 4, rows: 3, // 采样点阵
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

  /* 采样点上的元素链。故意同时问 shadow root 与 document：
     shadow DOM 里只有前者能看到兄弟层，document 那一层还能顺带发现外部浮层。 */
  const hitAt = (x, y) => {
    const out = [];
    if (hitRoot) {
      try { for (const n of hitRoot.elementsFromPoint(x, y)) out.push(n); } catch (_) {}
    }
    try {
      if (document.elementsFromPoint) {
        for (const n of document.elementsFromPoint(x, y)) if (!out.includes(n)) out.push(n);
      }
    } catch (_) {}
    return out;
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

  /* 矩形被挡得多厉害：命中点越多越"挡"。0 = 干净。
     out 传数组时顺带记下遮挡物描述，只用于日志诊断。 */
  const scoreRect = (r, cRect, out) => {
    if (!r.width || !r.height) return Number.MAX_SAFE_INTEGER;
    const stageArea = cRect.width * cRect.height;
    const seen = new Set();
    let hits = 0;
    for (let iy = 0; iy < AVOID.rows; iy += 1) {
      for (let ix = 0; ix < AVOID.cols; ix += 1) {
        const x = r.left + ((ix + 0.5) / AVOID.cols) * r.width;
        const y = r.top + ((iy + 0.5) / AVOID.rows) * r.height;
        for (const node of hitAt(x, y)) {
          if (!node || node.nodeType !== 1 || seen.has(node)) continue;
          seen.add(node);
          if (node === shell || shell.contains(node)) continue;
          if (coversContainer(node)) continue;
          const nr = node.getBoundingClientRect();
          if (nr.width * nr.height < AVOID.minArea) continue;
          if (stageArea > 0 && nr.width * nr.height >= stageArea * AVOID.bleedRatio) continue;
          let cs = null;
          try { cs = window.getComputedStyle(node); } catch (_) {}
          if (cs && (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0')) continue;
          if (!paints(node, cs)) continue;   // 透明布局壳不算遮挡
          hits += 1;
          if (out && out.length < 3) out.push(describe(node));
          break;   // 一个采样点最多记一次
        }
      }
    }
    return hits;
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
  let lastPlace = 0;
  let revealed = false;
  let legacyFix = false;

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    shell.style.opacity = '1';
  };
  const revealTimer = setTimeout(reveal, 900);   // 兜底：算不出位置也得先显出来

  const autoPlace = (now) => {
    /* 关掉自动避让 → 退回 0.2.x 的固定左下位。 */
    if (settings.params.get().autoAvoid === false) {
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

    const cRect = container.getBoundingClientRect();
    if (cRect.width < 160 || cRect.height < 100) return;   // 舞台还没量出来 / 太小，别折腾

    const cur = shell.getBoundingClientRect();
    const w = cur.width, h = cur.height;
    if (w < 60 || h < 40) return;

    /* transform 是纯平移，减掉当前偏移就能还原"未偏移"的基准位。 */
    const baseLeft = cur.left - curDx;
    const baseTop = cur.top - curDy;
    const curScore = scoreRect(cur, cRect);

    if (curScore > 0) { blocked += 1; cleanSince = 0; }
    else { blocked = 0; if (!cleanSince) cleanSince = now; }

    const spots = candidates(cRect, w, h);
    let scores = null;
    const clearIndex = () => {
      if (!scores) scores = spots.map((sp) => scoreRect(sp, cRect));
      return scores.indexOf(0);
    };

    let target = -1;
    if (curIndex < 0) {
      /* 首次定位：默认位（左下角）优先，被挡就往后挑；一个干净位都没有也先回默认位。 */
      const zero = clearIndex();
      target = zero !== -1 ? zero : 0;
    } else if (curScore === 0) {
      /* 没被挡：只有当前位置排在默认位之后、且已连续干净 3 s，才考虑回到默认位。 */
      if (curIndex > 0 && now - cleanSince > AVOID.smoothBack && now >= cooldownUntil) {
        const zero = clearIndex();
        if (zero !== -1 && zero < curIndex) target = zero;
      }
    } else if (blocked >= 2 && now >= cooldownUntil) {
      /* 被挡：只在真找得到 0 命中的位置时才挪；宁可不挪，也别挪进更挤的地方。 */
      target = clearIndex();
    }

    if (target < 0) { reveal(); return; }

    const dx = Math.round(spots[target].left - baseLeft);
    const dy = Math.round(spots[target].top - baseTop);
    if (dx !== curDx || dy !== curDy) {
      const blockers = [];
      if (curIndex >= 0 && curScore > 0) scoreRect(cur, cRect, blockers);
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
    reveal();
  };

  /* 挂载时同步定位一次，避免第一帧闪在容器左上角。 */
  autoPlace(performance.now());

  let placeQueued = false;
  const schedulePlace = () => {
    if (placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => { placeQueued = false; autoPlace(performance.now()); });
  };
  /* 舞台尺寸变化 / 子树增删（下一首预告滑入、歌词换行）→ 立刻重算。 */
  const co = typeof ResizeObserver === 'function' ? new ResizeObserver(schedulePlace) : null;
  if (co) co.observe(container);
  const mo = typeof MutationObserver === 'function'
    ? new MutationObserver((records) => {
        for (const rec of records) {
          const t = rec.target;
          if (t === shell || (t && shell.contains(t))) continue;   // 自己内部的刷新不算
          schedulePlace();
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
    powerEl.textContent = String(db);

    peakEl.textContent = peakHz > 0
      ? (peakHz >= 1000 ? (peakHz / 1000).toFixed(1) + 'k' : String(peakHz))
      : '—';
  };

  /* ---- 主绘制 ---- */
  const paint = () => {
    applySkin();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
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
    const idleBase = settings.params.get().showIdleBase !== false;
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

  /* ---- rAF 自驱循环（音频数据每帧刷新、无事件通知） ---- */
  let raf = 0;
  const loop = () => {
    paint();
    const now = performance.now();
    if (now - lastPlace >= AVOID.interval) { lastPlace = now; autoPlace(now); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  /* ---- 卸载 ---- */
  return () => {
    cancelAnimationFrame(raf);
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
  /* 能力探测：ctx.audio 是 Folium 1.2 才补的。老宿主只 warn、不退出——
     图层照常挂载（画空闲底座），audio 调用处有运行时探测。 */
  const minor = folium.host?.folium?.minor ?? 0;
  if (minor < 2) {
    folium.log.warn(
      'spectrum-visualizer needs Folium 1.2+ for ctx.audio; the widget will idle on this host.',
    );
  }

  /* 设置分区 */
  const settings = folium.registries.settingsSections.register({
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
     mount 可能只收到 container（sample-rickroll 就只用了 container），
     ctx 的获取在 mountStageWidget 里做防御式处理。 */
  const layerHandle = folium.registries.stageLayers.register({
    id: 'spectrum-widget',
    slot: 'player.stage.front',
    mount: (container, ctx) => mountStageWidget(settings, container, ctx, folium.log),
  });

  /* 卸载 */
  return () => {
    try { layerHandle.unregister(); } catch (_) {}
    try { settings.unregister(); } catch (_) {}
  };
}
