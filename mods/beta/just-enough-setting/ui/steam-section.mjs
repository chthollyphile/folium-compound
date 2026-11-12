// mods/Just-Enough-Setting/ui/steam-section.mjs
// 面板里的 Steam 区块：开关、账号与密码、Steam Guard 验证码、连接状态，以及「正在玩」的片段编排。
//
// 这里有两套完全不同的「状态」，别混：
//
//   - **配置**（steamEnabled / steamAccountName）住在宿主参数里：落盘、校验、随「视觉配置」导出，
//     和别的选项一样经 controller.setOption 写回；
//   - **连接状态**在 Electron 主进程那边。宿主的 rpc 是单向的（只有 client → main），
//     main 没法主动推回来，所以 controller 用轮询取状态，拿到新状态就让面板重画。
//     这一块因此**不自己开定时器**：重画只由 controller 的通知驱动。
//
// 密码是这个文件里唯一不能外流的东西：它只活在闭包变量 `password` 里，登录时读一次就清掉。
// 不进参数（参数会随配置导出）、不进日志、不做任何本地缓存。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const {
  TOKENS, createButton, createButtonRow, createConfirmButton, createSection, createSwitch,
  createTextInput, debounce, el, setText,
} = await import(`./dom.mjs${VERSION}`);

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * 账号名长度上限。与 lib/config.mjs 的 MAX_STEAM_ACCOUNT_LENGTH 是同一个数——
 * 那边负责落盘时截断，这边负责让输入框自己拦下来。
 */
const ACCOUNT_MAX_LENGTH = 64;

/**
 * Steam 的 EResult 枚举名 → 文案 key。只列了登录这条路上真正会撞见的几个；
 * 没列到的直接把枚举名原样显出来，总比只给一个数字强。
 */
const ERESULT_TEXT = Object.freeze({
  InvalidPassword: 'steam.eresult.invalidPassword',
  RateLimitExceeded: 'steam.eresult.rateLimit',
  AccountLogonDenied: 'steam.eresult.needEmail',
  AccountLoginDeniedNeedTwoFactor: 'steam.eresult.needTwoFactor',
  InvalidLoginAuthCode: 'steam.eresult.badAuthCode',
  TwoFactorCodeMismatch: 'steam.eresult.badTwoFactor',
  TwoFactorActivationCodeMismatch: 'steam.eresult.badTwoFactor',
  AccountNotFound: 'steam.eresult.accountNotFound',
  ServiceUnavailable: 'steam.eresult.serviceUnavailable',
  TryAnotherCM: 'steam.eresult.serviceUnavailable',
});

/** 连接器自己造的短代号（它没有 EResult 可给）→ 文案 key。 */
const MESSAGE_TEXT = Object.freeze({
  'steam-account-required': 'steam.err.accountRequired',
  'steam-password-required': 'steam.err.passwordRequired',
  'steam-guard-timeout': 'steam.err.guardTimeout',
  'steam-guard-not-pending': 'steam.err.guardNotPending',
  'steam-dependency-missing': 'steam.err.dependency',
});

/**
 * 状态 → 一行短文案。诊断面板与这里的状态牌共用，免得两处对同一个状态各说各话。
 */
export const steamStateText = (steam, t) => {
  if (!steam) return t('steam.state.unknown');
  if (steam.available === false) return t('steam.state.unavailable');
  if (steam.needsGuard) return t('steam.state.guard');
  switch (steam.state) {
    case 'online': return t('steam.state.online');
    case 'connecting': return t('steam.state.connecting');
    case 'error': return t('steam.state.error');
    default: return t('steam.state.idle');
  }
};

/**
 * 失败原因：优先翻成能读的话；翻不出来就原样给出 EResult 名或消息——
 * 一个裸数字（比如「5」）对排查毫无帮助，枚举名至少能拿去搜。
 */
export const steamFailureText = (steam, t) => {
  if (!steam) return t('steam.err.notOk');
  const messageKey = MESSAGE_TEXT[steam.lastError];
  if (messageKey) return t(messageKey);
  const resultKey = ERESULT_TEXT[steam.lastErrorName];
  if (resultKey) return t(resultKey);
  if (steam.lastErrorName) {
    return `${steam.lastErrorName}${steam.lastErrorCode === null || steam.lastErrorCode === undefined ? '' : ` (${steam.lastErrorCode})`}`;
  }
  if (steam.lastError) return t('steam.err.generic', { message: steam.lastError });
  return t('steam.err.notOk');
};

/**
 * 明细行：在线时给身份 + 当前推送的内容，其余情况给「下一步该做什么」。
 */
