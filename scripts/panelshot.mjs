// Tangkap panel "////// Summary" proyek ke-i beserta galeri gambarnya.
// Pakai: node scripts/panelshot.mjs [outdir] [indexProyek] [WxH] [indexGambar]
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334
const OUT = process.argv[2] || 'preview/panel'
const IDX = Number(process.argv[3] ?? 0)
const SIZE = process.argv[4] || '1440,900'
const SHOT = Number(process.argv[5] ?? 0)
const LANG = process.argv[6]
const BASE = process.argv[7] || 'http://localhost:5199'

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
const [PW, PH] = SIZE.split(',').map(Number)
if (PW && PW < 500) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: PW,
    height: PH,
    deviceScaleFactor: 1,
    mobile: true,
  })
}
await send('Page.navigate', {
  url: `${BASE}/?autoenter=1&notype` + (LANG ? `&lang=${LANG}` : ''),
})

await sleep(11000)

// Produksi tidak punya pintu belakang ?autoenter (hanya DEV), jadi klik
// tombol masuk seperti pengunjung sungguhan sebelum menunggu intro selesai.
await evalJs(`(() => {
  const b = document.querySelector('.enter')
  if (b) b.click()
  return !!b
})()`)

for (let i = 0; i < 120; i++) {
  const st = await evalJs('window.__intro ? window.__intro() : null')
  if (!st) break
  if (st.started && !st.active) break
  if (!st.started && i > 60) break
  await sleep(500)
}

const info = await evalJs(`(() => {
  // tombol pertama adalah petunjuk batu di bab intro, jadi proyek ke-i = tombol i+1
  const btns = Array.from(document.querySelectorAll('button.ch__summary'))
  const b = btns[${IDX} + 1]
  if (!b) return { err: 'tombol tidak ada', count: btns.length }
  b.click()
  return { count: btns.length }
})()`)
console.log('open', info)
await sleep(2500)

if (SHOT > 0) {
  const picked = await evalJs(`(() => {
    const t = document.querySelectorAll('.panel__thumb')[${SHOT}]
    if (!t) return { err: 'thumbnail tidak ada', count: document.querySelectorAll('.panel__thumb').length }
    t.click()
    return { count: document.querySelectorAll('.panel__thumb').length }
  })()`)
  console.log('thumb', picked)
  await sleep(1500)
}

const shot = await evalJs(`(() => {
  const img = document.querySelector('.panel__shot img')
  const fig = document.querySelector('.panel__shot')
  const sheet = document.querySelector('.panel__sheet')
  const thumbs = document.querySelector('.panel__thumbs')
  const body = document.querySelector('.panel__body')
  const rect = (el) => el ? { t: Math.round(el.getBoundingClientRect().top), b: Math.round(el.getBoundingClientRect().bottom), h: Math.round(el.getBoundingClientRect().height) } : null
  return {
    title: (document.querySelector('.panel__title') || {}).textContent || null,
    figure: !!fig,
    thumbs: document.querySelectorAll('.panel__thumb').length,
    counter: (document.querySelector('.panel__shotcount') || {}).textContent || null,
    kicker: (document.querySelector('.panel__shotkicker') || {}).textContent || null,
    img: img ? { src: img.getAttribute('src'), natural: img.naturalWidth + 'x' + img.naturalHeight } : null,
    rects: { sheet: rect(sheet), fig: rect(fig), thumbs: rect(thumbs), body: rect(body) },
    scroll: sheet ? { h: sheet.scrollHeight, top: Math.round(sheet.scrollTop), client: sheet.clientHeight } : null,
  }
})()`)
console.log('panel', shot)

const r = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(`${OUT}/panel-${IDX}-${SHOT}.png`, Buffer.from(r.result.data, 'base64'))
console.log(`saved ${OUT}/panel-${IDX}-${SHOT}.png`)

ws.close()
chrome.kill()
process.exit(0)
