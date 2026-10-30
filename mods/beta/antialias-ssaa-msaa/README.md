# 超采样与多重采样抗锯齿（antialias-ssaa-msaa）

# 目前已知问题：开关抗锯齿后会导致folia黑屏，重启即可

作者：ACUNGER。Folia 的第三方 Folium 模组，不是 Folia 官方组件。

两种可以叠加的抗锯齿方式，**默认都关着**，由你按需开：

- **2× 超采样（SSAA）**：把 `devicePixelRatio` 垫到 2（只升不降），管字形纹理、贴图和缩放动画的抖动。
- **强制 MSAA**：`hanabi` 等风格把 WebGL 的 `antialias` 关掉了，卡片白边、色块、装饰线这些**几何直边**因此是硬台阶；这一层直接打开 MSAA。只抗几何边，不改善字形。

两者**可以同时开**，覆盖范围互补：超采样管纹理与字形，MSAA 管几何边。代价是相乘的——像素数是 4 倍，MSAA 再乘 4 个采样就是 16 倍，所以叠加有自己更紧的一档像素预算（2 倍后约 830 万像素，相当于 1920×1080 @2x）；窗口大到叠加后超预算时，模组自动收掉超采样、只留 MSAA，窗口缩回来再恢复叠加。要把上限放到 2K 甚至 4K，改 `COMBINED_PIXEL_BUDGET` 即可（每块画布的实际占用见「代价与限制」）。

这两个开关都会改动**整个 Folia 窗口**，不只是歌词画布——具体改了哪些、为什么躲不开、怎么收窄的，见「动了哪些全局接口」。

- 适用：Folia 桌面版 / 浏览器版，Folium 1.7（`mod.json` 里 `"folium": 1`）
- 权限：不需要（`permissions: []`）
- 入口：只有 `client.mjs`，不碰主进程

## 装

两种都行：

1. 把 `antialias-ssaa-msaa` 整个文件夹放进模组目录：Folia 里「设置 → 模组 → 打开模组目录」（Windows 上是 `%APPDATA%\Folia\mods`），然后回面板点「重载」。
2. 把打包好的 `antialias-ssaa-msaa-1.1.7.zip` 直接拖到模组面板上（多一层文件夹不影响加载）。

## 开

1. 「设置 → 模组」打开最上面的「模组系统」开关（默认是关的）。
2. 列表里启用「超采样与多重采样抗锯齿」，在确认窗口里确认。
3. **启用后还要在设置里打开「2× 超采样」和/或「强制 MSAA」**——两项默认都关着，模组加载后不会自己改画面。
4. 打开开关后模组会把画布重建一次；如果画面没变，跑一次命令面板的「超采样与 MSAA：重新应用」。

## 设置

「设置 → 模组 → 超采样与多重采样抗锯齿」展开后五项：

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 2× 超采样 | **关** | 把 `devicePixelRatio` 垫到 2（只升不降），歌词画布与字形纹理按 2 倍光栅化后由合成器降采样。管字形、贴图和缩放抖动。整窗帧缓冲变成 4 倍，核显 / 低配机器可能掉帧，所以默认关。窗口大到 2 倍缓冲超过约 3320 万像素（3840×2160 @2x）时才自动跳过。 |
| 强制 MSAA | 关 | 建 WebGL 上下文时把 `antialias` 顶成 `true`。管卡片、色块、装饰线的几何直边。**可与超采样同开**（叠加档预算 2 倍后约 830 万像素，超了先收超采样）。作用范围是本窗口此后新建的**每个** WebGL 上下文，不只歌词。上下文属性不能就地改，切换后几何边要等下一次重建上下文（切动画 / 重启）。 |
| 2D 画布高质量缩放 | 开 | 让 canvas 2D 的 `drawImage` 始终用高质量插值（fume 的字块快照、cadenza 的叠层等）。只作用于 64×64 以上的 2D 画布，封面色取样、图标那类小画布不碰。 |
| 视频导出时自动暂停超采样 | 开 | 见下面「视频导出」。 |
| 应用设置后自动重载渲染 | 开 | 改动上面任何一项就地把歌词画布按新设置重建，不用再切一次歌词动画。关掉它则改用命令面板的「重新应用」手动触发。 |