export const steamDetailText = (steam, t, enabled) => {
  if (!steam) return t('steam.detail.loading');
  if (steam.available === false) return steam.reason || t('steam.err.dependency');
  if (steam.state === 'error') return steamFailureText(steam, t);
  if (steam.needsGuard) {
    const which = steam.guardDomain ? t('steam.detail.guardEmail') : t('steam.detail.guardMobile');
    return steam.guardWrong ? `${t('steam.detail.guardWrong')} ${which}` : which;
  }
  if (steam.state === 'connecting') return t('steam.detail.connecting');
  if (steam.state === 'online') {
    const identity = steam.personaName || steam.accountName || steam.steamId || '—';
    const playing = steam.playing
      ? t('steam.detail.playing', { text: steam.playing })
      : (steam.pending ? t('steam.detail.pending', { text: steam.pending }) : t('steam.detail.playingEmpty'));
    return `${t('steam.detail.online', { name: identity })}\n${playing}`;
  }
  if (!enabled) return t('steam.detail.disabled');
  return t('steam.detail.idle');
};

/** 状态牌上那个小圆点的颜色。涨跌之外只有「在线 / 报警 / 等着你动手」三种要区分。 */
export const steamDotColor = (steam) => {
  if (!steam || steam.available === false) return 'rgba(127, 127, 127, 0.5)';
  if (steam.state === 'online') return '#22c55e';
  if (steam.state === 'error') return '#ef4444';
  if (steam.needsGuard) return '#f59e0b';
  if (steam.state === 'connecting') return '#38bdf8';
  return 'rgba(127, 127, 127, 0.5)';
};

/**
 * 一块状态牌：左边一个小圆点（颜色只由状态决定），右边一行状态 + 一行明细。
 * 明细是等宽字体，SteamID / 推送文本这类「要照着核对」的东西才看得清。
 */
const createStatusCard = () => {
  const dot = el('span', {
    flex: '0 0 auto',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'rgba(127, 127, 127, 0.5)',
    marginTop: '5px',
  });
  const title = el('div', { fontSize: '12px', fontWeight: '600' });
  const detail = el('div', {
    fontSize: '10px',
    opacity: TOKENS.muted,
    fontFamily: MONO,
    lineHeight: '1.45',
    wordBreak: 'break-word',
    // 在线时的明细是两行（身份 / 当前推送）；没有 pre-wrap 的话换行会被折成一个空格。
    whiteSpace: 'pre-wrap',
  });
  const root = el('div', {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '7px 9px',
    borderRadius: '8px',
    border: TOKENS.border,
    background: TOKENS.softer,
  }, dot, el('div', { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '0' }, title, detail));
  return { root, dot, title, detail };
};

/**
 * 建 Steam 区块。
 *
 * @param {object} options
 * @param {object} options.controller 取配置 / 动作 / 状态快照
 * @param {Function} options.t 翻译函数
 * @param {Function} options.toast 提示条
 * @param {Function} options.commit 记账式写入（面板用来避免自己的写入触发整块重画）
 * @param {Function} options.renderTarget 渲染一个编排目标栏，返回它的 DOM
 */
