// AI 逐段歌词导演 1.0.0 — 把一首歌交给 AI 排成分段剧本，播放时在句子空隙逐段切换歌词动画模式。
// 参数白名单/门控、模式画像、内部接口用法取自 wittyfunn/lyric-ai-director-plus（MIT），
// 见 https://github.com/duoduo1232/lyric-ai-director 。
// 单一文件：无构建步骤，拖入 Folia 模组面板即可。

'use strict';

// 每次改动改这个数字：面板会显示它，用来确认 Folia 跑的是不是最新代码。
const BUILD_TAG = 'b83';

const T = (zh, en) => ({ 'zh-CN': zh, en });

// ============================================================ 参数白名单（MODE_PARAMS / PARAM_GATES）
const MODE_PARAMS = {
  classic: {
    setter: 'handleSetClassicTuning',
    params: {
      enableWordRotation: { kind: 'boolean', zh: '逐字旋转' },
      breathingFloatMultiplier: { kind: 'number', min: 0, max: 2, zh: '呼吸浮动' },
      wordSpacing: { kind: 'number', min: 0, max: 2, zh: '词间距' },
      useLegacyLayout: { kind: 'boolean', zh: '旧版排版' },
    },
  },
  cadenza: {
    setter: 'handleSetCadenzaTuning',
    params: {
      fontScale: { kind: 'number', min: 0.6, max: 2, zh: '字号' },
      widthRatio: { kind: 'number', min: 0.3, max: 1, zh: '行宽占比' },
      motionAmount: { kind: 'number', min: 0, max: 2, zh: '运动量' },
      glowIntensity: { kind: 'number', min: 0, max: 2, zh: '光晕强度' },
    },
  },
  partita: {
    setter: 'handleSetPartitaTuning',
    params: {
      showGuideLines: { kind: 'boolean', zh: '参考线' },
      useSemanticLayout: { kind: 'boolean', zh: '语义排版' },
      staggerMin: { kind: 'number', min: 0, max: 180, zh: '入场错开下限' },
      staggerMax: { kind: 'number', min: 0, max: 180, zh: '入场错开上限' },
    },
  },
  fume: {
    setter: 'handleSetFumeTuning',
    params: {
      hidePrintSymbols: { kind: 'boolean', zh: '隐藏印刷符号' },
      disableGeometricBackground: { kind: 'boolean', zh: '关闭几何背景' },
      backgroundObjectOpacity: { kind: 'number', min: 0, max: 1, zh: '背景元素不透明度' },
      textHoldRatio: { kind: 'number', min: 0, max: 1, zh: '文字停留比例' },
      cameraTrackingMode: { kind: 'select', options: ['stepped', 'smooth'], zh: '镜头跟随' },
      cameraSpeed: { kind: 'number', min: 0.55, max: 1.85, zh: '镜头速度' },
      glowIntensity: { kind: 'number', min: 0, max: 1.8, zh: '辉光强度' },
      heroScale: { kind: 'number', min: 0.82, max: 1.32, zh: '主字缩放' },
    },
  },
  claddagh: {
    setter: 'handleSetCladdaghTuning',
    params: {
      focusScaleRatio: { kind: 'number', min: 0, max: 1.5, zh: '聚焦缩放' },
      radiusScale: { kind: 'number', min: 0.5, max: 1.5, zh: '环半径' },
      ellipseTiltDeg: { kind: 'number', min: 0, max: 60, zh: '环倾角' },
      showAxisLine: { kind: 'boolean', zh: '轴线' },
      letterSpacingOffset: { kind: 'number', min: -5, max: 20, zh: '字距偏移' },
    },
  },
  cappella: {
    setter: 'handleSetCappellaTuning',
    params: {
      showEmoMessages: { kind: 'boolean', zh: '表情消息' },
      emojiPackSource: { kind: 'select', options: ['builtin', 'custom'], zh: '表情包来源' },
      avatarSource: { kind: 'select', options: ['builtin', 'cover', 'color', 'custom'], zh: '头像来源' },
    },
  },
  tilt: {
    setter: 'handleSetTiltTuning',
    params: {
      splitProbability: { kind: 'number', min: 0, max: 1, zh: '裂开概率' },
      tiltStyleProbability: { kind: 'number', min: 0, max: 1, zh: '倾斜样式概率' },
      colorScheme: { kind: 'select', options: ['default', 'swap', 'accentAll', 'primaryAll'], zh: '配色方案' },
    },
  },
  monet: {
    setter: 'handleSetMonetTuning',
    params: {
      keywordColoringEnabled: { kind: 'boolean', zh: '关键词着色' },
      audioStyle: { kind: 'select', options: ['bar', 'line'], zh: '音频样式' },
      showDescription: { kind: 'boolean', zh: '显示简介' },
      showAudioVisualization: { kind: 'boolean', zh: '音频可视化' },
      fontScale: { kind: 'number', min: 0.7, max: 1.5, zh: '字号' },
      portraitStyle: { kind: 'select', options: ['square', 'rectangular'], zh: '封面样式' },
    },
  },
  diorama: {
    setter: 'handleSetDioramaTuning',
    params: {
      cameraSpeed: { kind: 'number', min: 0.55, max: 1.85, zh: '镜头速度' },
      motionAmount: { kind: 'number', min: 0.4, max: 1.6, zh: '运动量' },
      audioReactivity: { kind: 'number', min: 0, max: 1.5, zh: '音频响应' },
      particleScale: { kind: 'number', min: 0.65, max: 1.6, zh: '粒子缩放' },
      showParticles: { kind: 'boolean', zh: '显示粒子' },
      glowEnabled: { kind: 'boolean', zh: '普通辉光跟唱' },
      glowIntensity: { kind: 'number', min: 0.1, max: 1.5, zh: '辉光强度' },
      soulEnabled: { kind: 'boolean', zh: '灵魂出窍跟唱' },
      soulIntensity: { kind: 'number', min: 0.1, max: 1.5, zh: '灵魂出窍强度' },
      gradientEnabled: { kind: 'boolean', zh: '渐变跟唱' },
      gradientIntensity: { kind: 'number', min: 0.1, max: 1.5, zh: '渐变强度' },
      keywordColoringEnabled: { kind: 'boolean', zh: '关键词着色' },
      soulActiveEnabled: { kind: 'boolean', zh: '当前字跟随漂移' },
      particleGlowEnabled: { kind: 'boolean', zh: '粒子光晕' },
      particleGlowIntensity: { kind: 'number', min: 0.1, max: 1.5, zh: '粒子光晕强度' },
    },
  },
  pendolo: {
    setter: 'handleSetPendoloTuning',
    params: {
      arcRadius: { kind: 'number', min: 0.25, max: 0.8, zh: '弧半径' },
      arcAngleDeg: { kind: 'number', min: 40, max: 160, zh: '弧角度' },
      tickSnappiness: { kind: 'number', min: 0.5, max: 2, zh: '走时干脆度' },
      activeScale: { kind: 'number', min: 1, max: 1.6, zh: '当前行缩放' },
      showGearDecor: { kind: 'select', options: ['none', 'subtle', 'full'], zh: '齿轮装饰' },
      showCenterGradient: { kind: 'boolean', zh: '中心渐变' },
      showCoverOnWatchFace: { kind: 'boolean', zh: '表盘显示封面' },
      enableLineGlow: { kind: 'boolean', zh: '行发光' },
    },
  },
  sonnet: {
    setter: 'handleSetSonnetTuning',
    params: {
      cameraIntensity: { kind: 'number', min: 0, max: 2, zh: '相机强度' },
      typographyMotion: { kind: 'number', min: 0, max: 2, zh: '字体运动' },
      mgDensity: { kind: 'number', min: 0, max: 2, zh: '动图密度' },
      showOnlyText: { kind: 'boolean', zh: '只显示文字' },
      showGuide: { kind: 'boolean', zh: '参考线' },
      showBackgroundMg: { kind: 'boolean', zh: '背景动图' },
      showFixedGeo: { kind: 'boolean', zh: '固定几何' },
      showGiantDecorativeText: { kind: 'boolean', zh: '巨型装饰字' },
      showBackgroundDecor: { kind: 'boolean', zh: '背景装饰' },
      enableTransitions: { kind: 'boolean', zh: '转场' },
      outerFrameMode: { kind: 'select', options: ['none', 'frame', 'full'], zh: '外框' },
      textureResolution: { kind: 'number', min: 0.5, max: 4, zh: '纹理分辨率' },
      postProcessEnabled: { kind: 'boolean', zh: '后处理总开关' },
      postProcessGrain: { kind: 'number', min: 0, max: 1, zh: '胶片颗粒' },
      postProcessContrast: { kind: 'number', min: 0, max: 1, zh: '对比度' },
      postProcessRgbShift: { kind: 'number', min: 0, max: 1, zh: 'RGB 偏移' },
      postProcessHalftone: { kind: 'number', min: 0, max: 1, zh: '半调网屏' },
      postProcessVignette: { kind: 'number', min: 0, max: 2, zh: '暗角' },
      postProcessLensDistortion: { kind: 'number', min: 0, max: 2, zh: '镜头畸变' },
      postProcessLensDispersion: { kind: 'number', min: 0, max: 1, zh: '镜头色散' },
    },
  },
  tempera: {
    setter: 'handleSetTemperaTuning',
    params: {
      cameraIntensity: { kind: 'number', min: 0, max: 2, zh: '相机强度' },
      glyphMotion: { kind: 'number', min: 0, max: 2, zh: '逐字入场' },
      wholeLineLyrics: { kind: 'boolean', zh: '整行不切分' },
      glyphSettleStretch: { kind: 'number', min: 0, max: 1, zh: '逐字入场时序' },
      depthOfField: { kind: 'number', min: 0, max: 2, zh: '景深' },
      depthPan: { kind: 'number', min: 0, max: 2, zh: '镜头平移' },
      glyphDepth: { kind: 'number', min: 0, max: 2, zh: '歌词远近' },
      colorMode: { kind: 'select', options: ['duo', 'mono', 'gradient'], zh: '配色模式' },
      showBlocks: { kind: 'boolean', zh: '色块' },
      showDecor: { kind: 'boolean', zh: '装饰' },
      showCornerMarks: { kind: 'boolean', zh: '角标' },
      textInversion: { kind: 'boolean', zh: '文字动态反色' },
      enableTransitions: { kind: 'boolean', zh: '转场' },
      textureResolution: { kind: 'number', min: 0.5, max: 4, zh: '纹理分辨率' },
      postProcessEnabled: { kind: 'boolean', zh: '后处理总开关' },
      postProcessGrain: { kind: 'number', min: 0, max: 1, zh: '颗粒' },
      postProcessContrast: { kind: 'number', min: 0, max: 1, zh: '对比度' },
      postProcessRgbShift: { kind: 'number', min: 0, max: 1, zh: 'RGB 偏移' },
      postProcessVignette: { kind: 'number', min: 0, max: 2, zh: '暗角' },
      postProcessLensDistortion: { kind: 'number', min: 0, max: 2, zh: '镜头畸变' },
    },
  },
  lumiere: {
    setter: 'handleSetLumiereTuning',
    params: {
      lightIntensity: { kind: 'number', min: 0.3, max: 2, zh: '光强' },
      audioResponse: { kind: 'number', min: 0, max: 2, zh: '随音乐变亮' },
      fogDensity: { kind: 'number', min: 0, max: 2, zh: '烟雾浓度' },
      fogOctaves: { kind: 'number', min: 2, max: 6, zh: '烟雾细节' },
      moteAmount: { kind: 'number', min: 0, max: 2, zh: '浮尘数量' },
      bloom: { kind: 'number', min: 0, max: 2, zh: '图形辉光' },
      textBloom: { kind: 'number', min: 0, max: 2, zh: '文字辉光' },
      unlitOpacity: { kind: 'number', min: 0.05, max: 0.6, zh: '未唱字透明度' },
      darkField: { kind: 'number', min: 0, max: 1, zh: '暗场强度' },
      decay: { kind: 'number', min: 0, max: 2, zh: '崩解强度' },
      echo: { kind: 'number', min: 0, max: 2, zh: '背景歌词亮度' },
      windowNeighbors: { kind: 'select', options: [1, 2], zh: '邻行数' },
      lineArt: { kind: 'boolean', zh: '线稿' },
      frontBokeh: { kind: 'boolean', zh: '前景散景' },
      trails: { kind: 'boolean', zh: '轨迹线' },
      seamlessTransitions: { kind: 'boolean', zh: '无缝转场' },
      overlayFrame: { kind: 'boolean', zh: '画框' },
      textOnly: { kind: 'boolean', zh: '仅歌词文字' },
      keywordColors: { kind: 'boolean', zh: '关键词着色' },
      themeIcons: { kind: 'boolean', zh: '主题图标' },
      themeColorMix: { kind: 'number', min: 0, max: 1, zh: '主题色占比' },
      renderQuality: { kind: 'select', options: ['full', 'balanced', 'low'], zh: '画质' },
    },
  },
  still: { setter: null, params: {} },
  hanabi: { setter: null, params: {} },
  // 0.7.25 新增的两个内置模式：之前漏了，导致模组无法给它们调参（也不会被 setParams 接受）。
  machi: {
    setter: 'handleSetMachiTuning',
    params: {
      // 只保留能确认的键；不确定的枚举值宁可不要，写错会被校验丢弃（无害但会失效）。
      quality: { kind: 'select', options: ['high', 'balanced', 'low'], zh: '画质预设' },
      antialias: { kind: 'boolean', zh: '抗锯齿' },
      shadows: { kind: 'boolean', zh: '阴影' },
      reflections: { kind: 'boolean', zh: '反射' },
      glow: { kind: 'boolean', zh: '辉光' },
      adaptive: { kind: 'boolean', zh: '自适应画质' },
      cameraMotion: { kind: 'boolean', zh: '镜头运动' },
      motionSpeed: { kind: 'number', min: 0.2, max: 2, zh: '运镜速度' },
      aperture: { kind: 'number', min: 0, max: 16, zh: '光圈' },
      dof: { kind: 'number', min: 0, max: 1, zh: '景深强度' },
      dofRange: { kind: 'number', min: 0, max: 1, zh: '景深范围' },
      tiltShift: { kind: 'number', min: 0, max: 1, zh: '移轴' },
      focusOffset: { kind: 'number', min: -10, max: 10, zh: '对焦距离' },
    },
  },
  nebbia: {
    setter: 'handleSetNebbiaTuning',
    params: {
      strokeWidth: { kind: 'number', min: 0, max: 1, zh: '笔画粗细' },
      writeSpeed: { kind: 'number', min: 0.2, max: 3, zh: '书写速度' },
      jitter: { kind: 'number', min: 0, max: 1, zh: '手写歪斜' },
      warp: { kind: 'number', min: 0, max: 1, zh: '手写变形' },
      mist: { kind: 'number', min: 0, max: 1, zh: '雾气浓度' },
      hold: { kind: 'number', min: 0, max: 3, zh: '停留时长' },
      refog: { kind: 'number', min: 0.2, max: 3, zh: '起雾用时' },
      busSpeed: { kind: 'number', min: 0, max: 2, zh: '车速' },
      neon: { kind: 'number', min: 0, max: 1, zh: '霓虹' },
      resolution: { kind: 'number', min: 0.5, max: 2, zh: '分辨率' },
    },
  },
};

const PARAM_GATES = {
  classic: { wordSpacing: { key: 'useLegacyLayout', mustBe: false } },
  cappella: { emojiPackSource: { key: 'showEmoMessages', mustBe: true } },
  monet: { audioStyle: { key: 'showAudioVisualization', mustBe: true } },
  pendolo: { enableLineGlow: { key: 'showGearDecor', not: 'none', setTo: 'subtle' } },
  sonnet: {
    postProcessGrain: { key: 'postProcessEnabled', mustBe: true },
    postProcessContrast: { key: 'postProcessEnabled', mustBe: true },
    postProcessRgbShift: { key: 'postProcessEnabled', mustBe: true },
    postProcessHalftone: { key: 'postProcessEnabled', mustBe: true },
    postProcessVignette: { key: 'postProcessEnabled', mustBe: true },
    postProcessLensDistortion: { key: 'postProcessEnabled', mustBe: true },
    postProcessLensDispersion: { key: 'postProcessEnabled', mustBe: true },
    mgDensity: [{ key: 'showBackgroundMg', mustBe: true }, { key: 'showOnlyText', mustBe: false }],
    showBackgroundMg: { key: 'showOnlyText', mustBe: false },
    showFixedGeo: { key: 'showOnlyText', mustBe: false },
    showBackgroundDecor: { key: 'showOnlyText', mustBe: false },
    showGuide: { key: 'showOnlyText', mustBe: false },
    outerFrameMode: { key: 'showOnlyText', mustBe: false },
  },
  tempera: {
    postProcessGrain: { key: 'postProcessEnabled', mustBe: true },
    postProcessContrast: { key: 'postProcessEnabled', mustBe: true },
    postProcessRgbShift: { key: 'postProcessEnabled', mustBe: true },
    postProcessVignette: { key: 'postProcessEnabled', mustBe: true },
    postProcessLensDistortion: { key: 'postProcessEnabled', mustBe: true },
  },
  diorama: {
    particleGlowIntensity: { key: 'particleGlowEnabled', mustBe: true },
    glowIntensity: { key: 'glowEnabled', mustBe: true },
    soulIntensity: { key: 'soulEnabled', mustBe: true },
    soulActiveEnabled: { key: 'soulEnabled', mustBe: true },
    gradientIntensity: { key: 'gradientEnabled', mustBe: true },
  },
  lumiere: {
    themeIcons: { key: 'textOnly', mustBe: false },
    echo: { key: 'textOnly', mustBe: false },
    frontBokeh: { key: 'textOnly', mustBe: false },
    lineArt: { key: 'textOnly', mustBe: false },
    moteAmount: { key: 'textOnly', mustBe: false },
    bloom: { key: 'textOnly', mustBe: false },
    fogDensity: { key: 'textOnly', mustBe: false },
    fogOctaves: { key: 'textOnly', mustBe: false },
    overlayFrame: { key: 'textOnly', mustBe: false },
    renderQuality: { key: 'textOnly', mustBe: false },
  },
};

