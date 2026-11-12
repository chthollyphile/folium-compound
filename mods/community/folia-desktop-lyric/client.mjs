/**
 * 桌面歌词 —— Folium mod 客户端入口（渲染层，context = 'main'）
 *
 * 只保留三件事：
 *  1. 拥有 folium.playback 能力，执行 Lyrics 窗口排队的播放控制命令（切歌 / 播放暂停）。
 *  2. 在「设置 → 模组 → 桌面歌词」里注册一个「启用全局快捷键」开关。
 *  3. 在 Folia 进度条左侧注册一个锁形按钮：
 *     点一下把桌面歌词的控制条弹出来 / 重新锁定，样式沿用旁边的循环按钮。
 *
 * 除这个锁形按钮外，不在 Folia 界面注册其他按钮；边界：只碰 Folia 通过 folium 暴露的能力，
 * 不往宿主 document 上挂任何东西。
 */

// 调试日志开关：默认关闭；需要排错时改成 true，才会输出所有 folium.log 日志。
const DEBUG = false;

/** 已锁定：闭合的锁。 */
const ICON_LOCKED =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/>' +
  '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';

/** 未锁定：右侧锁梁抬起的开锁。 */
const ICON_UNLOCKED =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5"/>' +
  '<path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/></svg>';

// 进度条槽位按钮：沿用 Folia 循环按钮的圆形、透明底、低透明度常态样式。
const PROGRESS_BUTTON_STYLE = `
  .dl-progress-btn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 8px;
    border-radius: 9999px;
    color: var(--folium-primary, #d6d3d1);
    opacity: .4;
    cursor: pointer;
    transition: opacity .12s ease, background-color .12s ease, color .12s ease;
  }
  .dl-progress-btn:hover { opacity: 1; background: rgba(255,255,255,.10); }
  .dl-progress-btn:active { background: rgba(255,255,255,.20); }
  .dl-progress-btn[data-visible="0"] { opacity: .2; }
  .dl-progress-btn[data-locked="0"] { opacity: 1; background: rgba(255,255,255,.20); }
  .dl-progress-btn[data-locked="0"]:hover { background: rgba(255,255,255,.30); }
  .dl-progress-btn svg { width: 18px; height: 18px; display: block; }
`;

// 两条可录制的快捷键：action 与主进程一致，key 是设置项里的存储键。
const HOTKEY_FIELDS = [
  { action: 'lock', key: 'keyLock', default: 'CommandOrControl+Shift+L', label: { 'zh-CN': '开启 / 关闭穿透', 'zh-TW': '開啟 / 關閉穿透', en: 'Click-through on / off' } },
  { action: 'visible', key: 'keyVisible', default: 'CommandOrControl+Shift+H', label: { 'zh-CN': '显示 / 隐藏歌词', 'zh-TW': '顯示 / 隱藏歌詞', en: 'Show / hide lyrics' } },
];

