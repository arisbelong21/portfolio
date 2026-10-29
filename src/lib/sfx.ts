// ---------------------------------------------------------------------------
// Audio: suasana "menu PS2" — pad hangat yang bergerak pelan, lonceng jarang,
// angin scroll yang sangat pelan, dan tick mengetik tipis.
//
// Semua prosedural (tanpa file audio). Rantainya:
//   suara → master → kompresor → potong treble → keluar
// Kompresor + potong treble itulah yang membuat semuanya "bulat": tidak ada
// desis tajam yang menusuk, dan tidak ada puncak yang tiba-tiba keras.
//
// Audio baru hidup setelah gestur pertama user (kebijakan autoplay browser).
// ---------------------------------------------------------------------------

import { nav } from './nav'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let analyser: AnalyserNode | null = null
let rmsBuf: Uint8Array | null = null

/** angin scroll */
let airGain: GainNode | null = null
let airFilter: BiquadFilterNode | null = null
let airPan: StereoPannerNode | null = null

/** pad ambient */
let padGain: GainNode | null = null
let padFilter: BiquadFilterNode | null = null
let padOscs: OscillatorNode[] = []

/** bus efek */
let reverb: ConvolverNode | null = null
let reverbSend: GainNode | null = null

let nextPhrase = 0
let lastTick = 0
let chordIndex = -1

let enabled =
  typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('sfx')
let booted = false

const listeners = new Set<(on: boolean) => void>()

const MIN_GAIN = 0.0001
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Satu "napas" ambience: pad menyala lalu surut (tidak pernah berdengung
 *  terus), sementara melodi tetap mengalir pelan sepanjang frase. */
const PHRASE_LEN = 16.5

/** Nada progresi: Dmaj9 → Bm7 → Gmaj7 → A6/9 (hangat, tidak sendu). */
const CHORDS = [
  [73.42, 110.0, 146.83, 185.0, 277.18],
  [61.74, 92.5, 123.47, 146.83, 185.0],
  [49.0, 98.0, 123.47, 146.83, 196.0],
  [55.0, 110.0, 138.59, 164.81, 220.0],
]

/* Melodi: D mayor pentatonik (D E F# A B) — semua nadanya konson dengan
   keempat akor di atas, jadi melodinya tidak pernah "tabrak" saat akor
   berganti. Pola naik-turun yang berulang, bukan nada acak. */
const SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 493.88, 440.0, 369.99, 329.63]

/** Jarak antar nada: rapat (±1,1 detik) supaya mengalir, tidak renggang.
 *  Nada panjang (≈4,6 detik) sehingga beberapa nada saling tumpang tindih
 *  menjadi lapisan yang lembut, bukan urutan patah-patah. */
const NOTE_GAP = 1.08
const NOTE_UNTIL = 15.4

/** Tangga lima nada untuk blip pilih bab (dari G mayor, lembut). */
const PENTA = [0, 2, 4, 7, 9]

/** noise cokelat: energi di bawah, jadi "angin" bukan "desis". */
function brownNoise(ac: AudioContext, amp: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * 3)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.045) / 1.045
    data[i] = last * amp
  }
  return buf
}

/** gema pendek: noise yang meluruh — ruang kecil, bukan katedral. */
function impulse(ac: AudioContext): AudioBuffer {
  const seconds = 1.9
  const len = Math.floor(ac.sampleRate * seconds)
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 2.8)
      lp += ((Math.random() * 2 - 1) - lp) * 0.32
      data[i] = lp * env * 0.5
    }
  }
  return buf
}

