'use strict';

/**
 * 通用取色组件（原生 JS，无依赖）。
 * 用法：
 *   const picker = DLColorPicker.create();
 *   picker.open(anchorEl, {
 *     gradient: true,               // 是否支持单色/渐变切换
 *     getState: () => ({ gradient, stops: [{ color, pos }], angle }),
 *     onChange: (state) => { ... }, // state 同 getState 结构
 *   });
 *   picker.refresh(); // 外部状态变化后同步
 *   picker.close();
 */
(function () {
  // ---------------------------------------------------------------- 颜色工具
  function clamp255(v) { return Math.max(0, Math.min(255, Math.round(Number(v) || 0))); }

  function parseColor(v) {
    const s = String(v || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) {
      const n = parseInt(m[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) {
      const h = m[1];
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a: 1,
      };
    }
    m = /^rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*(?:[,/]\s*([0-9.]+%?))?\s*\)$/i.exec(s);
    if (m) {
      let a = 1;
      if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (!Number.isFinite(a)) a = 1;
      return {
        r: clamp255(m[1]), g: clamp255(m[2]), b: clamp255(m[3]),
        a: Math.max(0, Math.min(1, a)),
      };
    }
    return null;
  }

  function toCss(c) {
    if (!c) return '';
    const hex = '#' + [c.r, c.g, c.b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
      .join('');
    if (c.a >= 1) return hex;
    return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round(c.a * 100) / 100})`;
  }

  function normColor(v) { return toCss(parseColor(v)); }

  function rgbToHsv(r, g, b) {
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === rr) h = ((gg - bb) / d) % 6;
      else if (max === gg) h = (bb - rr) / d + 2;
      else h = (rr - gg) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m2 = v - c;
    return { r: Math.round((r + m2) * 255), g: Math.round((g + m2) * 255), b: Math.round((b + m2) * 255) };
  }

  /** stops: [{color, pos}]，pos ∈ [0,1]，返回 linear-gradient CSS 串。 */
  function gradientCss(stops, angle) {
    if (!stops || !stops.length) return '';
    if (stops.length === 1) return stops[0].color;
    const parts = stops.map((st) => `${st.color} ${Math.round(st.pos * 1000) / 10}%`);
    return `linear-gradient(${Math.round(angle || 0)}deg, ${parts.join(', ')})`;
  }

  /** 在渐变上按位置插值出一个颜色。 */
  function interpolate(stops, pos) {
    if (!stops || !stops.length) return '#ffffff';
    if (stops.length === 1) return stops[0].color;
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (pos >= stops[i].pos && pos <= stops[i + 1].pos) { lo = stops[i]; hi = stops[i + 1]; break; }
    }
    const a = parseColor(lo.color), b = parseColor(hi.color);
    if (!a || !b) return lo.color;
    const span = (hi.pos - lo.pos) || 1;
    const t = Math.min(1, Math.max(0, (pos - lo.pos) / span));
    const mix = (x, y) => Math.round(x + (y - x) * t);
    return toCss({ r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b), a: a.a + (b.a - a.a) * t });
  }

  // ---------------------------------------------------------------- 样式
  let styleInjected = false;
  function ensureStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const css = [
      '.dl-cp-pop{position:fixed;z-index:40;width:350px;padding:10px;border-radius:10px;background:#2f3140;border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:8px;overflow:hidden auto;}',
      '.dl-cp-pop[hidden]{display:none;}',
      '.dl-cp-modrow{display:flex;align-items:center;gap:6px;justify-content:space-between;}',
      '.dl-cp-mode{flex:none;width:60%;display:flex;border:1px solid rgba(255,255,255,.2);border-radius:8px;overflow:hidden;}',
      '.dl-cp-mode button{flex:1;height:26px;border:none;background:transparent;color:rgba(255,255,255,.6);font-size:11.5px;line-height:1;cursor:pointer;}',
      '.dl-cp-mode button.on{background:#1677ff;color:#fff;}',
      '.dl-cp-reset{width:26px;height:26px;flex:none;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.7);font-size:13px;line-height:1;cursor:pointer;}',
      '.dl-cp-reset:hover{background:rgba(255,255,255,.1);color:#fff;}',
      '.dl-cp-board{position:relative;height:150px;border-radius:8px;border:none;cursor:default;touch-action:none;overflow:hidden;}',
      '.dl-cp-dot{position:absolute;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.55);transform:translate(-50%,-50%);pointer-events:none;margin:0;}',
      '.dl-cp-dot-sm{width:12px;height:12px;top:50%;}',
      '.dl-cp-hue,.dl-cp-alpha{position:relative;height:10px;border-radius:999px;cursor:pointer;touch-action:none;}',
      '.dl-cp-hue{background:linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%);}',
      '.dl-cp-checker{background-image:repeating-conic-gradient(rgba(255,255,255,.3) 0% 25%,rgba(255,255,255,.1) 0% 50%);background-size:10px 10px;}',
      '.dl-cp-alpha-fill{position:absolute;inset:0;border-radius:999px;}',
      '.dl-cp-tworow{display:flex;align-items:center;gap:8px;}',
      '.dl-cp-tworow-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;}',
      '.dl-cp-preview{position:relative;width:30px;height:30px;border-radius:6px;border:1px solid rgba(255,255,255,.25);flex:none;overflow:hidden;}',
      '.dl-cp-preview-fill{position:absolute;inset:0;}',
      '.dl-cp-gradpreview{position:relative;height:10px;border-radius:999px;border:none;}',
      '.dl-cp-gradfill{position:absolute;inset:0;border-radius:999px;}',
      '.dl-cp-stopdot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.72);box-shadow:0 0 3px rgba(0,0,0,.5);cursor:pointer;pointer-events:auto;margin:0;}',
      '.dl-cp-stopdot.on{width:13px;height:13px;border-color:#fff;box-shadow:0 0 5px rgba(0,0,0,.65);}',
      '.dl-cp-hexrow{display:flex;align-items:center;gap:6px;}',
      '.dl-cp-format{flex:none;width:auto;min-width:52px;height:26px;line-height:22px;padding:0 20px 0 8px;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:rgba(0,0,0,.28);color:#f0f0f2;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\" viewBox=\"0 0 10 10\"><path d=\"M2 3.5 L5 6.5 L8 3.5\" fill=\"none\" stroke=\"%23c0c0c0\" stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>");background-repeat:no-repeat;background-position:right 6px center;background-size:10px 10px;}',
      '.dl-cp-format:focus{outline:none;border-color:rgba(255,255,255,.16);}',
      '.dl-cp-format option{background:#2f3140;color:#f0f0f2;}',
      '.dl-cp-format option:checked{background:#2f3140;color:#fff;}',
      '.dl-cp-pop ::selection{background:#3b82f6;color:#fff;}',
      '.dl-cp-valuebox{flex:1;min-width:0;display:flex;gap:4px;}',
      '.dl-cp-hexwrap{position:relative;flex:1;min-width:0;display:flex;}',
      '.dl-cp-hash-sign{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:11.5px;color:rgba(255,255,255,.5);pointer-events:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
      '.dl-cp-pop input[type=text]{flex:1;min-width:0;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.28);color:#f0f0f2;font-size:11.5px;line-height:1.4;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}',
      '.dl-cp-pop input[type=text]:focus{outline:none;border-color:#3b82f6;}',
      '.dl-cp-hexwrap input[type=text]{width:100%;padding:3px 8px 3px 22px;}',
      '.dl-cp-h-input{flex:none;width:38px;padding:3px 4px;text-align:left;}',
      '.dl-cp-pct{position:relative;flex:1;min-width:0;display:flex;}',
      '.dl-cp-stepper{position:relative;flex:1;min-width:0;display:flex;align-items:stretch;border:1px solid rgba(255,255,255,.16);border-radius:6px;background:rgba(0,0,0,.28);overflow:hidden;}',
      '.dl-cp-stepper:focus-within{border-color:#3b82f6;}',
      '.dl-cp-stepper input[type=text]{flex:1;min-width:0;border:none;background:transparent;padding:3px 2px 3px 8px;text-align:left;}',
      '.dl-cp-stepper input[type=text]:focus{outline:none;}',
      '.dl-cp-step-suffix{align-self:center;font-size:11px;color:rgba(255,255,255,.5);pointer-events:none;padding-right:2px;}',
      '.dl-cp-steps{display:flex;flex-direction:column;border-left:1px solid rgba(255,255,255,.16);}',
      '.dl-cp-steps button{flex:1;width:18px;border:none;background:transparent;color:rgba(255,255,255,.6);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}',
      '.dl-cp-steps button:hover{background:rgba(255,255,255,.1);color:#fff;}',
      '.dl-cp-pct-alpha{flex:none;width:64px;}',
      '.dl-cp-anglerow{display:flex;align-items:center;gap:8px;}',
      '.dl-cp-anglerow .dl-cp-k{flex:none;font-size:11.5px;color:rgba(255,255,255,.68);}',
      '.dl-cp-pop input[type=range]{flex:1;min-width:0;height:6px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.16);border-radius:999px;outline:none;cursor:pointer;}',
      '.dl-cp-pop input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #1677ff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;}',
      '.dl-cp-pop input[type=range]::-webkit-slider-runnable-track{background:transparent;}',
      '.dl-cp-angleval{flex:none;min-width:32px;text-align:right;font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(255,255,255,.75);}',
    ].join('\n');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------- 组件
  function blurActive() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
  }
  function dragTrack(el, onRatio) {
    const update = (e) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      onRatio(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      blurActive();
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      update(e);
      const move = (ev) => update(ev);
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  function create() {
    ensureStyle();
    const pop = document.createElement('div');
    pop.className = 'dl-cp-pop';
    pop.hidden = true;
    document.body.appendChild(pop);

    let cfg = null;
    let mode = 'single';
    let stops = [];
    let activeIndex = 0;
    let angle = 90;
    let pk = { h: 0, s: 1, v: 1, a: 1 };
    let fmt = 'hex';
    let gradBar = null;
    let gradFill = null;
    let stopDots = [];
    let alphaStep = null;
    let valueSteppers = {};

    const initPk = (css) => {
      const c = parseColor(css) || { r: 255, g: 255, b: 255, a: 1 };
      return { ...rgbToHsv(c.r, c.g, c.b), a: c.a };
    };
    const cssFromPk = () => toCss({ ...hsvToRgb(pk.h, pk.s, pk.v), a: pk.a });
    const commit = () => {
      if (cfg && typeof cfg.onChange === 'function') {
        cfg.onChange({
          gradient: Boolean(cfg.gradient && mode === 'gradient'),
          stops: stops.map((st) => ({ color: st.color, pos: st.pos })),
          angle,
        });
      }
    };

    const CHEV_UP = '<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6.5 5,3.5 8,6.5"/></svg>';
    const CHEV_DOWN = '<svg viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3.5 5,6.5 8,3.5"/></svg>';
    /** 数字步进器：文本输入 + 上下按钮（按住连加），suffix 为只读后缀。 */
    const makeStepper = (opts) => {
      const wrap = document.createElement('div');
      wrap.className = 'dl-cp-stepper';
      const input = document.createElement('input');
      input.type = 'text';
      input.spellcheck = false;
      input.value = String(Math.round(opts.value));
      const suffix = document.createElement('span');
      suffix.className = 'dl-cp-step-suffix';
      suffix.textContent = opts.suffix || '';
      const steps = document.createElement('div');
      steps.className = 'dl-cp-steps';
      const clampVal = (v) => Math.max(opts.min, Math.min(opts.max, Math.round(v)));
      const bump = (dir) => {
        const cur = parseFloat(input.value);
        const base = Number.isFinite(cur) ? cur : opts.value;
        const v = clampVal(base + dir * opts.step);
        input.value = String(v);
        opts.onCommit(v);
      };
      const mkBtn = (dir, svg) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = svg;
        b.title = dir > 0 ? '增加' : '减少';
        let t1 = null;
        let t2 = null;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          bump(dir);
          t1 = window.setTimeout(() => { t2 = window.setInterval(() => bump(dir), 120); }, 400);
          const stop = () => {
            if (t1) { window.clearTimeout(t1); t1 = null; }
            if (t2) { window.clearInterval(t2); t2 = null; }
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
          };
          window.addEventListener('pointerup', stop);
          window.addEventListener('pointercancel', stop);
        });
        return b;
      };
      steps.append(mkBtn(1, CHEV_UP), mkBtn(-1, CHEV_DOWN));
      input.addEventListener('change', () => {
        const cur = parseFloat(input.value);
        if (Number.isFinite(cur)) {
          const v = clampVal(cur);
          input.value = String(v);
          opts.onCommit(v);
        } else {
          input.value = String(Math.round(opts.value));
        }
      });
      wrap.append(input, suffix, steps);
      return {
        el: wrap,
        input,
        setValue(v) { input.value = String(Math.round(v)); },
      };
    };

    function close() {
      if (pop && !pop.hidden) {
        pop.hidden = true;
        pop.replaceChildren();
      }
      cfg = null;
      gradBar = null;
      gradFill = null;
      stopDots = [];
    }

    /** 按比例把圆点放到条内（不让圆点半个探出条外）。 */
    function placeDot(bar, dot, ratio) {
      const w = bar.clientWidth;
      const half = dot.offsetWidth / 2;
      if (w > half * 2) {
        dot.style.left = Math.round(half + (w - half * 2) * Math.min(1, Math.max(0, ratio))) + 'px';
      } else {
        dot.style.left = (Math.min(1, Math.max(0, ratio)) * 100) + '%';
      }
    }
    function syncStopDots() {
      if (!gradBar) return;
      while (stopDots.length < stops.length) {
        const d = document.createElement('div');
        d.className = 'dl-cp-stopdot';
        gradBar.appendChild(d);
        stopDots.push(d);
      }
      while (stopDots.length > stops.length) {
        const d = stopDots.pop();
        if (d && d.parentNode) d.parentNode.removeChild(d);
      }
      for (let i = 0; i < stops.length; i += 1) {
        const d = stopDots[i];
        d.dataset.index = String(i);
        placeDot(gradBar, d, stops[i].pos);
        d.style.background = stops[i].color;
        d.classList.toggle('on', i === activeIndex);
      }
    }

    function render() {
      pop.replaceChildren();
      const supportsGradient = Boolean(cfg && cfg.gradient);
      // 模式切换（分段按钮）+ 重置
      if (supportsGradient) {
        const modRow = document.createElement('div');
        modRow.className = 'dl-cp-modrow';
        const modeSeg = document.createElement('div');
        modeSeg.className = 'dl-cp-mode';
        for (const [key, label] of [['single', '单色'], ['gradient', '渐变色']]) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.className = key === mode ? 'on' : '';
          btn.addEventListener('click', () => {
            if (key === mode) return;
            mode = key;
            if (mode === 'gradient') {
              stops = [{ color: stops[0].color, pos: 0 }, { color: stops[0].color, pos: 1 }];
              activeIndex = 0;
            } else {
              stops = [{ color: stops[activeIndex].color, pos: 0 }];
              activeIndex = 0;
            }
            pk = initPk(stops[activeIndex].color);
            commit();
            render();
            positionPop();
          });
          modeSeg.appendChild(btn);
        }
        modRow.appendChild(modeSeg);
        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'dl-cp-reset';
        resetBtn.title = '恢复默认';
        resetBtn.textContent = '↺';
        resetBtn.addEventListener('click', () => {
          if (typeof cfg.onReset === 'function') cfg.onReset();
          refresh();
        });
        modRow.appendChild(resetBtn);
        pop.appendChild(modRow);
      }
      // 角度 + 渐变预览条（放在色板上方；单色模式也占位，保持两种模式高度一致）
      if (supportsGradient) {
        const angleRow = document.createElement('div');
        angleRow.className = 'dl-cp-anglerow';
        const angleK = document.createElement('span');
        angleK.className = 'dl-cp-k';
        angleK.textContent = '角度';
        const angleRange = document.createElement('input');
        angleRange.type = 'range'; angleRange.min = '0'; angleRange.max = '360'; angleRange.step = '5'; angleRange.value = String(angle);
        const angleVal = document.createElement('span');
        angleVal.className = 'dl-cp-angleval'; angleVal.textContent = angle + '°';
        angleRow.append(angleK, angleRange, angleVal);
        if (mode !== 'gradient') angleRow.style.visibility = 'hidden';
        pop.appendChild(angleRow);
        angleRange.addEventListener('input', () => {
          const raw = Number(angleRange.value);
          angle = Number.isFinite(raw) ? Math.max(0, Math.min(360, Math.round(raw))) : angle;
          angleVal.textContent = angle + '°';
          commit();
          refreshGradient();
        });

        gradBar = document.createElement('div');
        gradBar.className = 'dl-cp-gradpreview dl-cp-checker';
        gradFill = document.createElement('div');
        gradFill.className = 'dl-cp-gradfill';
        gradBar.appendChild(gradFill);
        if (mode !== 'gradient') gradBar.style.visibility = 'hidden';
        pop.appendChild(gradBar);
        if (mode === 'gradient') {
          stopDots = [];
          syncStopDots();
        // 拖动 / 加点
        gradBar.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          blurActive();
          try { gradBar.setPointerCapture(e.pointerId); } catch { /* ignore */ }
          const rect = gradBar.getBoundingClientRect();
          const toPos = (ev) => (rect.width > 0 ? Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)) : 0);
          const dotEl = e.target && e.target.closest ? e.target.closest('.dl-cp-stopdot') : null;
          let dragged = null;
          if (dotEl) {
            activeIndex = Number(dotEl.dataset.index) || 0;
            dragged = stops[activeIndex];
            pk = initPk(dragged.color);
          } else {
            if (stops.length >= 6) return;
            const pos = toPos(e);
            const color = interpolate(stops, pos);
            dragged = { color, pos };
            stops.push(dragged);
            stops.sort((a, b) => a.pos - b.pos);
            activeIndex = stops.indexOf(dragged);
            pk = initPk(color);
            commit();
            render();
            return;
          }
          const move = (ev) => {
            const p = toPos(ev);
            dragged.pos = p;
            stops.sort((a, b) => a.pos - b.pos);
            activeIndex = stops.indexOf(dragged);
            commit();
            refreshGradient();
          };
          const up = () => {
            gradBar.removeEventListener('pointermove', move);
            gradBar.removeEventListener('pointerup', up);
            gradBar.removeEventListener('pointercancel', up);
          };
          gradBar.addEventListener('pointermove', move);
          gradBar.addEventListener('pointerup', up);
          gradBar.addEventListener('pointercancel', up);
          refresh();
        });
        }
      }
      // 饱和度/明度面板
      const board = document.createElement('div');
      board.className = 'dl-cp-board';
      const dot = document.createElement('div');
      dot.className = 'dl-cp-dot';
      board.appendChild(dot);
      pop.appendChild(board);
      const boardMove = (e) => {
        const rect = board.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        pk.s = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        pk.v = 1 - Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
        applyPk();
      };
      board.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        blurActive();
        try { board.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        boardMove(e);
        const move = (ev) => boardMove(ev);
        const up = () => {
          board.removeEventListener('pointermove', move);
          board.removeEventListener('pointerup', up);
          board.removeEventListener('pointercancel', up);
        };
        board.addEventListener('pointermove', move);
        board.addEventListener('pointerup', up);
        board.addEventListener('pointercancel', up);
      });
      // 色相条 + 透明度条（左列），右侧预览占满两行
      const twoRow = document.createElement('div');
      twoRow.className = 'dl-cp-tworow';
      const leftCol = document.createElement('div');
      leftCol.className = 'dl-cp-tworow-left';

      const hue = document.createElement('div');
      hue.className = 'dl-cp-hue';
      const hueDot = document.createElement('div');
      hueDot.className = 'dl-cp-dot dl-cp-dot-sm';
      hue.appendChild(hueDot);
      leftCol.appendChild(hue);
      dragTrack(hue, (ratio) => { pk.h = ratio * 360; applyPk(); });

      const alphaBar = document.createElement('div');
      alphaBar.className = 'dl-cp-alpha dl-cp-checker';
      const alphaFill = document.createElement('div');
      alphaFill.className = 'dl-cp-alpha-fill';
      const alphaDot = document.createElement('div');
      alphaDot.className = 'dl-cp-dot dl-cp-dot-sm';
      alphaBar.append(alphaFill, alphaDot);
      leftCol.appendChild(alphaBar);
      dragTrack(alphaBar, (ratio) => { pk.a = ratio; applyPk(); });

      const preview = document.createElement('div');
      preview.className = 'dl-cp-preview dl-cp-checker';
      const previewFill = document.createElement('div');
      previewFill.className = 'dl-cp-preview-fill';
      preview.appendChild(previewFill);
      twoRow.append(leftCol, preview);
      pop.appendChild(twoRow);
      // HEX / HSB / RGB 格式切换 + 手动输入
      const fmtRow = document.createElement('div');
      fmtRow.className = 'dl-cp-hexrow';
      const fmtSelect = document.createElement('select');
      fmtSelect.className = 'dl-cp-format';
      for (const [val, label] of [['hex', 'HEX'], ['hsb', 'HSB'], ['rgb', 'RGB']]) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        fmtSelect.appendChild(opt);
      }
      fmtSelect.value = fmt;
      const valueBox = document.createElement('div');
      valueBox.className = 'dl-cp-valuebox';
      alphaStep = makeStepper({
        value: Math.round(pk.a * 100),
        min: 0, max: 100, step: 1, suffix: '%',
        onCommit: (v) => { pk.a = v / 100; applyPk(); },
      });
      alphaStep.el.classList.add('dl-cp-pct-alpha');
      fmtRow.append(fmtSelect, valueBox, alphaStep.el);
      pop.appendChild(fmtRow);

      let valueInputs = {};
      const makeValueInput = (placeholder) => {
        const input = document.createElement('input');
        input.type = 'text'; input.spellcheck = false; input.placeholder = placeholder;
        return input;
      };
      const hexOf = (rgb) => [rgb.r, rgb.g, rgb.b]
        .map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
      function bindValueInputs() {
        if (fmt === 'hex') {
          valueInputs.hex.addEventListener('input', () => {
            const raw = String(valueInputs.hex.value || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 6);
            if (valueInputs.hex.value !== raw) valueInputs.hex.value = raw;
          });
          valueInputs.hex.addEventListener('change', () => {
            const c = parseColor('#' + String(valueInputs.hex.value || '').trim().replace(/^#/, ''));
            if (!c) { refresh(); return; }
            valueInputs.hex.value = [c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
            pk = { ...rgbToHsv(c.r, c.g, c.b), a: pk.a };
            applyPk();
          });
        } else {
          valueInputs.h.addEventListener('change', () => {
            const h = parseFloat(valueInputs.h.value);
            if (Number.isFinite(h)) {
              const hh = Math.max(0, Math.min(360, h));
              valueInputs.h.value = String(Math.round(hh));
              pk.h = hh;
              applyPk();
            } else refresh();
          });
        }
      }
      function buildValueInputs() {
        valueBox.replaceChildren();
        valueInputs = {};
        valueSteppers = {};
        if (fmt === 'hex') {
          valueInputs.hex = makeValueInput('RRGGBB');
          const hexWrap = document.createElement('div');
          hexWrap.className = 'dl-cp-hexwrap';
          const hashSign = document.createElement('span');
          hashSign.className = 'dl-cp-hash-sign';
          hashSign.textContent = '#';
          hexWrap.append(hashSign, valueInputs.hex);
          valueBox.appendChild(hexWrap);
        } else if (fmt === 'rgb') {
          const curRgb = hsvToRgb(pk.h, pk.s, pk.v);
          for (const k of ['r', 'g', 'b']) {
            const st = makeStepper({
              value: Math.round(curRgb[k]),
              min: 0, max: 255, step: 1, suffix: '',
              onCommit: (v) => {
                const cur = hsvToRgb(pk.h, pk.s, pk.v);
                const rr = k === 'r' ? v : cur.r;
                const gg = k === 'g' ? v : cur.g;
                const bb = k === 'b' ? v : cur.b;
                pk = { ...rgbToHsv(rr, gg, bb), a: pk.a };
                applyPk();
              },
            });
            valueSteppers[k] = st;
            const wrap = document.createElement('div');
            wrap.className = 'dl-cp-pct';
            wrap.appendChild(st.el);
            valueBox.appendChild(wrap);
          }
        } else {
          valueInputs.h = makeValueInput('H');
          valueInputs.h.classList.add('dl-cp-h-input');
          valueBox.appendChild(valueInputs.h);
          for (const k of ['s', 'b']) {
            const st = makeStepper({
              value: k === 's' ? Math.round(pk.s * 100) : Math.round(pk.v * 100),
              min: 0, max: 100, step: 1, suffix: '%',
              onCommit: (v) => {
                if (k === 's') pk.s = v / 100;
                else pk.v = v / 100;
                applyPk();
              },
            });
            valueSteppers[k] = st;
            const wrap = document.createElement('div');
            wrap.className = 'dl-cp-pct';
            wrap.appendChild(st.el);
            valueBox.appendChild(wrap);
          }
        }
        bindValueInputs();
      }
      buildValueInputs();
      fmtSelect.addEventListener('change', () => {
        fmt = fmtSelect.value;
        buildValueInputs();
        refresh();
      });

      function applyPk() {
        if (!stops.length) stops = [{ color: cssFromPk(), pos: 0 }];
        stops[activeIndex] = { color: cssFromPk(), pos: stops[activeIndex].pos };
        commit();
        refresh();
      }
      function refreshGradient() {
        if (mode === 'gradient' && gradFill) {
          gradFill.style.background = gradientCss(stops, angle);
          syncStopDots();
        }
        previewFill.style.background = mode === 'gradient'
          ? gradientCss(stops, angle)
          : cssFromPk();
      }
      function refresh() {
        const rgb = hsvToRgb(pk.h, pk.s, pk.v);
        board.style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${Math.round(pk.h)}, 100%, 50%)`;
        dot.style.left = (pk.s * 100) + '%';
        dot.style.top = ((1 - pk.v) * 100) + '%';
        placeDot(hue, hueDot, pk.h / 360);
        alphaFill.style.background = `linear-gradient(to right, rgba(${rgb.r},${rgb.g},${rgb.b},0), rgba(${rgb.r},${rgb.g},${rgb.b},1))`;
        placeDot(alphaBar, alphaDot, pk.a);
        if (fmt === 'hex') {
          const el = valueInputs.hex;
          if (el && document.activeElement !== el) el.value = hexOf(rgb);
        } else if (fmt === 'rgb') {
          const map = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
          for (const k of ['r', 'g', 'b']) {
            const st = valueSteppers[k];
            if (st && document.activeElement !== st.input) st.setValue(map[k]);
          }
        } else {
          const elH = valueInputs.h;
          if (elH && document.activeElement !== elH) elH.value = String(Math.round(pk.h));
          for (const k of ['s', 'b']) {
            const st = valueSteppers[k];
            if (st && document.activeElement !== st.input) {
              st.setValue(k === 's' ? Math.round(pk.s * 100) : Math.round(pk.v * 100));
            }
          }
        }
        if (alphaStep && document.activeElement !== alphaStep.input) alphaStep.setValue(Math.round(pk.a * 100));
        refreshGradient();
      }
      refresh();
    }

    let anchorEl = null;
    function positionPop() {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(350, Math.max(240, window.innerWidth - margin * 2));
      let left = Math.round(rect.left);
      left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);
      pop.style.width = width + 'px';
      pop.style.left = left + 'px';
      pop.style.maxHeight = (window.innerHeight - margin * 2) + 'px';
      pop.hidden = false;
      const h = pop.offsetHeight;
      let top = Math.round(rect.bottom + 4);
      if (top + h > window.innerHeight - margin) {
        top = Math.round(rect.top - h - 4);
        if (top < margin) top = Math.round(Math.max(margin, window.innerHeight - h - margin));
      }
      pop.style.top = top + 'px';
    }

    function open(anchor, options) {
      cfg = options || {};
      anchorEl = anchor;
      const state = cfg.getState ? cfg.getState() : null;
      mode = (cfg.gradient && state && state.gradient) ? 'gradient' : 'single';
      stops = (state && Array.isArray(state.stops) && state.stops.length)
        ? state.stops.map((st) => ({ color: normColor(st.color) || '#ffffff', pos: Math.min(1, Math.max(0, Number(st.pos) || 0)) }))
        : [{ color: '#ffffff', pos: 0 }];
      stops.sort((a, b) => a.pos - b.pos);
      activeIndex = 0;
      angle = state && Number.isFinite(state.angle) ? state.angle : 90;
      pk = initPk(stops[activeIndex].color);
      // 先放到屏幕外并显示，让 render() 里 placeDot 能测到真实尺寸，
      // 避免初始时圆点按百分比落到最边上、和拖动后的夹取范围不一致。
      pop.style.left = '-9999px';
      pop.style.top = '-9999px';
      pop.hidden = false;
      render();
      positionPop();
    }

    function refresh() {
      if (pop.hidden || !cfg || typeof cfg.getState !== 'function') return;
      const state = cfg.getState();
      if (state && Array.isArray(state.stops) && state.stops.length) {
        stops = state.stops.map((st) => ({ color: normColor(st.color) || '#ffffff', pos: Math.min(1, Math.max(0, Number(st.pos) || 0)) }));
        stops.sort((a, b) => a.pos - b.pos);
        if (activeIndex >= stops.length) activeIndex = 0;
        pk = initPk(stops[activeIndex].color);
        angle = Number.isFinite(state.angle) ? state.angle : angle;
        render();
      }
    }

    // 点击弹层外关闭
    document.addEventListener('pointerdown', (e) => {
      if (pop.hidden) return;
      if (pop.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('.cp-trigger')) return;
      close();
    }, true);
    window.addEventListener('resize', close);

    return { open, close, refresh, destroy: close };
  }

  window.DLColorPicker = {
    parseColor, toCss, normColor, rgbToHsv, hsvToRgb,
    gradientCss, interpolate, create,
  };
})();
