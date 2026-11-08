// mods/stardrift/client.mjs
// 「星潮 Stardrift v3 银河版」：Folium 歌词动画模组（纯渲染端，无权限）。
//
// 视觉设计（Canvas 2D）：
//   - 背景：整片银河——大量星星沿斜向银河带聚集，大小随机（大星带十字光芒），
//     各自按不同节奏闪烁；银河带中心有淡星云光晕；
//   - 歌词：当前句的每个字都在屏幕【随机位置】独立呈现——
//     先是一颗小光点，逐渐放大、渐变成字（颜色由强调色渐变为文字主色）；
//     唱完这个字之后，再慢慢缩小、缩回光点消失；
//   - 每个字的位置随机散布，不排成整齐一行；同句字之间做简单防重叠；
//   - 辉光与星星亮度随音乐响度呼吸（无音频时随时间缓慢起伏）。
//
// 实现说明：
//   - ctx.onFrame 宿主帧循环驱动；暂停时粒子与生命周期静止；
//   - ctx.onResize 重建画布、银河与字位置；ctx.onChange 处理主题/设置/字号变化；
//   - mount 结束宿主自动停止帧循环与监听，disposer 只做清理。

const BASE_FONT_SIZE = 64;

const colorProbe = document.createElement('canvas').getContext('2d');
const rgbCache = new Map();
const toRgb = (color, fallback) => {
  if (rgbCache.has(color)) return rgbCache.get(color);
  colorProbe.fillStyle = fallback;
  colorProbe.fillStyle = color || fallback;
  const value = colorProbe.fillStyle;
  let rgb;
  if (value.startsWith('#')) {
    rgb = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  } else {
    const parts = value.match(/[\d.]+/g) ?? ['255', '255', '255'];
    rgb = parts.slice(0, 3).map(Number);
  }
  rgbCache.set(color, rgb);
  return rgb;
};
const rgba = (color, alpha, fallback) => {
  const [r, g, b] = toRgb(color, fallback);
  return `rgba(${r},${g},${b},${alpha})`;
};
const mixRgb = (from, to, t) => [0, 1, 2].map((i) => Math.round(from[i] + (to[i] - from[i]) * t));
const rgbStr = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
const easeIn = (k) => k * k * k;

// 逐字时间：优先用歌词自带的 word 时间，否则按整行均匀切分。
// 空白字符（空格等）不渲染也不占时间——否则会画出"看不见的字"却亮着光圈。
// 标点符号保留在时间轴里（不占额外时间设计），是否显示由渲染层「屏蔽标点」开关决定——
// 关闭开关时同一行的标点立即恢复显示，无需重建字列表、不会打断正在读的字。
const visibleChars = (text) => Array.from(text).filter((ch) => !/\s/.test(ch));
// 「屏蔽标点」只隐藏标点符号（白名单）。不用 Unicode 全标点类 \p{P}——
// \p{P} 会把脚注符、项目符号、数字序号等符号型字符也一起吞掉，误伤歌词里的字。
// 不在名单内的字符一律照常显示、照常亮圈。
// 间隔号「·」「・」与省略号「…」是两个不同字符（U+00B7/U+30FB vs U+2026），
// 字形也差一个点，屏蔽省略号不会影响间隔号——间隔号按你的口径不在名单内，照常显示。
const PUNCT_SET = new Set([
  '，', '。', '、', '！', '？', '；', '：', '“', '”', '‘', '’', '（', '）',
  '【', '】', '《', '》', '〈', '〉', '「', '」', '『', '』', '…', '—', '–', '‥',
  ',', '.', '!', '?', ';', ':', '(', ')', '[', ']', '{', '}', '"', "'", '-', '~', '`',
  '@', '#', '$', '%', '^', '&', '*', '+', '=', '_', '/', '\\', '|', '<', '>',
]);
const buildCharTimings = (line) => {
  const timings = [];
  if (line.words.length > 0) {
    line.words.forEach((word) => {
      const chars = visibleChars(word.text);
      const duration = Math.max(0.001, word.endTime - word.startTime);
      chars.forEach((char, index) => {
        timings.push({
          char,
          start: word.startTime + (duration * index) / chars.length,
          end: word.startTime + (duration * (index + 1)) / chars.length,
        });
      });
    });
    // 异常空隙修正：歌词数据偶尔把"行尾字"的时间戳错标到行末（如行尾字被甩到
    // 整行最后），导致正常读词时该字永远等不到、渲染不出来。
    // 判定条件（只针对"行尾字 + 行尾大段空白"这种强错位特征，避免误伤本来就
    // 慢速隔开、字均匀分布在整行的歌词）：
    //   ① 行尾字与前一字空隙 > 3 秒；
    //   ② 该空隙占整行时长的 30% 以上（行内字都挤在前段、行尾大段空白）。
    // 满足才把行尾字前移接上前字（留 0.1s 自然间隔）。
    const MAX_GAP = 3;
    const n = timings.length;
    if (n >= 2) {
      const last = timings[n - 1];
      const prev = timings[n - 2];
      const gap = last.start - prev.end;
      const lineSpan = Math.max(0.001, line.endTime - line.startTime);
      if (gap > MAX_GAP && gap > 0.3 * lineSpan) {
        const shift = gap - 0.1;
        last.start -= shift;
        last.end -= shift;
      }
    }
    return timings;
  }
  const chars = visibleChars(line.fullText);
  const duration = Math.max(0.001, line.endTime - line.startTime);
  return chars.map((char, index) => ({
    char,
    start: line.startTime + (duration * index) / chars.length,
    end: line.startTime + (duration * (index + 1)) / chars.length,
  }));
};