命令面板里两条：**「超采样与 MSAA：重新应用」**（改完设置后手动触发，同样会重载渲染）和**「超采样与 MSAA：诊断」**。

### 自动重载渲染怎么做的

宿主只在两个地方重读 `devicePixelRatio`：窗口 `resize`，和画布容器的 `ResizeObserver`。而窗口尺寸没变时，派发一个 `resize` 事件不会让 `ResizeObserver` 回调——hanabi 的运行时是在 `resizeToHost()` 里读 dpr 的，所以以前必须切一次歌词动画。

现在设置一变（去抖 250 ms）模组就把画布容器临时减 1 px、下一帧还原：`ResizeObserver` 因此回调两次，运行时当场 `renderer.resize(w, h, 新倍率)` 并按新倍率重建场景纹理，最后再补一次真 `resize` 给那些按窗口尺寸量的 2D 画布。

为免误伤，只挑同时满足这些条件的画布（最多 4 个）：面积 ≥ 视口 20%、边长 ≥ 64 px、父容器尺寸与画布尺寸相差 ≤ 2 px（即「容器就是这个画布」）、父容器不是 `body` / `html`。整个舞台容器（含字幕、背景、其它模组的小画布）一律不碰；`document.hidden` 时直接跳过；写内联样式包在 `try/catch` 里，节点中途被移除也不会抛。

诊断会报一行：`dpr 真实 1.00 → 生效 2.00 ｜ 方式 2× 超采样 ｜ 开关 超采样开 / MSAA关 / 2D插值开 ｜ 预算 2 倍缓冲 8.3M 像素 / 上限 33.2M（单独超采样档） ｜ 画布：1920×1080→2.00×`。判断有没有生效就看**画布那项的后备像素比是不是 2.00×**（用 MSAA 时 dpr 会回到 1.00，看同一行里的 `MSAA开`）——如果还是 `1.00×` 而方式是超采样，跑一次「重新应用」（或等自动重载）让它重建。

## 为什么这样能去掉锯齿

这些歌词渲染器（`monet / lattice / hanabi / lumiere / fume / cadenza / pendolo / diorama / tempera / sonnet`）都把歌词画在 canvas 或 Pixi 的字形纹理上，并且用同一套规矩取像素密度：

```ts
// src/components/app/lattice/lyrics/createLatticeLyricRuntime.ts
export const latticeLyricResolution = (devicePixelRatio: number) =>
    Math.min(2, Math.max(1, Math.ceil(devicePixelRatio)));

// src/components/visualizer/lumiere/lumiereRuntimeTuning.ts
return Math.min(2, Math.max(1, ratio));

// src/components/visualizer/hanabi/createHanabiPixiRuntime.ts
const MAX_RESOLUTION = 2;
// src/components/visualizer/fume/useFumeCanvasStage.ts
snapshotScale: clamp(window.devicePixelRatio || 1, 1, 2)
```

在 100% / 125% 缩放的屏幕上这就是 1：字形只按 1 倍光栅化，随后被动画缩到 0.7~0.9 倍、再加上模糊/发光滤镜，缩小采样既没有 mipmap 也没有额外采样点，边缘就是台阶和缩放时的抖动。

模组把 `devicePixelRatio` 垫到 2 之后，上面每一处都会按 2 倍分配画布与纹理，最后合成器做一次 2:1 降采样——这就是 SSAA。模组只能从这个旋钮下手：渲染器实例是宿主创建的，`renderer.resolution`、`BlurFilter`、字形纹理在模组里都拿不到。

为什么只垫到 2：应用自己把每个渲染器的分辨率上限都钳在 2（见上），再高也会被钳回去；而且它按整数取，2.5 这类半档会让字形纹理按 3 倍分配，纯亏显存。

`classic / partita / cappella / still` 这类纯 DOM 排版的歌词不受影响，也不需要——它们的字由浏览器按当前变换重新光栅化，本来就没有锯齿。本模组只改画布路径。

