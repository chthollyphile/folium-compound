export const DEFAULT_RULES = [
  { min: 30, max: 90, mode: 'fume' },
  { min: 90, max: 120, mode: 'classic' },
  { min: 120, max: 150, mode: 'sonnet' },
  { min: 150, max: 361, mode: 'tempera' },
];
export const DEFAULTS = {
  enabled: true, autoAnalyze: true, allowOnline: false, respectManual: true,
  restoreOnDisable: true, minConfidence: 0.45, sampleSeconds: 60, maxFileMiB: 96,
  unknownMode: 'keep', rulesJson: JSON.stringify(DEFAULT_RULES),
};
export const validBpm = value => Number.isFinite(Number(value)) && Number(value) >= 30 && Number(value) <= 360;
export function parseRules(text, modes) {
  const rows = typeof text === 'string' ? JSON.parse(text) : text;
  if (!Array.isArray(rows) || !rows.length || rows.length > 32) throw new Error('请设置 1–32 个 BPM 区间。');
  const available = new Set((modes || []).map(x => x.id));
  const result = rows.map((r, index) => {
    const min = Number(r.min), max = Number(r.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 30 || max > 361 || min >= max) throw new Error(`第 ${index + 1} 行区间无效，须满足 30 ≤ 下限 < 上限 ≤ 361。`);
    if (typeof r.mode !== 'string' || !r.mode || r.mode.length > 160) throw new Error(`第 ${index + 1} 行未选择样式。`);
    return { min, max, mode: r.mode, missing: modes ? !available.has(r.mode) : false };
  }).sort((a, b) => a.min - b.min);
  for (let i = 1; i < result.length; i++) if (result[i].min < result[i - 1].max) throw new Error('BPM 区间不能重叠；上限不包含在该区间内。');
  return result;
}
export function selectMode(bpm, rules, available) {
  const ids = new Set(available.map(x => x.id));
  const row = rules.find(r => bpm >= r.min && bpm < r.max);
  if (!row) return { mode: null, reason: '此 BPM 未匹配任何区间' };
  return ids.has(row.mode) ? { mode: row.mode, rule: row } : { mode: null, reason: '匹配的样式尚未加载或已卸载' };
}
export function sanitizeSettings(raw = {}) {
  const value = { ...DEFAULTS, ...raw };
  for (const key of ['enabled', 'autoAnalyze', 'allowOnline', 'respectManual', 'restoreOnDisable']) value[key] = typeof value[key] === 'boolean' ? value[key] : DEFAULTS[key];
  for (const [key, min, max] of [['minConfidence', 0, 1], ['sampleSeconds', 20, 120], ['maxFileMiB', 16, 256]]) {
    value[key] = Number.isFinite(Number(value[key])) ? Math.max(min, Math.min(max, Number(value[key]))) : DEFAULTS[key];
  }
  return value;
}

export class StyleLease {
  constructor(adapter) { this.adapter = adapter; this.before = null; this.last = null; this.applying = false; }
  apply(mode) {
    const state = this.adapter.visualState();
    if (!this.before) this.before = { mode: state.mode, random: state.random };
    this.applying = true;
    try {
      this.adapter.setMode(mode);
      this.last = this.adapter.visualState().mode;
      if (this.last !== mode) throw new Error('播放器没有接受指定的歌词样式。');
    } finally { this.applying = false; }
  }
  restore() {
    if (this.before && this.last && this.adapter.visualState().mode === this.last) {
      this.applying = true;
      try { this.adapter.setMode(this.before.mode); this.adapter.setRandom(this.before.random); }
      finally { this.applying = false; }
    }
    this.before = null; this.last = null;
  }
  release() { this.before = null; this.last = null; }
}
