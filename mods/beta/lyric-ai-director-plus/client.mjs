// AI 歌词动画导演 Plus 1.0.3 — built from src/ by dev/build.mjs; edit src/, not this file.
// Source modules are kept in separate scopes below, in dependency order.

// ---- src/params.mjs
const __params = (() => {
// Parameter whitelist, ranges and switch dependencies for the builtin modes.
// MODE_PARAMS and PARAM_GATES are taken from duoduo1232/lyric-ai-director
// (MIT, https://github.com/duoduo1232/lyric-ai-director): ranges mirror what the
// host setters clamp to, gates were read off the renderer source by that author.
// Added here: `hanabi` (found in Folia 0.7.22 by M0; no tunables known yet, so
// it can be chosen but not tuned), the 0.7.23 tempera depth values, the beat
// effects of 智能动感 (BEAT_EFFECTS), and the helpers the director needs.

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
    // 心象没有设置面板，宿主 setter 只做 {...prev, ...patch} 合并（无 clamp），
    // 这里的范围是模组自定的合理区间；每次写入宿主都会把 beamIntensity 归零。
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
      // Folia 0.7.23: the depth of 墨染奥行, live only while that beat effect plays.
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
};

const PARAM_GATES = {
  classic: {
    // wordSpacing is only consumed by the modern layout.
    wordSpacing: { key: 'useLegacyLayout', mustBe: false },
  },
  cappella: {
    // The emoji pool is only reached from the emo-message branch.
    emojiPackSource: { key: 'showEmoMessages', mustBe: true },
  },
  monet: {
    audioStyle: { key: 'showAudioVisualization', mustBe: true },
  },
  pendolo: {
    // The whole clockwork canvas (line glow included) is skipped at 'none'.
    enableLineGlow: { key: 'showGearDecor', not: 'none', setTo: 'subtle' },
  },
  sonnet: {
    postProcessGrain: { key: 'postProcessEnabled', mustBe: true },
    postProcessContrast: { key: 'postProcessEnabled', mustBe: true },
    postProcessRgbShift: { key: 'postProcessEnabled', mustBe: true },
    postProcessHalftone: { key: 'postProcessEnabled', mustBe: true },
    postProcessVignette: { key: 'postProcessEnabled', mustBe: true },
    postProcessLensDistortion: { key: 'postProcessEnabled', mustBe: true },
    postProcessLensDispersion: { key: 'postProcessEnabled', mustBe: true },
    // MG density needs the background layer, which 'only text' hides entirely.
    mgDensity: [
      { key: 'showBackgroundMg', mustBe: true },
      { key: 'showOnlyText', mustBe: false },
    ],
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
    // `textOnly` stops the whole graphics group from rendering.
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

/* Values that only show while a beat effect plays (not a tuning switch, so not
 * in PARAM_GATES: nothing here can turn it on, and writing them is harmless). */
const EFFECT_GATES = {
  tempera: { depthOfField: 'tempera.inkFlash', depthPan: 'tempera.inkFlash', glyphDepth: 'tempera.inkFlash' },
};

/*
 * 智能动感 (Folia 0.7.23 `smartBeat`): per-mode effects driven by the beats
 * beat_this finds or the drums HTDemucs separates. Each is { on, strength 0~2 };
 * one never set counts as on at strength 1, and none plays while the global
 * switch is off. Ids come from the live registry (retired ones are skipped);
 * this table only adds what the model needs to judge them.
 */
const BEAT_EFFECTS = {
  'tempera.inkFlash': { zh: '墨染奥行', source: 'drums',
    effect: '底鼓、军鼓打下时一团强调色墨渍晕开；同时给画面加景深、镜头平移和歌词远近（depthOfField/depthPan/glyphDepth 只在它开着时生效）' },
  'sonnet.lensTear': { zh: '推镜裂光', source: 'beats', effect: '每拍镜头推近，小节第一拍画面撕裂并泛起辉光，很冲' },
  'diorama.ripple': { zh: '水镜涟漪', source: 'beats', effect: '粒子每拍泛起涟漪，小节第一拍大涟漪，正在唱的字随拍跳动' },
  'pendolo.drumhead': { zh: '仿真鼓面', source: 'drums', effect: '底鼓让表盘鼓起、重拍震屏，军鼓让表盘倾斜，镲片点亮刻度' },
  'hanabi.beatBursts': { zh: '随拍烟花', source: 'beats', effect: '每拍天空开一朵小烟花，小节第一拍升空大烟花，拍越重开得越大' },
  'hanabi.beatPulse': { zh: '随拍推镜', source: 'beats', effect: '整个画面每拍推近一下、轻轻一摆，小节第一拍推得更深' },
};

const EFFECT_DEFAULT = { on: true, strength: 1 };

/** `{ id: { on, strength } }` for the effects `allowed` lists; strength in 0~2, steps of 0.05. */
const sanitizeEffects = (raw, allowed) => {
  if (!raw || typeof raw !== 'object') return {};
  const clean = {};
  for (const id of allowed) {
    const value = raw[id];
    if (value === undefined || value === null) continue;
    const entry = typeof value === 'object' ? value : { on: value };
    const on = entry.on === true || entry.on === 'true' ? true : entry.on === false || entry.on === 'false' ? false : undefined;
    if (on === undefined) continue;
    const strength = Number(entry.strength);
    clean[id] = Number.isFinite(strength)
      ? { on, strength: Math.round(Math.min(2, Math.max(0, strength)) * 20) / 20 }
      : { on };
  }
  return clean;
};

/** One line per effect for the prompt. */
const effectSpecLines = (ids) => ids
  .filter((id) => BEAT_EFFECTS[id])
  .map((id) => `- ${id}（${BEAT_EFFECTS[id].zh}，跟${BEAT_EFFECTS[id].source === 'drums' ? '鼓声' : '节拍'}）：${BEAT_EFFECTS[id].effect}`);

/** `handleSetSonnetTuning` -> `sonnetTuning`, the store field the setter writes. */
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

/* No tuning read means the gate cannot be proven closed, so nothing is claimed. */
const gateSatisfied = (tuning, gate) => {
  if (!tuning) return true;
  const value = tuning[gate.key];
  if (gate.not !== undefined) return value !== gate.not;
  return value === gate.mustBe;
};

/* Asking for less (a switch off, an amount of zero) works with the gate closed. */
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

/** Whitelisted and clamped: unknown keys are dropped, numbers are pulled into range. */
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

/** One line per mode for the prompt: `key(range)中文名[需 gate]`. */
const paramSpecLine = (mode, keys = null) => {
  const spec = MODE_PARAMS[mode];
  if (!spec) return '';
  return Object.entries(spec.params)
    .filter(([key]) => !keys || keys.includes(key))
    .map(([key, param]) => {
      let text;
      if (param.kind === 'boolean') text = `${key}(true|false)`;
      else if (param.kind === 'select') text = `${key}(${param.options.join('|')})`;
      else text = `${key}(${param.min}~${param.max})`;
      const gates = gatesFor(mode, key);
      if (gates.length > 0) {
        text += `[需 ${gates.map((gate) => (gate.not !== undefined ? `${gate.key}≠${gate.not}` : `${gate.key}=${gate.mustBe}`)).join(' 且 ')}]`;
      }
      const effect = EFFECT_GATES[mode]?.[key];
      if (effect) text += `[需效果 ${effect} 开]`;
      return `${text}${param.zh}`;
    })
    .join('，');
};
return { MODE_PARAMS, PARAM_GATES, EFFECT_GATES, BEAT_EFFECTS, EFFECT_DEFAULT, sanitizeEffects, effectSpecLines, tuningKeyOf, gatesFor, gateSatisfied, isInertValue, sanitizeParams, paramSpecLine };
})();

// ---- src/host-adapter.mjs
const __host_adapter = (() => {
// The only file that touches `folium.internals`: the live mode list, and reading
// and writing the lyric animation mode, its tuning and its 智能动感 beat effects. Folium 2 removes
// internals with no replacement (M0 checked the public API: there is none), so
// when that happens this file is what changes. Every access is feature-checked
// and degrades to "unavailable" instead of throwing into the player.

const { MODE_PARAMS, BEAT_EFFECTS, EFFECT_DEFAULT, tuningKeyOf, gatesFor, gateSatisfied, isInertValue, sanitizeParams, sanitizeEffects } = __params;

/* Reading `folium.internals` throws (rather than returning undefined) when the
 * host withholds it, and optional chaining does not catch a throwing getter. */
const internalsOf = (folium) => {
  try {
    return folium.internals ?? null;
  } catch {
    return null;
  }
};

const createHostAdapter = (folium) => {
  const store = () => {
    const visualizerSettings = internalsOf(folium)?.stores?.visualizerSettings;
    return visualizerSettings && typeof visualizerSettings.getState === 'function' ? visualizerSettings : null;
  };

  /* Writes of our own, so a `visualizer.modeChanged` that follows can be told
   * apart from the user picking a mode (M0: the event carries no origin). */
  let ownWriteUntil = 0;
  const markOwnWrite = () => { ownWriteUntil = performance.now() + 800; };

  const available = () => Boolean(store());

  const registryEntries = () => {
    const registry = internalsOf(folium)?.visualizerRegistry ?? null;
    const entries = Array.isArray(registry) ? registry : (registry?.entries ?? []);
    return entries.filter((entry) => entry && typeof entry.mode === 'string');
  };

  /** The live registry: builtin modes plus any a mod contributed. */
  const listModes = () => registryEntries()
    .map((entry) => ({ id: entry.mode, label: entry.labelFallback || entry.mode }));

  // ------------------------------------------------------------ 智能动感

  const smartBeat = () => {
    const value = store()?.getState?.()?.smartBeat;
    return value && typeof value === 'object' ? value : null;
  };

  /** 'off' | 'cached' | 'on', or null when this Folia has no 智能动感. */
  const beatMode = () => {
    const state = store()?.getState?.();
    if (typeof state?.handleSetSmartBeat !== 'function') return null;
    const mode = state.smartBeat?.mode;
    return typeof mode === 'string' ? mode : null;
  };

  /** Ids of the beat effects `mode` offers and we can describe (retired ones left out). */
  const listBeatEffects = (mode) => {
    const entry = registryEntries().find((item) => item.mode === mode);
    return (Array.isArray(entry?.beatEffects) ? entry.beatEffects : [])
      .filter((effect) => effect && !effect.retired && typeof effect.id === 'string' && BEAT_EFFECTS[effect.id])
      .map((effect) => effect.id);
  };

  const effectState = (id) => {
    const value = smartBeat()?.effects?.[id];
    return {
      on: typeof value?.on === 'boolean' ? value.on : EFFECT_DEFAULT.on,
      strength: Number.isFinite(value?.strength) ? value.strength : EFFECT_DEFAULT.strength,
    };
  };

  /* An effect toggled mid-song rebuilds the scene (凝彩 clears its shots), so
   * this goes out with the mode switch, at the same safe moment. */
  const setEffects = (mode, rawEffects) => {
    const state = store()?.getState?.();
    if (typeof state?.handleSetSmartBeat !== 'function') return {};
    const wanted = sanitizeEffects(rawEffects, listBeatEffects(mode));
    const patch = {};
    for (const [id, value] of Object.entries(wanted)) {
      const now = effectState(id);
      const next = { on: value.on, strength: value.strength ?? now.strength };
      if (next.on !== now.on || next.strength !== now.strength) patch[id] = next;
    }
    if (Object.keys(patch).length === 0) return {};
    markOwnWrite();
    state.handleSetSmartBeat({ effects: patch });
    const written = {};
    for (const id of Object.keys(patch)) written[id] = effectState(id);
    return written;
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
    // notify:false keeps the host from showing its own "switched to" toast.
    state.handleSetVisualizerMode(mode, { notify: false });
    return true;
  };

  /**
   * Writes a sanitized patch for `mode`, opening the switch a value depends on
   * (M0: a value behind a closed switch changes nothing on screen). A switch the
   * patch itself sets to the blocking value wins, and the gated value is left
   * out. Returns what was written and what the host kept.
   */
  const setParams = (mode, rawParams) => {
    const spec = MODE_PARAMS[mode];
    const state = store()?.getState?.();
    const setter = spec?.setter ? state?.[spec.setter] : null;
    if (typeof setter !== 'function') return { written: {}, notes: [] };
    const patch = sanitizeParams(mode, rawParams);
    const current = readTuning(mode);
    const notes = [];
    for (const [key, value] of Object.entries({ ...patch })) {
      if (isInertValue(spec.params[key], value)) continue;
      for (const gate of gatesFor(mode, key)) {
        const merged = { ...(current ?? {}), ...patch };
        if (gateSatisfied(merged, gate)) continue;
        if (Object.prototype.hasOwnProperty.call(patch, gate.key)) {
          delete patch[key];
          notes.push(`${key} 被 ${gate.key} 挡住，未写入`);
          break;
        }
        patch[gate.key] = gate.setTo ?? gate.mustBe;
        notes.push(`${key} 需要 ${gate.key}，已一并打开`);
      }
    }
    if (Object.keys(patch).length === 0) return { written: {}, notes };
    markOwnWrite();
    setter(patch);
    const stored = readTuning(mode) ?? {};
    const written = {};
    for (const key of Object.keys(patch)) written[key] = key in stored ? stored[key] : patch[key];
    return { written, notes };
  };

  /** Mode and every tuning we may touch, for "restore what I had". */
  const snapshot = () => {
    const state = store()?.getState?.();
    if (!state) return null;
    const tunings = {};
    for (const mode of Object.keys(MODE_PARAMS)) {
      const tuning = readTuning(mode);
      if (!tuning) continue;
      const keep = {};
      for (const key of Object.keys(MODE_PARAMS[mode].params)) if (key in tuning) keep[key] = tuning[key];
      tunings[mode] = keep;
    }
    const effects = {};
    for (const id of Object.keys(BEAT_EFFECTS)) {
      const stored = state.smartBeat?.effects?.[id];
      if (stored) effects[id] = { on: stored.on, strength: stored.strength };
    }
    return { mode: state.visualizerMode, tunings, effects };
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
    if (typeof state.handleSetSmartBeat === 'function' && saved.effects) {
      // Effects the user never set go back to Folia's default.
      const touched = Object.fromEntries(Object.keys(BEAT_EFFECTS)
        .filter((id) => state.smartBeat?.effects?.[id] || saved.effects[id])
        .map((id) => [id, saved.effects[id] ?? EFFECT_DEFAULT]));
      if (Object.keys(touched).length > 0) {
        markOwnWrite();
        state.handleSetSmartBeat({ effects: touched });
      }
    }
    if (saved.mode) setMode(saved.mode);
    return true;
  };

  /** True when `mode` is on and every value in `params` and `effects` (if given) is already set. */
  const shows = (mode, params, effects) => {
    if (currentMode() !== mode) return false;
    const fx = sanitizeEffects(effects ?? {}, listBeatEffects(mode));
    const fxShown = Object.entries(fx).every(([id, value]) => {
      const now = effectState(id);
      return now.on === value.on && (value.strength === undefined || now.strength === value.strength);
    });
    if (!fxShown) return false;
    const clean = sanitizeParams(mode, params ?? {});
    if (Object.keys(clean).length === 0) return true;
    const tuning = readTuning(mode);
    return Boolean(tuning) && Object.entries(clean).every(([key, value]) => tuning[key] === value);
  };

  return {
    available,
    shows,
    listModes,
    currentMode,
    readTuning,
    setMode,
    setParams,
    beatMode,
    listBeatEffects,
    effectState,
    setEffects,
    snapshot,
    restore,
    isOwnWrite: () => performance.now() < ownWriteUntil,
  };
};
return { createHostAdapter };
})();

// ---- src/store.mjs
const __store = (() => {
// Per-song memory in the mod's data file (1 MB cap). Brief and decision are
// kept apart so a decision can be redone without paying for the brief again.

const SONG_PREFIX = 'song:';
const INDEX_KEY = 'index';
const MAX_SONGS = 600;
const REASON_MAX = 60;

/* The brief as stored: only what the prompts and the panel read back. */
const compactBrief = (brief) => ({
  summary: String(brief?.summary ?? '').slice(0, 80),
  mood: (brief?.mood ?? []).slice(0, 4),
  tags: (brief?.tags ?? []).slice(0, 6),
  arc: String(brief?.arc ?? '').slice(0, 60),
  contrast: String(brief?.contrast ?? '').slice(0, 60),
  imagery: (brief?.imagery ?? []).slice(0, 4),
  energy: brief?.energy ?? null,
  visual: brief?.visual ?? null,
  known: Boolean(brief?.known),
  confidence: Number(brief?.confidence) || 0,
});

const createStore = (storage, log) => {
  let index = null; // song keys, most recent first

  const loadIndex = async () => {
    if (index) return index;
    const stored = await storage.get(INDEX_KEY);
    index = Array.isArray(stored) ? stored : [];
    return index;
  };

  /* A write past the 1 MB cap fails; drop the oldest third once and retry. */
  const safeSet = async (key, value) => {
    try {
      await storage.set(key, value);
    } catch (error) {
      log.warn('写入数据文件失败，清理最旧的三分之一记忆后重试', { message: String(error?.message ?? error) });
      const keys = await loadIndex();
      const drop = keys.splice(Math.floor((keys.length * 2) / 3));
      await Promise.all(drop.map((songKey) => storage.delete(`${SONG_PREFIX}${songKey}`)));
      await storage.set(INDEX_KEY, keys);
      await storage.set(key, value);
    }
  };

  const touch = async (songKey) => {
    const keys = await loadIndex();
    const at = keys.indexOf(songKey);
    if (at !== -1) keys.splice(at, 1);
    keys.unshift(songKey);
    const evicted = keys.splice(MAX_SONGS);
    await Promise.all(evicted.map((key) => storage.delete(`${SONG_PREFIX}${key}`)));
    await safeSet(INDEX_KEY, keys);
  };

  const getSong = async (songKey) => (songKey ? (await storage.get(`${SONG_PREFIX}${songKey}`)) ?? null : null);

  const putSong = async (songKey, patch) => {
    const entry = { ...((await getSong(songKey)) ?? {}), ...patch };
    await safeSet(`${SONG_PREFIX}${songKey}`, entry);
    await touch(songKey);
    return entry;
  };

  return {
    getSong,
    saveBrief: (songKey, brief) => putSong(songKey, { b: compactBrief(brief), bAt: Date.now() }),
    saveDecision: (songKey, decision) => putSong(songKey, {
      d: {
        mode: decision.mode,
        params: decision.params ?? {},
        ...(decision.fx && Object.keys(decision.fx).length > 0 ? { fx: decision.fx } : {}),
        reason: String(decision.reason ?? '').slice(0, REASON_MAX),
        confidence: Number(decision.confidence) || 0,
        top: decision.top ?? [],
        at: Date.now(),
      },
    }),
    /* The user picked another mode while this song played: remembered as the
     * song's choice from now on, and as feedback for M5. */
    saveUserChoice: (songKey, mode, { params, fx } = {}) => putSong(songKey, {
      u: {
        mode,
        ...(params && Object.keys(params).length > 0 ? { params } : {}),
        ...(fx && Object.keys(fx).length > 0 ? { fx } : {}),
        at: Date.now(),
      },
    }),
    forgetDecision: async (songKey) => {
      const entry = await getSong(songKey);
      if (!entry) return;
      delete entry.d;
      delete entry.u;
      await safeSet(`${SONG_PREFIX}${songKey}`, entry);
    },
    count: async () => (await loadIndex()).length,
    /** Song keys, most recent first. */
    keys: async () => [...(await loadIndex())],
    get: (key) => storage.get(key),
    set: (key, value) => safeSet(key, value),
    compactBrief,
  };
};
return { createStore };
})();

// ---- src/song-context.mjs
const __song_context = (() => {
// Turns a song and its lyric lines into what the brief prompt needs: cleaned
// lines (credits removed), chorus marks (the source's own, plus repeated lines:
// M0 found sources tag only part of the chorus), a compact text form, and a few
// objective structure numbers that stand in for audio until M3.

const CREDIT_PATTERN = /^\s*(作词|作曲|编曲|词|曲|制作人|监制|出品|发行|混音|母带|录音|和声|和音|配唱|吉他|贝斯|鼓|键盘|弦乐|钢琴|企划|统筹|OP|SP|ISRC|Lyrics?|Lyricist|Composer|Compose[rd]?|Arrange[rd]?|Arrangement|Producer|Produced|Mix(?:ed|ing)?|Master(?:ed|ing)?)\s*(by)?\s*[:：]/i;
const NOTICE_PATTERN = /(未经|著作权|版权所有|享有本翻译作品|TME|QQ音乐|网易云音乐|酷狗)/;

const MAX_LINES_FULL = 120;
const MAX_CHARS_PER_LINE = 80;

/** Per-song key: `source:id`, or `title|artist` when there is no id (Folium's advice). */
const songKeyOf = (song) => {
  if (!song) return null;
  if (song.id) return `${song.source ?? 'unknown'}:${song.id}`;
  return `t:${song.title}|${song.artist}`;
};

const normalizeText = (text) => String(text ?? '').replace(/[\s\p{P}\p{S}]+/gu, '').toLowerCase();
const clip = (text) => {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > MAX_CHARS_PER_LINE ? `${flat.slice(0, MAX_CHARS_PER_LINE)}…` : flat;
};
const clock = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const cleanLines = (lines) => (Array.isArray(lines) ? lines : [])
  .filter((line) => {
    const text = String(line?.fullText ?? '').trim();
    return text && !CREDIT_PATTERN.test(text) && !NOTICE_PATTERN.test(text);
  });

/**
 * Lines with a chorus mark: the source's `isChorus`, or a line whose text recurs
 * and sits in a run of at least two recurring lines (a lone repeated "oh" is not
 * a chorus).
 */
const markChorus = (lines) => {
  const counts = new Map();
  for (const line of lines) {
    const key = normalizeText(line.fullText);
    if (key.length >= 2) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = lines.map((line) => (counts.get(normalizeText(line.fullText)) ?? 0) >= 2);
  return lines.map((line, index) => {
    const inRun = repeated[index] && (repeated[index - 1] || repeated[index + 1]);
    return { line, chorus: Boolean(line.isChorus) || inRun, tagged: Boolean(line.isChorus) };
  });
};

/** Objective structure numbers: how wordy, how repetitive, how long. */
const structureOf = (marked, durationSeconds) => {
  const voiced = marked.filter(({ line }) => Number.isFinite(line.endTime) && line.endTime > line.startTime);
  const chars = voiced.reduce((sum, { line }) => sum + normalizeText(line.fullText).length, 0);
  const singing = voiced.reduce((sum, { line }) => sum + (line.endTime - line.startTime), 0);
  const unique = new Set(marked.map(({ line }) => normalizeText(line.fullText))).size;
  return {
    lines: marked.length,
    duration: Math.round(durationSeconds || 0),
    charsPerSecond: singing > 0 ? Math.round((chars / singing) * 10) / 10 : null,
    repetition: marked.length > 0 ? Math.round((1 - unique / marked.length) * 100) / 100 : 0,
    chorusLines: marked.filter((item) => item.chorus).length,
    taggedChorusLines: marked.filter((item) => item.tagged).length,
    translated: marked.some(({ line }) => Boolean(line.translation)),
  };
};

/**
 * `m:ss C 文本 / 翻译`, one line each. Over MAX_LINES_FULL lines, a chorus line
 * already shown twice is folded into a count instead of being repeated.
 */
const lyricsText = (marked) => {
  const seen = new Map();
  const rows = [];
  let folded = 0;
  const long = marked.length > MAX_LINES_FULL;
  for (const { line, chorus } of marked) {
    const key = normalizeText(line.fullText);
    const times = (seen.get(key) ?? 0) + 1;
    seen.set(key, times);
    if (long && chorus && times > 2) {
      folded += 1;
      continue;
    }
    let row = `${clock(line.startTime)} ${chorus ? 'C' : 'V'} ${clip(line.fullText)}`;
    if (line.translation) row += ` / ${clip(line.translation)}`;
    rows.push(row);
  }
  if (folded > 0) rows.push(`（另有 ${folded} 行重复副歌已省略）`);
  return rows.join('\n');
};

/** Everything the brief needs, from a song and its raw lines. */
const buildSongContext = ({ song, lines, durationSeconds, theme }) => {
  const marked = markChorus(cleanLines(lines));
  return {
    key: songKeyOf(song),
    title: song?.title ?? '',
    artist: song?.artist ?? '',
    album: song?.album ?? '',
    structure: structureOf(marked, durationSeconds),
    lyrics: marked.length > 0 ? lyricsText(marked) : '',
    theme: theme?.description ? { name: theme.name ?? '', description: String(theme.description).slice(0, 200) } : null,
    instrumental: marked.length === 0,
  };
};
return { songKeyOf, cleanLines, markChorus, structureOf, lyricsText, buildSongContext };
})();

// ---- src/profiles.mjs
const __profiles = (() => {
// Mode profiles: what each builtin mode looks like, on the same five axes the
// song brief scores, plus the tags it suits or clashes with and what its most
// useful knobs do. `host` is Folia's own one-line description from its mode
// picker (read in Folia 0.7.22); axes, tags and knob notes are first-draft
// judgements to be tuned against the M2 evaluation set.
//
// Axes, each 0..1:
//   motion   how much moves (camera, glyphs, transitions)
//   density  how much text and decoration is on screen at once
//   warmth   cold/technical (0) to warm/organic (1)
//   space    flat poster (0) to deep 3D space (1)
//   story    how strongly it reads as a narrative sequence of lines

const PROFILE_VERSION = 3;

/** The tag vocabulary the brief picks from; the ranker matches on these. */
const TAGS = [
  // genre
  '流行', '抒情', '民谣', '摇滚', '说唱', '电子', 'R&B', '爵士', '古风', '动漫', '管弦', '纯音乐',
  // mood
  '温柔', '伤感', '怀旧', '浪漫', '治愈', '激昂', '愤怒', '俏皮', '梦幻', '孤独', '释然', '壮阔', '暗黑',
  // theme
  '叙事', '对唱', '独白', '城市', '夜晚', '夏天', '青春', '时间', '自然', '科幻', '离别', '庆祝',
];

const PROFILES = {
  classic: {
    name: '流光',
    host: '单行大字居中，逐字旋转点亮，整行随呼吸轻浮',
    axes: { motion: 0.4, density: 0.2, warmth: 0.55, space: 0.25, story: 0.4 },
    energy: [0.25, 0.75],
    fit: ['流行', '抒情', '温柔', '治愈', '青春'],
    avoid: ['说唱', '壮阔'],
    knobs: {
      breathingFloatMultiplier: '整行上下浮动的幅度；安静的歌调低，轻快的歌调高',
      enableWordRotation: '逐字点亮时的旋转；关掉更克制',
    },
  },
  cadenza: {
    name: '心象',
    host: '整句拆成单字散落画面，像脑海里浮起的碎片',
    axes: { motion: 0.6, density: 0.55, warmth: 0.5, space: 0.6, story: 0.3 },
    energy: [0.35, 0.9],
    fit: ['梦幻', '孤独', '电子', '独白', '伤感'],
    avoid: ['叙事', '对唱'],
    knobs: {
      motionAmount: '碎字漂移的幅度',
      glowIntensity: '光晕和光束的强度；情绪外放时调高',
      fontScale: '字号；字少的歌可以放大',
    },
  },
  partita: {
    name: '云阶',
    host: '歌词沿引导线逐块错落下行，像一级级云中阶梯',
    axes: { motion: 0.4, density: 0.5, warmth: 0.5, space: 0.45, story: 0.75 },
    energy: [0.2, 0.65],
    fit: ['民谣', '叙事', '温柔', '怀旧', '释然'],
    avoid: ['说唱', '愤怒', '电子'],
    knobs: {
      staggerMax: '逐块入场的最大错开；越大越舒缓（需不小于 staggerMin）',
      useSemanticLayout: '按语义断句排版；歌词句子长时打开',
      showGuideLines: '显示引导线；想更干净就关掉',
    },
  },
  fume: {
    name: '浮名',
    host: '满屏歌词层层堆叠，镜头追着当前句推移，虚实之间浮沉',
    axes: { motion: 0.5, density: 0.85, warmth: 0.6, space: 0.6, story: 0.65 },
    energy: [0.3, 0.8],
    fit: ['说唱', '怀旧', '伤感', '城市', '夜晚', '独白'],
    avoid: ['纯音乐', '俏皮'],
    knobs: {
      cameraSpeed: '镜头追当前句的速度',
      glowIntensity: '当前句的辉光',
      textHoldRatio: '唱完后文字停留的比例；字多的歌调低以免糊成一片',
      backgroundObjectOpacity: '背景堆叠文字的不透明度；调低更聚焦当前句',
    },
  },
  tilt: {
    name: '倾诉',
    host: '长句自动断行，随机斜体强调，像有人凑近低声说话',
    axes: { motion: 0.45, density: 0.4, warmth: 0.65, space: 0.3, story: 0.7 },
    energy: [0.2, 0.8],
    fit: ['独白', 'R&B', '说唱', '孤独', '伤感', '夜晚'],
    avoid: ['壮阔', '管弦', '庆祝'],
    knobs: {
      tiltStyleProbability: '每行用倾斜强调样式的概率；情绪越躁动越高',
      splitProbability: '整行裂开的概率；激烈处调高，安静的歌调低',
      colorScheme: '配色方案',
    },
  },
  claddagh: {
    name: '回环',
    host: '歌词沿倾斜圆环轨道循环推进，大小对比拉开纵深',
    axes: { motion: 0.55, density: 0.45, warmth: 0.6, space: 0.75, story: 0.3 },
    energy: [0.3, 0.75],
    fit: ['浪漫', '梦幻', '电子', '时间'],
    avoid: ['说唱', '愤怒'],
    knobs: {
      radiusScale: '圆环大小',
      ellipseTiltDeg: '圆环倾斜角；越大纵深感越强',
      focusScaleRatio: '当前句相对其他句的放大比例',
    },
  },
  monet: {
    name: '莫奈',
    host: '海报式版面：左侧歌词轨、右侧肖像、底部频谱',
    axes: { motion: 0.2, density: 0.5, warmth: 0.6, space: 0.15, story: 0.5 },
    energy: [0.15, 0.6],
    fit: ['爵士', '民谣', '怀旧', '温柔', '抒情'],
    avoid: ['电子', '激昂', '科幻'],
    keywords: ['爵士', '酒', '咖啡', '老唱片', '旧照片', '画', '月亮'],
    knobs: {
      fontScale: '歌词字号',
      showAudioVisualization: '底部频谱；纯人声或很安静的歌可以关掉',
      keywordColoringEnabled: '关键词着色',
    },
  },
  pendolo: {
    name: '时计',
    host: '封面嵌进钟表盘，歌词沿弧线随摆锤一格格推过',
    axes: { motion: 0.35, density: 0.35, warmth: 0.45, space: 0.4, story: 0.55 },
    energy: [0.25, 0.65],
    fit: ['时间', '怀旧', '离别', '释然'],
    avoid: ['俏皮', '愤怒'],
    keywords: ['时钟', '钟表', '十年', '时光', '倒数', '等待', '岁月'],
    knobs: {
      tickSnappiness: '摆锤走一格的干脆程度；节奏感强的歌调高',
      showGearDecor: '齿轮装饰的多少',
      enableLineGlow: '当前句发光（齿轮装饰为 none 时无效）',
    },
  },
  cappella: {
    name: '群唱',
    host: '歌词化成聊天气泡左右往返，配头像与表情，像一场对唱',
    axes: { motion: 0.4, density: 0.55, warmth: 0.8, space: 0.15, story: 0.65 },
    energy: [0.3, 0.8],
    fit: ['对唱', '俏皮', '浪漫'],
    avoid: ['壮阔', '暗黑', '伤感', '管弦', '纯音乐'],
    keywords: ['对话', '聊天', '你问我答', '两人', '求婚'],
    knobs: {
      showEmoMessages: '插入表情包消息；轻松的歌打开，认真的歌关掉',
      avatarSource: '头像来源；cover 用专辑封面',
    },
  },
  diorama: {
    name: '镜台',
    host: '点阵化的文字在 3D 空间里穿行，镜头跟着歌词运镜',
    axes: { motion: 0.75, density: 0.5, warmth: 0.3, space: 0.95, story: 0.4 },
    energy: [0.4, 0.95],
    fit: ['电子', '科幻', '梦幻', '壮阔'],
    avoid: ['民谣', '爵士', '古风'],
    keywords: ['宇宙', '星空', '星河', '光年', '太空', '行星', '未来', '数字', '赛博', '机械'],
    knobs: {
      cameraSpeed: '镜头飞行速度',
      motionAmount: '整体运动量',
      audioReactivity: '画面随音乐跳动的程度；鼓点强的歌调高',
      showParticles: '粒子；想更干净就关掉',
    },
  },
  sonnet: {
    name: '商籁',
    host: '短线、边框与镂空巨字轮番铺开，歌词像被排进一页页翻动的诗稿',
    axes: { motion: 0.8, density: 0.7, warmth: 0.5, space: 0.6, story: 0.75 },
    energy: [0.45, 1],
    fit: ['摇滚', '动漫', '激昂'],
    avoid: ['纯音乐', '治愈'],
    knobs: {
      cameraIntensity: '镜头推拉的力度；副歌爆发的歌调高（这个模式最吃性能）',
      typographyMotion: '文字本身的运动量',
      mgDensity: '背景动态图形的密度（需 showBackgroundMg=true 且 showOnlyText=false）',
      enableTransitions: '段落间的转场',
    },
  },
  tempera: {
    name: '凝彩',
    host: '成片的色块与细密网点缓缓重组，歌词压过颜色时翻出反色',
    axes: { motion: 0.6, density: 0.65, warmth: 0.75, space: 0.3, story: 0.45 },
    energy: [0.35, 0.9],
    fit: ['流行', '俏皮', '城市', '夜晚', '青春'],
    avoid: ['暗黑', '孤独', '管弦'],
    knobs: {
      cameraIntensity: '镜头运动力度',
      glyphMotion: '逐字入场的幅度',
      colorMode: '配色：duo 双色、mono 单色、gradient 渐变',
      showBlocks: '色块；关掉后更素',
      depthOfField: '景深：背景和前景虚化的程度，有空间感的歌调高',
      depthPan: '镜头平移的幅度，律动强的歌调高',
      glyphDepth: '歌词按字号分出远近的程度',
    },
  },
  lumiere: {
    name: '绘光',
    host: '体积光穿过烟雾与浮尘，歌词像被光一点点照亮的刻字',
    axes: { motion: 0.45, density: 0.4, warmth: 0.55, space: 0.8, story: 0.5 },
    energy: [0.3, 0.9],
    fit: ['壮阔', '管弦', '抒情', '释然', '治愈', '古风'],
    avoid: ['俏皮', '说唱'],
    keywords: ['光束', '微光', '烟雨', '雾', '尘埃', '神', '信仰', '黎明', '曙光', '天空'],
    knobs: {
      lightIntensity: '光的强度',
      fogDensity: '烟雾浓度；神秘、沉重的歌调高',
      audioResponse: '随音乐变亮的程度',
      decay: '唱完的字崩解的强度；激烈处调高',
    },
  },
  hanabi: {
    name: '花火',
    host: '花火烟花歌词 PV 可视化',
    axes: { motion: 0.7, density: 0.5, warmth: 0.8, space: 0.7, story: 0.4 },
    energy: [0.4, 0.95],
    fit: ['夏天', '庆祝'],
    avoid: ['暗黑', '愤怒', '孤独'],
    keywords: ['烟花', '烟火', '花火', '夏夜', '夏祭', '祭典', '流星'],
    knobs: {},
  },
  still: {
    name: '静止',
    host: '歌词静止在画面中央，不做动画也不渲染背景，最省资源',
    axes: { motion: 0, density: 0.1, warmth: 0.5, space: 0.05, story: 0.2 },
    energy: [0, 0.2],
    fit: [],
    avoid: [],
    knobs: {},
    // Never picked on fit alone: it is the "no animation" choice.
    penalty: 0.25,
  },
};
return { PROFILE_VERSION, TAGS, PROFILES };
})();

// ---- src/prompts.mjs
const __prompts = (() => {
// Prompt templates. Fixed text comes first in every request so provider-side
// prompt caching can hit it; what changes per song comes last.

const { TAGS, PROFILES } = __profiles;
const { paramSpecLine, effectSpecLines } = __params;

// ---------------------------------------------------------------- step 1: brief

const BRIEF_SYSTEM = [
  '你是音乐分析师，为一个歌词动画导演写“歌曲简报”。',
  '你会收到歌曲信息、歌词的结构数据和带时间的完整歌词（C 表示副歌，V 表示其他段落），有时还有播放器为这首歌生成的主题描述。',
  '如果你认识这首歌，请结合你对它的编曲、节奏和演唱的了解；不认识就只依据歌词和结构数据，不要编造。',
  '结构数据里 charsPerSecond 是演唱时每秒的字数：说唱通常在 6 以上，抒情慢歌通常在 3 以下。',
  '',
  '请判断：整体情绪及其变化、叙事视角、核心意象、能量走势（哪里铺垫、哪里爆发、结尾怎么收）、适合的视觉气质。',
  '特别注意旋律与歌词情绪是否矛盾（例如欢快的旋律配遗憾的歌词），这是重要的导演线索，写进 contrast。',
  '',
  `tags 只能从这个列表里选 3~6 个：${TAGS.join('、')}`,
  '',
  '只输出一个 JSON 对象，不要任何其他文字：',
  '{',
  '  "summary": "不超过 60 字，这首歌给人的画面感",',
  '  "mood": ["2~4 个情绪词"],',
  '  "tags": ["从列表中选"],',
  '  "arc": "能量走势，一句话",',
  '  "contrast": "旋律与歌词的反差；没有就写空字符串",',
  '  "imagery": ["2~4 个核心意象"],',
  '  "energy": { "overall": 0~1, "verse": 0~1, "chorus": 0~1 },',
  '  "visual": { "motion": 0~1, "density": 0~1, "warmth": 0~1, "space": 0~1, "story": 0~1 },',
  '  "known": true 或 false（你是否认识这首歌）,',
  '  "confidence": 0~1（你对这份判断的把握）',
  '}',
  'visual 的含义：motion 画面运动量；density 同屏文字与装饰的多少；warmth 冷峻科技(0)到温暖有机(1)；space 平面海报(0)到纵深三维(1)；story 逐句叙事感的强弱。',
].join('\n');

const buildBriefUser = (context) => {
  const lines = [
    `歌名：${context.title || '(未知)'}`,
    `歌手：${context.artist || '(未知)'}`,
    `专辑：${context.album || '(未知)'}`,
  ];
  if (context.theme) lines.push(`播放器主题：${context.theme.name}——${context.theme.description}`);
  lines.push(`结构数据：${JSON.stringify(context.structure)}`);
  lines.push('', context.instrumental ? '（这首歌没有歌词，可能是纯音乐）' : `歌词：\n${context.lyrics}`);
  return lines.join('\n');
};

// ---------------------------------------------------------------- step 2: decision

const DECIDE_SYSTEM = [
  '你是歌词动画导演。根据“歌曲简报”，从候选模式里为这首歌选一个歌词动画模式，并给出该模式的参数。',
  '候选已按与简报的贴合程度排好序，并附有每个模式的画面描述、适合与不适合的歌、可调参数及其效果。',
  '',
  '规则：',
  '1. 模式之间没有优劣，只有合适与否。先比较简报的情绪、意象和能量走势与各候选的画面描述，再决定；排序只是参考，你可以选排在后面的候选。',
  '2. 只有当两个候选同样合适时，才优先选“最近没用过”的那个。',
  '3. 只有候选都明显不合适时，才从“其他模式”里选。',
  '4. params 只放你选的那个模式的参数，键名和范围必须来自给出的清单。只给 2~5 个你确信能让画面更贴合这首歌的参数。',
  '5. 形如 key(…)[需 X=Y] 的参数只在开关 X=Y 时生效，要改它就把开关一起写进 params。',
  '6. 如果给出了“这首歌上次的选择”，除非明显不合适，否则沿用；用户主动要求重新决策时不受此限。',
  '7. 如果候选附有“鼓点效果”，为你选的模式的每个效果决定开关和强度(0~2，1 为默认)：节奏鲜明、鼓点清楚的歌打开，能量越高强度越大；安静、抒情、几乎没有鼓的歌关掉。没有附效果就不要输出 effects。',
  '8. 形如 key(…)[需效果 X 开] 的参数只在效果 X 打开时生效。',
  '9. 如果给出了“用户口味”，那是这位用户亲自做过的修改，比一般审美更重要：和例子气质相似的歌，优先用户改成或认可的模式，避开用户否掉的模式；气质不同的歌只作参考。',
  '10. 如果给出了“这次要避开的模式”，不要选它。',
  '',
  '只输出一个 JSON 对象，不要任何其他文字：',
  '{ "mode": "模式 id", "params": { "键": 值 }, "effects": { "效果 id": { "on": true, "strength": 1 } }, "reason": "不超过 40 字，为什么这个模式贴合这首歌", "confidence": 0~1 }',
].join('\n');

const profileBlock = (candidate, effects = []) => {
  const profile = PROFILES[candidate.id];
  const knobs = Object.entries(profile.knobs ?? {});
  const spec = knobs.length > 0 ? paramSpecLine(candidate.id, knobs.map(([key]) => key)) : '';
  const rows = [
    `### ${candidate.id}（${profile.name}${typeof candidate.score === 'number' ? `，贴合度 ${candidate.score.toFixed(2)}` : ''}）`,
    `画面：${profile.host}`,
    `适合：${profile.fit.join('、') || '—'}；不适合：${profile.avoid.join('、') || '—'}`,
  ];
  if (knobs.length > 0) {
    rows.push(`可调参数：${spec}`);
    rows.push(...knobs.map(([key, effect]) => `- ${key}：${effect}`));
  } else {
    rows.push('可调参数：无（只选模式即可）');
  }
  if (effects.length > 0) rows.push('鼓点效果（智能动感）：', ...effectSpecLines(effects));
  return rows.join('\n');
};

/**
 * `effects`: mode id -> beat effect ids, only when 智能动感 is on and the user lets the AI set it.
 * `taste`: { summary: string, examples: string[] } learnt from the user (M5); `avoid`: a mode just turned down.
 */
const buildDecideUser = ({ brief, title, artist, candidates, others, previous, recentModes, userHint, effects = {}, taste = null, avoid = null }) => {
  const lines = [
    `歌曲：${title} - ${artist}`,
    `简报：${JSON.stringify(brief)}`,
  ];
  if (userHint) lines.push(`用户偏好：${userHint}`);
  if (taste && (taste.summary || taste.examples?.length)) {
    lines.push('用户口味（从用户过去的修改学到的）：');
    if (taste.summary) lines.push(`- 整体：${taste.summary}`);
    for (const example of taste.examples ?? []) lines.push(`- ${example}`);
  }
  if (avoid) lines.push(`这次要避开的模式：${avoid}（用户刚说不合适）`);
  if (previous) lines.push(`这首歌上次的选择：${previous.mode}${previous.reason ? `（${previous.reason}）` : ''}`);
  if (recentModes.length > 0) lines.push(`最近用过的模式（新→旧，只在平局时参考）：${recentModes.join('、')}`);
  lines.push('', '候选模式：', ...candidates.map((candidate) => profileBlock(candidate, effects[candidate.id] ?? [])));
  if (others.length > 0) lines.push('', `其他模式：${others.map((mode) => `${mode.id}（${mode.label}）`).join('、')}`);
  return lines.join('\n');
};

// ---------------------------------------------------------------- after a manual switch: parameters only

const TUNE_SYSTEM = [
  '你是歌词动画导演。用户已经亲自为这首歌选定了歌词动画模式，模式不能改；你只需要根据“歌曲简报”给出这个模式的参数，让画面更贴合这首歌。',
  '',
  '规则：',
  '1. params 的键名和范围必须来自给出的清单。只给 2~5 个你确信能让画面更贴合这首歌的参数。',
  '2. 形如 key(…)[需 X=Y] 的参数只在开关 X=Y 时生效，要改它就把开关一起写进 params；形如 key(…)[需效果 X 开] 的参数只在效果 X 打开时生效。',
  '3. 如果附有“鼓点效果”，为每个效果决定开关和强度(0~2，1 为默认)：节奏鲜明、鼓点清楚的歌打开，能量越高强度越大；安静、抒情、几乎没有鼓的歌关掉。没有附效果就不要输出 effects。',
  '',
  '只输出一个 JSON 对象，不要任何其他文字：',
  '{ "params": { "键": 值 }, "effects": { "效果 id": { "on": true, "strength": 1 } }, "reason": "不超过 30 字，这些参数为什么贴合这首歌" }',
].join('\n');

/** The one mode the user chose, with its parameters and beat effects to fill in. */
const buildTuneUser = ({ brief, title, artist, mode, effects = [], userHint }) => {
  const lines = [
    `歌曲：${title} - ${artist}`,
    `简报：${JSON.stringify(brief)}`,
  ];
  if (userHint) lines.push(`用户偏好：${userHint}`);
  lines.push('', '用户选定的模式：', profileBlock({ id: mode }, effects));
  return lines.join('\n');
};
return { BRIEF_SYSTEM, buildBriefUser, DECIDE_SYSTEM, buildDecideUser, TUNE_SYSTEM, buildTuneUser };
})();

// ---- src/ranker.mjs
const __ranker = (() => {
// Local scoring: brief × mode profiles -> ranked candidates, no AI call.
// Score = axis closeness + tag matches + imagery keywords + energy fit
//         - penalties, roughly 0..1.
//
// v2 (M2 baseline): `story` is weighted down because nearly every brief rates
// it 0.8+, so it told modes apart by noise; imagery keywords were added for
// modes defined by a concrete image (fireworks, the cosmos, light and fog...).

const { PROFILES } = __profiles;

const AXIS_WEIGHTS = { motion: 1.2, density: 0.6, warmth: 0.6, space: 0.8, story: 0.4 };
const TAG_FIT = 0.06;
const TAG_AVOID = 0.1;
const TAG_CAP = 0.18;
const KEYWORD_HIT = 0.06;
const KEYWORD_CAP = 0.12;
const DECISIVE_GAP = 0.08;
const DECISIVE_CONFIDENCE = 0.7;

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const axisCloseness = (visual, axes) => {
  let total = 0;
  let weights = 0;
  for (const [axis, weight] of Object.entries(AXIS_WEIGHTS)) {
    if (visual?.[axis] === undefined) continue;
    total += weight * Math.abs(clamp01(visual[axis]) - axes[axis]);
    weights += weight;
  }
  return weights > 0 ? 1 - total / weights : 0.5;
};

const energyFit = (energy, [low, high]) => {
  if (energy === undefined || energy === null) return 0;
  const value = clamp01(energy);
  if (value >= low && value <= high) return 0.04;
  return -0.4 * (value < low ? low - value : value - high);
};

/* The brief's own words, where an image like "烟花" or "星空" would show up. */
const imageryText = (brief) => [
  ...(Array.isArray(brief?.imagery) ? brief.imagery : []),
  brief?.summary ?? '',
  brief?.arc ?? '',
].join(' ');

/**
 * @param brief  the step-1 brief
 * @param modeIds modes available right now (live registry)
 * @param bias   optional mode -> score adjustment learnt from the user (M5)
 * @returns {{ ranked: {id, score, why}[], unprofiled: string[], decisive: boolean }}
 */
const rankModes = (brief, modeIds, bias = {}) => {
  const tags = new Set(Array.isArray(brief?.tags) ? brief.tags : []);
  const text = imageryText(brief);
  const ranked = [];
  const unprofiled = [];
  for (const id of modeIds) {
    const profile = PROFILES[id];
    if (!profile) {
      unprofiled.push(id);
      continue;
    }
    const closeness = axisCloseness(brief?.visual, profile.axes);
    const fitHits = profile.fit.filter((tag) => tags.has(tag));
    const avoidHits = profile.avoid.filter((tag) => tags.has(tag));
    const tagScore = Math.max(-TAG_CAP, Math.min(TAG_CAP, fitHits.length * TAG_FIT - avoidHits.length * TAG_AVOID));
    const keywordHits = (profile.keywords ?? []).filter((word) => text.includes(word));
    const keywordScore = Math.min(KEYWORD_CAP, keywordHits.length * KEYWORD_HIT);
    const taste = Number(bias[id]) || 0;
    const score = closeness + tagScore + keywordScore + energyFit(brief?.energy?.overall, profile.energy) - (profile.penalty ?? 0) + taste;
    ranked.push({
      id,
      score: Math.round(score * 1000) / 1000,
      why: { closeness: Math.round(closeness * 100) / 100, fit: [...fitHits, ...keywordHits.map((word) => `「${word}」`)], avoid: avoidHits, ...(taste ? { taste } : {}) },
    });
  }
  ranked.sort((a, b) => b.score - a.score);
  const gap = ranked.length > 1 ? ranked[0].score - ranked[1].score : 1;
  const decisive = gap >= DECISIVE_GAP && clamp01(brief?.confidence) >= DECISIVE_CONFIDENCE;
  return { ranked, unprofiled, decisive };
};
return { rankModes };
})();

// ---- src/providers.mjs
const __providers = (() => {
// Endpoint presets for OpenAI-compatible chat APIs. A preset only fills in the
// base URL and knows how that provider switches reasoning off; the model name is
// always the user's (model lists change too often to ship), and "测试连接" can
// fetch the provider's own list. Any other OpenAI-compatible endpoint works
// through "自定义".

const PROVIDERS = {
  custom: { label: '自定义（填下面的接口地址）', url: '' },
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1', thinking: 'reasoning_effort' },
  deepseek: { label: 'DeepSeek 深度求索', url: 'https://api.deepseek.com', thinking: 'thinking' },
  dashscope: { label: '阿里云百炼（通义千问）', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', thinking: 'enable_thinking' },
  zhipu: { label: '智谱 BigModel（GLM）', url: 'https://open.bigmodel.cn/api/paas/v4', thinking: 'thinking' },
  moonshot: { label: '月之暗面 Kimi', url: 'https://api.moonshot.cn/v1' },
  volcengine: { label: '火山方舟（豆包）', url: 'https://ark.cn-beijing.volces.com/api/v3', thinking: 'thinking' },
  siliconflow: { label: '硅基流动 SiliconFlow', url: 'https://api.siliconflow.cn/v1', thinking: 'enable_thinking' },
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  gemini: { label: 'Google Gemini（OpenAI 兼容端点）', url: 'https://generativelanguage.googleapis.com/v1beta/openai', thinking: 'reasoning_effort' },
  ollama: { label: 'Ollama（本机）', url: 'http://localhost:11434/v1', local: true },
  lmstudio: { label: 'LM Studio（本机）', url: 'http://localhost:1234/v1', local: true },
};

/** The request fields each way of switching reasoning off sends. */
const THINKING_OFF = {
  thinking: { thinking: { type: 'disabled' } },
  enable_thinking: { enable_thinking: false },
  reasoning_effort: { reasoning_effort: 'low' },
  none: {},
};

/* Hosts whose switch is known, for "自动" with a custom URL. */
const HOST_RULES = [
  [/deepseek\.com/, 'thinking'],
  [/bigmodel\.cn/, 'thinking'],
  [/volces\.com/, 'thinking'],
  [/dashscope|aliyuncs\.com/, 'enable_thinking'],
  [/siliconflow/, 'enable_thinking'],
  [/api\.openai\.com/, 'reasoning_effort'],
  [/generativelanguage\.googleapis\.com/, 'reasoning_effort'],
];

/** `auto` resolves by preset, then by host; anything else is used as given. */
const thinkingMethodFor = ({ method, provider, url }) => {
  if (method && method !== 'auto') return method;
  if (PROVIDERS[provider]?.thinking) return PROVIDERS[provider].thinking;
  const host = String(url).toLowerCase();
  return HOST_RULES.find(([pattern]) => pattern.test(host))?.[1] ?? 'none';
};

/** The base URL in effect: the user's own, or the preset's. */
const baseUrlFor = ({ provider, baseUrl }) => String(baseUrl ?? '').trim() || PROVIDERS[provider]?.url || '';

/** Local servers (Ollama, LM Studio, anything on this machine) need no key. */
const isLocalUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(String(url).trim());

/**
 * `<base>/<endpoint>`: a bare host gets `/v1` first (DeepSeek, most gateways);
 * a base that already has a path (`/v1`, `/api/v3`, `/v1beta/openai`) is used
 * as is. A full `.../chat/completions` URL is trimmed back to its base first.
 */
const endpointUrl = (base, endpoint) => {
  let url = String(base ?? '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const cut = url.search(/[?#]/);
  const query = cut === -1 ? '' : url.slice(cut);
  let path = (cut === -1 ? url : url.slice(0, cut)).replace(/\/+$/, '').replace(/\/(chat\/completions|models)$/i, '');
  if (/^https?:\/\/[^/]+$/i.test(path)) path += '/v1';
  return `${path}/${endpoint}${query}`;
};
return { PROVIDERS, THINKING_OFF, thinkingMethodFor, baseUrlFor, isLocalUrl, endpointUrl };
})();

// ---- src/llm.mjs
const __llm = (() => {
// OpenAI-compatible chat calls through `folium.net.fetch` (host-side, no CORS,
// timeout at most 60 s), written to work with whatever endpoint a community user
// brings: OpenAI, Chinese providers, OpenRouter, local Ollama / LM Studio.
//
// Providers disagree on optional fields (JSON mode, how to switch reasoning off,
// max_tokens vs max_completion_tokens, whether temperature is allowed). The
// request starts with all of them and, when the provider rejects one, drops or
// swaps the field its error names and retries. What worked is handed back as a
// `compat` record so the next call for the same endpoint and model starts right.

const { endpointUrl } = __providers;

const TIMEOUT_MS = 45000;
const MAX_TOKENS = 1200;
const MAX_ATTEMPTS = 6;
const OPTIONAL_FIELDS = ['response_format', 'thinking', 'enable_thinking', 'reasoning_effort', 'temperature'];

const extractJson = (raw) => {
  let text = String(raw ?? '').trim();
  // Some local models wrap their answer in a <think> block even when asked not to.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (text.startsWith('```')) text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  return JSON.parse(text);
};

const contentOf = (message) => {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('');
  return '';
};

/** Token counts, cache hits and reasoning tokens under the field names in use. */
const usageOf = (usage) => ({
  input: Number(usage?.prompt_tokens) || 0,
  output: Number(usage?.completion_tokens) || 0,
  cached: Number(usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens) || 0,
  reasoning: Number(usage?.completion_tokens_details?.reasoning_tokens) || 0,
});

const redact = (text, apiKey) => String(text)
  .split(apiKey || '\u0000').join('[已隐藏]')
  .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, '$1[已隐藏]')
  .replace(/("?(?:api[_-]?key|authorization|token)"?\s*[:=]\s*"?)[^"\s,}]{8,}/gi, '$1[已隐藏]');

/* What a status means to someone who just pasted a key in. */
const explainStatus = (status) => ({
  401: '密钥无效或已过期',
  402: '账户余额不足',
  403: '没有权限使用这个模型或接口',
  404: '地址或模型名不对（用“测试连接”看看可用的模型）',
  429: '请求太频繁或额度用完了',
}[status] ?? (status >= 500 ? '服务商那边出错了，稍后再试' : ''));

const headersFor = (apiKey) => ({
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

/** The request body for this attempt, from the compat record. */
const bodyFor = ({ model, temperature, thinkingFields, system, user }, compat) => {
  const body = {
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature,
    stream: false,
    response_format: { type: 'json_object' },
    ...thinkingFields,
  };
  body[compat.maxTokensField ?? 'max_tokens'] = MAX_TOKENS;
  for (const field of compat.drop ?? []) delete body[field];
  return body;
};

/* Reads a 400/422 body for the field it complains about and returns the next
 * compat record, or null when there is nothing left to try. */
const nextCompat = (compat, body, errorText) => {
  const text = errorText.toLowerCase();
  if ((compat.maxTokensField ?? 'max_tokens') === 'max_tokens' && text.includes('max_tokens')) {
    return { ...compat, maxTokensField: 'max_completion_tokens' };
  }
  const named = OPTIONAL_FIELDS.find((field) => field in body && text.includes(field));
  const field = named ?? OPTIONAL_FIELDS.find((name) => name in body);
  if (!field) return null;
  return { ...compat, drop: [...new Set([...(compat.drop ?? []), field])] };
};

/**
 * @returns {Promise<{ json, usage, ms, thought: boolean, compat }>}
 *   `thought` is true when the model spent tokens reasoning anyway.
 */
const chatJson = async ({ fetch, baseUrl, apiKey, model, temperature, thinkingFields = {}, system, user, compat: start = {} }) => {
  const url = endpointUrl(baseUrl, 'chat/completions');
  if (!url) throw new Error('还没有选择服务商或填写接口地址');
  if (!model) throw new Error('还没有填写模型名');
  let compat = { drop: [], ...start };
  const started = performance.now();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const body = bodyFor({ model, temperature, thinkingFields, system, user }, compat);
    let response;
    try {
      response = await fetch(url, { method: 'POST', headers: headersFor(apiKey), body: JSON.stringify(body), timeoutMs: TIMEOUT_MS });
    } catch (error) {
      throw new Error(`连不上接口：${redact(error?.message ?? error, apiKey)}`);
    }
    if (response.ok) {
      let data;
      try {
        data = response.json();
      } catch {
        throw new Error('接口返回的不是 JSON（地址可能填错了）');
      }
      const choice = data?.choices?.[0];
      const text = contentOf(choice?.message);
      const usage = usageOf(data?.usage);
      const thought = Boolean(choice?.message?.reasoning_content || choice?.message?.reasoning || usage.reasoning > 0);
      if (!text) {
        throw new Error(choice?.finish_reason === 'length'
          ? '回答被长度上限截断：这个模型可能在“思考”，在设置里换一种关闭思考的方式，或换个模型'
          : '接口返回了空内容');
      }
      let json;
      try {
        json = extractJson(text);
      } catch {
        throw new Error(`模型没有按要求返回 JSON：${text.slice(0, 120)}`);
      }
      return { json, usage, ms: Math.round(performance.now() - started), thought, compat };
    }
    const errorText = (() => {
      try {
        return redact(response.text(), apiKey);
      } catch {
        return '';
      }
    })();
    const retryable = response.status === 400 || response.status === 422;
    const next = retryable ? nextCompat(compat, body, errorText) : null;
    if (!next) {
      const hint = explainStatus(response.status);
      throw new Error(`接口返回 ${response.status}${hint ? `（${hint}）` : ''}：${errorText.slice(0, 240) || response.statusText}`);
    }
    compat = next;
  }
  throw new Error('接口一直拒绝请求，换个模型试试');
};

/** GET /models, as most OpenAI-compatible servers offer it. */
const listModels = async ({ fetch, baseUrl, apiKey }) => {
  const url = endpointUrl(baseUrl, 'models');
  if (!url) throw new Error('还没有选择服务商或填写接口地址');
  const response = await fetch(url, { method: 'GET', headers: headersFor(apiKey), timeoutMs: 15000 });
  if (!response.ok) {
    const hint = explainStatus(response.status);
    throw new Error(`获取模型列表失败 ${response.status}${hint ? `（${hint}）` : ''}`);
  }
  const data = response.json();
  const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.models) ? data.models : []);
  return list.map((item) => (typeof item === 'string' ? item : item?.id ?? item?.name)).filter(Boolean).sort();
};

const PING_SYSTEM = '只输出一个 JSON 对象：{"ok": true, "word": "一个描述夜晚的中文词"}';

/** "测试连接": the model list (when offered) and one tiny JSON call. */
const testConnection = async ({ fetch, baseUrl, apiKey, model, thinkingFields, compat }) => {
  const report = { models: null, modelsError: null, modelListed: null, chat: null, chatError: null };
  try {
    report.models = await listModels({ fetch, baseUrl, apiKey });
    report.modelListed = report.models.length === 0 ? null : report.models.includes(model);
  } catch (error) {
    report.modelsError = String(error?.message ?? error);
  }
  if (model) {
    try {
      report.chat = await chatJson({ fetch, baseUrl, apiKey, model, temperature: 0.2, thinkingFields, system: PING_SYSTEM, user: '测试', compat });
    } catch (error) {
      report.chatError = String(error?.message ?? error);
    }
  }
  return report;
};
return { usageOf, chatJson, listModels, testConnection };
})();

// ---- src/taste.mjs
const __taste = (() => {
// M5 taste learning: what the user told us about the AI's picks, and how it
// feeds back into the next ones. Pure functions over a small stored list.
//
// Signals, strongest first:
//   switch  the user changed the mode by hand (and kept it): `from` was wrong, `to` right
//   down    👎 on the pick: `from` was wrong
//   up      👍 on the pick: `to` was right
//   redo    "重新挑选" without saying why: a weak no to `from`
//
// Each item keeps the song's brief in short, so a later song can be compared
// with it: feedback on similar songs counts fully, on unlike songs only a little.

const TASTE_VERSION = 1;
const TASTE_MAX = 30;

const WEIGHTS = { switch: 1, down: 1, up: 0.5, redo: 0.4 };
const BIAS_PER_POINT = 0.05; // ranking points per unit of feedback on a very similar song
const BIAS_FLOOR = 0.3; // share of that kept for unlike songs
const BIAS_MIN = -0.15;
const BIAS_MAX = 0.12;
const SUMMARY_MIN = 1.5; // a single change is a song's taste, not the user's
const EXAMPLE_MIN_SIM = 0.5;

const emptyTaste = () => ({ v: TASTE_VERSION, items: [] });

const normalizeTaste = (stored) => (
  stored && stored.v === TASTE_VERSION && Array.isArray(stored.items) ? stored : emptyTaste()
);

const AXES = ['motion', 'density', 'warmth', 'space', 'story'];
const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** What of a brief a taste item keeps. */
const briefPrint = (brief) => ({
  s: String(brief?.summary ?? '').slice(0, 24),
  g: (brief?.tags ?? []).slice(0, 4),
  v: AXES.map((axis) => Math.round(clamp01(brief?.visual?.[axis] ?? 0.5) * 100) / 100),
  e: Math.round(clamp01(brief?.energy?.overall ?? 0.5) * 100) / 100,
});

/** 0..1: how alike two songs are, by the visual axes, energy and shared tags. */
const similarity = (a, b) => {
  if (!a?.v || !b?.v) return 0;
  let sum = 0;
  for (let i = 0; i < AXES.length; i += 1) sum += (a.v[i] - b.v[i]) ** 2;
  sum += (a.e - b.e) ** 2;
  const distance = Math.sqrt(sum / (AXES.length + 1)); // 0..1
  const tagsA = new Set(a.g ?? []);
  const tagsB = new Set(b.g ?? []);
  const union = new Set([...tagsA, ...tagsB]).size;
  const shared = [...tagsA].filter((tag) => tagsB.has(tag)).length;
  const jaccard = union > 0 ? shared / union : 0;
  return Math.max(0, Math.min(1, (1 - distance * 2.5) * 0.7 + jaccard * 0.3));
};

/** A new list with `item` added: one verdict per song (the latest), the newest TASTE_MAX kept. */
const addFeedback = (taste, item) => {
  const items = normalizeTaste(taste).items.filter((old) => old.k !== item.k);
  items.push({ ...item, at: item.at ?? Date.now() });
  return { v: TASTE_VERSION, items: items.slice(-TASTE_MAX) };
};

/* +weight to the mode the user wanted, -weight to the one they did not. */
const credits = (item) => {
  const weight = WEIGHTS[item.kind] ?? 0;
  const out = [];
  if (item.to) out.push([item.to, weight]);
  if (item.from && item.from !== item.to) out.push([item.from, -weight]);
  return out;
};

/** mode -> net feedback over every item, e.g. { partita: 2, tilt: -1.4 }. */
const modeScores = (taste) => {
  const scores = {};
  for (const item of normalizeTaste(taste).items) {
    for (const [mode, value] of credits(item)) scores[mode] = (scores[mode] ?? 0) + value;
  }
  return scores;
};

/** mode -> ranking adjustment for the song described by `print`. */
const tasteBias = (taste, print) => {
  const bias = {};
  for (const item of normalizeTaste(taste).items) {
    const reach = BIAS_FLOOR + (1 - BIAS_FLOOR) * similarity(item, print);
    for (const [mode, value] of credits(item)) bias[mode] = (bias[mode] ?? 0) + value * reach * BIAS_PER_POINT;
  }
  for (const mode of Object.keys(bias)) {
    bias[mode] = Math.round(Math.min(BIAS_MAX, Math.max(BIAS_MIN, bias[mode])) * 1000) / 1000;
  }
  return bias;
};

/** The most similar feedback on other songs, best first. */
const similarExamples = (taste, print, exceptKey, count = 4) => normalizeTaste(taste).items
  .filter((item) => item.k !== exceptKey)
  .map((item) => ({ item, sim: similarity(item, print) }))
  .filter(({ sim }) => sim >= EXAMPLE_MIN_SIM)
  .sort((a, b) => b.sim - a.sim)
  .slice(0, count)
  .map(({ item }) => item);

/** Modes the user keeps choosing or turning down, for one line of the prompt and the panel. */
const tasteSummary = (taste) => {
  const scores = Object.entries(modeScores(taste));
  return {
    liked: scores.filter(([, value]) => value >= SUMMARY_MIN).sort((a, b) => b[1] - a[1]).map(([mode, value]) => ({ mode, value })),
    disliked: scores.filter(([, value]) => value <= -SUMMARY_MIN).sort((a, b) => a[1] - b[1]).map(([mode, value]) => ({ mode, value })),
  };
};

/** How an item reads in the prompt and the panel. */
const describeItem = (item, nameOf = (mode) => mode) => {
  const song = item.t ? `《${item.t}》` : `一首歌`;
  const about = [item.s, (item.g ?? []).join('、')].filter(Boolean).join('，');
  const head = about ? `${song}（${about}）` : song;
  if (item.kind === 'switch') {
    return item.from ? `${head}：AI 选了 ${nameOf(item.from)}，用户改成 ${nameOf(item.to)}` : `${head}：用户自己选了 ${nameOf(item.to)}`;
  }
  if (item.kind === 'up') return `${head}：用户认可 ${nameOf(item.to)}`;
  if (item.kind === 'down') return `${head}：用户否掉了 ${nameOf(item.from)}`;
  return `${head}：用户对 ${nameOf(item.from)} 不太满意，要求重选`;
};
return { TASTE_VERSION, TASTE_MAX, emptyTaste, normalizeTaste, briefPrint, similarity, addFeedback, modeScores, tasteBias, similarExamples, tasteSummary, describeItem };
})();

// ---- src/director.mjs
const __director = (() => {
// The main flow: song changes -> memory or (brief -> local ranking -> decision)
// -> apply at a safe moment. One `generation` per displayed song; work that
// finishes after the song changed still lands in that song's memory but never
// touches the player.

const { buildSongContext, cleanLines, songKeyOf } = __song_context;
const { BRIEF_SYSTEM, buildBriefUser, DECIDE_SYSTEM, buildDecideUser, TUNE_SYSTEM, buildTuneUser } = __prompts;
const { rankModes } = __ranker;
const { sanitizeParams, sanitizeEffects } = __params;
const { PROFILES } = __profiles;
const { chatJson, testConnection } = __llm;
const { addFeedback, briefPrint, describeItem, emptyTaste, normalizeTaste, similarExamples, tasteBias, tasteSummary } = __taste;
const { baseUrlFor, isLocalUrl, thinkingMethodFor, THINKING_OFF } = __providers;

const LYRICS_WAIT_MS = 5000;
const USER_CHANGE_GRACE_MS = 2000; // host-side switches right after a song change are not the user
const SAFE_POLL_MS = 200;
const RECENT_MAX = 6;
const CACHED_PRICE_RATIO = 0.1;
const SETTLE_MS = 8000; // a manual mode counts as taste once the user stays on it this long

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Is `pos` (seconds) a moment where switching will not cut a sung line? M0: a
 * switch is a hard cut with a 90-270 ms hitch, so only before the first line or
 * inside a real gap between lines. */
const isSafeMoment = (lines, pos) => {
  const timed = lines.filter((line) => Number.isFinite(line.startTime) && Number.isFinite(line.endTime));
  if (timed.length === 0) return true;
  if (pos < timed[0].startTime - 0.4) return true;
  for (let i = 0; i < timed.length; i += 1) {
    const line = timed[i];
    const next = timed[i + 1];
    if (pos >= line.startTime - 0.2 && pos < line.endTime + 0.2) return false;
    if (next && pos >= line.endTime && pos < next.startTime) {
      return next.startTime - line.endTime >= 1.5 && next.startTime - pos >= 0.8;
    }
  }
  return pos >= timed[timed.length - 1].endTime + 0.2;
};

const createDirector = ({ folium, host, store, settings, onChange }) => {
  const log = folium.log;
  let generation = 0;
  let disposed = false;
  let current = null; // per displayed song
  let lastLyrics = { key: null, lines: [] };
  let lastTheme = { theme: null, at: 0 };
  let totals = { calls: 0, input: 0, output: 0, cached: 0, cost: 0 };
  let recentModes = [];
  let busy = null; // promise of the decision in flight for `current`
  let next = null; // the next song in the queue, prepared in the background
  let taste = emptyTaste(); // M5: the user's feedback on past picks

  const emit = () => {
    try {
      onChange?.();
    } catch (error) {
      log.warn('面板刷新出错', { message: String(error?.message ?? error) });
    }
  };
  const setPhase = (target, phase, message = '') => {
    if (!target) return;
    target.phase = phase;
    target.message = message;
    if (target === current || target === next) emit();
  };

  const costOf = (usage) => {
    const values = settings();
    const fresh = Math.max(0, usage.input - usage.cached);
    return (fresh * values.priceIn + usage.cached * values.priceIn * CACHED_PRICE_RATIO + usage.output * values.priceOut) / 1e6;
  };

  const account = async (song, usage) => {
    const cost = costOf(usage);
    for (const target of [song?.usage, totals].filter(Boolean)) {
      target.calls += 1;
      target.input += usage.input;
      target.output += usage.output;
      target.cached += usage.cached;
      target.cost += cost;
    }
    await store.set('stats', totals).catch(() => {});
  };

  /* What the user configured, resolved: base URL, key, reasoning-off fields and
   * the remembered field quirks of this endpoint + model. */
  const endpoint = async () => {
    const values = settings();
    const baseUrl = baseUrlFor(values);
    if (!baseUrl) throw Object.assign(new Error('还没有选择服务商（设置 → 模组 → AI 歌词动画导演 Plus）'), { code: 'no-config' });
    if (!values.model) throw Object.assign(new Error('还没有填写模型名（可以先点“测试连接”看看有哪些）'), { code: 'no-config' });
    const apiKey = (await folium.secrets.get('apiKey')) ?? '';
    if (!apiKey && !isLocalUrl(baseUrl)) throw Object.assign(new Error('还没有填写 API 密钥（设置 → 模组 → AI 歌词动画导演 Plus）'), { code: 'no-key' });
    const method = thinkingMethodFor({ method: values.thinking, provider: values.provider, url: baseUrl });
    const compatKey = `compat:${baseUrl}|${values.model}`;
    return {
      fetch: (url, init) => folium.net.fetch(url, init),
      baseUrl,
      apiKey,
      model: values.model,
      temperature: values.temperature,
      thinkingFields: THINKING_OFF[method] ?? {},
      compatKey,
      compat: (await store.get(compatKey)) ?? {},
    };
  };

  const rememberCompat = async (config, compat) => {
    if (JSON.stringify(compat) !== JSON.stringify(config.compat)) await store.set(config.compatKey, compat).catch(() => {});
  };

  const callModel = async (target, system, user) => {
    const config = await endpoint();
    const result = await chatJson({ ...config, system, user });
    await rememberCompat(config, result.compat);
    if (result.thought) target.thought = true;
    await account(target, result.usage);
    return result;
  };

  /* Lyrics for `song`: the `lyrics.loaded` event when it came (or comes within
   * LYRICS_WAIT_MS), else the lines on screen, else the online source through
   * the public `omni.getLyrics`. The event alone is not enough: when the mod
   * starts (or is set up) mid-song, that event has already gone by. */
  const lyricsFor = async (song, key, gen) => {
    const until = performance.now() + LYRICS_WAIT_MS;
    while (performance.now() < until) {
      if (gen !== generation || disposed) return null;
      if (lastLyrics.key === key) return lastLyrics.lines;
      await sleep(150);
    }
    if (lastLyrics.key === key) return lastLyrics.lines;
    if (songKeyOf(folium.playback.getState().song) === key) {
      const onScreen = folium.lyrics.getLines();
      if (onScreen.length > 0) return onScreen;
    }
    if (song?.ref && typeof folium.omni?.getLyrics === 'function') {
      try {
        const fetched = await folium.omni.getLyrics(song);
        if (fetched.lines.length > 0) return fetched.lines;
      } catch (error) {
        log.info('在线歌词也拿不到，按无歌词处理', { message: String(error?.code ?? error?.message ?? error) });
      }
    }
    return [];
  };

  // ------------------------------------------------------------ taste (M5)

  const nameOf = (mode) => PROFILES[mode]?.name ?? mode;

  const summaryText = () => {
    const { liked, disliked } = tasteSummary(taste);
    const parts = [];
    if (liked.length) parts.push(`常主动选 ${liked.map((item) => nameOf(item.mode)).join('、')}`);
    if (disliked.length) parts.push(`常否掉 ${disliked.map((item) => nameOf(item.mode)).join('、')}`);
    return parts.join('；');
  };

  /* Feedback on the song `target` shows. Only once it has a brief to compare
   * later songs with; nothing is kept when the user turned learning off. */
  const remember = async (target, kind, { from = null, to = null } = {}) => {
    if (!settings().learnTaste || !target?.brief || !target.key) return false;
    taste = addFeedback(taste, { k: target.key, t: target.song?.title ?? '', ...briefPrint(target.brief), kind, from, to });
    await store.set('taste', taste).catch(() => {});
    emit();
    return true;
  };

  /* The AI's own pick for the song on screen, if what shows came from it. */
  const aiPickOf = (target) => (target?.decision && !['user-memory'].includes(target.decidedBy) ? target.decision.mode : null);

  /* Manual switches settle before they count, so flicking through modes is not taste. */
  let settleTimer = null;
  const settleSwitch = async (target) => {
    clearTimeout(settleTimer);
    settleTimer = null;
    if (!target?.userMode || target.tasteRecorded === target.userMode) return;
    const from = aiPickOf(target);
    if (from === target.userMode) return; // looked around and came back
    target.tasteRecorded = target.userMode;
    await remember(target, 'switch', { from, to: target.userMode });
    if (target === current && host.currentMode() === target.userMode) await tuneManual(target, target.userMode);
  };

  /* The user picked `mode` by hand: the AI fills in its parameters (and beat
   * effects) for this song from the brief, one step-2-sized call; they go out
   * at a safe moment and are remembered with the user's choice. */
  const tuneManual = async (target, mode) => {
    const values = settings();
    if (!values.applyParams || !target?.brief || !PROFILES[mode]) return null;
    const effects = beatFxOn() ? host.listBeatEffects(mode) : [];
    if (Object.keys(PROFILES[mode].knobs ?? {}).length === 0 && effects.length === 0) return null;
    const gen = generation;
    setPhase(target, 'tuning', `正在按这首歌给 ${nameOf(mode)} 调参数`);
    try {
      const { json } = await callModel(target, TUNE_SYSTEM, buildTuneUser({
        brief: target.brief,
        title: target.song.title,
        artist: target.song.artist,
        mode,
        effects,
        userHint: values.userHint,
      }));
      if (target.userMode !== mode) return null; // switched again meanwhile
      const tuned = {
        mode,
        params: sanitizeParams(mode, json?.params),
        fx: beatFxOn() ? sanitizeEffects(json?.effects, effects) : {},
        reason: typeof json?.reason === 'string' ? json.reason : '',
      };
      target.tuned = tuned;
      if (values.remember) await store.saveUserChoice(target.key, mode, tuned).catch(() => {});
      if (gen === generation) await applyWhenSafe(gen, target, tuned, 'user', { manual: true });
      setPhase(target, 'user', `你换成了 ${nameOf(mode)}，AI 已按这首歌调好参数`);
      return tuned;
    } catch (error) {
      log.warn('手动换模式后调参数失败', { message: String(error?.message ?? error) });
      setPhase(target, 'user', `你换成了 ${nameOf(mode)}（没能调参数：${String(error?.message ?? error)}）`);
      return null;
    }
  };

  /* Choices made by hand before M5 (song memory with both a pick and a user mode). */
  const importPastChoices = async () => {
    for (const key of (await store.keys()).slice().reverse()) {
      const entry = await store.getSong(key);
      if (!entry?.u?.mode || !entry.b) continue;
      const from = entry.d?.mode && entry.d.mode !== entry.u.mode ? entry.d.mode : null;
      taste = addFeedback(taste, { k: key, t: '', ...briefPrint(entry.b), kind: 'switch', from, to: entry.u.mode, at: entry.u.at });
    }
    await store.set('taste', taste).catch(() => {});
  };

  /* The local ranking of a remembered song, for the panel: no AI call. */
  const rankForPanel = (brief) => {
    if (!brief) return null;
    const bias = settings().learnTaste && taste.items.length > 0 ? tasteBias(taste, briefPrint(brief)) : {};
    return rankModes(brief, host.listModes().map((mode) => mode.id), bias).ranked;
  };

  // ------------------------------------------------------------ applying

  const ensureSnapshot = async () => {
    const existing = await store.get('snapshot');
    const saved = host.snapshot();
    if (!existing) {
      if (saved) await store.set('snapshot', saved);
    } else if (!existing.effects && saved?.effects) {
      // Snapshots from before 0.5.0 never touched 智能动感; add it before the first effect write.
      await store.set('snapshot', { ...existing, effects: saved.effects });
    }
  };

  /* The AI sets beat effects only while 智能动感 plays and the user allows it. */
  const beatFxOn = () => settings().beatFx && ['on', 'cached'].includes(host.beatMode());

  const applyNow = async (decision) => {
    await ensureSnapshot();
    const switched = host.setMode(decision.mode);
    let written = {};
    let notes = [];
    if (settings().applyParams && decision.params && Object.keys(decision.params).length > 0) {
      ({ written, notes } = host.setParams(decision.mode, decision.params));
    }
    let fx = {};
    if (beatFxOn() && decision.fx && Object.keys(decision.fx).length > 0) fx = host.setEffects(decision.mode, decision.fx);
    recentModes = [decision.mode, ...recentModes.filter((mode) => mode !== decision.mode)].slice(0, RECENT_MAX);
    await store.set('recent', recentModes).catch(() => {});
    return { switched, written, notes, fx };
  };

  /* Waits for a moment that will not cut a sung line, then applies. Nothing to
   * wait for when the player already shows this choice, or while it is paused
   * (a switch on a still frame interrupts nothing). */
  const applyWhenSafe = async (gen, target, decision, phaseDone, { manual = false } = {}) => {
    const lines = cleanLines(target.lines ?? (lastLyrics.key === target.key ? lastLyrics.lines : folium.lyrics.getLines()));
    let waited = false;
    for (;;) {
      if (gen !== generation || disposed || (target.userOverrode && !manual)) return false;
      if (manual && host.currentMode() !== decision.mode) return false; // the user moved on
      const { position, song, state } = folium.playback.getState();
      if (!song) return false;
      if (host.shows(decision.mode, settings().applyParams ? decision.params : null, beatFxOn() ? decision.fx : null)) break;
      if (state !== 'playing' || isSafeMoment(lines, position)) break;
      if (!waited) {
        waited = true;
        setPhase(target, 'waiting-gap', '等歌词空隙再切换，避免唱到一半换画面');
      }
      await sleep(SAFE_POLL_MS);
    }
    const result = await applyNow(decision);
    target.applied = { mode: decision.mode, ...result };
    setPhase(target, phaseDone);
    return true;
  };

  // ------------------------------------------------------------ deciding

  /*
   * brief (cached per song) -> local ranking -> decision, for any song: the one
   * on screen or the next one in the queue. `job` collects phase, usage and what
   * was found, for the panel; nothing here touches the player.
   */
  const think = async (job, { song, key, lines, durationSeconds, theme, entry, force = false, rebrief = false, persist = true, recent = recentModes, avoid = null }) => {
    const values = settings();
    let brief = !rebrief ? entry.b : null;
    if (!brief) {
      setPhase(job, 'briefing', '正在理解这首歌（第 1 步）');
      const context = buildSongContext({ song, lines, durationSeconds, theme });
      const { json } = await callModel(job, BRIEF_SYSTEM, buildBriefUser(context));
      brief = store.compactBrief(json);
      job.instrumental = context.instrumental;
      // A brief written without lyrics is a guess; keep it for this play only.
      if (persist && !context.instrumental) await store.saveBrief(key, brief);
    }
    job.brief = brief;

    // The evaluation scores the general judgement, so it leaves the user's taste out.
    const useTaste = persist && values.learnTaste && taste.items.length > 0;
    const print = briefPrint(brief);
    const modes = host.listModes().filter((mode) => mode.id !== avoid);
    const { ranked, unprofiled, decisive } = rankModes(brief, modes.map((mode) => mode.id), useTaste ? tasteBias(taste, print) : {});
    job.ranked = ranked;
    const examples = useTaste ? similarExamples(taste, print, key) : [];
    job.tasteUsed = examples.length;
    const top = ranked.slice(0, 3);
    if (top.length === 0) throw new Error('没有可用的内置模式');

    let decision;
    if (values.economy && decisive && !force && !avoid) {
      decision = { mode: top[0].id, params: {}, reason: '本地打分明显领先，省去第 2 步', confidence: brief.confidence };
    } else {
      setPhase(job, 'deciding', '正在挑选模式（第 2 步）');
      const effects = beatFxOn()
        ? Object.fromEntries(top.map((item) => [item.id, host.listBeatEffects(item.id)]).filter(([, ids]) => ids.length > 0))
        : {};
      const others = [
        ...ranked.slice(3).map((item) => ({ id: item.id, label: PROFILES[item.id].name })),
        ...unprofiled.map((id) => ({ id, label: modes.find((mode) => mode.id === id)?.label ?? id })),
      ];
      const { json } = await callModel(job, DECIDE_SYSTEM, buildDecideUser({
        brief,
        title: song.title,
        artist: song.artist,
        candidates: top,
        others,
        previous: force ? null : (entry.d ?? null),
        recentModes: recent.filter((mode) => modes.some((item) => item.id === mode)),
        userHint: values.userHint,
        effects,
        taste: useTaste ? { summary: summaryText(), examples: examples.map((item) => describeItem(item, nameOf)) } : null,
        avoid: avoid ? `${avoid}（${nameOf(avoid)}）` : null,
      }));
      const validMode = modes.some((mode) => mode.id === json?.mode) ? json.mode : null;
      if (!validMode) log.warn(`AI 选了不存在的模式「${json?.mode}」，改用本地第一名`);
      const mode = validMode ?? top[0].id;
      decision = {
        mode,
        params: sanitizeParams(mode, json?.params),
        fx: beatFxOn() ? sanitizeEffects(json?.effects, host.listBeatEffects(mode)) : {},
        reason: typeof json?.reason === 'string' ? json.reason : '',
        confidence: Number(json?.confidence) || 0,
      };
    }
    decision.top = top.map((item) => ({ id: item.id, score: item.score }));
    job.decision = decision;
    // Instrumental tracks are not remembered: one guess should not stick forever.
    if (persist && values.remember && !job.instrumental) await store.saveDecision(key, decision);
    return decision;
  };

  const decide = async (gen, { force = false, rebrief = false, avoid = null } = {}) => {
    const target = current;
    const { song, key } = target;
    const entry = (await store.getSong(key)) ?? {};
    const lines = await lyricsFor(song, key, gen);
    if (lines === null) return;
    target.lines = lines;
    const decision = await think(target, {
      song,
      key,
      lines,
      durationSeconds: folium.playback.getState().duration,
      theme: lastTheme.at >= target.startedAt ? lastTheme.theme : null,
      entry,
      force,
      rebrief,
      avoid,
    });
    if (gen !== generation) return; // the answer went to memory; the player has moved on
    target.decidedBy = 'ai';
    await applyWhenSafe(gen, target, decision, 'applied');
    folium.ui.toast(`AI 导演：${PROFILES[decision.mode]?.name ?? decision.mode}${decision.reason ? `——${decision.reason}` : ''}`);
    prepareNext();
  };

  // ------------------------------------------------------------ the next song

  /* The song that plays after this one, as the queue and repeat mode say. */
  const nextSong = () => {
    const playback = folium.playback;
    if (typeof playback?.getQueue !== 'function') return null;
    const queue = playback.getQueue({ limit: 1 });
    if (queue.kind === 'stage' || queue.currentIndex < 0 || queue.length === 0) return null;
    const loop = playback.getLoopMode?.() ?? 'off';
    if (loop === 'one') return null;
    let index = queue.currentIndex + 1;
    if (index >= queue.length) {
      if (loop !== 'all') return null;
      index = 0;
    }
    return playback.getQueue({ offset: index, limit: 1 }).items.find((item) => item.index === index)?.song ?? null;
  };

  let prepareTimer = null;
  /* Debounced: queue edits and song changes arrive in bursts. */
  const prepareNext = (delayMs = 1500) => {
    clearTimeout(prepareTimer);
    prepareTimer = setTimeout(() => { prepare().catch(() => {}); }, delayMs);
  };

  /*
   * Decides the next song while this one plays and writes it to memory only, so
   * the switch happens at the very start of that song (M1 field test: without
   * it, a new song showed the previous song's mode for 10-20 s).
   */
  const prepare = async () => {
    if (disposed) return;
    const values = settings();
    if (!values.prefetch || !values.autoDecide || !values.remember) {
      next = null;
      emit();
      return;
    }
    // Only once the song on screen is settled: never two jobs for the player at once.
    if (!current || busy || !['applied', 'remembered', 'user-memory', 'user', 'idle'].includes(current.phase)) return;
    const song = nextSong();
    const key = songKeyOf(song);
    if (!song || key === current.key) {
      next = null;
      emit();
      return;
    }
    if (next?.key === key && (next.promise || ['ready', 'remembered'].includes(next.phase))) return;
    const job = {
      song,
      key,
      phase: 'idle',
      message: '',
      usage: { calls: 0, input: 0, output: 0, cached: 0, cost: 0 },
      promise: null,
    };
    next = job;
    const entry = (await store.getSong(key)) ?? {};
    if (entry.d || entry.u) {
      job.decision = entry.u ? { mode: entry.u.mode, params: entry.u.params ?? {}, fx: entry.u.fx ?? {}, reason: '你之前手动选的模式' } : entry.d;
      setPhase(job, 'remembered', '已经记住了，切过去会直接套用');
      return;
    }
    job.promise = (async () => {
      setPhase(job, 'fetching', '正在获取歌词');
      let lyrics;
      try {
        lyrics = await folium.omni.getLyrics(song);
      } catch (error) {
        setPhase(job, 'skipped', error?.code === 'unsupported' ? '本地歌曲拿不到歌词，播放时再决定' : '拿不到歌词，播放时再决定');
        return;
      }
      if (lyrics.isPureMusic || lyrics.lines.length === 0) {
        setPhase(job, 'skipped', '纯音乐或没有歌词，播放时再决定');
        return;
      }
      const lines = lyrics.lines;
      await think(job, {
        song,
        key,
        lines,
        durationSeconds: lines[lines.length - 1]?.endTime ?? 0,
        theme: null,
        entry,
      });
      setPhase(job, 'ready', '已准备好，切过去会直接套用');
    })()
      .catch((error) => {
        log.warn('提前准备下一首失败', { message: String(error?.message ?? error) });
        setPhase(job, 'error', String(error?.message ?? error));
      })
      .finally(() => {
        job.promise = null;
        emit();
      });
    await job.promise;
  };

  const run = (gen, options) => {
    busy = decide(gen, options)
      .catch((error) => {
        log.warn('决策失败', { message: String(error?.message ?? error) });
        if (gen !== generation) return;
        setPhase(current, ['no-key', 'no-config'].includes(error?.code) ? error.code : 'error', String(error?.message ?? error));
      })
      .finally(() => { busy = null; });
    return busy;
  };

  // ------------------------------------------------------------ events

  const onSong = async (song) => {
    if (settleTimer) settleSwitch(current).catch(() => {}); // the song ends before the switch settled: it still counts
    generation += 1;
    const gen = generation;
    const key = songKeyOf(song);
    current = song ? {
      song,
      key,
      startedAt: performance.now(),
      phase: 'idle',
      message: '',
      usage: { calls: 0, input: 0, output: 0, cached: 0, cost: 0 },
      userOverrode: false,
    } : null;
    if (!current) return emit();
    if (!host.available()) return setPhase(current, 'error', '宿主内部接口不可用：确认模组 folia 版本范围与当前 Folia 匹配');

    // The next-song job may be working on this very song: wait for it rather than pay twice.
    if (next?.key === key && next.promise) {
      setPhase(current, 'waiting-prepare', '这首歌正在提前准备中，马上好');
      await next.promise;
      if (gen !== generation) return;
    }
    const entry = await store.getSong(key);
    if (gen !== generation) return;
    current.brief = entry?.b ?? null;
    current.ranked = rankForPanel(current.brief);
    if (entry?.u && settings().remember) {
      current.decision = { mode: entry.u.mode, params: entry.u.params ?? {}, fx: entry.u.fx ?? {}, reason: '你之前为这首歌手动选的模式', confidence: 1 };
      current.decidedBy = 'user-memory';
      await applyWhenSafe(gen, current, current.decision, 'user-memory');
      prepareNext();
      return;
    }
    if (entry?.d && settings().remember) {
      current.decision = entry.d;
      current.decidedBy = 'memory';
      current.prepared = next?.key === key && next.phase === 'ready';
      await applyWhenSafe(gen, current, entry.d, 'remembered');
      prepareNext();
      return;
    }
    if (!settings().autoDecide) return setPhase(current, 'idle', '自动决策已关闭');
    setPhase(current, 'waiting-lyrics', '等歌词加载');
    run(gen, {});
  };

  const onModeChanged = (mode) => {
    if (!current || host.isOwnWrite()) return;
    if (performance.now() - current.startedAt < USER_CHANGE_GRACE_MS) return;
    current.userOverrode = true;
    current.userMode = mode;
    if (settings().remember) store.saveUserChoice(current.key, mode).catch(() => {});
    setPhase(current, 'user', `你手动换成了 ${PROFILES[mode]?.name ?? mode}，本首不再自动切换`);
    prepareNext();
    const target = current;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settleSwitch(target).catch(() => {}); }, SETTLE_MS);
  };

  return {
    /** What the developer-only evaluator (src/evaluate.mjs) runs on. */
    forEvaluation: () => ({ think, endpoint, emit, isDisposed: () => disposed }),
    start: async () => {
      totals = { ...totals, ...((await store.get('stats')) ?? {}) };
      recentModes = (await store.get('recent')) ?? [];
      const storedTaste = await store.get('taste');
      taste = normalizeTaste(storedTaste);
      if (storedTaste === undefined || storedTaste === null) await importPastChoices().catch(() => {});
      const lines = folium.lyrics.getLines();
      const { song } = folium.playback.getState();
      if (song && lines.length > 0) lastLyrics = { key: songKeyOf(song), lines };
      await onSong(song);
    },
    onSongChanged: (song) => onSong(song).catch((error) => log.warn('换歌处理出错', { message: String(error?.message ?? error) })),
    onLyricsLoaded: (song, lines) => { lastLyrics = { key: songKeyOf(song), lines: lines ?? [] }; },
    onThemeChanged: (theme) => { lastTheme = { theme, at: performance.now() }; },
    onModeChanged,
    /** The queue or repeat mode changed: the next song may be another one now. */
    onQueueChanged: () => prepareNext(),
    /** A key or a setting was just saved: pick up where missing setup stopped this song. */
    onSetupChanged: () => {
      if (['no-key', 'no-config'].includes(current?.phase) && !busy) run(generation, {});
    },
    /** "测试连接": model list + one tiny call, with the settings as they are now. */
    testConnection: async () => {
      const config = await endpoint().catch((error) => {
        if (error?.code === 'no-config' && !settings().model && baseUrlFor(settings())) return null;
        throw error;
      });
      const values = settings();
      const report = await testConnection(config ?? {
        fetch: (url, init) => folium.net.fetch(url, init),
        baseUrl: baseUrlFor(values),
        apiKey: (await folium.secrets.get('apiKey')) ?? '',
        model: '',
      });
      if (config && report.chat) await rememberCompat(config, report.chat.compat);
      return report;
    },
    /** Commands. `force` ignores the remembered pick; `rebrief` redoes step 1 too. */
    decideNow: async ({ force = false, rebrief = false, avoid = null } = {}) => {
      if (!current) return '现在没有在播放的歌';
      if (busy) return '正在决策中，请稍候';
      // "Pick again" on the AI's own pick, without saying why: a weak no.
      if (force && !rebrief && !avoid && aiPickOf(current)) await remember(current, 'redo', { from: aiPickOf(current) });
      if (force) {
        await store.forgetDecision(current.key);
        current.userOverrode = false;
      } else {
        const entry = await store.getSong(current.key);
        if (entry?.d) {
          await applyWhenSafe(generation, current, entry.d, 'remembered');
          return '已套用记住的选择';
        }
      }
      await run(generation, { force, rebrief, avoid });
      return current.phase === 'applied' ? '已完成' : current.message || current.phase;
    },
    /** 👍 / 👎 on what shows now. 👎 also picks another mode for this song right away. */
    feedback: async (verdict) => {
      if (!current?.decision) return '这首歌还没有选择';
      if (busy) return '正在决策中，请稍候';
      const mode = current.userMode ?? current.decision.mode;
      if (verdict === 'up') {
        current.liked = mode;
        return (await remember(current, 'up', { to: mode })) ? `已记下：${nameOf(mode)} 适合这类歌` : '没有记下（口味学习已关闭，或这首歌还没有简报）';
      }
      await remember(current, 'down', { from: mode });
      await store.forgetDecision(current.key);
      current.userOverrode = false;
      current.userMode = null;
      await run(generation, { force: true, avoid: mode });
      return current.phase === 'applied' ? `已换成 ${nameOf(current.decision.mode)}` : current.message || current.phase;
    },
    /** The user picked `mode` in the panel: it shows at once, becomes this song's choice and a taste record. */
    chooseMode: async (mode) => {
      if (!current) return '现在没有在播放的歌';
      if (busy) return '正在决策中，请稍候';
      if (!host.listModes().some((item) => item.id === mode)) return `现在没有这个模式：${mode}`;
      const target = current;
      const from = aiPickOf(target);
      await ensureSnapshot();
      host.setMode(mode); // marked as our own write, so onModeChanged does not count it twice
      clearTimeout(settleTimer);
      settleTimer = null;
      target.userOverrode = true;
      target.userMode = mode;
      target.tasteRecorded = mode;
      if (settings().remember) await store.saveUserChoice(target.key, mode).catch(() => {});
      if (from !== mode) await remember(target, 'switch', { from, to: mode });
      setPhase(target, 'user', `你换成了 ${nameOf(mode)}，本首不再自动切换`);
      prepareNext();
      busy = tuneManual(target, mode).finally(() => { busy = null; });
      const tuned = await busy;
      const notes = [];
      if (tuned) notes.push('AI 已按这首歌调好参数');
      if (from && from !== mode && settings().learnTaste) notes.push('已记进口味');
      return `已换成 ${nameOf(mode)}${notes.length ? `，${notes.join('，')}` : ''}`;
    },
    getTaste: () => ({ items: taste.items, summary: summaryText() }),
    clearTaste: async () => {
      taste = emptyTaste();
      await store.set('taste', taste);
      emit();
      return '已清除口味记录';
    },
    restore: async () => {
      const saved = await store.get('snapshot');
      if (!saved) return '还没有改动过你的设置';
      host.restore(saved);
      await store.set('snapshot', null);
      if (current) current.userOverrode = true; // do not switch again for this song
      return '已恢复原来的模式与参数';
    },
    getState: () => ({ current, next, totals, recentModes, beat: host.beatMode() }),
    dispose: () => { disposed = true; generation += 1; clearTimeout(prepareTimer); clearTimeout(settleTimer); },
  };
};
return { isSafeMoment, createDirector };
})();

