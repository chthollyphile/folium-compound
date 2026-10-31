// client 入口：静态导入 UI 包，注册标签页和音频监听层。
//
// 这里**只加载签名范围内的代码**：`./ui.bundle.mjs` 是构建产物，随模组一起签名。
// 早先的版本会优先读 mods-cache 里的副本、用 blob: URL 动态 import、每 2 秒轮询 ——
// 那样等于让「审查过的那份」和「实际跑的那份」可以不一致，任何能写缓存目录的程序
// 都能在 Folia 主窗口注入代码且不触发重新确认。已按要求全部去掉：不再有 rpc、
// 不再有 blob import、不再有轮询，main 入口也就不需要了。

import { mount as mountFx, feed, reset, autoTick } from './ui.bundle.mjs';

/** @param {any} folium */
export default function activate(folium) {
  /** 每个挂载点各自的界面实例，dispose 时统一清掉。 */
  const views = new Set();

  const mountView = (container, ctx) => {
    container.innerHTML = '';
    const host = document.createElement('div');
    host.style.cssText = 'height:100%;display:flex;flex-direction:column;min-height:0';
    container.appendChild(host);

    const rec = { dispose: null };
    views.add(rec);

    try {
      const dispose = mountFx(host, ctx, folium);
      rec.dispose = typeof dispose === 'function' ? dispose : null;
    } catch (error) {
      host.innerHTML = `<div style="padding:16px;color:#fca5a5;font:12px system-ui">UI 出错：${String(
        (error && error.message) || error
      )}</div>`;
    }

    return () => {
      try {
        rec.dispose?.();
      } catch {}
      views.delete(rec);
      container.innerHTML = '';
    };
  };

  /*
   * stageLayer：把宿主频谱喂给 UI，并在面板关闭时继续驱动 EQ 写入。
   * 曲线计算与写入放在这里而不是界面里 —— 标签页是「打开才挂载」的，
   * 逻辑挂在界面上就等于「不打开面板模组不工作」。
   */
  folium.registries.stageLayers.register({
    id: 'analyzer',
    slot: 'player.stage.back',
    interactive: false,
    mount(container, ctx) {
      if (!ctx.audio) return;
      ctx.onFrame(() => {
        try {
          feed(ctx.audio.getBands(), ctx.audio.getPower());
          autoTick(folium);
        } catch {}
      });
      return () => {
        try {
          reset();
        } catch {}
      };
    },
  });

  const mount = (container, ctx) => mountView(container, ctx);

  folium.registries.homeTabs.register({
    id: 'fx',
    label: { 'zh-CN': 'AI 情绪调音', en: 'AI Emo FX' },
    order: 330,
    mount,
  });
  folium.registries.playerPanelTabs.register({
    id: 'fx',
    label: { 'zh-CN': 'AI 情绪调音', en: 'AI Emo FX' },
    mount,
  });

  const stop = () => {
    for (const view of [...views]) {
      try {
        view.dispose?.();
      } catch {}
    }
    views.clear();
  };
  folium.onDispose?.(stop);
  folium.log?.info?.('[emofx] ready');
  return stop;
}
