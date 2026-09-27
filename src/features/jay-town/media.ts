/**
 * 小镇媒体册：`public/jay-town/media/` 里每一件素材的清单。
 *
 * 这份表是**唯一的事实来源**。`crossing/world/jaymedia.js` 按它建 3D 道具
 * （相框、灯箱、屏幕、导航板），页面上的媒体索引也读同一份数据，所以「素材有
 * 没有放进场景」这件事是可以被验证的：表里有几条，场景里就该有几块。
 *
 * ## 素材是怎么来的
 *
 * 用户提供的原始文件都在 `public/jay-town/originals/`（不进 git）。这一份是
 * 从它们转出来的展示版：
 *
 *  - 六张专辑封面 → 最长边 1024 的 jpg。文件名里的年份和专辑名是**照着画面
 *    认出来的**，不是猜的：`cover-jay-2000` 是 2000 年同名专辑（黑毛衣侧头），
 *    `cover-fantasy-2001` 是《范特西》红帽衫，`cover-november-chopin-2005` 是
 *    《11月的萧邦》酒红西装与三角钢琴，`cover-dragon-rider-2005` 是《龙战骑士》
 *    影碟封面，`cover-run-away-2007` 是《我很忙》牛仔与旋转木马，
 *    `cover-bedtime-stories-2016` 是《周杰伦的床边故事》高帽与兽角椅。
 *  - 四段视频 → h264/aac 代理版（最长边 1024 或 512、+faststart），因为原片是
 *    微信导出的 HEVC，浏览器放不出来，其中一段 4K 原片还有 1.0 GB。
 *
 * ## 只放歌名不搬内容
 *
 * 专辑封面是既有的唱片海报图；站内文字只写歌名、专辑名、年份这类事实，
 * 不写歌词 —— 这条和 `SOURCES.md` 里写的口径一致。
 */

/** 部署基址。astro 的 `site` 是域名根，所以这里正常就是 `/`。 */
const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '')

/** 站内媒体路径。名字里有 `&`、`=` 或中文时也要能用，所以统一编码。 */
export const mediaUrl = (file: string) => `${BASE}/jay-town/media/${encodeURIComponent(file)}`

/**
 * 缩略图路径。
 *
 * 页面上的导航条不该为了 72px 的格子去下 100 KB 的封面，也不该拿 36 MB 的
 * 视频去当缩略图 —— `media/thumbs/` 是 144px 的 jpg，视频取的是第 1 秒那一帧。
 * 场景里用的仍然是原图（`mediaUrl`）。
 */
export const thumbUrl = (file: string) =>
  `${BASE}/jay-town/media/thumbs/${encodeURIComponent(file.replace(/\.mp4$/, '.jpg'))}`

export type MediaKind = 'poster' | 'video'

/**
 * 一件摆在小镇里的素材。
 *
 * `zone` 是它应该出现在哪一站（0-4，见 `scene.ts` 的 STOPS）。`stop` 是
 * 点它之后把镜头带到哪里；等于 `zone` 就是「站内就近看」，不同就是跨站导航。
 */
export type TownMedia = {
  id: string
  kind: MediaKind
  /** 文件名，拼成 `mediaUrl(file)`。 */
  file: string
  /** 画面里能看到的标题（歌名 / 场景名）。 */
  title: string
  /** 副标题：专辑名或拍摄来源。 */
  caption: string
  /**
   * 原始文件的名字，逐字不动。
   *
   * 展示用的文件名（`cover-jay-2000.jpg` 这种）是**我起的**，而起名字这件事
   * 本身就是可能出错的地方 —— 用户说的「别搞错了」正是这个风险。所以原始
   * 文件名一路带到界面和场景立牌上（导航条目里显示成 `← 原始文件`），
   * 一对就知道哪件素材放到了哪里，不用信我的命名。
   */
  source: string
  /** 图上的年份；视频用拍摄日期。 */
  year: string
  /** 画幅比 w/h，用来算画框尺寸，别让它拉变形。 */
  aspect: number
  /** 它摆在哪一站。 */
  zone: number
  /** 点击后跳到的站。 */
  target: number
  /** 摆放位置（平面坐标，贴地高度由场景按地面算）。 */
  x: number
  z: number
  /** 画幅宽度（米），高度按 aspect 推。 */
  w: number
  /** 底边离地高度（米）。 */
  y: number
  /** 朝哪边（绕曲面法线的 yaw，0 = 面向 +z）。 */
  face: number
  /** 贴在什么上面，纯粹是给人看的备注。 */
  on: string
}

