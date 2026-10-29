// Tangkap layar sungguhan lewat Chrome DevTools Protocol (waktu nyata, bukan
// virtual time) supaya shader sempat terkompilasi dan preloader sempat pergi.
// Pakai: node scripts/capture.mjs [outdir] [p0,p1,...] [suffix] [WxH]
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9333
const OUT = process.argv[2] || 'preview/v9'
const shots = (process.argv[3] || '0,0.116,0.233,0.581,1').split(',').map(Number)
const SUFFIX = process.argv[4] || ''
const SIZE = process.argv[5] || '1440,900'
// arg ke-6: flag Chrome tambahan, dipisah pipa (mis. "--disable-webgl|--force-prefers-reduced-motion")
const EXTRA = (process.argv[6] || '').split('|').filter(Boolean)

mkdirSync(OUT, { recursive: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--use-angle=d3d11',
    '--enable-unsafe-swiftshader',
    `--window-size=${SIZE}`,
    '--hide-scrollbars',
    ...EXTRA,
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
    } catch {
      /* chrome belum siap */
    }
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')

// Chrome headless menolak jendela <500px; untuk ukuran ponsel pakai override
// device metrics supaya layout mobile benar-benar teruji.
const [W, H] = SIZE.split(',').map(Number)
if (W && W < 500) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: true,
  })
}

await send('Page.navigate', { url: 'http://localhost:5199/' + SUFFIX })

// shader compile + preloader benar-benar selesai (waktu nyata)
await sleep(11000)

// Tunggu penerbangan intro selesai. Kalau tidak, kamera masih di kurva intro
// dan tangkapan pertama menampilkan bab 00, bukan posisi scroll yang diminta.
// `started` baru true setelah scene siap + gerbang terbuka, jadi tunggu sampai
// penerbangan benar-benar mulai DAN selesai (scene headless bisa >11 detik).
for (let i = 0; i < 120; i++) {
  const st = await evalJs('window.__intro ? window.__intro() : null')
  if (!st) break
  if (st.started && !st.active) break
  if (!st.started && i > 60) break
  await sleep(500)
}

for (const p of shots) {
  await evalJs(`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${p})`)
  await sleep(4000)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  const name = `${OUT}/cap-${String(Math.round(p * 100)).padStart(3, '0')}.png`
  writeFileSync(name, Buffer.from(shot.result.data, 'base64'))
  const nav = await evalJs('window.__nav ? [ +window.__nav.p.toFixed(3), +window.__nav.seg.toFixed(2) ] : null')
  console.log('saved', name, 'nav', JSON.stringify(nav))
}

ws.close()
chrome.kill()
process.exit(0)
