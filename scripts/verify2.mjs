// Verifikasi putaran ini: perjalanan intro, hologram, mengetik, level audio.
// Pakai: node scripts/verify2.mjs [outdir]
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9351
const OUT = process.argv[2] || 'preview/v2'
mkdirSync(OUT, { recursive: true })

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

const shot = async (name, clip) => {
  const r = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'))
  console.log('shot', name)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })

// ---- tunggu intro mulai -------------------------------------------------
let intro = null
for (let i = 0; i < 90; i++) {
  await sleep(400)
  intro = await evalJs(`window.__intro ? window.__intro() : null`)
  if (intro && intro.active) break
}
console.log('intro start:', JSON.stringify(intro))
const t0 = Date.now()

// teks harus tersembunyi selama perjalanan
await sleep(900)
console.log(
  'text during intro:',
  await evalJs(
    `JSON.stringify([...document.querySelectorAll('.ch')].map(e => e.style.opacity + '/' + e.style.visibility))`,
  ),
)

const track = []
let shots = { early: false, mid: false, late: false }
for (let i = 0; i < 18; i++) {
  await sleep(400)
  const s = await evalJs(
    `JSON.stringify({ i: window.__intro(), c: window.__cam, a: window.__sfx() })`,
  )
  const row = { at: Date.now() - t0, ...JSON.parse(s) }
  track.push(row)
  if (!shots.early && row.i.t > 0.15) {
    shots.early = true
    await shot('intro-early')
  }
  if (!shots.mid && row.i.t > 0.5) {
    shots.mid = true
    await shot('intro-mid')
    await shot('intro-mid-crop', { x: 520, y: 120, width: 560, height: 560, scale: 1 })
  }
  if (!shots.late && row.i.t > 0.93) {
    shots.late = true
    await shot('intro-late')
  }
  if (!row.i?.active) break
}
for (const row of track) {
  console.log(
    `t=${row.at}ms intro=${row.i?.t} u=${row.i?.u} w=${row.i?.w} active=${row.i?.active} cam=(${row.c?.x.toFixed(1)},${row.c?.y.toFixed(1)},${row.c?.z.toFixed(1)}) d=${row.c?.d.toFixed(2)} rms=${row.a?.rms} air=${row.a?.air}`,
  )
}

// ---- tiba + mengetik ----------------------------------------------------
await sleep(400)
const typeStart = await evalJs(
  `JSON.stringify({
     typing: !!document.querySelector('.ch.is-typing'),
     total: document.querySelectorAll('.ch--intro .lq-c').length,
     shown: document.querySelectorAll('.ch--intro .lq-c.is-in').length,
     bodyVisible: getComputedStyle(document.querySelector('.ch--intro')).opacity
   })`,
)
console.log('typing start:', typeStart)
await shot('typed-early')

const ticks = []
for (let i = 0; i < 12; i++) {
  await sleep(300)
  ticks.push(
    JSON.parse(
      await evalJs(
        `JSON.stringify({ shown: document.querySelectorAll('.ch--intro .lq-c.is-in').length, typing: !!document.querySelector('.ch.is-typing'), rms: window.__sfx().rms })`,
      ),
    ),
  )
  if (i === 2) await shot('typed-mid')
  if (!ticks[ticks.length - 1].typing) break
}
console.log('typing curve:', ticks.map((x) => `${x.shown}${x.typing ? '' : '*'}`).join(' '))
console.log('rms saat mengetik max:', Math.max(...ticks.map((x) => x.rms)))
await shot('typed-done')

// ---- audio: diam vs scroll ---------------------------------------------
await sleep(1500)
console.log('rms idle:', await evalJs(`JSON.stringify(window.__sfx())`))

await evalJs(`window.scrollTo(0, document.documentElement.scrollHeight * 0.28)`)
const moving = []
for (let i = 0; i < 10; i++) {
  await sleep(250)
  moving.push(JSON.parse(await evalJs(`JSON.stringify(window.__sfx())`)))
}
console.log(
  'rms scroll:',
  moving.map((m) => `${m.rms} (v=${m.v}, air=${m.air})`).join(' | '),
)
console.log('rms scroll max:', Math.max(...moving.map((m) => m.rms)))

// ---- hologram: lompat ke stasiun 2, 4, 6 --------------------------------
await evalJs(`(() => {
  const n = document.querySelectorAll('.rail__item').length
  const units = n - 1 + 0.6
  window.__go = (i) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, (i / units) * max)
  }
})()`)

for (const i of [2, 4, 6]) {
  await evalJs(`window.__go(${i})`)
  await sleep(1600)
  const before = await evalJs(
    `JSON.stringify({ seg: window.__nav.seg.toFixed(2), typing: !!document.querySelector('.ch.is-typing') })`,
  )
  await sleep(2600)
  const after = await evalJs(
    `JSON.stringify({ shown: document.querySelectorAll('.ch.is-typing .lq-c.is-in').length, typing: !!document.querySelector('.ch.is-typing') })`,
  )
  console.log(`station ${i}: 1.6s=${before} 4.2s=${after}`)
  await shot(`holo-${i}`)
}

ws.close()
chrome.kill()
process.exit(0)
