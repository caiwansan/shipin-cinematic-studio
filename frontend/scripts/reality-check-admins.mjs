// SPRINT-REALITY-CLEANUP-01 G5 验收：director-os/aigc/admins.vue（T03）
import { spawn } from 'child_process'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const WebSocket = require('/root/shipin-cinematic-studio/backend/node_modules/ws/index.js')

const BASE = 'https://aigc.fushtn.com'
const CHROME = '/usr/bin/google-chrome'
const USER_DATA = '/tmp/chrome-reality-admin'
const PORT = 9334

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, `--user-data-dir=${USER_DATA}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)

  const tabs = await fetch(`http://localhost:${PORT}/json`).then(r => r.json())
  const tab = tabs.find(t => t.type === 'page')
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
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
  await send('Page.navigate', { url: BASE + '/director-os/aigc/login' })
  await sleep(4000)

  // admin 登录
  const login = await evalJs(`(async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      })
      const d = await res.json()
      return { ok: res.ok, token: d.token || '' }
    } catch (e) { return { ok: false, error: e.message } }
  })()`)
  if (!login?.token) {
    console.log('❌ ADMIN LOGIN FAILED:', JSON.stringify(login))
    process.exit(1)
  }
  console.log('✅ admin 登录成功')
  await evalJs(`localStorage.setItem('auth_token', '${login.token}')`)

  // 打开 admins 页面
  await send('Page.navigate', { url: BASE + '/director-os/aigc/admins' })
  await sleep(5000)

  const checks = await evalJs(`(() => {
    const text = document.body.innerText
    return {
      hasRealAdmin: text.includes('admin'),
      hasMockOperators: text.includes('operator1') || text.includes('operator2'),
      hasMockSuccess: text.includes('Mock'),
      hasErrorState: text.includes('加载失败') || text.includes('重试'),
      rowText: [...document.querySelectorAll('tr')].map(r => r.innerText.replace(/\\n/g, ' ')).slice(0, 6),
    }
  })()`)
  console.log('\n=== /director-os/aigc/admins 验收 ===')
  console.log(JSON.stringify(checks, null, 2))

  await send('Page.captureScreenshot', { format: 'png' }).then(async r => {
    const fs = await import('fs')
    fs.writeFileSync('/tmp/reality-admins.png', Buffer.from(r.data, 'base64'))
    console.log('📸 截图: /tmp/reality-admins.png')
  })

  ws.close()
  chrome.kill()
  process.exit(0)
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
