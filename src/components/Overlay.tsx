import { useEffect, useMemo, useRef, useState } from 'react'
import { copy, projectFlags, projectShots, type Lang, type ProjectShot } from '../content'
import { buildChapters, stationProgress } from '../lib/journey'
import { clamp, smoothstep, subscribeNav } from '../lib/nav'
import { getLang, setLang, subscribeLang, ui } from '../lib/i18n'
import { onSfxChange, setSfxEnabled, sfxEnabled, chapterSfx, typeTick, uiSfx } from '../lib/sfx'
import { introActive, introStarted } from '../lib/intro'
import { setStoryOpen, subscribeStory } from '../lib/story'
import {
  disposeWater,
  initWater,
  setLens,
  setWaterEnabled,
  setWaterRoot,
} from '../lib/water'
import Liquid from './Liquid'

const pad = (n: number) => String(n).padStart(2, '0')

const LANGS: Lang[] = ['id', 'en']

// Bahasa label ala igloo.inc: judul seksi memakai awalan garis miring tebal,
// sub-blok memakai tiga garis. Disimpan sebagai konstanta supaya konsisten.
const SLASH = '////// '
const SLASH_SUB = '/// '

function jumpTo(index: number) {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo({ top: stationProgress(index) * max, behavior: 'smooth' })
}

/**
 * Galeri screenshot produk di panel Summary: satu gambar besar + strip
 * thumbnail. Gambar yang gagal dimuat dibuang dari daftar (bukan ikon rusak),
 * dan kalau semua gagal, galeri hilang tanpa mengganggu panel.
 */