// ---- src/evaluate.mjs
const __evaluate = (() => {
const createEvaluator = null;
return { createEvaluator };
})();

// ---- src/panel.mjs
const __panel = (() => {
// The "AI 导演" player panel tab: what the director is doing for the song on
// screen, the brief, the ranking, the decision and what it cost.

const { PROFILES } = __profiles;
const { BEAT_EFFECTS } = __params;
const { describeItem } = __taste;

const PHASES = {
  idle: '空闲',
  'waiting-lyrics': '等歌词',
  briefing: '理解歌曲中',
  deciding: '挑选模式中',
  'waiting-gap': '等歌词空隙',
  applied: '已应用',
  remembered: '记忆命中',
  'user-memory': '沿用你的手动选择',
  tuning: '调参数中',
  user: '你已手动接管',
  'no-key': '缺少密钥',
  'no-config': '还没设置好',
  'waiting-prepare': '提前准备中',
  fetching: '取歌词中',
  ready: '已准备好',
  skipped: '跳过',
  error: '出错',
};

const AXES = { motion: '运动', density: '密度', warmth: '温度', space: '纵深', story: '叙事' };
const nameOf = (mode) => (PROFILES[mode] ? `${PROFILES[mode].name}（${mode}）` : mode);
const pct = (value) => (typeof value === 'number' ? value.toFixed(2) : '—');

const CSS = `
  .ad { font: 13px/1.55 system-ui, sans-serif; padding: 12px; color: inherit; }
  .ad h3 { font-size: 13px; margin: 14px 0 4px; opacity: 0.75; font-weight: 600; }
  .ad .song { font-size: 15px; font-weight: 600; }
  .ad .badge { display: inline-block; padding: 1px 8px; border-radius: 10px; border: 1px solid currentColor; font-size: 12px; margin-right: 6px; }
  .ad .muted { opacity: 0.6; font-size: 12px; }
  .ad .err { color: #ff8a80; }
  .ad .mode { font-size: 16px; font-weight: 600; }
  .ad .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
  .ad button { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 6px; cursor: pointer;
    border: 1px solid currentColor; background: transparent; color: inherit; opacity: 0.85; white-space: nowrap; }
  .ad button:hover { opacity: 1; }
  .ad table { border-collapse: collapse; width: 100%; font-size: 12px; }
  .ad td { padding: 2px 4px; vertical-align: top; }
  .ad .guide { border: 1px dashed currentColor; border-radius: 8px; padding: 8px 10px; margin: 8px 0; font-size: 12px; }
  .ad .guide ol { margin: 4px 0 0 18px; padding: 0; }
  .ad .test { white-space: pre-wrap; font-size: 12px; margin: 6px 0; }
  .ad .warn { color: #ffcc80; font-size: 12px; }
  .ad .bar { display: inline-block; height: 6px; border-radius: 3px; background: currentColor; opacity: 0.6; vertical-align: middle; }
`;

const mountPanel = (container, ctx, { director, evaluator, folium, settings, onRender }) => {
  const money = (value) => {
    const { priceIn, priceOut, currency } = settings();
    return priceIn + priceOut > 0 ? `，约 ${currency}${(value ?? 0).toFixed(4)}` : '';
  };
  const style = document.createElement('style');
  style.textContent = CSS;
  const root = document.createElement('div');
  root.className = 'ad';
  const view = document.createElement('div');
  const actions = document.createElement('div');
  actions.className = 'row';
  const result = document.createElement('div');
  result.className = 'muted';
  const testOut = document.createElement('div');
  testOut.className = 'test';
  const evalBox = document.createElement('div');
  root.append(view, actions, result, testOut, evalBox);
  container.append(style, root);

  const button = (label, run) => {
    const node = document.createElement('button');
    node.textContent = label;
    node.addEventListener('click', async () => {
      result.textContent = '进行中…';
      try {
        result.textContent = String(await run());
      } catch (error) {
        result.textContent = `出错：${error?.message ?? error}`;
      }
    });
    return node;
  };
  actions.append(
    button('为这首歌决策', () => director.decideNow()),
    button('重新挑选模式', () => director.decideNow({ force: true })),
    button('重新理解整首歌', () => director.decideNow({ force: true, rebrief: true })),
    button('恢复原来的设置', () => director.restore()),
    button('测试连接', async () => {
      testOut.textContent = '测试中…';
      const report = await director.testConnection();
      const lines = [];
      if (report.models) {
        lines.push(`模型列表：${report.models.length} 个${report.modelListed === false ? '（你填的模型名不在列表里，检查一下拼写）' : ''}`);
        if (report.models.length > 0) lines.push(report.models.slice(0, 40).join('  ') + (report.models.length > 40 ? '  …' : ''));
      } else if (report.modelsError) {
        lines.push(`模型列表：拿不到（${report.modelsError}）。有些服务商不提供列表，不影响使用`);
      }
      if (report.chat) {
        lines.push(`对话测试：成功，${report.chat.ms} ms，${report.chat.usage.input + report.chat.usage.output} token`);
        if (report.chat.thought) lines.push('⚠ 模型在“思考”：更贵也更慢。到设置里换一种“关闭思考”的方式，或换个不带思考的模型');
        if ((report.chat.compat.drop ?? []).length > 0) lines.push(`已自动适配：这个接口不支持 ${report.chat.compat.drop.join('、')}`);
      } else if (report.chatError) {
        lines.push(`对话测试：失败——${report.chatError}`);
      } else {
        lines.push('还没填模型名：从上面的列表里挑一个填进设置');
      }
      testOut.textContent = lines.join('\n');
      return '测试完成';
    }),
  );


  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };

  const render = () => {
    const { current, next, totals, beat } = director.getState();
    view.replaceChildren();
    const values = settings();
    if (['no-config', 'no-key'].includes(current?.phase) || (!values.model && !values.baseUrl && values.provider === 'custom')) {
      const guide = el('div', '', 'guide');
      guide.append(el('div', '第一次使用：'));
      const steps = el('ol');
      for (const step of [
        '打开 设置 → 模组 → AI 歌词动画导演 Plus',
        '“服务商”选你在用的（任何兼容 OpenAI 接口的都行，列表里没有就选“自定义”填地址）',
        '填 API 密钥（本机的 Ollama、LM Studio 不用填）',
        '回到这里点“测试连接”，从列表里挑一个模型名填进设置',
      ]) steps.append(el('li', step));
      guide.append(steps);
      view.append(guide);
    }
    if (!current) {
      view.append(el('div', '现在没有在播放的歌', 'muted'));
    } else {
      view.append(el('div', `${current.song.title} - ${current.song.artist}`, 'song'));
      const status = el('div');
      status.append(el('span', PHASES[current.phase] ?? current.phase, 'badge'));
      if (current.message) status.append(el('span', current.message, ['error', 'no-key', 'no-config'].includes(current.phase) ? 'err' : 'muted'));
      view.append(status);
      if (current.thought) view.append(el('div', '⚠ 这个模型在“思考”，更贵也更慢：到设置里换一种“关闭思考”的方式，或换个模型', 'warn'));

      const decision = current.decision;
      if (decision) {
        view.append(el('h3', '选择'));
        view.append(el('div', nameOf(decision.mode), 'mode'));
        if (decision.reason) view.append(el('div', decision.reason));
        const applied = current.applied;
        const ownApply = applied?.mode === decision.mode ? applied : null;
        const params = ownApply?.written && Object.keys(ownApply.written).length > 0 ? ownApply.written : decision.params;
        if (params && Object.keys(params).length > 0) view.append(el('div', `参数：${JSON.stringify(params)}`, 'muted'));
        const fx = ownApply?.fx && Object.keys(ownApply.fx).length > 0 ? ownApply.fx : decision.fx;
        if (fx && Object.keys(fx).length > 0) {
          const text = Object.entries(fx)
            .map(([id, value]) => `${BEAT_EFFECTS[id]?.zh ?? id} ${value.on ? `开 ${value.strength ?? ''}`.trim() : '关'}`)
            .join('，');
          view.append(el('div', `鼓点效果：${text}`, 'muted'));
        } else if (beat && Object.keys(BEAT_EFFECTS).some((id) => id.startsWith(`${decision.mode}.`))) {
          // The mode has 智能动感 effects but the AI did not set them: say why.
          let why;
          if (beat === 'off') why = 'Folia 的智能动感是关的，打开后（歌词样式 → 全局）AI 会一起安排';
          else if (!values.beatFx) why = '由你自己设；在设置里打开“同时调整智能动感”可交给 AI';
          else why = '这首是之前定的，没安排鼓点效果；点“重新挑选模式”可让 AI 一起安排';
          view.append(el('div', `鼓点效果：${why}`, 'muted'));
        }
        for (const note of applied?.notes ?? []) view.append(el('div', `· ${note}`, 'muted'));
        if (decision.confidence) view.append(el('div', `把握 ${pct(decision.confidence)}`, 'muted'));
        if (current.userMode && current.userMode !== decision.mode) {
          view.append(el('h3', '你换成的模式'));
          view.append(el('div', nameOf(current.userMode), 'mode'));
          const tuned = current.tuned?.mode === current.userMode ? current.tuned : null;
          if (tuned?.reason) view.append(el('div', tuned.reason));
          const mine = applied?.mode === current.userMode && Object.keys(applied.written ?? {}).length > 0 ? applied.written : tuned?.params;
          if (mine && Object.keys(mine).length > 0) view.append(el('div', `参数（AI 按这首歌调的）：${JSON.stringify(mine)}`, 'muted'));
          else if (current.phase !== 'tuning') view.append(el('div', '参数：沿用这个模式现有的设置', 'muted'));
        }
        if (current.tasteUsed) view.append(el('div', `参考了 ${current.tasteUsed} 条你在相似歌上的口味记录`, 'muted'));
        if (values.learnTaste && current.brief) {
          const verdict = el('div', '', 'row');
          verdict.append(
            button('👍 合适', () => director.feedback('up')),
            button('👎 不合适，换一个', () => director.feedback('down')),
          );
          view.append(verdict);
        }
      }

      const brief = current.brief;
      if (brief) {
        view.append(el('h3', '歌曲简报'));
        if (brief.summary) view.append(el('div', brief.summary));
        view.append(el('div', `情绪：${(brief.mood ?? []).join('、')}　标签：${(brief.tags ?? []).join('、')}`, 'muted'));
        if (brief.arc) view.append(el('div', `走势：${brief.arc}`, 'muted'));
        if (brief.contrast) view.append(el('div', `反差：${brief.contrast}`, 'muted'));
        if (brief.visual) {
          const table = el('table');
          for (const [axis, label] of Object.entries(AXES)) {
            const value = Number(brief.visual[axis]) || 0;
            const tr = el('tr');
            const bar = el('span', '', 'bar');
            bar.style.width = `${Math.round(value * 120)}px`;
            const cell = el('td');
            cell.append(bar, el('span', ` ${pct(value)}`, 'muted'));
            tr.append(el('td', label), cell);
            table.append(tr);
          }
          view.append(table);
        }
        view.append(el('div', `${brief.known ? '模型认识这首歌' : '模型不认识这首歌，只凭歌词判断'}　把握 ${pct(brief.confidence)}`, 'muted'));
      }

      if (current.ranked?.length) {
        view.append(el('h3', '本地打分（前 5，不满意可以直接换）'));
        const showing = current.userMode ?? current.decision?.mode;
        const table = el('table');
        for (const item of current.ranked.slice(0, 5)) {
          const tr = el('tr');
          const pick = el('td');
          if (item.id === showing) pick.append(el('span', '当前', 'muted'));
          else pick.append(button('换成', () => director.chooseMode(item.id)));
          tr.append(
            el('td', nameOf(item.id)),
            el('td', item.score.toFixed(3)),
            el('td', [...item.why.fit.map((tag) => `+${tag}`), ...item.why.avoid.map((tag) => `−${tag}`)].join(' '), 'muted'),
            pick,
          );
          table.append(tr);
        }
        view.append(table);
      }

      if (current.prepared) view.append(el('div', '这首歌是提前准备好的，切歌时直接套用', 'muted'));

      if (next) {
        view.append(el('h3', '下一首'));
        const row = el('div');
        row.append(el('span', PHASES[next.phase] ?? next.phase, 'badge'), el('span', `${next.song.title} - ${next.song.artist}`));
        view.append(row);
        if (next.decision) view.append(el('div', `→ ${nameOf(next.decision.mode)}${next.decision.reason ? `：${next.decision.reason}` : ''}`, 'muted'));
        else if (next.message) view.append(el('div', next.message, next.phase === 'error' ? 'err' : 'muted'));
      }

      const usage = current.usage;
      view.append(el('h3', '花费'));
      view.append(el('div', usage.calls > 0
        ? `本首：${usage.calls} 次调用，输入 ${usage.input}（缓存 ${usage.cached}）/ 输出 ${usage.output} token${money(usage.cost)}`
        : '本首：0 次调用', 'muted'));
      if (next?.usage?.calls > 0) {
        view.append(el('div', `提前准备下一首：${next.usage.calls} 次调用，输入 ${next.usage.input} / 输出 ${next.usage.output} token${money(next.usage.cost)}`, 'muted'));
      }
    }
    view.append(el('div', `累计：${totals.calls} 次调用，输入 ${totals.input} / 输出 ${totals.output} token${money(totals.cost)}`, 'muted'));
    renderTaste(values);
    renderEval();
  };

  /* M5: what has been learnt, newest first, with a way to start over. */
  const tasteBox = document.createElement('div');
  root.insertBefore(tasteBox, evalBox);
  const clearTaste = button('清除口味记录', () => director.clearTaste());
  const renderTaste = (values) => {
    tasteBox.replaceChildren();
    if (!values.learnTaste) return;
    const { items, summary } = director.getTaste();
    tasteBox.append(el('h3', `你的口味（${items.length} 条记录）`));
    if (items.length === 0) {
      tasteBox.append(el('div', '还没有记录。手动换模式（停留 8 秒以上）、点 👍 / 👎 都会记下来，之后相似的歌会参考。', 'muted'));
      return;
    }
    if (summary) tasteBox.append(el('div', summary));
    for (const item of items.slice(-5).reverse()) tasteBox.append(el('div', `· ${describeItem(item, nameOf)}`, 'muted'));
    const row = el('div', '', 'row');
    row.append(clearTaste);
    tasteBox.append(row);
  };

  /* Developer tool: the evaluation set (settings → 显示评测工具). */
  const evalOut = document.createElement('div');
  evalOut.className = 'test';
  const evalActions = document.createElement('div');
  evalActions.className = 'row';
  evalActions.append(
    button('运行评测', () => evaluator.evaluate()),
    button('重新理解后评测', () => evaluator.evaluate({ rebrief: true })),
    button('复制评测结果（JSON）', async () => {
      const report = await evaluator.getReport();
      if (!report) return '还没有评测结果';
      await navigator.clipboard.writeText(JSON.stringify(report, null, 1));
      return '已复制到剪贴板';
    }),
  );
  const renderEval = () => {
    evalBox.replaceChildren();
    if (!evaluator || !settings().devTools) return;
    evalBox.append(el('h3', '评测集（开发者）'), evalActions, evalOut);
    const run = evaluator.getRun();
    if (!run) {
      evalOut.textContent = '用内置的 42 首歌跑一遍完整流程，对照人工标注算命中率。简报会缓存，第二次起只花第 2 步的钱。';
      return;
    }
    const lines = [run.running ? `进行中 ${run.done}/${run.total}…` : ''];
    if (run.summary) {
      const s = run.summary;
      lines.push(`AI 命中 ${s.aiHit}%　本地第一名 ${s.localTop1}%　本地前三 ${s.localTop3}%　用了 ${s.distinctModes} 种模式　有效 ${s.scored}/${s.songs}`);
      if (s.holdout?.songs) {
        lines.push(`　调参集 ${s.tuned.songs} 首：AI ${s.tuned.aiHit}% / 第一名 ${s.tuned.localTop1}% / 前三 ${s.tuned.localTop3}%`);
        lines.push(`　保留集 ${s.holdout.songs} 首（没用来调参）：AI ${s.holdout.aiHit}% / 第一名 ${s.holdout.localTop1}% / 前三 ${s.holdout.localTop3}%`);
      }
      lines.push(`用量：${s.usage.calls} 次调用，输入 ${s.usage.input} / 输出 ${s.usage.output} token${money(s.usage.cost)}`);
    }
    for (const row of run.rows) {
      lines.push(row.error
        ? `✗ ${row.title}：${row.error}`
        : `${row.hit ? '✓' : '✗'} ${row.title} → ${nameOf(row.decision.mode)}（可接受：${row.accept.join('、')}；本地前三 ${row.top.slice(0, 3).map((item) => item.id).join('、')}）`);
    }
    evalOut.textContent = lines.filter(Boolean).join('\n');
  };

  const stop = onRender(render);
  ctx.every(1000, render);
  render();
  return stop;
};
return { mountPanel };
})();

