// ---------------------------------------------------------------------------
// Langit dalam: nebula, bintang jauh, dan satu planet raksasa di ujung
// perjalanan. Semuanya dihitung dari posisi stasiun (journey.ts), jadi kalau
// kamu menambah project, langitnya ikut memanjang sendiri.
//
// Tidak ada efek ke teks. Ini murni "latar" — aman untuk diabaikan.
// ---------------------------------------------------------------------------

import { stations, type Station } from './journey'

export type Veil = {
  position: [number, number, number]
  size: number
  /** warna inti dan warna tepi */
  a: string
  b: string
  seed: number
  opacity: number
}

const VEIL_COLORS: Array<[string, string]> = [
  ['#081c33', '#1f4f77'], // biru kutub — warna dominan malam beku
  ['#0a2438', '#1d6b6b'], // teal aurora
  ['#101a35', '#33508f'], // biru es dalam
  ['#1a1030', '#453a7d'], // indigo senja kutub
  ['#231a12', '#5c4526'], // bara amber redup (jejak hangat, sekali-sekali)
]

/** satu gumpalan nebula per bab, selalu di sisi kiri/kanan luar jalur kamera */
export const veils: Veil[] = stations.map((s, i) => {
  const side = i % 2 === 0 ? -1 : 1
  const dist = 30 + (i % 3) * 10
  const [ca, cb] = VEIL_COLORS[i % VEIL_COLORS.length]

  // Ketinggian disebar −8..+16 karena kamera sekarang naik-turun sampai
  // ±4 unit; kalau nebula tetap di ketinggian lama, sisi bawah layar kosong.
  const y = -8 + ((i * 5.3) % 24)

  return {
    position: [s.focus[0] + side * dist, y, s.focus[2] - 4 + (i % 3) * 7],
    size: 54 + (i % 4) * 10,
    a: ca,
    b: cb,
    seed: i * 7.31 + 1.7,
    opacity: 0.058 + (i % 3) * 0.008,
  }
})

/** gumpalan tambahan di kedalaman, supaya latar tidak pernah kosong */
export const deepVeils: Veil[] = [
  {
    position: [34, 18, -128],
    size: 150,
    a: '#0c1830',
    b: '#2a4a7d',
    seed: 21.4,
    opacity: 0.085,
  },
  {
    position: [-42, 2, -186],
    size: 170,
    a: '#08201f',
    b: '#175050',
    seed: 33.9,
    opacity: 0.075,
  },
  {
    position: [10, 26, -232],
    size: 190,
    a: '#141026',
    b: '#3b3060',
    seed: 47.2,
    opacity: 0.06,
  },
]

/** planet raksasa di ujung perjalanan: payoff saat sampai di bab kontak */
const last = stations[stations.length - 1]

export const finale = {
  position: [last.focus[0] + 15, last.focus[1] + 6.5, last.focus[2] - 72] as [
    number,
    number,
    number,
  ],
  scale: 13,
}

/**
 * Arah cahaya per stasiun, dihitung dari arah kamera: sekitar 54° ke samping,
 * dengan ketinggian yang mengikuti sudut bidik. Bidikan dari bawah tetap
 * mendapat cahaya dari atas kamera (3/4 key), bukan siluet; bidikan dari atas
 * mendapat matahari tinggi yang menyorot permukaan. Kalau semua planet
 * disinari dari satu arah yang sama, semuanya terlihat seperti render dari
 * satu scene.
 */
export const stationLight = (station: Station): [number, number, number] => {
  const dx = station.camera[0] - station.focus[0]
  const dy = station.camera[1] - station.focus[1]
  const dz = station.camera[2] - station.focus[2]
  const camEl = dy / (Math.hypot(dx, dz) || 1)
  const el = Math.min(1.05, Math.max(0.14, 0.4 + camEl * 0.62 + (station.palette % 3) * 0.05))
  const az = Math.atan2(dz, dx) + 0.94 + (station.palette % 2) * 0.12
  return [Math.cos(az), el, Math.sin(az)]
}
