import { sanitizeSettings, parseRules, selectMode, validBpm, StyleLease } from './rules.mjs';

export class Director {
  constructor({ host, settings, storage, nativeBpm, analyze, clock = Date.now }) {
    Object.assign(this, { host, settings, storage, nativeBpm, analyze, clock });
    this.lease = new StyleLease(host); this.memory = {}; this.listeners = new Set();
    this.sequence = 0; this.queue = Promise.resolve(); this.currentKey = null;
    this.manualHold = false; this.disposed = false; this.snapshot = { phase: '等待歌曲', result: null, context: null, message: '' };
    this.lastFingerprint = null; this.saveQueue = Promise.resolve();
  }
  async load() {
    const saved = await this.storage.get('bpm-memory-v1').catch(() => null);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, record] of Object.entries(saved).slice(0, 500)) {
        if (key.length < 1024 && record && (validBpm(record.bpm) || validBpm(record.manualBpm))) this.memory[key] = record;
      }
    }
  }
  config() { return sanitizeSettings(this.settings.get()); }
  notify(patch = {}) {
    Object.assign(this.snapshot, patch);
    for (const fn of this.listeners) { try { fn(this.state()); } catch { /* One settings view must not stop playback automation. */ } }
  }
  state() { return { ...this.snapshot, manualBpm: this.memory[this.currentKey]?.manualBpm ?? null, manualHold: this.manualHold, settings: this.config(), modes: this.host.modes() }; }
  subscribe(fn) { this.listeners.add(fn); fn(this.state()); return () => this.listeners.delete(fn); }
  onMode(state) {
    if (this.lease.applying || this.disposed || !this.config().enabled || !this.currentKey) return;
    if (this.config().respectManual && this.lease.last && (state.mode !== this.lease.last || state.random)) {
      this.currentKey = this.host.context()?.key || this.currentKey;
      this.manualHold = true;
      this.lease.release();
      this.controller?.abort();
      this.notify({ phase: '本曲由你手动控制', message: '切到下一首后恢复自动；也可以点击“立即应用”。' });
    }
  }
  remember(key, record) {
    this.memory[key] = { ...this.memory[key], ...record, touched: this.clock() };
    const records = Object.entries(this.memory).sort((a, b) => Number(b[1].touched || 0) - Number(a[1].touched || 0));
    this.memory = Object.fromEntries(records.slice(0, 500));
    // Capture each snapshot and serialize writes so a slower earlier save can
    // never erase a later manual correction.
    const copy = JSON.parse(JSON.stringify(this.memory));
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.storage.set('bpm-memory-v1', copy)).catch(error => this.notify({ message: 'BPM 记忆保存失败：' + error.message }));
    return this.saveQueue;
  }
  async setManual(value) {
    const context = this.host.context();
    if (!context) throw new Error('请先播放一首歌曲。');
    if (value !== null && !validBpm(value)) throw new Error('请输入 30–360 之间的 BPM。');
    await this.remember(context.key, { manualBpm: value === null ? null : Number(value) });
    return this.refresh({ force: true });
  }
  async clearMemory() {
    for (const key of Object.keys(this.memory)) if (!validBpm(this.memory[key].manualBpm)) delete this.memory[key];
    const copy = JSON.parse(JSON.stringify(this.memory));
    this.saveQueue = this.saveQueue.catch(() => {}).then(() => this.storage.set('bpm-memory-v1', copy));
    await this.saveQueue;
    this.notify({ message: '已清理自动检测记忆，手动校正保留。' });
  }
  refresh({ force = false, reanalyze = false } = {}) {
    if (this.disposed) return Promise.resolve();
    const token = ++this.sequence;
    this.controller?.abort();
    this.queue = this.queue.catch(() => {}).then(async () => {
      if (this.disposed || token !== this.sequence) return;
      const context = this.host.context(), config = this.config();
      if (context?.key !== this.currentKey) {
        this.currentKey = context?.key || null; this.manualHold = false; this.lastFingerprint = null;
        this.snapshot.result = null; this.snapshot.message = ''; this.snapshot.phase = context ? '准备读取 BPM' : '等待歌曲';
      }
      this.notify({ context });
      if (!config.enabled) { this.lease.restore(); return this.notify({ phase: '自动切换已关闭', message: '' }); }
      if (!context) return this.notify({ phase: '等待歌曲', result: null, message: '' });
      if (force) this.manualHold = false;
      if (!config.respectManual) this.manualHold = false;
      if (this.manualHold && config.respectManual) return;
      const controller = new AbortController(); this.controller = controller;
      const live = () => !this.disposed && token === this.sequence && !controller.signal.aborted && this.host.context()?.key === context.key;
      const stored = this.memory[context.key];
      let result = validBpm(stored?.manualBpm) ? { bpm: Number(stored.manualBpm), source: '手动校正', confidence: null } : null;
      try {
        if (!result && !reanalyze) result = await this.nativeBpm(context).catch(() => null);
        if (!result && !reanalyze && stored?.algorithm === 1 && validBpm(stored.bpm)) result = { bpm: stored.bpm, confidence: stored.confidence, source: stored.source, cached: true };
        if (!live()) return;
        if (!result && config.autoAnalyze) {
          this.notify({ phase: '准备检测 BPM', result: null, message: '' });
          result = await this.analyze(context, config, controller.signal, phase => { if (live()) this.notify({ phase }); });
        }
        if (!live()) return;
        if (!result || !validBpm(result.bpm)) return this.unknown(result?.reason || '没有可用的 BPM；可开启检测或手动填写。');
        if (result.source !== '手动校正' && !result.cached) await this.remember(context.key, { bpm: Number(result.bpm), confidence: result.confidence ?? null, source: result.source, algorithm: 1 });
        if (!live()) return;
        this.notify({ result });
        if (result.confidence !== null && result.confidence < config.minConfidence) return this.unknown('检测置信度不足；请校正 BPM，或调整置信度门槛。', result);
        const rules = parseRules(config.rulesJson, this.host.modes());
        const choice = selectMode(Number(result.bpm), rules, this.host.modes());
        if (!choice.mode) return this.notify({ phase: '保留当前样式', message: choice.reason });
        if (!live() || this.manualHold) return;
        this.lease.apply(choice.mode);
        this.notify({ phase: '已按 BPM 自动选择', message: `${choice.rule.min} ≤ BPM < ${choice.rule.max} → ${this.host.modes().find(x => x.id === choice.mode)?.label || choice.mode}`, result });
      } catch (error) {
        if (live() && error.name !== 'AbortError') this.unknown(error.message);
      }
    });
    return this.queue;
  }
  unknown(message, result = null) {
    const mode = this.config().unknownMode;
    if (!this.manualHold && mode !== 'keep' && this.host.modes().some(x => x.id === mode)) this.lease.apply(mode);
    this.notify({ phase: '等待 BPM 或手动校正', message, result });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; ++this.sequence; this.controller?.abort();
    if (this.config().restoreOnDisable) this.lease.restore();
    this.listeners.clear();
  }
}