// ---- src/client.mjs (entry)
// AI 歌词动画导演 Plus — entry point. Wires settings, events, the panel and the
// commands to the director. See DESIGN.md for the plan and M0 findings.

const { createHostAdapter } = __host_adapter;
const { createStore } = __store;
const { createDirector } = __director;
const { createEvaluator } = __evaluate;
const { mountPanel } = __panel;
const { PROVIDERS } = __providers;

const PANEL_ID = 'director';
const T = (zh, en) => ({ 'zh-CN': zh, en });

const PROVIDER_OPTIONS = Object.entries(PROVIDERS).map(([value, provider]) => ({ value, label: T(provider.label, provider.label) }));

const SETTINGS = [
  { key: 'provider', type: 'select', group: T('接口', 'API'), label: T('服务商', 'Provider'),
    description: T('任何兼容 OpenAI 接口的服务都能用；列表里没有的选“自定义”并填接口地址', 'Any OpenAI-compatible API works; pick "custom" for others'),
    defaultValue: 'custom', options: PROVIDER_OPTIONS },
  { key: 'baseUrl', type: 'text', group: T('接口', 'API'), label: T('接口地址', 'API base URL'),
    description: T('选了服务商可以留空；填了就以这里为准。例如 https://api.example.com/v1', 'Leave empty to use the provider preset'),
    defaultValue: '', placeholder: 'https://api.example.com/v1' },
  { key: 'model', type: 'text', group: T('接口', 'API'), label: T('模型', 'Model'),
    description: T('填服务商给的模型名；不确定就先点面板里的“测试连接”看可用列表。推荐便宜、快、不带思考的模型', 'The model id from your provider; "Test connection" lists them'),
    defaultValue: '', placeholder: 'gpt-4o-mini / deepseek-chat / qwen-plus …' },
  { key: 'apiKey', type: 'secret', group: T('接口', 'API'), label: T('API 密钥', 'API key'),
    description: T('由 Folia 加密保存。本机模型（Ollama、LM Studio）可以不填', 'Stored encrypted by Folia; not needed for local servers') },
  { key: 'thinking', type: 'select', group: T('接口', 'API'), label: T('关闭“思考”', 'Turn reasoning off'),
    description: T('很多模型默认先“思考”，费用翻 2–3 倍、耗时 20–60 秒，这个任务用不上。“自动”按服务商选择关闭方式；面板提示“模型在思考”时再手动换一种', 'Reasoning costs 2-3x and is not needed here'),
    defaultValue: 'auto', options: [
      { value: 'auto', label: T('自动（推荐）', 'Auto (recommended)') },
      { value: 'thinking', label: T('thinking: disabled（DeepSeek、智谱、豆包）', 'thinking: disabled') },
      { value: 'enable_thinking', label: T('enable_thinking: false（通义千问、硅基流动）', 'enable_thinking: false') },
      { value: 'reasoning_effort', label: T('reasoning_effort: low（OpenAI、Gemini）', 'reasoning_effort: low') },
      { value: 'none', label: T('不发送（模型本身不思考时）', 'Send nothing') },
    ] },
  { key: 'temperature', type: 'number', group: T('接口', 'API'), label: T('温度', 'Temperature'),
    description: T('越低越稳定', 'Lower is steadier'), defaultValue: 0.3, min: 0, max: 1, step: 0.05 },
  { key: 'autoDecide', type: 'boolean', group: T('行为', 'Behaviour'), label: T('换歌时自动决策', 'Decide on every song change'), defaultValue: true },
  { key: 'applyParams', type: 'boolean', group: T('行为', 'Behaviour'), label: T('同时调整参数', 'Apply parameters too'),
    description: T('关闭则只切换模式。第一次改动前会保存快照，可以随时恢复', 'Off: switch the mode only'), defaultValue: true },
  { key: 'beatFx', type: 'boolean', group: T('行为', 'Behaviour'), label: T('同时调整智能动感（鼓点效果）', 'Set beat effects too'),
    description: T('需要先在 Folia 的歌词样式→全局里打开智能动感。AI 会为每首歌决定当前模式的鼓点效果（如凝彩的墨染奥行）开不开、多强', 'Needs Smart beat on in Folia'), defaultValue: true },
  { key: 'learnTaste', type: 'boolean', group: T('行为', 'Behaviour'), label: T('学习我的口味', 'Learn my taste'),
    description: T('手动换模式、点 👍 / 👎 会被记下（最近 30 条），之后相似的歌会参考。可在面板里清除', 'Manual switches and 👍 / 👎 shape later picks'), defaultValue: true },
  { key: 'remember', type: 'boolean', group: T('行为', 'Behaviour'), label: T('记住每首歌的选择', 'Remember each song'), defaultValue: true },
  { key: 'prefetch', type: 'boolean', group: T('行为', 'Behaviour'), label: T('提前为下一首做准备', 'Prepare the next song'),
    description: T('当前这首放着时就先决定好队列里的下一首，切歌瞬间直接套用（只支持在线歌曲，需要打开“记住每首歌的选择”）', 'Decide the next queued song in the background'), defaultValue: true },
  { key: 'economy', type: 'boolean', group: T('行为', 'Behaviour'), label: T('省钱模式', 'Economy mode'),
    description: T('本地打分第一名明显领先时跳过第 2 步', 'Skip step 2 when the local ranking is clear'), defaultValue: false },
  { key: 'userHint', type: 'text', group: T('行为', 'Behaviour'), label: T('偏好提示（可选）', 'Preference hint'),
    description: T('例如“整体安静一点”“少用群唱”', 'e.g. "calmer overall"'), defaultValue: '' },
  { key: 'currency', type: 'select', group: T('花费显示', 'Cost'), label: T('货币', 'Currency'), defaultValue: 'CNY', options: [
    { value: 'CNY', label: T('人民币 ¥', 'CNY ¥') },
    { value: 'USD', label: T('美元 $', 'USD $') },
  ] },
  { key: 'priceIn', type: 'number', group: T('花费显示', 'Cost'), label: T('输入单价（每百万 token）', 'Input price per 1M tokens'),
    description: T('照服务商价格页填，只用于面板估算花费；填 0 只显示 token 数', 'From the price page of your provider; 0 shows tokens only'), defaultValue: 0, min: 0, max: 200, step: 0.01 },
  { key: 'priceOut', type: 'number', group: T('花费显示', 'Cost'), label: T('输出单价（每百万 token）', 'Output price per 1M tokens'), defaultValue: 0, min: 0, max: 400, step: 0.01 },
  // Only in a developer build (node dev/build.mjs --dev); the release has no evaluator.
  ...(createEvaluator ? [{ key: 'devTools', type: 'boolean', group: T('开发者', 'Developer'), label: T('显示评测工具', 'Show evaluation tools'),
    description: T('在面板和命令面板里加“评测”：用内置的 42 首歌跑一遍，看选择和人工标注对得上多少。一次约 60 次调用', 'Run the built-in 42-song evaluation; about 60 calls'), defaultValue: false }] : []),
];