const tuningKeyOf = (mode) => {
  const match = /^handleSet([A-Za-z]+)Tuning$/.exec(String(MODE_PARAMS[mode]?.setter ?? ''));
  if (!match) return null;
  return `${match[1].charAt(0).toLowerCase()}${match[1].slice(1)}Tuning`;
};

const gatesFor = (mode, key) => {
  const raw = PARAM_GATES[mode]?.[key];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
};

const gateSatisfied = (tuning, gate) => {
  if (!tuning) return true;
  const value = tuning[gate.key];
  if (gate.not !== undefined) return value !== gate.not;
  return value === gate.mustBe;
};

const isInertValue = (param, value) => {
  if (!param) return false;
  if (param.kind === 'boolean') return value === false;
  if (param.kind === 'number') return value === 0;
  return false;
};

const normalizeParam = (param, value) => {
  if (param.kind === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }
  if (param.kind === 'select') {
    const options = param.options ?? [];
    if (options.includes(value)) return value;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) && options.includes(asNumber) ? asNumber : undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.round(Math.min(param.max, Math.max(param.min, numeric)) * 1000) / 1000;
};

const sanitizeParams = (mode, raw) => {
  const spec = MODE_PARAMS[mode];
  if (!spec || !raw || typeof raw !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(raw)) {
    const param = spec.params[key];
    if (!param) continue;
    const normalized = normalizeParam(param, value);
    if (normalized !== undefined) clean[key] = normalized;
  }
  return clean;
};

const paramSpecLine = (mode) => {
  const spec = MODE_PARAMS[mode];
  if (!spec) return '';
  return Object.entries(spec.params)
    .map(([key, param]) => {
      let text;
      if (param.kind === 'boolean') text = `${key}(true|false)`;
      else if (param.kind === 'select') text = `${key}(${param.options.join('|')})`;
      else text = `${key}(${param.min}~${param.max})`;
      const gates = gatesFor(mode, key);
      if (gates.length > 0) {
        text += `[需 ${gates.map((g) => (g.not !== undefined ? `${g.key}≠${g.not}` : `${g.key}=${g.mustBe}`)).join(' 且 ')}]`;
      }
      return `${text}${param.zh}`;
    })
    .join('，');
};

// ============================================================ 切换优化与“干净画面”
const TICK_MS = 40;            // 轮询间隔：够密才能在段边界一到就切，不漏句
const LEAD_SECONDS = 0.9;      // 提前量：在新段第一句开唱前多少秒就切过去（挡住旧动画渲染新句）
const MIN_SWITCH_GAP_MS = 900; // 两次真正切换之间的最小间隔：防止过渡连发成“莫名黑一下”

// 切换后强制压掉的“邻行 / 上一句”参数：让画面只显示当前句，不带出上一行残留。
// 用 force 写入，绕过 isInertValue（否则 echo=0 / opacity=0 会被当成“关掉不用写”而跳过）。
const CLEAN_PARAMS = {
  lumiere: { windowNeighbors: 1, echo: 0 },
  fume: { backgroundObjectOpacity: 0, textHoldRatio: 0 },
};

// ============================================================ 渐隐过渡（掩盖切模式时的重建卡顿）
// b22 原样：径向暗场 + rAF 逐帧驱动，压暗→保持→亮回。
const FADE_IN_MS = 240;      // 压暗（更慢，更柔）
const MIN_HOLD_MS = 200;     // 最短保持：给新场景一点启动时间
const MAX_HOLD_MS = 1400;    // 普通模式的最长保持：新场景一直没画出来也不能一直黑着
const FADE_OUT_MS = 420;     // 亮回来（最长的一段，柔化“切换感”）

/* 挂在 document.body 的全屏遮罩。
 * 页面的 HMR / 重载可能导致模组被重复激活，从而创建多个同款遮罩，叠在一起就成了
 * “莫名其妙黑一下”。所以用固定 id + 全局去重：任何时刻 body 里只能有一个。 */
const OVERLAY_ID = 'lyric-ai-segment-fade';
let overlayEl = null;
let overlayStyle = null;

/* 唯一写 opacity 的入口。元素引用在过渡开始时由 ensureOverlay 保证有效，
 * 这里只做一次廉价的存在性检查（不查 DOM，避免在动画循环里每帧查询）。 */
const writeOpacity = (value) => {
  if (!overlayStyle) return;
  // 节点被外部移除时（页面重建），下一次 ensureOverlay 会重建它；
  // 这里不额外 append，避免每帧触发 DOM 变动。
  overlayStyle.opacity = value;
};

const ensureOverlay = () => {
  // 1) 先把 body 里所有同 id 的旧节点清掉，只保留一个
  const existing = document.querySelectorAll(`#${OVERLAY_ID}`);
  if (existing.length > 1) {
    for (let i = 1; i < existing.length; i += 1) existing[i].remove();
  }
  const first = existing[0] ?? null;
  if (first) {
    overlayEl = first;
    overlayStyle = first.style;
    if (first.parentNode !== document.body) document.body.appendChild(first);
    return overlayEl;
  }
  // 2) 没有就创建
  overlayEl = document.createElement('div');
  overlayEl.id = OVERLAY_ID;
  // 暗场而不是纯黑：85% 不透明度 + 轻微模糊，比全黑柔和得多；
  // fixed 全屏挂 body，确保盖在 canvas 之上（stageLayers 的容器在 shadow root 里会被裁剪）。
  overlayEl.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'width:100vw', 'height:100vh',
    'background:radial-gradient(ellipse at center, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.92) 100%)',
    'backdrop-filter:blur(0px)',
    'opacity:0', 'pointer-events:none', 'z-index:2147483000', 'will-change:opacity,backdrop-filter',
  ].join(';');
  overlayStyle = overlayEl.style;
  document.body.appendChild(overlayEl);
  return overlayEl;
};

/* 模组启用/停用时调用：清掉所有残留遮罩，避免上一轮留下的半透明层。 */
const purgeOverlays = () => {
  document.querySelectorAll(`#${OVERLAY_ID}`).forEach((n) => n.remove());
  overlayEl = null;
  overlayStyle = null;
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// 过渡互斥：同一时刻只允许一个过渡在跑，避免两次过渡叠加成“莫名其妙黑一下”
let fadeBusy = false;
let fadeRaf = 0;
let fadeToken = 0;   // 每次过渡唯一编号：防止旧的 rAF 回调在取消后仍写 opacity

const cancelFade = () => {
  if (fadeRaf) cancelAnimationFrame(fadeRaf);
  fadeRaf = 0;
  fadeBusy = false;
  fadeToken += 1;
  writeOpacity('0');
};

/**
 * 渐隐过渡：压暗 → 等新场景画出来 → 亮回。
 * `onCovered` 在压暗到接近全遮时调用（此时执行真正的模式切换）；
 * `isReady` 返回 true 表示新场景已画好，可以开始亮回；
 * `maxHoldMs` 覆盖最长保持时间（慢模式可以等更久，避免“亮回时还在铺场”）。
 */
const runFadeTransition = ({ onCovered, isReady, maxHoldMs = MAX_HOLD_MS }) => {
  // 上一个过渡还没结束就不叠新的：直接当作“已经遮住”，立即执行切换并让旧过渡自己收尾。
  if (fadeBusy) {
    try { onCovered(); } catch (e) { /* 忽略 */ }
    return;
  }
  const el = ensureOverlay();
  if (el.parentNode !== document.body) document.body.appendChild(el);
  fadeBusy = true;
  fadeToken += 1;
  const myToken = fadeToken;
  // 回调只认自己这一轮：旧的回调一律作废，防止取消后仍把 opacity 写上去
  const alive = () => myToken === fadeToken;
  let fired = false;
  let holdStart = 0;
  const t0 = performance.now();
  const finish = () => {
    if (!alive()) return;
    writeOpacity('0');
    fadeBusy = false;
    fadeRaf = 0;
  };
  const step = (now) => {
    if (!alive()) return;
    const t = now - t0;
    if (t < FADE_IN_MS) {
      const k = easeInOut(t / FADE_IN_MS);
      writeOpacity(String(k));
      if (!fired && k > 0.92) { fired = true; try { onCovered(); } catch (e) { /* 忽略 */ } holdStart = now; }
      fadeRaf = requestAnimationFrame(step);
      return;
    }
    if (!fired) { fired = true; try { onCovered(); } catch (e) { /* 忽略 */ } holdStart = now; }
    writeOpacity('1');
    const held = now - holdStart;
    let ready = false;
    try { ready = isReady ? isReady() : true; } catch (e) { ready = true; }
    // 至少保持 MIN_HOLD_MS；新场景就绪后立刻开始亮回；超过上限强制亮回
    if (held >= maxHoldMs || (held >= MIN_HOLD_MS && ready)) {
      const fadeStart = now;
      const fade = (n2) => {
        if (!alive()) return;
        const k = Math.min(1, (n2 - fadeStart) / FADE_OUT_MS);
        writeOpacity(String(1 - easeInOut(k)));
        if (k < 1) fadeRaf = requestAnimationFrame(fade);
        else finish();
      };
      fadeRaf = requestAnimationFrame(fade);
      return;
    }
    fadeRaf = requestAnimationFrame(step);
  };
  fadeRaf = requestAnimationFrame(step);
};

// ============================================================ 模式画像（PROFILES）
const PROFILES = {
  classic: { name: '流光', host: '单行大字居中，逐字旋转点亮，整行随呼吸轻浮' },
  cadenza: { name: '心象', host: '整句拆成单字散落画面，像脑海里浮起的碎片' },
  partita: { name: '云阶', host: '歌词沿引导线逐块错落下行，像一级级云中阶梯' },
  fume: { name: '浮名', host: '满屏歌词层层堆叠，镜头追着当前句推移，虚实之间浮沉' },
  tilt: { name: '倾诉', host: '长句自动断行，随机斜体强调，像有人凑近低声说话' },
  claddagh: { name: '回环', host: '歌词沿倾斜圆环轨道循环推进，大小对比拉开纵深' },
  monet: { name: '莫奈', host: '海报式版面：左侧歌词轨、右侧肖像、底部频谱' },
  pendolo: { name: '时计', host: '封面嵌进钟表盘，歌词沿弧线随摆锤一格格推过' },
  cappella: { name: '群唱', host: '歌词化成聊天气泡左右往返，配头像与表情，像一场对唱' },
  diorama: { name: '镜台', host: '点阵化的文字在 3D 空间里穿行，镜头跟着歌词运镜' },
  sonnet: { name: '商籁', host: '短线、边框与镂空巨字轮番铺开，歌词像被排进一页页翻动的诗稿' },
  tempera: { name: '凝彩', host: '成片的色块与细密网点缓缓重组，歌词压过颜色时翻出反色' },
  lumiere: { name: '绘光', host: '体积光穿过烟雾与浮尘，歌词像被光一点点照亮的刻字' },
  hanabi: { name: '花火', host: '花火烟花歌词 PV 可视化' },
  machi: { name: '町景', host: '日本小镇微缩街景，歌词写在招牌上，当前句在 LED 屏逐字亮起，下一句在滚动字幕条' },
  nebbia: { name: '雾笺', host: '在起雾的公交车窗上写歌词，字随车行、雨点与霓虹一起流动' },
  still: { name: '静止', host: '歌词静止在画面中央，不做动画也不渲染背景，最省资源' },
  // ---- 第三方动画（mode 形如 mod:<模组id>:<动画id>）。这里补画像，否则 AI 只看到名字、不知道画面长什么样，就不会选。
  // id 取自各模组 client.mjs 里 registries.visualizers.register 的 id，与 mod.json 的模组 id 拼成完整 mode。
  'mod:cinerama:cinerama-screen': { name: '巨幕', host: '舞台 LED 大屏：大字报、跑马灯带、斜切丝带轮换，歌词像被投在演唱会的巨幕上' },
  'mod:visualizer-jump:jump-course': { name: '跳一跳', host: '等距小游戏场景：小人在一块块带字的长方块上跳跃前进，跳到哪块就唱哪句' },
  'mod:vinyl-disc:disc': { name: '黑胶唱片', host: '黑胶唱机：封面作碟心，唱片旋转、唱臂落下，歌词在唱片旁边排布' },
  'mod:wave-light:wave-light': { name: '动感波光', host: '随封面主色呼吸的波光：左右各有一组同心圆波纹像喇叭声波一样放大缩小、缓缓转动' },
  'mod:visualizer52hz:rings': { name: '52Hz', host: 'PixiJS 动画：整句出现后逐字点亮，每个节拍从字形轮廓外发出一圈年轮，响度决定粗细与亮度' },
};

/* 委托型第三方动画：它们自己不画，只是把画面转交给别的模式（例如「随机」每首歌随机挑一个）。
 * 让 AI 选中它们等于放弃控制权——本模组要按段决定画面，所以从候选清单里剔除。 */
const DELEGATING_MODES = new Set([
  'mod:lyric-style-switcher:random-lyric-style',
]);

/** 这个模式是不是“委托型”（不该交给 AI 选）。 */
const isDelegatingMode = (id) => DELEGATING_MODES.has(String(id ?? ''));

/* 第三方动画在注册表里的 mode 可能因模组版本不同而带不同前缀，
 * 这里按“末段 id”再兜一层：cinerama-screen / jump-course 等也能对上画像。 */
const PROFILE_ALIASES = (() => {
  const map = {};
  for (const key of Object.keys(PROFILES)) {
    if (!key.startsWith('mod:')) continue;
    const tail = key.split(':').pop();
    if (tail) map[tail] = key;
  }
  return map;
})();

/** 取画像：先按完整 id，再按末段 id 兜底。 */
const profileOf = (id) => PROFILES[id] ?? PROFILES[PROFILE_ALIASES[String(id ?? '').split(':').pop()]] ?? null;

/** 这个模式是不是第三方（mod 注册的）。 */
const isThirdParty = (id) => String(id ?? '').startsWith('mod:');

// ============================================================ 服务商 / 接口地址
const PROVIDERS = {
  custom: { label: '自定义（填下面的接口地址）', url: '' },
  deepseek: { label: 'DeepSeek 深度求索', url: 'https://api.deepseek.com' },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1' },
};

const baseUrlFor = ({ provider, baseUrl }) => String(baseUrl ?? '').trim() || PROVIDERS[provider]?.url || '';

const endpointUrl = (base, endpoint) => {
  let url = String(base ?? '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const cut = url.search(/[?#]/);
  const query = cut === -1 ? '' : url.slice(cut);
  let path = (cut === -1 ? url : url.slice(0, cut)).replace(/\/+$/, '').replace(/\/(chat\/completions)$/i, '');
  if (/^https?:\/\/[^/]+$/i.test(path)) path += '/v1';
  return `${path}/${endpoint}${query}`;
};

const normalizeTemperature = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.3;
  return Math.min(1, Math.max(0, numeric));
};

// ============================================================ 网络（folium.net.fetch 兼容封装）
const netFetch = async (url, init) => {
  const raw = await foliumRef.net.fetch(url, init);
  if (raw && typeof raw === 'object' && 'result' in raw) {
    const r = raw.result;
    return {
      ok: raw.ok === true,
      status: r?.status ?? 0,
      statusText: r?.statusText ?? '',
      json: () => { try { return JSON.parse(r?.body ?? ''); } catch { return null; } },
      text: () => r?.body ?? '',
    };
  }
  return raw;
};

const redact = (text, apiKey) => String(text)
  .split(apiKey || '\u0000').join('[已隐藏]')
  .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, '$1[已隐藏]')
  .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*"?)[^"\s,}]{8,}/gi, '$1[已隐藏]');

const extractJson = (raw) => {
  let text = String(raw ?? '').trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (text.startsWith('```')) text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
};

let foliumRef = null; // 由 activate() 注入，供 netFetch 等模块使用

const requestCompletion = async ({ baseUrl, apiKey, model, temperature, system, user }) => {
  const url = endpointUrl(baseUrl, 'chat/completions');
  if (!url) throw new Error('还没有选择服务商或填写接口地址');
  if (!model) throw new Error('还没有填写模型名');
  const base = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature, stream: false };
  let lastError = null;
  /* 最多两次：第一次请求 JSON 模式（服务商支持时更稳）；如果被拒或出错，
   * 第二次去掉 response_format 再试一次（兼容不支持该参数的服务商）。
   * 限流/服务端错误时先退避再重试，避免连续打同一堵墙。 */
  for (let i = 0; i < 2; i += 1) {
    const payload = i === 0 ? { ...base, response_format: { type: 'json_object' } } : { ...base };
    let response;
    try {
      response = await netFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify(payload),
        timeoutMs: 45000,
      });
    } catch (error) {
      throw new Error(`连不上接口：${redact(error?.message ?? error, apiKey)}`);
    }
    if (response.ok) {
      let data;
      try { data = response.json(); } catch { throw new Error('接口返回的不是 JSON（地址可能填错了）'); }
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim()) return content;
      throw new Error('接口返回了空内容');
    }
    const errorText = (() => { try { return redact(response.text(), apiKey); } catch { return ''; } })();
    lastError = new Error(`接口返回 ${response.status}：${errorText.slice(0, 240) || response.statusText}`);
    const st = response.status;
    /* 还值得再试一次吗：
     * - 401/403：密钥或权限问题，重试无用；
     * - 404：地址写错了，重试无用；
     * - 其余 4xx：常见原因是服务商不认 response_format，第二次去掉它再试；
     * - 429 限流 / 5xx 服务端故障：退避后重试是标准做法。 */
    const worthRetry = st === 429 || st >= 500 || (st >= 400 && st < 500 && ![401, 403, 404].includes(st));
    if (i === 0 && worthRetry) {
      const waitMs = st === 429 ? 1200 : st >= 500 ? 800 : 0;
      if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw lastError;
  }
  throw lastError ?? new Error('请求失败');
};

