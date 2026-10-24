import { DEFAULTS, DEFAULT_RULES, parseRules, selectMode, validBpm } from './rules.mjs';

const STYLE = `
:host{color:var(--folium-primary,#e8edf5);font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}
*{box-sizing:border-box}.bpm-panel{max-width:1040px;margin:auto;padding:26px 24px 40px;color:var(--folium-primary,#e8edf5)}
h1,h2,p{margin:0}h1{font-size:25px;letter-spacing:-.6px}h2{font-size:15px;margin-bottom:12px}.muted{color:var(--folium-secondary,#9aa8bd);font-size:12px}.header{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:20px}
.card{background:color-mix(in srgb,var(--folium-primary,#dce7f8) 4%,transparent);border:1px solid color-mix(in srgb,var(--folium-primary,#dce7f8) 13%,transparent);border-radius:14px;padding:20px;margin-bottom:16px}
.status{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px}.song{font-size:19px;font-weight:650;overflow-wrap:anywhere}.bpm-number{font-size:42px;letter-spacing:-2px;font-weight:700;line-height:1.1;color:var(--folium-accent,#95c5fc)}.bpm-display{text-align:right;min-width:140px}.bpm-status{margin-top:10px;font-size:13px}.message{margin-top:5px;color:var(--folium-secondary,#9aa8bd);overflow-wrap:anywhere}
button,input,select{font:inherit;color:inherit}button,select,input[type=number]{border:1px solid color-mix(in srgb,var(--folium-primary,#dce7f8) 18%,transparent);background:color-mix(in srgb,var(--folium-bg,#111925) 85%,#7b8b9e 15%);border-radius:7px;padding:8px 11px;outline:none}input:focus,select:focus,button:focus-visible{border-color:var(--folium-accent,#95c5fc);box-shadow:0 0 0 2px #7cb7ff22}button{cursor:pointer;white-space:nowrap}button:disabled{opacity:.45;cursor:default}.primary{background:var(--folium-accent,#95c5fc);color:#102033;border-color:transparent;font-weight:650}.actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}.actions input{width:105px}.rule-head,.rule-row{display:grid;grid-template-columns:92px 20px 92px minmax(140px,1fr) auto auto;gap:9px;align-items:center}.rule-head{font-size:12px;color:var(--folium-secondary,#9aa8bd);margin-bottom:8px}.rule-row{margin-bottom:9px}.rule-row input,.rule-row select{width:100%;min-width:0}.rule-row button{padding:7px 9px}.small{font-size:12px}.divider{height:1px;background:#7f94aa33;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px 24px}.field{display:flex;align-items:center;justify-content:space-between;gap:14px}.field span{font-size:13px}.field input[type=number]{width:90px}.field select{max-width:180px}.field input[type=checkbox]{accent-color:var(--folium-accent,#95c5fc);width:18px;height:18px}.error{color:#f3a0a8}.feedback{min-height:24px;margin-top:12px;font-size:13px}.badge{font-size:11px;padding:4px 8px;border-radius:16px;background:#7cb7ff18;color:var(--folium-accent,#95c5fc)}.footer{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.footer .feedback{margin:0 0 0 6px}.test-line{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:18px}.test-line input{width:90px}.test-result{font-size:12px;color:var(--folium-secondary,#9aa8bd)}
@media(max-width:650px){.bpm-panel{padding:16px 12px}.card{padding:15px}.grid{grid-template-columns:1fr}.rule-head,.rule-row{grid-template-columns:65px 12px 65px minmax(88px,1fr) auto}.rule-row .split{display:none}.rule-head .split{display:none}.rule-row button{padding:7px 5px}.rule-row input,.rule-row select{padding:8px 5px}.bpm-number{font-size:34px}.bpm-display{min-width:100px}.status{gap:10px}.song{font-size:16px}}
`;

