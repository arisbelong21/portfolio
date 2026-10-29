// ---------------------------------------------------------------------------
// Intro: perjalanan singkat menuju bab pertama.
//
// Kamera tidak lagi "diguncang" di tempat. Ia mulai jauh di belakang, melesat
// menyusuri kurva mendekat, sedikit melebar di tikungan, lalu mengerem mulus
// tepat di posisi kamera bab 00. Profil kecepatannya (bukan sekadar
// ease-in-out) yang membuat rasanya seperti menempuh jarak, bukan seperti foto
// yang digoyang.
//
// `warp()` tetap jadi satu-satunya angka yang dibaca efek (FOV, aberasi, debu,
// streak, meteor, SFX) — sekarang artinya "seberapa cepat sedang bergerak".
// ---------------------------------------------------------------------------

export const INTRO_DURATION = 6.0

export const intro = {
  /** 0..1 progres intro; 1 = selesai */
  t: 0,
  /** true hanya selama intro berjalan */
  active: false,
  /** true bila intro dilewati (prefers-reduced-motion) */
  skipped: false,
  /** true sejak gestur masuk — dipakai animasi teks untuk menunggu */
  started: false,
}

export function startIntro(reduced: boolean) {
  intro.started = true
  if (reduced) {
    intro.t = 1
    intro.active = false
    intro.skipped = true
    return
  }
  intro.t = 0
  intro.active = true
  intro.skipped = false
}

export function tickIntro(dt: number) {
  if (!intro.active) return
  intro.t = Math.min(1, intro.t + dt / INTRO_DURATION)
  if (intro.t >= 1) intro.active = false
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return k * k * (3 - 2 * k)
}

/** profil kecepatan: nol → melesat → mengerem, tanpa hentakan di ujung */
function speedAt(x: number) {
  return smooth(0, 0.2, x) * (1 - smooth(0.62, 1, x))
}

/* Tabel integral kecepatan: memberi posisi sepanjang kurva (0..1) yang
   konsisten dengan profil di atas. Dihitung sekali saat modul dimuat. */
const STEPS = 240
const table = new Float32Array(STEPS + 1)
let peakSpeed = 0.0001

{
  let acc = 0
  table[0] = 0
  for (let i = 1; i <= STEPS; i++) {
    const x = (i - 0.5) / STEPS
    const v = speedAt(x)
    if (v > peakSpeed) peakSpeed = v
    acc += v
    table[i] = acc
  }
  for (let i = 0; i <= STEPS; i++) table[i] /= acc
}

/** posisi sepanjang kurva intro, 0..1 (sudah diberi profil kecepatan) */
export function introU(): number {
  if (intro.skipped) return 1
  if (!intro.active) return 1
  const f = Math.min(Math.max(intro.t, 0), 1) * STEPS
  const i = Math.floor(f)
  const k = f - i
  return table[i] * (1 - k) + table[Math.min(i + 1, STEPS)] * k
}

/** intensitas 0..1 untuk efek kecepatan (FOV, streak, SFX, debu) */
export function warp(): number {
  if (!intro.active) return 0
  const v = speedAt(Math.min(Math.max(intro.t, 0), 1)) / peakSpeed
  return Math.min(Math.max(v, 0), 1)
}

export const introStarted = () => intro.started
export const introActive = () => intro.active

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__intro = () => ({
    t: Number(intro.t.toFixed(3)),
    u: Number(introU().toFixed(3)),
    active: intro.active,
    started: intro.started,
    skipped: intro.skipped,
    w: Number(warp().toFixed(3)),
  })
}
