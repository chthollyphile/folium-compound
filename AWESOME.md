# Awesome-Folia

<!-- 由 awesome.json 生成（tools/lib/awesome.mjs），不要手改 / Generated from awesome.json -->

不收进本仓库、以外部链接登记的 Folia 相关作品：音源模组、系统插件、外部程序、开发工具等。它们没有经过 Folium 签名，
安装和使用前请自行判断；有问题请到各自的仓库反馈。登记新作品：开一个「Awesome-Folia 登记」issue。

Folia-related works kept elsewhere and listed here as links. They are not signed by Folium; report problems to their own repositories.

## 音源模组 / Source mod

- [bilibili for Folia](https://github.com/qingxian997/folia-bilibili-source) — [@qingxian997](https://github.com/qingxian997) · 音源  
  Folium 2 原生 bilibili 音源：扫码登录，把自建/收藏的收藏夹与 UP 主合集接入书库；搜索全站视频，播放用视频自身音频，歌词用 CC 字幕或跨平台匹配，探索页读首页推荐。需要 Folia 0.8.x；模组未签名，从仓库 Releases 安装。
- [Online Music Source](https://github.com/wumeng114514/folia-lx-music-mod) — [@wumeng114514](https://github.com/wumeng114514)  
  在线音源适配器，支持多平台搜索和播放。原为先行测试模组（1.0.2，Folium 1 的 omni.providers），2026-11 按音源政策移出仓库。
- [GD 音乐台音源](https://github.com/xiang1234-bit/folia-gdstudio-source) — [@xiang1234-bit](https://github.com/xiang1234-bit) · 音源  
  基于 Folium 2 规范封装的 GD 音乐台（music.gdstudio.xyz）第三方音源模组。支持网易云（netease）、JOOX、Bilibili 等上游平台切换与搜歌，支持最高 Hi-Res（999）无损播放与自动回退、按需缓存封面代理、原文与翻译歌词获取以及网易云歌曲精确跨源对应；内置热门榜单并支持在首页「歌单」与「探索」页导入/同步歌单（支持网易云用户 UID、单张歌单 ID/链接，以及 GD 音乐台网页端导出的本地 JSON 备份）。 前提与说明： 1. 需在 Folia「设置 → 模组」中开启「社区模组」后，从仓库 Releases 下载 zip 安装并启用。 2. 接口与数据来源为 GD 音乐台公开 API（music-api.gdstudio.xyz），存在频率限制（约 5 分钟 50 次请求），仅供个人学习与研究使用，请勿用于商业用途。
- [LX 音源适配 / LX Source Adapter](https://github.com/paysonx/folium-lx-source) — [@paysonx](https://github.com/paysonx)  
  用户确认导入 LX 脚本后解析播放地址；搜索和歌词用你在 Folia 登录的平台账号读取。不内置音源脚本或链接。原为先行测试模组（0.1.1），2026-11 按音源政策移出仓库。
- [汽水音乐（本机客户端）](https://github.com/syh0119/folia-soda-music) — [@syh0119](https://github.com/syh0119)  
  把本机汽水音乐 PC 客户端接入 Folia：搜索、播放（含无损 FLAC）、逐字歌词、无限续播，适合要听 VIP 歌曲、选更高音质的用户。需要先安装并登录汽水音乐客户端。原为先行测试模组（2.3.7），2026-11 按音源政策移出仓库。

## 系统插件 / System plugin

- [folia-lyrics（GNOME Shell 歌词）](https://github.com/Yohane-Mashiro/folia-lyrics) — [@Yohane-Mashiro](https://github.com/Yohane-Mashiro) · 歌词显示  
  GNOME Shell 顶栏歌词扩展：读 Folia 的歌词接口显示逐字歌词，配合 MPRIS 取播放进度与控制；悬浮详情里有封面、原文、翻译和播放控制。支持 GNOME Shell 45–51。
- [lia.lines（Quickshell / Omarchy 歌词）](https://github.com/chthollyphile/lia.lines) — [@chthollyphile](https://github.com/chthollyphile) · 歌词显示  
  Omarchy 状态栏的 Quickshell 歌词插件：读 Folia 的歌词接口显示逐字歌词，配合 MPRIS 取播放进度，没有歌词时显示媒体标题；悬浮详情里有封面、原文、翻译和播放控制。也能在不装 Omarchy 的 Quickshell 上用。

## 其他 / Other

- [洛雪音源适配](https://github.com/hnxyhcz/folium-lx-music-source) — [@hnxyhcz](https://github.com/hnxyhcz) · 音源  
  Folia（Folium 2）模组：当内置音源（网易云 / QQ 音乐 / 酷狗）拿不到播放地址时， 用你自行导入的洛雪（LX Music）自定义源脚本解析一个可播放直链，再交回 Folia 播放。 模组不附带、不内置任何脚本；脚本由用户自备并在模组面板导入（本地文件或 URL）， 运行在 main 进程（node:vm）。仅桌面版；安装前需在「设置 → 模组」打开「社区模组」。 安装包见仓库 Releases（v1.0.0 的 lx-music-source-1.0.0.zip），拖进模组面板即可； 使用说明与问题反馈见仓库 README / Issues。
