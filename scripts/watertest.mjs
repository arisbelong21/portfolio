// Uji interaksi nyata lewat CDP: usap kursor di atas teks (efek air) lalu
// klik batu cerita. Menulis screenshot + angka transform ke stdout.
// Pakai: node scripts/watertest.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9341
const OUT = process.argv[2] || 'preview/w1'
const SIZE = process.argv[3] || '1440,900'
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
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })
  if (r.result?.exceptionDetails) return { error: r.result.exceptionDetails.text }
  return r.result?.result?.value
}

const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: 'none', ...extra })

const shot = async (name, clip) => {
  const s = await send('Page.captureScreenshot', {
    format: 'png',
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64'))
  console.log('saved', `${OUT}/${name}.png`)
}

const stats = () =>
  evalJs(`(() => {
    const active = Array.from(document.querySelectorAll('.ch')).find((el) => el.style.visibility !== 'hidden')
    const cs = Array.from(active.querySelectorAll('.lq-c'))
    let max = 0
    let moved = 0
    let sample = null
    for (const c of cs) {
      if (!c.style.transform) continue
      moved++
      const m = c.style.transform.match(/-?[\\d.]+px/g) || []
      const mag = Math.abs(parseFloat(m[0] || '0')) + Math.abs(parseFloat(m[1] || '0'))
      if (mag > max) {
        max = mag
        sample = c.style.transform
      }
    }
    return { moved, max: +max.toFixed(2), sample, lens: document.querySelector('.lens')?.style.opacity }
  })()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })

// shader + preloader + intro selesai
await sleep(12000)

const line = await evalJs(`(() => {
  const active = Array.from(document.querySelectorAll('.ch')).find((el) => el.style.visibility !== 'hidden')
  if (!active) return null
  const chars = Array.from(active.querySelectorAll('.ch__body .lq-c'))
  const a = chars[0]?.getBoundingClientRect()
  const b = chars[38]?.getBoundingClientRect()
  return { x0: a.left, y0: a.top + a.height / 2, x1: b.left, y1: b.top + b.height / 2, top: a.top }
})()`)
console.log('line', line)

if (line) {
  // Usap pelan sepanjang baris, lalu berhenti di tengah dan baca dorongannya.
  await mouse('mouseMoved', line.x0 - 40, line.y0)
  for (let i = 0; i <= 18; i++) {
    const x = line.x0 - 40 + ((line.x1 - line.x0 + 40) * i) / 18
    await mouse('mouseMoved', x, line.y0 + Math.sin(i * 0.7) * 6)
    await sleep(22)
  }
  await sleep(50)
  console.log('peak', await stats())

  // Bekukan supaya dorongan huruf sempat terfoto.
  await evalJs('window.__water.freeze(true)')
  await sleep(120)
  await shot('water', { x: 40, y: line.top - 40, width: 760, height: 300 })
  await evalJs('window.__water.freeze(false)')

  await mouse('mouseMoved', 760, 140)
  await sleep(1600)
  console.log('settled', await stats())
}

// Klik batu.
await sleep(400)
const stone = await evalJs('window.__stone')
console.log('stone', stone)
// Jarak bebas antara lingkaran batu dan blok paragraf (negatif = menimpa).
console.log(
  'clear',
  await evalJs(`(() => {
    const s = window.__stone
    const ch = Array.from(document.querySelectorAll('.ch')).find((el) => el.style.visibility !== 'hidden')
    if (!s || !ch) return null
    const boxes = ['.ch__kicker', '.ch__body', '.ch__line .lq-c'].flatMap((sel) =>
      Array.from(ch.querySelectorAll(sel)).map((el) => el.getBoundingClientRect()),
    )
    const free = boxes.map((r) => {
      const dx = Math.max(r.left - s.x, 0, s.x - r.right)
      const dy = Math.max(r.top - s.y, 0, s.y - r.bottom)
      return +(Math.hypot(dx, dy) - s.r).toFixed(1)
    })
    return { minFree: Math.min(...free) }
  })()`),
)
if (stone?.on) {
  await mouse('mouseMoved', stone.x, stone.y)
  await sleep(500)
  console.log('hover', {
    cursor: await evalJs('document.body.style.cursor'),
    stone: await evalJs('window.__stone'),
  })
  await shot('stone-hover')

  await mouse('mousePressed', stone.x, stone.y, { button: 'left', clickCount: 1 })
  await sleep(60)
  await mouse('mouseReleased', stone.x, stone.y, { button: 'left', clickCount: 1 })
  await sleep(900)
  console.log('storyOpen', await evalJs('window.__story()'))
  console.log(
    'panel',
    await evalJs(`(() => {
      const sheet = document.querySelector('.panel--story .panel__sheet')
      return sheet
        ? {
            title: sheet.querySelector('.panel__title')?.textContent,
            facts: sheet.querySelectorAll('.story__fact').length,
            caps: sheet.querySelectorAll('.story__cap').length,
            h: sheet.scrollHeight,
          }
        : null
    })()`),
  )
  await shot('story')

  // Usap teks di dalam panel.
  const pline = await evalJs(`(() => {
    const cs = Array.from(document.querySelectorAll('.panel--story .story__body .lq-c'))
    if (!cs.length) return null
    const r = cs[0].getBoundingClientRect()
    return { x: r.left, y: r.top + r.height / 2 }
  })()`)
  if (pline) {
    for (let i = 0; i < 18; i++) {
      await mouse('mouseMoved', pline.x + i * 11, pline.y + Math.sin(i * 0.7) * 5)
      await sleep(20)
    }
    await evalJs('window.__water.freeze(true)')
    await sleep(120)
    await shot('story-water')
    await evalJs('window.__water.freeze(false)')
  }
}

ws.close()
chrome.kill()
process.exit(0)