export const createSteamSection = ({ controller, t, toast, commit, renderTarget }) => {
  const state = controller.getConfig();
  const section = createSection(t('group.steam'), t('steam.intro'));

  /** 密码：整个模组里唯一一个只活在内存里的东西。 */
  let password = '';

  const toggle = createSwitch({
    label: t('option.steamEnabled'),
    description: t('option.steamEnabledHint'),
    checked: state.options.steamEnabled,
    onChange: (value) => write(() => controller.setOption('steamEnabled', value)),
  });

  const status = createStatusCard();

  // 账号名走参数（会随配置导出），所以是节流写回；密码与验证码只在内存里。
  const persistAccount = debounce((value) => {
    write(() => controller.setOption('steamAccountName', value));
  }, 150);

  const account = createTextInput({
    label: t('steam.account'),
    description: t('steam.accountHint'),
    value: state.options.steamAccountName,
    placeholder: t('steam.accountPlaceholder'),
    maxLength: ACCOUNT_MAX_LENGTH,
    onChange: (value) => persistAccount(value),
  });

  const passwordInput = createTextInput({
    label: t('steam.password'),
    description: t('steam.passwordHint'),
    placeholder: t('steam.passwordPlaceholder'),
    type: 'password',
    onChange: (value) => { password = value; },
    onEnter: () => primaryAction(),
  });

  const guard = createTextInput({
    label: t('steam.guard'),
    description: t('steam.guardHint'),
    placeholder: t('steam.guardPlaceholder'),
    maxLength: 8,
    onEnter: () => primaryAction(),
  });

  const loginButton = createButton({
    label: t('steam.login'),
    onClick: () => primaryAction(),
  });

  const guardButton = createButton({
    label: t('steam.submitGuard'),
    onClick: () => submitGuard(),
  });

  const logoutButton = createButton({
    label: t('steam.logout'),
    onClick: async () => {
      await controller.steamLogout();
      toast(t('message.steamLoggedOut'));
      update();
    },
  });

  const forgetButton = createConfirmButton({
    label: t('steam.forget'),
    confirmLabel: t('steam.forgetConfirm'),
    onConfirm: async () => {
      password = '';
      passwordInput.setValue('');
      guard.setValue('');
      await controller.steamForget();
      // 参数里的账号名也一起清掉：留着它会让「忘记凭据」看起来没生效。
      persistAccount.cancel();
      write(() => controller.setOption('steamAccountName', ''));
      toast(t('message.steamForgotten'));
      update();
    },
  });

  const actions = createButtonRow(loginButton, guardButton, logoutButton, forgetButton);

  // 「正在玩」那一行的编排。它和别处共用同一套片段类型、同一个拖拽编辑器，
  // 只是 Steam 只有一行——所以这里只嵌一个目标栏。
  const targetLabel = el('div', { fontSize: '11px', fontWeight: '600' }, t('target.steamText'));
  const targetHint = el('div', { fontSize: '10px', opacity: TOKENS.muted, marginBottom: '5px' }, t('target.steamTextHint'));
  const targetBlock = el('div', { display: 'flex', flexDirection: 'column' }, targetLabel, targetHint, renderTarget('steamText'));

  // 凭据区整体随开关显隐：关着的时候摆一堆输入框只会让人以为「必须填」。
  const credentials = el('div', { display: 'flex', flexDirection: 'column', gap: '8px' },
    status.root, account.root, passwordInput.root, guard.root, actions);

  section.body.append(toggle.root, credentials, targetBlock);

  // ---------------------------------------------------------------- 动作

  /** 写入 + 立刻按新配置重画这一段（面板那边也会重画一次，但状态牌得跟着开关一起变）。 */
  const write = (action) => {
    commit(action);
    update();
  };

  /** 主按钮：不在等验证码时是「登录」，在等的时候是「提交验证码」。 */
  const primaryAction = () => {
    const snapshot = controller.getSteamSnapshot();
    if (snapshot.status?.needsGuard) return submitGuard();
    return login();
  };

  const login = async () => {
    const accountName = account.value.trim();
    if (!accountName) {
      toast(t('steam.err.accountRequired'), 'error');
      return;
    }
    const code = guard.value.trim();
    if (!password && !code) {
      toast(t('steam.err.passwordRequired'), 'error');
      return;
    }

    const details = { accountName };
    if (password) details.password = password;
    if (code) {
      // 邮箱验证码和手机令牌是两个字段。上一次的 guardDomain 能告诉我们这次是哪种；
      // 头一回登录（还没有 domain）按手机令牌试——那是绝大多数账号的情况，错了也只会
      // 走到 steamGuard 事件，面板上再填一次就行。
      if (snapshotGuardDomain()) details.authCode = code;
      else details.twoFactorCode = code;
    }

    // 立刻把密码从界面上抹掉：既不留在 DOM 里，也不留在闭包里。
    password = '';
    passwordInput.setValue('');

    if (accountName !== controller.getConfig().options.steamAccountName) {
      persistAccount.cancel();
      write(() => controller.setOption('steamAccountName', accountName));
    }

    const result = await controller.steamLogin(details);
    const after = controller.getSteamSnapshot();
    if (after.status?.needsGuard) toast(t('steam.detail.guardEmail'), 'info');
    else if (result?.ok === false) toast(steamFailureText(after.status, t), 'error');
    else toast(t('message.steamLoggedIn'), 'success');
    update();
  };

  const submitGuard = async () => {
    const code = guard.value.trim();
    if (!code) {
      toast(t('steam.err.guardRequired'), 'error');
      return;
    }
    const result = await controller.steamSubmitGuard(code);
    guard.setValue('');
    if (result?.ok === false) toast(steamFailureText(controller.getSteamSnapshot().status, t), 'error');
    else toast(t('message.steamGuardSubmitted'), 'success');
    update();
  };

  const snapshotGuardDomain = () => Boolean(controller.getSteamSnapshot().status?.guardDomain);

  // ---------------------------------------------------------------- 重画

  function update() {
    const config = controller.getConfig();
    const enabled = config.options.steamEnabled;
    const snapshot = controller.getSteamSnapshot();
    const steam = snapshot.status;

    toggle.setChecked(enabled);
    credentials.style.display = enabled ? '' : 'none';
    // 正在这个框里打字时不要用参数里的（可能还是节流前的旧值）覆盖它。
    if (document.activeElement !== account.input) account.setValue(config.options.steamAccountName);

    status.dot.style.background = steamDotColor(steam);
    setText(status.title, enabled ? steamStateText(steam, t) : t('steam.state.idle'));
    setText(status.detail, steamDetailText(steam, t, enabled));

    const online = Boolean(steam?.online);
    const needsGuard = Boolean(steam?.needsGuard);
    loginButton.style.display = needsGuard ? 'none' : '';
    guardButton.style.display = needsGuard ? '' : 'none';
    loginButton.disabled = online;
    loginButton.style.opacity = online ? '0.45' : '1';
    logoutButton.style.display = online || steam?.state === 'connecting' ? '' : 'none';

    // 验证码框在「需要验证码」时自动获得焦点，省得用户满面板找它。
    if (needsGuard && document.activeElement !== guard.input) {
      try {
        guard.input.focus();
      } catch { /* 垫片 / 受限环境里 focus 不可用，忽略 */ }
    }
  }

  update();

  return {
    root: section.root,
    update,
    dispose() {
      persistAccount.cancel();
    },
  };
};

export default createSteamSection;
