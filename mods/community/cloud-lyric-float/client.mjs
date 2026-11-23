/**
 * cloud-lyric-float · 客户端入口
 *
 * 主进程负责悬浮窗与歌词渲染；这里只做两件事：
 *  1. 轮询主进程排队的播放控制命令，并调用 folium.playback；
 *  2. 在 Folia 播放条和命令面板里提供显隐 / 解锁 / 设置入口。
 *
 * 不注册歌词样式，也不向宿主页面挂全局 DOM。关闭模组时会撤销所有监听与按钮。
 */

const POLL_MS = 250;

const ICON_CLOUD =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
  'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7.2 18.2h10.1a3.7 3.7 0 0 0 .2-7.4A5.7 5.7 0 0 0 6.6 9.4a4.4 4.4 0 0 0 .6 8.8Z"/>' +
  '<path d="M9.2 13.6h5.8M10.8 16h2.6"/></svg>';

const BUTTON_STYLE = `
  .clf-progress-btn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: auto;
    min-width: 28px;
    height: 24px;
    padding: 0 7px;
    border-radius: 8px;
    color: rgba(255,255,255,.68);
    cursor: pointer;
    transition: color .16s ease, background .16s ease, opacity .16s ease;
  }
  .clf-progress-btn:hover {
    color: #fff;
    background: rgba(255,255,255,.13);
  }
  .clf-progress-btn:active { background: rgba(255,255,255,.23); }
  .clf-progress-btn[data-locked="false"][data-visible="true"] {
    color: #ff6b6b;
    background: rgba(255,77,79,.14);
  }
  .clf-progress-btn[data-visible="false"] { opacity: .42; }
  .clf-progress-btn .clf-dot {
    width: 4px; height: 4px; border-radius: 999px;
    background: currentColor; opacity: .8;
  }
`;

