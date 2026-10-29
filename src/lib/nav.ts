// ---------------------------------------------------------------------------
// Satu sumber kebenaran untuk posisi scroll.
//
// Semua yang bergerak (kamera 3D + teks di DOM) membaca angka dari objek ini,
// sehingga teks dan gambar tidak pernah "lepas" satu sama lain.
//
// Dipakai begini:
//   - App.tsx  : mengisi nilai tiap frame (satu-satunya requestAnimationFrame
//                yang menghitung posisi scroll).
//   - World.tsx: membaca nav.p / nav.seg di dalam useFrame untuk menggerakkan
//                kamera.
//   - Overlay.tsx: subscribeNav() untuk mengatur opacity teks.
// ---------------------------------------------------------------------------

export type NavState = {
  /** progres halaman 0..1 (sudah dihaluskan) */
  p: number
  /** progres dalam satuan "stasiun": 0 = intro, 1 = karya pertama, dst */
  seg: number
  /** indeks stasiun terdekat, dibulatkan */
  active: number
  /** pointer −1..1 (sudah dihaluskan) */
  x: number
  y: number
  /** kecepatan scroll 0..1 (dihaluskan) — dipakai untuk FOV & efek kecepatan */
  velocity: number
  /** 1 = gerak penuh, 0.25 = mode tenang (prefers-reduced-motion) */
  idle: number
}

export const nav: NavState = { p: 0, seg: 0, active: 0, x: 0, y: 0, velocity: 0, idle: 1 }

type Listener = (s: NavState) => void
const listeners = new Set<Listener>()

export function subscribeNav(fn: Listener): () => void {
  listeners.add(fn)
  fn(nav)
  return () => {
    listeners.delete(fn)
  }
}

export function emitNav(): void {
  listeners.forEach((fn) => fn(nav))
}

// Saat dev saja: memudahkan membaca nilai gerak dari console/CDP
// (mis. `__nav.p`, `__nav.velocity`). Tidak ikut ke build produksi.
if (import.meta.env.DEV) {
  ;(window as unknown as { __nav?: NavState }).__nav = nav
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** naik/turun dengan kecepatan nol di kedua ujung */
export function smootherstep(x: number): number {
  const t = clamp(x, 0, 1)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