// ============================================================ host 适配（唯一触碰 folium.internals 的地方）
const internalsOf = (folium) => {
  try { return folium.internals ?? null; } catch { return null; }
};

const createHostAdapter = (folium) => {
  const store = () => {
    const visualizerSettings = internalsOf(folium)?.stores?.visualizerSettings;
    return visualizerSettings && typeof visualizerSettings.getState === 'function' ? visualizerSettings : null;
  };
  let ownWriteUntil = 0;
  const markOwnWrite = () => { ownWriteUntil = performance.now() + 800; };

  const registryEntries = () => {
    const registry = internalsOf(folium)?.visualizerRegistry ?? null;
    const entries = Array.isArray(registry) ? registry : (registry?.entries ?? []);
    return entries.filter((entry) => entry && typeof entry === 'object' && typeof (entry.mode ?? entry.id) === 'string');
  };

  /* 统一注册表里内置和第三方都用 `mode` 字段；第三方形如 mod:cinerama:cinerama-screen。
   * 这里仍兼容 `id`（个别旧版/异常条目），label 兼容字符串或 { 'zh-CN': ... } 对象。 */
  const modeIdOf = (entry) => entry.mode ?? entry.id ?? null;
  const labelOf = (entry) => {
    const label = entry.label ?? entry.labelFallback;
    if (typeof label === 'string') return label;
    if (label && typeof label === 'object') return label['zh-CN'] ?? label.zh ?? label.en ?? null;
    return null;
  };

  /* 从 AI 抄回的 mode 找回真实 id：精确匹配优先；否则按“尾部 id 段”模糊匹配，
   * 这样 AI 抄 mod:cinerama:cinerama-screen 这类长 id 时漏写前缀也能映射回正确条目。
   * 只做三段：精确 → 末段相等 → 末段相等（含 mod: 前缀时）。不再用双向 includes，
   * 那会让 `still` 这类短 id 误吞别的模式。 */
  const resolveMode = (raw, modes) => {
    const want = String(raw ?? '').trim();
    if (!want) return null;
    // 1) 精确
    const exact = modes.find((m) => m.id === want);
    if (exact) return exact.id;
    // 2) 只写了末段 id（cinerama-screen / jump-course / sonnet）
    const tail = want.split(':').pop();
    if (tail) {
      const byTail = modes.filter((m) => m.id === tail || m.id.endsWith(`:${tail}`));
      if (byTail.length === 1) return byTail[0].id;
      // 多于一个说明有歧义，宁可不用也不要猜错
      if (byTail.length > 1) return null;
    }
    // 3) 写了完整 mod:xxx 但和注册表差一层前缀时，按末段再兜一次
    if (want.includes(':')) {
      const lastTwo = want.split(':').slice(-2).join(':');
      const byPair = modes.filter((m) => m.id === lastTwo || m.id.endsWith(`:${lastTwo}`));
      if (byPair.length === 1) return byPair[0].id;
    }
    return null;
  };

  const listModes = () => registryEntries()
    .map((entry) => {
      const id = modeIdOf(entry);
      const label = profileOf(id)?.name ?? labelOf(entry) ?? id;
      return { id, label, entry };
    })
    .filter((m) => m.id);

  /* 只给 id，不算 label：缓存指纹只需要“有哪些模式”，
   * 走 listModes() 会白白做一遍 profileOf 查表和对象映射。 */
  const listModeIds = () => registryEntries().map((e) => modeIdOf(e)).filter(Boolean).sort();

  /* 预加载：Folia 的每个 visualizer 都可以有 prewarm()，宿主自己也会在空闲时调用它。
   * 在切过去之前先调一次，让它把 shader / 纹理 / 排版准备好，切过去时就是无缝的。
   * 返回是否真的调到了。 */
  const prewarmMode = (mode) => {
    try {
      const entry = registryEntries().find((e) => modeIdOf(e) === mode);
      if (!entry || typeof entry.prewarm !== 'function') return false;
      entry.prewarm();
      return true;
    } catch (e) {
      return false;
    }
  };

  const available = () => Boolean(store());

  // ------------------------------------------------------------ 背景类型
  /* 背景类型的 id 是固定的一组（见 Folia 的背景注册表），底层只写一个 localStorage key：
   * `visualizer_background_mode`，再通过 handleSetVisualizerBackgroundMode 同步进 store。 */
  const BG_MODES = ['common', 'monet', 'nomand', 'latent', 'url', 'sora'];
  const BG_LABELS = { common: '通用', monet: '真赝', nomand: '漫游', latent: '隐现', url: '嵌入', sora: '空' };
  // 交给 AI 的候选：排除 url（嵌入网页）——用户没配 URL 时会是空底，没有意义。
  const BG_MODES_FOR_AI = BG_MODES.filter((m) => m !== 'url');

  const readBackground = () => {
    try {
      const v = localStorage.getItem('visualizer_background_mode');
      return BG_MODES.includes(v) ? v : null;
    } catch { return null; }
  };

  /* 切背景。
   * 不能用「和 localStorage 里的值相同就跳过」来判断：那个 key 可能已经是目标值，
   * 但画面其实还没应用（例如中间被别的设置重置过）。所以每次都真的调一次宿主接口，
   * 由宿主决定是否重绘。 */
  const setBackground = (value) => {
    if (!BG_MODES.includes(value)) return false;
    try {
      const st = store()?.getState?.();
      if (typeof st?.handleSetVisualizerBackgroundMode === 'function') {
        markOwnWrite();
        st.handleSetVisualizerBackgroundMode(value);   // 宿主自己会写 localStorage 并同步 store
        return true;
      }
      localStorage.setItem('visualizer_background_mode', value);
      return true;
    } catch {
      return false;
    }
  };

  const currentMode = () => {
    const mode = store()?.getState?.()?.visualizerMode;
    return typeof mode === 'string' ? mode : null;
  };

  const readTuning = (mode) => {
    const key = tuningKeyOf(mode);
    const value = key ? store()?.getState?.()?.[key] : null;
    return value && typeof value === 'object' ? value : null;
  };

  const setMode = (mode) => {
    const state = store()?.getState?.();
    if (typeof state?.handleSetVisualizerMode !== 'function') throw new Error('宿主没有提供切换模式的接口');
    if (state.visualizerMode === mode) return false;
    markOwnWrite();
    /* preserveRandom: true 很重要（Folia 0.7.26+）：
     * 宿主这个接口默认会把「每首歌随机动画」关掉，用来尊重用户手动选的模式。
     * 但我们是自动切段，不该顺手改掉用户的随机设置，所以显式保留。
     * 旧版本没有 preserveRandom 参数，多传一个字段是无害的。 */
    state.handleSetVisualizerMode(mode, { notify: false, preserveRandom: true });
    return true;
  };

  const setParams = (mode, rawParams) => {
    const spec = MODE_PARAMS[mode];
    const state = store()?.getState?.();
    const setter = spec?.setter ? state?.[spec.setter] : null;
    if (typeof setter !== 'function') return {};
    const patch = sanitizeParams(mode, rawParams);
    const current = readTuning(mode);
    for (const [key, value] of Object.entries({ ...patch })) {
      if (isInertValue(spec.params[key], value)) continue;
      for (const gate of gatesFor(mode, key)) {
        const merged = { ...(current ?? {}), ...patch };
        if (gateSatisfied(merged, gate)) continue;
        if (Object.prototype.hasOwnProperty.call(patch, gate.key)) { delete patch[key]; break; }
        patch[gate.key] = gate.setTo ?? gate.mustBe;
      }
    }
    if (Object.keys(patch).length === 0) return {};
    markOwnWrite();
    setter(patch);
    const stored = readTuning(mode) ?? {};
    const written = {};
    for (const key of Object.keys(patch)) written[key] = key in stored ? stored[key] : patch[key];
    return written;
  };

  /* 切换后强制压掉“邻行 / 上一句”，即使值是 0/关也要写入（isInertValue 会跳过它们）。 */
  const setClean = (mode) => {
    const spec = MODE_PARAMS[mode];
    const state = store()?.getState?.();
    const setter = spec?.setter ? state?.[spec.setter] : null;
    const clean = CLEAN_PARAMS[mode];
    if (typeof setter !== 'function' || !clean) return;
    const patch = sanitizeParams(mode, clean);
    if (Object.keys(patch).length === 0) return;
    markOwnWrite();
    setter(patch);
  };

  const snapshot = () => {
    const state = store()?.getState?.();
    if (!state) return null;
    const tunings = {};
    for (const mode of Object.keys(MODE_PARAMS)) {
      const tuning = readTuning(mode);
      if (!tuning) continue;
      const keep = {};
      for (const key of Object.keys(MODE_PARAMS[mode].params)) if (key in tuning) keep[key] = tuning[key];
      if (Object.keys(keep).length > 0) tunings[mode] = keep;
    }
    /* 强度和背景也一起存：它们原先只放在内存变量里，模组重载/重启后就丢了，
     * 于是「恢复原来的设置」只能还原模式和参数，强度和背景永远回不去。 */
    return {
      mode: state.visualizerMode,
      tunings,
      intensity: readIntensity(),
      background: readBackground(),
    };
  };

  const restore = (saved) => {
    if (!saved) return false;
    const state = store()?.getState?.();
    if (!state) return false;
    for (const [mode, tuning] of Object.entries(saved.tunings ?? {})) {
      const setter = state[MODE_PARAMS[mode]?.setter];
      if (typeof setter === 'function' && Object.keys(tuning).length > 0) {
        markOwnWrite();
        setter(tuning);
      }
    }
    if (saved.mode) setMode(saved.mode);
    return true;
  };

  // ------------------------------------------------------------ 动画强度
  /* 动画强度存在 localStorage 的独立 key 里（不是主题对象的一部分），
   * 三个合法值：calm / normal / chaotic。写完后要让宿主重新应用一次主题才会生效。 */
  const INTENSITY_KEY = 'theme_animation_intensity';
  const INTENSITIES = ['calm', 'normal', 'chaotic'];

  const readIntensity = () => {
    try {
      const v = localStorage.getItem(INTENSITY_KEY);
      return INTENSITIES.includes(v) ? v : 'normal';
    } catch { return 'normal'; }
  };

  /* 写动画强度。
   *
   * 事实（已实测）：`folium.internals.stores` 只暴露 5 个 store（playback / appView /
   * visualizerSettings / themeSettings / lyricSettings），**没有一个带 setTheme 或 theme**。
   * 宿主那个真正应用主题的 store 没有暴露给模组，所以“立刻让强度生效”这条路走不通。
   *
   * 能做的只有：把强度写进宿主读的那个 localStorage key。
   * 宿主会在下次重建场景时（切模式、换歌、手动改主题）重新读取它，
   * 因此强度的实际生效时机是「下一次模式切换」。
   *
   * 值没变就直接返回（没必要重复写）。 */
  const setIntensity = (value) => {
    if (!INTENSITIES.includes(value)) return false;
    if (value === readIntensity()) return false;
    try { localStorage.setItem(INTENSITY_KEY, value); return true; } catch { return false; }
  };

  return {
    available, listModes, listModeIds, resolveMode, currentMode, readTuning, setMode, setParams, setClean, snapshot, restore,
    readIntensity, setIntensity,
    BG_MODES, BG_MODES_FOR_AI, BG_LABELS, readBackground, setBackground,
    prewarmMode,
    isOwnWrite: () => performance.now() < ownWriteUntil,
  };
};

// ============================================================ 分段计划：prompt 与解析
const CREDIT_PATTERN = /^\s*(作词|作曲|编曲|词|曲|制作人|监制|出品|发行|混音|母带|录音|和声|和音|配唱|吉他|贝斯|鼓|键盘|弦乐|钢琴|企划|统筹|OP|SP|ISRC|Lyrics?|Lyricist|Composer|Compose[rd]?|Arrange[rd]?|Arrangement|Producer|Produced|Mix(?:ed|ing)?|Master(?:ed|ing)?)\s*(by)?\s*[:：]/i;
const NOTICE_PATTERN = /(未经|著作权|版权所有|享有本翻译作品|TME|QQ音乐|网易云音乐|酷狗)/;
const MAX_CHARS_PER_LINE = 80;

const cleanLines = (lines) => (Array.isArray(lines) ? lines : [])
  .filter((line) => {
    const text = String(line?.fullText ?? '').trim();
    return text && !CREDIT_PATTERN.test(text) && !NOTICE_PATTERN.test(text);
  });

const clip = (text) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > MAX_CHARS_PER_LINE ? `${flat.slice(0, MAX_CHARS_PER_LINE)}…` : flat;
};

const PLAN_SYSTEM = [
  '你是歌词动画导演。你会收到一首歌的完整歌词（带每句起止秒数与段落标记 C=副歌 / V=其他），以及可选歌词动画模式清单和每个模式可调的参数。',
  '请把这首歌排成一段段「分段剧本」：每一段是连续的若干句歌词，配一个最合适的歌词动画模式，并给出该模式的参数。',
  '',
  '规则：',
  '1. 分段要贴合歌曲结构：主歌、副歌、桥段、结尾可以各自成段；情绪或能量明显变化处应该切开。',
  '2. 相邻两段尽量用不同的模式，让整首歌有层次；但不要为了换而换，安静或过渡的段落可以延续上一段的模式。',
  '2b. 清单里标了「第三方，额外安装」的模式是用户自己装的扩展动画：只要清单里有，就应该积极使用它们，',
  '    不要整首都只用内置模式。第三方模式和内置模式交替会让画面更有变化。',
  '3. mode 必须精确等于清单里的某个 id（第三方模式的 id 形如 mod:模组名:动画名，必须整串照抄，不要改写或省略前缀）。',
  '4. params 只放“你选的这个模式”的参数，键名与范围必须来自清单；只给 2~5 个你确信能贴合这段歌词的参数。形如 key(…)[需 X=Y] 的参数要连开关一起写进 params。',
  '5. from/to 是歌词行的 0-based 下标（含两端），所有段必须无缝覆盖 0..N-1，不能重叠、不能留空。',
  '6. 每段给一句不超过 30 字的中文 reason。',
  '7. 每段还要给一个 intensity（动画强度），只能是 calm / normal / chaotic 三者之一：',
  '   calm = 平静（字几乎不飘、居中稳定，适合安静的主歌、独白、伤感段）；',
  '   normal = 正常（适度漂浮与错落，大部分段落用这个）；',
  '   chaotic = 混乱（字随机散开、漂移大、透视夸张，适合副歌爆发、情绪失控、节奏激烈的段落）。',
  '   按这段的情绪强度来选，不要全曲都用同一个。',
  '8. 每段再给一个 bg（背景类型），只能是下列 id 之一：',
  '   common = 通用（纯色/主题色底，最干净，不抢歌词）；',
  '   monet = 真赝（用歌曲封面生成绘画质感的背景）；',
  '   nomand = 漫游（封面抽象化流动，做氛围）；',
  '   latent = 隐现（封面模糊隐现，安静、留白多）；',
  '   sora = 空（几乎没有背景，最省资源，适合极简段落）。',
  '   按这段的情绪与画面需要来选，也可以整首统一；不要为了换而换。',
  '{段长约束见用户消息}',
  '',
  '只输出一个 JSON 对象，不要任何其他文字：',
  '{ "segments": [ { "from": 0, "to": 2, "mode": "模式id", "params": { "键": 值 }, "intensity": "calm|normal|chaotic", "bg": "common|monet|nomand|latent|sora", "reason": "为什么这段用这个模式" }, ... ] }',
].join('\n');

const buildPlanUser = ({ title, artist, lines, modes, hardLimit, userHint }) => {
  const rows = [`歌名：${title || '(未知)'}`, `歌手：${artist || '(未知)'}`];
  // 用户的偏好提示（设置里填的）：放在最前面，比段长约束更优先被注意到
  const hint = String(userHint ?? '').trim();
  if (hint) {
    rows.push('');
    rows.push(`【用户偏好】${hint}`);
    rows.push('以上是用户对整首歌画面的要求，在满足歌词内容的前提下优先遵从；但它不能推翻「规则」里的硬性约束。');
  }
  rows.push(hardLimit
    ? '段长约束（硬限制已开启）：每段 2~4 句。'
    : '段长约束：每段长度由你按歌曲结构决定（1 句到整首都行）。');
  rows.push('', '歌词（行号 from/to 按这里算）：');
  lines.forEach((line, i) => {
    const chorus = line.isChorus ? 'C' : 'V';
    rows.push(`${i} [${clip(String(line.startTime ?? 0))}s ${chorus}] ${clip(line.fullText)}${line.translation ? ` / ${clip(line.translation)}` : ''}`);
  });
  rows.push('', '可选模式：');
  for (const mode of modes) {
    const profile = profileOf(mode.id);
    const spec = paramSpecLine(mode.id);
    const third = isThirdParty(mode.id);
    // 第三方动画：能对上画像就写画面描述；对不上也要说清它是“额外的”动画，
    // 否则 AI 会把陌生的 id 当成不可靠选项而绕开。
    let host;
    if (profile?.host) host = profile.host;
    else if (third) host = '额外安装的动画（本模组还没记录它的画面形态，但它能正常播放）';
    else host = mode.label;
    const tag = third ? '（第三方，额外安装）' : '';
    rows.push(`- ${mode.id}（${profile?.name ?? mode.label}）${tag}：${host}${spec ? `；可调参数：${spec}` : '；无参数'}`);
  }
  // 明确点出第三方动画存在，并说明来源：模型倾向只选自己熟悉的内置模式
  const thirdParty = modes.filter((m) => isThirdParty(m.id));
  if (thirdParty.length > 0) {
    const names = thirdParty.map((m) => profileOf(m.id)?.name ?? m.label ?? m.id);
    rows.push('');
    rows.push(`这个播放器额外装了 ${thirdParty.length} 个第三方歌词动画：${names.join('、')}（清单里带「第三方，额外安装」标记的那些）。`);
    rows.push('它们是用户自己安装的扩展动画，观感通常比内置模式更有辨识度，也更不容易和别的歌撞画面。');
    rows.push('选模式时请把它们当作优先候选：除非某个内置模式明显更贴合这一段，否则优先用第三方；');
    rows.push('同一首歌里尽量让第三方和内置交替出现，不要整首只用一个、也不要只挑熟悉的那几个内置模式。');
  }
  // B2+：k3panel 给「商籁」注册了另一套深调系数（cameraScale / motionScale / breathScale …），
  // 那套走宿主的 modTunings，不经 handleSetSonnetTuning，本模组写不进去也不该写。
  // 这里明确告诉 AI：只调清单里列出的那些参数，不要自己编键名。
  rows.push('');
  rows.push('关于参数：params 的键名只能取上面每个模式「可调参数」里列出的那些，不要自己发明键名。'
    + '如果某个模式另外装了给它加旋钮的模组（例如给「商籁」加深度精调的 K3Panel），那些旋钮归用户自己调，'
    + '不属于本模组能写入的范围，请不要试图在 params 里设置它们。');
  rows.push('', '请输出分段剧本 JSON。');
  return rows.join('\n');
};