export default function activate(folium) {
  if (!folium || !folium.rpc || typeof folium.rpc.call !== 'function') {
    folium?.log?.warn?.('[cloud-lyric-float] 当前 Folium 不支持 rpc.call，模组无法工作');
    return undefined;
  }

  // 导出窗口 / 预览窗口没有播放页，不启动播放条和命令。
  if (folium.env && folium.env.context && folium.env.context !== 'main') {
    return undefined;
  }

  let stopped = false;
  let polling = false;
  let visible = true;
  let locked = false;
  let lastClickAt = 0;
  const buttons = new Set();
  const registrations = [];

  const report = (message) => {
    try {
      const pending = folium.rpc.call('client-log', String(message));
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } catch { /* 主进程尚未挂载时忽略 */ }
  };

  const callMain = async (name, ...args) => {
    try {
      return await folium.rpc.call(name, ...args);
    } catch (error) {
      folium.log?.warn?.('[cloud-lyric-float] 调用主进程失败', name, error);
      return null;
    }
  };

  const runPlaybackCommand = async (command) => {
    if (!folium.playback) {
      folium.log?.warn?.('[cloud-lyric-float] 播放服务尚未就绪');
      return;
    }
    switch (command) {
      case 'next':
        await folium.playback.next();
        break;
      case 'previous':
      case 'prev':
        await folium.playback.previous();
        break;
      case 'toggle':
      case 'toggle-play':
        await folium.playback.toggle();
        break;
      default:
        folium.log?.warn?.('[cloud-lyric-float] 未知播放命令', String(command));
    }
  };

  const renderButtons = () => {
    for (const button of buttons) {
      button.dataset.locked = String(locked);
      button.dataset.visible = String(visible);
      button.setAttribute('aria-pressed', String(visible && !locked));
      button.title = !visible
        ? '显示云音乐悬浮歌词'
        : locked
          ? '云音乐悬浮歌词已锁定，点击解除鼠标穿透'
          : '隐藏云音乐悬浮歌词';
      button.setAttribute('aria-label', button.title);
    }
  };

  const handleButtonClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - lastClickAt < 350) return;
    lastClickAt = now;
    const state = await callMain('widget-toggle');
    if (state && typeof state === 'object') {
      if (typeof state.visible === 'boolean') visible = state.visible;
      if (typeof state.locked === 'boolean') locked = state.locked;
      renderButtons();
      report(`播放条入口: visible=${visible}, locked=${locked}`);
    }
  };

  const mountProgressButton = (container) => {
    const style = document.createElement('style');
    style.textContent = BUTTON_STYLE;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clf-progress-btn';
    button.innerHTML = ICON_CLOUD + '<span class="clf-dot"></span>';
    button.addEventListener('click', handleButtonClick);
    button.addEventListener('pointerdown', (event) => event.stopPropagation());

    container.replaceChildren(style, button);
    buttons.add(button);
    renderButtons();
    return () => {
      button.removeEventListener('click', handleButtonClick);
      buttons.delete(button);
      style.remove();
      button.remove();
    };
  };

  if (folium.registries?.progressButtons?.register) {
    try {
      registrations.push(folium.registries.progressButtons.register({
        id: 'cloud-lyric-float-entry',
        slot: 'progress.leading',
        order: 18,
        hideWhenCollapsed: false,
        mount: mountProgressButton,
      }));
    } catch (error) {
      folium.log?.warn?.('[cloud-lyric-float] 注册播放条入口失败', error);
    }
  }

  const registerCommand = (definition) => {
    if (!folium.registries?.commands?.register) return;
    try {
      registrations.push(folium.registries.commands.register(definition));
    } catch (error) {
      folium.log?.warn?.('[cloud-lyric-float] 注册命令失败', definition.id, error);
    }
  };

  registerCommand({
    id: 'cloud-lyric-float-toggle',
    label: { 'zh-CN': '云音乐悬浮歌词：显示 / 隐藏', en: 'Cloud lyrics: show / hide' },
    keywords: ['歌词', '悬浮窗', '桌面歌词', 'lyric', 'cloud', 'float'],
    run: async () => {
      const state = await callMain('widget-toggle');
      folium.ui?.toast?.(
        state && state.visible ? '云音乐悬浮歌词已显示' : '云音乐悬浮歌词已隐藏',
        { durationMs: 1200 },
      );
    },
  });

  registerCommand({
    id: 'cloud-lyric-float-unlock',
    label: { 'zh-CN': '云音乐悬浮歌词：解锁 / 鼠标穿透', en: 'Cloud lyrics: toggle lock' },
    keywords: ['歌词', '锁定', '穿透', 'unlock', 'lock', 'lyric'],
    run: async () => {
      await callMain('widget-unlock');
    },
  });

  registerCommand({
    id: 'cloud-lyric-float-reset-position',
    label: { 'zh-CN': '云音乐悬浮歌词：重置窗口位置', en: 'Cloud lyrics: reset window position' },
    keywords: ['歌词', '悬浮窗', '重置', '位置', '丢', 'reset', 'position', 'lyric'],
    run: async () => {
      await callMain('reset-position');
      folium.ui?.toast?.('悬浮歌词已回到默认位置', { durationMs: 1400 });
    },
  });

  registerCommand({
    id: 'cloud-lyric-float-open-log',
    label: { 'zh-CN': '云音乐悬浮歌词：打开拖动诊断日志', en: 'Cloud lyrics: open drag log' },
    keywords: ['歌词', '日志', '拖动', '诊断', 'log', 'drag', 'lyric'],
    run: async () => {
      const result = await callMain('open-log');
      folium.ui?.toast?.(
        result && result.ok ? '已打开拖动诊断日志' : '无法打开日志，请查看 Folia 日志',
        { durationMs: 1400 },
      );
    },
  });

  registerCommand({
    id: 'cloud-lyric-float-settings',
    label: { 'zh-CN': '云音乐悬浮歌词：打开外观设置', en: 'Cloud lyrics: appearance settings' },
    keywords: ['歌词', '设置', '外观', '字体', 'lyric', 'settings'],
    run: async () => {
      await callMain('open-settings');
    },
  });

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const result = await callMain('poll-commands');
      const commands = Array.isArray(result)
        ? result
        : result && Array.isArray(result.commands)
          ? result.commands
          : [];
      for (const command of commands) {
        try {
          await runPlaybackCommand(command);
        } catch (error) {
          folium.log?.error?.('[cloud-lyric-float] 执行播放命令失败', command, error);
        }
      }
      if (result && !Array.isArray(result)) {
        const nextVisible = typeof result.visible === 'boolean' ? result.visible : visible;
        const nextLocked = typeof result.locked === 'boolean' ? result.locked : locked;
        if (nextVisible !== visible || nextLocked !== locked) {
          visible = nextVisible;
          locked = nextLocked;
          renderButtons();
        }
      }
    } finally {
      polling = false;
    }
  };

  const timer = window.setInterval(() => { void poll(); }, POLL_MS);
  void poll();
  report('客户端入口已加载');

  return () => {
    stopped = true;
    window.clearInterval(timer);
    for (const registration of registrations) {
      try {
        registration?.unregister?.();
      } catch { /* 宿主可能已统一回收 */ }
    }
    registrations.length = 0;
    buttons.clear();
  };
}


