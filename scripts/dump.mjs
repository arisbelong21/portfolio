// Dump uniform material di stasiun tertentu untuk debug warna.
// Pakai: node scripts/dump.mjs <progress 0..1>
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9334
const P = Number(process.argv[2] ?? 0.233)

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--use-angle=d3d11',
    '--enable-unsafe-swiftshader',
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
  const r = await send('Runtime.evaluate', { expression, returnByValue: true })
  if (r.result?.exceptionDetails) return { exception: r.result.exceptionDetails.text }
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://localhost:5199/' })
await sleep(11000)
await evalJs(`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${P})`)
await sleep(4000)

const dump = await evalJs(`(() => {
  const rows = []
  const scene = window.__scene || null
  return window.__dumpFull ? window.__dumpFull() : 'no __dumpFull'
})()`)
console.log(typeof dump === 'string' ? dump : JSON.stringify(dump, null, 1))

ws.close()
chrome.kill()
process.exit(0)
