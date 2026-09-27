import type { ScreenSpec } from './screens'

/**
 * The DOM side of an in-world screen.
 *
 * Each screen owns one wrapper element that carries the projected transform,
 * and at most one of them owns an `<iframe>` at a time.  That is deliberate:
 * the alternatives are a page with twenty players live at once, or a video
 * that keeps talking to you from three streets away.
 *
 * ## Why the media is not a texture
 *
 * The obvious way to put a video on a 3D surface is `VideoTexture`, and it is
 * not available here.  Both sources are cross-origin embeds served by their
 * own players -- there is no media file this site may fetch, and none it
 * wants to: the whole point is that playback stays on the platform that owns
 * it.  So the picture is composited over the canvas by the browser and the
 * only job left is making it *sit* in the right place, which is
 * `projection.ts`.
 *
 * ## Audio
 *
 * A muted iframe may autoplay, so a screen starts silent and is unmuted
 * through the player's own postMessage API.  YouTube honours it.  Bilibili's
 * `player.html` does not expose one, and its player is cross-origin, so
 * nothing here can reach the `<video>` inside it -- on Bilibili the screen
 * stays silent until the viewer presses play in the player.  That is a real
 * limitation of the source, not a bug: it is written down in `SOURCES.md`
 * rather than papered over.
 */

export type PortalState = 'unloaded' | 'armed' | 'visible'

/** Metres at which a screen wakes up on its own. */
export const ARM_RANGE = 14
/** Metres at which a quiet screen is torn down again. */
export const RELEASE_RANGE = 22

export type PortalOptions = {
  spec: ScreenSpec
  /** Host element the portal is appended to. */
  host: HTMLElement
  /** Fires whenever the portal's state or song changes. */
  onState?: (state: PortalState) => void
}

export type PortalSource = {
  id: string
  title: string
  embedUrl: string
  youtubeEmbedUrl: string
  sourceUrl: string
  sourceLabel: string
  /**
   * A media file served from this site, played in a plain `<video>` instead of
   * an embed.
   *
   * **This is not how the current songs work, and it is not a way to get other
   * people's videos.**  Every entry in `songs.ts` embeds a player owned by the
   * platform that hosts it; the site links to the recordings and never serves
   * them.  A `localVideo` is for footage the site actually holds the rights to
   * -- its own recordings, or material released for reuse -- and when one is
   * set it is strictly better than an embed: no third-party script, no player
   * chrome over the scene, no network round trip, and it starts on the frame.
   *
   * Nothing ships with one set.
   */
  localVideo?: string
  /** Caption for a locally played file, instead of the embed's own credits. */
  localNote?: string
}

export type PortalMedia = HTMLIFrameElement | HTMLVideoElement

export class MediaPortal {
  readonly spec: ScreenSpec
  private host: HTMLElement
  private wrapper: HTMLDivElement
  private veil: HTMLDivElement
  private stage: HTMLDivElement
  private badge: HTMLSpanElement
  private frame: PortalMedia | null = null
  private onState: ((state: PortalState) => void) | undefined

  private state: PortalState = 'unloaded'
  private songId = ''
  private visible = false
  private clipKey = ''
  private clipActive = false
  private pictureVisible = true
  private clipPathEl: SVGPathElement
  private clipId = ''

  constructor({ spec, host, onState }: PortalOptions) {
    this.spec = spec
    this.host = host
    this.onState = onState

    this.wrapper = document.createElement('div')
    this.wrapper.className = 'media-portal'
    /* `data-screen-zone`, not `data-zone`: the route buttons in the page chrome
     * already use `[data-zone]`, and a collision there makes every
     * `querySelector('[data-zone="3"]')` in the harness ambiguous. */
    this.wrapper.dataset.screenZone = String(spec.zone)
    this.wrapper.setAttribute('aria-hidden', 'true')
    this.wrapper.style.visibility = 'hidden'

    this.veil = document.createElement('div')
    this.veil.className = 'media-portal__veil'
    this.veil.setAttribute('aria-hidden', 'true')

    this.stage = document.createElement('div')
    this.stage.className = 'media-portal__stage'

    this.badge = document.createElement('span')
    this.badge.className = 'media-portal__badge'

    /* The occlusion clip.  An SVG `<clipPath>` rather than a CSS shape function
     * because a silhouette can be several disjoint rectangles and only a
     * clipPath can say so -- see `setClip`.  It is attached to the wrapper so it
     * travels with the portal, and hidden, because an SVG with no viewport is
     * still a box in the layout otherwise. */
    this.clipId = `portal-clip-${spec.zone}`
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
    clip.setAttribute('id', this.clipId)
    /* 0..1 fractions of the portal's own box, so the same numbers are right at
     * any size the screen happens to be drawn. */
    clip.setAttribute('clipPathUnits', 'objectBoundingBox')
    this.clipPathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    clip.appendChild(this.clipPathEl)
    defs.appendChild(clip)
    svg.appendChild(defs)

    this.wrapper.append(this.veil, this.stage, this.badge, svg)
    this.host.appendChild(this.wrapper)
  }