## 为什么 hanabi 的卡片边要单独一层

hanabi 的「卡片 / 色块 / 白边 / 装饰线」不是画在纹理上的，而是 `Texture.WHITE` 拉伸出来的四边形（`collage/collageViews.ts` 里的 `rect` / `setRect` / `rim`），边是纯几何边。而它建 WebGL 上下文时写的是：

```ts
// src/components/visualizer/hanabi/createHanabiPixiRuntime.ts
contextOptions: { antialias: false, alpha: true, ... }
```

几何边没有多重采样，卡片旋转两三度就是硬台阶；2 倍超采样只能把台阶高度减半（1 CSS px → 0.5），所以「开了还是有点毛」。模组在 `HTMLCanvasElement.prototype.getContext` 上把 `webgl` / `webgl2` 的 `antialias` 顶成 `true`，让 MSAA 直接给这些边做覆盖采样。

选型：

| 锯齿来源 | 该开哪个 |
| --- | --- |
| 卡片、色块、装饰线、白边的**几何直边** | `强制 MSAA` |
| 字形纹理、贴图、缩放/模糊时的**采样不足** | `2× 超采样` |

两个都开就是「超采样 + MSAA」：字形、贴图、几何边全覆盖。开销是相乘的，所以叠加档的像素预算更紧——2 倍后超过约 830 万像素（1920×1080 @2x）时自动收掉超采样、只留 MSAA；关掉 MSAA 立刻回到单独超采样的宽松预算（4K @2x）。已经建好的 WebGL 上下文改不了属性，所以改 MSAA 开关后要重启或切换一次歌词动画。如果某次 `getContext` 拿不到带 MSAA 的上下文（个别驱动上 `antialias` 与 `desynchronized` 的组合会返回 null），模组会退回宿主原本的参数，不会把 null 交给宿主。

顺带说明：拼贴里的小贴纸、胶带、网点底纹是 Canvas2D 画的固定像素纹理（`STICKER_PX = 112`、胶带 `160×48`、网点 26px 一格），按 `size / 89.6` 放大摆放。它们的分辨率被 `Math.min(2, …)` 钳在 2 倍，超采样之后基本够用；真要再糊，是宿主把纹理画小了，模组这边够不到。

## hanabi 的字为什么不跟着变清楚

这是「开了也像没开」最常见的原因。hanabi 的歌词字不是普通文本，而是 `buildGlyphAtlas`（`text/glyphs.ts`）把一行里每个字、每个变体（`fill` / `fat` / `glow`）画进**一张图集**，再由精灵缩放摆放。图集有个写死的尺寸上限：

```ts
// src/components/visualizer/hanabi/text/glyphs.ts
const limit = options.maxCanvasPx ?? 4096;
const resolution = Math.max(0.1, Math.min(options.resolution, limit / width, limit / height));
canvas.width = Math.ceil(width * resolution);
```

关键是 `width` / `height` 是**逻辑像素**。所以把 dpr 抬到 2 只能让 `options.resolution` 变成 2，`limit / width` 这一项不变：一行里十几个不同字符、字号又大的时候，`4096 / width` 落在 1.0~1.5，图集照样按这个倍率光栅化。字再大也只是同一张低分辨率图集被放大——超采样在这里无效。

一个粗略的算式：字号约 134px（`glyph.size * 1.12`）时一格的边长约 264px（字框 1.3 倍 + 光晕外扩），一行 13 个字符 × 3 个变体 ≈ 40 格，装箱后边长约 1900px → `4096/1900 ≈ 2.1`，勉强能吃满 2 倍；一旦带上 scramble 扰码（+14 个字符）或整行更长，边长到 2700~3400px，倍率就掉回 1.2~1.5。

模组对 hanabi 仍然有效的是这三块：拼贴纹理（`createHanabiTextures(pixi, renderResolution)` 的贴纸/胶带/网点）、场景渲染分辨率，以及 MSAA 对卡纸、色块、装饰线几何边的处理。**只有歌词字本身够不到。**

