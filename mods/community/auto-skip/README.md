# 本项目全程由AI管理

## Auto skip

Folia 0.7.20 加了个「无法播放时自动跳过」开关，默认关着。打开之后，会员、地区、下架、原因不明这几类会倒计时跳过；但按设计它不碰两种：需要登录的歌，和网络问题。碰上就停下来弹张卡片，一直等人点。

听歌时卡在这种地方很烦，所以写了这个模组补上这两类。

宿主对每次播放失败会给一个公开的原因分类，一共五类：

| `reason` | 原版开关关 | 原版开关开 |
|---|---|---|
| `restricted` | 不跳 | 倒计时跳过 |
| `taken-down` | 倒计时跳过 | 倒计时跳过 |
| `unknown` | 不跳 | 倒计时跳过 |
| `auth` | 不跳 | 不跳 |
| `network` | 不跳 | 不跳 |

后两行是写死的「永不跳过」，卡片就那么停着等人点。这个模组接的就是这两行。

顺带一个好处：原版开关关着的时候，`restricted` 和 `unknown` 也没人管，模组照样能接住并立即跳，不用干等那 5 秒。

### 怎么做到的

Folium 1.5 有 `playback.failed` 事件，这是正路。事件带 `reason`（上面那五类）、`phase` 和 `willAutoSkip`：

- `willAutoSkip: true` 表示宿主正在倒计时，那就别动 —— 自己再去跳会跟原版抢，可能一跳两首。
- `false` 才是原版管不了的那些，模组按设置决定接不接。
- `phase` 为 `restore` 是启动时恢复上次会话，宿主有意不跳，模组也不碰。

模组只调 `playback.next()`，不读宿主 DOM、不注入样式、不改宿主界面。维护者审查时明确说过，提示卡和按钮上的回调都不是公开接口，所以这条线不能碰。

### 一个说不准的地方

`unknown` 里其实混着两种：一种是宿主自己也认不出的失败，另一种是「登录后可能可以播放」那种。宿主把后者按登录类处理，不会跳；但公开接口只给到 `unknown` 这一层，分不出来。

所以默认设置下这类歌也会被跳过。碰上了又不想让它跳，把 `skipUnplayable` 关掉即可。

### 功能

| key | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `skipUnplayable` | `true` | `restricted` / `taken-down` / `unknown` 那批 |
| `skipAuthNetwork` | `false` | `auth` 和 `network` 也跳 |
| `delayMs` | `250` | 收到失败到调下一首之间等多久，0–5000 |
| `maxSkipsPerMinute` | `8` | 一分钟最多跳几次 |
| `maxConsecutiveSkips` | `3` | 连续跳过上限，0 不限（原版是 2） |

后两个是保险丝：一个管连续几首就停手，一个管出手频率，防的是整张歌单全挂的时候疯狂连跳。

设置只有一处：选项 → 模组 → 展开 Auto skip（官方 `settingsSections` 接口）。

### 安装

1. 把 `mod.json`、`client.mjs`（和 `preview.png`）放进 `%APPDATA%\Folia\mods\auto-skip\`
2. 选项 → 模组 → 重载（或者直接重启 Folia）
3. 第一次会让你确认一次，信任是绑在内容摘要上的

**改任何文件都会让确认失效，要重新点一次。** 这是宿主故意的，防止批准过的代码被换掉。

`mod.json` 里写了 `"folia": ">=0.7.20 <0.8.0"`。底部是 0.7.20 因为 `playback.failed` 是这一版才有的。装上之后先看 `folium.host.folium.minor`，不到 5 就自己停用，不会硬跑。

仓库里 `mod/` 才是要提交的目录（issue 表单的「模组目录」填 `mod`），`tests/`、`tools/` 留在仓库根但不参与签名。

MIT。

---

*English note: a Folium client mod for Folia 0.7.20. Stock Folia's "skip unplayable songs" setting moves `restricted`, `taken-down` and `unknown` failures to a countdown, but `auth` and `network` failures stay hard-coded to never skip — the card just sits there. This mod takes those over. It listens to `playback.failed` and respects `willAutoSkip` so it never races the host's own countdown, and it only ever calls `playback.next()` — no host DOM, no injected styles. Settings live in the mods panel via `settingsSections`. One caveat: `unknown` failures that hint "signing in may help" are treated as `auth` by the host, but the public API does not distinguish them from other `unknown` failures, so they are skipped too unless `skipUnplayable` is turned off.*
