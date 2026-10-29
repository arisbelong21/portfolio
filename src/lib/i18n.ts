// ---------------------------------------------------------------------------
// Bahasa halaman (id / en) + teks antarmuka yang tidak ada di content.ts.
//
// Pilihan disimpan di localStorage, jadi tetap sama saat halaman dibuka lagi.
// Kalau pengguna belum pernah memilih, dipakai bahasa browser (id → Indonesia).
// ---------------------------------------------------------------------------

import type { Lang } from '../content'

const KEY = 'portfolio.lang'

const listeners = new Set<(lang: Lang) => void>()

/** ?lang=id / ?lang=en — tautan yang bisa dibagikan dalam satu bahasa. */
function fromUrl(): Lang | null {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'id' || q === 'en') return q
  } catch {
    /* abaikan */
  }
  return null
}

function detect(): Lang {
  const linked = fromUrl()
  if (linked) return linked
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'id' || saved === 'en') return saved
  } catch {
    /* localStorage bisa diblokir; abaikan */
  }
  const nav = typeof navigator === 'undefined' ? 'en' : navigator.language || 'en'
  return nav.toLowerCase().startsWith('id') ? 'id' : 'en'
}

let current: Lang = detect()

// index.html ditulis statis dengan lang="en"; samakan atributnya dengan bahasa
// yang benar-benar dipakai (browser Indonesia / pilihan tersimpan / ?lang=id).
if (typeof document !== 'undefined') document.documentElement.lang = current

export const getLang = (): Lang => current

export function setLang(next: Lang) {
  if (next === current) return
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    /* abaikan */
  }
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url)
  } catch {
    /* abaikan */
  }
  document.documentElement.lang = next
  listeners.forEach((fn) => fn(next))
}

export function subscribeLang(fn: (lang: Lang) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/* -------------------------------------------------------------------------- */
/* Teks antarmuka                                                             */
/* -------------------------------------------------------------------------- */

const en = {
  nav: { work: 'Work', approach: 'Approach', contact: 'Contact' },
  sections: 'Sections',
  chaptersLabel: 'Chapters',
  scroll: 'Scroll',
  skip: 'Skip to work',
  backToStart: 'Back to start',
  openProject: 'Open project',
  language: 'Language',
  sound: 'Scroll sound',
  enter: 'Click to enter',
  // Bahasa label ala igloo.inc: judul seksi memakai awalan garis miring.
  manifesto: 'Manifesto',
  capabilities: 'Capabilities',
  summary: 'Summary',
  discover: 'Discover',
  visit: 'Visit',
  close: 'Close',
  openSummary: 'Read summary',
  gallery: 'Product screenshots',
  exploreWork: 'Explore the work',
  contactMe: 'Contact me',
  flagship: 'Flagship build',
  storyProblem: 'Problem',
  storyBuilt: 'What I built',
  storyHow: 'How it works',
  storyResult: 'Result',
  stoneHint: 'Click the stone to read',
  scrollDiscover: 'Scroll down to discover.',
  clickExplore: 'Click to explore',
  motion: 'Motion reduced by your system — tap for full motion',
  stages: {
    booting: 'booting',
    type: 'type ready',
    scene: 'building scene',
    static: 'static mode',
    ready: 'ready',
  },
}

export type UI = typeof en

export const ui: Record<Lang, UI> = {
  en,
  id: {
    nav: { work: 'Karya', approach: 'Pendekatan', contact: 'Kontak' },
    sections: 'Bagian',
    chaptersLabel: 'Bab',
    scroll: 'Gulir',
    skip: 'Lewati ke karya',
    backToStart: 'Kembali ke awal',
    openProject: 'Buka proyek',
    language: 'Bahasa',
    sound: 'Suara scroll',
    enter: 'Klik untuk masuk',
    manifesto: 'Manifes',
    capabilities: 'Kapabilitas',
    summary: 'Ringkasan',
    discover: 'Temukan',
    visit: 'Kunjungi',
    close: 'Tutup',
    openSummary: 'Baca ringkasan',
    gallery: 'Tangkapan layar produk',
    exploreWork: 'Jelajahi karya',
    contactMe: 'Hubungi saya',
    flagship: 'Karya utama',
    storyProblem: 'Masalah',
    storyBuilt: 'Yang saya bangun',
    storyHow: 'Cara kerja',
    storyResult: 'Hasil',
    stoneHint: 'Klik batu untuk membaca',
    scrollDiscover: 'Gulir ke bawah untuk menjelajah.',
    clickExplore: 'Klik untuk menjelajah',
    motion: 'Gerak diminimalkan oleh sistem — ketuk untuk gerak penuh',
    stages: {
      booting: 'menyiapkan',
      type: 'font siap',
      scene: 'membangun scene',
      static: 'mode statis',
      ready: 'siap',
    },
  },
}

export const t = (lang: Lang = current): UI => ui[lang]
