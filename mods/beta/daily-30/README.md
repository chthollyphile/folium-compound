# 每日推荐（daily-30）

每天自动记录网易云音乐「每日推荐」，按日期回看、搜索，并把某一天的歌单放进播放队列。记录的是歌单信息（歌名、歌手、专辑、时长、封面），不下载音频。

> 1.0.1 起只记录网易云音乐：1.0.0 读取宿主自己的 QQ 登录会话去调本机 QQ 后端，被 folium-compound 审查指出不符合模组规范（issue #89），这一路已整体移除。QQ 音乐「每日30首」需要宿主通过 `platform.raw` 或 Omni 开放，届时再加回来。

## 使用

1. 在「设置 → 模组」打开模组系统，启用 `每日30首`。
2. 在 Folia 里登录网易云音乐；登录后模组会自己开始记录。
3. 在首页导航末尾打开「每日推荐」标签，或者用命令面板的「打开每日推荐」。
4. 每天的歌单会自动检查；想立刻检查时点「立即记录」或运行「立即记录每日推荐」命令。

## 它怎么取数据

- 全部通过 Folium 1.7 的实验接口 `platform.raw` 读取，需要 `platform.netease.read`：每日推荐是 `recommend_songs`，历史日推是 `history_recommend_songs` 与 `history_recommend_songs_detail`。会话由宿主补上，模组看不到 cookie，也不直接连任何平台后端。
- 每日推荐在北京时间 6 点换，6 点前记的是前一天。
- 还会尝试从服务器的「历史日推」补回最近几次（需要黑胶 VIP，最多 5 天）；Folia 没开的日子如果服务器还留着，会被补进来。

## 数据

记录写在 Folia 的用户数据目录下：

```
<userData>/mods-data/daily-30/files/archive/
  index.json
  netease/YYYY-MM-DD.json
```

首页的「导出 JSON」只在点按钮时把所有记录写一份到系统的下载目录。

## 权限

- `filesystem.data`：写上面的记录文件（`api.storage.paths.data`），读取回来后展示。
- `playback.control`、`playback.queue`：把一天的歌通过 Omni 解析后放进队列并播放。
- `platform.netease.read` + 实验接口 `platform.raw`：读每日推荐和历史日推。
- 不使用 `net.fetch`：模组不访问任何外部地址。

## 限制

- 模组只在 Folia 运行时检查；Folia 没开的日子要靠服务器还保留的历史日推才能补回来。
- 历史日推需要黑胶 VIP；没有会员时只在当天的每日推荐可用时记录。
- 1.0.0 记录的 QQ 历史不会出现在 1.0.1 的列表里；旧文件仍留在 `archive/qq`，需要的话自行保留。
