// Pure, self-contained function, also serialized into a dedicated worker.
// Spectral novelty + autocorrelation. This is an estimator, not ground truth.
export function estimateBpm(samples, sampleRate, options = {}) {
  const low = 45, high = 220, size = 512, hop = 256;
  if (!samples?.length || !(sampleRate > 0) || samples.length < sampleRate * 8) return { bpm: null, confidence: 0, reason: '可分析音频不足 8 秒' };
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  if (energy / samples.length < 1e-8) return { bpm: null, confidence: 0, reason: '静音或音量过低' };
  const window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
  const re = new Float64Array(size), im = new Float64Array(size), previous = new Float64Array(size / 2);
  const novelty = [];
  const fft = () => {
    for (let i = 1, j = 0; i < size; i++) {
      let b = size >> 1;
      for (; j & b; b >>= 1) j ^= b;
      j ^= b;
      if (i < j) { const x = re[i]; re[i] = re[j]; re[j] = x; }
    }
    for (let length = 2; length <= size; length *= 2) {
      const angle = -2 * Math.PI / length, wr = Math.cos(angle), wi = Math.sin(angle);
      for (let start = 0; start < size; start += length) {
        let ar = 1, ai = 0;
        for (let k = 0; k < length / 2; k++) {
          const a = start + k, b = a + length / 2;
          const tr = re[b] * ar - im[b] * ai, ti = re[b] * ai + im[b] * ar;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const next = ar * wr - ai * wi; ai = ar * wi + ai * wr; ar = next;
        }
      }
    }
  };
  for (let start = 0; start + size <= samples.length; start += hop) {
    for (let i = 0; i < size; i++) { re[i] = samples[start + i] * window[i]; im[i] = 0; }
    fft();
    let flux = 0;
    for (let i = 2; i < size / 2; i++) {
      const magnitude = Math.log1p(10 * Math.hypot(re[i], im[i]));
      flux += Math.max(0, magnitude - previous[i]) * (i * sampleRate / size < 250 ? 1.5 : 1);
      previous[i] = magnitude;
    }
    novelty.push(flux);
  }
  const rate = sampleRate / hop, n = novelty.length;
  // Remove local slow variations and compress big transients.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + novelty[i];
  const env = new Float64Array(n), radius = Math.ceil(rate * 0.35);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius), b = Math.min(n, i + radius + 1);
    env[i] = Math.sqrt(Math.max(0, novelty[i] - 0.7 * (prefix[b] - prefix[a]) / (b - a)));
  }
  const mean = env.reduce((a, b) => a + b, 0) / n;
  let total = 0;
  for (let i = 0; i < n; i++) { env[i] -= mean; total += env[i] ** 2; }
  if (total < 1e-6) return { bpm: null, confidence: 0, reason: '没有清晰的节奏起音' };
  const minLag = Math.floor(60 * rate / high), maxLag = Math.ceil(60 * rate / low);
  const corr = new Float64Array(maxLag + 2);
  for (let lag = Math.max(2, minLag - 1); lag <= maxLag + 1; lag++) {
    let cross = 0, a = 0, b = 0;
    for (let i = lag; i < n; i++) { cross += env[i] * env[i - lag]; a += env[i] ** 2; b += env[i - lag] ** 2; }
    corr[lag] = cross / Math.max(1e-10, Math.sqrt(a * b));
  }
  const peaks = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (corr[lag] <= corr[lag - 1] || corr[lag] < corr[lag + 1] || corr[lag] < 0.1) continue;
    const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1];
    const delta = Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / (a - 2 * b + c || 1)));
    const bpm = 60 * rate / (lag + delta);
    if (bpm >= low && bpm <= high) peaks.push({ bpm, strength: b });
  }
  if (!peaks.length) return { bpm: null, confidence: 0, reason: '未找到稳定周期' };
  peaks.sort((a, b) => b.strength - a.strength);
  const bestStrength = peaks[0].strength;
  // Prefer a faster harmonic only if it is nearly as periodic, never invent
  // a doubled tempo which has no autocorrelation peak of its own.
  const strong = peaks.filter(x => x.strength >= bestStrength * 0.88 && x.bpm >= 65 && x.bpm <= 200);
  let best = strong.length ? strong.sort((a, b) => b.bpm - a.bpm)[0] : peaks[0];
  // Periodic click trains can correlate more strongly at every second/third
  // beat because that delay happens to land exactly on a hop. When the actual
  // onset intervals are very regular, use them to resolve that discretization
  // artifact, while still requiring an independently supported correlation peak.
  const median = values => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
  const threshold = Math.sqrt(total / n) * 0.65, onsets = [];
  for (let i = 1; i + 1 < n; i++) {
    if (env[i] < threshold || env[i] <= env[i - 1] || env[i] < env[i + 1]) continue;
    const previousIndex = onsets.at(-1);
    if (previousIndex !== undefined && i - previousIndex < rate * 0.18) {
      if (env[i] > env[previousIndex]) onsets[onsets.length - 1] = i;
    } else onsets.push(i);
  }
  const gaps = onsets.slice(1).map((v, i) => v - onsets[i]);
  if (gaps.length >= 8) {
    const typical = median(gaps), spread = median(gaps.map(x => Math.abs(x - typical))) / typical;
    const regularGaps = gaps.filter(x => x >= typical * 0.75 && x <= typical * 1.25);
    const averageGap = regularGaps.reduce((a, b) => a + b, 0) / regularGaps.length;
    const intervalBpm = 60 * rate / averageGap;
    const supported = peaks.filter(p => Math.abs(p.bpm - intervalBpm) / intervalBpm < 0.06).sort((a, b) => b.strength - a.strength)[0];
    if (spread < 0.12 && supported && supported.strength > 0.45) best = { ...supported, bpm: intervalBpm };
  }
  const rival = peaks.find(x => Math.abs(x.bpm - best.bpm) / best.bpm > 0.08
    && Math.abs(x.bpm * 2 - best.bpm) / best.bpm > 0.08 && Math.abs(x.bpm / 2 - best.bpm) / best.bpm > 0.08);
  const contrast = rival ? Math.max(0, best.strength - rival.strength) : best.strength;
  const confidence = Math.min(1, Math.max(0, best.strength * 0.8 + Math.min(0.2, contrast)));
  return { bpm: Math.round(best.bpm * 10) / 10, confidence: Math.round(confidence * 100) / 100,
    seconds: samples.length / sampleRate, reason: '频谱起音估算；可能存在半拍或倍拍歧义',
    alternatives: peaks.slice(0, 4).map(x => Math.round(x.bpm * 10) / 10) };
}
