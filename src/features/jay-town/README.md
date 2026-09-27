# 樱花小镇

独立 Astro 页面：`/jay-town/`。在 `site/` 中运行 `npm run dev` 后访问该路径。

- 3D 世界基于 [Kenton-GMI/sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing)（MIT，commit `de01898`），源码在 `crossing/`。未附带上游音频。
- WASD / 方向键行走，Shift 加速；点击画布可 pointer-lock 转头（Esc 释放），也可拖动转头；手机用方向垫。
- 数字 1–5 或底部站名：樱花街口、唱片小巷、晴天广场、花海车站、七里香河堤。
- 点击唱片按钮打开歌单；嵌入 YouTube / Bilibili 播放，见 `SOURCES.md`。

`scene.ts` 把 Crossing 挂到现有 canvas，并保留昼夜、站台瞬移与移动垫。歌单数据在 `songs.ts`。
