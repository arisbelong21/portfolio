// ---------------------------------------------------------------------------
// "Warna asli" tiap planet.
//
// Prinsipnya: bentuk dan warnanya mengikuti planet yang memang ada — Europa,
// Saturnus, Venus, Mars, Neptunus, Titan — dengan palet yang diambil dari
// fotografi luar angkasa, bukan dari ilustrasi. Warna diekspos rendah dan
// sedikit kusam; saturasi tinggi sengaja dihindari karena itu yang membuat
// planet terasa seperti animasi.
//
// `surface` memilih model permukaan di shader: pita gas, kawah batu, retakan
// es, atau kabut tebal. `lineae` hanya dipakai oleh permukaan es.
//
// `bright` bukan selera: itu hasil kalibrasi tangkapan layar supaya planet
// terang tapi tidak "blowout" di ACES + exposure 0.88.
// ---------------------------------------------------------------------------

export type PlanetSurface = 'gas' | 'rock' | 'ice' | 'haze' | 'sun'

export type PlanetLook = {
  id: string
  /** model permukaan yang dipakai shader */
  surface: PlanetSurface
  /** warna bagian gelap → terang */
  deep: string
  mid: string
  light: string
  /** warna atmosfer / tepi bola */
  rim: string
  /** warna retakan di permukaan es (Europa) */
  lineae: string
  /** 0..1 pita gas */
  bands: number
  /** 0..1 kawah batu */
  craters: number
  /** 0..1 tudung kutub */
  caps: number
  /** 1 = menyala sendiri (bintang) */
  emissive: number
  bandFreq: number
  /** 0..1 badai oval (bintik raksasa) */
  storm: number
  /** 0..1 kilau permukaan (es / laut) */
  specular: number
  rings: [number, number] | null
  ringA: string
  ringB: string
  moons: number
  bright: number
  /** kemiringan sumbu, radian: [x, z] */
  tilt: [number, number]
  /** kekuatan atmosfer 0..1 */
  atmo: number
  /** halo di belakang subjek — satu-satunya tempat hijau boleh dominan */
  halo: string
  /** lapisan awan 0..1 (0 = tanpa awan) */
  clouds: number
  /** warna awan (terang) dan bayangannya (gelap) */
  cloudColor: string
  cloudShadow: string
  /** aurora kutub 0..1 */
  aurora: number
  /** warna aurora: kaki tirai dan puncak */
  auroraLow: string
  auroraHigh: string
  /** warna hamburan atmosfer volumetrik (rayleigh) dan haze depan (mie) */
  scatter: string
  mie: string
}

/**
 * Urutan mengikuti urutan project di content.ts:
 * JARVIS, Chopster, Racuninaja, Chopsterin, Gabutstream, Kamoeta Uga.
 */