function ShotGallery({
  shots,
  title,
  lang,
  galleryLabel,
}: {
  shots: ProjectShot[]
  title: string
  lang: Lang
  galleryLabel: string
}) {
  const [index, setIndex] = useState(0)
  const [dead, setDead] = useState<number[]>([])

  const alive = shots.map((_, i) => i).filter((i) => !dead.includes(i))
  if (!alive.length) return null
  const current = alive.includes(index) ? index : alive[0]
  const position = alive.indexOf(current) + 1
  const shot = shots[current]

  const fail = (i: number) => setDead((d) => (d.includes(i) ? d : [...d, i]))

  return (
    <div className="panel__shots">
      <p className="panel__sub panel__shotkicker">
        {SLASH_SUB}
        {alive.length > 1 ? `${pad(position)} / ${pad(alive.length)} — ` : ''}
        {shot.label[lang]}
      </p>

      <figure className="panel__shot">
        <img
          key={shot.src}
          src={shot.src}
          alt={`${title} — ${shot.label[lang]}`}
          loading="lazy"
          style={{ aspectRatio: shot.ratio }}
          onError={() => fail(current)}
        />
      </figure>

      {alive.length > 1 && (
        <div className="panel__thumbs" role="group" aria-label={galleryLabel}>
          {shots.map((s, i) =>
            dead.includes(i) ? null : (
              <button
                key={s.src}
                type="button"
                className={'panel__thumb' + (i === current ? ' is-on' : '')}
                aria-pressed={i === current}
                aria-label={s.label[lang]}
                onClick={() => setIndex(i)}
              >
                <img src={s.src} alt="" loading="lazy" onError={() => fail(i)} />
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

export default function Overlay() {
  const [active, setActive] = useState(0)
  const [lang, setLangState] = useState<Lang>(() => getLang())
  const [sound, setSound] = useState(() => sfxEnabled())
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [storyOpen, setStoryOpenState] = useState(false)

  const lensRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const entriesRef = useRef<
    Array<{ root: HTMLElement; inner: HTMLElement | null }>
  >([])

  useEffect(() => subscribeLang(setLangState), [])
  useEffect(() => onSfxChange(setSound), [])
  useEffect(() => subscribeStory(setStoryOpenState), [])

  // Kursor air: satu loop untuk seluruh halaman. Dimatikan saat sistem meminta
  // gerak dikurangi (nav.idle turun) — lihat lib/water.ts.
  useEffect(() => {
    initWater()
    if (lensRef.current) setLens(lensRef.current)
    return () => disposeWater()
  }, [])

  useEffect(() => {
    setWaterEnabled(!new URLSearchParams(window.location.search).has('nowater'))
  }, [])

  // Esc menutup panel (perilaku dialog yang diharapkan).
  useEffect(() => {
    if (openIdx === null && !storyOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanels()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Panel terbuka → air mengikuti teks panel; tertutup → teks bab aktif.
  // (Dijalankan setelah efek pembaca bab di bawah supaya daftar elemennya ada.)

  const openStory = () => {
    setOpenIdx(null)
    setStoryOpen(true)
    uiSfx('open')
  }

  const openSummary = (i: number) => {
    setStoryOpen(false)
    setOpenIdx(i)
    uiSfx('open')
  }

  const closePanels = () => {
    if (openIdx === null && !storyOpen) return
    setOpenIdx(null)
    setStoryOpen(false)
    uiSfx('close')
  }

  const c = copy[lang]
  const t = ui[lang]
  // Teks dibangun ulang tiap bahasa berganti; jalur kamera tidak ikut berubah.
  const chapters = useMemo(() => buildChapters(lang), [lang])
  const openShots = openIdx === null ? undefined : projectShots[openIdx]

  useEffect(() => {
    // Ambil elemen sekali, lalu tulis style langsung dari loop scroll.
    // Sengaja tidak memakai state React: 60x/detik re-render itu pemborosan,
    // dan teks jadi terasa "ketinggalan" dari kamera.
    const entries = Array.from(document.querySelectorAll<HTMLElement>('.ch')).map((root) => ({
      root,
      inner: root.querySelector<HTMLElement>('.ch__inner'),
      lines: Array.from(root.querySelectorAll<HTMLElement>('.ch__line > span')),
      extras: Array.from(root.querySelectorAll<HTMLElement>('[data-fade]')),
    }))
    entriesRef.current = entries

    const progress = document.querySelector<HTMLElement>('.progress__fill')
    const counter = document.querySelector<HTMLElement>('[data-counter]')
    const hint = document.querySelector<HTMLElement>('[data-hint]')

    let lastActive = -1

    /* ---- mengetik per karakter ---------------------------------------- */
    // Huruf dimunculkan berurutan lewat kelas .is-in; CSS yang mengurus
    // opasitasnya. Semua di satu loop frame yang sama dengan scroll, jadi
    // tidak ada re-render React per huruf.
    const noType = new URLSearchParams(window.location.search).has('notype')

    // Elemen .ch dipakai ulang antar bahasa: bersihkan sisa animasi lama.
    document.querySelectorAll<HTMLElement>('.ch.is-typing').forEach((root) => {
      root.classList.remove('is-typing')
      root.querySelectorAll<HTMLElement>('.lq-c.is-in').forEach((el) => el.classList.remove('is-in'))
    })

    type Typing = {
      index: number
      root: HTMLElement
      chars: HTMLElement[]
      delays: number[]
      start: number
      next: number
    }

    let typing: Typing | null = null
    /** bab yang sudah selesai mengetik; dikosongkan lagi saat bab pergi. */
    const done = new Set<number>()

    const stopTyping = () => {
      if (!typing) return
      typing.root.classList.remove('is-typing')
      for (let i = 0; i < typing.chars.length; i++) typing.chars[i].classList.remove('is-in')
      typing = null
    }

    const startTyping = (index: number, root: HTMLElement) => {
      const chars = Array.from(root.querySelectorAll<HTMLElement>('.lq-c'))
      if (!chars.length) return

      // Judul diketik lebih cepat (21ms/huruf) lalu jeda sejenak sebelum isi
      // (8ms/huruf) — polanya "judul dulu, lalu keterangan", seperti terminal.
      const delays: number[] = new Array(chars.length)
      let acc = 0
      let inBody = false
      for (let i = 0; i < chars.length; i++) {
        const body = !!chars[i].closest('.ch__body')
        if (body && !inBody) {
          inBody = true
          acc += 180
        }
        acc += body ? 8 : 21
        delays[i] = acc
      }

      typing = { index, root, chars, delays, start: performance.now(), next: 0 }
      root.classList.add('is-typing')
      chapterSfx(index)
    }

    return subscribeNav((s) => {
      const n = entries.length
      if (!n) return

      const seg = clamp(s.seg, 0, n - 1)

      // Selama perjalanan intro, teks disembunyikan: layar milik kamera dulu.
      // Teks muncul lagi tepat saat tiba, lalu mengetik dirinya sendiri.
      const travelling = introStarted() && introActive()

      for (let i = 0; i < n; i++) {
        const entry = entries[i]
        const distance = Math.abs(seg - i)
        const op = travelling ? 0 : 1 - smoothstep(0.3, 0.46, distance)

        if (op < 0.004) {
          if (entry.root.style.visibility !== 'hidden') {
            entry.root.style.visibility = 'hidden'
            entry.root.style.opacity = '0'
          }
          // Bab keluar dari layar: kosongkan hurufnya supaya saat pengunjung
          // kembali, deskripsi mengetik ulang dari awal.
          if (done.has(i) && typing?.index !== i) {
            done.delete(i)
            entry.root
              .querySelectorAll<HTMLElement>('.lq-c.is-in')
              .forEach((el) => el.classList.remove('is-in'))
          }
          continue
        }

        entry.root.style.visibility = 'visible'
        entry.root.style.opacity = op.toFixed(3)

        if (entry.inner) {
          entry.inner.style.transform = `translate3d(0, ${((1 - op) * 24).toFixed(2)}px, 0)`
        }

        for (let j = 0; j < entry.lines.length; j++) {
          const el = entry.lines[j]
          // Judul: cepat, jarak antar baris rapat — mata membaca satu blok.
          const oj = clamp((op - 0.03 - j * 0.055) / 0.9, 0, 1)
          el.style.transform = `translate3d(0, ${((1 - oj) * 110).toFixed(2)}%, 0)`
        }

        for (let j = 0; j < entry.extras.length; j++) {
          const el = entry.extras[j]
          // Isi + meta: sengaja lebih lambat (baru mulai setelah judul),
          // supaya mata dibimbing judul dulu, bukan disuguhi semuanya sekaligus.
          const oe = clamp((op - 0.46) / 0.54, 0, 1)
          el.style.opacity = oe.toFixed(3)
          el.style.transform = `translate3d(0, ${((1 - oe) * 18).toFixed(2)}px, 0)`
        }
      }

      if (progress) progress.style.transform = `scaleX(${s.p.toFixed(4)})`

      const index = clamp(Math.round(seg), 0, n - 1)
      if (counter) counter.textContent = pad(index + 1)
      if (hint) hint.style.opacity = clamp(1 - s.p * 24, 0, 1).toFixed(3)

      if (index !== lastActive) {
        lastActive = index
        setActive(index)
      }

      /* ---- jalankan mengetik ---------------------------------------- */

      if (typing && typing.index !== index) stopTyping()

      if (typing) {
        const elapsed = performance.now() - typing.start
        let revealed = false
        while (typing.next < typing.chars.length && typing.delays[typing.next] <= elapsed) {
          typing.chars[typing.next].classList.add('is-in')
          typing.next++
          revealed = true
        }
        // Satu tick per frame paling banyak, dan tidak semuanya berbunyi:
        // tick tiap huruf di 8ms terasa seperti hujan. Sebagian dilewati.
        if (revealed && Math.random() < 0.62) typeTick()

        if (typing.next >= typing.chars.length) {
          typing.root.classList.remove('is-typing')
          done.add(typing.index)
          typing = null
        }
      } else if (
        !noType &&
        !done.has(index) &&
        introStarted() &&
        !introActive() &&
        s.idle > 0.5 &&
        s.velocity < 0.4
      ) {
        // Mulai hanya ketika bab sudah hampir penuh di layar dan scroll sudah
        // tenang — supaya huruf tidak "berlomba" dengan kamera.
        const op = 1 - smoothstep(0.3, 0.46, Math.abs(seg - index))
        const root = entries[index]?.root
        if (op > 0.72 && root && root.style.visibility !== 'hidden') startTyping(index, root)
      }
    })
  }, [chapters])

  // Panel terbuka → air mengikuti teks panel; tertutup → teks bab aktif.
  useEffect(() => {
    if (openIdx !== null || storyOpen) {
      const id = window.setTimeout(() => setWaterRoot(sheetRef.current), 80)
      return () => window.clearTimeout(id)
    }
    setWaterRoot(entriesRef.current[active]?.inner ?? null)
  }, [openIdx, storyOpen, active, lang])

  return (
    <div className="ui">
      <button className="skip" type="button" onClick={() => jumpTo(1)}>
        {t.skip}
      </button>

      <header className="top">
        <button className="brand" type="button" onClick={() => jumpTo(0)} aria-label={t.backToStart}>
          <span className="brand__mark">{c.monogram}</span>
          <span className="brand__text">
            <strong>{c.name}</strong>
            <em>{c.role}</em>
          </span>
        </button>

        <div className="top__right">
          <nav className="nav" aria-label={t.sections}>
            <button type="button" onClick={() => jumpTo(1)}>
              {t.nav.work}
            </button>
            <button type="button" onClick={() => jumpTo(chapters.length - 2)}>
              {t.nav.approach}
            </button>
            <button type="button" onClick={() => jumpTo(chapters.length - 1)}>
              {t.nav.contact}
            </button>
          </nav>

          <button
            type="button"
            className={'sound' + (sound ? ' is-on' : '')}
            aria-pressed={sound}
            aria-label={t.sound}
            title={t.sound}
            onClick={() => setSfxEnabled(!sound)}
          >
            SFX
          </button>

          <div className="lang" role="group" aria-label={t.language}>
            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                className={code === lang ? 'is-on' : undefined}
                aria-pressed={code === lang}
                onClick={() => setLang(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="chapters">
        {chapters.map((chapter, i) => {
          const Title = chapter.kind === 'intro' ? 'h1' : 'h2'
          return (
            <article
              key={chapter.id}
              className={`ch ch--${chapter.kind}`}
              aria-hidden={i !== active}
            >
              <div className="ch__inner">
                <p className="ch__kicker" data-fade>
                  <span>{chapter.index}</span>
                  <i />
                  {SLASH}
                  {chapter.kicker}
                </p>

                <Title className="ch__title">
                  {chapter.lines.map((line, j) => (
                    <span className="ch__line" key={j}>
                      <span>
                        <Liquid text={line} />
                      </span>
                    </span>
                  ))}
                </Title>

                <div className="ch__foot">
                  <div className="ch__body" data-fade>
                    {chapter.body.split('\n\n').map((paragraph, k) => (
                      <p key={k}>
                        <Liquid text={paragraph} />
                      </p>
                    ))}

                    {chapter.kind === 'intro' && (
                      <>
                        <div className="ch__ctas">
                          <button
                            type="button"
                            className="ch__cta-btn ch__cta-btn--solid"
                            onClick={() => jumpTo(1)}
                          >
                            {t.exploreWork}
                            <span aria-hidden>↓</span>
                          </button>
                          <a className="ch__cta-btn" href={`mailto:${c.email}`}>
                            {t.contactMe}
                            <span aria-hidden>↗</span>
                          </a>
                        </div>

                        <button type="button" className="ch__summary" onClick={openStory}>
                          {SLASH_SUB}
                          {t.stoneHint}
                        </button>
                      </>
                    )}

                    {chapter.kind === 'project' && (
                      <button
                        type="button"
                        className="ch__summary"
                        onClick={() => openSummary(i - 1)}
                      >
                        {SLASH_SUB}
                        {t.openSummary}
                      </button>
                    )}

                    {chapter.cta && (
                      <a className="ch__cta" href={chapter.cta.href}>
                        {chapter.cta.label}
                        <span aria-hidden>↗</span>
                      </a>
                    )}

                    {chapter.href && (
                      <a
                        className="ch__link"
                        href={chapter.href}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {chapter.hrefLabel}
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                  </div>

                  <dl className="ch__meta" data-fade>
                    {chapter.meta.map((row) => (
                      <div className="ch__row" key={row.k + row.v}>
                        <dt>{row.k}</dt>
                        <dd>{row.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {chapter.kind === 'studio' && (
                  <div className="caps" data-fade>
                    <p className="caps__title">
                      {SLASH}
                      {t.capabilities}
                    </p>
                    <div className="caps__grid">
                      {c.capabilities.map((cap) => (
                        <div className="caps__col" key={cap.group}>
                          <h3 className="caps__group">
                            {SLASH_SUB}
                            {cap.group}
                          </h3>
                          <ul className="caps__list">
                            {cap.items.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </main>

      <nav className="rail" aria-label={t.chaptersLabel}>
        {chapters.map((chapter, i) => (
          <button
            key={chapter.id}
            type="button"
            className={`rail__item${i === active ? ' is-active' : ''}`}
            onClick={() => jumpTo(i)}
            aria-label={`${chapter.index} — ${chapter.kicker}`}
            aria-current={i === active ? 'true' : undefined}
          >
            <span className="rail__num">{chapter.index}</span>
            <span className="rail__tick" />
          </button>
        ))}
      </nav>

      <footer className="bottom">
        <div className="bottom__hint" data-hint>
          <span>{t.scroll}</span>
          <i aria-hidden />
        </div>
        <div className="bottom__status">{c.availability}</div>
        <div className="bottom__count">
          <span data-counter>01</span>
          <span className="bottom__total">/ {pad(chapters.length)}</span>
        </div>
      </footer>

      <div className="progress" aria-hidden>
        <div className="progress__fill" />
      </div>

      {openIdx !== null && c.projects[openIdx] && (
        <div
          className="panel"
          role="dialog"
          aria-modal="true"
          aria-label={`${SLASH}${t.summary}`}
        >
          <button
            type="button"
            className="panel__backdrop"
            aria-label={t.close}
            onClick={closePanels}
          />
          <div className="panel__sheet" ref={sheetRef}>
            <header className="panel__head">
              <span className="panel__kicker">
                {SLASH}
                {t.summary}
              </span>
              <button type="button" className="panel__close" onClick={closePanels}>
                {t.close} <span aria-hidden>×</span>
              </button>
            </header>

            <h2 className="panel__title">
              <Liquid text={c.projects[openIdx].title} />
            </h2>
            <p className="panel__role">{c.projects[openIdx].role}</p>
            {(projectFlags[openIdx] || c.projects[openIdx].status) && (
              <div className="panel__chips">
                {projectFlags[openIdx] && (
                  <p className="panel__flag">
                    {SLASH_SUB}
                    {t.flagship}
                  </p>
                )}
                {c.projects[openIdx].status && (
                  <p className="panel__status">{c.projects[openIdx].status}</p>
                )}
              </div>
            )}

            {openShots?.length ? (
              <ShotGallery
                shots={openShots}
                title={c.projects[openIdx].title}
                lang={lang}
                galleryLabel={t.gallery}
              />
            ) : null}

            <p className="panel__body">
              <Liquid text={c.projects[openIdx].summary} />
            </p>

            <dl className="panel__story">
              <div className="panel__row">
                <dt>
                  {SLASH_SUB}
                  {t.storyProblem}
                </dt>
                <dd>{c.projects[openIdx].story.problem}</dd>
              </div>
              <div className="panel__row">
                <dt>
                  {SLASH_SUB}
                  {t.storyBuilt}
                </dt>
                <dd>{c.projects[openIdx].story.built}</dd>
              </div>
              <div className="panel__row">
                <dt>
                  {SLASH_SUB}
                  {t.storyHow}
                </dt>
                <dd>{c.projects[openIdx].story.how}</dd>
              </div>
              {c.projects[openIdx].story.result && (
                <div className="panel__row">
                  <dt>
                    {SLASH_SUB}
                    {t.storyResult}
                  </dt>
                  <dd>{c.projects[openIdx].story.result}</dd>
                </div>
              )}
            </dl>

            <div className="panel__foot">
              <div className="panel__col">
                <span className="panel__sub">
                  {SLASH_SUB}
                  {t.discover}
                </span>
                <ul className="panel__tags">
                  {c.projects[openIdx].tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </div>
              {c.projects[openIdx].href && (
                <div className="panel__col">
                  <span className="panel__sub">
                    {SLASH_SUB}
                    {t.visit}
                  </span>
                  <a
                    className="panel__link"
                    href={c.projects[openIdx].href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {c.projects[openIdx].title} <span aria-hidden>↗</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {storyOpen && (
        <div
          className="panel panel--story"
          role="dialog"
          aria-modal="true"
          aria-label={`${SLASH}${t.manifesto}`}
        >
          <button
            type="button"
            className="panel__backdrop"
            aria-label={t.close}
            onClick={closePanels}
          />

          <div className="panel__sheet" ref={sheetRef}>
            <header className="panel__head">
              <span className="panel__kicker">
                {SLASH}
                {t.manifesto}
              </span>
              <button type="button" className="panel__close" onClick={closePanels}>
                {t.close} <span aria-hidden>×</span>
              </button>
            </header>

            <h2 className="panel__title">
              <Liquid text={c.name} />
            </h2>
            <p className="panel__role">
              {c.role} — {c.location}
            </p>

            <div className="panel__body story__body">
              <p>
                <Liquid text={c.statement} />
              </p>
              <p>
                <Liquid text={c.statementNote} />
              </p>
              <p>
                <Liquid text={c.closingNote} />
              </p>
            </div>

            <dl className="story__facts">
              {c.facts.map((fact) => (
                <div className="story__fact" key={fact.k}>
                  <dt>{fact.k}</dt>
                  <dd>{fact.v}</dd>
                </div>
              ))}
            </dl>

            <div className="story__caps">
              {c.capabilities.map((cap) => (
                <div className="story__cap" key={cap.group}>
                  <p className="panel__sub">
                    {SLASH_SUB}
                    {cap.group}
                  </p>
                  <ul className="story__list">
                    {cap.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="panel__foot">
              <div className="panel__col">
                <span className="panel__sub">
                  {SLASH_SUB}
                  {t.visit}
                </span>
                <ul className="story__links">
                  {c.links.map((link) => (
                    <li key={link.label}>
                      <a
                        className="panel__link"
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {link.label} <span aria-hidden>↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel__col">
                <span className="panel__sub">
                  {SLASH_SUB}
                  {t.nav.contact}
                </span>
                <a className="panel__link" href={`mailto:${c.email}`}>
                  {c.email} <span aria-hidden>↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* lensa air: mengikuti kursor di atas teks (lib/water.ts) */}
      <div className="lens" ref={lensRef} aria-hidden />
    </div>
  )
}
