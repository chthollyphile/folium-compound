'use strict';

/**
 * 快捷键的默认组合键与规范化逻辑。
 * 注册、注销仍留在 main.cjs，因为那部分要拿到 Electron 的 globalShortcut 和窗口动作。
 */

const DEFAULT_HOTKEY_BINDINGS = {
  lock: 'CommandOrControl+Shift+L',
  visible: 'CommandOrControl+Shift+H',
};
const HOTKEY_ACTIONS = Object.keys(DEFAULT_HOTKEY_BINDINGS);

/** 只接受字符串、去空白；没给的动作沿用默认值，空字符串表示这一项不绑定。 */
function normalizeHotkeyBindings(input) {
  const next = { ...DEFAULT_HOTKEY_BINDINGS };
  if (input && typeof input === 'object') {
    for (const action of HOTKEY_ACTIONS) {
      const value = input[action];
      if (typeof value === 'string') next[action] = value.trim();
    }
  }
  return next;
}

module.exports = {
  DEFAULT_HOTKEY_BINDINGS,
  HOTKEY_ACTIONS,
  normalizeHotkeyBindings,
};