export const PROJECT_LOOKS: PlanetLook[] = [
  {
    // JARVIS — Europa: es ivory dengan retakan cokelat, hampir tanpa atmosfer
    id: 'europa',
    surface: 'ice',
    deep: '#1a1a1e',
    mid: '#9b9586',
    light: '#e7e3d6',
    rim: '#b3c5d4',
    lineae: '#7a563f',
    bands: 0,
    craters: 0,
    caps: 0,
    emissive: 0,
    bandFreq: 4,
    storm: 0,
    specular: 0.32,
    rings: null,
    ringA: '#9fc6d8',
    ringB: '#e8f6ff',
    moons: 2,
    bright: 1.0,
    tilt: [0.1, -0.16],
    atmo: 0.22,
    halo: '#7fa8bd',
    clouds: 0,
    cloudColor: '#dfe7ea',
    cloudShadow: '#2a3138',
    aurora: 0.15,
    auroraLow: '#59e0a8',
    auroraHigh: '#7f6cff',
    scatter: '#9fc4d8',
    mie: '#d8e4ea',
  },
  {
    // Chopster — Saturnus: krem keemasan pucat, pita halus, cincin gading
    id: 'saturn',
    surface: 'gas',
    deep: '#2c2418',
    mid: '#a58d68',
    light: '#e8ddc6',
    rim: '#d2c3a8',
    lineae: '#7a563f',
    bands: 1,
    craters: 0,
    caps: 0,
    emissive: 0,
    bandFreq: 9,
    storm: 0.25,
    specular: 0,
    rings: [1.35, 2.3],
    ringA: '#a8997c',
    ringB: '#d6ccb6',
    moons: 1,
    bright: 1.08,
    tilt: [0.18, 0.3],
    atmo: 0.5,
    halo: '#d8c8a4',
    clouds: 0.15,
    cloudColor: '#efe5d0',
    cloudShadow: '#3a3024',
    aurora: 0,
    auroraLow: '#d8c8a4',
    auroraHigh: '#eee2c8',
    scatter: '#d8c8a4',
    mie: '#eee2c8',
  },
  {
    // Racuninaja — Venus: kabut belerang krem, hampir tanpa detail permukaan
    id: 'venus',
    surface: 'haze',
    deep: '#3a3018',
    mid: '#b09a68',
    light: '#e6d8b4',
    rim: '#d3c294',
    lineae: '#7a563f',
    bands: 0.2,
    craters: 0,
    caps: 0,
    emissive: 0,
    bandFreq: 4.5,
    storm: 0,
    specular: 0.02,
    rings: null,
    ringA: '#8ea348',
    ringB: '#e8f6a6',
    moons: 0,
    bright: 0.95,
    tilt: [0.06, 0.1],
    atmo: 0.75,
    halo: '#c9b986',
    clouds: 0.05,
    cloudColor: '#efe3c4',
    cloudShadow: '#463a1c',
    aurora: 0,
    auroraLow: '#c9b986',
    auroraHigh: '#efe3c4',
    scatter: '#dfc790',
    mie: '#f0e3c4',
  },
  {
    // Chopsterin — Mars: oker karat, basal gelap, tudung kutub tipis
    id: 'mars',
    surface: 'rock',
    deep: '#331a11',
    mid: '#9c5d3f',
    light: '#d9a983',
    rim: '#c98d68',
    lineae: '#7a563f',
    bands: 0,
    craters: 1,
    caps: 0.65,
    emissive: 0,
    bandFreq: 4,
    storm: 0,
    specular: 0,
    rings: null,
    ringA: '#b5714a',
    ringB: '#f0b184',
    moons: 2,
    bright: 0.98,
    tilt: [0.1, 0.04],
    atmo: 0.3,
    halo: '#c98d68',
    clouds: 0,
    cloudColor: '#e8cdb4',
    cloudShadow: '#3c2416',
    aurora: 0,
    auroraLow: '#c98d68',
    auroraHigh: '#d9a983',
    scatter: '#d69a72',
    mie: '#e8c6a6',
  },
  {
    // Gabutstream — Neptunus: biru dalam, pita samar, bintik gelap
    id: 'neptune',
    surface: 'gas',
    deep: '#081224',
    mid: '#2a4a78',
    light: '#8aacca',
    rim: '#6f92b8',
    lineae: '#7a563f',
    bands: 0.5,
    craters: 0,
    caps: 0,
    emissive: 0,
    bandFreq: 3.2,
    storm: 0.3,
    specular: 0.05,
    rings: null,
    ringA: '#3f6fae',
    ringB: '#a7cbff',
    moons: 2,
    bright: 1.0,
    tilt: [0.06, -0.12],
    atmo: 0.6,
    halo: '#7293c0',
    clouds: 0.12,
    cloudColor: '#cfddea',
    cloudShadow: '#0c1828',
    aurora: 0.3,
    auroraLow: '#4fd8ff',
    auroraHigh: '#8f7bff',
    scatter: '#5f8fc8',
    mie: '#b8cfe0',
  },
  {
    // Kamoeta Uga — Titan: kabut oranye tebal, permukaan tak terlihat
    id: 'titan',
    surface: 'haze',
    deep: '#3a2a16',
    mid: '#a07c49',
    light: '#d9bd8c',
    rim: '#c2a275',
    lineae: '#7a563f',
    bands: 0,
    craters: 0,
    caps: 0,
    emissive: 0,
    bandFreq: 3,
    storm: 0,
    specular: 0,
    rings: null,
    ringA: '#a98a58',
    ringB: '#f0d8a6',
    moons: 1,
    bright: 0.9,
    tilt: [0.09, 0.2],
    atmo: 0.85,
    halo: '#c2a275',
    clouds: 0,
    cloudColor: '#e8d0a4',
    cloudShadow: '#3a2c18',
    aurora: 0,
    auroraLow: '#c2a275',
    auroraHigh: '#d9bd8c',
    scatter: '#d8a860',
    mie: '#f0cf98',
  },
]

/** planet raksasa penutup: Saturnus pucat dengan tepi atmosfer mint tipis */
export const FINALE_LOOK: PlanetLook = {
  id: 'finale',
  surface: 'gas',
  deep: '#2e271b',
  mid: '#a2947a',
  light: '#e6ddca',
  rim: '#d6ccb8',
  lineae: '#7a563f',
  bands: 0.88,
  craters: 0,
  caps: 0,
  emissive: 0,
  bandFreq: 7.8,
  storm: 0.18,
  specular: 0,
  rings: [1.45, 2.4],
  ringA: '#ab9d84',
  ringB: '#d8cfbc',
  moons: 0,
  bright: 0.8,
  tilt: [0.2, 0.3],
  atmo: 0.5,
  halo: '#cfc7b6',
  clouds: 0.1,
  cloudColor: '#ebe2d2',
  cloudShadow: '#3a3226',
  aurora: 0,
  auroraLow: '#cfc7b6',
  auroraHigh: '#ebe2d2',
  scatter: '#d8cfae',
  mie: '#f0e8d0',
}

/** bintang kontak: bintang tipe-G, hangat, menyala sendiri */
export const STAR_LOOK: PlanetLook = {
  id: 'sun',
  surface: 'sun',
  deep: '#5a3008',
  mid: '#f0741c',
  light: '#ffd9a2',
  rim: '#ffe2b8',
  lineae: '#7a563f',
  bands: 0,
  craters: 0,
  caps: 0,
  emissive: 1,
  bandFreq: 5,
  storm: 0,
  specular: 0,
  rings: null,
  ringA: '#ffb35e',
  ringB: '#fff6dc',
  moons: 0,
  // Piringan matahari harus terang tapi tidak sampai pucat: di atas ~1.6
  // ACES mencuci jingganya menjadi krem, jadi terangnya dibantu glow.
  bright: 1.25,
  tilt: [0, 0],
  atmo: 0.7,
  halo: '#ffd9a0',
  clouds: 0,
  cloudColor: '#fff6dc',
  cloudShadow: '#3a1d05',
  aurora: 0,
  auroraLow: '#ffd9a0',
  auroraHigh: '#fff6dc',
  scatter: '#ffc880',
  mie: '#ffe0b0',
}