要真正提高字，得改宿主。仓库根目录的 `patch/hanabi-glyph-atlas.patch` 是一处两行的改动（给 `buildGlyphAtlas` 传 `maxCanvasPx: 4096 * resolution`，让上限跟着分辨率一起放大），对源码构建有效。注意代价：图集从约 4000² 涨到约 5500²，每行图集的显存从几十 MB 到一百多 MB，小显存机器要谨慎；想温和一点就写 `maxCanvasPx: 6144`。

想直接看到模组的效果，换一个不靠图集的样式试试：`monet` / `lattice` / `lumiere` / `fume` / `cadenza` 都是按 dpr 直接光栅化（lattice 是逐行光栅化，没有这张全局图集），2 倍超采样的差别很直观。

## 视频导出

视频导出时宿主会把主窗口按 `预设像素 / dpr` 缩到 CSS 尺寸，再从这份画面录制。超采样把 dpr 报成 2，窗口就会只剩四分之一大小，导出的画面会被放大糊掉。

所以模组在导出开始时**自动**让出超采样。判断方式是看 `document.head` 里有没有那个光标守卫 `<style data-folia-video-export-cursor-guard>`，而这个判断直接写在 `devicePixelRatio` 的 getter 里**同步**做——必须同步，因为 `prepareVideoExportWindow` 是「插 style → 读 dpr → 交给主进程」在同一个任务里完成的，异步观察已经来不及。

它不再包装 `Node.prototype.appendChild`：宿主插的每个节点都不经过模组，只有读 dpr 这一下才碰 DOM（查 `head` 的子节点，范围极小）。导出结束后守卫被移除，getter 自然恢复报 2。

这个选择器是宿主的实现细节。如果哪天宿主改了标记，最坏情况是导出保护失效（导出画面被缩到四分之一），不会影响其它功能：那时请在上表里手动关掉「2× 超采样」再导出，或者关掉整个模组。`MutationObserver` 只负责在状态切换时写一句日志、通知订阅者。

## 动了哪些全局接口

这个模组改的是窗口级接口，影响面必须写清楚。逐项如下（`client.mjs` 里对应位置都有注释）：

| 接口 | 什么时候动 | 影响范围 | 收窄手段 |
| --- | --- | --- | --- |
| `window.devicePixelRatio` | 只有「2× 超采样」开着时 | 整个窗口所有读 dpr 的代码：歌词画布变成 2 倍；封面、设置页预览、其它模组的画布也跟着按 2 倍分配 | 只升不降（真实 ≥2 的屏无变化）；分档像素预算（单独 3320 万 / 叠加 830 万像素）超了就退回真实 dpr；导出期间自动让出 |
| `window.matchMedia` | 同上 | 所有 `matchMedia` 调用 | 只改写「等于虚拟倍率」的分辨率查询（`(resolution: 2dppx)` → `(max-resolution: 2dppx)`），其它查询原样转发；停用时删掉自己加的属性 |
| `HTMLCanvasElement.prototype.getContext` | 始终装着一层，行为由开关决定 | 所有新建 canvas 上下文 | `webgl/webgl2`：仅在「强制 MSAA」开着时把 `antialias` 顶成 `true`；`2d`：仅在「2D 高质量缩放」开着且画布 ≥64×64 时包 `drawImage`，并且每帧只在 `imageSmoothingQuality !== 'high'` 时补一次 |
| `window` 的 `resize` 监听 | 始终 | 只读 | 只在尺寸变化时重算预算；不拦截、不伪造宿主的 resize（重载渲染那一次 `dispatchEvent` 是用户主动触发的一次性动作） |
| `Node.prototype.appendChild` | **不再包装**（1.1.7 起） | — | 导出状态改为在 dpr getter 里同步查 `document.head`，宿主插节点不再经过模组 |

仍然躲不开的两处：

