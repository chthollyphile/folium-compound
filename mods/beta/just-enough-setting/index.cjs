/*
 * main 入口：Steam 状态。
 *
 * 这一层是跑在 Electron 主进程里的 Node，所以能 require npm 包、能开长连接 ——
 * 渲染侧做不到的正是这两件事（`window.electron` 是 contextBridge 暴露的只读桥，
 * 模组没法从渲染进程改写它）。
 *
 * 真正的 Steam 协议实现在 `steam/vendor.cjs`（esbuild 产物，源码是 `steam/connector.mjs`）。
 * 这里只做三件事：把连接器挂到宿主给的生命周期上、把它的能力暴露成 RPC、以及在
 * 依赖缺失时降级成"功能不可用"而不是让整个模组挂掉。
 */

'use strict';

const path = require('node:path');

/** 连接器缺失时的统一答复：形状与 connector.status() 一致，面板不用分支处理。 */
const createUnavailableStatus = (reason) => ({
  available: false,
  reason: String(reason || 'unknown'),
  state: 'error',
  accountName: '',
  steamId: '',
  personaName: '',
  guardDomain: null,
  guardWrong: false,
  playing: '',
  pending: '',
  online: false,
  needsGuard: false,
  lastError: 'steam-dependency-missing',
  lastErrorCode: null,
  lastErrorName: null,
  updatedAt: Date.now(),
  onlineSince: 0,
  maxLength: 128,
});

module.exports = function activate(api) {
  const log = api.log;
  let connector = null;
  let loadFailure = '';
  let restored = false;

  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const vendor = require(path.join(__dirname, 'steam', 'vendor.cjs'));
    const factory = vendor.createSteamConnector || vendor.default;
    if (typeof factory !== 'function') {
      throw new Error('steam vendor does not export createSteamConnector');
    }
    // `api.storage` 是宿主给这个模组的数据文件（需要 filesystem.data 权限）；
    // Folium 1.5 把它放在 `api.storage.data` 下面，Folium 2 起只有 api.storage 本身。
    // 权限没给时退回"这次会话里有效"的凭据。
    const storage = api.storage ?? null;
    connector = factory({ storage, log });
  } catch (error) {
    loadFailure = error?.message || String(error);
    log?.error?.('the Steam connector could not be loaded', error);
  }

  const unavailable = () => createUnavailableStatus(loadFailure);
  const call = (method, ...args) => {
    if (!connector) return unavailable();
    try {
      return connector[method](...args);
    } catch (error) {
      log?.error?.(`steam connector ${method} failed`, error);
      return { ok: false, error: { message: error?.message || String(error) } };
    }
  };

  // 名字要匹配宿主校验的 /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/ —— 冒号不在允许集合里，
  // 写成 `steam:status` 会在 activate 这一行直接抛错（整个 main 入口跟着废掉）。
  api.rpc.handle('steam.status', () => (connector ? connector.status() : unavailable()));
  api.rpc.handle('steam.publish', (text) => call('publish', text));

  // 只有在渲染侧真的用这个功能时才登录：装了模组但只想要 SMTC / 网页标题的人，
  // 不该因为启用了模组就被动连上 Steam。
  api.rpc.handle('steam.restore', async () => {
    if (!connector) return unavailable();
    if (restored) return connector.status();
    restored = true;
    await connector.restore();
    return connector.status();
  });

  api.rpc.handle('steam.login', async (details) => {
    if (!connector) return unavailable();
    restored = true;
    const result = await connector.login(details || {});
    return { ...result, status: connector.status() };
  });

  api.rpc.handle('steam.guard', (code) => {
    if (!connector) return unavailable();
    const result = connector.submitGuard(code);
    return { ...result, status: connector.status() };
  });

  api.rpc.handle('steam.logout', () => {
    if (!connector) return unavailable();
    return { ...call('logout'), status: connector.status() };
  });

  api.rpc.handle('steam.forget', async () => {
    if (!connector) return unavailable();
    await connector.forget();
    restored = false;
    return { ok: true, status: connector.status() };
  });

  // 停用时把长连接关掉。`api.onDispose` 与 activate 返回的函数都会走到这里（宿主两条都认），
  // 所以用一次性开关兜住，别让 connector.dispose 跑第二遍。
  // （Folium 1.5 把这一步叫 `api.lifecycle.onDeactivate`，Folium 2 起没有这个名字了。）
  let disposed = false;
  const shutdown = () => {
    if (disposed) return;
    disposed = true;
    try {
      connector?.dispose();
    } catch (error) {
      log?.warn?.('could not shut the Steam connector down', error);
    }
  };

  if (typeof api.onDispose === 'function') api.onDispose(shutdown);

  return shutdown;
};
