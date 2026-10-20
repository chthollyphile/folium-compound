# 时钟 · FPS · 性能悬浮卡（clock-perf-widget v2.3.0）

![介绍图](preview.png)

给 Folia 0.7.x（Folium 1.x）的三个**互相独立**的悬浮卡：时钟、FPS、性能监测。
三者各有独立的显示开关、位置（各自拖拽、各自记忆）、样式与大小，各自注册到两个舞台层
（`app.overlay` 与 `player.stage.front`），由 `placement` 决定哪一层生效。

纯 ESM `client.mjs` + CJS `main.cjs`，零依赖、零构建。

## 组件

| 组件 | 内容 | 默认角 | 尺寸（scale=1） |
| --- | --- | --- | --- |
| 时钟 | 时分（四种**结构不同**的样式，见下）+ 可选日期 / 星期，无进度条 | 左上（离左边再多让 96px，避开窗口左上角的返回/菜单按钮） | 自适应 |
| FPS | 纯数字（`FPS` 标签在数字左侧基线对齐），**没有条** | 左下 | 自适应 |
| 性能 | **Folia CPU** / **Folia 内存** / GPU 占用 / GPU 温度（占用与温度**仅 NVIDIA**，靠 `nvidia-smi`）+ 分进程明细（折叠） | 右下 | 固定宽 |

**Folia CPU / Folia 内存**是 Folia 自己那几个 Electron 进程的合计，不是整机占用。
CPU 是各进程 `percentCPUUsage` 相加，多核上可以超过 100%；超过 100% 时进度条满格，
右侧文字数值仍然是真实值。

关闭开关（`clockShow` / `fpsShow` / `perfShow`）后该组件的**两层都不渲染**，定时器与 rAF 一并停掉。

## 文件

| 文件 | 作用 |
| --- | --- |
| `client.mjs` | 渲染进程入口：注册设置面板 + 6 个舞台层，建卡、拖动、样式、订阅设置变更 |
| `main.cjs` | 主进程入口：`api.rpc.handle('metrics')` 采集 CPU / 内存，按需采集 GPU |
| `mod.json` | 清单：`ui.stage` + `filesystem.data`（后者解锁 `folium.storage`） |
| `preview.png` | 模组介绍图（`mod.json` 的 `preview`，必须留在根目录才能被签名分发） |
| `.dev/selfcheck.mjs` | 零依赖自检：DOM / timer / rAF / folium 全套 stub，175 条断言 |
| `.dev/preview.html` | 静态样式预览页：单文件、零依赖，浏览器直接打开对比四种时钟样式与两种性能布局 |

自检：`node .dev/selfcheck.mjs`（非零退出即失败）。预览：双击 `.dev/preview.html`（无需起服务、无需宿主）。

`.dev/` 是开发专用目录：市场打包只排除以 `.` 开头的文件与目录，所以自检与预览页放进 `.dev/`
就不会被一起签名分发；运行时的 `client.mjs` / `main.cjs` 不引用它们。`preview.png` 不能挪进去——
清单的 `preview` 指向它，它必须留在根目录并跟着签名。

## 设置

### 通用

| key | 类型 | 默认 | 范围 / 选项 | 说明 |
| --- | --- | --- | --- | --- |
| `placement` | select | `global` | `global` / `player` / `off` | 哪一层生效：全局顶层 / 仅播放页 / 都不显示 |

### 时钟

| key | 类型 | 默认 | 范围 / 选项 | 说明 |
| --- | --- | --- | --- | --- |
| `clockShow` | boolean | `true` | — | 显示时钟 |
| `clockStyle` | select | `minimal` | `minimal` / `terminal` / `stacked` / `outline` | 四种**排版结构不同**的样式，见下 |
| `clockShowDate` | boolean | `true` | — | 显示日期（四种样式都生效） |
| `clockShowWeekday` | boolean | `true` | — | 显示星期（四种样式都生效） |
| `clock24` | boolean | `true` | — | 24 小时制（四种样式都生效） |
| `clockColor` | color | `#f4f4f6` | `#rrggbb` | 文字色 |
| `cornerClock` | select | `top-left` | 四个角 | 双击回位的角落；改设置立即贴过去，不受历史拖动位置影响 |
| `clockClickThrough` | boolean | `false` | — | 打开后卡片 `pointer-events: none`，不挡下面的按钮；同时不能拖动 |

### 四种时钟样式

