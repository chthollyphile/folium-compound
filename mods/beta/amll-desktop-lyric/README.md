# 桌面歌词 (AMLL) · Folia 模组

给 [Folia](https://github.com/chthollyphile/folia-major) 做一个独立的桌面歌词窗口，渲染用
[applemusic-like-lyrics](https://github.com/amll-dev/applemusic-like-lyrics) 的
`@applemusic-like-lyrics/core`（逐字歌词），窗口形态照 [SPlayer](https://github.com/SPlayer-Dev/SPlayer)
的桌面歌词。

## 和 Folia 自带「桌面歌词」的区别

Folia 托盘里那一项只是把**主窗口**变成透明置顶 + 鼠标穿透，形状、位置、显示内容都跟着主窗口走。
这个模组另开一扇自己的窗：

- 独立的无边框透明窗口：置顶、不进任务栏、不抢焦点
- 顶部三栏控制条（歌名 / 上一首·播放·下一首 / 锁定·关闭），鼠标移进来淡入，停住一会儿自己收起
- 三种形态：单行、双行（当前句 + 下一句）、多行歌词板
- 可选的窗口底色：透明 / 纯色 / 跟随主题背景色，带不透明度、圆角和可单独开的描边
- 锁定（鼠标穿透）时点击落到桌面，鼠标移回来临时解冻，控制条可以点
- 按住窗口任意处拖动；位置记在模组自己的数据目录，下次启动恢复
- 单行 / 双行形态下 **字号 ↔ 窗口高度互推**：改字号窗口跟着变高，拖窗口高度反过来改字号

## 装

```bash
npm install
npm run build       # 产出 dist/desktop-lyric/
```

把 `dist/desktop-lyric/` 整个文件夹拷到 Folia 的用户模组目录（模组面板右上角「打开模组目录」，
打包版是 `%APPDATA%\Folia\mods`），或者把 `dist/desktop-lyric` 打成 zip 拖进模组面板。

然后在「设置 → 模组」：打开「模组系统」→「重载」→ 启用 `desktop-lyric`（会弹一次确认，
自己写的模组没有签名，这是正常的）。之后用命令面板的「桌面歌词：开关」开窗。

## 设置（设置 → 模组 → 桌面歌词）

主分区 39 项（窗口 / 歌词 / 外观三组），字体单独一个分区带自己的选择器。

**窗口**

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 窗口形态 | 单行 | 单行 / 双行（含下一句）/ 多行歌词板 |
| 不在任务栏显示 | 开 | 关掉后 Alt+Tab 里也能找到它 |
| 总在最前 | 开 | `screen-saver` 层级 |
| 锁定（鼠标穿透） | **关** | 见下面的「穿透怎么工作」。默认不锁，否则整窗点不动 |
| 忽略鼠标悬停 | 关 | 指针完全不进窗口：不出控制条、不响应悬停、也点不到。纯展示用 |
| 锁定位置 | 关 | 窗口钉在原地不能拖；和穿透是两件事 |
| 控制条 | 悬停显示 | 悬停显示 / 常显 / 一直隐藏（连 hover 都不出现，按钮也不吃点击） |
| 滚轮调字号 | 关 | 在歌词上滚滚轮改字号，一格 1px |
| 无歌词时隐藏 | 关 | 当前歌没有歌词时整扇窗隐形 |
| 暂停时不透明度 | 1 | 暂停时淡下去，1 表示暂停也不变 |
| 始终显示歌名 | 关 | 关掉时歌名只在 hover 时出现 |

**歌词**

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 字号 | 30 | 16–96；单行 / 双行下决定窗口高度，拖窗口高度也会反过来改它 |
| 对齐方式 | 居中 | 居中 / 靠左 / 靠右 / 左右交替（对唱，靠 AMLL 的 duet 标记） |
| 纵向位置 | 0.5 | 当前句在窗口高度上的位置；带式形态挪的是可见带，不会把当前句切掉 |
| 逐字渐变宽度 | 1 | AMLL 的 `wordFadeWidth`：1 ≈ Android Apple Music，0.5 ≈ iPad |
| 字重 | 400 | 300–900 |
| 翻译字号比例 / 翻译透明度 | 0.5 / 0.3 | 相对正文字号、AMLL 副行默认透明度 |
| 字间距 | 0 | -0.06 – 0.2em |
| 显示翻译 / 显示音译 | 翻译开、音译关 | 音译作为第三行 |
| 弹簧动画 | 开 | 关掉回退到 CSS 过渡，省 CPU |
| 弹簧质量 / 刚度 / 阻尼 | 1 / 100 / 10 | AMLL 的 `mass` / `stiffness` / `damping`，位置和缩放两套弹簧共用 |
| 字体 | — | 在「桌面歌词 · 字体」分区里选，见下 |
| 上下句模糊 | 开 | AMLL 的 `enableBlur` |
| 隐藏已唱行 | 关 | 只对多行歌词板有用 |

**外观**

| 项 | 默认 | 说明 |
| --- | --- | --- |
| 窗口底色 | 纯色 | 透明 / 纯色 / 跟随主题背景色 |
| 底色 / 底色不透明度 | `#0b0b10` / 0.45 | — |
| 圆角 / 窗口描边 | 12 / 开 | 描边可以单独开，透明底也能留一圈轮廓 |
| 已唱颜色 / 未唱亮度 | `#ffffff` / 0.5 | AMLL 只有一个颜色，已唱和未唱靠遮罩透明度分档 |
| 描影颜色 | `#000000` | 任何壁纸上都读得清的投影 |
| 歌词底色遮罩 / 遮罩颜色 | 关 / `#000000` | 浅色壁纸下在歌词后面垫一层底 |
| 跟随主题文字颜色 | 关 | 用 Folia 当前主题的主色当已唱颜色 |
| 不透明度 | 0.95 | 整窗 |

**字体（「桌面歌词 · 字体」分区）**

主字体 / 西文字体 / 中文字体 / 回退字体，四行各自一个**可搜索的本机字体选择器**（点「选择」展开，
列表来自扫描本机字体目录，缓存在模组缓存目录里 24 小时）。

拼出来的 CSS 字体栈是 `西文 → 中文 → 主字体 → 回退`：浏览器逐字形找字体，所以西文字体排最前面
（纯西文字体，如 Segoe UI / Inter / Georgia）时，中文字形会自然落到中文字体那一项。

- 主字体留空 = 用 Folia 主题解析出来的那份字体栈（含用户在 Folia 里选的字体的回退链）
- 西文 / 中文留空 = 不额外指定
- 回退 = 通用字族（`sans-serif` / `serif` / `monospace` / `system-ui` / `cursive` / `fantasy`）

命令（可绑全局快捷键）：「桌面歌词：开关」「桌面歌词：锁定 / 解锁」。

## 开发

```bash
npm run dev                 # watch src/window/**，产物直接写进 dist
npx electron dev/harness.cjs            # 单行
npx electron dev/harness.cjs double     # 双行
npx electron dev/harness.cjs board      # 歌词板
npx electron dev/harness.cjs --hover    # 带上 hover 控制条
npx electron dev/harness.cjs --drag     # 走一遍自建拖动，打印窗口位移
npx electron dev/harness.cjs --preview  # 生成 assets/preview.png（模组面板介绍图）
npm run dev:panel                       # 单独打包并打开字体选择器，截图到 dev/shot-panel.png
npm run dev:fonts                       # 走一遍字体枚举 rpc，打印本机字体数
```

`dev/harness.cjs` 不启动 Folia：它用 `dist/` 里那份真实的 `main.cjs` 开窗、喂假歌词、截图到
`dev/shot-*.png`。调完样子再进真宿主。改了 `client.mjs` / `main.cjs` / `preload.cjs` 要重跑
`npm run build`，再到模组面板点「重载」。

## 结构

```text
mod.json               模组清单：main 入口 + client 入口 + 权限
src/client.mjs         client 入口（单文件、无相对导入）：快照 → main、命令 → playback、
                       设置分区、字体选择器面板
src/main.cjs           main 入口（Node）：BrowserWindow、几何、锁定、置顶、字号↔高度、转发
src/fonts.cjs          main 侧的本机字体枚举（sfnt name 表解析，零依赖）
src/preload.cjs        歌词窗口的 contextBridge（只有状态下行和命令上行）
src/window/            歌词窗口页面（AMLL + rAF 外推时钟 + 顶部控制条 + 自建拖动）
build.mjs              esbuild 打包成 IIFE（file:// 下 module script 会被 CORS 挡掉）

> **client.mjs 必须是单文件。** Folia 只给 client 入口的 `folia-mod://` URL 加摘要版本号，
> 相对导入（`./fontPanel.mjs`）没有版本号，重载会从渲染进程的模块表里拿到旧代码。
> `npm run check:client` 会检查这一条。
dev/harness.cjs        离线开窗验证 + 截图
```

### 数据流

```text
Folia 渲染进程                 Folia 主进程                   歌词窗口
folium.playback.getState() ─┐
folium.lyrics.getLines()     ├─ rpc.call('state') ─→ main ─→ IPC ─→ 本地 rAF 外推 60fps
folium.events.*            ─┘                                    ↓
folium.playback.toggle()  ←─ rpc.on('cmd') ←─ IPC ←─ 控制条点击 / 按键
```

播放位置每 200ms 才跨一次进程，且只有漂移超过 120ms 才真的发；窗口自己按 `performance.now()`
外推，所以逐字动画是 60fps 的，不受 IPC 频率限制。唯一的偏差来自用户设置的歌词偏移（Folia 的
歌词时钟 `lyricTime` 只在 stage 挂载上下文里拿得到，模组从 activate 里够不着）。

## 穿透怎么工作

锁定（穿透）开着时，窗口**整扇**始终 `setIgnoreMouseEvents(true, { forward: true })`：点击落到下面的
窗口，`forward` 只把指针移动送进页面，用来浮出控制条、以及判断「指针现在压没压在锁定按钮上」。
只有指针压在**锁定按钮那一小块**（四周多给 6px）时才临时解冻，好让你用鼠标解锁。

指针一进窗口就整窗解冻是不行的——要点击就得把指针放上去，那样永远点得到、永远穿不过去。

## 已知限制

- 歌词颜色只在 `theme.changed` 事件里能读到，所以「跟随主题」在模组启动后会先用默认色，
  等第一次换主题（或换歌触发主题变化）才对齐。想稳定就用固定颜色。
- Linux 下 `setIgnoreMouseEvents(..., { forward: true })` 不生效，锁定后无法用鼠标解冻，
  只能用「桌面歌词：锁定 / 解锁」命令。
- 窗口按钮的命令有两条路：Folium 1.7 用 `api.rpc.send` 推送（即时）；1.6 没有这个通道，
  改成 main 排队 + client 每 150ms 来取（最多慢 150ms，功能一样）。Folia 0.7.21 及更早就是 1.6。
- 底色只能是纯色 + 透明度：透明窗口拿不到桌面画面，所以做不了真正的毛玻璃（Windows 亚克力要用
  `SetWindowCompositionAttribute` 之类的系统接口，模组碰不到）。
- 拖动是模组自己实现的（app-region 拖动会吃掉指针事件，hover 和穿透就不好使了）；窗口边缘的
  原生缩放在某些平台上和 `cursor: move` 打架，改字号更稳。

## License

AGPL-3.0-only。Folia 与 applemusic-like-lyrics 都是 AGPL-3.0。
