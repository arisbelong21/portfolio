// ---------------------------------------------------------------------------
// Kursor "air": setiap huruf punya pegas. Saat kursor bergerak di atas teks,
// huruf di dekatnya terdorong menjauh (dengan sedikit pusaran) lalu kembali
// memantul — seperti mengusap permukaan air. Sebuah lensa tipis (blur +
// saturasi) mengikuti kursor supaya terasa seperti lapisan air, bukan cuma
// huruf yang bergeser.
//
// Semua ditulis langsung ke style di satu requestAnimationFrame. Tidak ada
// state React: 60x/detik re-render akan membuat teks tertinggal dari kursor.
//
// Cara pakai:
//   - bungkus teks dengan <Liquid text="..." />  → tiap huruf jadi .lq-c
//   - panggil setWaterRoot(el) saat bab aktif / panel terbuka
//   - panggil setLens(el) sekali dengan elemen lensa
// ---------------------------------------------------------------------------

import { nav } from './nav'

type Glyph = {
  el: HTMLElement
  x: number
  y: number
  /** tinggi huruf, dipakai untuk mengukur besar dorongan */
  h: number
  dx: number
  dy: number
  vx: number
  vy: number
  moved: boolean
}

type Wake = { x: number; y: number; t: number; s: number; vx: number; vy: number }

const RADIUS = 132
const WAKE_LIFE = 520
const MAX_WAKE = 14
const MEASURE_EVERY = 480

let enabled = true
let root: HTMLElement | null = null
let glyphs: Glyph[] = []
let bounds = { left: 0, top: 0, right: 0, bottom: 0 }
let needsMeasure = true
let lastMeasure = 0

let lens: HTMLElement | null = null
let lensOn = 0

let px = -1e4
let py = -1e4
let lastPx = -1e4
let lastPy = -1e4
let flow = 0
let hasPointer = false

const wakes: Wake[] = []

let raf = 0
let last = 0
let frozen = false

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

export function setLens(el: HTMLElement | null) {
  lens = el
  if (lens) {
    lens.style.opacity = '0'
    lens.style.transform = 'translate3d(-9999px, -9999px, 0)'
  }
}

export function setWaterEnabled(v: boolean) {
  enabled = v
  if (!v) clear()
}

export function setWaterRoot(el: HTMLElement | null) {
  if (el === root) return
  if (root) root.removeEventListener('scroll', onRootScroll)
  clear()
  root = el
  if (root) root.addEventListener('scroll', onRootScroll, { passive: true })
  needsMeasure = true
  lastMeasure = 0
}

function onRootScroll() {
  needsMeasure = true
}

function clear() {
  for (const g of glyphs) {
    if (g.moved) g.el.style.transform = ''
  }
  glyphs = []
  wakes.length = 0
  lensOn = 0
  if (lens) lens.style.opacity = '0'
}

function measure() {
  // Keadaan fisika dipertahankan per elemen: mengukur ulang (saat panel
  // di-scroll) tidak boleh "membekukan" huruf yang sedang terdorong.
  const prev = new Map<HTMLElement, Glyph>()
  for (const g of glyphs) prev.set(g.el, g)

  const next: Glyph[] = []
  if (!root || !root.isConnected) {
    glyphs = next
    return
  }

  const nodes = root.querySelectorAll<HTMLElement>('.lq-c')
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  // Satu batch pembacaan layout: semua getBoundingClientRect dulu, baru
  // dipakai. Tidak ada tulis-style di antaranya, jadi tidak memicu reflow
  // berulang.
  const rects: DOMRect[] = []
  const els: HTMLElement[] = []
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i]
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    rects.push(r)
    els.push(el)
  }

  for (let i = 0; i < els.length; i++) {
    const el = els[i]
    const r = rects[i]
    const x = r.left + r.width / 2
    const y = r.top + r.height / 2
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y

    const old = prev.get(el)
    if (old) {
      old.x = x
      old.y = y
      old.h = r.height
      next.push(old)
      prev.delete(el)
    } else {
      next.push({ el, x, y, h: r.height, dx: 0, dy: 0, vx: 0, vy: 0, moved: false })
    }
  }

  // Huruf yang hilang (ganti bab/bahasa) dibersihkan transformnya.
  prev.forEach((g) => {
    if (g.moved) g.el.style.transform = ''
  })

  glyphs = next
  if (next.length) {
    bounds = { left: minX, top: minY, right: maxX, bottom: maxY }
  }
  lastMeasure = performance.now()
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch') return
  px = e.clientX
  py = e.clientY
  hasPointer = true
}

/** Klik di atas teks = satu "ceburan": riak radial yang lebih kuat. */
function onPointerDown(e: PointerEvent) {
  if (!root || !glyphs.length) return
  if (e.pointerType === 'touch') return
  const el = e.target as Element | null
  if (el?.closest('button, a, input, textarea')) return
  if (
    e.clientX < bounds.left - 90 ||
    e.clientX > bounds.right + 90 ||
    e.clientY < bounds.top - 70 ||
    e.clientY > bounds.bottom + 70
  ) {
    return
  }
  wakes.push({
    x: e.clientX,
    y: e.clientY,
    t: performance.now(),
    s: 1.9,
    vx: 0,
    vy: 0,
  })
  if (wakes.length > MAX_WAKE) wakes.shift()
}

function start() {
  if (raf) return
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown)
  raf = requestAnimationFrame(frame)
}

