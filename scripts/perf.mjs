// Ukur waktu muat produksi (dist) lewat Chrome DevTools Protocol.
// Pakai: node scripts/perf.mjs [url] [W,H]
import { spawn } from 'node:child_process'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9336
const URL = process.argv[2] || 'http://localhost:5210/'
const SIZE = process.argv[3] || '1440,900'

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
const problems = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === 'Runtime.exceptionThrown') {
    problems.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text))
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
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
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Page.navigate', { url: URL })
await sleep(12000)

const data = await evalJs(`(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]))
  const res = performance.getEntriesByType('resource')
  const js = res.filter(r => /\\.js($|\\?)/.test(r.name))
  const total = res.reduce((s, r) => s + (r.decodedBodySize || 0), 0)
  return JSON.stringify({
    paints,
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
    transfers: res.length,
    decodedKB: Math.round(total / 1024),
    jsDecodedKB: Math.round(js.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
    longest: res.map(r => [r.name.split('/').pop().slice(0, 40), Math.round(r.duration)]).sort((a, b) => b[1] - a[1]).slice(0, 5)
  })
})()`)

console.log(data)
console.log('problems:', problems.length ? JSON.stringify(problems.slice(0, 6)) : 'none')
console.log('htmlLang:', await evalJs('document.documentElement.lang'), '| title:', await evalJs('document.title'))
ws.close()
chrome.kill()
process.exit(0)
