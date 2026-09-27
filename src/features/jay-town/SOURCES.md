# Jay Sakura Town media sources

Checked on 2026-09-26; world swap noted 2026-09-27.

- 3D world: vendored from [Kenton-GMI/sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing) `main` @ `de01898` (MIT). See `crossing/NOTICE` and `crossing/LICENSE`. Upstream stock audio under `public/audio/` is **not** copied; this page keeps embed-only playback.
- Visual reference: [Bilibili BV1Ziac6JEUc](https://www.bilibili.com/video/BV1Ziac6JEUc/), titled "吓哭了！Opus 5.5一轮生成绝美动漫樱花小镇！" by 水母菌Jellyfish. Its public video metadata reports state `0`. It is a style reference, not a visual asset copied into the site.
- Mainland playback source: [Bilibili BV1fx411N7bU](https://www.bilibili.com/video/BV1fx411N7bU/), "【经典】周杰伦全MV 【200P】" by Ta酱-Tatsu. The Bilibili `x/web-interface/view` metadata reports state `0` and 200 parts. Every `page` and `cid` in `songs.ts` was matched against its `pages` array. The [Bilibili external player](https://player.bilibili.com/player.html?isOutside=true&bvid=BV1fx411N7bU&cid=2162145&page=52) returned HTTP 200 for the sample 七里香 part. The platform playback API returned `code=0` for the 七里香 and Mojito CIDs; no media was downloaded. This uploader is not identified as a rights holder; public availability does not establish reuse permission.
- Official playback: the 20 matching public MV or lyric-video IDs in `songs.ts` were returned by YouTube search with channel ID [`UC8CU5nVhCQIdAGrFFp4loOQ`](https://www.youtube.com/channel/UC8CU5nVhCQIdAGrFFp4loOQ), "周杰倫 Jay Chou". The player opens these exact YouTube IDs first; its source line shows the song title and ID. The toggle exposes the matched Bilibili collection part, including its `page` and `cid`, so the two sources cannot be confused. Mainland availability and actual playback inside a browser were not verified. 等你下课 uses an official lyrics MV rather than a filmed MV.
- Bilibili also has recent single-video uploads from the "杰威尔音乐" account (mid `1745584728`), including [西西里 BV17mYV6WEe5](https://www.bilibili.com/video/BV17mYV6WEe5/) and [I DO BV1d49WB8EXP](https://www.bilibili.com/video/BV1d49WB8EXP/). These are not used for the 20-song set.

The site embeds platform players and links to source pages. It does not download, bundle, or serve the recordings. Videos may later be removed, restricted, or blocked from embedding by their platforms or rights holders.

Town geometry and Canvas2D signs come from the MIT Sakura Crossing sources (with site theme label tweaks). No frame or visual asset from the reference Bilibili style video is shipped.
