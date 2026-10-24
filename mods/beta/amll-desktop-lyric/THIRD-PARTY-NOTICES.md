# 第三方组件 / Third-party components

本模组的歌词窗口打包了 **applemusic-like-lyrics** 的核心库，随模组一起分发。

## applemusic-like-lyrics

- 来源：https://github.com/amll-dev/applemusic-like-lyrics
- 包：`@applemusic-like-lyrics/core` 0.6.0
- 许可证：**AGPL-3.0-only**（全文见本目录的 `LICENSE`；本模组因此同样以 AGPL-3.0-only 发布）
- 用到的是它编译好的 `dist/amll-core.mjs` 与 `dist/style.css`，经 esbuild 打包进 `window/bundle.js` 与 `window/bundle.css`，未作修改。

AMLL 自身依赖以下库，同样经它打进上述 bundle：

| 包 | 许可证 |
| --- | --- |
| `bezier-easing` | MIT |
| `gl-matrix` | MIT |
| `deep-freeze` | MIT（Public Domain 声明） |
| `@ungap/structured-clone` | ISC |

## 本模组

- 许可证：AGPL-3.0-only，全文见 `LICENSE`。
- 不含 Folia 本体的代码；只通过公开的 Folium 模组接口（`mod.json`、`folium.*`、`api.*`）与宿主交互。
