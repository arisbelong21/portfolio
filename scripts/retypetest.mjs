// Pastikan deskripsi mengetik ulang setiap kali bab dikunjungi lagi.
// Pakai: node scripts/retypetest.mjs
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9347

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--use-angle=d3d11',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1440,900',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const l = await r.json()
      const p = l.find((t) => t.type === 'page')
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl
    } catch {
      /* belum siap */
    }
    await sleep(400)
  }
  throw new Error('no ws')
}

const ws = new WebSocket(await getWs())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id
    pending.set(mid, res)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
  return r.result?.exceptionDetails ? { err: r.result.exceptionDetails.text } : r.result?.result?.value
}

// Bab 1 = proyek pertama.
const state = () =>
  ev(`(() => {
    const ch = document.querySelectorAll('.ch')[1]
    if (!ch) return null
    return {
      seg: +__nav.seg.toFixed(2),
      vis: ch.style.visibility,
      typing: ch.classList.contains('is-typing'),
      shown: ch.querySelectorAll('.lq-c.is-in').length,
      total: ch.querySelectorAll('.lq-c').length,
    }
  })()`)

const go = (station) =>
  ev(`(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, max * (${station} / 8.6))
  })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })
await sleep(13000)

// Kunjungan pertama.
await go(1)
await sleep(1200)
console.log('visit1 start ', await state())
await sleep(7000)
console.log('visit1 done  ', await state())

// Pergi ke bab lain, lalu kembali.
await go(2)
await sleep(2600)
console.log('away         ', await state())
await go(1)
await sleep(900)
console.log('visit2 start ', await state())
await sleep(7000)
console.log('visit2 done  ', await state())

// Ulangi sekali lagi untuk memastikan polanya berulang, bukan sekali reset.
await go(3)
await sleep(2600)
await go(1)
await sleep(900)
console.log('visit3 start ', await state())
await sleep(7000)
console.log('visit3 done  ', await state())

ws.close()
chrome.kill()
process.exit(0)
