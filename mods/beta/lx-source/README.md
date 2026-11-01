# LX Source Adapter（0.1.1）

Folia 桌面版的实验性 LX 音源适配模组，需要 Folium 1.7（Folia >= 0.7.22）。
它注册自己的 `LX · 网易云 / QQ / 酷狗` 音源，搜索和歌词通过公开的 `folium.omni` 读取原平台，播放地址交给导入的 LX 脚本。
原平台的登录与后端配置仍然适用于搜索，不会把原平台的账户凭据交给脚本。

## 安装和使用

1. 源码开发版自动发现本目录。安装版把整个 `lxSource` 目录放到「设置 → 模组 → 打开模组目录」中，也可以将目录打成 ZIP 后拖入模组面板。
2. 打开模组系统，启用「LX 音源适配 / LX Source Adapter」。这是未签名模组，启用时由 Folia 显示确认。
3. 勾选明确的脚本信任与执行确认后才能导入；旧版本保存的脚本首次升级后须通过“启用”命令重新确认。在命令面板搜索 `LX`，执行「从链接导入」或「导入本地脚本」，提供可信来源的 UTF-8 JavaScript 脚本。
4. 导入成功后，在首页音源切换器中选择 `LX · …`，再搜索和播放歌曲。原来内置音源的队列不会自动改用脚本。
5. 同一组命令提供状态、停用、重新启用和移除。一次启用一个脚本；导入新脚本替换旧脚本。禁用整个模组也会停止脚本。

导入后保存的是脚本内容，重启不重新下载链接，也不自动执行远程更新。初始化失败时原脚本继续工作。
数据在 Folium 自己的模组数据文件中，移除脚本会删除保存的副本。

## 兼容范围

- `globalThis.lx`：`EVENT_NAMES`、`on`、`send(inited)`、`request`、`env`、`version`、`currentScriptInfo`。
- `musicUrl`：网易云 `wy`、QQ `tx`、酷狗 `kg`；保留平台的歌曲 ID / mid / hash，不靠歌名猜测。
- 音质：`128k`、`192k`、`320k`、`flac`、`flac24bit`、`hires`，按脚本声明选择；不提供母带、空间音频等扩展音质。
- HTTP：文本 / JSON 响应，字符串 / JSON / URL 编码表单请求，超时与回调取消（取消后不再交付响应；已发出的宿主网络请求最多继续 30 秒）。
- 歌词取自原平台，保留逐字时间、翻译与罗马音；经 enhanced LRC 转换，不保留背景人声、歌手和副歌等 TTML 扩展信息。
- 尚未支持 `lx.utils` 加密工具、二进制响应、multipart `formData`、自动更新、LX 歌单导入和脚本自定义搜索。
- 酷我、咪咕、汽水扩展源未接入；青听 `music.json` 只是配置，不是 LX 脚本，会被拒绝。

## 运行边界

下载的脚本在不带 `allow-same-origin` 的 sandbox iframe 内的独立 Worker 中运行；没有 Node、Electron、父页面 DOM 或 Folium 对象。
iframe / Worker 的 CSP 禁止直接联网，只能通过受限桥接调用已有 `folium.net.fetch`。桥接允许 HTTP(S)，不携带宿主账户凭据。
每次调用最多 35 秒，超时终止整个脚本；最多 16 个脚本调用、8 个同时网络请求、每分钟 120 次请求。脚本最多 256 KiB，响应沿用 Folium 的 5 MiB 上限。
这不是完整 LX 客户端实现，也不承诺第三方服务在线或某首歌曲可播。不要将未知脚本当作可信内容。

协议依据：https://lxmusic.toside.cn/desktop/custom-source

## 验证

- `npm run test:unit -- test/unit/mods/lxSource.test.ts`
- `npm run folium:check -- mods/lxSource`
- `node test/manual/lxSourceSmoke.mjs`：需要 Playwright 与 Chromium / Edge；验证真实浏览器中的隔离、超时、请求回调、导入替换和启停。可通过 `NODE_PATH` 指向已有 Playwright 包，`LX_BROWSER_CHANNEL=msedge` 使用本机 Edge。

本次验证：8 项 Vitest 单元测试（独立测试配置）、32 项 Edge 无界面浏览器检查、6 项协议断言，以及 Folium 清单检查通过。
星海 v3.2.15、全豆要 9.3 和 Huibq v1.2.0 在模拟网络下完成初始化并声明 `wy / tx / kg`。
脚本没有随模组分发。真实上游脚本的后端服务可用性与完整 Electron 应用内播放尚未验收；环境未安装项目依赖，因此未运行全项目类型检查或完整桌面应用。

## 发布与许可

作者：PaysonX。许可证：AGPL-3.0，完整文本见 LICENSE。无打包的第三方库或音源脚本。介绍图是功能示意，不是真实界面截图。

用户反馈：用户已报告 0.1.0 在 Folia 桌面版中安装、导入和播放正常；具体平台、音质和操作系统未逐项记录。0.1.1 的新增确认流程需另作桌面验收。