const enforceHardLimit = (segments) => {
  const out = [];
  for (const s of segments) {
    const len = s.to - s.from + 1;
    if (len <= 4) { out.push({ ...s }); continue; }
    let from = s.from;
    while (from <= s.to) {
      const to = Math.min(from + 3, s.to);
      out.push({ from, to, mode: s.mode, params: s.params, intensity: s.intensity, bg: s.bg, reason: s.reason });
      from = to + 1;
    }
  }
  /* 单句段（多半是硬限制切分时的余数）合并到前一段，避免过于零碎。
   * 但只在“配置相同”时才合并——否则会把两个不同模式的段强行并成一段，
   * 等于篡改 AI 的设计（曾把单句的副歌并进主歌段，画面直接错掉）。 */
  const merged = [];
  for (const s of out) {
    const len = s.to - s.from + 1;
    if (len < 2 && merged.length) {
      const prev = merged[merged.length - 1];
      if (prev.to + 1 === s.from
        && (prev.to - prev.from + 1) + len <= 4
        && prev.mode === s.mode
        && (prev.intensity ?? null) === (s.intensity ?? null)
        && (prev.bg ?? null) === (s.bg ?? null)) {
        prev.to = s.to;
        continue;
      }
    }
    merged.push(s);
  }
  return merged;
};

/** 把 AI 返回的 segments 规整成无缝覆盖 0..N-1 的分段，可选硬限制。失败返回 null。 */
const finalizeSegments = (raw, N, hardLimit) => {
  if (!Array.isArray(raw) || raw.length === 0 || N <= 0) return null;
  const INTENSITY_OK = new Set(['calm', 'normal', 'chaotic']);
  const normIntensity = (v) => (INTENSITY_OK.has(v) ? v : null);
  const BG_OK = new Set(['common', 'monet', 'nomand', 'latent', 'url', 'sora']);
  const normBg = (v) => (BG_OK.has(v) ? v : null);
  const items = raw
    .filter((s) => s && typeof s.from === 'number' && typeof s.to === 'number')
    .map((s) => ({
      from: Math.max(0, Math.floor(s.from)),
      to: Math.min(N - 1, Math.floor(s.to)),
      mode: String(s.mode ?? ''),
      params: s.params && typeof s.params === 'object' ? s.params : {},
      intensity: normIntensity(s.intensity),
      bg: normBg(s.bg),
      reason: String(s.reason ?? ''),
    }))
    .filter((s) => s.from <= s.to && s.mode)
    .sort((a, b) => a.from - b.from);
  if (items.length === 0) return null;

  const out = [];
  let cursor = 0;
  for (const s of items) {
    if (s.from > cursor) {
      const prev = out[out.length - 1];
      out.push({
        from: cursor, to: s.from - 1,
        mode: prev ? prev.mode : s.mode,
        params: {},
        intensity: prev ? prev.intensity : s.intensity,
        bg: prev ? prev.bg : s.bg,
        reason: '',
      });
    }
    out.push({ from: s.from, to: s.to, mode: s.mode, params: s.params, intensity: s.intensity, bg: s.bg, reason: s.reason });
    cursor = s.to + 1;
  }
  if (cursor < N) {
    const prev = out[out.length - 1];
    out.push({
      from: cursor, to: N - 1,
      mode: prev ? prev.mode : 'still',
      params: {},
      intensity: prev ? prev.intensity : null,
      bg: prev ? prev.bg : null,
      reason: '',
    });
  }
  /* 合并“拆开了但配置完全一样”的相邻段。
   * AI 有时会把一段拆成两段却给出同样的模式/参数/强度/背景（比如第 1–4 句和第 5 句都是「静止」），
   * 这样每段之间多一次切换开销，画面却没有任何变化——合并掉更干净。
   * 必须在 enforceHardLimit 之前做：否则刚被切成 4 句一段，又会被合并回去，来回打架。 */
  const sameConfig = (a, b) => {
    if (a.mode !== b.mode) return false;
    if ((a.intensity ?? null) !== (b.intensity ?? null)) return false;
    if ((a.bg ?? null) !== (b.bg ?? null)) return false;
    const pa = a.params ?? {};
    const pb = b.params ?? {};
    const ka = Object.keys(pa);
    if (ka.length !== Object.keys(pb).length) return false;
    return ka.every((k) => pa[k] === pb[k]);
  };
  const coalesced = [];
  for (const s of out) {
    const prev = coalesced[coalesced.length - 1];
    if (prev && prev.to + 1 === s.from && sameConfig(prev, s)) {
      // 保留前一段的 reason（更可能是这一整段的主因），范围延伸到当前段末尾
      prev.to = s.to;
      continue;
    }
    coalesced.push({ ...s });
  }

  const segments = hardLimit ? enforceHardLimit(coalesced) : coalesced;
  // 最终连续性保险
  let pos = 0;
  const final = [];
  for (const s of segments) {
    if (s.from > pos) final.push({ from: pos, to: s.from - 1, mode: s.mode, params: {}, intensity: s.intensity, bg: s.bg, reason: '' });
    final.push(s);
    pos = s.to + 1;
  }
  if (pos < N) {
    const last = final[final.length - 1];
    final.push({ from: pos, to: N - 1, mode: last?.mode ?? 'still', params: {}, intensity: last?.intensity ?? null, bg: last?.bg ?? null, reason: '' });
  }
  // 强度和背景若有空缺，用最近一个已知值补上，保证每段都有明确取值
  let carryI = null;
  let carryBg = null;
  for (const s of final) {
    if (s.intensity) carryI = s.intensity;
    else if (carryI) s.intensity = carryI;
    if (s.bg) carryBg = s.bg;
    else if (carryBg) s.bg = carryBg;
  }
  return final;
};