  get currentState(): PortalState {
    return this.state
  }

  get isVisible(): boolean {
    return this.visible
  }

  /** Whether this screen currently holds the page's one iframe. */
  get hasMedia(): boolean {
    return this.frame !== null
  }

  /**
   * The portal's own CSS box, in CSS pixels.
   *
   * The projection has to map *this* box, not the unit square, so the numbers
   * CSS will apply the matrix to have to come back from layout rather than be
   * assumed.  Read once, because the stylesheet gives it a fixed `width: 100%`
   * and a fixed aspect ratio: it cannot change without a resize, and a resize
   * rebuilds the projection anyway.
   */
  get boxWidth(): number {
    if (this.box.w === 0) this.measure()
    return this.box.w
  }

  get boxHeight(): number {
    if (this.box.w === 0) this.measure()
    return this.box.h
  }

  private measure(): void {
    this.box.w = this.wrapper.offsetWidth || 0
    this.box.h = this.wrapper.offsetHeight || 0
  }

  private box = { w: 0, h: 0 }

  /**
   * Point the screen at a song.  Reloads the iframe only when the song
   * actually changes, so re-arming the same screen does not restart playback.
   */
  setSource(source: PortalSource, platform: 'bilibili' | 'youtube'): void {
    if (this.songId === source.id) return
    this.songId = source.id
    if (this.state === 'unloaded') return
    this.mount(source, platform)
  }

  setPlatform(source: PortalSource, platform: 'bilibili' | 'youtube'): void {
    if (this.state === 'unloaded') return
    this.mount(source, platform)
  }

  private mount(source: PortalSource, platform: 'bilibili' | 'youtube'): void {
    /* A file this site serves beats an embed on every axis: no third-party
     * script, no player chrome sitting over the scene, no network round trip,
     * and it can start on the frame.  Used when -- and only when -- the song
     * carries one. */
    if (source.localVideo) {
      this.mountLocal(source)
      return
    }

    const url = platform === 'youtube' ? source.youtubeEmbedUrl : source.embedUrl
    if (this.frame?.dataset.src === url && this.frame instanceof HTMLIFrameElement) return

    const next = document.createElement('iframe')
    next.className = 'media-portal__frame'
    next.dataset.src = url
    next.title = `《${source.title}》MV · ${source.sourceLabel}`
    next.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture'
    next.allowFullscreen = true
    next.referrerPolicy = 'strict-origin-when-cross-origin'
    next.src = url

    this.frame?.remove()
    this.frame = next
    this.stage.replaceChildren(next)
  }

  /**
   * Play a file we hold, with `<video>`.
   *
   * Muted on the way in and unmuted once it is playing, for the same reason an
   * embed is: a browser will not start audible playback without a gesture, and
   * standing in front of a screen is not one.
   */
  private mountLocal(source: PortalSource): void {
    if (this.frame?.dataset.src === source.localVideo && this.frame instanceof HTMLVideoElement) {
      this.frame.play().catch(() => { /* the viewer can press play */ })
      return
    }

    const video = document.createElement('video')
    video.className = 'media-portal__frame'
    video.dataset.src = source.localVideo
    video.src = source.localVideo
    video.title = `《${source.title}》 · ${source.localNote ?? '本地影像'}`
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'auto'
    video.disablePictureInPicture = true
    video.addEventListener('canplay', () => {
      video.play().then(() => { video.muted = false }).catch(() => { /* needs a gesture */ })
    }, { once: true })

    this.frame?.remove()
    this.frame = video
    this.stage.replaceChildren(video)
  }

  /** Wake the screen up: this is the only path that creates media. */
  arm(source: PortalSource, platform: 'bilibili' | 'youtube'): void {
    this.setState('armed')
    this.songId = ''
    this.mount(source, platform)
  }

  /** Tear the media down, which is also how playback stops. */
  release(): void {
    if (this.frame) {
      if (this.frame instanceof HTMLVideoElement) {
        /* Stopping a file is different from blanking an embed: clearing `src`
         * and calling `load()` is what actually releases the decoder and stops
         * the request, and it is the only way a looping video stops looping. */
        this.frame.pause()
        this.frame.removeAttribute('src')
        this.frame.load()
      } else {
        // Blanking first stops the player from finishing its request after the
        // element is gone, which otherwise shows up as an aborted request.
        this.frame.src = 'about:blank'
      }
      this.frame.remove()
      this.frame = null
    }
    this.songId = ''
    this.setState('unloaded')
  }

