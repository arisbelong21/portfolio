// Uji audio: pola frase (dengung menyala lalu jeda) + tombol SFX benar-benar mute.
// Pakai: node scripts/audiotest.mjs
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9355
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--use-angle=d3d11',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,800',
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
    } catch {}
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
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  return r.result?.exceptionDetails ? { err: r.result.exceptionDetails.text } : r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/?autoenter=1' })

for (let i = 0; i < 80; i++) {
  await sleep(400)
  const s = await ev('window.__sfx ? window.__sfx() : null')
  if (s?.booted && s.state === 'running') break
}
console.log('boot:', await ev('JSON.stringify(window.__sfx())'))

// ---- pola frase ---------------------------------------------------------
const seq = []
for (let i = 0; i < 46; i++) {
  await sleep(500)
  const s = JSON.parse(await ev('JSON.stringify(window.__sfx())'))
  seq.push(s)
}
console.log('frase (rms tiap 0,5s):')
console.log(seq.map((s) => s.rms.toFixed(3)).join(' '))
console.log('pad gain:', seq.map((s) => s.pad.toFixed(3)).join(' '))
console.log(
  'rms menit:',
  Math.max(...seq.map((s) => s.rms)).toFixed(3),
  '| paling sunyi:',
  Math.min(...seq.map((s) => s.rms)).toFixed(3),
)

// ---- tombol SFX ---------------------------------------------------------
await ev(`document.querySelector('.sound').click()`)
await sleep(1500)
console.log('setelah OFF:', await ev('JSON.stringify(window.__sfx())'))
await sleep(2000)
console.log('OFF +2s:', await ev('JSON.stringify(window.__sfx())'))

await ev(`document.querySelector('.sound').click()`)
await sleep(2500)
console.log('setelah ON:', await ev('JSON.stringify(window.__sfx())'))
await sleep(1500)
console.log('ON +1,5s:', await ev('JSON.stringify(window.__sfx())'))

ws.close()
chrome.kill()
process.exit(0)
