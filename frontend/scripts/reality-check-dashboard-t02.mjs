// SPRINT-ADMIN-CLEANUP-02 T02 验收：CEO 驾驶舱首屏（生态地图进第一屏）
import { spawn } from 'child_process'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const WebSocket = require('/root/shipin-cinematic-studio/backend/node_modules/ws/index.js')
const fs = await import('fs')

const BASE = 'https://aigc.fushtn.com'
const CHROME = '/usr/bin/google-chrome'
const USER_DATA = '/tmp/chrome-dashboard-t02'
const PORT = 9336

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1920,1080',
    '--remote-debugging-port=' + PORT, `--user-data-dir=${USER_DATA}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  const tabs = await fetch(`http://localhost:${PORT}/json`).then(r => r.json())
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl)
  let msgId = 0
  const pending = new Map()
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++msgId
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
  }
  ws.on('message', raw => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id)
      pending.delete(m.id)
      m.error ? reject(new Error(m.error.message)) : resolve(m.result)
    }
  })
  await new Promise(r => ws.on('open', r))
  async function evalJs(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: BASE + '/director-os/aigc/login' })
  await sleep(4000)
  const login = await evalJs(`(async () => {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const d = await res.json()
    return { token: d.token || '' }
  })()`)
  if (!login?.token) { console.log('❌ LOGIN FAILED'); process.exit(1) }
  await evalJs(`localStorage.setItem('auth_token', '${login.token}')`)

  await send('Page.navigate', { url: BASE + '/admin/dashboard' })
  await sleep(6500)

  const firstScreen = await evalJs(`(() => {
    const text = document.body.innerText
    const cards = [...document.querySelectorAll('h3')].map(h => h.innerText.trim()).filter(Boolean)
    // 首屏可见性：检查视口内元素的底部 <= 1080
    const h3s = [...document.querySelectorAll('h3')]
    const visible = h3s.filter(h => h.getBoundingClientRect().bottom <= 1080).map(h => h.innerText.trim())
    const body = document.body
    return {
      scrollHeight: body.scrollHeight,
      innerHeight: window.innerHeight,
      cards,
      firstScreenCards: visible,
      hasKpi: ['用户', '企业', '收入', 'VIP', 'AI员工'].filter(k => text.includes(k)),
      hasEcosystem: text.includes('生态地图'),
      ecoLines: ['AI 短剧', '求职招聘', 'GEO优化', '小说', '音乐制作', '电商图片'].filter(k => text.includes(k)),
      hasHealth: text.includes('系统健康') || text.includes('AI 基础设施'),
      hasEvents: text.includes('实时事件') || text.includes('LIVE'),
      hasAgentOp: text.includes('Agent 运营'),
      hasUserTrend: text.includes('用户增长'),
      hasRevenue: text.includes('商业收入') || text.includes('收入'),
    }
  })()`)
  console.log('\n=== /admin/dashboard CEO 驾驶舱首屏 ===')
  console.log(JSON.stringify(firstScreen, null, 2))

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('/tmp/dashboard-t02-first-screen.png', Buffer.from(shot.data, 'base64'))
  console.log('📸 截图: /tmp/dashboard-t02-first-screen.png')

  ws.close()
  chrome.kill()
  process.exit(0)
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