const mountStardrift = (folium, container, ctx) => {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
  container.appendChild(canvas);
  const g = canvas.getContext('2d');

  let settings = ctx.getSettings();
  let lastMeteor = Number(settings.meteor ?? 15); // 上次流星频率，其变化时清流星池
  let lastMeteorSize = Number(settings.meteorSize ?? 1); // 上次流星大小，其变化时清流星池（旧流星重生成新大小）
  let lastStarSize = Number(settings.starSize ?? 1); // 上次星星大小，其变化时重建星池
  let width = 1;
  let height = 1;
  let renderedIndex = -2;
  let starPool = []; // 随机出现的星星池：位置/大小/时刻全随机，闪亮后消失
  let meteors = []; // 流星池：从屏幕外滑入、穿过画面再滑出
  let lastTime = null; // 上一帧时间（秒），用于流星按秒速移动
  let chars = []; // 当前句浮字：[{char,rx,ry,start,end,dur,residual}]

  const fontSpec = () => {
    const theme = ctx.getTheme();
    const family = folium.theme.resolveFontStack(theme);
    const weight = folium.theme.resolveFontWeight(theme, 500);
    const px = BASE_FONT_SIZE * Number(settings.fontScale ?? 1) * ctx.getDisplay().lyricsFontScale;
    return { family, weight, px, css: `${weight} ${px}px ${family}` };
  };

  const applySize = (w, h) => {
    width = Math.max(1, w);
    height = Math.max(1, h);
    const dpr = Math.min(typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    starPool = []; // 尺寸变化，旧星清空，由后续帧按密度随机补充
  };

  // ---- 银河背景：随机出现的星星 ----
  // 每颗星在随机位置、随机时刻冒出来，按随机大小/节奏闪亮呼吸，随后消失；
  // 池随帧自然更替，不重建、不固定，背景持续流动。
  // 四角星（圆润星芒）统一绘制：背景星星、流星头部与歌词字底衬都用它，形状一致。
  const traceSparklePath = (g, x, y, size) => {
    g.beginPath();
    const inner = size * 0.45;
    for (let i = 0; i < 8; i += 1) {
      const ang = (Math.PI / 4) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? size : inner;
      const px = x + Math.cos(ang) * rad;
      const py = y + Math.sin(ang) * rad;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  };
  const paintSparkle = (g, x, y, size, color, alpha) => {
    g.globalAlpha = Math.min(1, alpha);
    g.fillStyle = color;
    traceSparklePath(g, x, y, size);
    g.fill();
  };

  const spawnStar = (now) => {
    // 约四成沿较宽的斜向银河带生成，其余散落全屏，整体分布更均匀、不成一条线。
    const onBand = Math.random() < 0.4;
    let x;
    let y;
    if (onBand) {
      const t = Math.random();
      const bx = width * (0.15 + 0.7 * t);
      const by = height * (0.25 + 0.5 * t);
      x = bx + (Math.random() - 0.5) * width * 0.3;
      y = by + (Math.random() - 0.5) * height * 0.26;
    } else {
      x = Math.random() * width;
      y = Math.random() * height;
    }
    return {
      x,
      y,
      baseSize: (0.6 + Math.pow(Math.random(), 1.8) * 2.4) * Number(settings.starSize ?? 1), // 大部分小、少量大；星星大小可调
      speed: 0.25 + Math.random() * 1.0, // 呼吸快慢：整体更慢，慢慢闪
      phase: Math.random() * TAU,
      born: now, // 出生时刻
      lifetime: 1.6 + Math.random() * 3.2, // 存续 1.6~4.8s 随机
      tint: Math.random(),
    };
  };

  // ---- 流星：从屏幕外随机方向滑入，穿过画面再从另一侧滑出 ----
  // 数量由设置 meteor（0/1/2/3）控制；速度为每秒像素，随帧率自适应；
  // 拖尾是一条由亮到透明渐隐的线，头部是四角星。
  const spawnMeteor = (now) => {
    // 随机起点：四条屏幕边缘之外，让流星从画面外滑入
    const side = Math.floor(Math.random() * 4);
    let x;
    let y;
    if (side === 0) { x = Math.random() * (width + 240) - 120; y = -40 - Math.random() * 90; }
    else if (side === 1) { x = width + 40 + Math.random() * 90; y = Math.random() * height; }
    else if (side === 2) { x = Math.random() * (width + 240) - 120; y = height + 40 + Math.random() * 90; }
    else { x = -40 - Math.random() * 90; y = Math.random() * height; }
    // 方向：朝屏幕中心方向并带随机偏角，保证斜向穿过画面
    const ang = Math.atan2(height / 2 - y, width / 2 - x) + (Math.random() - 0.5) * 0.9;
    const spd = 420 + Math.random() * 360;
    return {
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      born: now,
      len: 110 + Math.random() * 90, // 拖尾线长度（px）
      width: (1.6 + Math.random() * 1.4) * Number(settings.meteorSize ?? 1), // 流星大小可调
      tint: Math.random(),
    };
  };

  // ---- 歌词浮字：每字随机位置，同句防重叠 ----
  // 换行时旧句仍在淡出的字保留为“残余”，继续缩小消失，画面平滑衔接不跳变。
  // 位置存相对坐标（rx/ry），画布尺寸变化自动适配，不重建背景。
  const buildChars = (index, now, speed) => {
    // 换行时：未开始的旧字直接丢弃；已开始但还没走完生命周期的旧字保留为残余，
    // 不打断其自然节奏——继续「念唱保持 → 停留显示 → 缩小消失」，
    // 上一句最后一个字换句后仍会停留 holdSec 再消失，不会闪掉。
    const holdSec = Math.max(0, Number(settings.hold ?? 0.5));
    // 上下级约束：缩放时间（跳入放大，秒）不会超过停留时间——字先完整放大再唱/停留。
    const appearT = Math.min(Math.max(0.2, Number(settings.zoom ?? 0.5)), holdSec || 0.2);
    const fadeT = appearT * 2;
    chars = chars.filter((c) => c.residual || now >= c.start);
    chars.forEach((c) => {
      if (!c.residual && (now - c.start) / speed <= appearT + c.dur + holdSec + fadeT) {
        c.residual = true;
      }
    });
    const line = index >= 0 ? ctx.lines[index] : null;
    if (!line || !line.fullText.trim()) return;
    const timings = buildCharTimings(line);
    const px = fontSpec().px;
    const minDist = Math.max(90, px * 1.15);
    const placed = [];
    const tryPlace = () => {
      for (let i = 0; i < 8; i += 1) {
        const x = width * (0.08 + Math.random() * 0.84);
        const y = height * (0.14 + Math.random() * 0.72);
        if (!placed.some((p) => Math.hypot(p.x - x, p.y - y) < minDist)) {
          placed.push({ x, y });
          return { x, y };
        }
      }
      const x = width * (0.08 + Math.random() * 0.84);
      const y = height * (0.14 + Math.random() * 0.72);
      placed.push({ x, y });
      return { x, y };
    };
    timings.forEach((t) => {
      const { x, y } = tryPlace();
      chars.push({
        char: t.char,
        rx: x / width,
        ry: y / height,
        start: t.start,
        end: t.end,
        dur: Math.max(0.05, t.end - t.start),
        residual: false,
      });
    });
  };

  // 字生命周期：光点放大成字（缩放时间，秒，受停留时间约束）→ 保持念唱 → 停留显示 → 变色缩小消失（缩放时间×2）。

  // 按歌词时间定位当前行：进度跳转后立刻定位到正确行，不依赖播放器行索引的滞后更新。
  const locateLine = (t) => {
    const ls = ctx.lines;
    if (!Array.isArray(ls) || ls.length === 0) return -1;
    for (let i = 0; i < ls.length; i += 1) {
      const st = ls[i].startTime;
      const en = ls[i].endTime;
      if (typeof st === 'number' && typeof en === 'number' && t >= st && t < en) return i;
    }
    const first = ls[0];
    if (typeof first.startTime === 'number' && t < first.startTime) return 0;
    return ls.length - 1;
  };

  const draw = () => {
    const time = ctx.lyricTime.get();
    const paused = ctx.isPaused();
    // 帧间隔（秒），用于流星按秒速移动；首帧按 1/60。
    const dt = lastTime == null ? 1 / 60 : Math.min(0.1, Math.max(0, time - lastTime));
    const jumped = lastTime != null && (time - lastTime < -0.01 || time - lastTime > 0.5);
    lastTime = time;
    if (jumped) {
      // 进度跳转（快进/回退）：清掉按旧时间线残留的星星、流星、歌词字，
      // 下一帧按新时间重建，避免"背景消失/画面空白卡住"。
      starPool = [];
      meteors = [];
      chars = [];
      renderedIndex = -1;
    }

    const theme = ctx.getTheme();
    const primary = toRgb(theme.primaryColor, theme.isDaylight ? '#000' : '#fff');
    const accent = toRgb(theme.accentColor, theme.isDaylight ? '#000' : '#fff');
    const secondary = toRgb(theme.secondaryColor, theme.isDaylight ? '#666' : '#ccc');
    const fallback = theme.isDaylight ? '#000' : '#fff';
    const { px, css } = fontSpec();

    const sweep = Number(settings.sweep ?? 1);
    const glowScale = Number(settings.glow ?? 1);
    const pulseOn = settings.pulse !== false;
    const intensity = theme.animationIntensity === 'chaotic' ? 1.4 : theme.animationIntensity === 'calm' ? 0.6 : 1;

    let pulse = 1;
    if (pulseOn) {
      if (ctx.audio) {
        const power = Math.min(1, ctx.audio.getPower());
        pulse = 0.8 + 0.4 * power;
      } else {
        pulse = 0.92 + 0.08 * Math.sin(time * 2.2);
      }
    }
    const speed = Math.max(0.4, sweep);

    const index = ctx.staticMode && ctx.staticLineIndex !== null
      ? ctx.staticLineIndex
      : jumped ? locateLine(time) : ctx.getLineIndex();
    if (index !== renderedIndex) {
      renderedIndex = index;
      buildChars(index, time, speed);
    }

    if (!paused) {
      // 生命周期已结束的字（含残余淡出完毕）统一清理，防数组累积。
      const holdSec = Math.max(0, Number(settings.hold ?? 0.5));
      // 上下级约束：缩放时间（跳入放大，秒）不会超过停留时间。
      const appearT = Math.min(Math.max(0.2, Number(settings.zoom ?? 0.5)), holdSec || 0.2);
      const fadeT = appearT * 2;
      chars = chars.filter((c) => (time - c.start) / speed <= appearT + c.dur + holdSec + fadeT);
    }

    // ---- 背景银河 ----
    g.clearRect(0, 0, width, height);

    // 银河星云光晕：位置固定，只随整体亮度呼吸，不随歌词移动。
    const nebulaX = width * 0.5;
    const nebulaY = height * 0.5;
    const neb = g.createRadialGradient(nebulaX, nebulaY, 0, nebulaX, nebulaY, Math.max(width, height) * 0.55);
    neb.addColorStop(0, rgba(theme.primaryColor, 0.05 * pulse, fallback));
    neb.addColorStop(0.5, rgba(theme.accentColor, 0.035 * pulse, fallback));
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = neb;
    g.fillRect(0, 0, width, height);

    // 星星池：过期移除；按密度以随机概率补充新星（随机位置随机时刻冒出来），
    // 并保证画面始终有一定数量在闪，首帧自动填满。
    starPool = starPool.filter((s) => { const age = time - s.born; return age >= 0 && age < s.lifetime; });
    const spawnProb = Math.min(0.5, Math.max(4, Number(settings.density ?? 150)) / 180);
    if (starPool.length < Number(settings.density ?? 150) * 1.6 && Math.random() < spawnProb) {
      starPool.push(spawnStar(time));
    }
    while (starPool.length < Math.max(10, Number(settings.density ?? 150) * 0.6)) {
      starPool.push(spawnStar(time));
    }

    // 星星：随机位置冒出的四角星（圆润星芒）——出现→呼吸闪亮→消失，持续更替不固定。
    starPool.forEach((s) => {
      const life = (time - s.born) / s.lifetime;
      if (life < 0 || life >= 1) return;
      const env = life < 0.15 ? life / 0.15 : life > 0.85 ? (1 - life) / 0.15 : 1;
      const breathe = 0.5 + 0.5 * Math.sin(s.speed * time * 1.2 + s.phase);
      const alpha = (0.15 + 0.85 * breathe) * env * (0.8 + 0.2 * pulse);
      const size = s.baseSize * (0.6 + 0.8 * env) * (0.85 + 0.3 * breathe);
      const col = s.tint < 0.55
        ? rgba(theme.primaryColor, 1, fallback)
        : s.tint < 0.85 ? rgba(theme.accentColor, 1, fallback) : rgba(theme.secondaryColor, 1, fallback);
      paintSparkle(g, s.x, s.y, size, col, Math.min(1, alpha));
    });
    g.globalAlpha = 1;

    // ---- 流星：按设置数量（0/1/2/3）随机出现，从屏幕外滑入再滑出 ----
    // 属于背景层：只有流星数量/大小设置变化时才清空，切行/主题变化不影响它。
    // meteor=同时出现在屏幕上的流星个数：0=关闭、1/2/3=同屏最多几颗（少了就补）。
    meteors = meteors.filter((m) => m.x > -300 && m.x < width + 300 && m.y > -300 && m.y < height + 300);
    const wantMeteors = Math.max(0, Math.min(3, Math.round(Number(settings.meteor ?? 1))));
    if (wantMeteors > 0 && meteors.length < wantMeteors && Math.random() < 0.2) {
      meteors.push(spawnMeteor(time));
    }
    meteors.forEach((m) => {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // 拖尾线颜色（头部亮、尾部渐隐透明），头部用四角星
      const base = m.tint < 0.5 ? theme.primaryColor : m.tint < 0.85 ? theme.accentColor : theme.secondaryColor;
      g.save();
      // 拖尾：一条由头部亮到尾部透明的渐隐线，不是均匀实线
      const spd = Math.hypot(m.vx, m.vy);
      const tx = m.x - (m.vx / spd) * m.len;
      const ty = m.y - (m.vy / spd) * m.len;
      const grad = g.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, rgba(base, 0.95, fallback));
      grad.addColorStop(1, rgba(base, 0, fallback));
      g.globalAlpha = 0.9;
      g.strokeStyle = grad;
      g.lineWidth = m.width;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(m.x, m.y);
      g.stroke();
      // 头部：亮四角星（与背景星星形状一致）
      paintSparkle(g, m.x, m.y, m.width * 2.6, rgba(base, 1, fallback), 1);
      g.restore();
    });
    g.globalAlpha = 1;

    // ---- 歌词浮字（每个字自带柔光罩） ----
    // 正在读的字会亮出一个模模糊糊的透明光圈罩住它：字出现，圈跟它一起慢慢变大罩住；
    // 字读完后，圈缓慢变小、变淡到消失；下一个字出现，圈再从那个字慢慢变大罩住它。
    // 光罩是径向渐变，中心亮、向外单调衰减，没有明显的环线或硬边。
    const showText = ctx.getDisplay().showText;
    if (showText) {
      g.font = css;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // 每个字念完后停留显示 holdSec 秒（默认 0.5，设置可调），避免句子读得快时看不清。
      // 跳入放大时长 = 缩放时间（秒，受停留时间上限约束）；变色+缩小 = 缩放时间 × 2。
      const holdSec = Math.max(0, Number(settings.hold ?? 0.5));
      const appearT = Math.min(Math.max(0.2, Number(settings.zoom ?? 0.5)), holdSec || 0.2);
      const fadeT = appearT * 2;
      chars.forEach((c) => {
        // 屏蔽标点：白名单内的句读标点不显示、也不亮光圈（开关 punctHide，默认开）
        if (settings.punctHide !== false && PUNCT_SET.has(c.char)) return;
        const local = (time - c.start) / speed;
        const holdEnd = appearT + c.dur + holdSec;
        if (local < 0 || local > holdEnd + fadeT) return;
        let k;
        let mode;
        if (local < appearT) {
          mode = 'appear';
          k = clamp01(local / appearT);
          if (k <= 0) return;
        } else if (local < holdEnd) {
          mode = 'hold';
          k = 1;
        } else {
          mode = 'fade';
          k = 1 - clamp01((local - holdEnd) / fadeT);
        }
        // 渐变：出现时强调色 → 主色（正在读的字=主题色）；唱完的字从主题色慢慢变回强调色再缩小消失，辉光保留。
        let color;
        if (mode === 'appear') color = mixRgb(accent, primary, easeOut(k));
        else if (mode === 'fade') color = mixRgb(primary, accent, 1 - easeIn(k));
        else color = primary;
        const scale = mode === 'fade' ? 0.12 + 0.88 * easeIn(k) : 0.12 + 0.88 * easeOut(k);
        const alpha = mode === 'fade' ? k : mode === 'appear' ? k : 0.8 + 0.2 * pulse;
        const blur = mode === 'hold'
          ? 18 * glowScale * pulse
          : mode === 'appear' ? 24 * glowScale * k * pulse : 18 * glowScale * k * pulse;
        g.globalAlpha = Math.min(1, alpha);
        g.fillStyle = rgbStr(color);
        g.shadowColor = theme.accentColor;
        g.shadowBlur = glowScale <= 0 ? 0 : blur;
        // 字自带柔光罩（开关 settings.ring、深浅 settings.ringLevel）：画在字底下。
        // 圈的成长与**字的视觉大小严格同步**（字小圈小、字大圈大）——避免字还没长全、
        // 圈却已经很大，看起来像"没字的地方也亮着光圈"。
        // 字出现圈一起慢慢变大罩住；正在读保持；字读完圈快速缩小变淡消失。
        // 径向渐变中心亮、向外单调衰减，无环线硬边。
        const ringOn = Boolean(settings.ring ?? true);
        const ringLevel = Math.max(0, Number(settings.ringLevel ?? 1));
        if (ringOn && ringLevel > 0) {
          let ringK; // 圈相对最终大小的比例（与字视觉大小同步）
          if (local < appearT) {
            ringK = 0.12 + 0.88 * easeOut(k); // 跟字一起慢慢长大
          } else if (local < appearT + c.dur) {
            ringK = 1; // 正在读：保持罩住
          } else {
            // 读完：快速缩小变淡（窗口=缩放时间，收尾干脆）
            ringK = 1 - clamp01((local - appearT - c.dur) / Math.max(0.2, appearT));
          }
          // 英文/数字不亮圈：英文字母密集出现，光罩会太亮（开关 ringLatin，默认开）
          if (ringK > 0.02 && !(settings.ringLatin !== false && /^[A-Za-z0-9]$/.test(c.char))) {
            const ringR = px * 1.45 * ringK * Math.max(0.5, Number(settings.ringSize ?? 1));
            const cx = c.rx * width;
            const cy = c.ry * height;
            const lv = ringLevel * ringK;
            const grad = g.createRadialGradient(cx, cy, ringR * 0.05, cx, cy, ringR);
            grad.addColorStop(0, rgba(theme.accentColor, 0.12 * lv, fallback));
            grad.addColorStop(0.35, rgba(theme.accentColor, 0.08 * lv, fallback));
            grad.addColorStop(0.7, rgba(theme.accentColor, 0.035 * lv, fallback));
            grad.addColorStop(1, rgba(theme.accentColor, 0, fallback));
            g.save();
            g.globalAlpha = 1;
            g.fillStyle = grad;
            g.beginPath();
            g.arc(cx, cy, ringR, 0, TAU);
            g.fill();
            g.restore();
            g.globalAlpha = Math.min(1, alpha);
          }
        }
        g.save();
        g.translate(c.rx * width, c.ry * height);
        g.scale(scale, scale);
        g.fillText(c.char, 0, 0);
        g.restore();
      });
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
  };

  applySize(container.clientWidth || 1, container.clientHeight || 1);
  ctx.onResize(({ width: w, height: h }) => {
    applySize(w, h);
  });
  ctx.onFrame(draw);
  ctx.onChange(() => {
    const prevMeteor = lastMeteor;
    const prevStarSize = lastStarSize;
    const prevMeteorSize = lastMeteorSize;
    settings = ctx.getSettings();
    lastMeteor = Number(settings.meteor ?? 15);
    lastStarSize = Number(settings.starSize ?? 1);
    lastMeteorSize = Number(settings.meteorSize ?? 1);
    // 流星与星星属于背景层：只有它们各自的设置变化才清空/重建，切行与主题变化不影响。
    // 流星频率或大小变化都清空流星池（旧流星按旧大小定格，清掉重生成，大小变化立即生效）。
    if (lastMeteor !== prevMeteor || lastMeteorSize !== prevMeteorSize) meteors = [];
    if (lastStarSize !== prevStarSize) starPool = [];
    draw();
  });

  return () => {
    canvas.remove();
    starPool = [];
    meteors = [];
    chars = [];
  };
};

const settings = [
  {
    key: 'sweep',
    type: 'number',
    label: { 'zh-CN': '变化速度', en: 'Speed' },
    description: { 'zh-CN': '星星放大成字、念完缩回的整体节奏快慢', en: 'How fast stars grow into characters and shrink back' },
    min: 0.5,
    max: 2,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'glow',
    type: 'number',
    label: { 'zh-CN': '辉光强度', en: 'Glow intensity' },
    description: { 'zh-CN': '文字与星星辉光的亮度大小', en: 'Brightness and size of the glow around text and stars' },
    min: 0,
    max: 2,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'density',
    type: 'number',
    label: { 'zh-CN': '星星数量', en: 'Star count' },
    description: { 'zh-CN': '背景银河的星星密度（30–300）', en: 'Star density of the background galaxy (30–300)' },
    min: 30,
    max: 300,
    step: 10,
    defaultValue: 150,
  },
  {
    key: 'fontScale',
    type: 'number',
    label: { 'zh-CN': '字号', en: 'Text size' },
    description: { 'zh-CN': '相对默认字号的倍率（叠加你的歌词字号设置）', en: 'Multiplier over the default size, on top of your lyric size setting' },
    min: 0.6,
    max: 1.6,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'pulse',
    type: 'boolean',
    label: { 'zh-CN': '音乐呼吸', en: 'Music pulse' },
    description: { 'zh-CN': '辉光与星星亮度随音乐响度呼吸；无音频时随时间缓慢起伏', en: 'Glow and star brightness breathe with loudness; falls back to a slow time-based pulse without audio' },
    defaultValue: true,
  },
  {
    key: 'ring',
    type: 'boolean',
    label: { 'zh-CN': '读字光罩', en: 'Reading glow' },
    description: { 'zh-CN': '正在读的字亮出一个模模糊糊的透明光圈罩住它：字出现圈慢慢变大罩住，字读完圈快速变淡消失，下一个字出现再从它那里长大。关闭后不显示', en: 'A soft, blur-edged translucent glow ring surrounds the currently-read character: it grows with the character, fades quickly after it finishes, and regrows at the next one. Off hides it' },
    defaultValue: true,
  },
  {
    key: 'ringLatin',
    type: 'boolean',
    label: { 'zh-CN': '英文不亮圈', en: 'Skip Latin glow' },
    description: { 'zh-CN': '开启后，英文字母与数字不显示光圈（中文照常）——英文歌字母多，去掉光罩更清爽', en: 'When on, Latin letters and digits get no glow ring (Chinese still does). Keeps Latin-heavy songs cleaner' },
    defaultValue: true,
  },
  {
    key: 'punctHide',
    type: 'boolean',
    label: { 'zh-CN': '屏蔽标点', en: 'Hide punctuation' },
    description: { 'zh-CN': '开启后，标点符号不显示、也不亮光圈（如 ，。！？、“”…）', en: "When on, punctuation marks are not drawn and get no glow ring (e.g. , . ! ? quotes …)" },
    defaultValue: true,
  },
  {
    key: 'starSize',
    type: 'number',
    label: { 'zh-CN': '星星大小', en: 'Star size' },
    description: { 'zh-CN': '背景星星的大小倍率（0.5 更小、2 更大）', en: 'Scale of background stars (0.5 smaller, 2 bigger)' },
    min: 0.5,
    max: 2,
    step: 0.1,
    defaultValue: 1,
  },
  {
    key: 'ringLevel',
    type: 'number',
    label: { 'zh-CN': '光罩深浅', en: 'Glow depth' },
    description: { 'zh-CN': '光罩的浓淡：0=不显示，1=默认，最高 2（更亮）', en: 'How strong the glow is: 0 hides it, 1 is the default, up to 2 for a brighter ring' },
    min: 0,
    max: 2,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'ringSize',
    type: 'number',
    label: { 'zh-CN': '光圈大小', en: 'Glow size' },
    description: { 'zh-CN': '光圈罩住字的范围：1=当前默认，0.5=小一半，2=大一倍', en: 'How large the glow ring is around the character: 1 default, 0.5 half size, 2 double' },
    min: 0.5,
    max: 2,
    step: 0.05,
    defaultValue: 1,
  },
  {
    key: 'hold',
    type: 'number',
    label: { 'zh-CN': '字停留', en: 'Char hold' },
    description: { 'zh-CN': '每个字念完后继续停留显示的时间（秒，最长 5 秒），句子读得快也不会看不清；0 为念完立即缩小', en: 'How long each character stays visible after being sung, so fast lyrics stay readable (up to 5s); 0 shrinks it immediately' },
    min: 0,
    max: 5,
    step: 0.1,
    defaultValue: 0.5,
  },
  {
    key: 'zoom',
    type: 'number',
    label: { 'zh-CN': '字缩放时间', en: 'Zoom time' },
    description: { 'zh-CN': '字从光点放大成字的跳入时长（秒，最长 5 秒）。提示：不会超过字停留时间——缩放调得比停留大时，实际按停留时长计算', en: 'Seconds for a character to grow in from a spark (up to 5s). Note: it never exceeds the hold time — if set above hold, the hold value applies' },
    min: 0.2,
    max: 5,
    step: 0.1,
    defaultValue: 0.5,
  },
  {
    key: 'meteor',
    type: 'number',
    label: { 'zh-CN': '流星数量', en: 'Meteor count' },
    description: { 'zh-CN': '同时出现的流星个数：0=关闭，1/2/3=屏幕上最多几颗', en: 'How many shooting stars at once: 0 off, 1–3 on screen at most' },
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 1,
  },
  {
    key: 'meteorSize',
    type: 'number',
    label: { 'zh-CN': '流星大小', en: 'Meteor size' },
    description: { 'zh-CN': '流星头部与拖尾的大小倍率（0.5 更小、2 更大）', en: 'Scale of meteor heads and trails (0.5 smaller, 2 bigger)' },
    min: 0.5,
    max: 2,
    step: 0.1,
    defaultValue: 1,
  },
];

export default function activate(folium) {
  folium.registries.visualizers.register({
    id: 'stardrift',
    label: { 'zh-CN': '星潮·银河', en: 'Stardrift Galaxy' },
    order: 460,
    mount: (container, ctx) => mountStardrift(folium, container, ctx),
    settings,
  });
}