/* ------------------------------------------------------------------ *
 * 六张专辑封面。
 * ------------------------------------------------------------------ */
export const COVERS: TownMedia[] = [
  {
    id: 'cover-jay-2000',
    kind: 'poster',
    file: 'cover-jay-2000.jpg',
    source: '114a832cb3fdb5a89ec119d50261d654e0d8d904.jpg',
    title: 'Jay',
    caption: '周杰伦同名专辑 · 2000',
    year: '2000',
    aspect: 1332 / 1264,
    zone: 1,
    target: 1,
    x: 20.35, z: 26.4, w: 1.5, y: 1.5, face: Math.PI / 2,
    on: '唱片小巷东侧橱窗（立着的一张）',
  },
  {
    id: 'cover-fantasy-2001',
    kind: 'poster',
    file: 'cover-fantasy-2001.jpg',
    source: '1343c1c4a1f8471bbe541e68d8f0dd22.webp',
    title: '范特西',
    caption: '周杰伦 · 2001',
    year: '2001',
    aspect: 972 / 1113,
    zone: 1,
    target: 1,
    x: 22.9, z: 31.2, w: 1.34, y: 1.45, face: -Math.PI / 2,
    on: '唱片小巷西侧墙面（红帽衫那张）',
  },
  {
    id: 'cover-november-chopin-2005',
    kind: 'poster',
    file: 'cover-november-chopin-2005.jpg',
    source: '006upAuggy1hypv93kscsj30u01t0jxy.jpg',
    title: '11月的萧邦',
    caption: 'November’s Chopin · 2005',
    year: '2005',
    aspect: 690 / 1495,
    zone: 2,
    target: 2,
    // 竖幅，和广场上那台钢琴放一起
    x: -25.7, z: 28.9, w: 0.92, y: 1.35, face: 0,
    on: '晴天广场 钢琴旁的立牌',
  },
  {
    id: 'cover-run-away-2007',
    kind: 'poster',
    file: 'cover-run-away-2007.jpg',
    source: 'u=4202603564,2580479343&fm=253&fmt=auto&app=138&f=JPEG.webp',
    title: '我很忙',
    caption: '牛仔与旋转木马 · 2007',
    year: '2007',
    aspect: 500 / 661,
    zone: 4,
    target: 4,
    x: 3.4, z: -27.0, w: 1.15, y: 1.6, face: Math.PI,
    on: '七里香河堤 河边的公告墙',
  },
  {
    id: 'cover-dragon-rider-2005',
    kind: 'poster',
    file: 'cover-dragon-rider-2005.jpg',
    source: 'u=1956611779,1594198858&fm=253&fmt=auto&app=120&f=JPEG.webp',
    title: '龙战骑士',
    caption: '20 Music Videos · 2005',
    year: '2005',
    aspect: 444 / 600,
    zone: 3,
    target: 3,
    x: 24.5, z: -6.4, w: 1.05, y: 1.55, face: -Math.PI / 2,
    on: '花海车站 站台立柱后的海报框',
  },
  {
    id: 'cover-bedtime-stories-2016',
    kind: 'poster',
    file: 'cover-bedtime-stories-2016.jpg',
    source: 'u=4019012250,3982056389&fm=253&fmt=auto&app=138&f=JPEG.webp',
    title: '周杰伦的床边故事',
    caption: 'Bedtime Stories · 2016',
    year: '2016',
    aspect: 500 / 1000,
    zone: 2,
    target: 2,
    x: -30.0, z: 33.4, w: 0.95, y: 1.5, face: Math.PI / 2,
    on: '晴天广场 绘马架旁的灯箱',
  },

  /* ---- 猪。用户点名要「放在显眼的地方」。 ----
   * 1080x1080 的方图，画幅给到 1.9 m：这是全场最大的一块平面素材，
   * 就立在樱花街口正对着出生点的那面墙上，抬起头第一眼就是它。 */
  {
    id: 'pig',
    kind: 'poster',
    file: 'pig.jpg',
    source: 'pig.jpg',
    title: '樱花小镇 · 镇宠',
    caption: '路过请勿投喂',
    year: '',
    aspect: 1,
    zone: 0,
    target: 0,
    x: 4.72, z: 11.2, w: 1.9, y: 1.35, face: -Math.PI / 2,
    on: '樱花街口 出生点正前方的画廊主墙（东侧店面墙，面向街心）',
  },
]

