// Uji subjek non-planet (bongkahan/tombol atom) + batu cerita bisa diputar,
// sekaligus foto tampilan baru (meteor, cincin, studio).
// Pakai: node scripts/subjecttest.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9361
const OUT = process.argv[2] || 'preview/realism'
mkdirSync(OUT, { recursive: true })

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
const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, ...extra })
const shot = async (name) => {
  const s = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64'))
  console.log('saved', `${OUT}/${name}.png`)
}
const go = (station) =>
  ev(`(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, max * (${station} / 8.6))
  })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1&notype' })

// Meteor baru, saat warp masih berjalan.
await sleep(2300)
await shot('intro-meteors')

await sleep(10000)
console.log('nav', await ev('({ seg: __nav.seg, v: __nav.velocity })'))

// --- subjek bab 0 (bongkahan) ---
const shard = await ev(`(() => {
  const h = window.__planetHits[0]
  return { on: h.on, x: h.x, y: h.y, r: h.r }
})()`)
console.log('shard hit', shard)
if (shard?.on) {
  await mouse('mouseMoved', shard.x, shard.y)
  await sleep(900)
  console.log('shard hover', {
    cursor: await ev('document.body.style.cursor'),
    spin: await ev('window.__spins[0]'),
  })
  await shot('shard-hover')

  const before = (await ev('window.__spins[0]')).yaw
  await mouse('mousePressed', shard.x, shard.y, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(120)
  for (let i = 1; i <= 14; i++) {
    await mouse('mouseMoved', shard.x + i * 14, shard.y + Math.sin(i * 0.5) * 6, {
      button: 'left',
      buttons: 1,
    })
    await sleep(24)
  }
  const during = (await ev('window.__spins[0]')).yaw
  await shot('shard-drag')
  await mouse('mouseReleased', shard.x + 196, shard.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(900)
  console.log('shard drag', { before: +before.toFixed(3), during: +during.toFixed(3), after: +(await ev('window.__spins[0]')).yaw.toFixed(3) })
}

// --- batu cerita: drag vs klik ---
const stone = await ev('window.__stone')
console.log('stone hit', stone)
if (stone?.on) {
  await mouse('mouseMoved', stone.x, stone.y)
  await sleep(700)
  console.log('stone hover cursor', await ev('document.body.style.cursor'))
  const y0 = (await ev('window.__stoneSpin')).yaw
  await mouse('mousePressed', stone.x, stone.y, { button: 'left', buttons: 1, clickCount: 1 })
  for (let i = 1; i <= 12; i++) {
    await mouse('mouseMoved', stone.x + i * 12, stone.y, { button: 'left', buttons: 1 })
    await sleep(24)
  }
  await mouse('mouseReleased', stone.x + 144, stone.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(500)
  console.log('stone drag', {
    yawBefore: +y0.toFixed(3),
    yawAfter: +(await ev('window.__stoneSpin')).yaw.toFixed(3),
    storyOpen: await ev('window.__story()'),
  })

  await mouse('mousePressed', stone.x, stone.y, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(60)
  await mouse('mouseReleased', stone.x, stone.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(700)
  console.log('stone click opens story', await ev('window.__story()'))
  await ev('window.__story(false)')
  await sleep(500)
}

// --- cincin (bayangan planet) di bab 2 ---
await go(2)
await sleep(5200)
await shot('rings-station2')

// --- studio / "atom" di bab 7 ---
await go(7)
await sleep(8000)
console.log('studio seg', await ev('__nav.seg.toFixed(2)'))
await shot('studio-rest')
const core = await ev(`(() => {
  const h = window.__planetHits[7]
  return { on: h.on, x: h.x, y: h.y, r: h.r }
})()`)
console.log('core hit', core)
if (core?.on) {
  await mouse('mouseMoved', core.x, core.y)
  await sleep(900)
  await shot('studio-hover')

  const c0 = (await ev('window.__spins[7]')).yaw
  await mouse('mousePressed', core.x, core.y, { button: 'left', buttons: 1, clickCount: 1 })
  await sleep(120)
  for (let i = 1; i <= 12; i++) {
    await mouse('mouseMoved', core.x + i * 13, core.y + Math.sin(i * 0.4) * 5, {
      button: 'left',
      buttons: 1,
    })
    await sleep(24)
  }
  const c1 = (await ev('window.__spins[7]')).yaw
  await mouse('mouseReleased', core.x + 156, core.y, { button: 'left', buttons: 0, clickCount: 1 })
  await sleep(800)
  console.log('core drag', {
    before: +c0.toFixed(3),
    during: +c1.toFixed(3),
    after: +(await ev('window.__spins[7]')).yaw.toFixed(3),
  })
}

ws.close()
chrome.kill()
process.exit(0)