// ============================================================ director 主体
const createDirector = ({ folium, host, settings, onChange, hostAudit = null }) => {
  const log = folium.log;
  let generation = 0;
  let disposed = false;
  let current = null;
  let lastLyrics = { key: null, lines: [] };
  let tickTimer = null;

  const emit = () => { try { onChange?.(); } catch (e) { log.warn('面板刷新出错', { message: String(e?.message ?? e) }); } };

  const songKeyOf = (song) => {
    if (!song) return null;
    if (song.id) return `${song.source ?? 'unknown'}:${song.id}`;
    return `t:${song.title}|${song.artist}`;
  };

  // ---- 记忆（分段计划缓存）
  /* 压缩后每条约 1.5KB（只存分段，不存歌词），1MB 能放几百条。
   * 300 是保守值：即便每段参数都很多，也远低于 1MB。
   * 超出时按 LRU 删最旧的（索引尾部）。 */
  const MAX_PLANS = 300;
  // 已经提前准备过（或正在准备）的 songKey；缓存被淘汰时同步移除，避免它再回队首时被跳过。
  const prepared = new Set();
  /* 缓存版本指纹：任何会影响“剧本长什么样”的东西变了，旧缓存就该作废。
   * 组成 = 字段版本 + prompt 文本哈希 + 模式列表指纹 + 影响分段的设置（硬限制）。
   * C2：prompt 一改，哈希就变，不用手改版本号。 */
  const PLAN_VERSION = 4;
  const hashOf = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
  };
  const PLAN_PROMPT_HASH = hashOf(PLAN_SYSTEM);
  /* 只取 id 算指纹：listModes() 会顺带算出 label（profileOf 查表 + 对象映射），
   * 每次读写缓存都跑一遍没必要。指纹只关心“有哪些模式”。 */
  const modeIds = () => host.listModeIds();
  let fpsCache = { key: '', value: '' };
  const planFingerprint = () => {
    const ids = modeIds().join(',');
    const hardLimit = settings().hardLimit ? 1 : 0;
    const applyParams = settings().applyParams ? 1 : 0;
    // B1：同一份输入不要重复算哈希（模式列表 + 两个开关决定了结果）
    const cacheKey = `${ids}|${hardLimit}|${applyParams}`;
    if (fpsCache.key === cacheKey) return fpsCache.value;
    const value = `${PLAN_VERSION}:${PLAN_PROMPT_HASH}:${ids.length}:${hashOf(ids)}:${hardLimit}${applyParams}`;
    fpsCache = { key: cacheKey, value };
    return value;
  };

  const plansIndex = { loaded: false, keys: [] };
  const loadPlansIndex = async () => {
    if (plansIndex.loaded) return plansIndex.keys;
    const stored = await folium.storage.get('plansIndex');
    plansIndex.keys = Array.isArray(stored) ? stored : [];
    plansIndex.loaded = true;
    return plansIndex.keys;
  };

  /* 删掉一批 key 的数据和索引记录（LRU 用：索引头是最近用的，尾部最旧）。 */
  const dropPlanKeys = async (keys, drop) => {
    if (drop.length === 0) return;
    await Promise.all(drop.map((k) => folium.storage.delete(`plan:${k}`).catch(() => {})));
    for (const k of drop) prepared.delete(k);
    await folium.storage.set('plansIndex', keys).catch(() => {});
  };

  /* 从索引尾部删 count 条（淘汰最旧的）。 */
  const dropPlans = async (count) => {
    const keys = await loadPlansIndex();
    if (count <= 0 || keys.length === 0) return 0;
    const drop = keys.splice(Math.max(0, keys.length - count));
    if (drop.length === 0) return 0;
    await dropPlanKeys(keys, drop);
    return drop.length;
  };

  /* 把 key 移到索引最前面（表示“最近用过”），并按上限淘汰最旧的。 */
  const touchPlan = async (key) => {
    const keys = await loadPlansIndex();
    const at = keys.indexOf(key);
    if (at !== -1) keys.splice(at, 1);
    keys.unshift(key);
    await dropPlanKeys(keys, keys.splice(MAX_PLANS));
  };

  /* 缓存只存分段（每段是行号 + 模式 + 参数），不再存歌词：
   * 歌词播放时必然存在，存一份是重复的——之前正是它把 1MB 塞满（每首 36KB）。 */
  const compactPlan = (plan, fp) => ({
    fp,
    at: plan.at ?? Date.now(),
    // 只留分段需要的字段；行数也记下，读缓存时用来校验歌词是否换了源
    n: Array.isArray(plan.lines) ? plan.lines.length : (plan.n ?? 0),
    segments: (plan.segments ?? []).map((s) => ({
      from: s.from, to: s.to, mode: s.mode,
      params: s.params ?? {}, intensity: s.intensity ?? null, bg: s.bg ?? null,
      reason: s.reason ?? '',
    })),
  });

  /* 一次性清理：旧版缓存存了整首歌词（每首 36KB），15 首就把 1MB 塞满。
   * 这些数据新版用不上（版本指纹也变了），直接删掉腾出空间。
   * 只删带 lines 字段的旧条目，不会碰到新格式（新格式没有 lines）。
   * 并行读取：缓存可能有几百条，串行读会在启动时卡住主线程。
   * A4：清理完写一个标记，以后启动不再全表扫描（几百条读一次也不便宜）。 */
  const PURGE_FLAG = 'legacyPurged:v1';
  const purgeLegacyPlans = async () => {
    try {
      if (await folium.storage.get(PURGE_FLAG)) return;
      const keys = await loadPlansIndex();
      if (keys.length === 0) {
        await folium.storage.set(PURGE_FLAG, true).catch(() => {});
        return;
      }
      const entries = await Promise.all(
        keys.map((k) => folium.storage.get(`plan:${k}`).catch(() => null).then((v) => [k, v])),
      );
      const legacy = entries.filter(([, v]) => v && Array.isArray(v.lines)).map(([k]) => k);
      if (legacy.length > 0) {
        await Promise.all(legacy.map((k) => folium.storage.delete(`plan:${k}`).catch(() => {})));
        const kept = keys.filter((k) => !legacy.includes(k));
        await folium.storage.set('plansIndex', kept).catch(() => {});
        for (const k of legacy) prepared.delete(k);
        log.info('已清理旧格式缓存（含歌词的条目）', { removed: legacy.length });
      }
      await folium.storage.set(PURGE_FLAG, true).catch(() => {});
    } catch (e) {
      log.warn('清理旧缓存失败', { message: String(e?.message ?? e) });
    }
  };

  /* 读缓存并补回运行时才有的信息（start/end 与歌词）。
   * linesHint 是当前播放器里的歌词；行数对不上就视为失效（歌词换过源）。 */
  const getPlan = async (key, linesHint = null) => {
    if (!key) return null;
    const stored = (await folium.storage.get(`plan:${key}`)) ?? null;
    if (!stored) return null;
    if (stored.fp !== planFingerprint()) return null;
    if (!Array.isArray(stored.segments) || stored.segments.length === 0) return null;
    const lines = linesHint ?? null;
    // 有歌词时校验行数：差太多说明歌词换了源，分段行号不可信
    if (lines && stored.n && Math.abs(lines.length - stored.n) > 2) return null;
    // 补 start/end（tick 里要用），歌词缺失时退化为 0，后续拿到歌词再补
    for (const s of stored.segments) {
      s.start = lines ? (Number(lines[s.from]?.startTime) || 0) : (s.start ?? 0);
      s.end = lines ? (Number(lines[s.to]?.endTime) || 0) : (s.end ?? 0);
    }
    return { ...stored, lines: lines ?? [] };
  };

  /* 写入缓存。顺序很关键：先腾地方再写，因为 1MB 上限是硬限制，
   * 写失败就直接抛异常，靠“写完再淘汰”永远等不到淘汰那一步。 */
  const putPlan = async (key, plan) => {
    const compact = compactPlan(plan, planFingerprint());
    try {
      await folium.storage.set(`plan:${key}`, compact);
      await touchPlan(key);
      return true;
    } catch (e) {
      // 满了（或其它写入错误）：批量删掉最旧的 1/3 再试一次
      log.warn('写入计划缓存失败，清理最旧的三分之一后重试', { message: String(e?.message ?? e) });
      const keys = await loadPlansIndex();
      const n = Math.max(1, Math.ceil(keys.length / 3));
      await dropPlans(n);
      try {
        await folium.storage.set(`plan:${key}`, compact);
        await touchPlan(key);
        return true;
      } catch (e2) {
        log.warn('清理后仍写入失败，放弃这条缓存', { message: String(e2?.message ?? e2) });
        return false;
      }
    }
  };

  /* 不做版本校验的读取：提前准备时用来判断“是否已经有人写过这份缓存”。 */
  const hasPlanRaw = async (key) => Boolean(key && (await folium.storage.get(`plan:${key}`)));

  // ---- 取歌词
  /* `waitForEvent` = 是否等 lyrics.loaded 事件（只有“当前正在播的歌”才需要等；
   * 提前准备下一首时，那首歌还没播，等事件没有意义，直接走在线歌词接口）。 */
  const lyricsFor = async (song, key, gen, { waitForEvent = true } = {}) => {
    if (waitForEvent) {
      const until = performance.now() + 4000;
      while (performance.now() < until) {
        if (gen !== generation || disposed) return null;
        if (lastLyrics.key === key && lastLyrics.lines.length > 0) return lastLyrics.lines;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    if (lastLyrics.key === key && lastLyrics.lines.length > 0) return lastLyrics.lines;
    if (songKeyOf(folium.playback.getState().song) === key) {
      const onScreen = folium.lyrics.getLines();
      if (onScreen.length > 0) return onScreen;
    }
    if (song?.ref && typeof folium.omni?.getLyrics === 'function') {
      try {
        const fetched = await folium.omni.getLyrics(song);
        if (fetched.lines.length > 0) return fetched.lines;
      } catch (e) { log.info('在线歌词也拿不到', { message: String(e?.code ?? e?.message ?? e) }); }
    }
    return [];
  };

  // ---- 排演（一次 AI 调用）
  /* 预热记录：一首歌之内，热过的模式不再重复热。换歌时清空。
   * Folia 只暴露了 prewarm()，没有卸载接口，所以“热完删掉”做不到；
   * 能做的是“用不到就不热”——由 tick 按时间窗口决定预热谁。 */
  const warmedModes = new Set();
  const resetWarmed = () => warmedModes.clear();

  /* 预热单个模式（幂等：热过的直接跳过）。
   * 注意：host.prewarmMode() 内部是 try/catch 吞异常的，失败也可能不抛错，
   * 所以这里不能“调用成功就当热好了”。先记下来，过一会儿再确认它是否真的可用；
   * 确认不了也不清（宁可少热一次，也不要陷入反复预热的开销）。 */
  const prewarmOnce = (mode) => {
    if (!mode || disposed) return false;
    if (warmedModes.has(mode)) return false;
    // 当前正在显示的那个不需要预热：它本来就是热的
    if (host.currentMode() === mode) return false;
    warmedModes.add(mode);
    let ok = false;
    try {
      ok = host.prewarmMode(mode);
    } catch (e) {
      ok = false;
    }
    // prewarmMode 返回 false 表示这个模式没有 prewarm 方法（不是所有视觉器都实现），
    // 那种情况就当作“不需要预热”，别留着记录让它以后反复尝试。
    if (!ok) warmedModes.delete(mode);
    return ok;
  };

  /* 只热「第一段」：切歌后第一个画面靠它，必须立刻。
   * 其余模式不再一次性排队预热（会白白占资源，还可能拖慢刚切完的这一帧），
   * 交给 tick 在“下一段即将到来”时提前热。 */
  const prewarmFirst = (plan) => {
    const first = plan?.segments?.[0]?.mode ?? null;
    if (!first) return;
    const gen = generation;
    // 下一帧再热，避免和“刚切完歌”这一帧抢主线程。
    // 但要检查 generation：这一帧内可能又换歌了，那时预热的是上一首的模式，纯浪费。
    requestAnimationFrame(() => {
      if (disposed || gen !== generation) return;
      prewarmOnce(first);
    });
  };

  /* 核心：给任意一首歌（含歌词）排一份剧本，不碰 current、不动画面。
   * 这样既能给正在播的歌用，也能提前给队列里的下一首用。
   * key 由调用方决定（当前歌用 current.key，提前准备用下一首的 key）。 */
  const buildPlanFor = async ({ song, key, lines: rawLines, hardLimit }) => {
    const values = settings();
    const baseUrl = baseUrlFor(values);
    if (!baseUrl) throw Object.assign(new Error('还没有选择服务商（设置 → 模组 → AI 逐段歌词导演）'), { code: 'no-config' });
    if (!values.model) throw Object.assign(new Error('还没有填写模型名'), { code: 'no-config' });
    const apiKey = (await folium.secrets.get('apiKey')) ?? '';
    if (!apiKey) throw Object.assign(new Error('还没有填写 API 密钥（设置 → 模组 → AI 逐段歌词导演）'), { code: 'no-key' });

    const lines = cleanLines(rawLines);
    if (lines.length === 0) throw new Error('这首歌没有歌词，无法逐段排演');
    // 委托型模式（例如「随机」）不进候选：本模组要按段决定画面，选它等于放弃控制。
    const modes = host.listModes().filter((m) => !isDelegatingMode(m.id));
    if (modes.length === 0) throw new Error('没有可用的歌词动画模式');

    const raw = await requestCompletion({
      baseUrl,
      apiKey,
      model: values.model,
      temperature: normalizeTemperature(values.temperature),
      system: PLAN_SYSTEM,
      user: buildPlanUser({
        title: song.title, artist: song.artist, lines, modes,
        hardLimit: hardLimit ?? values.hardLimit,
        // 用户偏好提示：设置里填了就会随请求发出去（之前收了却没用上）
        userHint: values.userHint,
      }),
    });

    let parsed;
    try { parsed = extractJson(raw); } catch (e) { throw new Error(`AI 返回的内容无法解析为 JSON：${String(e.message || e)}`); }
    const segments = finalizeSegments(parsed?.segments, lines.length, hardLimit ?? values.hardLimit);
    if (!segments) throw new Error('AI 返回的分段剧本无效');

    /* 解析 AI 给的 mode。找不到就回退到第一个可用模式，但要记下是哪几段回退了：
     * 之前是静默回退，表现为“AI 选错了动画”，实际是 id 没解析上（多为第三方动画 id 有歧义）。 */
    const fallbackMode = modes[0]?.id ?? 'still';
    const unresolved = [];
    const outSegments = segments.map((s) => {
      const resolved = host.resolveMode(s.mode, modes);
      const mode = resolved ?? fallbackMode;
      if (!resolved && s.mode) unresolved.push(String(s.mode));
      const intensity = ['calm', 'normal', 'chaotic'].includes(s.intensity) ? s.intensity : 'normal';
      const bg = host.BG_MODES_FOR_AI.includes(s.bg) ? s.bg : null;
      // C1：预存这一段的起止时间，tick 里就不用每帧再去 lines 里查
      return {
        from: s.from, to: s.to, mode,
        params: sanitizeParams(mode, s.params), intensity, bg,
        start: Number(lines[s.from]?.startTime) || 0,
        end: Number(lines[s.to]?.endTime) || 0,
        reason: String(s.reason ?? '').slice(0, 30),
      };
    });
    if (unresolved.length > 0) {
      const uniq = [...new Set(unresolved)];
      log.warn('部分模式 id 没解析上，已回退到第一个可用模式', { unmatched: uniq, fallback: fallbackMode });
    }

    return {
      key,
      lines,
      segments: outSegments,
      // 记下没解析上的模式 id：面板会提示，方便判断是 AI 写错还是注册表变了
      unresolvedModes: [...new Set(unresolved)],
      // 记歌词行数：压缩后缓存里没有歌词，靠它校验“这首歌的歌词是否换过源”
      n: lines.length,
      at: Date.now(),
    };
  };

  /* 给正在播的这首歌排演：会更新面板状态、写缓存、预热。 */
  const planSong = async (target) => {
    target.phase = 'planning';
    target.message = 'AI 正在排分段剧本（一次调用）';
    emit();
    const plan = await buildPlanFor({
      song: target.song,
      key: target.key,
      lines: target.lines,
      hardLimit: settings().hardLimit,
    });
    target.plan = plan;
    target.appliedSeg = -1;
    // 排演完成后立刻热第一段（切歌后第一个画面靠它），其余模式再慢慢排队预热。
    // 这样切过去时是热的，浮名这类排版慢的模式不用临时现排。
    prewarmFirst(plan);
    return plan;
  };

  // ---- 提前为队列里的下一首排演（切过去时 0 延迟）
  /* 取队列里紧随当前歌的那一首。队列不可用、单曲循环、或没有下一首时返回 null。
   * 注意 getQueue 的真实签名是 getQueue(offset, limit)（两个数字，不是对象）：
   *   Zie(state, offset, limit) → { items, length, currentIndex, kind, version }
   * 传错会让它返回空数组，表现为“永远没有下一首”。
   * 失败原因写进 lastPrefetchNote，方便在面板上看出来为什么没提前准备。 */
  let lastPrefetchNote = '';
  const nextSongInQueue = () => {
    try {
      const pb = folium.playback;
      if (typeof pb?.getQueue !== 'function') { lastPrefetchNote = '播放器没有队列接口'; return null; }
      // C3：只需要当前位置之后的一首，但 length / currentIndex 无论取多少都是全队列的真值，
      // 所以取一小段就够（避免大歌单每次都复制上千条）。
      const q = pb.getQueue(0, 80);
      if (!q) { lastPrefetchNote = '读不到队列'; return null; }
      if (q.kind === 'stage') { lastPrefetchNote = '当前在舞台模式，没有队列'; return null; }
      if (typeof q.currentIndex !== 'number' || q.currentIndex < 0) { lastPrefetchNote = '队列里没有当前曲目'; return null; }
      const total = q.length ?? 0;
      if (total <= 0) { lastPrefetchNote = '队列为空'; return null; }
      const loop = pb.getLoopMode?.() ?? 'off';
      if (loop === 'one') { lastPrefetchNote = '单曲循环，没有下一首'; return null; }
      let idx = q.currentIndex + 1;
      if (idx >= total) {
        if (loop !== 'all') { lastPrefetchNote = '已经是最后一首'; return null; }
        idx = 0;
      }
      // 已经有这段队列了：先从这里找下一首
      let song = q.items.find((it) => it.index === idx)?.song ?? null;
      // 当前索引靠后时，80 条的窗口可能没覆盖到，再精确取那一条
      if (!song) {
        const one = pb.getQueue(idx, 1);
        song = one?.items?.find((it) => it.index === idx)?.song ?? null;
      }
      if (!song) { lastPrefetchNote = '队列里取不到下一首的歌'; return null; }
      return song;
    } catch (e) {
      lastPrefetchNote = `读队列出错：${String(e?.message ?? e)}`;
      return null;
    }
  };

  /* 提前准备的去重与超时：
   * - prepared：已经准备过（或正在准备）的 songKey，避免 A→B→A→B 反复触发；
   * - prefetching：同一时刻只跑一个；带超时，避免一次卡死就永久堵住后面的调用。 */
  let prefetching = null;      // 当前正在准备的 songKey
  let prefetchTimer = 0;       // 超时保护
  const PREFETCH_TIMEOUT_MS = 20000;
  const PREFETCH_DELAY_MS = 2000;   // 排演完等 2 秒再准备：够区分“刚开就切走”，又不至于等太久
  /* 已提前准备好的“下一首”：{ key, seg }，seg 是第一段的完整配置（模式/参数/强度/背景）。
   * 有了它，切歌瞬间就能一次应用完，不用等读缓存 / 拿歌词。 */
  let nextReady = null;

  /* 当前这首歌排演完成后，为下一首准备剧本并写缓存。
   * delayMs > 0 时延迟执行（首次进去时用来避免用户立刻切歌导致白费）。 */
  const prefetchNextSong = async ({ delayMs = PREFETCH_DELAY_MS } = {}) => {
    // 每一步都留痕：面板显示“为什么没准备”，便于排查
    if (settings().prefetchNext === false) { lastPrefetchNote = '设置里关掉了「提前为下一首排演」'; return; }
    if (disposed) { lastPrefetchNote = '模组已停用'; return; }
    if (prefetching) { lastPrefetchNote = `正在准备另一首，本次跳过`; return; }
    lastPrefetchNote = '正在检查下一首…';
    emit();

    const next = nextSongInQueue();
    if (!next) return;   // nextSongInQueue 内部已经写好原因了
    const key = songKeyOf(next);
    if (!key) { lastPrefetchNote = '下一首没有可用的歌曲标识'; return; }
    if (key === current?.key) { lastPrefetchNote = '队列的下一首就是当前这首'; return; }
    // A1：prepared 只代表“曾经准备过”。缓存可能已被淘汰、版本变更失效，
    // 也可能这首歌的歌词换过源（行数变了，旧分段行号不可信）——这些都要允许重做。
    // B4：所以这里不只看“有没有缓存”，还要用歌词校验行数；歌词是后面本来也要拿的。
    if (prepared.has(key)) {
      const cachedNoLines = await getPlan(key);
      if (cachedNoLines) {
        // 有缓存：用真实歌词核对一次行数，对不上就作废重排
        const probe = await lyricsFor(next, key, generation, { waitForEvent: false }).catch(() => null);
        if (probe && probe.length > 0) {
          const valid = await getPlan(key, probe);
          if (valid) { lastPrefetchNote = '下一首已有可用剧本，无需准备'; return; }
          prepared.delete(key);          // 行数不匹配 → 允许重做
        } else {
          // 拿不到歌词就无法校验；保守起见当作有效，别为此白跑一次 AI
          lastPrefetchNote = '下一首已有可用剧本，无需准备';
          return;
        }
      } else {
        prepared.delete(key);
      }
    }
    // 先占位再等待：否则延迟期间切歌会重入，重复发起请求
    prepared.add(key);
    prefetching = key;
    let succeeded = false;
    try {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      if (disposed) return;
      // 延迟期间可能已经切到这首了（那就不叫“提前”了）
      if (current?.key === key) return;
      // 缓存是否有效留到拿到歌词后再判（需要行数校验），这里不再用无歌词的 getPlan 短路
      lastPrefetchNote = `正在为「${next.title ?? '下一首'}」排演…`;
      emit();

      const gen = generation;
      prefetchTimer = setTimeout(() => {
        lastPrefetchNote = '提前准备超时，下次切过去时再排';
      }, PREFETCH_TIMEOUT_MS);


      const lines = await lyricsFor(next, key, gen, { waitForEvent: false });
      if (disposed || !lines || lines.length === 0) {
        lastPrefetchNote = '下一首没有歌词，跳过提前准备';
        return;
      }
      // A2：这期间可能已经换过歌（generation 变了），那这批歌词就不可信了。
      // 提前准备是后台任务，换歌后继续写缓存没有意义，直接放弃。
      if (gen !== generation) {
        lastPrefetchNote = '已切歌，本次提前准备作废';
        return;
      }
      // B4：拿到歌词后用歌词校验缓存（行数不一致→旧剧本作废）。上面那次检查没法传歌词。
      if (await getPlan(key, lines)) {
        succeeded = true;
        lastPrefetchNote = '下一首已有可用剧本，无需准备';
        return;
      }
      if (await hasPlanRaw(key)) { succeeded = true; return; }   // 期间别的路径写好了
      const plan = await buildPlanFor({ song: next, key, lines, hardLimit: settings().hardLimit });
      if (disposed || gen !== generation) return;   // 写缓存前再确认一次（含换歌检查）
      await putPlan(key, plan);
      succeeded = true;
      lastPrefetchNote = `已提前准备好「${next.title ?? '下一首'}」`;
      log.info('已提前为下一首准备好剧本', { title: next.title, segs: plan.segments.length });
      // 提前准备的价值不只是省 AI 调用：顺手把「下一首第一段」的模式也热起来，
      // 这样切过去时第一个画面能立刻出来（真正的无缝衔接）。
      prewarmFirst(plan);
      // 记到内存里：切歌瞬间就能直接把第一段的模式/参数/强度/背景全部应用，
      // 不用等读存储/拿歌词，也不会出现“只换了模式、参数还是上一首”的半套状态。
      nextReady = { key, seg: plan.segments[0] ?? null };
      emit();
    } catch (e) {
      lastPrefetchNote = `提前准备失败：${String(e?.message ?? e)}`;
      log.info('提前准备下一首失败（切过去时再排）', { message: String(e?.message ?? e) });
    } finally {
      clearTimeout(prefetchTimer);
      prefetchTimer = 0;
      prefetching = null;
      // 没成功就别留下“准备过”的记号，否则这首歌以后会被永久跳过
      if (!succeeded) prepared.delete(key);
      emit();
    }
  };

  // ---- 播放循环：按句定位 → 在安全空隙里按段切换（避免卡顿、不带出旧句）
  const lineIndexAt = (lines, position) => {
    let idx = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (Number.isFinite(lines[i].startTime) && position >= lines[i].startTime) idx = i;
      else if (idx >= 0) break;
    }
    return idx;
  };
  const segmentForLine = (plan, lineIdx) => {
    for (let i = 0; i < plan.segments.length; i += 1) {
      if (lineIdx >= plan.segments[i].from && lineIdx <= plan.segments[i].to) return i;
    }
    return -1;
  };

  let originalIntensity = null;   // 模组接管前的动画强度，供恢复
  let originalBackground = null;  // 模组接管前的背景类型，供恢复

  /* 慢/重模式的代价表：一张表描述「提前多少秒切过去」和「切过去时临时降哪些画质」。
   * extraLead = 额外提前秒数（铺场慢的模式要更早切）；
   * patch     = 临时降的画质参数；restoreMs = 多久后恢复。
   * 只放真正影响重建开销的键，纯视觉参数（透明度之类）降了没用还改变观感。 */
  const MODE_COST = {
    // 浮名：满屏堆叠，要排版整首歌词，铺场最慢。靠「提前预热」解决，不靠遮罩硬压。
    fume: { extraLead: 2.4 },
    machi: {
      extraLead: 1.8,           // 町景：3D 街景 + 阴影反射
      patch: { quality: 'low', antialias: false, shadows: false, reflections: false, adaptive: true },
      restoreMs: 1800,
    },
    lumiere: { extraLead: 0, patch: { renderQuality: 'low' }, restoreMs: 1200 },  // 绘光：重建后画质分层
    sonnet: { extraLead: 1.0, patch: { textureResolution: 0.5, postProcessEnabled: false }, restoreMs: 1400 },
    tempera: { extraLead: 0.7, patch: { textureResolution: 0.5, postProcessEnabled: false }, restoreMs: 1400 },
    nebbia: { extraLead: 1.0 }, // 雾笺：程序化雾气 + 手写动画
    diorama: { extraLead: 0.6 },// 镜台：3D 粒子
  };
  const extraLeadFor = (mode) => MODE_COST[mode]?.extraLead ?? 0;

  let qualityRestoreTimer = 0;
  // 每个模式各自记录：mode -> { saved: {键: 原值}, keys: [改过的键], at: 时间戳 }
  // 以前只存一个值，连续切两次重模式时前一次的恢复会被丢掉，导致画质永远停在 low。
  const qualitySaved = new Map();

  /* 立即还原被临时降的画质。
   * A2：恢复前先比对当前 tuning——如果某个键已经被新一段的 AI 参数改掉了，就不要用旧值覆盖它。 */
  const restoreQualityNow = () => {
    clearTimeout(qualityRestoreTimer);
    qualityRestoreTimer = 0;
    for (const [mode, item] of qualitySaved.entries()) {
      const now = host.readTuning(mode);
      if (!now) continue;             // 模式已切走，读不到就不动它
      const patch = {};
      for (const [key, original] of Object.entries(item.saved)) {
        // 只有当它还是我们当初写入的那一档时，才说明没被别的逻辑改过，可以安全还原
        if (now[key] === item.applied[key]) patch[key] = original;
      }
      if (Object.keys(patch).length === 0) continue;
      try { host.setParams(mode, patch); } catch (e) { /* 忽略 */ }
    }
    qualitySaved.clear();
  };

  /** 切到慢/重模式时临时降画质；按模式各自计时，互不干扰。 */
  const applyTempQuality = (mode) => {
    const spec = MODE_COST[mode];
    if (!spec?.patch) return;
    if (!qualitySaved.has(mode)) {
      const tuning = host.readTuning(mode);
      if (!tuning) return;
      // 只记录真正会变化的键的原值；已经是目标值的不记
      const saved = {};
      const applied = {};
      const patch = {};
      for (const [key, low] of Object.entries(spec.patch)) {
        const original = tuning[key];
        if (original === undefined) continue;
        if (original === low) continue;
        saved[key] = original;
        applied[key] = low;
        patch[key] = low;
      }
      if (Object.keys(patch).length === 0) return;
      qualitySaved.set(mode, { saved, applied });
      host.setParams(mode, patch);
    }
    // A3：每个模式各自的恢复计时器，避免多模式混用时时机错乱
    const item = qualitySaved.get(mode);
    if (item.timer) clearTimeout(item.timer);
    item.timer = setTimeout(() => {
      qualitySaved.delete(mode);
      const now = host.readTuning(mode);
      if (!now) return;
      const patch = {};
      for (const [key, original] of Object.entries(item.saved)) {
        if (now[key] === item.applied[key]) patch[key] = original;
      }
      if (Object.keys(patch).length === 0) return;
      try { host.setParams(mode, patch); } catch (e) { /* 忽略 */ }
    }, spec.restoreMs ?? 1300);
  };

  /* 第一次改动宿主设置之前存一份快照（只存一次），供「恢复原来的设置」使用。 */
  const ensureSnapshot = async () => {
    try {
      const existing = await folium.storage.get('snapshot');
      if (existing) return;
      const saved = host.snapshot();
      if (saved) await folium.storage.set('snapshot', saved);
    } catch (e) {
      log.warn('保存设置快照失败', { message: String(e?.message ?? e) });
    }
  };

  /* 把一个「段配置」直接应用到宿主：模式 + 参数 + 强度 + 背景，一次做完。
   * 用在「切歌瞬间直接换」上——那里没有 current.plan，也不该等 tick。
   * 不做同模式判断、不走遮罩，调用方负责确认这确实是需要换的。 */
  const applySegmentSpec = (seg) => {
    if (!seg?.mode) return false;
    if (disposed || !current) return false;   // 已停用 / 还没建立当前歌上下文
    try {
      current.expectedMode = seg.mode;
      // 窗口和正常切段保持一致（2.5 秒）：宿主重建慢时 modeChanged 会晚到，
      // 窗口太短就会被误判成“用户手动换的”，从而停掉整首的自动切换。
      current.expectedUntil = performance.now() + 2500;
      host.setMode(seg.mode);
      if (settings().applyParams && seg.params && Object.keys(seg.params).length > 0) {
        host.setParams(seg.mode, seg.params);
      }
      host.setClean(seg.mode);
      if (seg.intensity && settings().applyIntensity) host.setIntensity(seg.intensity);
      if (seg.bg) host.setBackground(seg.bg);
      current.segAt = performance.now();
      return true;
    } catch (e) {
      log.warn('应用段配置失败', { mode: seg.mode, message: String(e?.message ?? e) });
      return false;
    }
  };

  const applySegment = (si, { immediate = false, force = false } = {}) => {
    const seg = current.plan.segments[si];
    if (!seg) return;
    current.appliedSeg = si;

    /* 目标模式与当前完全一致时，不该再压暗一遍：
     * 宿主 setMode 对相同模式是空操作（不会重建），遮罩却会白跑一轮，表现为“莫名黑一下”。
     * 分三种情况处理：
     *   1) 模式 + 参数 + 背景 全同 → 什么都不做；
     *   2) 模式相同，但参数/背景有变化 → 直接改，不压暗（这些不重建场景）；
     *   3) 模式不同 → 正常走过渡。
     * `force` 用于跳播/接管等场景：即使全同也重新应用一次（保证画面正确）。
     *
     * 注意：动画强度不参与上面的判断。强度不能立即重绘（宿主没暴露接口），
     * 若让“强度变了”成为“需要切换”的理由，只会把新值提前写进 localStorage，
     * 导致下一段读到的强度错位。所以强度只在「切模式/切背景」时顺带写。 */
    const sameMode = !force && host.currentMode() === seg.mode;
    if (sameMode) {
      // 参数是否真的需要改：逐键与当前 tuning 比对，全部相同就不算“要改”
      const wantParams = (() => {
        if (!settings().applyParams) return false;
        const want = seg.params;
        if (!want || Object.keys(want).length === 0) return false;
        const now = host.readTuning(seg.mode);
        if (!now) return true;
        return Object.entries(want).some(([k, v]) => now[k] !== v);
      })();
      const curBg = host.readBackground();
      const wantBg = Boolean(seg.bg) && seg.bg !== curBg;
      // A1/A2：只看参数和背景，强度不参与。否则“同模式只改强度”会空跑且写错值。
      if (!wantParams && !wantBg) {
        // 全同：彻底跳过。但要把 segAt 记上，否则最小间隔判定会以为“刚切过”，
        // 后续段也可能被误压住。
        current.segAt = performance.now();
        return;
      }

      // 有变化：不压暗直接应用。setClean 每次都要写（它负责压掉上一句残留），很便宜。
      ensureSnapshot().catch(() => {});
      try {
        // A5：同模式改参数也可能触发 store 变化，登记预期模式，避免被误判成“用户接管”
        current.expectedMode = seg.mode;
        current.expectedUntil = performance.now() + 2000;
        if (wantParams) host.setParams(seg.mode, seg.params);
        host.setClean(seg.mode);
        if (wantBg) host.setBackground(seg.bg);
        current.segAt = performance.now();
        emit();
      } catch (e) {
        log.warn('同模式内改参数失败', { mode: seg.mode, message: String(e?.message ?? e) });
      }
      return;
    }

    const doSwitch = () => {
      // 第一次改动宿主设置之前先存一份快照，供「恢复原来的设置」使用。
      // （异步保存，不阻塞切换；ensureSnapshot 内部会检查是否已存过。）
      ensureSnapshot().catch(() => {});
      try {
        // 先登记“预期模式”：宿主随后发来的 modeChanged 若等于它，就是我们自己切的，
        // 不看时间窗，避免过渡延迟导致的误判（曾把自动切换当成用户接管而停掉整首）。
        // 窗口给 2.5 秒：够覆盖慢模式的重建延迟，又不会长到把你的手动切换也吞掉。
        current.expectedMode = seg.mode;
        current.expectedUntil = performance.now() + 2500;
        host.setMode(seg.mode);
        if (settings().applyParams && seg.params && Object.keys(seg.params).length > 0) {
          host.setParams(seg.mode, seg.params);
        }
        host.setClean(seg.mode);
        // 重模式临时降画质，换切换时的流畅（会自动恢复）
        applyTempQuality(seg.mode);
        // 动画强度跟着这一段走：写进宿主读的那个 key，随这次模式重建一起生效
        if (seg.intensity && settings().applyIntensity) host.setIntensity(seg.intensity);
        // 背景类型也跟着这一段走（只写 visualizer_background_mode，不动主题/配色）
        if (seg.bg) host.setBackground(seg.bg);
        current.segAt = performance.now();
        emit();
      } catch (error) {
        current.phase = 'error';
        current.message = `切到「${profileOf(seg.mode)?.name ?? seg.mode}」失败：${String(error?.message ?? error)}`;
        log.warn('切换动画模式失败', { mode: seg.mode, message: String(error?.message ?? error) });
        emit();
        return;
      }
      // 宿主可能静默忽略某些模式（第三方动画未就绪等）：过一会儿核对一次，把失败摊到面板上
      const target = seg.mode;
      const segIndex = si;
      setTimeout(() => {
        if (disposed || !current || current.appliedSeg !== segIndex) return;
        const actual = host.currentMode();
        if (actual && actual !== target) {
          current.phase = 'switch-failed';
          current.message = `「${profileOf(target)?.name ?? target}」没能生效（当前仍是 ${profileOf(actual)?.name ?? actual}）`;
          log.warn('动画模式切换未生效', { want: target, actual });
          emit();
        }
      }, 700);
    };

    if (settings().transition && !force) {
      // 压暗到接近全遮时才真正切模式；随后等新场景画出来再亮回。
      // 遮罩时间保持原样，不靠它硬压慢模式——慢模式用「提前预热」解决。
      const target = seg.mode;
      const switchAt = { t: 0 };
      runFadeTransition({
        onCovered: () => { switchAt.t = performance.now(); doSwitch(); },
        isReady: () => {
          if (!switchAt.t) return false;
          const actual = host.currentMode();
          const settled = actual === target;
          const elapsed = performance.now() - switchAt.t;
          return settled && elapsed >= 260;
        },
      });
    } else {
      doSwitch();
    }

    // 切完之后不再一次性预热门下一个模式：改由 tick 里的 prewarmUpcoming
    // 按“20 秒内会用到的”来热，避免过早预热白占资源。
  };

  /** 返回 { pos, state }，无歌返回 null。 */
  const playbackNow = () => {
    const st = folium.playback.getState();
    if (!st?.song) return null;
    return { pos: st.position, state: st.state, song: st.song };
  };

  /* 段边界就在“新段第一句开唱”的那一刻：到点立刻切，不再往后找空隙——
   * 之前等空隙导致歌词早就唱过去了还没切。间隙短时直接切，靠闪黑遮住。 */
  /* 预判式预热：看「接下来 20 秒内会切换到哪一段」，把它的模式提前热好。
   * 这样任何时刻只热“马上要用的”，不会一次性占用一堆资源；
   * 热过的记在 warmedModes 里，不重复热（也没有卸载接口，热了就不管了）。 */
  let lastPrewarmScanAt = 0;
  const prewarmUpcoming = (pos, cfg) => {
    if (!current?.plan) return;
    const now = performance.now();
    // 每 1.5 秒扫一次就够，不必每帧都算
    if (now - lastPrewarmScanAt < 1500) return;
    lastPrewarmScanAt = now;
    // 窗口由设置决定（默认 20 秒）：调大更保险，调小更省资源
    const aheadRaw = Number(cfg?.prewarmAhead);
    const ahead = Number.isFinite(aheadRaw) && aheadRaw > 0 ? aheadRaw : 20;
    const segs = current.plan.segments;
    for (let i = 0; i < segs.length; i += 1) {
      const seg = segs[i];
      const start = Number(seg.start);
      if (!Number.isFinite(start)) continue;
      // 已经开始或已经过去的段不需要预热
      if (start < pos) continue;
      // 超出预判窗口的不用管（更远的以后再说）
      if (start - pos > ahead) break;
      if (seg.mode && !warmedModes.has(seg.mode)) prewarmOnce(seg.mode);
    }
  };

  const tick = () => {
    if (disposed || !current || current.userOverrode || !current.plan) return;
    const pb = playbackNow();
    if (!pb) return;
    const now = performance.now();
    // 位置在推进就当作在播放：不同版本 state 的取值不完全一致（playing/play/...），
    // 只认 'playing' 会让某些版本永远不切。
    const advancing = Math.abs((pb.pos ?? 0) - (current.lastPos ?? -1)) > 0.02;
    current.lastPos = pb.pos;
    if (pb.state !== 'playing' && !advancing) {
      /* 位置不动（缓冲/加载中）：把跳播基准清掉。
       * 否则缓冲恢复后的第一帧会因为“过了很久但位置没对应前进”被判成跳播，
       * 触发一次多余的强制重切。 */
      current.jumpBase = null;
      return;
    }
    // 暂停时不切：静止画面上任何过渡都格外刺眼，而且暂停时切段没有意义。
    // A3：暂停/恢复之间不记跳播基准，否则恢复播放的第一帧会被算成“跳了一大段”。
    if (pb.state === 'paused') { current.jumpBase = null; return; }

    /* 跳播检测改成“按实际经过时间算预期位移”：
     * 正常播放时位置应该前进 ≈ 经过秒数；偏离太多才是拖动进度条。
     * 这样暂停恢复、缓冲卡顿后追上播放位置都不会被误判成跳播。
     * 没基准（刚换歌/刚恢复暂停）时只建立基准，不判跳播。 */
    const pos = pb.pos ?? 0;
    const base = current.jumpBase;
    let jumped = false;
    if (!base) {
      current.jumpBase = { pos, at: now };
    } else {
      const dt = (now - base.at) / 1000;
      const expected = dt;                       // 正常播放应前进的秒数
      const actual = pos - base.pos;
      // 偏离 1.5 秒以上才算跳播（缓冲卡顿、解码抖动都远小于这个量级）
      jumped = Math.abs(actual - expected) > 1.5;
      current.jumpBase = { pos, at: now };
    }

    /* 每帧只取一次设置：settings() 会读存储并构造新对象，tick 40ms 一次不宜多调。
     * 这里提前取，后面预热和提前量计算共用同一份。 */
    const cfg = settings();

    // 顺手把“即将到来”的模式提前热好（这才是秒切的关键）
    prewarmUpcoming(pos, cfg);
    const lines = current.plan.lines;
    const li = lineIndexAt(lines, pb.pos);
    const firstStart = Number(lines[0]?.startTime);
    // 前奏：还没唱到第一句，归第一段。这里没有唱词可打断，直接切，
    // 否则换歌后会一直停在上一首的动画上。
    const beforeFirst = li < 0 && (!Number.isFinite(firstStart) || pb.pos < firstStart);
    if (beforeFirst) {
      if (current.appliedSeg !== 0) {
        // 前奏也要守最小间隔：刚切过又马上再切，会和上一首收尾叠在一起，表现为闪黑。
        // 唯一例外是“从没切过”（appliedSeg === -1），那时必须立刻切，否则会停在上一首的动画上。
        const firstTime = current.appliedSeg < 0;
        const since = performance.now() - (current.segAt ?? 0);
        if (firstTime || since >= MIN_SWITCH_GAP_MS) {
          applySegment(0, { immediate: true });
        }
      }
      return;
    }

    // 按“当前时间 + 提前量”算出应该处于哪一段。
    // 提前量很关键：新段第一句还没开唱就先切好，旧动画就没机会把新句渲染出来
    // （否则会看到“旧动画先闪一句新歌词，再切过去”）。
    // 每帧只取一次设置（本函数开头已取）：
    const leadSetting = Number(cfg.lead);
    const LEAD = Number.isFinite(leadSetting) ? leadSetting : LEAD_SECONDS;
    // 有过渡时，把“压暗 + 最短保持”也算进提前量：这样新句开唱时画面已经亮回来了。
    const overlayCost = cfg.transition ? (FADE_IN_MS + MIN_HOLD_MS) / 1000 : 0;
    const totalLead = LEAD + overlayCost;
    const targetSeg = (() => {
      let best = -1;
      const segs = current.plan.segments;
      for (let i = 0; i < segs.length; i += 1) {
        const seg = segs[i];
        // C1：用预存的 start/end，不再每帧去 lines 里查
        const start = seg.start;
        if (!Number.isFinite(start)) continue;
        // 目标段如果是慢启动模式（浮名等），按它的额外提前量提前判定，给它更多铺场时间。
        // 慢模式允许提前到“上一段最后一句唱完”之前一点（但不能抢当前句），
        // 否则 2.4 秒的提前量会被上一句的结束时间吃掉，等于没提前。
        let segLead = totalLead + extraLeadFor(seg.mode);
        if (i > 0) {
          const prevEnd = segs[i - 1].end;
          if (Number.isFinite(prevEnd)) {
            const gapBefore = start - prevEnd;          // 上一段结束到本段开始之间的空隙
            if (segLead > gapBefore) {
              // 慢模式：空隙不够就贴着上一句结束的那一刻切（不切进上一句里）
              segLead = Math.max(totalLead, gapBefore);
            }
          }
        }
        if (pb.pos >= start - segLead) best = i;
      }
      // 拖到第一句之前（前奏）也归第 0 段，不然拖动后就没动画可切
      if (best < 0) best = 0;
      return best;
    })();
    // 跳播（拖进度条 / 跳段）：位置与“应该走到的地方”差太多，必须立刻跟上，而且直接切不走过渡。
    if (jumped) {
      // 拖动是连续的，同一段可能被反复判定：已经在这一段了就不要再切一次
      if (targetSeg === current.appliedSeg) return;
      // 注意：不要在这里把 segAt 设成 0。applySegment 内部会写正确的值，
      // 提前清零会让后续 tick 误以为“很久没切过”，拖动手感变成每拖一点就重切一次。

      /* 跳播不走遮罩，如果目标是个慢模式（浮名/町景等）且还没预热过，
       * 直接切过去会明显卡一下。先热一下，给它一点铺场时间再切。
       * 延迟很短（最多 350ms），用户基本察觉不到，但能避免整段卡死。 */
      const seg = current.plan.segments[targetSeg];
      const slow = extraLeadFor(seg.mode) > 0 || Boolean(MODE_COST[seg.mode]?.patch);
      const notWarm = seg.mode && !warmedModes.has(seg.mode) && host.currentMode() !== seg.mode;
      if (slow && notWarm) {
        prewarmOnce(seg.mode);
        const delay = Math.min(350, Math.round(extraLeadFor(seg.mode) * 1000));
        // 用独立的待办标记，不要在定时器里检查 appliedSeg：
        // 上面为了防 tick 重复触发会先把 appliedSeg 设成目标段，那个检查会永远成立。
        const pending = { seg: targetSeg, gen };
        current.pendingJump = pending;
        current.appliedSeg = targetSeg;          // 防止这段延迟里 tick 反复进入跳播分支
        current.segAt = performance.now();       // 别设 0：否则下一步会过度积极地再切一次
        setTimeout(() => {
          if (disposed || !current) return;
          if (current.pendingJump !== pending) return;   // 被新的跳播顶掉了
          if (pending.gen !== generation) return;        // 期间换歌了
          current.pendingJump = null;
          applySegment(targetSeg, { immediate: true, force: true });
        }, delay);
        return;
      }

      // 直接切换前先取消可能还在等的延迟任务：
      // 否则那个定时器到点后会把画面抢回它记的旧目标段。
      current.pendingJump = null;
      // 跳播是外部位置变化：强制重应用，保证画面与段一致
      applySegment(targetSeg, { immediate: true, force: true });
      return;
    }

    // targetSeg 恒 >= 0（上面 best<0 时已回落到 0），只判断是否已经在该段
    if (targetSeg === current.appliedSeg) return;

    // 刚切过没多久：这一次先不动画，但不要改 appliedSeg（改了就等于“认账却没切”，之后永远不切）
    const sinceLast = performance.now() - (current.segAt ?? 0);
    if (sinceLast < MIN_SWITCH_GAP_MS) return;
    applySegment(targetSeg);
  };

  const startTicking = () => {
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, TICK_MS);
  };

  // ---- 换歌
  const onSong = async (song) => {
    generation += 1;
    const gen = generation;
    // 换歌：取消可能还在跑的过渡、把临时降过的画质还原，避免影响下一首
    cancelFade();
    restoreQualityNow();
    lastPrefetchNote = '';   // 清掉上一首的“下一首准备”提示，免得误导
    prefetching = null;      // 上一首的提前准备如果卡住了，换歌时释放占位
    clearTimeout(prefetchTimer);
    prefetchTimer = 0;
    resetWarmed();           // 换歌了：上一首的预热记录作废，新歌重新按需预热
    lastPrewarmScanAt = 0;
    startTicking();
    if (!song) { current = null; emit(); return; }
    const key = songKeyOf(song);
    current = {
      song, key, startedAt: performance.now(), phase: 'idle', message: '',
      plan: null, appliedSeg: -1, userOverrode: false, expectedMode: null, expectedUntil: 0,
      segAt: 0, jumpBase: null, pendingJump: null,
    };
    // 记下这首歌最开始时的强度/背景，供“恢复原来的设置”还原（每首歌重新记，避免用很久以前的值）
    originalIntensity = host.readIntensity();
    originalBackground = host.readBackground();
    // 换歌时立刻探测一次队列，把「下一首是谁 / 为什么没有」暴露到面板上，
    // 不用等到排演完成才知道提前准备能不能跑。
    if (settings().prefetchNext !== false) {
      const probe = nextSongInQueue();
      if (probe) lastPrefetchNote = `下一首是「${probe.title ?? '未知'}」，稍后准备`;
      emit();
    }
    if (!host.available()) { current.phase = 'error'; current.message = '宿主内部接口不可用：确认模组 folia 版本范围与当前 Folia 匹配'; emit(); return; }
    emit();

    /* 切歌瞬间能“直接换”的情况：这首歌已经提前准备过，第一段完整配置记在内存里。
     * 此时不等歌词、不读存储，立刻把模式+参数+强度+背景一次应用，
     * 不会先播上一首最后的动画，也不会出现“只换了模式、参数还是上一首”。
     * 没有提前准备（第一次听这首）就保持旧动画，等排演完再切（这是用户要的行为）。 */
    if (nextReady && nextReady.key === key && nextReady.seg) {
      const seg = nextReady.seg;
      // 先别急着清：应用失败时要把这条预备信息放回去，靠后面的缓存路径兜底
      if (applySegmentSpec(seg)) {
        nextReady = null;
        log.info('切歌瞬间直接应用已准备好的第一段', { mode: seg.mode });
      } else {
        log.warn('切歌瞬间应用第一段失败，留给缓存路径处理', { mode: seg.mode });
      }
    } else if (nextReady && nextReady.key !== key) {
      // 切到了别的歌（比如手动跳歌），这条预备信息就作废了
      nextReady = null;
    }

    /* 没有内存预备（比如刚重启）时，先快速读一次缓存——只要第一段的配置。
     * 读存储是异步但很快（几十毫秒），拿到就立刻应用，不用等歌词。
     * 这样即使没经过提前准备，有缓存也能做到“切歌瞬间换过去”。 */
    if (!current.expectedMode) {
      try {
        const quick = await getPlan(key);
        if (gen !== generation) return;   // A2：被切走了就别再动画面
        const firstSeg = quick?.segments?.[0] ?? null;
        if (firstSeg?.mode && firstSeg.mode !== host.currentMode()) {
          if (applySegmentSpec(firstSeg)) log.info('按缓存的第一段配置，切歌瞬间就换过去', { mode: firstSeg.mode });
        }
      } catch { /* 读不到就等下面的正常流程 */ }
    }

    // 先拿歌词：压缩后的缓存只存行号，需要歌词才能还原 start/end。
    // 缓存命中时就能直接套用，不必再等 AI。
    const lines = await lyricsFor(song, key, gen);
    // current 可能在这期间被置空（模组被停用），generation 检查挡不住空值
    if (gen !== generation || !current) return;

    // 命中缓存直接套用（这里必须再读一次 getPlan(key, lines)：要用歌词补 start/end，
    // 上面那次是不带歌词的快速读取，只够判断第一段模式）
    const cached = lines && lines.length > 0 ? await getPlan(key, lines) : null;
    if (gen !== generation || !current) return;
    if (cached?.segments?.length > 0) {
      current.lines = lines;
      current.plan = cached;
      current.appliedSeg = -1;
      current.phase = 'ready';
      current.message = '已套用记住的分段剧本';
      // 第一段的模式立刻热（切歌后第一个画面靠它），其余再排队
      prewarmFirst(current.plan);
      emit();
      // 已经命中缓存：说明上一首的提前准备生效了。继续为再下一首准备。
      prefetchNextSong().catch(() => {});
      return;
    }

    if (!settings().autoDirect) { current.phase = 'idle'; current.message = '自动排演已关闭，点“为这首歌排演”手动开始'; emit(); return; }

    if (!lines || lines.length === 0) {
      current.phase = 'no-lyrics';
      current.message = '这首歌没有歌词，无法逐段排演';
      emit();
      // 本首没歌词排不了，但下一首仍然值得提前准备
      prefetchNextSong().catch(() => {});
      return;
    }
    current.lines = lines;
    try {
      await planSong(current);
      if (gen !== generation || !current) return;
      await putPlan(key, current.plan);
      if (gen !== generation || !current) return;
      current.phase = 'ready';
      current.message = `已排好 ${current.plan.segments.length} 段，播放时逐段切换`;
      emit();
      // 这首歌排好了，趁它还在播，马上去准备下一首（切过去时 0 延迟）
      prefetchNextSong().catch(() => {});
    } catch (e) {
      if (gen !== generation || !current) return;
      current.phase = ['no-key', 'no-config'].includes(e?.code) ? e.code : 'error';
      current.message = String(e?.message ?? e);
      emit();
    }
  };

  /* 宿主发来 modeChanged 时判断是不是我们自己切的。
   * 只看「是否等于刚设的目标模式」会造成误判：切背景 / 切强度也可能触发 store 变化，
   * 而且同一个模式连续两段使用时，「预期」已经消费过一次。所以这里允许一个小窗口内的
   * 任意一次变化都算我们的，用 ownWrite 标记兜底。 */
  const onModeChanged = (mode) => {
    if (!current) return;
    const withinExpected = performance.now() < (current.expectedUntil ?? 0);
    if (current.expectedMode && mode === current.expectedMode && withinExpected) {
      current.expectedMode = null;
      current.expectedUntil = 0;
      return;
    }
    if (host.isOwnWrite()) return;
    // 预期窗口内、且模式就在当前段的计划里：当成自动切换的余波，不算用户接管
    if (withinExpected && current.plan && current.plan.segments.some((s) => s.mode === mode)) {
      return;
    }
    if (performance.now() - current.startedAt < 800) return;
    current.userOverrode = true;
    current.expectedMode = null;
    current.expectedUntil = 0;
    current.phase = 'user';
    current.message = `你手动换成了 ${profileOf(mode)?.name ?? mode}，本首不再自动切换`;
    emit();
  };

  const rePlan = async () => {
    if (!current) return '现在没有在播放的歌';
    if (current.phase === 'planning') return '正在排演中，请稍候';
    const lines = current.lines ?? (cleanLines(folium.lyrics.getLines()));
    if (!lines || lines.length === 0) return '这首歌没有歌词';
    current.lines = lines;
    current.userOverrode = false;
    current.expectedMode = null;
    current.expectedUntil = 0;
    current.phase = 'planning';
    try {
      await planSong(current);
      await putPlan(current.key, current.plan);
      current.phase = 'ready';
      current.message = `已重新排好 ${current.plan.segments.length} 段，播放时逐段切换`;
      current.appliedSeg = -1;
      prewarmFirst(current.plan);
      emit();
      return `已重新排好 ${current.plan.segments.length} 段`;
    } catch (e) {
      current.phase = ['no-key', 'no-config'].includes(e?.code) ? e.code : 'error';
      current.message = String(e?.message ?? e);
      emit();
      return `排演失败：${String(e?.message ?? e)}`;
    }
  };

  const stopDirecting = async () => {
    if (!current) return '现在没有在播放的歌';
    cancelFade();
    // 停掉自动切换时也要释放提前准备的占位：
    // 否则那一轮如果卡住不出结果，之后所有 prefetchNextSong 都会被挡在门外。
    prefetching = null;
    prepared.clear();
    nextReady = null;
    clearTimeout(prefetchTimer);
    prefetchTimer = 0;
    current.userOverrode = true;
    current.phase = 'user';
    current.message = '已停止本首的自动切换';
    emit();
    return '已停止自动切换';
  };

  const restore = async () => {
    // 恢复前先取消过渡、还原临时画质，避免和恢复动作互相打架
    cancelFade();
    restoreQualityNow();
    const saved = await folium.storage.get('snapshot');
    if (!saved && !originalIntensity && !originalBackground) return '还没有改动过你的设置';
    if (saved) {
      host.restore(saved);
      await folium.storage.set('snapshot', null);
    }
    /* 强度/背景优先用快照里的值：内存变量 originalIntensity 在模组重载后是空的，
     * 只用它会导致“重启后恢复设置，强度和背景回不去”。 */
    const wantIntensity = originalIntensity ?? saved?.intensity ?? null;
    const wantBackground = originalBackground ?? saved?.background ?? null;
    // 恢复动作不受「同时调整动画强度」开关影响：这是把用户的设置还回去，必须做
    if (wantIntensity) host.setIntensity(wantIntensity);
    if (wantBackground) host.setBackground(wantBackground);
    originalIntensity = null;
    originalBackground = null;
    if (current) current.userOverrode = true;
    return '已恢复原来的模式、参数、动画强度与背景';
  };

  /* 用户手动换过动画之后，点「AI 接管」：重新交还给 AI——
   * 立刻切回“当前所在段”在设计里的模式+参数+强度，并恢复后续自动切换。 */
  const takeBack = async () => {
    if (!current) return '现在没有在播放的歌';
    if (!current.plan) return '这首歌还没有分段剧本，先点「排演」';
    // 找出当前播放位置属于哪一段
    const pb = playbackNow();
    let si = 0;
    if (pb) {
      const li = lineIndexAt(current.plan.lines, pb.pos);
      if (li >= 0) {
        const found = segmentForLine(current.plan, li);
        if (found >= 0) si = found;
      }
    }
    current.userOverrode = false;
    current.phase = 'ready';
    current.message = '已交还 AI，继续自动切换';
    emit();
    // 接管是“把控制权交回 AI”：强制重应用，即使模式碰巧相同也刷一次
    applySegment(si, { immediate: true, force: true });
    const seg = current.plan.segments[si];
    return `已交还 AI：${profileOf(seg.mode)?.name ?? seg.mode}`;
  };

  return {
    start: async () => {
      // 启动时先清掉旧格式缓存（存了整首歌词的那种），腾出 1MB 空间
      await purgeLegacyPlans().catch(() => {});
      const { song } = folium.playback.getState();
      const lines = folium.lyrics.getLines();
      if (song && lines.length > 0) lastLyrics = { key: songKeyOf(song), lines };
      await onSong(song);
    },
    onSongChanged: (song) => onSong(song).catch((e) => log.warn('换歌处理出错', { message: String(e?.message ?? e) })),
    onLyricsLoaded: (song, lines) => { lastLyrics = { key: songKeyOf(song), lines: lines ?? [] }; },
    onModeChanged,
    onSetupChanged: () => {
      if (['no-key', 'no-config'].includes(current?.phase)) onSong(current.song).catch(() => {});
    },
    rePlan,
    stopDirecting,
    restore,
    takeBack,
    beforeApply: ensureSnapshot,
    getState: () => current,
    /** 背景类型的中文名（面板用，避免重复定义一份）。 */
    getBgLabels: () => host.BG_LABELS,
    /** 提前准备的状态提示（为什么没准备、准备成功等），面板用来排查。 */
    getPrefetchNote: () => lastPrefetchNote,
    /** 当前正在播/已应用的段索引（tick 里算好的，面板直接高亮，不用自己再扫一遍歌词）。 */
    getActiveSeg: () => (current?.plan ? current.appliedSeg : -1),
    /** 启动自检结果（缺哪些接口 / 哪些第三方动画没画像），面板常驻显示。 */
    getHostAudit: () => hostAudit,
    /* 面板用：所有第三方动画，标出哪些已经有画像（有画像 AI 才知道画面长什么样）。 */
    listThirdParty: () => host.listModes()
      .filter((m) => isThirdParty(m.id))
      .map((m) => {
        const p = profileOf(m.id);
        return { id: m.id, name: p?.name ?? m.label ?? m.id, hasProfile: Boolean(p?.host) };
      }),
    listAllModes: () => host.listModes().map((m) => m.id),
    /* 停用：把所有还在跑的异步任务清干净。
     * 光设 disposed 不够——定时器和 rAF 还在跑，会继续写已经废弃的状态、甚至往已删除的
     * 遮罩节点上写 opacity。模组会被反复启用/停用，清理不净就会累积。 */
    dispose: () => {
      disposed = true;
      generation += 1;
      clearInterval(tickTimer);
      tickTimer = null;
      clearTimeout(prefetchTimer);
      prefetchTimer = 0;
      clearTimeout(qualityRestoreTimer);
      qualityRestoreTimer = 0;
      // 每个被临时降过画质的模式，自己的恢复定时器也要清
      for (const item of qualitySaved.values()) {
        if (item?.timer) clearTimeout(item.timer);
      }
      qualitySaved.clear();
      cancelFade();          // 停掉可能还在跑的过渡 rAF
      prefetching = null;
      prepared.clear();
      nextReady = null;
      warmedModes.clear();
      current = null;
    },
  };
};

