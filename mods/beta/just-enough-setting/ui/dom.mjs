// mods/Just-Enough-Setting/ui/dom.mjs
// 面板里用得到的最小 DOM 构件。
//
// 颜色一律不写死：文字沿用宿主面板继承下来的 color（Shadow DOM 会继承可继承属性），
// 中性底色 / 边框用半透明灰，这样明暗两套主题下都可读；强调色取宿主传进容器的
// --folium-accent。字体同样沿用 --folium-font。

export const TOKENS = Object.freeze({
  radius: '10px',
  border: '1px solid rgba(127, 127, 127, 0.26)',
  soft: 'rgba(127, 127, 127, 0.10)',
  softer: 'rgba(127, 127, 127, 0.06)',
  accent: 'var(--folium-accent, #8b5cf6)',
  font: 'var(--folium-font, inherit)',
  muted: '0.62',
});

/** 造元素：`el('div', { display: 'flex' }, child, child)`。style 用 camelCase 直接赋给 CSSStyleDeclaration。 */
export const el = (tag, style = null, ...children) => {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  children.forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.append(child);
  });
  return node;
};

/** 文本节点写入，值没变就不碰 DOM——诊断面板 2Hz 刷新时靠它保持零成本。 */
export const setText = (node, value) => {
  const text = value === null || value === undefined ? '' : String(value);
  if (node.textContent !== text) node.textContent = text;
};

/** 节流执行：返回的函数带 `cancel()`，卸载或外部改写配置时要取消挂起的这一次。 */
export const debounce = (fn, waitMs) => {
  let handle = null;
  const wrapped = (...args) => {
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      fn(...args);
    }, waitMs);
  };
  wrapped.cancel = () => {
    if (handle === null) return;
    clearTimeout(handle);
    handle = null;
  };
  return wrapped;
};

/** 小节标题。 */
export const createSection = (title, subtitle = null) => {
  const heading = el('div', { fontSize: '12px', fontWeight: '600', letterSpacing: '0.02em' }, title);
  const hint = subtitle ? el('div', { fontSize: '11px', opacity: TOKENS.muted, marginTop: '2px', lineHeight: '1.45' }, subtitle) : null;
  const head = el('div', { display: 'flex', flexDirection: 'column' }, heading, hint);
  const body = el('div', { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' });
  const root = el('section', {
    border: TOKENS.border,
    borderRadius: TOKENS.radius,
    padding: '10px 12px',
    background: TOKENS.softer,
  }, head, body);
  return { root, body };
};

/** 一行「标签 + 说明 + 控件」。 */
const createField = (label, description, control) => {
  const texts = el('div', { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '0' },
    el('div', { fontSize: '12px', lineHeight: '1.5' }, label),
    description ? el('div', { fontSize: '11px', opacity: TOKENS.muted, lineHeight: '1.45' }, description) : null);
  return el('label', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    cursor: 'pointer',
    fontFamily: TOKENS.font,
  }, texts, control);
};

/**
 * 竖排的「标签 + 说明 + 控件」：标签在上、控件占满整行。
 * 单行输入框用它——竖排时输入框能拿到整行宽度，横排会被说明文字挤成一条。
 */
const createStackedField = (label, description, control) => {
  const texts = el('div', { display: 'flex', flexDirection: 'column', gap: '2px' },
    el('div', { fontSize: '12px', lineHeight: '1.5' }, label),
    description ? el('div', { fontSize: '11px', opacity: TOKENS.muted, lineHeight: '1.45' }, description) : null);
  return el('label', { display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: TOKENS.font }, texts, control);
};

/** 开关。 */
export const createSwitch = ({ label, description, checked, onChange }) => {
  const input = el('input', { flex: '0 0 auto', width: '16px', height: '16px', accentColor: TOKENS.accent, cursor: 'pointer' });
  input.type = 'checkbox';
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onChange(input.checked));
  return {
    root: createField(label, description, input),
    setChecked(value) { if (input.checked !== Boolean(value)) input.checked = Boolean(value); },
  };
};

/** 下拉选择。 */
export const createSelect = ({ label, description, value, options, onChange }) => {
  const select = el('select', {
    flex: '0 0 auto',
    maxWidth: '62%',
    fontFamily: TOKENS.font,
    fontSize: '12px',
    padding: '4px 6px',
    borderRadius: '8px',
    border: TOKENS.border,
    background: TOKENS.soft,
    color: 'inherit',
    cursor: 'pointer',
  });
  options.forEach((option) => {
    const node = el('option', null, option.label);
    node.value = option.value;
    select.append(node);
  });
  select.value = String(value);
  select.addEventListener('change', () => onChange(select.value));
  return {
    root: createField(label, description, select),
    setValue(next) { select.value = String(next); },
  };
};

