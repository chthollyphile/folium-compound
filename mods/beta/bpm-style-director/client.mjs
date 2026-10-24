import { DEFAULTS } from './rules.mjs';
import { createHost, nativeBpm } from './host.mjs';
import { analyzeContext } from './analyze.mjs';
import { Director } from './engine.mjs';
import { mountPanel } from './panel.mjs';

const label = text => ({ 'zh-CN': text, en: text });
export function settingsSchema(modes) {
  return [
    ...['enabled', 'autoAnalyze', 'allowOnline', 'respectManual', 'restoreOnDisable'].map(key => ({ key, type: 'boolean', label: label(key), defaultValue: DEFAULTS[key] })),
    ...[['minConfidence', 0, 1, 0.05], ['sampleSeconds', 20, 120, 10], ['maxFileMiB', 16, 256, 16]].map(([key, min, max, step]) => ({ key, type: 'number', label: label(key), min, max, step, defaultValue: DEFAULTS[key] })),
    // The custom panel owns the live select list. A text schema also accepts
    // styles supplied by another mod which loads after this entry activates.
    { key: 'unknownMode', type: 'text', label: label('未知 BPM 时'), defaultValue: 'keep' },
    { key: 'rulesJson', type: 'text', label: label('BPM 区间'), defaultValue: DEFAULTS.rulesJson },
  ];
}

export default async function activate(folium) {
  if (folium.env.context !== 'main') return;
  const host = createHost(folium);
  let engine, disposed = false, timer;
  const mount = container => engine ? mountPanel(container, { engine, settings, host }) : undefined;
  const section = folium.registries.settingsSections.register({
    id: 'director', label: label('BPM 歌词样式导演'),
    description: label('按速度配置歌词动画；估算和校正都在本地完成。'),
    settings: settingsSchema(host.modes()), settingsPanel: mount,
  });
  const settings = section.settings;
  if (typeof settings?.get !== 'function' || typeof settings?.set !== 'function' || typeof settings?.onChange !== 'function') {
    throw new Error('宿主没有提供新版 settings / onChange 设置接口，请确认 Folia 版本。');
  }
  engine = new Director({ host, settings, storage: folium.storage, nativeBpm, analyze: analyzeContext });
  const off = [];
  const stop = () => {
    if (disposed) return; disposed = true; clearTimeout(timer); off.forEach(fn => fn()); engine.dispose();
  };
  folium.onDispose(stop);
  await engine.load();
  if (disposed) return stop;
  const schedule = () => {
    clearTimeout(timer); timer = setTimeout(() => {
      if (!disposed) engine.refresh().catch(error => folium.log.warn(error.message));
    }, 220);
  };
  let playbackFingerprint = '';
  off.push(host.onPlayback(() => {
    const current = host.context();
    const key = `${current?.key || ''}\0${current?.audioUrl || ''}\0${current?.showingTail || false}`;
    if (key !== playbackFingerprint) { playbackFingerprint = key; schedule(); }
  }));
  off.push(host.onMode(state => engine.onMode(state)));
  off.push(settings.onChange(() => { engine.refresh({ force: true }).catch(error => folium.log.warn(error.message)); }));
  off.push(folium.events.on('playback.songChanged', schedule));
  folium.registries.homeTabs.register({ id: 'director', label: label('BPM 导演'), order: 350, mount });
  folium.registries.playerPanelTabs.register({ id: 'director', label: label('BPM 导演'), mount });
  folium.registries.commands.register({ id: 'settings', label: label('BPM 导演：打开设置'), keywords: ['bpm', '节拍', '歌词', '样式', '自动'], run: () => folium.ui.openHomeTab('director') });
  folium.registries.commands.register({ id: 'apply', label: label('BPM 导演：立即应用当前歌曲'), keywords: ['bpm', '样式'], run: async () => { await engine.refresh({ force: true }); return { message: engine.state().message || engine.state().phase }; } });
  folium.registries.commands.register({ id: 'detect', label: label('BPM 导演：重新检测当前歌曲'), keywords: ['bpm', '检测'], run: async () => { await engine.refresh({ force: true, reanalyze: true }); return { message: engine.state().message || engine.state().phase }; } });
  schedule();
  return stop;
}
