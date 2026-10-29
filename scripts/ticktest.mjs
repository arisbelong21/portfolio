// Ukur RMS saat teks mengetik: pastikan tick terdengar tapi tidak meledak.
// Pakai: node scripts/ticktest.mjs
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9351

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

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })

// Tunggu sampai pengetikan bab pembuka benar-benar jalan.
let started = false
for (let i = 0; i < 120; i++) {
  await sleep(500)
  if (await ev(`!!document.querySelector('.ch.is-typing')`)) {
    started = true
    break
  }
}
console.log('typing started:', started)

const samples = []
for (let i = 0; i < 70; i++) {
  const s = await ev(`window.__sfx ? window.__sfx().rms : null`)
  if (typeof s === 'number') samples.push(s)
  await sleep(70)
}
const max = Math.max(...samples)
const avg = samples.reduce((a, b) => a + b, 0) / Math.max(samples.length, 1)
console.log('typing rms max', +max.toFixed(4), 'avg', +avg.toFixed(4), 'n', samples.length)
console.log('sfx', await ev(`JSON.stringify(window.__sfx())`))

ws.close()
chrome.kill()
process.exit(0)