export default async function activate(folium) {
  if ((folium.host?.folium?.minor ?? 0) < 7) {
    folium.ui.toast('AI 歌词动画导演 Plus 需要 Folium 1.7（Folia 0.7.22）或更新版本', { type: 'error' });
    return undefined;
  }

  const section = folium.registries.settingsSections.register({
    id: 'main',
    label: T('AI 歌词动画导演 Plus', 'AI lyric director Plus'),
    description: T('选服务商、填模型名和 API 密钥，然后在播放器面板「AI 导演」里点“测试连接”', 'Pick a provider, model and key, then "Test connection" in the panel'),
    settings: SETTINGS,
  });
  const settings = () => {
    const values = section.settings.get();
    return {
      provider: String(values.provider ?? 'custom'),
      baseUrl: String(values.baseUrl ?? '').trim(),
      model: String(values.model ?? '').trim(),
      thinking: String(values.thinking ?? 'auto'),
      temperature: Number(values.temperature ?? 0.3),
      autoDecide: values.autoDecide !== false,
      applyParams: values.applyParams !== false,
      beatFx: values.beatFx !== false,
      learnTaste: values.learnTaste !== false,
      remember: values.remember !== false,
      prefetch: values.prefetch !== false,
      economy: values.economy === true,
      userHint: String(values.userHint ?? '').trim().slice(0, 100),
      currency: values.currency === 'USD' ? '$' : '¥',
      priceIn: Number(values.priceIn ?? 0),
      priceOut: Number(values.priceOut ?? 0),
      devTools: values.devTools === true && Boolean(createEvaluator),
    };
  };

  const renderers = new Set();
  const host = createHostAdapter(folium);
  const store = createStore(folium.storage, folium.log);
  const director = createDirector({
    folium,
    host,
    store,
    settings,
    onChange: () => renderers.forEach((render) => render()),
  });
  const evaluator = createEvaluator?.({ folium, store, settings, ...director.forEvaluation() }) ?? null;

  folium.events.on('playback.songChanged', ({ song }) => director.onSongChanged(song));
  folium.events.on('lyrics.loaded', ({ song, lines }) => director.onLyricsLoaded(song, lines));
  folium.events.on('theme.changed', ({ theme }) => director.onThemeChanged(theme));
  folium.events.on('visualizer.modeChanged', ({ mode }) => director.onModeChanged(mode));
  folium.events.on('playback.queueChanged', () => director.onQueueChanged());
  folium.events.on('playback.loopModeChanged', () => director.onQueueChanged());
  folium.secrets.subscribe((key) => {
    if (key === 'apiKey') director.onSetupChanged();
  });
  section.settings.onChange(() => {
    director.onSetupChanged();
    director.onQueueChanged();
    syncEvalCommand();
  });

  folium.registries.playerPanelTabs.register({
    id: PANEL_ID,
    label: T('AI 导演', 'AI director'),
    order: 600,
    mount: (container, ctx) => mountPanel(container, ctx, {
      director,
      evaluator,
      folium,
      settings,
      onRender: (render) => {
        renderers.add(render);
        return () => renderers.delete(render);
      },
    }),
  });

  const command = (id, zh, en, run, keywords = []) => folium.registries.commands.register({
    id,
    label: T(zh, en),
    keywords: ['ai', '导演', 'director', ...keywords],
    run,
  });
  command('decide', 'AI 导演 Plus：为这首歌决策', 'AI director Plus: decide this song', () => director.decideNow());
  command('like', 'AI 导演 Plus：这个模式合适 👍', 'AI director Plus: this fits 👍', () => director.feedback('up'), ['喜欢', '合适']);
  command('dislike', 'AI 导演 Plus：不合适，换一个 👎', 'AI director Plus: does not fit, pick another 👎', () => director.feedback('down'), ['不喜欢', '换']);
  command('redecide', 'AI 导演 Plus：重新挑选模式', 'AI director Plus: pick again', () => director.decideNow({ force: true }), ['重新']);
  command('rebrief', 'AI 导演 Plus：重新理解整首歌', 'AI director Plus: re-analyse the song', () => director.decideNow({ force: true, rebrief: true }), ['重新', '分析']);
  command('test', 'AI 导演 Plus：测试连接', 'AI director Plus: test connection', async () => {
    const report = await director.testConnection();
    if (report.chatError) return `连接失败：${report.chatError}`;
    if (!report.chat) return report.modelsError ? `获取模型失败：${report.modelsError}` : `连接正常，可用模型 ${report.models?.length ?? 0} 个，请在设置里填模型名`;
    return `连接正常：${report.chat.ms} ms${report.chat.thought ? '，但模型在“思考”，建议换一种关闭思考的方式' : ''}`;
  }, ['测试', '连接']);
  // About 60 calls a run: listed only while the developer switch is on.
  let evalCommand = null;
  const syncEvalCommand = () => {
    if (settings().devTools && !evalCommand) {
      evalCommand = command('evaluate', 'AI 导演 Plus：运行评测集', 'AI director Plus: run the evaluation set', () => evaluator.evaluate(), ['评测', 'eval']);
    } else if (!settings().devTools && evalCommand) {
      evalCommand.unregister();
      evalCommand = null;
    }
  };
  syncEvalCommand();
  command('restore', 'AI 导演 Plus：恢复原来的设置', 'AI director Plus: restore my settings', () => director.restore(), ['恢复', '还原']);
  command('open', 'AI 导演 Plus：打开面板', 'AI director Plus: open panel', () => {
    folium.ui.openPlayerPanel(PANEL_ID);
    return '已打开';
  }, ['面板']);

  // Not awaited: the first song may wait for a lyric gap, and activation must not.
  director.start().catch((error) => folium.log.warn('启动时处理当前歌曲出错', { message: String(error?.message ?? error) }));
  return () => director.dispose();
}