/* ------------------------------------------------------------------ *
 * 四段视频。用户自己的影像 —— 店招下的电视、站台的信息屏放的都是这些。
 * 画面内容是按抽帧认过的，标题写的就是画面里的事。
 * ------------------------------------------------------------------ */
export const CLIPS: TownMedia[] = [
  {
    id: 'school-life',
    kind: 'video',
    file: 'school-1024.mp4',
    source: '微信视频2026-09-26_205410_141.mp4',
    title: '校园午后',
    caption: '校门口的课间 · 140s',
    year: '2026-09',
    aspect: 16 / 9,
    zone: 3,
    target: 3,
    // 车站是离学校最近的一站（gakkomae 在校门口），放这里最合适
    x: 21.2, z: -8.8, w: 2.3, y: 1.75, face: -Math.PI / 2,
    on: '花海车站 站台信息屏',
  },
  {
    id: 'classroom',
    kind: 'video',
    file: 'class-0512.mp4',
    source: '微信视频2026-09-26_205415_433.mp4',
    title: '晚自习的教室',
    caption: '讲台上的屏幕 · 17s',
    year: '2026-09',
    aspect: 812 / 720,
    zone: 1,
    target: 1,
    x: 24.55, z: 24.6, w: 1.35, y: 1.55, face: -Math.PI / 2,
    on: '唱片小巷 电器行橱窗（贴着东侧店面墙）',
  },
  {
    id: 'campus-walk',
    kind: 'video',
    file: 'campus-0512.mp4',
    source: '微信视频2026-09-26_205419_797.mp4',
    title: '放学路上',
    caption: '校道上的同学 · 30s',
    year: '2026-09',
    aspect: 812 / 720,
    zone: 2,
    target: 2,
    x: -28.6, z: 36.2, w: 1.45, y: 1.6, face: 0,
    on: '晴天广场 神社侧廊的小电视',
  },
  {
    id: 'evening-drive',
    kind: 'video',
    file: 'drive-1024.mp4',
    source: '微信视频2026-09-18_202624_496.mp4',
    title: '傍晚的街道',
    caption: '车窗外的居民区 · 101s',
    year: '2026-09',
    aspect: 16 / 9,
    zone: 4,
    target: 4,
    x: 6.2, z: -31.4, w: 2.0, y: 1.85, face: Math.PI,
    on: '七里香河堤 河堤下的大屏',
  },
]

/** 全部素材，一条不漏。 */
export const MEDIA: TownMedia[] = [...COVERS, ...CLIPS]

export const mediaById = (id: string) => MEDIA.find((m) => m.id === id)

/**
 * 导航板上的分组标题。
 *
 * 用户要的是「表层用来做个导航，导航到各个图片」，所以导航板按站分组，
 * 每一站列出那一站的素材，点一下就把镜头带到那儿。
 */
export const ZONE_LABELS = ['樱花街口', '唱片小巷', '晴天广场', '花海车站', '七里香河堤'] as const

export const mediaByZone = (zone: number) => MEDIA.filter((m) => m.zone === zone)
