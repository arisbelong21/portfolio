// ---------------------------------------------------------------------------
// Menyusun "perjalanan": daftar bab (teks) + titik kamera (3D) dari content.ts.
//
// Teks dibangun ulang tiap kali bahasa berganti (buildChapters), sementara
// posisi kamera hanya bergantung pada JUMLAH bab — jadi jalur 3D tidak berubah
// saat pengunjung berpindah bahasa.
//
// Kamu tidak perlu menyentuh file ini. Menambah project di content.ts otomatis
// menambah satu bab dan satu titik pemberhentian kamera.
// ---------------------------------------------------------------------------

import { copy, projectFlags, projectShots, type Lang, type ProjectShot, type SiteCopy } from '../content'
import { ui } from './i18n'
import { PROJECT_LOOKS, STAR_LOOK, type PlanetLook } from './planets'

export type ChapterKind = 'intro' | 'project' | 'studio' | 'contact'

export type Chapter = {
  id: string
  kind: ChapterKind
  /** nomor yang tampil, mis. "03" */
  index: string
  kicker: string
  /** judul besar, satu string = satu baris */
  lines: string[]
  body: string
  meta: Array<{ k: string; v: string }>
  href?: string
  hrefLabel?: string
  cta?: { label: string; href: string }
  /** galeri gambar produk asli untuk panel Summary (lihat content.ts) */
  shot?: ProjectShot[]
  /** narasi terstruktur untuk panel Summary: masalah → bangun → cara → hasil */
  story?: { problem: string; built: string; how: string; result?: string }
  /** proyek yang paling mewakili arah kerja — tampil sebagai chip di panel */
  flagship?: boolean
}

/** Bentuk yang berdiri di tiap stasiun. */
export type SubjectKind = 'shard' | 'core' | 'ringed' | 'gas' | 'rock' | 'ice' | 'star'

export type Station = {
  /** titik yang dilihat kamera (tempat objek 3D berdiri) */
  focus: [number, number, number]
  /** posisi kamera saat berhenti di stasiun ini */
  camera: [number, number, number]
  scale: number
  /** geser subjek di layar, pecahan dari setengah-lebar / setengah-tinggi bidik */
  frame: [number, number]
  /** kemiringan kamera (rad) — ikut berubah halus saat scroll */
  roll: number
  palette: number
  kind: SubjectKind
  /** warna & karakter planet di stasiun ini (lihat lib/planets.ts) */
  look: PlanetLook
}

const pad = (n: number) => String(n).padStart(2, '0')

/** angka acak deterministik: susunan "berantakan" tapi sama tiap kali dimuat */
const hash = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const rand = (i: number, s: number, lo: number, hi: number) => lo + hash(i, s) * (hi - lo)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** rentang skala per bentuk: planet raksasa benar-benar besar, batu kecil tetap kecil */
const SCALE_RANGE: Record<SubjectKind, [number, number]> = {
  shard: [1.55, 1.75],
  core: [1.3, 1.5],
  star: [1.75, 2.0],
  ringed: [4.0, 4.75],
  gas: [3.3, 4.35],
  ice: [2.9, 3.5],
  rock: [2.5, 3.2],
}

