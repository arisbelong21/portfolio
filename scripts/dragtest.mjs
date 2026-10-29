// Uji drag planet lewat CDP: hover → tekan → geser → lepas (inersia).
// Pakai: node scripts/dragtest.mjs [outDir] [w,h]
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9355
const OUT = process.argv[2] || 'preview/drag'
const SIZE = process.argv[3] || '1440,900'
const STATION = Number(process.argv[4] || 1)
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
      /* belum siap */
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
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text }
  return r.result?.result?.value
}

const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, ...extra })

const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64'))
  console.log('saved', `${OUT}/${name}.png`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1&notype' })
await sleep(12000)

// Tunggu penerbangan intro selesai — kalau kamera masih di kurva intro,
// proyeksi planet dihitung dari posisi yang salah dan tidak ada yang bisa
// dipegang.
for (let i = 0; i < 60; i++) {
  const st = await evalJs('window.__intro ? window.__intro() : null')
  if (!st || !st.active || st.u >= 1) break
  await sleep(500)
}

// Lompat ke stasiun yang diminta (unitsTotal = chapterCount - 1 + 0.6 = 8.6).
await evalJs(`(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo(0, max * (${STATION} / 8.6))
})()`)
await sleep(5200)
console.log('nav', await evalJs('({ seg: __nav.seg, idle: __nav.idle, v: __nav.velocity })'))

// Kecepatan scroll harus turun di bawah ambang hit-test; kadang masih
// melambat setelah 5 detik. Tunggu sampai planet benar-benar bisa dipegang.
let hit = null
for (let i = 0; i < 40; i++) {
  hit = await evalJs(`(() => {
    const hits = window.__planetHits || []
    for (let i = 0; i < hits.length; i++) {
      if (hits[i].on) return { i, ...hits[i] }
    }
    return null
  })()`)
  if (hit) break
  await sleep(400)
}
console.log('hit', hit)
if (!hit) {
  console.log('TIDAK ADA PLANET YANG BISA DIPEGANG')
  ws.close()
  chrome.kill()
  process.exit(1)
}

const yaw = () => evalJs(`window.__spins[${hit.i}]`)

// Hover dulu: kursor harus berubah dan cincin HUD menyala.
await mouse('mouseMoved', hit.x, hit.y)
await sleep(900)
console.log('hover', {
  cursor: await evalJs('document.body.style.cursor'),
  spin: await yaw(),
})
await shot('hover')

// Tekan + geser ke kanan (dua kali lintasan bolak-balik).
const before = await yaw()
await mouse('mousePressed', hit.x, hit.y, { button: 'left', buttons: 1, clickCount: 1 })
await sleep(200)
console.log('held', {
  cursor: await evalJs('document.body.style.cursor'),
  cls: await evalJs('document.body.className'),
  spin: await yaw(),
})

const startX = hit.x - 120
await mouse('mouseMoved', startX, hit.y, { button: 'left', buttons: 1 })
for (let i = 1; i <= 16; i++) {
  await mouse('mouseMoved', startX + i * 16, hit.y + Math.sin(i * 0.5) * 8, {
    button: 'left',
    buttons: 1,
  })
  await sleep(24)
}
console.log('dragged', { before: before.yaw, after: (await yaw()).yaw })
await shot('drag-mid')

const released0 = await yaw()
await mouse('mouseReleased', startX + 256, hit.y, { button: 'left', buttons: 0, clickCount: 1 })
await sleep(1100)
const released1 = await yaw()
console.log('release', {
  atRelease: +released0.yaw.toFixed(3),
  after1100ms: +released1.yaw.toFixed(3),
  vel: +released0.vel.toFixed(3),
  cursor: await evalJs('document.body.style.cursor'),
  cls: await evalJs('document.body.className'),
})
await shot('drag-after')

// Pastikan planet tetap berputar sendiri setelah tenang.
await sleep(2500)
console.log('ambient', {
  yaw: +(await yaw()).yaw.toFixed(3),
  seg: await evalJs('__nav.seg'),
})

ws.close()
chrome.kill()
process.exit(0)
