import { estimateBpm } from './estimator.mjs';

const abortError = () => new DOMException('已取消', 'AbortError');
export function runEstimator(samples, rate, signal, WorkerType = globalThis.Worker) {
  if (signal?.aborted) return Promise.reject(abortError());
  if (!WorkerType) return Promise.reject(new Error('当前环境不能创建 BPM 分析线程，可手动填写 BPM。'));
  const source = `const estimate = (${estimateBpm.toString()}); self.onmessage = e => { try { self.postMessage({result:estimate(e.data.samples,e.data.rate)}); } catch(e) { self.postMessage({error:String(e.message||e)}); } };`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  return new Promise((resolve, reject) => {
    let worker, done = false;
    const finish = (error, result) => {
      if (done) return; done = true; clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel); worker?.terminate(); URL.revokeObjectURL(url);
      error ? reject(error) : resolve(result);
    };
    const cancel = () => finish(abortError());
    const timeout = setTimeout(() => finish(new Error('BPM 分析超时，可手动填写 BPM。')), 30000);
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      worker = new WorkerType(url);
      worker.onmessage = e => e.data.error ? finish(new Error(e.data.error)) : finish(null, e.data.result);
      worker.onerror = e => finish(new Error(e.message || 'BPM 分析线程不可用'));
      worker.postMessage({ samples, rate }, [samples.buffer]);
    } catch (error) { finish(error); }
  });
}

export async function readBounded(url, limit, signal, fetcher = fetch) {
  const response = await fetcher(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`音频读取失败（${response.status}）`);
  if (Number(response.headers.get('content-length') || 0) > limit) { await response.body?.cancel(); throw new Error('音频超过设置的分析大小上限。'); }
  if (!response.body?.getReader) throw new Error('当前音源不支持受限读取，可手动填写 BPM。');
  const reader = response.body.getReader(), chunks = [];
  let total = 0;
  try {
    while (true) {
      if (signal?.aborted) throw abortError();
      const { done, value } = await reader.read(); if (done) break;
      total += value.length;
      if (total > limit) throw new Error('音频超过设置的分析大小上限。');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes.buffer;
}

export async function analyzeContext(context, settings, signal, progress = () => {}) {
  const url = context.audioUrl;
  if (!url) throw new Error(context.showingTail ? '正在切歌，等待新歌曲接管后分析。' : '等待播放器准备音频。');
  const local = context.source === 'local' || /^(blob:|folia-[a-z-]+:)/i.test(url);
  if (!local && !settings.allowOnline) throw new Error('在线播放分析未开启；可复用 Folia 缓存或手动填写 BPM。');
  progress('读取音频');
  const bytes = await readBounded(url, settings.maxFileMiB * 1024 * 1024, signal);
  if (signal.aborted) throw abortError();
  progress('解码音频');
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error('当前环境没有音频分析接口，可手动填写 BPM。');
  let buffer;
  try { buffer = await new Offline(1, 1, 11025).decodeAudioData(bytes); }
  catch { throw new Error('该音源暂时不能用于 BPM 解码；可等待无损转换后重试，或手动填写 BPM。'); }
  if (signal.aborted) throw abortError();
  const rate = buffer.sampleRate;
  const seconds = Math.min(settings.sampleSeconds, buffer.duration);
  const start = Math.floor(Math.min(10, Math.max(0, (buffer.duration - seconds) / 2)) * rate);
  const count = Math.min(buffer.length - start, Math.floor(seconds * rate));
  const mono = new Float32Array(count);
  for (let channel = 0; channel < Math.min(buffer.numberOfChannels, 2); channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < count; i++) mono[i] += data[start + i] / Math.min(buffer.numberOfChannels, 2);
  }
  buffer = null;
  progress('估算 BPM');
  return { ...await runEstimator(mono, rate, signal), source: '本地音频估算' };
}
