// Tangkap frame di tengah intro warp + sampel RMS audio (headless, rAF jalan).
// Pakai: node scripts/introshot.mjs [outfile] [delayMs]
import { writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9337
const OUT = process.argv[2] || 'preview/intro/warp.png'
const DELAY = Number(process.argv[3] || 1200)

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--use-angle=d3d11',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1600,900',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(500)
  }
  throw new Error('chrome tidak siap')
}

const ws = new WebSocket(await getWs())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id
    pending.set(mid, res)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) return { exception: r.result.exceptionDetails.text }
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })

// tunggu intro aktif (autoenter memicu enter() begitu scene ready)
let intro = null
for (let i = 0; i < 60; i++) {
  await sleep(500)
  intro = await evalJs(`window.__intro ? window.__intro() : null`)
  if (intro && intro.active) break
}
console.log('intro saat mulai:', JSON.stringify(intro))

await sleep(DELAY)
const mid = await evalJs(`JSON.stringify({ intro: window.__intro(), sfx: window.__sfx() })`)
console.log('tengah warp:', mid)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
console.log('saved', OUT)

ws.close()
chrome.kill()
process.exit(0)
