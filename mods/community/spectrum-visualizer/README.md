# spectrum-visualizer（Folium 模组）

> 把原 `spectrum-viewer` 项目（独立 Electron 桌面小工具）的频谱显示逻辑搬进
> [Folia](https://github.com/chthollyphile/folia-major) 音乐播放器里，
> 作为**播放页左下角的独立小组件**（stageLayer 图层），不占歌词区，被下一首预告等元素挡住时**自动避让**。

| 形态 | 文件 |
|---|---|
| 入口 | [`client.mjs`](./client.mjs) |
| 清单 | [`mod.json`](./mod.json) |
| 预览图 |[`preview.jpg`](./preview.jpg) |

---

## 它是什么

- **形态**：`folium.registries.stageLayers` 图层，slot `player.stage.front`
  （歌词之上、播放器控件之下），默认停在播放页**左下角**（左边距 24 px、底边距 20 px，
  以 `transform` 写入，不占用/不覆盖宿主的布局属性），纯显示、点击穿透，不挡任何播放器操作。
  底边距故意贴到最低，"下一首预告"这类底部元素会真的压住它 —— 正好交给自动避让处理。
- **48 段实时频谱柱**：平方映射到 bin，最高 16 kHz，与原 `viewer.js` 完全一致
  （柱色、2px 空闲底座、120 ms 读数刷新率都一致）。
- **一行迷你读数**：输入功率 dB / 峰值频率 Hz（峰值频率 = 峰值 bin × 每格 Hz，见下面的采样率假定）。
- **自动避让**：用命中测试检测自己被哪些宿主元素压住，被挡就上移或换边（见下节）。
- **背景透明**（可选）：去掉卡片底色 / 毛玻璃 / 描边，只剩频谱柱与读数，直接叠在封面上。

### 假定采样率（默认 44.1 kHz）

默认取 **44100** 
---

## 自动避让怎么工作

避让是**通用启发式**，
不依赖任何写死的选择器：

1. **命中测试**：在自己矩形内打 4×3 点阵，用 `container.getRootNode().elementsFromPoint()`
   问"这些点上压着谁"（同时也会问一次 `document`，兜住外部浮层）。组件自身是
   `pointer-events:none`，所以永远不会命中自己。
2. **筛掉不该算的**：容器自身及其祖先（舞台根、播放器根）、面积 ≥ 舞台 60% 的铺满层
   （背景、歌词画布）、小于 20×20 的元素、不可见元素，以及**不画东西的透明布局壳**
   （没有背景色/背景图、不是 img/canvas/video、自己也没有文字 —— 判定见 `paints()`）。
3. **候选位打分**：候选序列 = 左下角默认位 → 同列**每 `AVOID.step`（16 px）上移一格** →
   右侧同样一列，全部用舞台 `getBoundingClientRect()` 夹在容器内，总抬升不超过
   `AVOID.maxLift`（200 px）。按顺序扫、**命中 0 就停**，所以绝大多数情况下只多测 1–3 个位置。
4. **触发与去抖**：400 ms 轮询 + 容器 `ResizeObserver` + 容器子树 `childList` 变化（预告滑入、
   歌词换行）即时重算；**连续两轮被挡**（≈ 800 ms）才挪动，挪完 **1.2 s 冷却**，位置干净满
   3 s 才考虑回默认位 —— 都是为了不让歌词逐句刷新把组件晃来晃去。
5. **不改宿主**：整个过程只写自己的 `transform`（带 0.18 s 过渡），不动宿主的 DOM / 样式。
6. **可诊断**：每次挪位都会经 `folium.log.info` 写一行到宿主日志（`%APPDATA%\Folia\logs`），
   形如 `自动避让：相对默认位抬高 16px（步长 16px），挡住原位置的是 div.card / span.title`；
   采样率设置被写歪时也会记一行

**局限与调参**：这套判断是纯几何启发式，舞台上任何"画了东西的紧凑块"都会被当成遮挡物
（包括歌词列、封面、悬浮控件）—— 这是有意为之，初衷就是别压住内容。想让它更"迟钝"或更
"敏感"，改 `client.mjs` 里 `AVOID` 常量的 `bleedRatio`（面积阈值）、`minArea`、`step` 与
`maxLift`（让位步长与上限）、`cooldown`、`smoothBack`；想彻底关掉就用设置面板里的
**自动避让** 开关（关掉后固定停在左下角默认位 `left:24px; bottom:20px`，即不再让位）。

---

## 在 Folia 里加载

### 模式 A：本地 / 开发者模式

Folia 桌面版 → 模组面板 → 打开模组文件夹 → 将本目录复制进模组文件夹（`mods/spectrum-visualizer/`）→ 启用本模组；
播放页左下角就会出现频谱小组件
开发者模式无签名

### 模式 B：从 folium-compound 市场

正在申请

---


## 文件结构

```
spectrum-visualizer/
├── mod.json          ← Folium 1 清单（name/description 是字符串）
├── client.mjs        ← 入口（注册 1 个 stageLayer + 4 个设置项）
├── README.md         ← 本文件
├── preview.jpg       ← 预览图
└── folium.sig.json   ← folium-compound 维护者签名后自动生成
```

---

## 自定义 / 升级

想加新设置：在 `client.mjs` 的 `settingsSections.register({ settings: [...] })` 数组里追加：

```js
{ key: 'myToggle', type: 'boolean', label: { 'zh-CN': '…', en: '…' }, defaultValue: true }
```

然后在 `paint()` 里 `settings.params.get().myToggle` 读取。

想换映射算法：改 `paint()` 里
`Math.floor(Math.pow(i / (BARS - 1), 2) * top)` 这段（平方映射 → 对数 / 线性 / Mel 都可以）。

---

## 版本记录

| 版本 | 改动 |
|---|---|
| `0.1.0` | 初版：注册为全屏 visualizer，且 `querySelector` 选择器写错导致 mount 崩溃 |
| `0.2.0` | 改为 `stageLayers` 播放页左下角小组件；修复 `strong[data-meter="x"]` 选择器空指针；渲染改 rAF 自驱 |
| `0.2.1` | 补上 `"permissions": ["ui.stage"]`，修复激活报 `permission-denied:ui.stage` |
| `0.3.0` | 新增命中测试自动避让（+ `autoAvoid` 设置项）；定位改由 `transform` 驱动 |
| `0.3.1` | 新增「假定采样率」设置项；默认底边距 120 → 20 px 压到最底、避让步长 12 → 16 px |
| `0.3.2` | 修复避让：并加 `maxLift` 200 px 上限；遮挡判定新增 `paints()`，透明布局壳不再算遮挡 |
| `0.3.3` | **删掉「解析度」读数**（效果差且宿主无接口可取）；新增「背景透明」开关 |