- **dpr 一定是全窗口的**。模组拿不到宿主渲染器实例（`renderer.resolution`、`BlurFilter`、字形纹理都不在手边），`devicePixelRatio` 是唯一能影响它们光栅化倍率的旋钮。所以超采样默认关闭，由用户决定要不要为整窗付这 4 倍像素。
- **MSAA 只认建上下文那一刻的参数**。要作用于歌词画布，只能在 `getContext` 上做，而这一层看到的 canvas 还没插进 DOM、没法判断它属于谁。因此它同样默认关闭，并在设置项描述里写明「作用于本窗口此后新建的每个 WebGL 上下文」。

依赖宿主实现细节的地方（都在失效时只降级、不报错）：视频导出的光标守卫选择器、`document.head` 里的 `style` 节点、以及「宿主只在 resize / ResizeObserver 里重读 dpr」这条行为。

## 代价与限制

- 歌词画布的像素数变成 4 倍，GPU 填充与显存相应增加。影响的是**所有**读 dpr 的画布（播放页、歌词预览、OBS 源、封面取色等），所以默认关闭。
- 超采样有像素预算：单独开时 2 倍缓冲超过约 3320 万像素（3840×2160 @2x）才退回真实 dpr，只挡 8K 级窗口；4K 下 2 倍约 33M 像素、单缓冲约 132MB。
- 与 MSAA 同开时预算收到约 830 万像素（1920×1080 @2x）——乘 4 个采样后总采样量正好与「4K 单独超采样」持平。按这个上限，1080p 窗口叠加占用约 265MB/画布；1920p 级窗口想叠就把 `COMBINED_PIXEL_BUDGET` 改成 `2560 * 1440 * 4`（约 470MB/画布），4K 叠加约 1GB/画布，不建议。
- MSAA 每像素再多 4 个采样点，最吃带宽；掉帧就先按上面的预算收一档，或把 MSAA 关掉换回单独超采样。
- 只在真实 dpr < 2 的屏幕上改变画面；本来就 ≥2 倍的高分屏（Retina / 手机 PWA）画面不变。
- 高倍缩放（150%、175%）的 Windows 屏幕：`devicePixelRatio` 是 1.5/1.75，垫到 2 之后有轻微超采样；这是因为应用内部按 `ceil` 取整数、把上限钳在 2。
- 模组改的是全窗口的 `devicePixelRatio`，不区分画布用途；如果将来某个渲染器在 2 倍下出问题，先关「2× 超采样」确认是不是这里引起的。
- 停用模组会把 `devicePixelRatio`、`matchMedia`、`getContext`、`document.head` 上的观察者和窗口 `resize` 监听上的改动全部还原，并通知订阅者重新取值。

## 1.1.1：黑屏那个 bug

**1.1.0 的问题**：MSAA 默认开着、超采样也默认开着，两者叠加 = 16 倍帧缓冲。1080p 全屏一块画布就要几百 MB，设置页里还有几个歌词预览各自要一份，离开设置页时播放页再建一份，GPU 进程直接崩掉——整窗黑屏。

**1.1.1 的改法**：

1. 两者互斥：开 MSAA 时超采样让位；MSAA 默认改成关。
2. 超采样加像素预算（2 倍缓冲 > ~1470 万像素就退回真实 dpr）。
3. MSAA 拿不到上下文时退回宿主原参数，绝不返回 null。
4. 通知订阅者改成**异步**（下一个任务）且只碰分辨率查询，不再伪造 `window` 的 `resize`；设置变化在 `try/catch` 里应用，出错只记日志，不会把异常抛回宿主的设置流程。
5. 重复加载（重载 / 重新启用）时先收掉上一份补丁，避免两层 `devicePixelRatio` 覆盖互相删掉对方定义的属性。

**1.1.2**：启用时往日志里打一行 `超采样与 MSAA v1.1.7 已启用：2× 超采样，dpr 1.00→2.00`（1.1.2~1.1.6 的前缀是「歌词抗锯齿」）。日志里有没有这一行，就是「模组到底加载了没有、当时生效的是哪种方式」最直接的证据。

**1.1.3**：启用和「重新应用」之后各补一次 `resize`，让已经在跑的渲染器（hanabi / lumiere 是在 `resize` 里重算分辨率、重建纹理的）当场跟上新的像素比，不必切样式；「诊断」在超采样生效时会附一句「字仍糊多半是图集 4096 上限」。