function boot() {
  if (ctx || typeof window === 'undefined') return
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return

  ctx = new Ctor()
  const ac = ctx

  /* ---- rantai utama ------------------------------------------------- */
  master = ac.createGain()
  master.gain.value = enabled ? 0.65 : 0

  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.knee.value = 18
  comp.ratio.value = 3
  comp.attack.value = 0.02
  comp.release.value = 0.28

  // buang treble yang bikin "nging" di speaker laptop
  const shelf = ac.createBiquadFilter()
  shelf.type = 'highshelf'
  shelf.frequency.value = 4200
  shelf.gain.value = -4.5

  analyser = ac.createAnalyser()
  analyser.fftSize = 512
  rmsBuf = new Uint8Array(analyser.fftSize)

  master.connect(comp)
  comp.connect(shelf)
  shelf.connect(analyser)
  analyser.connect(ac.destination)

  /* ---- ruang (reverb) ----------------------------------------------- */
  // Semua jalur — pad, angin, pluck, gema — lewat `master`. Itu syarat agar
  // tombol SFX benar-benar membungkam segalanya: dulu pad dan angin menempel
  // langsung ke kompresor sehingga lolos dari mute.
  reverb = ac.createConvolver()
  reverb.buffer = impulse(ac)
  reverbSend = ac.createGain()
  reverbSend.gain.value = 0.45
  reverbSend.connect(reverb)
  reverb.connect(master)

  /* ---- pad ambient --------------------------------------------------- */
  padFilter = ac.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 900
  padFilter.Q.value = 0.4

  padGain = ac.createGain()
  padGain.gain.value = 0

  padFilter.connect(padGain)
  padGain.connect(master)
  padGain.connect(reverbSend)

  for (let i = 0; i < 5; i++) {
    const osc = ac.createOscillator()
    osc.type = i === 0 ? 'sine' : i < 3 ? 'triangle' : 'sine'
    osc.frequency.value = CHORDS[0][i]
    osc.detune.value = (i - 2) * 4

    const g = ac.createGain()
    g.gain.value = i === 0 ? 0.5 : 0.26
    osc.connect(g)
    g.connect(padFilter)
    osc.start()
    padOscs.push(osc)
  }

  // Pad menunggu frase pertama; tidak langsung menyala begitu halaman dibuka.
  nextPhrase = ac.currentTime + 1.6

  /* ---- angin scroll (sangat pelan) ----------------------------------- */
  const air = ac.createBufferSource()
  air.buffer = brownNoise(ac, 22)
  air.loop = true

  airFilter = ac.createBiquadFilter()
  airFilter.type = 'lowpass'
  airFilter.frequency.value = 320
  airFilter.Q.value = 0.15

  airGain = ac.createGain()
  airGain.gain.value = 0

  airPan = ac.createStereoPanner()
  air.connect(airFilter)
  airFilter.connect(airGain)
  airGain.connect(airPan)
  airPan.connect(master)
  airPan.connect(reverbSend)
  air.start()

  if (ac.state === 'suspended') void ac.resume()
}

/* -------------------------------------------------------------------------- */
/* Nada pendek                                                                */
/* -------------------------------------------------------------------------- */

function pluck(freq: number, gain: number, dur: number, pan = 0, wet = 0.4) {
  if (!ctx || !master || !reverbSend) return
  const ac = ctx
  const t = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const g = ac.createGain()
  g.gain.setValueAtTime(MIN_GAIN, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur)

  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2400

  const p = ac.createStereoPanner()
  p.pan.value = pan

  osc.connect(g)
  g.connect(lp)
  lp.connect(p)
  p.connect(master)
  if (reverbSend) {
    const send = ac.createGain()
    send.gain.value = wet
    p.connect(send)
    send.connect(reverbSend)
  }

  // oktaf atas yang sangat pelan → kilau, bukan nada kedua
  const shine = ac.createOscillator()
  shine.type = 'sine'
  shine.frequency.value = freq * 2.004
  const sg = ac.createGain()
  sg.gain.setValueAtTime(MIN_GAIN, t)
  sg.gain.exponentialRampToValueAtTime(gain * 0.16, t + 0.02)
  sg.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur * 0.7)
  shine.connect(sg)
  sg.connect(lp)

  osc.start(t)
  shine.start(t)
  osc.stop(t + dur + 0.05)
  shine.stop(t + dur + 0.05)
}