  private setState(state: PortalState): void {
    if (this.state === state) return
    this.state = state
    this.onState?.(state)
  }

  /**
   * Apply the occlusion silhouette.
   *
   * `runs` are `[row, firstCell, lastCell]` triples in grid coordinates and
   * `cols`/`rows` are the grid's size; one rectangle per run goes into the
   * portal's SVG `<clipPath>`.  Two earlier attempts at this are worth not
   * repeating:
   *
   *  - **`mask-image` with an encoded PNG.**  It works, but the browser decodes
   *    it asynchronously, so for a frame or two the element has no mask and
   *    paints unclipped -- video hanging in front of walls.
   *  - **`clip-path: path(...)` with percentage coordinates.**  Silently a
   *    no-op: Chrome computes it to `none`, so nothing was clipped at all and a
   *    distant screen drew at full size over thirty metres of street.  That is
   *    the black rectangle that was reported.
   *
   * An SVG `clipPath` is the construct that both applies synchronously *and*
   * can describe several disjoint rectangles -- which a single `polygon()`
   * cannot, and a silhouette with a hole in it is the normal case rather than
   * an exotic one.
   */
  setClip(runs: number[], cols: number, rows: number): void {
    const key = runs.length ? `${cols}x${rows}:${runs.join(',')}` : ''
    if (key === this.clipKey) return
    this.clipKey = key

    if (!runs.length) {
      this.clipPathEl.setAttribute('d', '')
      this.useClip(false)
      return
    }

    /* **One `<path>`, one subpath per run.**  A `clipPath` unions everything
     * inside it, so disjoint rectangles need no extra elements -- and staying
     * with a single child avoids the trap that a `clipPath` whose child has an
     * explicit box clips to that box rather than to the union.
     *
     * `clipPathUnits="objectBoundingBox"` means the numbers are 0..1 fractions
     * of the portal's own box, so the same path is right at whatever size the
     * screen happens to be drawn. */
    const d: string[] = []
    for (let i = 0; i < runs.length; i += 3) {
      const x0 = (runs[i + 1] / cols).toFixed(5)
      const x1 = (runs[i + 2] / cols).toFixed(5)
      const y0 = (runs[i] / rows).toFixed(5)
      const y1 = ((runs[i] + 1) / rows).toFixed(5)
      d.push(`M${x0} ${y0}H${x1}V${y1}H${x0}Z`)
    }
    this.clipPathEl.setAttribute('d', d.join(''))
    this.useClip(true)
  }

  /** Show or hide the picture entirely, keeping the clip in place. */
  setPictureVisible(visible: boolean): void {
    if (this.pictureVisible === visible) return
    this.pictureVisible = visible
    this.stage.style.visibility = visible ? 'visible' : 'hidden'
  }

  /**
   * Place the portal on the projected quad.
   *
   * `matrix` is the CSS `matrix3d(...)` from `projection.ts`.  The occlusion
   * silhouette is applied separately, by `setClip`.
   */
  place(matrix: string, coverage: number): void {
    if (!matrix) {
      this.wrapper.style.visibility = 'hidden'
      return
    }
    this.wrapper.style.transform = matrix
    this.wrapper.style.visibility = 'visible'
    this.wrapper.style.setProperty('--screen-coverage', String(coverage))
  }

  /** Point both the portal and its veil at the occlusion clipPath. */
  useClip(active: boolean): void {
    if (active === this.clipActive) return
    this.clipActive = active
    const value = active ? `url(#${this.clipId})` : ''
    for (const el of [this.wrapper, this.veil]) {
      el.style.setProperty('clip-path', value)
      el.style.setProperty('-webkit-clip-path', value)
    }
  }

  /**
   * Whether the picture is being shown at all.
   *
   * Hidden rather than removed: the transform keeps being computed so that a
   * screen you have walked behind resumes instantly when you come back round
   * it, instead of re-projecting from a stale matrix.
   */
  show(shown: boolean): void {
    if (this.visible === shown) return
    this.visible = shown
    this.wrapper.classList.toggle('is-live', shown)
    if (shown) this.setState(this.frame ? 'visible' : 'armed')
    else if (this.frame) this.setState('armed')
  }

  setBadge(text: string): void {
    if (this.badge.textContent === text) return
    this.badge.textContent = text
  }

  dispose(): void {
    this.release()
    this.wrapper.remove()
  }
}