/** 滑杆 + 读数。拖动过程中就回报（input），松手（change）只是再确认一次同一个值。 */
export const createSlider = ({ label, description, value, min, max, step, onChange, format = (v) => String(v) }) => {
  const readout = el('span', {
    flex: '0 0 auto',
    minWidth: '52px',
    textAlign: 'right',
    fontSize: '11px',
    fontVariantNumeric: 'tabular-nums',
    opacity: '0.85',
  }, format(value));
  const input = el('input', { flex: '1 1 auto', minWidth: '90px', accentColor: TOKENS.accent, cursor: 'pointer' });
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);

  const emit = () => {
    const next = Number(input.value);
    setText(readout, format(next));
    onChange(next);
  };
  input.addEventListener('input', emit);
  const control = el('div', { display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', maxWidth: '62%' }, input, readout);
  return {
    root: createField(label, description, control),
    setValue(next) {
      input.value = String(next);
      setText(readout, format(next));
    },
  };
};

const BUTTON_BASE = {
  fontFamily: TOKENS.font,
  fontSize: '11px',
  lineHeight: '1.4',
  padding: '4px 9px',
  borderRadius: '8px',
  border: TOKENS.border,
  background: TOKENS.soft,
  color: 'inherit',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
};

export const createButton = ({ label, onClick, title = null, disabled = false }) => {
  const button = el('button', { ...BUTTON_BASE, opacity: disabled ? '0.45' : '1' }, label);
  button.type = 'button';
  button.disabled = Boolean(disabled);
  if (title) button.title = title;
  button.addEventListener('click', onClick);
  return button;
};

/**
 * 二次确认按钮：第一次点击变成确认文案，再点才会执行，超时或移出即复位。
 * 模组不用原生 confirm——它会打断渲染进程，而且样式和面板完全脱节。
 */
export const createConfirmButton = ({ label, confirmLabel, onConfirm, onCancel = null, timeoutMs = 4000 }) => {
  const button = createButton({ label, onClick: () => {} });
  let armed = false;
  let timer = null;

  const reset = () => {
    armed = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    button.textContent = label;
    button.style.borderColor = 'rgba(127, 127, 127, 0.26)';
    onCancel?.();
  };

  button.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      button.textContent = confirmLabel;
      button.style.borderColor = TOKENS.accent;
      timer = setTimeout(reset, timeoutMs);
      return;
    }
    reset();
    onConfirm();
  });
  button.addEventListener('blur', reset);
  return button;
};

/**
 * 给按钮贴上宿主的 lucide 图标（folium.ui.icon 是异步的，1.2 起才有）。
 * 图标到位前先显示一个字形兜底，到位后替换；拿不到或按钮已经卸载就保持字形。
 */
export const attachIcon = (folium, button, { name, glyph, size = 13 }) => {
  if (glyph && !button.textContent) button.textContent = glyph;
  const icon = folium?.ui?.icon;
  if (typeof icon !== 'function') return;
  Promise.resolve(icon.call(folium.ui, name, { size }))
    .then((svg) => {
      // 按钮可能在图标解析期间就被卸载（切预设、关面板）；脱离文档的节点不该再被写。
      if (!svg || !button.isConnected) return;
      button.replaceChildren(svg);
    })
    .catch(() => { /* 图标是锦上添花，拿不到就保留字形 */ });
};

/** 可折叠区块（导入 / 导出用）。 */
export const createDisclosure = (summaryText) => {
  const root = el('details', {
    border: TOKENS.border,
    borderRadius: TOKENS.radius,
    padding: '8px 12px',
    background: TOKENS.softer,
  });
  const summary = el('summary', { cursor: 'pointer', fontSize: '12px', fontWeight: '600' }, summaryText);
  const body = el('div', { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' });
  root.append(summary, body);
  return { root, body };
};

/** 多行文本框。 */
export const createTextarea = ({ value = '', rows = 6, readOnly = false, placeholder = '' }) => {
  const textarea = el('textarea', {
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '11px',
    lineHeight: '1.5',
    padding: '6px 8px',
    borderRadius: '8px',
    border: TOKENS.border,
    background: TOKENS.soft,
    color: 'inherit',
    resize: 'vertical',
  });
  textarea.rows = rows;
  textarea.readOnly = readOnly;
  textarea.placeholder = placeholder;
  textarea.value = value;
  textarea.spellcheck = false;
  return textarea;
};

/** 一行按钮排布。 */
export const createButtonRow = (...children) => el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }, ...children);

/**
 * 单行输入框。竖排布局（标签在上），输入框占满整行。
 *
 * `type: 'password'` 用它来收密码：值只待在调用方的闭包里，这里不做任何缓存或落盘。
 * 回车等价于按下主操作按钮（`onEnter`），省得登录时还要去够鼠标。
 */
export const createTextInput = ({
  label,
  description = null,
  value = '',
  placeholder = '',
  type = 'text',
  maxLength = null,
  onChange = null,
  onEnter = null,
}) => {
  const input = el('input', {
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: TOKENS.font,
    fontSize: '12px',
    padding: '5px 8px',
    borderRadius: '8px',
    border: TOKENS.border,
    background: TOKENS.soft,
    color: 'inherit',
  });
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.spellcheck = false;
  // 账号名会随配置导出去，系统级自动填充/保存提示在这里只会碍事。
  input.autocomplete = 'off';
  if (maxLength !== null) input.maxLength = maxLength;
  input.addEventListener('input', () => onChange?.(input.value));
  if (onEnter) {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      onEnter(input.value);
    });
  }
  return {
    root: createStackedField(label, description, input),
    input,
    get value() { return input.value; },
    setValue(next) {
      const text = String(next ?? '');
      if (input.value !== text) input.value = text;
    },
  };
};

/**
 * 复制到剪贴板。失败时退回「选中元素 + execCommand」——打包版从 file:// 加载页面，
 * 这种上下文里 navigator.clipboard 可能被拒。没有可选中元素时只能如实返回失败。
 */
export const copyText = async (text, fallbackElement = null) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 继续走退路 */ }
  if (!fallbackElement) return false;
  try {
    fallbackElement.focus();
    fallbackElement.select?.();
    return document.execCommand('copy');
  } catch {
    return false;
  }
};