/**
 * Nada melodi: saudara pelan dari `pluck`. Serangan 70 ms (bukan 12 ms) dan
 * potongan nada 1500 Hz membuatnya masuk seperti kabut, bukan "ting" — itu
 * yang menjaga alunan tetap menenangkan walau nadanya rapat.
 */
function softNote(freq: number, gain: number, dur: number, pan: number, wet: number) {
  if (!ctx || !master || !reverbSend) return
  const ac = ctx
  const t = ac.currentTime

  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq

  const g = ac.createGain()
  g.gain.setValueAtTime(MIN_GAIN, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.07)
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur)

  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500

  const p = ac.createStereoPanner()
  p.pan.value = pan

  osc.connect(g)
  g.connect(lp)
  lp.connect(p)
  p.connect(master)

  const send = ac.createGain()
  send.gain.value = wet
  p.connect(send)
  send.connect(reverbSend)

  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function airSwell(gain: number, dur: number) {
  if (!ctx || !master) return
  const ac = ctx
  const t = ac.currentTime
  const src = ac.createBufferSource()
  src.buffer = brownNoise(ac, 26)

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(220, t)
  bp.frequency.exponentialRampToValueAtTime(760, t + dur * 0.75)
  bp.Q.value = 0.8

  const g = ac.createGain()
  g.gain.setValueAtTime(MIN_GAIN, t)
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.62)
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + dur)

  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  if (reverbSend) g.connect(reverbSend)
  src.start(t)
  src.stop(t + dur + 0.1)
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

export function initSfx() {
  if (booted || typeof window === 'undefined') return
  booted = true

  const start = () => {
    if (enabled) boot()
  }
  const opts: AddEventListenerOptions = { once: true, passive: true }
  window.addEventListener('pointerdown', start, opts)
  window.addEventListener('wheel', start, opts)
  window.addEventListener('keydown', start, opts)
  window.addEventListener('touchstart', start, opts)

  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__sfx = () => {
      let rms = 0
      if (analyser && rmsBuf) {
        analyser.getByteTimeDomainData(rmsBuf as Uint8Array<ArrayBuffer>)
        let sum = 0
        for (let i = 0; i < rmsBuf.length; i++) {
          const x = (rmsBuf[i] - 128) / 128
          sum += x * x
        }
        rms = Math.sqrt(sum / rmsBuf.length)
      }
      return {
        booted: !!ctx,
        enabled,
        state: ctx?.state ?? null,
        air: Number((airGain?.gain.value ?? 0).toFixed(4)),
        pad: Number((padGain?.gain.value ?? 0).toFixed(4)),
        master: Number((master?.gain.value ?? 0).toFixed(3)),
        freq: Math.round(airFilter?.frequency.value ?? 0),
        rms: Number(rms.toFixed(4)),
        v: Number(nav.velocity.toFixed(3)),
      }
    }
  }
}

export function sfxEnabled(): boolean {
  return enabled
}

export function ensureSfx() {
  if (!enabled) return
  boot()
  if (ctx?.state === 'suspended') void ctx.resume()
}

export function setSfxEnabled(value: boolean) {
  enabled = value
  if (value) {
    boot()
    if (ctx?.state === 'suspended') void ctx.resume()
    if (ctx && master) {
      master.gain.setTargetAtTime(0.65, ctx.currentTime, 0.3)
      // mulai frase baru supaya audio kembali terdengar dalam ~2 detik,
      // bukan menunggu sisa jeda frase yang mungkin masih panjang.
      nextPhrase = ctx.currentTime
    }
  } else if (ctx && master) {
    const t = ctx.currentTime
    master.gain.setTargetAtTime(0, t, 0.06)
    airGain?.gain.setTargetAtTime(0, t, 0.08)
    padGain?.gain.setTargetAtTime(MIN_GAIN, t, 0.12)
  }
  listeners.forEach((fn) => fn(value))
}

