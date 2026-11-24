# Wallpaper Engine 原生联动

Windows x64 / Folia 0.7.27 / Wallpaper Engine，0.4.8 候选版，正式渠道申请以维护者复审结果为准。

由 Wallpaper Engine 原程序运行已安装的场景、视频或网页壁纸，通过 Windows Graphics Capture、D3D11 共享纹理接入 Folia 背景，再由 Folia 绘制歌词。模组不复制壁纸工程，也不在 Folia 渲染进程执行工坊脚本。

## 安装与使用

将 release zip 拖入 Folia 的模组面板，确认并启用。在「歌词样式 → 背景」选择「Wallpaper Engine 原生画面」，选择已安装的壁纸及 WE 保存的预设。选中本背景才启动捕获；换成其他背景停止模组专用渲染。若原版「透明背景」处于开启状态，选择 WE 背景后会关闭它，使用 Folia 自身的歌曲、播放进度和状态交接恢复窗口，避免背景层被透明模式跳过。参数保存在本模组数据目录。

「显示到桌面」将当前 Folia 窗口放入 Windows 桌面层。原版播放按钮、进度条和调节面板继续使用；导航按钮以当前界面最上方的原版圆按钮为锚点：资料库/墙面有定位按钮时采用相同的 40px 尺寸，没有定位按钮时跟随 48px 设置按钮；中心对齐、上下间隔 12px，不预留空白按钮位置。普通窗口显示桌面图标，桌面模式显示选歌图标。闲置时降低透明度，靠近后变清晰，悬停显示文字提示；原版工具面板展开时隐藏导航按钮。桌面模式也会显示一个「Folia · Wallpaper Engine」托盘图标，单击图标或右键选择「选歌 / 返回 Folia 窗口」恢复普通窗口。此桌面会话由模组自己管理，独立于 Folia 自带的桌面模式；不要同时启用两套桌面模式。

日常选择壁纸、预设、帧率和鼠标交互统一在背景页。模组页保留运行状态、使用路径与 WE 原属性高级选项，不再重复壁纸网格；已保存的参数沿用原存储键。切换帧率和交互开关不重建壁纸卡片，桌面浮层观察器只在桌面模式运行。捕获上限提供 30 / 60 / 120 / 144 FPS，「沿用 WE」仍为默认；此项不会修改 WE 自身帧率，状态所列也是上限而非实测帧率。高帧率需同时在 WE 中设置，视频受源视频帧率限制；30 FPS 可减少捕获和传输工作。

## 范围

仅支持 Windows x64，兼容 Folia 0.7.27 正式版及 0.7.27-beta.* 构建。由于 Folium 1 的清单版本比较不识别 beta 后缀，本包在入口按 app.getVersion() 校验 0.7.27 版本，其他版本会拒绝加载。需要用户自行安装并运行 Wallpaper Engine、已有可用的壁纸；本包不包含 Wallpaper Engine 或工坊壁纸。

这是原生 GPU 捕获的实验实现。桌面挂载、窗口几何等依赖 Windows 桌面结构；当前桌面输出仅支持主显示器（WE Monitor0）。桌面交互仅限 Folia 原版控件和其唤出区域：模组读取 Folium 的 player.layout，将独立透明窗口裁剪到这些区域，把该窗口自身收到的鼠标事件送入原版窗口。区域外不接收鼠标，不使用 Raw Input、全局鼠标钩子或鼠标位置轮询。普通 Folia 窗口收到的指针事件仍可转发给 WE 壁纸。原生捕获暂不提供 OBS 或视频导出，预览只使用壁纸自己的介绍图。后台恢复偶尔仍可看到歌词短暂追帧，未宣称所有驱动和桌面环境都无缝。

## 数据与进程行为

- 通过 Steam 注册表项和 libraryfolders.vdf 定位安装目录，读取 WE config.json、已安装项目的 project.json 和预览图片，读取保存属性与预设。文件扫描和 JSON 解析在工作线程进行。
- 调用 WE 自带命令行创建、更新和关闭有本模组名称的离屏壁纸窗口。Folia 持续隐藏或最小化后只关闭模组专用窗口，恢复显示时重新打开并保留上一帧过渡，不发送影响全部壁纸的 pause/play。桌面模式会暂时关闭主显示器（WE Monitor0）的原 WE 桌面，退出时恢复壁纸和属性，不结束 WE 主进程。
- 包内 helper 对本次 Folia 窗口执行桌面挂载及窗口状态监测，不注册 Raw Input、不读取鼠标或键盘输入。桌面输入窗口使用本地空白页面、sandbox 和 contextIsolation，关闭 Node integration，IPC 仅接受该输入窗口的主 frame；区域内的点击、拖动、滚动转交给原版 Folia 控件，不重新实现播放器。输入窗口位于桌面图标层之上、普通应用窗口之下。退出桌面模式、宿主导航或停止模组时释放输入窗口。
- 本地预览服务只监听 127.0.0.1 的随机端口，URL 含随机会话令牌，只返回选中库项目目录内的预览图片；不开放目录浏览或任意文件读取。纹理 IPC 核对当前 Folia 主窗口的主 frame；官方业务 RPC 要求该 frame 经 bootstrap 取得的随机会话凭据，页面导航、渲染进程退出或模组卸载时失效。
- 壁纸选择、属性修改和桌面控制使用 Folium 官方模组 RPC；自定义 preload 不再暴露通用 request。session preload 仍在默认 session 注册，但先经主进程核对当前主窗口身份，只有获准的主 frame 初始化纹理接收器并暴露画布与指针接口；辅助输入页、遥控页和子 frame 不暴露接口。Folia 主页面内不同模组仍共用 JavaScript 环境，此项不声称对同页面的恶意模组提供隔离。
- 不进行遥测或上传用户数据，不下载执行远程代码。壁纸本身的联网行为由用户选择的 WE 壁纸及 WE 原程序负责。

permissions: filesystem.data（保存本模组参数和桌面恢复信息）、stageLayers（导航按钮）；experimental: player.layout（读取原版控件及唤出区域布局）；无 embedOrigins。renderer 使用版本限定的 Folia preload 读取原桌面模式并完成旧开发版设置迁移，读取既有 visualizer_background_mode 键和背景 DOM；无宿主源码补丁。

## 构建原生模块

Windows x64、Node.js 24+、Rust stable MSVC 工具链与 Windows SDK：

~~~powershell
node native/build.mjs
~~~

脚本用 --locked 构建两个 Cargo 项目，产物写入 bin/；编译路径做前缀重映射。公开仓库的 Build native artifacts 工作流使用 Rust 1.99.1 / Node.js 24，在 Windows 上重建并记录提交号与两个二进制的 SHA-256。第三方 Rust 依赖版本见两个 Cargo.lock。普通安装无需 Rust，也不会在启用时编译或下载依赖。

本模组及由 Folia 适配的桌面代码采用 AGPL-3.0。具体来源、第三方许可证见 THIRD_PARTY_NOTICES.md 和 licenses/。运行截图只演示组合效果，壁纸权利属于各自作者。
