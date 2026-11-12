// mods/Just-Enough-Setting/ui/fragment-list.mjs
// 一个目标栏的片段编辑器：拖拽排序、增删、就地编辑自定义文本、实时预览。
//
// 拖拽只挂在左侧手柄上（而不是整个 chip）：chip 里有输入框，整块可拖会让「选中输入框里的
// 文字」变成「拖动这一项」。手柄之外的部位照常可以点、可以选。
//
// 重画策略：
//   - 只有增删改序这类结构性操作才重建 DOM；输入字符不重建，否则每敲一个字就丢焦点；
//   - 结构性操作推迟到 dragend 才执行——在 drop 里立刻重建会把正在被拖的节点拆掉，
//     dragend 随之丢失，拖拽状态就留在半路上了；
//   - 父级只在预设 / 导入 / 重置之后调用 update() 重建，编辑过程中的每次输入都不会触发重画。

// 同级导入带上入口的 ?v=<内容摘要>：渲染进程的 ES 模块表按完整 URL 缓存，相对导入解析出来的 URL
// 会丢掉查询串，改完代码重载模组时会命中旧模块。详见 client.mjs 顶部说明。
const VERSION = new URL(import.meta.url).search;

const {
  CUSTOM_TEXT_KINDS, FRAGMENT_KINDS, MAX_CUSTOM_TEXT_LENGTH, MAX_FRAGMENTS_PER_TARGET,
} = await import(`../lib/config.mjs${VERSION}`);
const { composeTarget, visualizeSpaces } = await import(`../lib/compose.mjs${VERSION}`);
const { TOKENS, attachIcon, createButton, debounce, el, setText } = await import(`./dom.mjs${VERSION}`);

const IDLE_BORDER = 'rgba(127, 127, 127, 0.26)';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * 新建片段时的初始自定义文本：连接符给一个马上能用的分隔符，其余留空等用户填
 * （进度条片段的空文本表示「用默认模板」，不是「输出空字符串」）。
 */
const defaultTextFor = (kind) => (kind === 'connector' ? ' - ' : '');