export function onSfxChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/* -------------------------------------------------------------------------- */
/* Frase ambience                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Satu frase: pad menyala perlahan, empat nada melodi turun satu per satu,
 * lalu pad surut sampai hampir hilang dan hanya gema yang tersisa. Setelah
 * itu ada jeda sunyi sebelum frase berikutnya — dengungnya tidak pernah
 * "menyala terus" seperti sebelumnya.
 */
function startPhrase(t: number) {
  if (!ctx || !padGain) return
  chordIndex = (chordIndex + 1) % CHORDS.length
  const chord = CHORDS[chordIndex]

  for (let i = 0; i < padOscs.length; i++) {
    padOscs[i].frequency.setTargetAtTime(chord[i % chord.length], t, 1.4)
  }

  padGain.gain.cancelScheduledValues(t)
  padGain.gain.setTargetAtTime(0.036, t, 1.9)
  padGain.gain.setTargetAtTime(MIN_GAIN, t + 7.2, 2.4)

  // Melodi mengalir terus: satu nada tiap ~1,1 detik, masing-masing panjang
  // (4,8 detik) sehingga tiga-empat nada saling tumpang tindih jadi lapisan
  // lembut — bukan urutan nada renggang. Menjelang akhir frase nadanya makin
  // pelan, jadi transisi ke frase berikutnya tidak terasa seperti potongan.
  let at = 0.35
  let i = 0
  while (at < NOTE_UNTIL) {
    const note = SCALE[(i + chordIndex * 2) % SCALE.length]
    const k = i
    window.setTimeout(
      () => {
        if (!ctx || !enabled) return
        const fade = 1 - 0.3 * (k / 14)
        softNote(note, 0.0125 * fade, 4.8, Math.sin(k * 1.7) * 0.3, 0.75)
      },
      at * 1000,
    )
    at += NOTE_GAP + Math.random() * 0.24
    i++
  }

  nextPhrase = t + PHRASE_LEN
}

/* -------------------------------------------------------------------------- */
/* Dipanggil dari loop scroll tiap frame                                      */
/* -------------------------------------------------------------------------- */

export function tickSfx() {
  if (!ctx || !enabled || !airGain || !airFilter || !padFilter) return
  const ac = ctx
  const t = ac.currentTime
  const v = clamp01(nav.velocity)

  // angin: puncak 0.03 (≈ -30 dBFS) — hanya bisikan saat scroll cepat.
  const target = Math.pow(v, 1.7) * 0.03
  airGain.gain.setTargetAtTime(target, t, target > 0.004 ? 0.16 : 0.5)
  airFilter.frequency.setTargetAtTime(240 + v * 560, t, 0.3)
  if (airPan) airPan.pan.setTargetAtTime(nav.x * 0.16, t, 0.4)

  // pad ikut sedikit terbuka saat bergerak: ambience terasa "bernapas"
  padFilter.frequency.setTargetAtTime(820 + v * 700, t, 0.5)

  if (t > nextPhrase) startPhrase(t)
}

/* -------------------------------------------------------------------------- */
/* Bunyi peristiwa                                                            */
/* -------------------------------------------------------------------------- */