| 样式 | 结构 |
| --- | --- |
| `minimal` | 单行超大细字 `3.2em` / 字重 600 / 字距 `-0.02em`；日期与星期以 `0.8em` 小字贴在时间**右侧、基线对齐**（`gap: 10px`）；无 prompt |
| `terminal` | 整卡等宽字体。首行 `>_` + ISO 日期（`0.72em` / 字距 `0.08em`）+ 星期；次行 24 小时制 `2.6em` / 字重 600 / 字距 `0.06em`，末尾一个 `▌` 方块光标，每 500ms 与冒号同步闪烁 |
| `stacked` | 日期与星期作为右上角的**表头**（`0.8em` / 字重 700 / 字距 `0.16em`，星期 `opacity: 0.55`），下面小时与分钟**上下两行** `3em` / 字重 800 / 右对齐，两行之间一条 `2.6em` 宽细线（`opacity: 0.45`），三者的右边缘对齐 |
| `outline` | `3.4em` / 字重 800 + `-webkit-text-stroke: 1px currentColor`，无发光；日期与星期在数字下方居中、`0.7em` 字号 / 字距 `0.3em`；**忽略卡片底色**（始终透明，`cardBackground` 对它不生效） |

所有数字使用 `font-variant-numeric: tabular-nums`，跳秒不抖宽度；数字字重一律不低于 600。
旧存档里的 `mono` / `glow` / `neon` 会分别落到 `terminal` / `outline` / `outline`。

### FPS

| key | 类型 | 默认 | 范围 / 选项 | 说明 |
| --- | --- | --- | --- | --- |
| `fpsShow` | boolean | `true` | — | 显示 FPS |
| `fpsShowLabel` | boolean | `true` | — | 数字**左侧**显示 `FPS` 标签（`0.72em` / 字距 `0.18em` / `opacity: 0.6`） |
| `fpsFontSize` | number | `26` | 14–72，step 1 | 数字字号（会再乘 `scale`；字重固定 700） |
| `fpsValueColor` | select | `#f4f4f6` | 调色板 | 数字颜色 |
| `fpsLabelColor` | select | `#9aa4b2` | 调色板 | `FPS` 标签颜色 |
| `cornerFps` | select | `bottom-left` | 四个角 | 双击回位的角落；改设置立即贴过去，不受历史拖动位置影响 |
| `fpsClickThrough` | boolean | `false` | — | 打开后卡片 `pointer-events: none`，不挡下面的按钮；同时不能拖动 |

### 性能监测

| key | 类型 | 默认 | 范围 / 选项 | 说明 |
| --- | --- | --- | --- | --- |
| `perfShow` | boolean | `true` | — | 显示性能卡 |
| `showCpu` | boolean | `true` | — | `Folia CPU` 行（Folia 各进程合计） |
| `showMemory` | boolean | `true` | — | `Folia 内存` 行（Folia 各进程工作集合计） |
| `showGpu` | boolean | `true` | — | GPU 占用 + 温度行（仅 NVIDIA）；关闭后渲染端**不再请求** GPU 数据，主进程也不跑 `nvidia-smi` |
| `showDetails` | boolean | `false` | — | 展开分进程明细（main / renderer / gpu） |
| `barLayout` | select | `vertical` | `vertical` / `horizontal` | `vertical`：条目竖排、条在数值右侧；`horizontal`：CPU / 内存 / GPU **三条横着并排**，每条的标签与数值占一行，短条（`3px`，最长 `72px`）贴在条目下方 |
| `colorCpu` | select | `#5ac8fa` | 调色板 | CPU 条颜色 |
| `colorMemory` | select | `#34c759` | 调色板 | 内存条颜色 |
| `colorGpu` | select | `#ff9f0a` | 调色板 | GPU 条颜色 |
| `perfLabelColor` | select | `#9aa4b2` | 调色板 | 标签颜色（Folia CPU / Folia 内存 / GPU 与分进程明细） |
| `perfValueColor` | select | `#f4f4f6` | 调色板 | 数值颜色 |
| `memoryLimitGb` | number | `4` | 1–64，step 1 | 内存条满格对应的 GB 数 |
| `refreshMs` | select | `1000` | `500` / `1000` / `2000` | 指标轮询间隔 |
| `cornerPerf` | select | `bottom-right` | 四个角 | 默认右下角，避开窗口右上角的控制按钮；改设置立即贴过去 |
| `perfClickThrough` | boolean | `false` | — | 打开后卡片 `pointer-events: none`，不挡下面的按钮；同时不能拖动 |

