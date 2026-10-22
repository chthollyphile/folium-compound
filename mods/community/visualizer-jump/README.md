# 跳一跳（visualizer-jump）

等距场景里，一个小人在一根根带字的长方块上跳的歌词动画模组。纯渲染端（只有 `client.mjs`），
清单与接口规范见 [`mods/README.md`](../README.md)。

「跳一跳」的视觉由主题与旋钮推出，不在代码里写死取色；出图要拿真浏览器看一眼，探针见
`dev/probes/jumpVisualizer.probe.tsx`。

## 实拍

```bash
npm run dev:probe
# 浏览器打开 /dev-probe.html?probe=jumpVisualizer
# 场景与主题也可以从 URL 选：?probe=jumpVisualizer&scene=en&theme=light
```

滑块推时钟，`sceneOffset` 参与排版，其余旋钮与面板同义；改完直接截图，`preview.png` 就是从这里出的：
16:9、1920×1080 高分辨率，日光主题下的中文场景，中心裁剪掉约 25% 边缘让等距画面更饱满。
（`?scene=zh&theme=light` 出图）
