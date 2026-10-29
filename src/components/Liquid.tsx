import { Fragment } from 'react'

/**
 * Memecah teks menjadi span per huruf supaya bisa "diaduk" oleh kursor
 * (lihat lib/water.ts). Pembungkusan kata tetap inline-block, jadi baris
 * masih patah antar-kata dan teks tidak berubah arti bagi pembaca layar.
 */
export default function Liquid({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, wi) => (
        <Fragment key={wi}>
          <span className="lq">
            {Array.from(word).map((ch, ci) => (
              <span className="lq-c" key={ci}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  )
}
