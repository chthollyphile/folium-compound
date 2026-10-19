# 清单权限与可选字段说明

> 对象：本目录的 [`mod.json`](./mod.json)。逐条说明 `permissions` / `embedOrigins` /
> `experimental` 里声明了什么、为什么需要；**没声明的字段一律写「无」**。
>
> 权限名以 Folium 1.6 契约为准：
> [docs/folium/api.md](https://github.com/chthollyphile/folia-major/blob/main/docs/folium/api.md)。
> `ui.stage` / `runtime.playback` 是 1.5 及更早的旧名字（1.x 仍可用，Folium 2 移除）。
> 权限名清单另见 [`../README.md`](../README.md) 的 Folium 1 字段参考。

---

## 一览

| 字段 | 本清单声明 | 结论 |
|---|---|---|
| `permissions` | `["stageLayers"]` | **需要**，且只需要这一项 |
| `folia` | `">=0.7.21"` | **需要**：用到只有 Folium 1.6（Folia 0.7.21）才有的接口 |
| `embedOrigins` | 未声明 | **无** |
| `experimental` | 未声明 | **无** |

---

## `permissions`

### `stageLayers` —— 需要

**为什么**：本模组的全部 UI 都挂在播放页图层上。`client.mjs` 里注册：

```js
const layerHandle = folium.registries.stageLayers.register({
  id: 'spectrum-widget',
  slot: 'player.stage.front',
  mount: (container, ctx) => mountStageWidget(section, container, ctx, folium.log),
});
```

**宿主怎么校验**（Folium 1.6 契约）：注册表一览里 `stageLayers` 的「需要的权限」一列写着
`stageLayers`；注册时没声明就抛 `permission-denied:stageLayers`。检查是惰性的（挂载图层时才走到）。

**不声明的后果**：模组激活即失败，界面弹「界面代码出错 / `client activate: permission-denied:stageLayers`」（0.2.0 实测到的就是这类错误）。

**范围**：本模组只有这一处需要权限。同一个 `activate()` 里还调用了
`folium.registries.settingsSections.register(...)`（设置面板分区），契约里该注册表「需要的权限」
一列为空，所以不需要额外权限。

### 未声明的权限（本模组不需要，全部写「无」）

宿主对权限是**按需惰性校验**的（各成员对应哪项权限见
[`api.md` 权限一览](https://github.com/chthollyphile/folia-major/blob/main/docs/folium/api.md#权限一览)），
声明用不到的权限只会白扩权限面。以下逐条说明为什么不需要：

| 权限 | 本模组 | 为什么不需要 |
|---|---|---|
| `filesystem.data` | 无 | 不读写用户文件、不落盘；设置项由宿主 `settingsSections` 托管，自己一个字节都不存 |
| `playback.read` | 无 | 只**读** `ctx.audio.getPower()` / `getSpectrum()`，不读播放快照 |
| `render.export` | 无 | 不调用 `api.render.exportVideo`，不导出视频；静态预览下照常渲染，不需要额外能力 |
| `playback.control` | 无 | 不调用 `folium.playback.*`，也没注册进度条按钮；歌单、播放/暂停全靠宿主自己 |
| `net.fetch` | 无 | 不调用 `folium.net.fetch`；`client.mjs` 无任何 `fetch` / `XMLHttpRequest`，资源（`client.mjs`、`preview.jpg`）随模组目录经 `folia-mod://` 本地加载 |
| `net.embed` | 无 | 不调用 `folium.ui.embed`，不嵌 iframe / 远程页面 |

---

## `folia`

### `">=0.7.21"` —— 需要

本模组的清单与入口都按 **Folium 1.6** 写，最低对应 **Folia 0.7.21**：

- 权限名 `stageLayers`（更老的校验器只认 `ui.stage`）；
- `ctx.onFrame` / `ctx.every`（1.6 起每个 mount 上下文都有）；
- `settingsSections` 句柄的 `.settings`（更早的宿主只有旧名 `.params`）。

不声明范围时，0.7.20 会在加载阶段就报看不懂的清单/权限错误；写上 `folia` 后，
宿主会直接提示需要更新版本，而不是让模组半加载失败。

---

## `embedOrigins`

**无。**

本清单没有这个字段。它只在需要 `net.embed`（嵌远程页面 / iframe）时用来**列出允许的源**；
本模组不嵌任何远程内容，没有源可列，所以既不需要写、也不该写。

---

## `experimental`

**无。**

本清单没有这个字段。它用来 opt-in 宿主的实验能力（当前可见的一个是 `ponder.targets`，
官方示例 `visualizer52hz` 用它做引导教程）；本模组不注册任何实验能力。
按 `../README.md` 的约定「空的 `[]` 可省略」，这里直接省略字段，而不是写 `[]`。

---

## 复核方式（改了代码之后）

1. 打开 `client.mjs`，看有没有新增 `folium.registries.*.register(...)` 或 `folium.*` 调用：
   - `stageLayers` → 需要 `stageLayers`（本模组已声明）；
   - `visualizers` / `progressLayers` / `progressButtons` / `backgrounds` / `tunings` / `commands`
     / `playerPanelTabs` / `styles` → 见 [`../README.md`](../README.md) 的权限清单，逐个确认；
   - 用到 `folium.data`、`fetch`、`export` 之类 → 对应 `filesystem.data` / `net.fetch` / `render.export`。
2. 运行时看宿主日志（`%APPDATA%\Folia\logs`）：
   - `permission-denied:<x>` → 清单少声明 `<x>`；
   - `<api>-unavailable-in-<ctx>` → 权限没问题，是上下文不对（例如 `net.embed` 要在 `main`）。
3. 清单或入口改动都会让签名 digest 失效 → 按 [`SIGNING.md`](./SIGNING.md) 升版本重签。
