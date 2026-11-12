/*
 * Steam 连接器（源码）。
 *
 * 这个文件依赖 npm 包 `steam-user`，所以**不能**被宿主直接加载：模组运行时用的是
 * `steam/vendor.cjs` —— 由 `dev/folium/steam-bundle/build.mjs` 用 esbuild 把本文件
 * 与 steam-user 及其依赖打成的单文件。改完这里必须重新打包，否则运行时还是旧代码。
 *
 * 为什么要打包而不是直接带 node_modules：宿主用 `computeModDigest` 给模组目录算内容
 * 摘要，上限是 2000 个文件 / 64MB，超了就判为「无法校验」，模组永远无法启用。而
 * steam-user 的依赖树是 54 个包、3989 个文件、45MB。打包后是 1 个约 8MB 的文件。
 *
 * 参考实现：https://github.com/Yanxxxi/yySync-NCM（SteamKit2 走同一条路：登录 Steam
 * 账号，把状态报成"非 Steam 游戏"）。这里用 Node 侧的等价物 steam-user。
 */

import SteamUser from 'steam-user';

/**
 * Steam 的 `game_extra_info` 上限是 256 字符，但客户端在好友列表里只留一行，
 * 再长会被截断。128 是显示得下、又不会让服务端觉得异常的长度。
 */
export const MAX_PLAYING_LENGTH = 128;

/**
 * Steam 官方文档：丰富状态更新约 1Hz。留出余量再合并一次，避免连续切歌把请求打满。
 */
const MIN_PUBLISH_INTERVAL_MS = 1200;

/** 等用户填 Steam Guard 验证码的最长时间；超时就放弃这次登录，避免回调悬着。 */
const GUARD_TIMEOUT_MS = 5 * 60 * 1000;

const STORAGE_KEYS = Object.freeze({
  token: 'steam.refreshToken',
  account: 'steam.accountName',
});

/** 登录态。client 侧按这套字符串决定面板上显示什么。 */
export const STEAM_STATES = Object.freeze({
  idle: 'idle',
  connecting: 'connecting',
  guard: 'guard',
  online: 'online',
  error: 'error',
});

/** 内存兜底：没有 filesystem.data 权限时（或 storage 不可用），凭据只活在本次会话里。 */
const createMemoryStorage = () => {
  const map = new Map();
  return {
    get: async (key) => (map.has(key) ? map.get(key) : null),
    set: async (key, value) => {
      map.set(key, value);
    },
    has: async (key) => map.has(key),
    delete: async (key) => {
      map.delete(key);
    },
    keys: async () => [...map.keys()],
  };
};

/** 从 Steam 的 EResult 数字反查枚举名，方便把「5」这种裸数字翻译成人能读的东西。 */
const eresultName = (code) => {
  if (!Number.isFinite(code)) return null;
  const entry = Object.entries(SteamUser.EResult || {}).find(([, value]) => value === code);
  return entry ? entry[0] : null;
};

/**
 * 把 steam-user 抛出来的东西归一成 `{ code, message, name }`。`code` 是 EResult 数字，
 * 面板按它选本地化文案；`message` 是兜底原文。
 */
const describeError = (error) => {
  if (!error) return { code: null, name: null, message: '' };
  if (typeof error === 'string') return { code: null, name: null, message: error };
  const code = Number.isFinite(error.eresult) ? error.eresult : null;
  return {
    code,
    name: eresultName(code),
    message: String(error.message || error),
  };
};

/**
 * 创建一个 Steam 连接器。
 *
 * @param {object} options
 * @param {object} [options.storage] `api.storage`：异步的 get/set/has/delete/keys
 * @param {object} [options.log] `api.log`：info / warn / error
 */
