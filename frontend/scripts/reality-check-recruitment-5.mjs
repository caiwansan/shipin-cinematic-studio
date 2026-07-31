// SPRINT-ADMIN-CLEANUP-02 T01 验收：求职招聘后台 5 页浏览器 Reality Check
import { spawn } from 'child_process'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const WebSocket = require('/root/shipin-cinematic-studio/backend/node_modules/ws/index.js')
const fs = await import('fs')

const BASE = 'https://aigc.fushtn.com'
const CHROME = '/usr/bin/google-chrome'
const USER_DATA = '/tmp/chrome-recruit-5'
const PORT = 9335

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
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
  await send('Page.navigate', { url: BASE + '/director-os/aigc/login' })
  await sleep(4000)
  const login = await evalJs(`(async () => {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const d = await res.json()
    return { ok: res.ok, token: d.token || '' }
  })()`)
  if (!login?.token) { console.log('❌ LOGIN FAILED:', JSON.stringify(login)); process.exit(1) }
  console.log('✅ admin 登录成功')
  await evalJs(`localStorage.setItem('auth_token', '${login.token}')`)

  const pages = [
    { name: 'index', path: '/admin/recruitment', checks: ['求职招聘管理', '求职管家 Agent 配置', '套餐订阅管理', 'AI Agent 管理', '企业用户管理', '企业套餐授权'] },
    { name: 'config', path: '/admin/recruitment/config', checks: ['职业规划顾问'] },
    { name: 'plans', path: '/admin/recruitment/plans', checks: ['HR猎头', 'AI员工'] },
    { name: 'agents', path: '/admin/recruitment/agents', checks: ['Agent'] },
    { name: 'enterprises', path: '/admin/recruitment/enterprises', checks: ['企业'] },
    { name: 'authorization', path: '/admin/recruitment/authorization', checks: ['授权'] },
  ]

  for (const p of pages) {
    await send('Page.navigate', { url: BASE + p.path })
    await sleep(4200)
    const info = await evalJs(`(() => {
      const text = document.body.innerText
      const noKeyInput = !/API Key|api_key|ApiKey/.test(document.querySelector('input, textarea') ? document.body.innerHTML : '')
      return { title: (document.title || '').slice(0, 60), hasChecks: ${JSON.stringify(p.checks)}.filter(c => text.includes(c)), missing: ${JSON.stringify(p.checks)}.filter(c => !text.includes(c)), hasApiKeyField: /API Key|ApiKey|api_key/.test(document.body.innerHTML), textLen: text.length }
    })()`)
    console.log(`\n=== /${p.path} ===`)
    console.log(JSON.stringify(info, null, 2))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(`/tmp/recruit-${p.name}.png`, Buffer.from(shot.data, 'base64'))
  }

  ws.close()
  chrome.kill()
  process.exit(0)
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