export function mountPanel(container, { engine, settings, host }) {
  const doc = container.ownerDocument || document;
  const style = doc.createElement('style'); style.textContent = STYLE;
  const root = doc.createElement('section'); root.className = 'bpm-panel';
  root.innerHTML = `<header class="header"><div><h1>BPM 歌词样式导演</h1><p class="muted">让歌曲速度决定这一首的歌词动画</p></div><span class="badge">本地运行 · 无需 AI</span></header>
  <div class="card"><div class="status"><div><div class="muted">正在播放</div><div class="song" data-id="song">等待歌曲</div><div class="muted" data-id="artist"></div></div><div class="bpm-display"><div class="bpm-number" data-id="bpm">—</div><span class="muted">BPM</span><div class="muted" data-id="source"></div></div></div><div class="bpm-status" data-id="phase"></div><div class="message small" data-id="message"></div><div class="actions"><button data-id="analyze">重新检测</button><button data-id="apply">立即应用</button><span class="muted">单曲校正</span><input data-id="manual" type="number" min="30" max="360" step="0.1" placeholder="填写 BPM" aria-label="当前歌曲手动 BPM"><button data-id="manual-save">保存 BPM</button><button data-id="manual-clear">清除校正</button><button data-id="half">÷2</button><button data-id="double">×2</button></div></div>
  <div class="card"><h2>BPM 区间 → 歌词样式</h2><p class="muted">下限包含，上限不包含。例如 120 BPM 使用从 120 开始的区间。样式来自当前播放器，含第三方模组。</p><div class="divider"></div><div class="rule-head"><span>下限</span><span></span><span>上限</span><span>歌词样式</span><span class="split"></span><span></span></div><div data-id="rules"></div><div class="actions"><button data-id="add">新增区间</button><button data-id="defaults">恢复默认区间</button></div><div class="test-line"><span class="muted">试算 BPM</span><input data-id="test-bpm" type="number" min="30" max="360" value="128" aria-label="试算 BPM"><button data-id="test">查看匹配</button><span class="test-result" data-id="test-result">只预览规则，不改变正在播放的样式</span></div></div>
  <div class="card"><h2>自动切换与检测</h2><div class="grid" data-id="options"></div><div class="divider"></div><p class="muted">BPM 是速度，不代表情绪。自动估算可能有半拍或倍拍歧义；可用上方 ÷2 / ×2 校正。未知或低置信度时默认保留当前样式。</p></div>
  <div class="footer"><button class="primary" data-id="save">保存设置</button><button data-id="clear-memory">清理自动检测记忆</button><span class="feedback" data-id="feedback" role="status"></span></div>`;
  container.append(style, root);
  const get = id => root.querySelector(`[data-id="${id}"]`);
  let draft, controls = {}, disposed = false, dirty = false, displayedKey = null;
  const events = [];
  const listen = (element, event, fn) => { element.addEventListener(event, fn); events.push(() => element.removeEventListener(event, fn)); };
  const button = (text, handler, className = '') => { const b = doc.createElement('button'); b.textContent = text; b.className = className; b.type = 'button'; listen(b, 'click', handler); return b; };
  const feedback = (message, error = false) => { if (disposed) return; get('feedback').textContent = message; get('feedback').className = 'feedback' + (error ? ' error' : ''); };
  const run = fn => async () => { try { await fn(); } catch (error) { feedback(error.message, true); } };
  const modeSelect = value => {
    const select = doc.createElement('select'); select.setAttribute('aria-label', '歌词样式');
    const modes = host.modes();
    if (!modes.some(x => x.id === value)) modes.push({ id: value, label: value + '（未加载）' });
    for (const mode of modes) { const option = doc.createElement('option'); option.value = mode.id; option.textContent = mode.label; select.append(option); }
    select.value = value; return select;
  };
  function drawRules() {
    get('rules').replaceChildren();
    draft.forEach((rule, index) => {
      const row = doc.createElement('div'); row.className = 'rule-row';
      for (const field of ['min', 'separator', 'max']) {
        if (field === 'separator') { const s = doc.createElement('span'); s.textContent = '–'; s.className = 'muted'; row.append(s); continue; }
        const input = doc.createElement('input'); input.type = 'number'; input.min = '30'; input.max = '361'; input.step = '1'; input.value = rule[field]; input.setAttribute('aria-label', `区间 ${index + 1} ${field === 'min' ? '下限' : '上限'}`);
        listen(input, 'input', () => { rule[field] = input.value; dirty = true; }); row.append(input);
      }
      const select = modeSelect(rule.mode); listen(select, 'change', () => { rule.mode = select.value; dirty = true; }); row.append(select);
      row.append(button('拆分', () => {
        const middle = Math.floor((Number(rule.min) + Number(rule.max)) / 2);
        if (middle <= Number(rule.min)) return feedback('这个区间过小，无法拆分。', true);
        const end = rule.max; rule.max = middle; draft.splice(index + 1, 0, { min: middle, max: end, mode: rule.mode }); dirty = true; drawRules();
      }, 'split'));
      row.append(button('删除', () => { draft.splice(index, 1); dirty = true; drawRules(); }));
      get('rules').append(row);
    });
  }
  const definitions = [
    ['enabled', '开启按 BPM 自动切换', 'checkbox'], ['respectManual', '本曲手动切换后暂停自动', 'checkbox'],
    ['autoAnalyze', '没有 BPM 时自动检测', 'checkbox'], ['allowOnline', '允许额外读取在线播放音频', 'checkbox'],
    ['restoreOnDisable', '停用时恢复之前的样式', 'checkbox'], ['minConfidence', '估算置信度门槛（0–1）', 'number', 0, 1, 0.05],
    ['sampleSeconds', '分析时长（秒）', 'number', 20, 120, 10], ['maxFileMiB', '分析文件上限（MiB）', 'number', 16, 256, 16],
  ];
  function drawOptions(values) {
    get('options').replaceChildren(); controls = {};
    for (const [key, label, type, min, max, step] of definitions) {
      const row = doc.createElement('label'); row.className = 'field'; const text = doc.createElement('span'); text.textContent = label;
      const input = doc.createElement('input'); input.type = type; input.setAttribute('aria-label', label);
      if (type === 'checkbox') input.checked = values[key];
      else { input.value = values[key]; input.min = min; input.max = max; input.step = step; }
      listen(input, 'change', () => { dirty = true; }); controls[key] = input; row.append(text, input); get('options').append(row);
    }
    const row = doc.createElement('label'); row.className = 'field'; const text = doc.createElement('span'); text.textContent = '未知 / 低置信度时';
    const select = modeSelect(values.unknownMode); const keep = doc.createElement('option'); keep.value = 'keep'; keep.textContent = '保留当前样式';
    const duplicate = [...select.options].find(x => x.value === 'keep'); duplicate?.remove(); select.prepend(keep); select.value = values.unknownMode;
    listen(select, 'change', () => { dirty = true; }); controls.unknownMode = select; row.append(text, select); get('options').append(row);
  }
  const load = () => {
    const values = { ...DEFAULTS, ...settings.get() };
    try { draft = parseRules(values.rulesJson).map(({ min, max, mode }) => ({ min, max, mode })); }
    catch { draft = DEFAULT_RULES.map(x => ({ ...x })); }
    drawRules(); drawOptions(values); dirty = false;
  };
  load();
  const off = engine.subscribe(state => {
    if (disposed) return;
    get('song').textContent = state.context?.title || '等待歌曲'; get('artist').textContent = state.context?.artist || '';
    get('bpm').textContent = state.result?.bpm ?? '—';
    get('source').textContent = state.result ? state.result.source + (state.result.cached ? ' · 已记忆' : '') + (state.result.confidence === null ? '' : ` · 置信度 ${state.result.confidence}`) : '';
    get('phase').textContent = state.phase; get('message').textContent = state.message;
    get('analyze').disabled = !state.context || validBpm(state.manualBpm);
    get('manual-clear').disabled = !validBpm(state.manualBpm);
    for (const id of ['apply', 'manual-save', 'half', 'double']) get(id).disabled = !state.context;
    const activeElement = root.getRootNode().activeElement || doc.activeElement;
    if (state.context?.key !== displayedKey) {
      displayedKey = state.context?.key; get('manual').value = state.manualBpm ?? '';
    } else if (activeElement !== get('manual') && state.manualBpm) get('manual').value = state.manualBpm;
  });
  listen(get('analyze'), 'click', run(() => engine.refresh({ force: true, reanalyze: true })));
  listen(get('apply'), 'click', run(() => engine.refresh({ force: true })));
  listen(get('manual-save'), 'click', run(() => engine.setManual(Number(get('manual').value))));
  listen(get('manual-clear'), 'click', run(async () => { get('manual').value = ''; await engine.setManual(null); }));
  for (const [id, factor] of [['half', 0.5], ['double', 2]]) listen(get(id), 'click', run(async () => {
    const bpm = engine.state().result?.bpm || Number(get('manual').value);
    if (!validBpm(bpm * factor)) throw new Error('请先检测或填写有效 BPM。');
    get('manual').value = Math.round(bpm * factor * 10) / 10;
    await engine.setManual(Number(get('manual').value));
  }));
  listen(get('save'), 'click', run(() => {
    const rules = parseRules(draft, host.modes()).map(({ min, max, mode }) => ({ min, max, mode }));
    const patch = { rulesJson: JSON.stringify(rules) };
    for (const [key, input] of Object.entries(controls)) patch[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
    settings.set(patch); dirty = false; feedback('已保存，新规则会用于当前歌曲和后续歌曲。');
  }));
  listen(get('add'), 'click', () => { const min = Math.min(330, Number(draft.at(-1)?.max || 30)); draft.push({ min, max: Math.min(361, min + 30), mode: host.modes()[0]?.id || 'classic' }); dirty = true; drawRules(); feedback('请调整区间，避免与已有区间重叠。'); });
  listen(get('defaults'), 'click', () => { draft = DEFAULT_RULES.map(x => ({ ...x })); dirty = true; drawRules(); feedback('默认区间已载入，点击保存后生效。'); });
  listen(get('test'), 'click', run(() => {
    const bpm = Number(get('test-bpm').value); if (!validBpm(bpm)) throw new Error('试算 BPM 应在 30–360 之间。');
    const selected = selectMode(bpm, parseRules(draft, host.modes()), host.modes());
    get('test-result').textContent = selected.mode ? `${bpm} BPM → ${host.modes().find(x => x.id === selected.mode)?.label}` : selected.reason;
  }));
  listen(get('clear-memory'), 'click', run(async () => { await engine.clearMemory(); feedback('自动检测记忆已清理，手动校正保留。'); }));
  const offSettings = settings.onChange(() => { if (!dirty) load(); });
  return () => { disposed = true; off(); offSettings(); events.forEach(fn => fn()); root.remove(); style.remove(); };
}