// ============================================================ 面板
const mountPanel = (container, _ctx, { director, folium, settings }) => {
  const css = document.createElement('style');
  css.textContent = `
    .seg { font: 13px/1.6 system-ui, sans-serif; padding: 12px; color: inherit; }
    .seg h3 { font-size: 13px; margin: 14px 0 6px; opacity: 0.7; font-weight: 600; }
    .seg .song { font-size: 15px; font-weight: 600; }
    .seg .muted { opacity: 0.6; font-size: 12px; }
    .seg .err { color: #ff8a80; }
    .seg .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .seg button { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 6px; cursor: pointer;
      border: 1px solid currentColor; background: transparent; color: inherit; opacity: 0.85; }
    .seg button:hover { opacity: 1; }
    .seg ol { margin: 4px 0 0 18px; padding: 0; }
    .seg li.active { font-weight: 600; }
  `;
  const root = document.createElement('div');
  root.className = 'seg';
  const title = document.createElement('div');
  title.className = 'song';
  const status = document.createElement('div');
  status.className = 'muted';
  // 显示注册表里发现的第三方动画，便于确认 AI 到底能不能选到它们
  const thirdLine = document.createElement('div');
  thirdLine.className = 'muted';
  thirdLine.style.cssText = 'font-size:11px;opacity:0.55;margin-top:2px;';
  // 提前为下一首准备的状态
  const prefetchLine = document.createElement('div');
  prefetchLine.className = 'muted';
  prefetchLine.style.cssText = 'font-size:11px;opacity:0.55;margin-top:2px;display:none;';
  // 模式 id 解析失败的提示（平时不显示）
  const unresolvedLine = document.createElement('div');
  unresolvedLine.style.cssText = 'font-size:11px;color:#ffb74d;margin-top:2px;display:none;';
  // 启动自检结果：接口缺失/画像缺失时常驻显示（只在有问题时出现）
  const auditLine = document.createElement('div');
  auditLine.style.cssText = 'font-size:11px;color:#ff8a80;margin-top:2px;display:none;white-space:pre-wrap;';
  const list = document.createElement('div');
  const actions = document.createElement('div');
  actions.className = 'row';

  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', async () => { b.disabled = true; try { const msg = await fn(); if (msg) folium.ui.toast(msg); } finally { b.disabled = false; } });
    return b;
  };
  actions.appendChild(btn('为这首歌（重新）排演', () => director.rePlan()));
  actions.appendChild(btn('停止本首自动切换', () => director.stopDirecting()));
  actions.appendChild(btn('恢复原来的设置', () => director.restore()));

  // 只有“你手动接管了”时才出现的按钮
  const takeoverRow = document.createElement('div');
  takeoverRow.className = 'row';
  takeoverRow.style.display = 'none';
  const takeBackBtn = btn('AI 接管', () => director.takeBack());
  takeoverRow.appendChild(takeBackBtn);

  root.appendChild(title);
  root.appendChild(status);
  root.appendChild(thirdLine);
  root.appendChild(prefetchLine);
  root.appendChild(unresolvedLine);
  root.appendChild(auditLine);
  root.appendChild(actions);
  root.appendChild(takeoverRow);
  root.appendChild(list);
  container.appendChild(css);
  container.appendChild(root);

  const PHASES = { idle: '空闲', planning: '排演中', ready: '已排好', user: '你已手动接管', 'no-lyrics': '无歌词', 'no-key': '缺少密钥', 'no-config': '还没设置好', 'switch-failed': '切换未生效', error: '出错' };
  /* 启动自检结果与“当前播哪首歌”无关，单独渲染：
   * 没在播放时也要能看见（新用户启用后往往还没放歌），只在有问题时占地方。 */
  const renderAudit = () => {
    try {
      const audit = director.getHostAudit?.();
      const parts = [];
      if (audit?.missing?.length > 0) {
        parts.push(`⚠ 当前 Folia ${audit.folia} 缺少 ${audit.missing.length} 个接口：${audit.missing.join('、')}`);
        parts.push('（模组可能无法正常切换动画，请检查 Folia 版本或等待适配更新）');
      }
      if (audit?.noProfile?.length > 0) {
        parts.push(`⚠ ${audit.noProfile.length} 个第三方动画还没有画面描述，AI 不了解它们：${audit.noProfile.join('、')}`);
      }
      const text = parts.join('\n');
      auditLine.textContent = text;
      auditLine.style.display = text ? '' : 'none';
    } catch { auditLine.style.display = 'none'; }
  };

  /* 面板每 500ms 渲染一次。原来每次都重建整个 <ol> + 重新扫描歌词找当前段，
   * 这是纯浪费：当前段 tick 里早就用 appliedSeg 记好了，直接用即可。
   * 改成「剧本变了才重建列表，平时只改高亮」——列表稳定时零 DOM 重排。 */
  const INTENSITY_ZH = { calm: '平静', normal: '正常', chaotic: '混乱' };
  let renderedPlanRef = null;   // 上次渲染的剧本对象引用
  let renderedLiEls = [];       // 对应的 <li> 数组
  let renderedOl = null;

  const render = () => {
    const s = director.getState();
    if (!s) {
      // 没在播放：把上一首歌留下的内容全部清掉，否则面板会残留别的歌的信息
      title.textContent = '现在没有在播放的歌';
      status.textContent = '';
      list.textContent = '';
      thirdLine.textContent = '';
      unresolvedLine.style.display = 'none';
      unresolvedLine.textContent = '';
      prefetchLine.style.display = 'none';
      prefetchLine.textContent = '';
      takeoverRow.style.display = 'none';
      renderedPlanRef = null;
      renderedLiEls = [];
      renderedOl = null;
      // 自检结果与歌曲无关，这里不清，交给下面的分支刷新
      renderAudit();
      return;
    }
    title.textContent = `${s.song.title ?? '(未知)'}${s.song.artist ? ` — ${s.song.artist}` : ''}`;
    status.textContent = `[${BUILD_TAG}] ${PHASES[s.phase] ?? s.phase}${s.message ? `：${s.message}` : ''}`;
    // 有模式 id 没解析上时提醒：否则表现为“AI 选错了动画”，其实是回退到第一个模式了
    const unresolved = Array.isArray(s.plan?.unresolvedModes) ? s.plan.unresolvedModes : [];
    if (unresolved.length > 0) {
      unresolvedLine.textContent = `⚠ ${unresolved.length} 个模式 id 没解析上，相关段已回退：${unresolved.join('、')}`;
      unresolvedLine.style.display = '';
    } else {
      unresolvedLine.style.display = 'none';
    }
    // 让用户/我都能一眼确认 AI 的候选里到底有几个第三方动画，以及哪些还没有画像
    try {
      const thirds = director.listThirdParty();
      if (thirds.length === 0) {
        thirdLine.textContent = '第三方动画：注册表里没发现（只会在内置模式里选）';
      } else {
        // 直接列真实 id：画像 key 对不上时，一眼就能看出来（带 ✗ 的就是没有画像的）
        const names = thirds.map((t) => `${t.hasProfile ? '✓' : '✗'}${t.id}`);
        const missing = thirds.filter((t) => !t.hasProfile).length;
        thirdLine.textContent = `第三方动画 ${thirds.length} 个：${names.join('  ')}`
          + (missing > 0 ? `（${missing} 个✗还没有画面描述）` : '');
      }
    } catch { thirdLine.textContent = ''; }
    // 启动自检：只在“有问题”时显示，正常不占地方
    renderAudit();
    // 提前准备的状态（有才显示）
    try {
      const note = director.getPrefetchNote?.() ?? '';
      prefetchLine.textContent = note ? `下一首：${note}` : '';
      prefetchLine.style.display = note ? '' : 'none';
    } catch { prefetchLine.style.display = 'none'; }
    // 手动接管后（或停用了自动切换）才显示「AI 接管」
    takeoverRow.style.display = (s.userOverrode && s.plan) ? '' : 'none';

    // A3：没剧本就提前清空返回，别在后面白算
    if (!s.plan || !Array.isArray(s.plan.segments)) {
      list.textContent = '';
      renderedPlanRef = null;
      renderedLiEls = [];
      renderedOl = null;
      return;
    }

    // 当前段直接用 director 记好的，不再扫描歌词（A1/A4/B2）
    const active = director.getActiveSeg?.() ?? -1;
    const bgLabels = director.getBgLabels();

    // A2：剧本对象没变就只改高亮，不重建 DOM
    if (renderedPlanRef === s.plan && renderedOl) {
      for (let i = 0; i < renderedLiEls.length; i += 1) {
        renderedLiEls[i].className = (i === active) ? 'active' : '';
      }
      return;
    }

    // 剧本变了：重建一次列表
    const ol = document.createElement('ol');
    const lis = [];
    s.plan.segments.forEach((seg, i) => {
      const li = document.createElement('li');
      const label = profileOf(seg.mode)?.name ?? seg.mode;
      const strength = seg.intensity ? `（${INTENSITY_ZH[seg.intensity] ?? seg.intensity}）` : '';
      const bg = seg.bg ? ` · 背景：${bgLabels[seg.bg] ?? seg.bg}` : '';
      li.textContent = `第 ${seg.from + 1}–${seg.to + 1} 句 · ${label}${strength}${bg}${seg.reason ? `：${seg.reason}` : ''}`;
      if (i === active) li.className = 'active';
      ol.appendChild(li);
      lis.push(li);
    });
    list.replaceChildren(ol);
    renderedPlanRef = s.plan;
    renderedLiEls = lis;
    renderedOl = ol;
  };
  const stop = _ctx.every ? _ctx.every(500, render) : null;
  render();
  return () => { if (stop) stop(); };
};

