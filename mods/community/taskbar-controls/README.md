# 任务栏控制条（taskbar-controls）

把 Folia 的播放控制条搬到屏幕底部任务栏的左下角：一条全透明、只留图标与文字的窄条，
鼠标点上去就能上一首 / 播放暂停 / 下一首 / 循环 / 喜欢 / 静音 / 调音量 / 拖进度，
点右侧箭头还能展开第二排（返回一层、打开播放器侧边面板）。

## 功能

- 位置：贴着屏幕底部任务栏的左侧，跟随任务栏方向自动贴边；展开时向上长，底边不动。
- 尺寸：宽度、距左、距底、整体不透明度都能在设置里调，改完立刻重新贴边。
- 交互：单击各个图标执行对应播放操作；双击空白处或点箭头展开第二排。
- 命令：命令面板里有两个命令——「任务栏控制条：贴回左下角」（被别的置顶窗口盖住时用）、
  「任务栏控制条：隐藏 / 显示」（临时收起）。
- 全屏：Folia 自己的窗口进入全屏时自动隐藏，退出后自动恢复。

## 安全模型

- 控制条窗口**不开放 Node**：`nodeIntegration: false`、`contextIsolation: true`，
  页面里拿不到 `require` / `ipcRenderer` / `process`。
- 页面与主进程之间只有 `preload.js` 一个桥，通过 `contextBridge` 暴露给页面的是
  `window.tb` 上的白名单方法：`send(action, value)`、`resize(height)`、`onState(cb)`、`onError(cb)`。
  动作名与参数类型都在 preload 里固定，页面无法指定任意频道、无法传递任意对象。
- 所有 IPC 频道带 `taskbar-controls:` 前缀（`cmd` / `resize` / `state` / `error` / `config`），
  处理函数校验 `event.sender === 控制条窗口的 webContents`，不是本窗口发来的一律丢弃；
  模组卸载 / 重载时在 `dispose` 里逐个 `ipcMain.removeListener`，不会叠加多份监听。
- 模组只使用 Electron 的公开 API（`BrowserWindow`、`screen`、`ipcMain`），
  **不读取宿主的内部模块，不依赖宿主的打包结构**。
- 页面不加载任何外部资源，`bar.html` 里的 CSP 是
  `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:`；
  歌曲标题、歌手、错误信息全部走 `textContent`，只有常量 SVG 走 `innerHTML`。

## 目录

```
taskbar-controls/
├── mod.json              # 清单：main = main.cjs，client = client.mjs
├── main.cjs              # 主进程：创建窗口、贴边、置顶、IPC 校验与转发
├── preload.js            # 隔离桥：window.tb 的白名单方法
├── client.mjs            # 渲染侧入口：读播放状态、执行点击动作
├── bar.html              # 控制条界面（全透明，图标一律内联 SVG）
├── images/3.png          # 预览图（与 mod.json 的 preview 一致）
└── README.md
```

## 说明

- 本仓库版本不含「其他程序全屏时自动隐藏」。那需要查询前台窗口的矩形，只能靠系统级
  API，Electron 没有对应公开接口；实现它必须借用宿主进程里的 FFI 库并扫描宿主打包路径，
  属于审核不接受的私有依赖，因此不进入发布版。Folia 自身全屏的检测仍然保留。
- 控制条是一个独立窗口，不注册任何全局鼠标 / 键盘钩子，不会拦截 Folia 主窗口或其他
  模组的事件；它的可点击区域只有自己那一块。
- Windows 上这个窗口必须保持 `focusable: true`：设成不可聚焦时系统只会转发鼠标移动，
  按下 / 抬起事件会丢失，表现就是「悬停有反应、点击没反应」。
- Windows 全透明窗口在分层合成下会按像素做命中测试，所以 `bar.html` 的 body 垫了一层
  几乎看不见的底色（`rgba(0, 0, 0, 0.004)`），保证整条都能吃到鼠标。
