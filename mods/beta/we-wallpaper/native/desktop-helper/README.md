# folia-wallpaper-helper

Windows 桌面壁纸模式的辅助进程。由 Electron 主进程（`electron/wallpaper/windowsWallpaperController.cjs`）
spawn，负责把 Folia 主窗口挂入桌面图标层之下的 WorkerW 层，并在 explorer
重启 / WorkerW 重建时自行重挂。

协议（详见 `src/cli.rs` 与 `src/events.rs`）：

- 命令行：`attach --hwnd <n> [--zguard]`（常驻）、`move --hwnd <n>`、
  `detach --hwnd <n>`（一次性）。未知选项直接报错退出，避免主进程拼错参数被静默忽略。
- **选屏**：helper 不接受选屏参数，但选宿主 WorkerW 是它的职责。它在 `SetParent` **之前**取窗口
  所在显示器作为目标，再挑选**覆盖该显示器的 WorkerW**作为宿主（24H2+ raised 桌面每块屏一个
  WorkerW），并按该屏 `rcMonitor` 摆好窗口。原因：`SetParent` 保留子窗口的父客户区坐标，窗口会
  视觉平移到宿主 WorkerW 的原点——选错宿主就会把壁纸永远铺在宿主那块屏上。找不到匹配宿主
  （classic 桌面只有一个跨虚拟屏的 WorkerW）时回退原有的「classic sibling → raised Progman
  child」探测，几何换算照旧。
- stdin：`detach`（常驻进程退出前先还原窗口）。stdin EOF 同样触发还原。
- stdout：JSONL 事件
  `{"event": "attached"|"heartbeat"|"workerw-destroyed"|"explorer-restarted"|"reasserted"|"moved"|"detached"|"error", ...}`。
  `attached` 附带 `mode`（"classic"|"raised"，桌面架构）。
- helper 不注册 Raw Input 或全局鼠标监听，也不读取、输出鼠标或键盘事件。桌面模式通过模组托盘返回选歌窗口；普通 Folia 窗口的指针交互由模组 preload 的 pointer 路径处理。

构建：Windows 上 `cargo build --release`（由 `packaging/windows/build-wallpaper-helper.mjs`
驱动）；纯逻辑单测（CLI 解析、JSONL 事件）可在任意平台 `cargo test`，Windows 相关模块
被 `#[cfg(windows)]` 门控。

## 代码来源与许可

本 crate 随 Folia 以 **AGPL-3.0** 发布。取用的上游实现：

| 模块 | 来源 | 许可证 |
| --- | --- | --- |
| `attach.rs` | Seelen UI `wallpaper_manager/{mod,handlers}.rs` | AGPL-3.0 |
| `attach.rs` | Lively Wallpaper `DesktopUtil.cs` | GPL-3.0 |
| `monitor.rs` | TaskbarCreated + PID 比对逻辑译自 Lively `WinDesktopCore.cs`| GPL-3.0 |

上游版权声明已保留在对应文件头中。