export default function activate(folium) {
  let stopped = false;
  let polling = false;
  /** 设置分区句柄：轮询拿到主进程真实可见状态后，用它把开关同步回来。 */
  let settingsSection = null;

  /** 所有日志统一由 DEBUG 控制，包括 warn / error。 */
  const debugLog = (level, msg, extra) => {
    if (!DEBUG) return;
    folium.log[level](msg, extra);
  };

  // ------------------------------------------------------- 进度条按钮

  let locked = true;
  let visible = true;
  let lastProgressClickAt = 0;
  const progressButtons = new Set();

  const updateProgressButton = (button) => {
    if (!button) return;
    button.innerHTML = locked ? ICON_LOCKED : ICON_UNLOCKED;
    button.dataset.locked = locked ? '1' : '0';
    button.dataset.visible = visible ? '1' : '0';
    button.title = locked
      ? '桌面歌词：点击关闭鼠标穿透，显示控制条'
      : '桌面歌词：点击开启鼠标穿透，隐藏控制条';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', locked ? 'true' : 'false');
  };

  const renderProgressButtons = () => {
    for (const button of progressButtons) updateProgressButton(button);
  };

  const toggleTools = async () => {
    if (stopped) return;
    const now = Date.now();
    if (now - lastProgressClickAt < 400) return;
    lastProgressClickAt = now;
    try {
      const result = await folium.rpc.call('toggle-tools');
      if (result && typeof result.locked === 'boolean') locked = result.locked;
      renderProgressButtons();
      debugLog('info', `进度条按钮切换控制条: ${locked ? '已锁定' : '已显示'}`);
    } catch (error) {
      debugLog('error', '切换桌面歌词控制条失败', error);
    }
  };

  const mountProgressButton = (container, ctx) => {
    const style = document.createElement('style');
    style.textContent = PROGRESS_BUTTON_STYLE;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dl-progress-btn';
    button.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      void toggleTools();
    });
    button.addEventListener('pointerdown', (event) => event.stopPropagation());

    const applyColor = () => {
      const colors = ctx && typeof ctx.getColors === 'function' ? ctx.getColors() : null;
      if (colors && colors.fill) button.style.color = colors.fill;
    };
    applyColor();
    if (ctx && typeof ctx.onChange === 'function') ctx.onChange(applyColor);

    container.replaceChildren(style, button);
    progressButtons.add(button);
    updateProgressButton(button);

    return () => {
      progressButtons.delete(button);
    };
  };

  let progressRegistration = null;
  const registerProgressButton = () => {
    if (!folium.registries || !folium.registries.progressButtons) return;
    try {
      progressRegistration = folium.registries.progressButtons.register({
        id: 'lyric-bar-toggle',
        slot: 'progress.leading',
        order: 10,
        hideWhenCollapsed: true,
        mount: mountProgressButton,
      });
    } catch (error) {
      debugLog('error', '注册进度条按钮失败', error);
    }
  };

  // ------------------------------------------------------- 显示与快捷键设置

  /** 一行设置：左边标题、右边 switch，标题和开关在同一行。 */
  const createSwitchRow = (doc, titleText, hintText, readOn, writeOn) => {
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;padding-bottom:10px;border-bottom:1px solid rgba(128,128,128,.22);';

    const textBox = doc.createElement('div');
    textBox.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:0;';

    const title = doc.createElement('div');
    title.textContent = titleText;
    title.style.cssText = 'font-size:12px;line-height:1.5;color:var(--text-primary);';

    const hint = doc.createElement('div');
    hint.textContent = hintText;
    hint.style.cssText = 'font-size:11px;line-height:1.5;color:var(--text-secondary);opacity:.7;';

    textBox.append(title, hint);

    const track = doc.createElement('button');
    track.type = 'button';
    track.setAttribute('role', 'switch');
    track.setAttribute('aria-label', titleText);
    track.style.cssText = 'position:relative;flex:none;width:38px;height:22px;padding:0;border:none;border-radius:999px;cursor:pointer;transition:background-color .16s ease;';

    const knob = doc.createElement('span');
    knob.style.cssText = 'position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .16s ease;';
    track.append(knob);
    row.append(textBox, track);

    track.addEventListener('click', () => writeOn(readOn() !== true));

    return {
      node: row,
      render: (theme) => {
        const on = readOn() === true;
        track.setAttribute('aria-checked', on ? 'true' : 'false');
        track.style.backgroundColor = on
          ? (theme && theme.accentColor ? theme.accentColor : '#3b82f6')
          : (theme && theme.isDaylight ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.28)');
        knob.style.transform = on ? 'translateX(16px)' : 'translateX(0)';
      },
    };
  };

  /** 自定义设置面板：最上面「显示桌面歌词」，下面「启用全局快捷键」。 */
  const mountHotkeySettingsPanel = (container, ctx) => {
    const doc = container.ownerDocument;
    const access = ctx.settings;
    const locale = String(ctx.locale || 'zh-CN');
    const isZh = locale.toLowerCase().startsWith('zh');
    const isTw = locale.toLowerCase() === 'zh-tw';
    const pick = (cn, tw, en) => (isTw ? tw : isZh ? cn : en);

    const root = doc.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;gap:12px;min-width:0;';

    const visibleRow = createSwitchRow(
      doc,
      pick('显示桌面歌词', '顯示桌面歌詞', 'Show desktop lyrics'),
      pick(
        '关掉后歌词会隐藏；开启全局快捷键后，也可以用录制的「显示 / 隐藏歌词」快捷键切换。',
        '關掉後歌詞會隱藏；開啟全域快捷鍵後，也可以用錄製的「顯示 / 隱藏歌詞」快捷鍵切換。',
        'Turn off to hide the lyrics; once global hotkeys are on, your recorded Show / hide shortcut also toggles it.',
      ),
      () => access.get().visible !== false,
      (on) => {
        access.set({ visible: on });
        try {
          const pending = folium.rpc.call('set-visible', on);
          if (pending && typeof pending.catch === 'function') pending.catch(() => {});
        } catch { /* 失败不影响界面 */ }
      },
    );

    const hotkeyRow = createSwitchRow(
      doc,
      pick('启用全局快捷键', '啟用全域快捷鍵', 'Enable global hotkeys'),
      pick(
        '开启后，下面录制的组合键才会注册。',
        '開啟後，下面錄製的組合鍵才會註冊。',
        'Once on, the combos recorded below are registered.',
      ),
      () => access.get().hotkeys === true,
      (on) => {
        if (!on) {
          stopCapture();
          statusEl.style.display = 'none';
        }
        access.set({ hotkeys: on });
        try {
          const pending = folium.rpc.call('set-hotkeys', on);
          if (pending && typeof pending.then === 'function') {
            pending.then((result) => showHotkeyFailures(result && result.failed)).catch(() => {});
          }
        } catch { /* 失败不影响界面 */ }
      },
    );

    // ---------------------------------------------------------- 快捷键录制
    let capturing = null;
    let captureHandler = null;
    let captureKeyup = null;
    let captureOutside = null;

    const formatAccelerator = (value) => String(value || '')
      .replace(/CommandOrControl|Control/g, 'Ctrl')
      .replace(/\bPlus\b/g, '=')
      .replace(/\+/g, ' + ');

    const eventKeyName = (event) => {
      if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar' || event.keyCode === 32 || event.which === 32) return 'Space';
      // 等号 / 减号（含 Shift 输入的 + / _）不在 event.key 的字母数字分支里，单独按物理键识别。
      if (event.code === 'Equal') return event.shiftKey ? 'Plus' : '=';
      if (event.code === 'Minus') return '-';
      const key = event.key;
      if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
      if (/^[0-9]$/.test(key)) return key;
      const named = {
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right',
        Enter: 'Enter',
        Tab: 'Tab',
        Backspace: 'Backspace',
        Delete: 'Delete',
        Insert: 'Insert',
        Home: 'Home',
        End: 'End',
        PageUp: 'PageUp',
        PageDown: 'PageDown',
      };
      if (named[key]) return named[key];
      if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return key;
      return '';
    };

    const keysBox = doc.createElement('div');
    keysBox.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    const keyButtons = new Map();
    const statusEl = doc.createElement('div');
    statusEl.style.cssText = 'font-size:11px;line-height:1.5;color:var(--text-secondary);display:none;';

    const hotkeyActionLabel = (action) => {
      const field = HOTKEY_FIELDS.find((item) => item.action === action);
      return field ? pick(field.label['zh-CN'], field.label['zh-TW'], field.label.en) : String(action || '');
    };

    // 主进程返回 { action, accelerator }，把具体组合键一起显示，用户才知道该换哪一项。
    const formatFailedHotkey = (item) => {
      if (!item || typeof item !== 'object') return String(item || '');
      const label = hotkeyActionLabel(item.action);
      const accelerator = formatAccelerator(item.accelerator || '');
      return accelerator ? `${label}（${accelerator}）` : label;
    };

    const showHotkeyFailures = (failed) => {
      const list = Array.isArray(failed) ? failed.filter(Boolean) : [];
      if (list.length === 0) {
        statusEl.style.display = 'none';
        return;
      }
      const names = list.map(formatFailedHotkey).join('、');
      statusEl.textContent = pick(
        `这些组合键被系统占用：${names}。请换一个组合键。`,
        `這些組合鍵被系統佔用：${names}。請換一個組合鍵。`,
        `These shortcuts are taken by the system: ${names}. Try another combo.`,
      );
      statusEl.style.display = 'block';
    };

    /** 读取实际存的值：空字符串表示用户主动清空，不再回退到默认值。 */
    const readKey = (field) => {
      const value = access.get()[field.key];
      return typeof value === 'string' ? value : field.default;
    };

    const collectBindings = () => {
      const bindings = {};
      for (const item of HOTKEY_FIELDS) bindings[item.action] = readKey(item);
      return bindings;
    };

    const pushBindings = (onResult) => {
      try {
        const pending = folium.rpc.call('set-hotkey-bindings', collectBindings());
        if (pending && typeof pending.then === 'function' && typeof onResult === 'function') {
          pending.then(onResult).catch(() => {});
        }
      } catch { /* 失败不影响界面 */ }
    };

    const renderKeys = () => {
      const theme = ctx.getTheme();
      const idleBg = theme && theme.isDaylight ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.20)';
      const idleBorder = theme && theme.isDaylight ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.18)';
      for (const field of HOTKEY_FIELDS) {
        const button = keyButtons.get(field.action);
        if (!button) continue;
        button.style.backgroundColor = idleBg;
        if (capturing === field.action) {
          button.textContent = pick('请输入新的按键', '請輸入新的按鍵', 'Press a new key');
          button.style.borderColor = 'var(--text-primary)';
          continue;
        }
        const value = readKey(field);
        button.textContent = value ? formatAccelerator(value) : pick('未设置', '未設定', 'Not set');
        button.style.borderColor = idleBorder;
      }
    };

    const stopCapture = () => {
      const win = doc.defaultView;
      if (captureHandler && win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('keydown', captureHandler, true);
      }
      if (captureKeyup && win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('keyup', captureKeyup, true);
      }
      if (captureOutside && captureOutside.win && typeof captureOutside.win.removeEventListener === 'function') {
        captureOutside.win.removeEventListener('pointerdown', captureOutside.handler, true);
      }
      if (captureOutside && captureOutside.button && typeof captureOutside.button.removeAttribute === 'function') {
        captureOutside.button.removeAttribute('data-folia-key-capture');
      }
      captureHandler = null;
      captureKeyup = null;
      captureOutside = null;
      capturing = null;
      renderKeys();
    };

    /** 点击后没按键就失焦：记录清空，按钮显示「未设置」。 */
    const clearShortcut = (field) => {
      access.set({ [field.key]: '' });
      pushBindings();
      statusEl.style.display = 'none';
      stopCapture();
    };

    const startCapture = (field) => {
      stopCapture();
      capturing = field.action;
      renderKeys();
      statusEl.style.display = 'none';

      const win = doc.defaultView;
      const button = keyButtons.get(field.action);
      if (win && typeof win.addEventListener === 'function' && button) {
        // 宿主自己的全局按键会先跑；它认 data-folia-key-capture 这个标记并让路。
        if (typeof button.setAttribute === 'function') button.setAttribute('data-folia-key-capture', 'true');
        if (typeof button.focus === 'function') button.focus();
        // 用「点面板外面」判断失焦。不能用按钮 blur：按 Alt 会先触发窗口菜单，
        // 按钮提前 blur，导致 Ctrl + Alt + Space 还没按到空格就被清掉。
        const onOutside = (event) => {
          if (capturing !== field.action) return;
          const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
          if (event.target === button || path.includes(button)) return;
          clearShortcut(field);
        };
        win.addEventListener('pointerdown', onOutside, true);
        captureOutside = { win, handler: onOutside, button };
      }

      if (!win || typeof win.addEventListener !== 'function') return;
      const handleCapturedKey = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          stopCapture();
          return;
        }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const ctrl = event.ctrlKey || event.metaKey;
        const alt = event.altKey;
        const shift = event.shiftKey;
        const mainKey = eventKeyName(event);
        if (!mainKey) {
          statusEl.textContent = pick('这个键不支持，换一个', '這個鍵不支援，換一個', 'That key is not supported; try another');
          statusEl.style.display = 'block';
          return;
        }
        const parts = [];
        if (ctrl) parts.push('CommandOrControl');
        if (alt) parts.push('Alt');
        if (shift) parts.push('Shift');
        parts.push(mainKey);
        const accelerator = parts.join('+');
        // 同一个组合键只能属于一个动作：录到别人已经用的组合时，把别人清空。
        for (const other of HOTKEY_FIELDS) {
          if (other.action !== field.action && readKey(other) === accelerator) {
            access.set({ [other.key]: '' });
          }
        }
        access.set({ [field.key]: accelerator });
        pushBindings((result) => {
          showHotkeyFailures(result && result.failed);
        });
        stopCapture();
      };
      captureHandler = handleCapturedKey;
      // 某些输入法 / 系统会先把 Ctrl/Shift + 空格的 keydown 吃掉；keyup 往往还能收到，
      // 所以空格额外用 keyup 兜底一次。
      captureKeyup = (event) => {
        if (event.code === 'Space' || event.key === ' ' || event.keyCode === 32 || event.which === 32) {
          handleCapturedKey(event);
        }
      };
      win.addEventListener('keydown', captureHandler, true);
      win.addEventListener('keyup', captureKeyup, true);
    };

    for (const field of HOTKEY_FIELDS) {
      const row = doc.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding-bottom:8px;border-bottom:1px solid rgba(128,128,128,.22);';
      const label = doc.createElement('div');
      label.textContent = pick(field.label['zh-CN'], field.label['zh-TW'], field.label.en);
      label.style.cssText = 'font-size:11.5px;line-height:1.5;color:var(--text-primary);opacity:.85;';
      const button = doc.createElement('button');
      button.type = 'button';
      button.style.cssText = 'flex:none;min-width:180px;padding:4px 10px;border-radius:7px;border:1px solid transparent;color:var(--text-primary);font-size:11px;line-height:1.4;cursor:pointer;text-align:left;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;';
      button.addEventListener('click', (event) => {
        // 键盘空格在聚焦按钮上会额外触发一次 detail=0 的 click，
        // 不忽略的话会把刚录好的空格又重置成录制状态。
        if (event && event.detail === 0) return;
        startCapture(field);
      });
      keyButtons.set(field.action, button);
      row.append(label, button);
      keysBox.append(row);
    }
    keysBox.append(statusEl);

    root.append(
      visibleRow.node,
      hotkeyRow.node,
      keysBox,
    );
    container.replaceChildren(root);

    const render = () => {
      const theme = ctx.getTheme();
      const hotkeysOn = access.get().hotkeys === true;
      if (!hotkeysOn && capturing) stopCapture();
      keysBox.style.display = hotkeysOn ? 'flex' : 'none';
      visibleRow.render(theme);
      hotkeyRow.render(theme);
      renderKeys();
    };
    render();
    const offValue = access.onChange(render);
    const offTheme = ctx.onChange(render);

    return () => {
      stopCapture();
      offValue();
      offTheme();
      root.remove();
    };
  };

  const registerHotkeySettings = () => {
    if (!folium.registries || !folium.registries.settingsSections) return;
    try {
      const section = folium.registries.settingsSections.register({
        id: 'hotkeys',
        label: { 'zh-CN': '桌面歌词', 'zh-TW': '桌面歌詞', en: 'Desktop lyrics' },
        description: {
          'zh-CN': '控制桌面歌词的显示、全局快捷键开关，并录制每条快捷键的组合键。',
          'zh-TW': '控制桌面歌詞的顯示、全域快捷鍵開關，並錄製每條快捷鍵的組合鍵。',
          en: 'Control the desktop lyrics and global hotkeys, and record the key combo for each action.',
        },
        settings: [
          {
            key: 'visible',
            type: 'boolean',
            defaultValue: true,
            label: { 'zh-CN': '显示桌面歌词', 'zh-TW': '顯示桌面歌詞', en: 'Show desktop lyrics' },
            description: {
              'zh-CN': '关闭后歌词会隐藏；开启全局快捷键后，也可以用录制的「显示 / 隐藏歌词」快捷键切换。',
              'zh-TW': '關掉後歌詞會隱藏；開啟全域快捷鍵後，也可以用錄製的「顯示 / 隱藏歌詞」快捷鍵切換。',
              en: 'Turn off to hide the lyrics; once global hotkeys are on, your recorded Show / hide shortcut also toggles it.',
            },
          },
          {
            key: 'hotkeys',
            type: 'boolean',
            defaultValue: false,
            label: { 'zh-CN': '启用全局快捷键', 'zh-TW': '啟用全域快捷鍵', en: 'Enable global hotkeys' },
            description: {
              'zh-CN': '开启后，下面录制的组合键才会注册。',
              'zh-TW': '開啟後，下面錄製的組合鍵才會註冊。',
              en: 'Once on, the combos recorded below are registered.',
            },
          },
          ...HOTKEY_FIELDS.map((field) => ({
            key: field.key,
            type: 'text',
            defaultValue: field.default,
            label: field.label,
          })),
        ],
        settingsPanel: mountHotkeySettingsPanel,
      });
      settingsSection = section;
      const sync = () => {
        const values = section.settings.get();
        const bindings = {};
        for (const field of HOTKEY_FIELDS) {
          const value = values[field.key];
          bindings[field.action] = typeof value === 'string' ? value : field.default;
        }
        const pairs = [
          ['set-visible', values.visible !== false],
          ['set-hotkey-bindings', bindings],
          ['set-hotkeys', values.hotkeys === true],
        ];
        for (const [name, value] of pairs) {
          try {
            const pending = folium.rpc.call(name, value);
            if (pending && typeof pending.catch === 'function') pending.catch(() => {});
          } catch { /* 设置失败不影响歌词 */ }
        }
      };
      sync();
    } catch (error) {
      debugLog('error', '注册快捷键设置失败', error);
    }
  };

  // ------------------------------------------------------------ 播放控制

  const run = async (command) => {
    if (command && typeof command === 'object') {
      if (command.name === 'seek-lyric') {
        const sec = Number(command.lyricSeconds) || 0;
        if (typeof folium.playback.seekToLyricTime === 'function') {
          await folium.playback.seekToLyricTime(sec);
        } else {
          await folium.playback.seek(sec);
        }
        debugLog('info', `跳转到歌词时间: ${sec}s`);
        return;
      }
      debugLog('warn', `未知对象命令: ${JSON.stringify(command)}`);
      return;
    }
    switch (command) {
      case 'next':
        await folium.playback.next();
        break;
      case 'prev':
        await folium.playback.previous();
        break;
      case 'toggle-play':
        await folium.playback.toggle();
        break;
      default:
        debugLog('warn', `未知播放控制命令: ${String(command)}`);
        return;
    }
    debugLog('info', `已执行播放控制: ${command}`);
  };

  // ------------------------------------------------------------ 轮询

  // 主进程入口比 client 晚一点就绪时，首轮可能拿到 rpc-not-found；这不是错误，
  // 下一轮就会恢复，别把它记成界面错误。
  const isRpcNotFound = (error) => {
    const message = error && typeof error === 'object'
      ? `${error.code || ''} ${error.message || ''}`
      : String(error || '');
    return message.includes('rpc-not-found');
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      const result = await folium.rpc.call('poll-commands');
      const commands = Array.isArray(result)
        ? result
        : (result && Array.isArray(result.commands) ? result.commands : []);
      // 进度条按钮的状态跟着主进程的锁定 / 可见状态走，避免和歌词窗口不同步。
      if (result && !Array.isArray(result)) {
        let changed = false;
        if (typeof result.locked === 'boolean' && result.locked !== locked) {
          locked = result.locked;
          changed = true;
        }
        if (typeof result.visible === 'boolean' && result.visible !== visible) {
          visible = result.visible;
          changed = true;
        }
        if (changed) renderProgressButtons();
      }
      if (settingsSection && result && !Array.isArray(result) && typeof result.visible === 'boolean') {
        const current = settingsSection.settings.get().visible !== false;
        if (current !== result.visible) settingsSection.settings.set({ visible: result.visible });
      }
      for (const command of commands) {
        try {
          await run(command);
        } catch (error) {
          debugLog('error', `执行 ${command} 失败`, error);
        }
      }
    } catch (error) {
      if (!isRpcNotFound(error)) debugLog('error', '轮询桌面歌词状态失败', error);
    } finally {
      polling = false;
    }
  };

  const timer = window.setInterval(() => { void poll(); }, 250);
  void poll();

  registerHotkeySettings();
  registerProgressButton();

  try {
    folium.rpc.call('client-ready', {
      context: folium.env?.context ?? 'unknown',
      folia: folium.host?.folia ?? null,
    });
  } catch (error) {
    if (!isRpcNotFound(error)) debugLog('error', '上报 client 就绪失败', error);
  }

  debugLog('info', '桌面歌词 client 入口已加载（切歌能力可用；设置里有显示 / 快捷键开关）');

  return () => {
    stopped = true;
    window.clearInterval(timer);
    progressButtons.clear();
    if (progressRegistration && typeof progressRegistration.unregister === 'function') {
      progressRegistration.unregister();
      progressRegistration = null;
    }
  };
}
