# AI 逐段歌词导演 · lyric-ai-segment-director

把一整首歌交给 AI，排成一段段的演出剧本：每段多长、用哪个歌词动画模式、调哪些样式参数、
动画强度多高、换成哪种背景，全部由 AI 按它对这首歌的理解决定。播放时在句子之间的空隙里
逐段切换，不会把当前这句歌词打断。

- **按段排演，不是按句**：默认每段 2~4 句（可关掉），一段一个完整的视觉决定。
- **只切模式和参数**：不动你的歌词源、不动播放，切之前还留了提前量和闪黑过渡。
- **提前为下一首排演**：当前这首排完就顺手把队列里的下一首准备好，切过去时不用等 AI。
- **可恢复**：第一次改动前存一份快照，随时「恢复原来的设置」，也能一键交还控制权。

## 需要什么

| 项 | 要求 |
| --- | --- |
| Folia | 0.7.22 ~ 0.8.0（Folium 1.7 及以上） |
| 模组系统 | 设置 → 模组 → 打开「模组系统」总开关，再逐个确认启用 |
| AI 接口 | 任何兼容 OpenAI `chat/completions` 的接口：DeepSeek、OpenAI，或本机的 Ollama / LM Studio（填自定义接口地址） |
| API 密钥 | 在模组设置里填，由 Folia 的 `secret` 字段加密保存 |

## 安装

1. 打开「设置 → 模组」，把「模组系统」开关打开。
2. 「模组 → 从文件安装」，选这个目录打成的 zip（顶层要是 `lyric-ai-segment-director/`），
   或者直接把整个目录复制到 `%APPDATA%\folia\mods\`。
3. 在模组面板里确认启用（会列出声明的权限与它用到的内部接口）。
4. 打开「设置 → 模组 → AI 逐段歌词导演」，选服务商、填 API 密钥和模型名。

## 用起来

播放任意一首有歌词的歌，AI 会自己排一份剧本，播放页右侧的「逐段导演」标签里能看到
每一段用第几句到第几句、什么模式、什么强度、什么背景，以及 AI 给的理由。

命令面板里还有四个命令：

- `AI 逐段导演：为这首歌（重新）排演`
- `AI 逐段导演：AI 接管（切回设计的动画）`
- `AI 逐段导演：停止本首自动切换`
- `AI 逐段导演：恢复原来的设置`

设置里能调的东西：服务商 / 接口地址 / 模型 / 温度、换歌时自动排演、提前为下一首排演、
是否同时调整参数、硬限制每段 2~4 句、切换时闪黑过渡、提前切换秒数、偏好提示。

## 权限

| 权限 | 用途 |
| --- | --- |
| `filesystem.data` | `folium.storage`：存每首歌排好的剧本、设置快照。只在本模组自己的存储命名空间里，不上传。 |

> 注：`mod.json` 里另外声明了 `net.fetch`，用途是经主进程代发、不受 CORS 限制地请求你配置的
> OpenAI 兼容接口。

`folium.secrets`（API 密钥）不需要权限；密钥只发给上面配置的那个接口。

## 兼容的第三方动画

本模组不自己画画面，只是**调度**已有的歌词动画模式。所以它天生就能指挥任何已安装的
第三方 visualizer——第三方模式会出现在给 AI 的候选清单里，标着「（第三方）」。

下面这些模式带**画面画像**（AI 知道它长什么样，因而选得更准）：

| 模组 | mode id | 名字 |
| --- | --- | --- |
| `cinerama` | `mod:cinerama:cinerama-screen` | 巨幕 |
| `visualizer-jump` | `mod:visualizer-jump:jump-course` | 跳一跳 |
| `vinyl-disc` | `mod:vinyl-disc:disc` | 黑胶唱片 |
| `wave-light` | `mod:wave-light:wave-light` | 动感波光 |
| `visualizer52hz` | `mod:visualizer52hz:rings` | 52Hz |

其它第三方 visualizer 照样能选，只是 AI 只拿到一句中性描述（「画面形态未知，但可正常播放」），
选它的倾向会低一些。想让它更准，可以给本模组提 issue 补画像。

**会被排除的模式**：委托型包装（自己不画、把画面转交给别的模式）不会进候选，例如
`lyric-style-switcher` 的「随机」（`mod:lyric-style-switcher:random-lyric-style`）。
本模组要按段决定画面，选中这类模式等于放弃控制。

## 和其它模组的配合

- **`k3panel`（商籁深度精调）**：「商籁」有两套参数——本模组用宿主内置的那套
  （`cameraIntensity`、`typographyMotion`、`mgDensity` 等，经 `handleSetSonnetTuning` 写入），
  k3panel 另有一套深调系数（`cameraScale`、`motionScale`、`breathScale` 等，走宿主的 `modTunings`）。
  两套是**相乘**关系，互不干扰：AI 只碰内置那套，k3panel 的旋钮始终归你自己调。
  提示词里已经写明，AI 不会去写那些键。
- **其它模组的设置不会被动**：本模组只改写「当前歌词动画模式 / 该模式的样式参数 / 动画强度 /
  背景类型」这四类，且第一次改之前存了快照，随时可以「恢复原来的设置」。
- **和 `lyric-ai-director-plus` / `lyric-ai-director` 的关系**：这三个都是「AI 选动画」类模组，
  功能重叠，建议**只开一个**，同时启用会互相抢着切模式。

## 内部接口

这个模组用 `folium.internals` 读写宿主内部的 visualizer 设置 store 与注册表：

- 读取当前动画模式列表、切换模式、读改写内置模式的样式参数、写动画强度、写背景类型。

`folium.internals` **没有任何兼容承诺**（Folium 2 会整个移除），所以：

- `mod.json` 钉了 `"folia": ">=0.7.22 <0.8.0"`，Folia 超出这个范围时加载器会拒绝加载；
- 模组面板与启用确认窗口里会标出「使用内部接口」；
- 因此它只申请收录到**先行测试（Beta）**渠道。

## 隐私

只把歌名、歌手和歌词发给你自己配置的那个接口；不收集、不上传任何其他数据，
不下载也不执行远程代码。剧本、设置快照都只存在本机。

## 许可证

MIT，见 [LICENSE](LICENSE)。参数白名单与接口地址处理的部分参考了
[wittyfunn/lyric-ai-director-plus](https://github.com/wittyfunn/lyric-ai-director-plus) 与
[duoduo1232/lyric-ai-director](https://github.com/duoduo1232/lyric-ai-director)（均为 MIT）。
