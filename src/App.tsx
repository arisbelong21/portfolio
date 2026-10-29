import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Overlay from './components/Overlay'
import { copy, type Lang } from './content'
import { chapterCount, unitsTotal } from './lib/journey'
import { getLang, subscribeLang, ui } from './lib/i18n'
import { clamp, emitNav, nav } from './lib/nav'
import { dampTo } from './lib/motion'
import { detectQuality, supportsWebGL2 } from './lib/quality'
import { ensureSfx, initSfx, introSfx, tickSfx } from './lib/sfx'
import { INTRO_DURATION, startIntro, tickIntro, warp } from './lib/intro'

// Dunia 3D dimuat terpisah: teks + preloader tampil lebih dulu,
// WebGL menyusul. Ini yang membuat first paint tetap cepat.
const JourneyCanvas = lazy(() => import('./scene/JourneyCanvas'))

// Momentum gesekan di layar sentuh jauh lebih panjang daripada satu langkah
// roda mouse: satu flick bisa melewati tiga bab. Jarak tiap bab dinaikkan di
// perangkat sentuh supaya satu gesekan hanya maju sekitar satu bab.
const PER_CHAPTER_VH =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 160 : 100

type StageKey = keyof (typeof ui)['en']['stages']

function Loader({
  progress,
  label,
  done,
  name,
}: {
  progress: number
  label: string
  done: boolean
  name: string
}) {
  return (
    <div className={`loader${done ? ' loader--done' : ''}`} aria-hidden={done}>
      <div className="loader__inner">
        <div className="loader__row">
          <span>{name}</span>
          <span>{label}</span>
        </div>
        <div className="loader__count">{String(Math.round(progress)).padStart(3, '0')}</div>
        <div className="loader__bar">
          <i style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const webgl = useMemo(() => supportsWebGL2(), [])
  const quality = useMemo(() => (webgl ? detectQuality() : null), [webgl])

  const [lang, setLangState] = useState<Lang>(() => getLang())
  const c = copy[lang]
  const t = ui[lang]

  const [reduced, setReduced] = useState(false)
  const [forceMotion, setForceMotion] = useState(() => {
    try {
      return window.localStorage.getItem('portfolio:motion') === '1'
    } catch {
      return false
    }
  })

  const enableMotion = () => {
    setForceMotion(true)
    try {
      window.localStorage.setItem('portfolio:motion', '1')
    } catch {
      /* mode privat: pilihan hanya berlaku sesi ini */
    }
  }

  const [sceneReady, setSceneReady] = useState(!webgl)
  const [progress, setProgress] = useState(8)
  const [stage, setStage] = useState<StageKey>('booting')
  const [ready, setReady] = useState(false)
  const [entered, setEntered] = useState(false)

  /* ---- bahasa: ikuti pilihan di Overlay ------------------------------ */
  useEffect(() => subscribeLang(setLangState), [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `${c.name} — ${c.role}`
  }, [lang, c.name, c.role])

  /* ---- preferensi sistem ------------------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const instant = reduced && !forceMotion

  /* ---- selalu mulai dari atas (browser suka memulihkan posisi) ------ */
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  /* ---- tahap 1: font ----------------------------------------------- */
  useEffect(() => {
    let alive = true
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts

    const done = () => {
      if (!alive) return
      setStage('type')
      setProgress((p) => Math.max(p, 46))
    }

    if (fonts?.ready) fonts.ready.then(done).catch(done)
    else done()

    return () => {
      alive = false
    }
  }, [])

  /* ---- tahap 2: scene ---------------------------------------------- */
  const onSceneReady = useCallback(() => setSceneReady(true), [])

  useEffect(() => {
    if (!sceneReady) {
      setStage(webgl ? 'scene' : 'static')
      return
    }

    setProgress((p) => Math.max(p, 88))
    setStage('ready')

    const t = window.setTimeout(() => {
      setProgress(100)
      window.setTimeout(() => setReady(true), 460)
    }, 240)

    return () => window.clearTimeout(t)
  }, [sceneReady, webgl])

  /* ---- fail-safe: tirai tidak boleh menahan user -------------------- */
  useEffect(() => {
    if (ready) return
    const t = window.setTimeout(() => {
      setProgress(100)
      setStage('ready')
      setReady(true)
    }, 8000)
    return () => window.clearTimeout(t)
  }, [ready])

  /* ---- gerbang masuk: gestur pertama = nyalakan audio + mulai perjalanan ---- */
  const entering = useRef(false)
  const enter = useCallback(() => {
    if (entering.current) return
    entering.current = true
    setEntered(true)
    // Tunggu audio siap dulu (maks 400 ms): kalau animasi dilepas saat
    // context masih suspended, wind baru berbunyi setelah warp selesai.
    void ensureSfx().then(() => {
      startIntro(instant)
      if (!instant) introSfx(INTRO_DURATION)
    })
  }, [instant])

  useEffect(() => {
    if (!ready || entered) return
    // Pintu belakang dev untuk menangkap intro tanpa gestur (screenshot/CI).
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('autoenter')) {
      enter()
      return
    }
    const opts: AddEventListenerOptions = { once: true, passive: true }
    window.addEventListener('pointerdown', enter, opts)
    window.addEventListener('wheel', enter, opts)
    window.addEventListener('keydown', enter, opts)
    return () => {
      window.removeEventListener('pointerdown', enter)
      window.removeEventListener('wheel', enter)
      window.removeEventListener('keydown', enter)
    }
  }, [ready, entered, enter])

  /* ---- peringatan placeholder (hanya saat dev) ---------------------- */
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const todo: string[] = []
    for (const [code, c] of Object.entries(copy)) {
      if (!c.email.includes('@') || c.email.includes('example.com'))
        todo.push(`[${code}] email belum diisi / masih placeholder`)
      if (c.name.trim().length < 2) todo.push(`[${code}] name belum diisi`)
      if (c.projects.length < 3) todo.push(`[${code}] project kurang dari 3`)
      if (c.links.some((l) => l.href === 'https://github.com/' || l.href === 'https://x.com/' || l.href === 'https://linkedin.com/in/'))
        todo.push(`[${code}] links masih menunjuk ke halaman kosong`)
    }
    if (todo.length) {
      console.warn('[portfolio] Isi belum final:\n- ' + todo.join('\n- ') + '\nSemua di src/content.ts')
    }
  }, [])

  /* ---- satu-satunya loop scroll ------------------------------------ */
  useEffect(() => {
    nav.idle = instant ? 0.22 : 1
    initSfx()

    let raf = 0
    let last = performance.now()
    let targetX = 0
    let targetY = 0

    // Titik tengah redam tahap pertama. Igloo memakai dua lapis (0.075 lalu
    // 0.15): lapis 1 mengejar target, lapis 2 menggerakkan visual. Hasilnya
    // akselerasi + ekor, bukan satu gerakan yang "menempel" ke scroll.
    let p1 = nav.p

    // Batas seberapa jauh target boleh mendahului visual: 1.9 bab.
    // Ini bukan peredam harian — saat scroll biasa nilainya tidak pernah
    // tersentuh. Gunanya menahan lompatan besar (klik rail, Home/End,
    // browser restore) supaya kamera tidak teleport: kecepatan maksimum
    // jadi ±0.7 progress/detik, bukan sekejap.
    const maxLead = 1.9 / unitsTotal

    const onPointer = (event: PointerEvent) => {
      targetX = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1
      targetY = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1
    }

    window.addEventListener('pointermove', onPointer, { passive: true })

    const tick = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0.001), 0.05)
      last = now

      const max = document.documentElement.scrollHeight - window.innerHeight
      const raw = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0

      if (instant) {
        nav.p = raw
        p1 = raw
        nav.velocity = 0
      } else {
        // Target dijinakkan: tidak boleh lebih dari `maxLead` di depan visual.
        // Nilai asli (`raw`) tidak diubah, jadi berapa pun jauh scroll-nya,
        // visual tetap sampai ke sana — hanya butuh beberapa frame.
        const lead = clamp(raw, nav.p - maxLead, nav.p + maxLead)

        const beforeP1 = p1
        const nextP1 = dampTo(p1, lead, 0.075, dt)
        p1 = Math.abs(lead - nextP1) < 0.00001 ? lead : nextP1

        const nextP = dampTo(nav.p, p1, 0.15, dt)
        nav.p = Math.abs(p1 - nextP) < 0.00002 ? p1 : nextP

        // Kecepatan dibaca dari tahap pertama (satu lapis lebih responsif
        // daripada visual) — ini yang menggerakkan FOV, aberasi, dan debu.
        const speed = Math.abs(p1 - beforeP1) / dt
        const targetV = clamp(speed / 0.42, 0, 1)
        nav.velocity += (targetV - nav.velocity) * (1 - Math.exp(-dt * 7))
      }

      // Intro warp: selama intro berjalan, intensitas warp mengangkat
      // nav.velocity supaya FOV/aberasi/debu/SFX ikut "melesat" tanpa scroll.
      tickIntro(dt)
      const w = warp()
      if (w > nav.velocity) nav.velocity = w
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__tick = {
          n: (((window as unknown as Record<string, unknown>).__tick as { n?: number } | undefined)
            ?.n ?? 0) + 1,
          dt: Number(dt.toFixed(4)),
          w: Number(w.toFixed(3)),
          v: Number(nav.velocity.toFixed(3)),
        }
      }

      nav.seg = clamp(nav.p * unitsTotal, 0, chapterCount - 1)
      nav.active = Math.round(nav.seg)

      const pointerFollow = 1 - Math.exp(-dt * 2.6)
      nav.x += (targetX - nav.x) * pointerFollow
      nav.y += (targetY - nav.y) * pointerFollow

      emitNav()
      tickSfx()
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [instant])

  return (
    <>
      {webgl ? (
        <Suspense fallback={null}>
          <JourneyCanvas onReady={onSceneReady} />
        </Suspense>
      ) : (
        <div className="stage stage--flat" aria-hidden />
      )}

      {/* lapisan warna sinematik: menyeimbangkan kanvas dengan tipografi */}
      <div className="grade" aria-hidden />

      {/* elemen ini yang memberi tinggi halaman; isinya tetap di posisi fixed */}
      <div
        className="track"
        style={{ height: `${unitsTotal * PER_CHAPTER_VH}vh` }}
        aria-hidden
      />

      <Overlay />

      {ready && !entered && (
        <button className="enter" type="button" onClick={enter}>
          <span className="enter__ring" aria-hidden />
          <span className="enter__label">{t.enter}</span>
        </button>
      )}

      <Loader progress={progress} label={t.stages[stage]} done={ready} name={c.name} />

      {reduced && !forceMotion && (
        <button className="motion" type="button" onClick={enableMotion}>
          {t.motion}
        </button>
      )}

      {/* kedipan pendek saat perjalanan dimulai: menutup "potongan" posisi
          kamera sebelum melesat, lalu membuka lagi saat sudah bergerak */}
      {entered && !instant && <div className="warpfade" aria-hidden />}

      {import.meta.env.DEV && quality && (
        <div className="perf">
          {quality.tier} · dpr ≤ {quality.dpr[1]} · post {quality.post ? 'on' : 'off'} ·{' '}
          {chapterCount} bab
        </div>
      )}
    </>
  )
}