条的长度归一：Folia CPU、GPU 按 0–100；Folia 内存按 `memoryLimitGb`。三者都 clamp 到 0–1。
Folia CPU 是各进程按核相加的结果，**可能超过 100%**：此时条满格，右侧文字数值仍准确。

颜色项都是**预设下拉**（宿主只渲染开关 / 下拉 / 滑条，`type: 'color'` 不会出现在面板里）。调色板：白 `#f4f4f6`、银灰 `#9aa4b2`、天蓝 `#5ac8fa`、青 `#64d2ff`、葱绿 `#39c5bb`、薄荷绿 `#34c759`、柠檬黄 `#ffd60a`、琥珀 `#ff9f0a`、珊瑚红 `#ff375f`、紫 `#bf5af2`。

两种布局下分进程明细（主进程 / 渲染进程 / GPU 进程）都固定竖排在最下方。

### 外观与大小（三个组件共用）

| key | 类型 | 默认 | 范围 / 选项 | 说明 |
| --- | --- | --- | --- | --- |
| `cardBackground` | boolean | `true` | — | 关闭即纯文字：不留底色、不留 `backdrop-filter`（`outline` 时钟无论此项如何都保持透明） |
| `cardOpacity` | number | `0.55` | 0–1，step 0.05 | 卡片底色不透明度 |
| `backdropOpacity` | number | `0.55` | 0–1，step 0.05 | 毛玻璃强度：同时缩放 `backdrop-filter` 的 blur 半径与底色上的高光 |
| `scale` | number | `1` | 0.7–1.6，step 0.05 | 整卡倍率（宽 / padding / 圆角 / 字号统一乘倍率，不用 `transform: scale()`） |

`scale` 走的是尺寸与字号实算，不是 `transform: scale()`：后者会把文字栅格化后放大（发虚），
并且缩放后的命中区域仍按未缩放盒模型算，拖动会错位。

## 样式预览页

`.dev/preview.html` 是单文件零依赖的静态预览：深色背景（`#0d0d0f`）上并排展示四种时钟样式、
FPS 卡（含隐藏标签后的收窄效果）、性能卡的 `vertical` 与 `horizontal` 两种布局。
其中的字号、字重、字距、`gap`、条宽与颜色全部抄自 `client.mjs` 的 `CLOCK_LOOKS` /
`CARD_SHELL_CSS` / `makeMetricRow` 与 `applyScale`（`scale = 1`），用于挑设计，不参与运行时。

改样式时请同步改 `.dev/preview.html`，否则预览会与实际渲染脱节。唯一有意的差异：预览里的卡片是
`position: relative`（真实挂件是 `position: fixed` + JS 定位）。

## GPU 数据源（仅 NVIDIA）

`main.cjs` 的 `metrics` 返回：

```js
{
  totalCpu, totalMemKb,
  gpu: { utilPct, tempC, memUsedMb, memTotalMb, powerW, source } | null,
  byType: { main, renderer, gpu }
}
```

**GPU 占用与温度只支持 NVIDIA 显卡**：数据全部来自 `nvidia-smi`，没有它就返回 `gpu: null`，
渲染端那一行显示 `—`，并在 source 行写明「无 nvidia-smi · 占用与温度仅支持 NVIDIA 显卡」。
不再拿 Electron GPU 进程的 CPU 占用冒充 GPU 占用——那是另一个量，名字对不上。
GPU 进程自己的 CPU / 内存仍在分进程明细里（`GPU 进程` 那行）。

`gpu.source` 只有 `nvidia-smi` 一档：`execFile` 调
`--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw --format=csv,noheader,nounits`，
`windowsHide: true`，超时 3s。结果在主进程缓存 2s，避免每次 rpc 都 spawn（单次 50–200ms）。
本机实测输出：`NVIDIA GeForce RTX 5070, 14, 45, 5931, 12227, 45.26`。

**按需采集**：渲染端把「这一帧要不要 GPU」放进 rpc 参数——
`folium.rpc.call('metrics', { gpu: perfShow && showGpu && 可见 })`；主进程见到 `gpu: false`
就完全不 `execFile`（连缓存都不碰）。旧的无参数调用 `call('metrics')` 按 `gpu: true` 处理。

**查找顺序**：先试完整路径 `%SystemRoot%\System32\nvidia-smi.exe`，再回退裸名字 `nvidia-smi`
（Windows 按名字查找会先搜当前目录，完整路径不给当前目录留机会）。