/** "Automation Engine" → ["Automation", "Engine"]; "Chopster" tetap satu baris */
function titleLines(title: string): string[] {
  const words = title.trim().split(/\s+/)
  if (words.length < 2) return [title]
  if (title.length <= 13) return [title]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

/* -------------------------------------------------------------------------- */
/* Teks per bahasa                                                            */
/* -------------------------------------------------------------------------- */

export function buildChapters(lang: Lang): Chapter[] {
  const c: SiteCopy = copy[lang]
  const l = c.labels
  const t = ui[lang]
  const year = new Date().getFullYear()

  const intro: Chapter = {
    id: 'intro',
    kind: 'intro',
    index: '00',
    kicker: `${l.portfolio} / ${year}`,
    lines: c.headline,
    body: c.tagline,
    meta: [
      { k: l.name, v: c.name },
      { k: l.role, v: c.role },
      { k: l.basedIn, v: c.location },
      { k: l.status, v: c.availability },
    ],
  }

  const work: Chapter[] = c.projects.map((p, i) => ({
    id: `work-${i}`,
    kind: 'project',
    index: pad(i + 1),
    kicker: p.year ? `${l.selectedWork} / ${p.year}` : l.selectedWork,
    lines: titleLines(p.title),
    body: p.summary,
    meta: [
      // Baris tahun hanya muncul kalau tahunnya memang diketahui.
      ...(p.year ? [{ k: l.year, v: p.year }] : []),
      { k: l.role, v: p.role },
      { k: l.stack, v: p.tags.join(' · ') },
    ],
    href: p.href,
    hrefLabel: t.openProject,
    shot: projectShots[i],
    story: p.story,
    flagship: projectFlags[i] === true,
  }))

  const studio: Chapter = {
    id: 'studio',
    kind: 'studio',
    index: pad(c.projects.length + 1),
    // igloo.inc membuka identitasnya dengan satu blok "Manifesto"; label
    // garis-miring ditambahkan di Overlay supaya teks tetap polos di sini.
    kicker: t.manifesto,
    lines: c.studioHeading,
    body: `${c.statement}\n\n${c.statementNote}`,
    meta: [...c.facts],
  }

  const contact: Chapter = {
    id: 'contact',
    kind: 'contact',
    index: pad(c.projects.length + 2),
    kicker: t.nav.contact,
    lines: c.contactHeading,
    body: c.contactNote,
    meta: [
      { k: l.location, v: c.location },
      // Baris "Elsewhere" hanya muncul kalau memang ada tautan lain.
      ...(c.links.length
        ? [{ k: l.elsewhere, v: c.links.map((link) => link.label).join(' · ') }]
        : []),
      ...c.links.map((link) => ({
        k: link.label,
        v: link.href.replace(/^https?:\/\//, ''),
      })),
    ],
    cta: { label: c.email, href: `mailto:${c.email}` },
  }

  return [intro, ...work, studio, contact]
}

/* -------------------------------------------------------------------------- */
/* Posisi kamera                                                              */
/* -------------------------------------------------------------------------- */
/*
 * Setiap stasiun punya satu titik fokus (objek 3D) dan satu posisi kamera yang
 * mengelilingi fokus itu. Fokus bergerak maju di sumbu −Z sejauh GAP, kamera
 * memutari fokus dengan sudut yang bertambah → jalur kamera jadi berkelok,
 * bukan garis lurus membosankan.
 */
/**
 * Urutan bentuk untuk bab karya. Warna planet TIDAK lagi ditentukan oleh
 * bentuk — warna diambil dari `look` (lib/planets.ts), satu planet "asli"
 * per project. Bentuk di sini cuma memilih siluet dasar.
 */
const PROJECT_KINDS: SubjectKind[] = ['ice', 'ringed', 'gas', 'rock', 'gas', 'rock']

/** Bab versi default — hanya dipakai untuk menghitung bentuk & posisi kamera. */
const base = buildChapters('en')

/** bentuk tiap bab: pembuka = shard, karya = planet, approach = core, kontak = bintang */
const projectIndex = (id: string) => {
  // id project itu `work-0` … `work-5` (0-based). Jangan pakai `|| 1`:
  // `0 || 1` jadi 1, dan seluruh daftar warna bergeser satu planet.
  const raw = Number(id.split('-')[1])
  return Number.isFinite(raw) ? Math.max(0, raw) : 0
}

const KINDS: SubjectKind[] = base.map((c) => {
  if (c.kind === 'intro') return 'shard'
  if (c.kind === 'studio') return 'core'
  if (c.kind === 'contact') return 'star'
  return PROJECT_KINDS[projectIndex(c.id) % PROJECT_KINDS.length]
})

/** planet "asli" untuk tiap bab */
const LOOKS: PlanetLook[] = base.map((c) => {
  if (c.kind === 'contact') return STAR_LOOK
  if (c.kind !== 'project') return PROJECT_LOOKS[0]
  return PROJECT_LOOKS[projectIndex(c.id) % PROJECT_LOOKS.length]
})

/**
 * "Skrip bidikan": sudut kamera tiap bab.
 *
 * elev  = tinggi kamera relatif radius orbit. Negatif = kamera di BAWAH planet
 *         (menyorot ke atas), positif = di ATAS (menunduk ke permukaan).
 * shot  = pengali jarak kamera (besar = planet kecil di ruang lapang).
 * frame = geser subjek di layar (pecahan setengah-lebar / setengah-tinggi).
 * roll  = kemiringan horizon (sudut Dutch) untuk komposisi diagonal.
 *
 * Nilainya DIACAK secara deterministik, bukan disusun berpola. Yang dijaga
 * hanya satu hal: arah orbit kamera tidak pernah berbalik (lihat `az` di
 * generator) — itu satu-satunya hal yang dulu membuat scroll terasa memusingkan.
 */
type Shot = {
  elev: number
  shot: number
  frame: [number, number]
  roll: number
}

const INTRO_SHOT: Shot = { elev: -0.16, shot: 1.0, frame: [0.3, 0.1], roll: 0 }
/** Batu Manifesto wajib duduk di kanan-bawah supaya tabel fakta tidak tertutup. */
const CORE_SHOT: Shot = { elev: -0.02, shot: 1.16, frame: [0.66, -0.42], roll: 0 }
const STAR_SHOT: Shot = { elev: 0.44, shot: 0.92, frame: [0.3, -0.16], roll: 0.055 }

/**
 * Enam bidikan karya, masing-masing dilempar dadu sendiri:
 *  - ketinggian acak, dan kadang dua bab berurutan sama-sama tinggi (atau
 *    sama-sama rendah) supaya polanya tidak terbaca "atas-bawah-atas-bawah";
 *  - cincin sesekali dilihat nyaris sejajar, sehingga piringannya jadi garis
 *    tipis membelah planet — bidikan paling ikonik untuk Saturnus;
 *  - jarak, kemiringan horizon, dan letak subjek di layar ikut acak.
 */
const PROJECT_SHOTS: Shot[] = (() => {
  const out: Shot[] = []
  let prevElev = 0.3
  for (let k = 0; k < PROJECT_KINDS.length; k++) {
    const i = k + 1
    const kind = PROJECT_KINDS[k]

    let elev = rand(i, 11, -0.52, 0.95)
    if (Math.sign(elev) === Math.sign(prevElev) && hash(i, 12) < 0.45) elev = -elev
    if (kind === 'ringed' && hash(i, 13) < 0.55) elev = rand(i, 14, -0.09, 0.18)
    // dua bab berurutan tidak boleh punya ketinggian nyaris sama
    if (Math.abs(elev - prevElev) < 0.28) elev += (elev >= prevElev ? 1 : -1) * 0.28
    elev = clamp(elev, -0.66, 1.04)
    prevElev = elev

    const roll = rand(i, 16, 0.02, 0.115) * (hash(i, 17) < 0.5 ? -1 : 1)
    // kamera tinggi → subjek diturunkan di layar, dan sebaliknya
    const frameY = clamp(-elev * 0.24 + rand(i, 19, -0.13, 0.13), -0.4, 0.4)

    out.push({
      elev,
      shot: rand(i, 15, 0.8, 1.34),
      frame: [rand(i, 18, 0.2, 0.5), frameY],
      roll,
    })
  }
  return out
})()

const shotFor = (i: number, kind: SubjectKind): Shot => {
  if (kind === 'shard') return INTRO_SHOT
  if (kind === 'core') return CORE_SHOT
  if (kind === 'star') return STAR_SHOT
  return PROJECT_SHOTS[(i - 1) % PROJECT_SHOTS.length]
}

export const stations: Station[] = (() => {
  let z = 0
  // Azimuth kamera bertambah terus dengan langkah acak 18°–46° per bab: tiap
  // planet disorot dari sisi yang berbeda (depan, serong, samping, belakang)
  // tapi orbitnya selalu SEARAH. Yang membuat pusing dulu bukan besarnya
  // sudut, melainkan arah hadap yang berbalik kanan-kiri-kanan-kiri.
  let az = 0.34
  return base.map((_, i) => {
    const kind = KINDS[i]
    const isPlanet = kind !== 'shard' && kind !== 'core'

    // Jarak antar-bab jauh dan tidak rata. Versi 19–30 membuat planet
    // berikutnya selalu tampak "menempel" di belakang planet yang sedang
    // dilihat; sekarang tiap lompatan 34–58 unit supaya scroll terasa benar-
    // benar berpindah tempat, bukan bergeser sedikit.
    if (i > 0) {
      z -= rand(i, 1, 34, 58)
      az += rand(i, 7, 0.32, 0.8)
    }

    // Posisi dunia boleh "berantakan", tapi jalannya pelan dan bersambung:
    // dua gelombang lambat yang tidak sefase menyebar planet ke kiri, kanan,
    // atas, bawah — selama arah hadap kamera tidak ikut berayun.
    const fx =
      i === 0
        ? 0
        : 3.6 * Math.sin(i * 0.62 + 0.25) +
          2.3 * Math.sin(i * 1.31 + 1.7) +
          rand(i, 2, -1.3, 1.3)
    const fy =
      0.4 +
      2.9 * Math.sin(i * 0.83 + 1.1) +
      1.2 * Math.sin(i * 1.91 + 0.3) +
      rand(i, 3, -1.0, 1.6)

    const [smin, smax] = SCALE_RANGE[kind]
    const scale = rand(i, 5, smin, smax)

    const shot = shotFor(i, kind)
    const radius = (isPlanet ? 13.2 + scale * 1.5 : 14.0) * shot.shot
    const lift = shot.elev * radius

    // Jari-jari subjek di layar (dalam pecahan setengah-lebar) sebanding
    // scale/jarak. Dipakai dua kali: menahan tepi kiri bola agar tidak
    // menimpa kolom teks, dan menahan tepi kanan agar tidak keluar layar
    // saat bidikan dibuat rapat.
    const dist = Math.hypot(radius, lift)
    const half = (1.43 * scale) / dist
    const frameMin = -0.1 + half
    const frameMax = Math.max(frameMin, 0.95 - half)

    return {
      focus: [fx, fy, z],
      camera: [fx + Math.sin(az) * radius, fy + lift, z + Math.cos(az) * radius],
      scale,
      frame: [clamp(shot.frame[0], frameMin, frameMax), shot.frame[1]],
      roll: isPlanet ? shot.roll : 0,
      palette: i,
      kind,
      look: LOOKS[i],
    }
  })
})()

/** jumlah bab — sama untuk semua bahasa */
export const chapterCount = base.length

/** jumlah halaman scroll yang dipakai; sisa 0.6 = jeda diam di bab terakhir */
export const unitsTotal = chapterCount - 1 + 0.6

/** posisi scroll (0..1) tempat stasiun ke-i berhenti */
export const stationProgress = (i: number) => i / unitsTotal