**1.1.4**：像素预算从 2560×1440 @2x（约 1470 万像素）放宽到 3840×2160 @2x（约 3320 万像素）——当时两者还互斥，预算只剩「挡住 8K 极端窗口」这一个职责，2K / 4K 屏不该再被降级。顺带核对过 hanabi 的拼贴纹理（`collagePainters.ts` 的 `createCollageTextureCache`、`unitCollage.ts` 的纸片网点、`mg/textures.ts` 的粒子纹理），三者都按 `min(2, resolution)` 开画布，**没有**被烘焙成 1 倍纹理，所以超采样对卡纸、贴纸、胶带、粒子确实有效；只有字形图集是硬上限（见上文）。

**1.1.5**：超采样与 MSAA 不再互斥，可以同时开。为了不重走 1.1.0 的黑屏，叠加单独有更紧的一档像素预算 `COMBINED_PIXEL_BUDGET = 1920 * 1080 * 4`（2 倍后约 830 万像素，乘 4 个采样后与 4K 单独超采样的总采样量持平）；超预算时自动收超采样、留 MSAA，窗口缩回来或关掉 MSAA 就恢复。诊断里多一行「预算 …M 像素 / 上限 …M（叠加 MSAA 档 / 单独超采样档）」，切换开关后超采样是否还在生效一眼可见。

**1.1.6**：新增「应用设置后自动重载渲染」（默认开）。改动任何开关后去抖 250 ms，把每个紧贴画布的容器减 1 px 再还原——`ResizeObserver` 回调两次，运行时当场按新像素比 `renderer.resize()` 并重建场景纹理，再补一次真 `resize` 给量窗口的 2D 画布。以前那种「改完设置得切一次歌词动画」的操作不再需要；「重新应用」命令走同一条路径。MSAA 的 `antialias` 依然只能在建上下文时定下来，切换 MSAA 后日志会写明「当前上下文要等下次重建」，几何边要等切动画或重启才跟上。

**1.1.9**：收窄对全局接口的占用，并把默认值改成保守一侧。

1. **不再包装 `Node.prototype.appendChild`**。导出状态改在 `devicePixelRatio` 的 getter 里同步查 `document.head`；宿主插任何节点都不再经过模组。顺带删掉了导出结束的 500 ms 轮询，换成一个只写日志 / 发通知的 `MutationObserver`。
2. **`getContext` 的 2D 分支收窄**：只给 64×64 以上的画布包 `drawImage`，封面色取样、图标、缩略图不受影响。
3. **自动重载只抖覆盖视口的大画布**（面积 ≥ 视口 20%、父容器≈画布尺寸、最多 4 个），并加了 `document.hidden` 跳过与 `try/catch`。
4. **2× 超采样默认关闭**。整窗帧缓冲 4 倍的开销交给用户自己决定；「强制 MSAA」也保持默认关。
5. 修掉一处默认值判断：`msaa` 原来用 `!== false`，宿主还没写过这个键时会被当成「开」；现在两项都用 `=== true`。
6. 作者改为 ACUNGER；`client.mjs` 去掉了 `import('../folium')` 这类宿主仓库内的类型路径，改成文件内的结构类型注释；模组名、设置分区名、命令名统一成「超采样与多重采样抗锯齿 / 超采样与 MSAA」。

**如果还是黑屏**：

请重启Folia

## 文件

```
antialias-ssaa-msaa/
  mod.json     清单：id / 版本 / 作者 / 入口 / 预览 / 权限（无）
  client.mjs   全部逻辑：超采样、查询改写、MSAA、2D 插值、导出保护、自动重载、设置与命令
  preview.png  面板里的预览图
  README.md    这份说明
```

`client.mjs` 里的类型注释全部是文件内定义的（`@typedef {object} FoliumHost`），只描述用到的那几个宿主方法，不引用宿主仓库的 `.d.ts`，编译与运行都不依赖它。