/** Tick mengetik: klik kayu pendek, pelan, tidak menusuk. */
export function typeTick() {
  if (!ctx || !enabled || !master) return
  const ac = ctx
  const t = ac.currentTime
  // jangan pernah lebih dari ~34 tick/detik walau huruf muncul lebih cepat
  if (t - lastTick < 0.029) return
  lastTick = t

  const src = ac.createBufferSource()
  const len = Math.floor(ac.sampleRate * 0.03)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6)
  }
  src.buffer = buf

  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1500 + Math.random() * 900
  bp.Q.value = 1.1

  const g = ac.createGain()
  g.gain.value = 0.019

  const p = ac.createStereoPanner()
  p.pan.value = Math.random() * 0.5 - 0.25

  src.connect(bp)
  bp.connect(g)
  g.connect(p)
  p.connect(master)
  src.start(t)
  src.stop(t + 0.04)

  // "tok" rendah kecil: memberi bobot huruf, bukan hanya klik
  const thock = ac.createOscillator()
  thock.type = 'sine'
  thock.frequency.value = 150 + Math.random() * 50
  const tg = ac.createGain()
  tg.gain.setValueAtTime(MIN_GAIN, t)
  tg.gain.exponentialRampToValueAtTime(0.011, t + 0.006)
  tg.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 0.07)
  thock.connect(tg)
  tg.connect(p)
  thock.start(t)
  thock.stop(t + 0.09)
}

/** Blip pindah bab: dua nada lembut, seperti memilih menu. */
export function chapterSfx(index: number) {
  if (!ctx || !enabled) return
  const n = PENTA[Math.abs(index) % PENTA.length]
  const base = 392 * Math.pow(2, n / 12)
  pluck(base, 0.03, 1.1, -0.15, 0.5)
  // nada kelima masuk sedikit setelahnya — terasa "dipilih"
  setTimeout(() => {
    if (!ctx || !enabled) return
    pluck(base * 1.5, 0.018, 1.4, 0.15, 0.6)
  }, 90)
}

/** Panel dibuka/ditutup: desir halus, bukan "whoosh" tajam. */
export function uiSfx(kind: 'open' | 'close') {
  if (!ctx || !enabled) return
  airSwell(kind === 'open' ? 0.035 : 0.026, kind === 'open' ? 0.9 : 0.7)
  if (kind === 'open') pluck(523.25, 0.022, 1.2, 0, 0.6)
  else pluck(392, 0.018, 1.0, 0, 0.6)
}

let lastGrab = 0

/** Planet mulai dipegang: satu nada rendah yang menandai "terkunci". */
export function planetGrabSfx() {
  if (!ctx || !enabled) return
  const t = ctx.currentTime
  if (t - lastGrab < 0.45) return
  lastGrab = t
  pluck(196, 0.02, 0.85, 0, 0.7)
  setTimeout(() => {
    if (!ctx || !enabled) return
    pluck(293.66, 0.012, 0.7, 0.12, 0.7)
  }, 70)
}

/** Napas warp intro: naik pelan, berhenti dengan satu akor saat tiba. */
export function introSfx(duration: number) {
  if (!ctx || !enabled || !master) return
  const ac = ctx
  const t = ac.currentTime

  airSwell(0.05, duration * 0.92)

  // nada rendah yang naik: rasa "bergerak", bukan "berisik"
  const rise = ac.createOscillator()
  rise.type = 'sine'
  rise.frequency.setValueAtTime(52, t)
  rise.frequency.exponentialRampToValueAtTime(96, t + duration * 0.85)

  const rg = ac.createGain()
  rg.gain.setValueAtTime(MIN_GAIN, t)
  rg.gain.exponentialRampToValueAtTime(0.035, t + duration * 0.5)
  rg.gain.exponentialRampToValueAtTime(MIN_GAIN, t + duration * 0.95)

  rise.connect(rg)
  rg.connect(master)
  if (reverbSend) rg.connect(reverbSend)
  rise.start(t)
  rise.stop(t + duration)

  // tiba: akor lembut tepat saat kamera berhenti
  const arrival = duration * 0.82
  const notes = [146.83, 220, 293.66, 440]
  for (let i = 0; i < notes.length; i++) {
    setTimeout(
      () => {
        if (!ctx || !enabled) return
        pluck(notes[i], 0.024 / (1 + i * 0.25), 3.2, (i - 1.5) * 0.18, 0.7)
      },
      arrival * 1000 + i * 140,
    )
  }
}
