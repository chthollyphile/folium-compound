/*
 * client 侧的 Steam 桥。
 *
 * 宿主给模组的 rpc 是**单向**的（只有 client → main 这一条路），main 没法主动把连接状态
 * 推回渲染侧，所以这里靠轮询拿状态：不在线时慢慢问，在线时也还是同一个节奏 —— 一次调用
 * 只是主进程里读一遍内存，很便宜。
 *
 * 这里同时兼着去重：编排每变一次都会走到 publish，但真正需要发 rpc 的只有文本真的变了的时候。
 * 再往下（main 侧）还有一层更严的去重，因为 Steam 官方文档说丰富状态更新约 1Hz。
 */

/** 轮询间隔。 */
const POLL_INTERVAL_MS = 2500;

export const createSteamBridge = ({ folium, log = null }) => {
  const listeners = new Set();
  let status = null;
  let timer = null;
  let inFlight = false;
  let wanted = '';
  let applied = '';
  let disposed = false;

  const call = async (name, ...args) => {
    if (disposed) return null;
    if (!folium?.rpc?.call) return null;
    try {
      return await folium.rpc.call(name, ...args);
    } catch (error) {
      // rpc 失败（连接器没打包进来、main 入口没加载）不该让面板炸掉，只是拿不到状态。
      log?.warn?.(`steam rpc ${name} failed`, error);
      return null;
    }
  };

  const snapshot = () => ({
    status,
    wanted,
    applied,
    available: status ? status.available !== false : true,
  });

  const emit = () => {
    if (disposed) return;
    const value = snapshot();
    listeners.forEach((listener) => {
      try {
        listener(value);
      } catch (error) {
        log?.warn?.('a steam listener threw', error);
      }
    });
  };

  const refresh = async () => {
    if (disposed || inFlight) return null;
    inFlight = true;
    try {
      const next = await call('steam.status');
      if (next && !disposed) {
        status = next;
        emit();
      }
      return next;
    } finally {
      inFlight = false;
    }
  };

  /** 把期望文本交给 main。文本没变就不发。 */
  const flush = async () => {
    if (disposed) return null;
    const text = wanted;
    const result = await call('steam.publish', text);
    if (result && result.ok) applied = text;
    return result;
  };

  return {
    getSnapshot: snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** 编排结果 → 期望的「正在玩」文本。空字符串表示清掉这个状态。 */
    publish(text) {
      const next = String(text ?? '');
      if (next === wanted) return;
      wanted = next;
      void flush();
    },

    async restore() {
      const result = await call('steam.restore');
      await refresh();
      return result;
    },

    async login(details) {
      const result = await call('steam.login', details);
      await refresh();
      return result;
    },

    async submitGuard(code) {
      const result = await call('steam.guard', code);
      await refresh();
      return result;
    },

    async logout() {
      const result = await call('steam.logout');
      await refresh();
      return result;
    },

    async forget() {
      const result = await call('steam.forget');
      wanted = '';
      applied = '';
      await refresh();
      return result;
    },

    /** 开始轮询。只在用户真的打开了这一项时调用。 */
    start() {
      if (disposed || timer !== null) return;
      void refresh();
      timer = setInterval(() => {
        void refresh();
      }, POLL_INTERVAL_MS);
    },

    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    dispose() {
      disposed = true;
      this.stop();
      listeners.clear();
    },
  };
};

export default createSteamBridge;