// ============================================================ 入口
export default async function activate(folium) {
  foliumRef = folium;
  if ((folium.host?.folium?.minor ?? 0) < 7) {
    folium.ui.toast('AI 逐段歌词导演 需要 Folium 1.7（Folia 0.7.22）或更新版本', { type: 'error' });
    return undefined;
  }

  /* 宿主升级适配自检：Folia 每次大改都可能动这些内部接口名，
   * 这里一次性检查本模组依赖的所有入口，缺哪个就在日志里说清楚，
   * 免得等到切歌时才炸出一堆看不懂的错误。 */
  const checkHostApi = () => {
    const missing = [];
    try {
      const i = folium.internals;
      if (!i) return missing.push('internals');
      if (!i.stores?.visualizerSettings) missing.push('stores.visualizerSettings');
      if (!i.stores?.themeSettings) missing.push('stores.themeSettings');
      if (!Array.isArray(i.visualizerRegistry)) missing.push('visualizerRegistry');
      const vs = i.stores?.visualizerSettings?.getState?.();
      if (typeof vs?.handleSetVisualizerMode !== 'function') missing.push('handleSetVisualizerMode');
      if (typeof vs?.handleSetVisualizerBackgroundMode !== 'function') missing.push('handleSetVisualizerBackgroundMode');
      /* 不再检查 themeSettings.setTheme：实测 internals 暴露的 5 个 store 都没有 setTheme，
       * 那是宿主内部接口，本来就不该由这里断言。强度走 localStorage，不需要它。 */
      // 播放与歌词
      if (typeof folium.playback?.getState !== 'function') missing.push('playback.getState');
      if (typeof folium.lyrics?.getLines !== 'function') missing.push('lyrics.getLines');
    } catch (e) {
      missing.push(`检查出错：${String(e?.message ?? e)}`);
    }
    return missing;
  };

  /* 自检结果不只在日志里：面板会常驻显示。
   * 否则新用户只在启用那一刻看到一个 toast，之后再也找不到“到底缺什么”。 */
  const hostAudit = { missing: [], thirdParty: [], noProfile: [], folia: folium.host?.folia ?? '?' };
  const hostMissing = checkHostApi();
  hostAudit.missing = hostMissing;
  if (hostMissing.length > 0) {
    folium.log.warn('宿主接口缺失，本模组可能无法正常工作', {
      folia: folium.host?.folia, missing: hostMissing,
    });
    folium.ui.toast(`AI 逐段歌词导演：当前 Folia 缺少 ${hostMissing.length} 个接口，功能可能异常（详见日志）`, { type: 'error' });
  } else {
    folium.log.info('宿主接口自检通过', { folia: folium.host?.folia, build: BUILD_TAG });
    // 把实际注册的第三方动画 id 与画像对照一次写进日志：
    // 对不上说明画像 key 过时了（模组更新后 id 可能变），需要补。
    try {
      const list = folium.internals?.visualizerRegistry ?? [];
      const third = list.map((e) => e.mode ?? e.id ?? '').filter((id) => String(id).startsWith('mod:'));
      const unmatched = third.filter((id) => !profileOf(id)?.host);
      hostAudit.thirdParty = third;
      hostAudit.noProfile = unmatched;
      folium.log.info(
        `MODE-AUDIT 第三方动画 ${third.length} 个，没画像的 ${unmatched.length} 个`,
        { ids: third, unmatched },
      );
    } catch (e) {
      folium.log.warn('MODE-AUDIT 读取注册表失败', { message: String(e?.message ?? e) });
    }
  }

  const PROVIDER_OPTIONS = Object.entries(PROVIDERS).map(([value, p]) => ({ value, label: T(p.label, p.label) }));

  const SETTINGS = [
    { key: 'provider', type: 'select', group: T('接口', 'API'), label: T('服务商', 'Provider'),
      description: T('任何兼容 OpenAI 接口的服务都能用；列表里没有的选“自定义”并填接口地址', 'Any OpenAI-compatible API works'),
      defaultValue: 'deepseek', options: PROVIDER_OPTIONS },
    { key: 'baseUrl', type: 'text', group: T('接口', 'API'), label: T('接口地址', 'API base URL'),
      description: T('选了服务商可以留空；填了就以这里为准。例如 https://api.deepseek.com', 'Leave empty to use the provider preset'),
      defaultValue: '', placeholder: 'https://api.deepseek.com' },
    { key: 'model', type: 'text', group: T('接口', 'API'), label: T('模型', 'Model'),
      description: T('填服务商给的模型名，例如 deepseek-chat', 'The model id from your provider'),
      defaultValue: 'deepseek-chat', placeholder: 'deepseek-chat' },
    { key: 'apiKey', type: 'secret', group: T('接口', 'API'), label: T('API 密钥', 'API key'),
      description: T('由 Folia 加密保存。本机模型可以不填', 'Stored encrypted by Folia') },
    { key: 'temperature', type: 'number', group: T('接口', 'API'), label: T('温度', 'Temperature'),
      description: T('越低越稳定', 'Lower is steadier'), defaultValue: 0.3, min: 0, max: 1, step: 0.05 },
    { key: 'autoDirect', type: 'boolean', group: T('行为', 'Behaviour'), label: T('换歌时自动排演', 'Direct on every song change'),
      description: T('启用后每首歌拿到歌词就自动排演一次', 'Plan each song automatically'), defaultValue: true },
    { key: 'prefetchNext', type: 'boolean', group: T('行为', 'Behaviour'), label: T('提前为下一首排演', 'Plan the next song ahead'),
      description: T('当前歌排演完就立刻为队列里的下一首准备好剧本，切过去时马上生效、不用等 AI。会多一次调用', 'Prepare the next queued song right away, so switching is instant. Costs one extra call per song'),
      defaultValue: true },
    { key: 'applyParams', type: 'boolean', group: T('行为', 'Behaviour'), label: T('同时调整参数', 'Apply parameters too'),
      description: T('关闭则只切换模式，参数保持你手调的', 'Off: switch the mode only'), defaultValue: true },
    { key: 'applyIntensity', type: 'boolean', group: T('行为', 'Behaviour'), label: T('同时调整动画强度', 'Apply animation intensity too'),
      description: T('AI 会给每段指定平静/正常/混乱。注意：强度只能写进设置，要等下一次模式切换才真正生效（宿主没给模组立即重绘的接口）',
        'AI assigns calm/normal/chaotic per segment. Note: it only takes effect at the next mode switch (the host exposes no immediate re-render)'),
      defaultValue: true },
    { key: 'hardLimit', type: 'boolean', group: T('行为', 'Behaviour'), label: T('硬限制每段 2~4 句', 'Hard limit 2-4 lines per segment'),
      description: T('开启后强制每段 2~4 句；关闭后段长完全由 AI 决定', 'On: force 2-4 lines per segment'), defaultValue: true },
    { key: 'transition', type: 'boolean', group: T('行为', 'Behaviour'), label: T('切换时闪黑过渡', 'Flash transition on switch'),
      description: T('切模式时短暂闪黑，盖住画面重建的卡顿，让切换更自然', 'A brief fade-to-black masks the scene rebuild'), defaultValue: true },
    { key: 'lead', type: 'number', group: T('行为', 'Behaviour'), label: T('提前切换（秒）', 'Switch ahead (seconds)'),
      description: T('在新段第一句开唱前多少秒就切过去。调大能减少“旧动画闪出新句”；太大会切早了', 'Switch this long before the segment starts. Larger hides the old scene better; too large switches early'),
      defaultValue: 0.9, min: 0, max: 3, step: 0.1 },
    { key: 'prewarmAhead', type: 'number', group: T('行为', 'Behaviour'), label: T('预热提前量（秒）', 'Prewarm lookahead (seconds)'),
      description: T('下一段的动画提前多少秒开始预热。调大更保险但更早占用资源；调小更省但可能来不及',
        'How early to prewarm the next segment animation. Larger is safer but uses resources sooner'),
      defaultValue: 20, min: 5, max: 60, step: 5 },
    { key: 'userHint', type: 'text', group: T('行为', 'Behaviour'), label: T('偏好提示（可选）', 'Preference hint'),
      description: T('例如“整体安静一点”“副歌要有爆发感”', 'e.g. "calmer overall"'), defaultValue: '' },
  ];

  const section = folium.registries.settingsSections.register({
    id: 'main',
    label: T('AI 逐段歌词导演', 'AI segment lyric director'),
    description: T('把一首歌交给 AI 排成分段剧本，逐段切换歌词动画。', 'AI plans per-segment lyric animation.'),
    settings: SETTINGS,
  });

  const settings = () => {
    const v = section.settings.get();
    return {
      provider: String(v.provider ?? 'deepseek'),
      baseUrl: String(v.baseUrl ?? '').trim(),
      model: String(v.model ?? 'deepseek-chat').trim(),
      temperature: v.temperature ?? 0.3,
      autoDirect: v.autoDirect !== false,
      prefetchNext: v.prefetchNext !== false,
      applyParams: v.applyParams !== false,
      applyIntensity: v.applyIntensity !== false,
      hardLimit: v.hardLimit !== false,
      transition: v.transition !== false,
      lead: Number(v.lead ?? 0.9),
      prewarmAhead: Number(v.prewarmAhead ?? 20),
      userHint: String(v.userHint ?? '').trim().slice(0, 100),
    };
  };

  const host = createHostAdapter(folium);
  const renderers = new Set();
  const director = createDirector({
    folium, host, settings,
    onChange: () => renderers.forEach((r) => r()),
    hostAudit,
  });

  /* 订阅宿主事件。每个 on/subscribe 都返回取消函数，必须存下来并在停用时全部调用：
   * 模组会被反复启用/停用，不取消就会叠加监听——一次换歌被处理 N 次，
   * 表现为重复调 AI、重复切换动画。 */
  const unsubscribers = [];
  const keepUnsub = (fn) => { if (typeof fn === 'function') unsubscribers.push(fn); };
  keepUnsub(folium.events.on('playback.songChanged', ({ song }) => director.onSongChanged(song)));
  keepUnsub(folium.events.on('lyrics.loaded', ({ song, lines }) => director.onLyricsLoaded(song, lines)));
  keepUnsub(folium.events.on('visualizer.modeChanged', ({ mode }) => director.onModeChanged(mode)));
  keepUnsub(folium.secrets.subscribe(() => director.onSetupChanged()));
  keepUnsub(section.settings.onChange(() => director.onSetupChanged()));

  // 闪黑过渡覆盖层挂在 document.body（fixed 全屏），不经过 stageLayers：
  // stageLayers 的容器在 shadow root 内，遮罩会被裁剪/层级不够，等于没有过渡。

  folium.registries.playerPanelTabs.register({
    id: 'segment-director',
    label: T('逐段导演', 'Segments'),
    order: 601,
    mount: (container, ctx) => mountPanel(container, ctx, {
      director, folium, settings,
      onRender: (render) => { renderers.add(render); return () => renderers.delete(render); },
    }),
  });

  const command = (id, zh, en, run, keywords = []) => folium.registries.commands.register({
    id, label: T(zh, en), keywords: ['ai', '逐段', '导演', 'segment', ...keywords], run,
  });
  command('replan', 'AI 逐段导演：为这首歌（重新）排演', 'AI segment director: (re)plan this song', () => director.rePlan(), ['排演', '重新']);
  command('takeback', 'AI 逐段导演：AI 接管（切回设计的动画）', 'AI segment director: hand back to AI', () => director.takeBack(), ['接管', '交还']);
  command('stop', 'AI 逐段导演：停止本首自动切换', 'AI segment director: stop switching this song', () => director.stopDirecting(), ['停止']);
  command('restore', 'AI 逐段导演：恢复原来的设置', 'AI segment director: restore my settings', () => director.restore(), ['恢复', '还原']);

  // 启用时先清一次：把上一次运行可能留下的残留遮罩（半透明黑层）删干净
  purgeOverlays();
  /* 启用瞬间如果正在放歌、且开了自动排演，会立刻向 AI 发一次请求（会花钱）。
   * 先用一句话告知，避免用户以为“只是打开了个面板”。 */
  try {
    const { song } = folium.playback.getState();
    if (song && settings().autoDirect) {
      folium.ui.toast('逐段导演已启用：正在为当前歌曲向 AI 排演分段剧本（会消耗一次调用）', { type: 'info' });
    }
  } catch { /* 拿不到播放状态就不提示 */ }
  director.start().catch((e) => folium.log.warn('启动时处理当前歌曲出错', { message: String(e?.message ?? e) }));
  return () => {
    // 先取消订阅，避免停用过程中事件还在往 director 里送
    for (const un of unsubscribers.splice(0)) {
      try { un(); } catch { /* 单个取消失败不影响其它 */ }
    }
    purgeOverlays();
    director.dispose();
  };
}