export const createSteamConnector = ({ storage, log = null } = {}) => {
  const store = storage ?? createMemoryStorage();
  const logInfo = (message, ...rest) => log?.info?.(message, ...rest);
  const logWarn = (message, ...rest) => log?.warn?.(message, ...rest);
  const logError = (message, ...rest) => log?.error?.(message, ...rest);

  let client = null;
  let disposed = false;
  let guardCallback = null;
  let guardTimer = null;
  let publishTimer = null;
  let lastPublishAt = 0;

  const state = {
    available: true,
    reason: '',
    state: STEAM_STATES.idle,
    accountName: '',
    steamId: '',
    personaName: '',
    guardDomain: null,
    guardWrong: false,
    playing: '',
    pending: '',
    lastError: null,
    lastErrorCode: null,
    lastErrorName: null,
    updatedAt: Date.now(),
    onlineSince: 0,
  };

  const touch = () => {
    state.updatedAt = Date.now();
  };

  const setError = (error, fallbackMessage) => {
    const described = describeError(error);
    state.state = STEAM_STATES.error;
    state.lastError = described.message || fallbackMessage || 'unknown';
    state.lastErrorCode = described.code;
    state.lastErrorName = described.name;
    state.onlineSince = 0;
    touch();
    return described;
  };

  const clearError = () => {
    state.lastError = null;
    state.lastErrorCode = null;
    state.lastErrorName = null;
  };

  const clearGuard = () => {
    guardCallback = null;
    state.guardDomain = null;
    state.guardWrong = false;
    if (guardTimer !== null) {
      clearTimeout(guardTimer);
      guardTimer = null;
    }
  };

  /** 把当前期望的文本发给 Steam。空文本用空数组清掉"正在玩"。 */
  const flushPlaying = () => {
    publishTimer = null;
    if (disposed || !client || state.state !== STEAM_STATES.online) return;

    const text = String(state.pending ?? '').slice(0, MAX_PLAYING_LENGTH);
    lastPublishAt = Date.now();
    try {
      // 传字符串时 steam-user 会套上固定那个非 Steam 游戏 ID，只有显示名变，
      // 所以歌名来回换不会被 Steam 当成"换了一个游戏"。
      client.gamesPlayed(text ? [text] : []);
      state.playing = text;
      logInfo('steam playing →', text || '(cleared)');
    } catch (error) {
      setError(error, 'games-played-failed');
      logWarn('could not report the Steam playing state', error);
      return;
    }
    touch();
  };

  /**
   * 期望文本变了才推，且两次实际发送之间至少隔 MIN_PUBLISH_INTERVAL_MS：
   * Steam 的丰富状态本来就是约 1Hz 的速率，连续切歌没必要每条都发。
   */
  const publish = (text) => {
    const next = String(text ?? '').slice(0, MAX_PLAYING_LENGTH);
    state.pending = next;
    touch();
    if (state.state !== STEAM_STATES.online) return { ok: true, applied: false };

    if (next === state.playing && publishTimer === null) {
      return { ok: true, applied: true };
    }

    const elapsed = Date.now() - lastPublishAt;
    if (publishTimer !== null) {
      clearTimeout(publishTimer);
    }
    if (elapsed >= MIN_PUBLISH_INTERVAL_MS) {
      flushPlaying();
    } else {
      publishTimer = setTimeout(flushPlaying, MIN_PUBLISH_INTERVAL_MS - elapsed);
    }
    return { ok: true, applied: false };
  };

  const detachClient = () => {
    if (!client) return;
    try {
      client.removeAllListeners();
      client.logOff();
    } catch (error) {
      logWarn('could not close the Steam session', error);
    }
    client = null;
  };

  const attachClient = () => {
    client = new SteamUser({
      // 断线后自己重连；致命错误才会走到 'error'。
      autoRelogin: true,
      // 默认会往 %localappdata%\doctormckay\node-steamuser 写服务器列表和 machine auth
      // token。模组不在用户目录里散布文件，所以关掉：主登录靠下面存下来的刷新令牌，
      // machine auth token 只是省掉"邮箱验证码"那一步，我们不需要。
      dataDirectory: null,
    });

    client.on('loggedOn', () => {
      if (disposed) return;
      clearGuard();
      clearError();
      state.state = STEAM_STATES.online;
      state.steamId = client.steamID ? client.steamID.getSteamID64() : '';
      state.onlineSince = Date.now();
      touch();
      logInfo('logged in to Steam as', state.steamId);

      try {
        client.setPersona(SteamUser.EPersonaState.Online);
      } catch (error) {
        logWarn('could not set the Steam persona', error);
      }

      // 昵称只是给面板看的，拿不到就算了。
      try {
        client.getPersonas([client.steamID], (error, personas) => {
          if (disposed || error) return;
          const self = personas?.[client.steamID.getSteamID64()];
          if (self?.player_name) {
            state.personaName = String(self.player_name);
            touch();
          }
        });
      } catch (error) {
        logWarn('could not read the Steam persona name', error);
      }

      // 登录前攒下的期望文本在这里补发（切歌总是发生在断线重连之前）。
      state.playing = '';
      publish(state.pending);
    });

    client.on('refreshToken', async (token) => {
      try {
        await store.set(STORAGE_KEYS.token, token);
        logInfo('stored a new Steam refresh token');
      } catch (error) {
        logWarn('could not store the Steam refresh token', error);
      }
    });

    client.on('steamGuard', (domain, callback, lastCodeWrong) => {
      if (disposed) return;
      state.state = STEAM_STATES.guard;
      state.guardDomain = domain || null;
      state.guardWrong = Boolean(lastCodeWrong);
      guardCallback = callback;
      touch();
      if (guardTimer !== null) clearTimeout(guardTimer);
      // 用户一直不填的话，把这次登录放掉，别让回调永远悬着。
      guardTimer = setTimeout(() => {
        guardTimer = null;
        if (guardCallback !== callback) return;
        guardCallback = null;
        state.state = STEAM_STATES.error;
        state.lastError = 'steam-guard-timeout';
        state.lastErrorCode = null;
        state.lastErrorName = null;
        touch();
        detachClient();
      }, GUARD_TIMEOUT_MS);
      logInfo('Steam Guard code required', domain ? 'from email' : 'two-factor');
    });

    client.on('disconnected', (eresult, msg) => {
      if (disposed) return;
      state.state = STEAM_STATES.connecting;
      state.onlineSince = 0;
      state.steamId = '';
      state.personaName = '';
      touch();
      logWarn('disconnected from Steam', eresult, msg);
    });

    // 不绑这个事件的话，登录出错会直接把主进程带崩。
    client.on('error', (error) => {
      if (disposed) return;
      const described = setError(error, 'steam-error');
      logError('Steam error', described.name || described.code || described.message);
    });
  };

  const logOn = (details) => {
    attachClient();
    state.state = STEAM_STATES.connecting;
    state.guardDomain = null;
    state.guardWrong = false;
    clearError();
    touch();
    try {
      client.logOn(details);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: setError(error, 'steam-logon-threw') };
    }
  };

  return {
    /** 同步快照，给 RPC 直接返回（JSON 可序列化）。 */
    status() {
      return {
        available: state.available,
        reason: state.reason,
        state: state.state,
        accountName: state.accountName,
        steamId: state.steamId,
        personaName: state.personaName,
        guardDomain: state.guardDomain,
        guardWrong: state.guardWrong,
        playing: state.playing,
        pending: state.pending,
        online: state.state === STEAM_STATES.online,
        needsGuard: state.state === STEAM_STATES.guard,
        lastError: state.lastError,
        lastErrorCode: state.lastErrorCode,
        lastErrorName: state.lastErrorName,
        updatedAt: state.updatedAt,
        onlineSince: state.onlineSince,
        maxLength: MAX_PLAYING_LENGTH,
      };
    },

    /** 启动时调用：有刷新令牌就直接恢复会话，没有就安静地待着。 */
    async restore() {
      let token = null;
      try {
        token = await store.get(STORAGE_KEYS.token);
        const savedAccount = await store.get(STORAGE_KEYS.account);
        if (typeof savedAccount === 'string') state.accountName = savedAccount;
      } catch (error) {
        logWarn('could not read the Steam credentials', error);
      }
      touch();
      if (!token || disposed) return { ok: true, restored: false };
      logInfo('restoring the Steam session from a refresh token');
      return { ok: true, restored: true, ...logOn({ refreshToken: token }) };
    },

    /**
     * 用账号密码登录。首次登录会走到 Steam Guard（面板上显示成"需要验证码"），
     * 之后 refreshToken 事件会把令牌存下来，就不再需要密码了。
     */
    async login({ accountName, password, twoFactorCode, authCode } = {}) {
      const account = String(accountName ?? '').trim();
      clearGuard();
      detachClient();
      state.accountName = account;
      try {
        if (account) await store.set(STORAGE_KEYS.account, account);
      } catch (error) {
        logWarn('could not store the Steam account name', error);
      }

      const details = { accountName: account };
      const password_ = typeof password === 'string' ? password : '';
      if (password_) details.password = password_;
      const twoFactor = String(twoFactorCode ?? '').trim();
      if (twoFactor) details.twoFactorCode = twoFactor;
      const emailCode = String(authCode ?? '').trim();
      if (emailCode) details.authCode = emailCode;

      if (!account) {
        return { ok: false, error: setError(null, 'steam-account-required') };
      }
      if (!password_ && !twoFactor && !emailCode) {
        // 只有账号名、什么都没给：没有令牌就没法登录。
        const token = await store.get(STORAGE_KEYS.token).catch(() => null);
        if (!token) {
          return { ok: false, error: setError(null, 'steam-password-required') };
        }
        return { ok: true, ...logOn({ refreshToken: token }) };
      }

      return { ok: true, ...logOn(details) };
    },

    /** 用户把 Steam Guard 验证码填好之后调用。 */
    submitGuard(code) {
      const text = String(code ?? '').trim();
      if (!text) return { ok: false, error: { message: 'steam-guard-empty' } };
      const callback = guardCallback;
      if (!callback) return { ok: false, error: { message: 'steam-guard-not-pending' } };
      clearGuard();
      state.state = STEAM_STATES.connecting;
      touch();
      try {
        callback(text);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: setError(error, 'steam-guard-failed') };
      }
    },

    /** 断开连接，但保留刷新令牌 —— 下次启用模组会自动登录回来。 */
    logout() {
      detachClient();
      clearGuard();
      state.state = STEAM_STATES.idle;
      state.steamId = '';
      state.personaName = '';
      state.playing = '';
      state.onlineSince = 0;
      clearError();
      touch();
      return { ok: true };
    },

    /** 断开并忘掉令牌（换账号、或想把凭据从这台机器上抹掉时用）。 */
    async forget() {
      detachClient();
      clearGuard();
      try {
        await store.delete(STORAGE_KEYS.token);
        await store.delete(STORAGE_KEYS.account);
      } catch (error) {
        logWarn('could not clear the Steam credentials', error);
      }
      state.accountName = '';
      state.state = STEAM_STATES.idle;
      state.steamId = '';
      state.personaName = '';
      state.playing = '';
      state.pending = '';
      state.onlineSince = 0;
      clearError();
      touch();
      return { ok: true };
    },

    publish(text) {
      return publish(text);
    },

    dispose() {
      disposed = true;
      if (publishTimer !== null) {
        clearTimeout(publishTimer);
        publishTimer = null;
      }
      clearGuard();
      detachClient();
    },
  };
};

export default createSteamConnector;