export const createFragmentList = ({ folium, t, target, fragments, getContext, onChange }) => {
  let items = fragments.map((fragment) => ({ ...fragment }));
  let dragIndex = null;
  let pendingMove = null;

  const preview = el('div', {
    fontSize: '11px',
    opacity: '0.8',
    lineHeight: '1.5',
    wordBreak: 'break-all',
    minHeight: '1.4em',
  });
  // 两端空白（最典型的就是「把连接符做成一个空格」）在普通预览里完全看不见，这里补一份可见化对照。
  const previewQuoted = el('div', {
    fontFamily: MONO,
    fontSize: '10px',
    lineHeight: '1.4',
    opacity: '0.5',
    wordBreak: 'break-all',
  });
  const previewBox = el('div', {
    display: 'flex',
    flexDirection: 'column',
    padding: '6px 8px',
    borderRadius: '8px',
    background: TOKENS.softer,
    border: TOKENS.border,
    marginBottom: '8px',
  }, el('div', { fontSize: '10px', opacity: '0.5', letterSpacing: '0.04em', marginBottom: '2px' }, t('hint.preview')), preview, previewQuoted);

  const chips = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' });
  const progressHint = el('div', { fontSize: '10px', lineHeight: '1.45', opacity: TOKENS.muted, marginTop: '6px' }, t('hint.progressTemplate'));
  const addRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' });
  const root = el('div', { display: 'flex', flexDirection: 'column' }, previewBox, chips, progressHint, addRow);

  const context = () => (typeof getContext === 'function' ? getContext() : {});
  const clone = () => items.map((fragment) => ({ ...fragment }));

  const refreshPreview = () => {
    const text = composeTarget(items, context());
    setText(preview, text);
    const keepsEdgeWhitespace = text !== '' && (text !== text.trimStart() || text !== text.trimEnd());
    setText(previewQuoted, keepsEdgeWhitespace ? `${t('hint.edgeSpace')} “${visualizeSpaces(text)}”` : '');
  };

  // 输入字符时的落盘节流。它在触发时读最新的 items，所以永远写的是当前模型，不会用旧数组覆盖。
  const flushInput = debounce(() => onChange(clone()), 200);

  /** 把当前模型交给父级持久化并重建列表。 */
  const commit = (next) => {
    flushInput.cancel();
    items = next;
    onChange(clone());
    render();
  };

  const move = (from, to) => {
    if (from === null || from === to || from === to - 1) return;
    if (from < 0 || from >= items.length) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(from < to ? to - 1 : to, next.length)), 0, moved);
    commit(next);
  };

  const shift = (index, delta) => {
    const destination = index + delta;
    if (destination < 0 || destination >= items.length) return;
    const next = items.slice();
    [next[index], next[destination]] = [next[destination], next[index]];
    commit(next);
  };

  const createChip = (fragment, index) => {
    const handle = el('span', {
      cursor: 'grab',
      opacity: '0.45',
      fontSize: '12px',
      lineHeight: '1',
      padding: '0 2px',
      userSelect: 'none',
    });
    handle.draggable = true;
    handle.title = t('fragment.drag');
    handle.setAttribute('aria-label', t('fragment.drag'));
    attachIcon(folium, handle, { name: 'grip-vertical', glyph: '⠿', size: 12 });

    const parts = [handle, el('span', { opacity: '0.9', whiteSpace: 'nowrap' }, t(`fragment.${fragment.kind}`))];

    if (CUSTOM_TEXT_KINDS.includes(fragment.kind)) {
      const isTemplate = fragment.kind === 'progress';
      const input = el('input', {
        flex: isTemplate ? '1 1 120px' : '1 1 60px',
        width: isTemplate ? '158px' : '72px',
        minWidth: '48px',
        fontFamily: isTemplate ? MONO : TOKENS.font,
        fontSize: '11px',
        padding: '2px 5px',
        borderRadius: '6px',
        border: TOKENS.border,
        background: TOKENS.softer,
        color: 'inherit',
      });
      input.type = 'text';
      input.value = fragment.text ?? '';
      input.maxLength = MAX_CUSTOM_TEXT_LENGTH;
      // 进度条的文本是模板；连接符 / 网站名称的文本就是它输出的文本。占位符各说各的。
      input.placeholder = isTemplate ? t('fragment.progressPlaceholder') : t('fragment.customPlaceholder');
      input.title = isTemplate ? t('fragment.progressTitle') : t('fragment.spaceHint');
      input.spellcheck = false;
      input.addEventListener('input', () => {
        // 模型同步更新（这样预览和随后的重建都拿到最新文本），落盘走节流。
        items = items.map((item, i) => (i === index ? { ...item, text: input.value } : item));
        refreshPreview();
        flushInput();
      });
      // 点进输入框选字时临时关掉手柄拖拽，避免选中操作被当成拖动。
      input.addEventListener('pointerdown', () => { handle.draggable = false; });
      input.addEventListener('blur', () => { handle.draggable = true; });
      parts.push(input);
    }

    if (items.length > 1) {
      const left = createButton({ label: '◀', title: t('fragment.moveLeft'), onClick: () => shift(index, -1) });
      const right = createButton({ label: '▶', title: t('fragment.moveRight'), onClick: () => shift(index, 1) });
      left.style.padding = '2px 5px';
      right.style.padding = '2px 5px';
      parts.push(el('span', { display: 'inline-flex', gap: '2px' }, left, right));
    }

    const remove = createButton({ label: '✕', title: t('fragment.remove'), onClick: () => commit(items.filter((_, i) => i !== index)) });
    remove.style.padding = '2px 6px';
    parts.push(remove);

    const chip = el('div', {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 4px 3px 6px',
      borderRadius: '8px',
      border: TOKENS.border,
      background: TOKENS.soft,
      fontSize: '11px',
      maxWidth: '100%',
    }, ...parts);

    chip.addEventListener('dragover', (event) => {
      if (dragIndex === null) return;
      event.preventDefault();
      const rect = chip.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      // 用边框高低半段示意插入位置，比插一条伪元素省事，也不会挤动布局。
      chip.style.borderColor = before ? TOKENS.accent : IDLE_BORDER;
      chip.style.borderRightColor = before ? IDLE_BORDER : TOKENS.accent;
    });
    chip.addEventListener('dragleave', () => {
      chip.style.borderColor = IDLE_BORDER;
      chip.style.borderRightColor = IDLE_BORDER;
    });
    chip.addEventListener('drop', (event) => {
      if (dragIndex === null) return;
      event.preventDefault();
      const rect = chip.getBoundingClientRect();
      const before = event.clientX < rect.left + rect.width / 2;
      // 只记账，不立刻动 DOM：等 dragend 再真正重排（见文件头）。
      pendingMove = { from: dragIndex, to: index + (before ? 0 : 1) };
    });

    handle.addEventListener('dragstart', (event) => {
      dragIndex = index;
      chip.style.opacity = '0.5';
      try {
        event.dataTransfer.effectAllowed = 'move';
        // Chromium 里没有数据就不会真正开始拖拽。
        event.dataTransfer.setData('text/plain', String(index));
      } catch { /* dataTransfer 不可写时不影响拖拽本身 */ }
    });
    handle.addEventListener('dragend', () => {
      chip.style.opacity = '1';
      chip.style.borderColor = IDLE_BORDER;
      chip.style.borderRightColor = IDLE_BORDER;
      dragIndex = null;
      const action = pendingMove;
      pendingMove = null;
      if (action) move(action.from, action.to);
    });

    return chip;
  };

  const render = () => {
    chips.replaceChildren(...items.map(createChip));
    if (items.length === 0) {
      chips.append(el('div', { fontSize: '11px', opacity: TOKENS.muted, fontStyle: 'italic' }, t('hint.empty')));
    }
    // 占位符说明只在真的用到进度条片段时出现，平时不占版面。
    progressHint.style.display = items.some((fragment) => fragment.kind === 'progress') ? '' : 'none';
    addRow.style.marginTop = items.length > 0 ? '8px' : '6px';

    const kindSelect = el('select', {
      fontFamily: TOKENS.font,
      fontSize: '11px',
      padding: '4px 6px',
      borderRadius: '8px',
      border: TOKENS.border,
      background: TOKENS.soft,
      color: 'inherit',
      cursor: 'pointer',
    });
    kindSelect.setAttribute('aria-label', t('fragment.addPlaceholder'));
    kindSelect.title = t('fragment.addPlaceholder');
    FRAGMENT_KINDS.forEach((kind) => {
      const option = el('option', null, t(`fragment.${kind}`));
      option.value = kind;
      kindSelect.append(option);
    });

    const exhausted = items.length >= MAX_FRAGMENTS_PER_TARGET;
    const add = createButton({
      label: t('fragment.add'),
      disabled: exhausted,
      onClick: () => {
        if (exhausted) return;
        const kind = kindSelect.value;
        commit([...items, CUSTOM_TEXT_KINDS.includes(kind) ? { kind, text: defaultTextFor(kind) } : { kind }]);
      },
    });
    addRow.replaceChildren(kindSelect, add);
    refreshPreview();
  };

  // 列表里的空白也算落点：拖到末尾外的区域时兜住这一下。
  chips.addEventListener('dragover', (event) => {
    if (dragIndex === null || event.target !== chips) return;
    event.preventDefault();
    pendingMove = { from: dragIndex, to: items.length };
  });
  chips.addEventListener('drop', (event) => {
    if (dragIndex === null || event.target !== chips) return;
    event.preventDefault();
    pendingMove = { from: dragIndex, to: items.length };
  });

  render();

  return {
    root,
    target,
    refreshPreview,
    /** 外部（预设、导入、重置）改了编排后重建。 */
    update(next) {
      flushInput.cancel();
      items = next.map((fragment) => ({ ...fragment }));
      render();
    },
  };
};
