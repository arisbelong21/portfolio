// ---------------------------------------------------------------------------
// Gerak: peredam yang tidak berubah rasa saat FPS berubah, plus noise halus.
//
// Kenapa tidak `lerp(a, b, 0.1)` langsung? Karena di layar 144 Hz angka itu
// bergerak 2,4x lebih cepat daripada di 60 Hz. Semua peredaman di sini memakai
// laju "per frame 60 fps" sebagai acuan, lalu dikonversi ke delta time nyata.
// ---------------------------------------------------------------------------

/** Koefisien lerp untuk frame ini. `k` = laju acuan per frame @60fps. */
export function damp(k: number, dt: number): number {
  const kk = k <= 0 ? 0 : k >= 1 ? 1 : k
  return 1 - Math.exp(Math.log(1 - kk) * dt * 60)
}

/** Satu langkah peredaman menuju target. */
export function dampTo(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * damp(k, dt)
}

/* -------------------------------------------------------------------------- */
/* Noise 1D                                                                   */
/* -------------------------------------------------------------------------- */

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Value noise halus, keluaran −1..1. Tidak periodik seperti `sin(t)`. */
export function noise1(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash(i) * 2 - 1
  const b = hash(i + 1) * 2 - 1
  return a + (b - a) * smooth(f)
}

/** Dua oktaf: gelombang besar + riak kecil. Dipakai untuk "napas" kamera. */
export function fbm1(x: number): number {
  return noise1(x) * 0.66 + noise1(x * 2.17 + 11.7) * 0.34
}