**冷却重试**：失败（不存在、超时、解析失败）后冷却 60 秒再试，连续失败 3 次才彻底停用；
日志只记一条，不随轮询刷屏。一次成功会把失败计数清零。

## 设置变更怎么送达

设置句柄是 `section.params`（更老的宿主叫 `section.settings`），Folia 0.7.20 起它带
`subscribe(listener: () => void) => FoliumDisposer`：

- 每个已挂载的 layer 在 mount 时订阅一次，回调里自己再 `params.get()` 一次并重跑应用逻辑
  —— 回调不带参数，也不需要比较快照；改完设置立刻生效，没有 1 秒延迟。
- 只用 `typeof params.subscribe === 'function'` 保护。拿不到 `subscribe` 的老宿主
  （0.7.20 以前）才退回每 1000ms 读一次 `params.get()` 并比较序列化结果的兜底轮询。
- `params.onChange` 不存在，v2.3.0 起不再尝试它。
- `ctx.onChange` 仍然只用于主题（白昼）重绘：1.x 的文档说它在设置变化时也会触发，
  但它按层注册、参数里不说明改了什么，设置主通道仍走 `params.subscribe`。

## 实现约束

- **DOM 只建一次**：刷新只写 `textContent` / `style` / `transform`，不重建节点。
- **拖动**：`pointerdown` + `setPointerCapture` + `pointermove`，位置按视口比例存
  `folium.storage`（`pos-clock-v2` / `pos-fps-v2` / `pos-perf-v2`），`resize` 后按比例重算并 clamp，
  双击回各自默认角。这三个键**只存位置**；设置由宿主自己保存，模组不写。
- **角落设置优先**：每次应用设置都拿当前 `cornerXxx` 与上次应用的角落比对——变了就
  `applyCorner(新值)` 并把比例写回 `storage`（手动拖过也照样跳过去），没变才按存下来的比例复原；
  `scale` 变化时同样按当前角落重新贴边。首屏不写 `storage`，避免覆盖上一次的位置存档。
- **鼠标穿透**：`pointer-events` 不在卡片常量里写死，由 `clockClickThrough` / `fpsClickThrough` /
  `perfClickThrough` 在运行时把卡片覆写成 `none` 或 `auto`；穿透时拖动与双击整体短路。舞台层保持宿主默认的点击穿透。
- **定时器**：统一由 `syncLoops()` 管，组件不可见或被关掉时不跑 rAF / interval。
  FPS 优先用宿主的 `ctx.onFrame(listener)` 帧循环（`FoliumMountHelpers.onFrame`），
  拿不到才退回自己的 `requestAnimationFrame` 递归。
- **宿主 API 一律 `typeof` 保护**：`settings.get`、`settings.subscribe/onChange`、
  `ctx.every/onChange/onFrame/getTheme`、`folium.rpc.call`、`folium.storage.*`，
  任何一个缺失都只是少一个能力，不抛异常。

## 安装

1. 下载本仓库（git clone 或 Release 里的源码包），把整个目录放到 Folia 的用户模组目录：
   `%APPDATA%\Folia\mods\clock-perf-widget`（即 `userData/mods/<模组 id>`）。
2. 打开「设置 → 模组 → 模组系统」总开关，再在模组面板里确认启用本模组（会弹出原生确认窗口，
   列出权限与内容摘要）。
3. 启用后三张卡默认出现在左上、左下、右下；拖动即记位置，双击回默认角。

也可以在模组面板里把目录打成 zip 直接拖进去安装。权限只有 `ui.stage`（往舞台层画东西）与
`filesystem.data`（记住拖拽位置）。`ui.stage` 是 0.7.20 的权限名，更新的宿主把它叫
`stageLayers`；`mod.json` 暂时保留 `ui.stage`，因为还要支持 0.7.20（1.x 宿主对旧名字仍然放行）。
`filesystem.data` 存的是**位置**（`pos-*-v2`），设置由宿主自己的设置存储负责。

## 许可证

MIT，见 [LICENSE](LICENSE)。

## 排查提示

- 舞台层挂在 shadow root 里，`document.querySelector` 查不到卡片；先取 `[data-folium-entry]` 的 `shadowRoot`。
- 宿主把 mount 异常写进日志：`[Folium:<modId>] stage layer <entry> mount: <error>`；异常发生在
  `container.appendChild(card)` 之后时，卡片会残留 DOM 但停在初始样式——看到「有卡但不更新」优先查这里。