function stop() {
  if (!raf) return
  cancelAnimationFrame(raf)
  raf = 0
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)

  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
  last = now

  if (frozen) return

  if (!enabled || nav.idle < 0.5 || document.hidden) {
    fadeLens(dt, 0)
    return
  }

  if (!root || !root.isConnected) {
    if (root) setWaterRoot(null)
    return
  }

  // Posisi huruf hanya valid saat dunia diam: bab yang sedang bergerak
  // (fade/translate) akan sedikit menggeser rect, jadi ukur ulang berkala
  // selama scroll sudah tenang.
  if ((needsMeasure || now - lastMeasure > MEASURE_EVERY) && nav.velocity < 0.05) {
    measure()
    needsMeasure = false
  }

  if (!glyphs.length) {
    fadeLens(dt, 0)
    return
  }

  // Gerak kursor diukur per frame (px/frame), lalu dijinakkan jadi 0..1.
  const moveX = px - lastPx
  const moveY = py - lastPy
  lastPx = px
  lastPy = py
  const moved = Math.hypot(moveX, moveY)
  flow += (clamp(moved / 16, 0, 1) - flow) * (1 - Math.exp(-dt * 9))

  const inside =
    hasPointer &&
    px > bounds.left - 90 &&
    px < bounds.right + 90 &&
    py > bounds.top - 70 &&
    py < bounds.bottom + 70

  // Jejak ("wake"): titik-titik yang ditinggalkan kursor, memudar perlahan.
  // Titik baru hanya ditambah kalau kursor benar-benar bergeser — kalau diam,
  // jejak lama habis dan huruf kembali ke tempatnya.
  if (inside && moved > 1.2) {
    wakes.push({
      x: px,
      y: py,
      t: now,
      s: 0.3 + flow * 0.7,
      // arah sapuan: huruf di belakang kursor ikut "tertarik" searah gerakan
      vx: moveX / moved,
      vy: moveY / moved,
    })
    if (wakes.length > MAX_WAKE) wakes.shift()
  }
  while (wakes.length && now - wakes[0].t > WAKE_LIFE) wakes.shift()

  const R2 = RADIUS * RADIUS

  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i]

    let fx = 0
    let fy = 0

    // Jangkauan mengikuti ukuran huruf: teks isi (≈15px) hanya terusik
    // dalam radius sempit, judul besar punya riak yang lebih lebar. Tanpa ini
    // satu gerakan kursor bisa mengaduk seluruh blok teks.
    const reach = clamp(g.h * 5.6, 70, 165)
    const reach2 = Math.min(reach * reach, R2)

    if (inside && wakes.length) {
      for (let k = 0; k < wakes.length; k++) {
        const w = wakes[k]
        const vx = g.x - w.x
        const vy = g.y - w.y
        const d2 = vx * vx + vy * vy
        if (d2 > reach2) continue
        const d = Math.sqrt(d2) || 1
        const fall = 1 - d / reach
        const age = (now - w.t) / WAKE_LIFE
        const power = fall * fall * (1 - age) * w.s
        // Sebagian besar mengikuti arah sapuan (seperti mengusap air),
        // sebagian kecil menjauh dari titik sentuh + pusaran tipis.
        fx += (w.vx * 0.6 + (vx / d) * 0.28 - (vy / d) * 0.18) * power
        fy += (w.vy * 0.6 + (vy / d) * 0.28 + (vx / d) * 0.18) * power
      }
    }

    // Skala dorongan mengikuti ukuran huruf, dan tetap kecil: ini riak air,
    // bukan animasi huruf yang berhamburan.
    const amp = clamp(g.h * 0.32, 2.6, 13)
    const tx = clamp(fx * (amp * 1.8), -amp, amp)
    const ty = clamp(fy * (amp * 1.8), -amp, amp)

    g.vx += ((tx - g.dx) * 205 - g.vx * 15) * dt
    g.vy += ((ty - g.dy) * 205 - g.vy * 15) * dt
    g.dx += g.vx * dt
    g.dy += g.vy * dt
    g.dx += g.vx * dt
    g.dy += g.vy * dt

    if (Math.abs(g.dx) + Math.abs(g.dy) > 0.06) {
      g.el.style.transform = `translate3d(${g.dx.toFixed(2)}px, ${g.dy.toFixed(2)}px, 0)`
      g.moved = true
    } else if (g.moved) {
      g.el.style.transform = ''
      g.dx = 0
      g.dy = 0
      g.vx = 0
      g.vy = 0
      g.moved = false
    }
  }

  fadeLens(dt, inside ? 0.85 + flow * 0.15 : 0)
}

function fadeLens(dt: number, target: number) {
  if (!lens) return
  lensOn += (target - lensOn) * (1 - Math.exp(-dt * 11))
  if (Math.abs(lensOn) < 0.004) lensOn = 0

  lens.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
  lens.style.opacity = lensOn < 0.01 ? '0' : lensOn.toFixed(3)
}

/** Dipanggil sekali oleh Overlay saat aplikasi siap. */
export function initWater() {
  start()
}

export function disposeWater() {
  stop()
  setWaterRoot(null)
  setLens(null)
}

// Dev: bekukan efek supaya bisa difoto (screenshot) saat huruf masih terdorong.
if (import.meta.env.DEV) {
  ;(window as unknown as { __water?: { freeze: (v: boolean) => void } }).__water = {
    freeze: (v: boolean) => {
      frozen = v
    },
  }
}
