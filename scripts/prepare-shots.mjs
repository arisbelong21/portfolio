// Menyiapkan aset galeri produk: perkecil ke lebar maksimum 1600 px lalu
// encode ulang ke WebP lewat canvas Chrome. Sumber tetap di tempatnya; hasil
// ditulis ke public/shots/. Pakai: node scripts/prepare-shots.mjs
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9338
const ROOT = 'C:/Users/ASROCK B650M PRO/Downloads/portfolio 3D'
const DOWNLOADS = 'C:/Users/ASROCK B650M PRO/Downloads'
const MAX_W = 1600
const QUALITY = 0.84

const jobs = [
  [`${ROOT}/public/shots/jarvis.png`, 'jarvis.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_10 AM.png`, 'jarvis-hud.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_59 AM.png`, 'jarvis-connections.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_30 AM.png`, 'jarvis-plugins.webp'],
  [`${ROOT}/public/shots/chopster.png`, 'chopster.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_49 AM.png`, 'chopster-clipper.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_54 AM.png`, 'chopster-studio.webp'],
  [`${DOWNLOADS}/ChatGPT Image Oct 30, 2026, 02_54_24 AM.png`, 'chopster-subtitles.webp'],
]

mkdirSync(`${ROOT}/preview`, { recursive: true })
writeFileSync(`${ROOT}/preview/_shotprep.html`, '<body style="margin:0"><canvas id="c"></canvas></body>')

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--allow-file-access-from-files',
    '--window-size=800,600',
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

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: `file:///${ROOT}/preview/_shotprep.html` })
await sleep(800)

for (const [src, out] of jobs) {
  const expr = `(async () => {
    const img = new Image()
    img.src = ${JSON.stringify('file:///' + src)}
    await img.decode()
    const scale = Math.min(1, ${MAX_W} / img.naturalWidth)
    const c = document.getElementById('c')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, c.width, c.height)
    return { data: c.toDataURL('image/webp', ${QUALITY}), w: c.width, h: c.height }
  })()`
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  const val = r.result?.result?.value
  if (!val?.data?.startsWith('data:image/webp')) {
    console.error('gagal', src, JSON.stringify(r.result?.exceptionDetails || r.result?.result))
    continue
  }
  const buf = Buffer.from(val.data.split(',')[1], 'base64')
  writeFileSync(`${ROOT}/public/shots/${out}`, buf)
  console.log(out, `${val.w}x${val.h}`, `${(buf.length / 1024).toFixed(0)}KB`)
}

ws.close()
chrome.kill()
process.exit(0)
