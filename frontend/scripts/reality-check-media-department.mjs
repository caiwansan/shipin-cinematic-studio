// SPRINT-REALITY-CLEANUP-01 G5 浏览器验收：media-department 三个页面
// 用法: node scripts/reality-check-media-department.mjs
// 依赖: 系统 google-chrome + ws（backend node_modules 有）
import { spawn } from 'child_process'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const WebSocket = require('/root/shipin-cinematic-studio/backend/node_modules/ws/index.js')

const BASE = 'https://aigc.fushtn.com'
const CHROME = '/usr/bin/google-chrome'
const USER_DATA = '/tmp/chrome-reality-profile'
const PORT = 9333

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  // 1. 启动 chrome headless with CDP
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=' + PORT,
    `--user-data-dir=${USER_DATA}`,
    'about:blank',
  ], { stdio: 'ignore' })

  await sleep(2500)

  // 2. 拿 tab
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

  // 3. 先导航到站点（同源后才能 fetch 登录）
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.navigate', { url: BASE + '/?login=1' })
  await sleep(4000)

  async function evalJs(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.value
  }

  // 登录拿 token（同源 fetch）
  const loginResult = await evalJs(`(async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@scs.com', password: 'test123' })
      })
      const d = await res.json()
      return { ok: res.ok, token: d.accessToken || d.token || '', status: res.status }
    } catch (e) { return { ok: false, error: e.message } }
  })()`)

  const token = loginResult?.token
  if (!token) {
    console.log('❌ LOGIN FAILED:', JSON.stringify(loginResult))
    process.exit(1)
  }
  console.log('✅ 登录成功 token 前 20 位:', token.slice(0, 20))

  // 4. 存 token 并打开 /media-department
  await evalJs(`localStorage.setItem('auth_token', '${token}'); localStorage.setItem('token', '${token}')`)
  await send('Page.navigate', { url: BASE + '/media-department' })
  await sleep(5000)

  // 5. 断言：企业信息真实渲染
  const checks = await evalJs(`(() => {
    const text = document.body.innerText
    const planBadge = document.querySelector('.plan-badge')?.textContent?.trim() || ''
    const companyName = document.querySelector('.company-name')?.textContent?.trim() || ''
    const quickItems = [...document.querySelectorAll('.quick-item')].map(x => x.innerText.replace(/\\n/g, ' '))
    const cards = [...document.querySelectorAll('.employee-card')].map(c => c.innerText.replace(/\\n/g, ' '))
    const noAgents = !!document.querySelector('.no-agents')
    const hasFakePlan = text.includes('企业版')
    const hasFakeEmployee = text.includes('AI 运营总监') || text.includes('热点分析师')
    return {
      planBadge, companyName, quickItems, cards, noAgents,
      hasFakePlan,
      hasFakeEmployee,
      hasEmergencyStop: !!document.querySelector('.emergency-stop-btn'),
      hasFakeLoginModal: text.includes('登录功能尚未实现'),
      hasAnalyticsEntry: text.includes('查看运营数据'),
    }
  })()`)

  console.log('\n=== /media-department 验收 ===')
  console.log(JSON.stringify(checks, null, 2))

  // 截图
  await send('Page.captureScreenshot', { format: 'png' }).then(async r => {
    const fs = await import('fs')
    fs.writeFileSync('/tmp/reality-media-department.png', Buffer.from(r.data, 'base64'))
    console.log('📸 截图: /tmp/reality-media-department.png')
  })

  // 6. workspace 页
  await send('Page.navigate', { url: BASE + '/media-department/workspace' })
  await sleep(4500)
  const wsChecks = await evalJs(`(() => {
    const text = document.body.innerText
    const rows = [...document.querySelectorAll('.employee-row')].map(r => r.innerText.replace(/\\n/g, ' '))
    return {
      rows,
      hasFakeEmployee: text.includes('AI 运营总监') || text.includes('销售顾问'),
      hasPhase2Buttons: text.includes('Phase 2'),
      hasEmergencyStop: !!document.querySelector('.emergency-stop-btn'),
      hasConfigureBtn: text.includes('配置') && !text.includes('企业配置'),
    }
  })()`)
  console.log('\n=== /media-department/workspace 验收 ===')
  console.log(JSON.stringify(wsChecks, null, 2))
  await send('Page.captureScreenshot', { format: 'png' }).then(async r => {
    const fs = await import('fs')
    fs.writeFileSync('/tmp/reality-workspace.png', Buffer.from(r.data, 'base64'))
    console.log('📸 截图: /tmp/reality-workspace.png')
  })

  // 7. settings 页
  await send('Page.navigate', { url: BASE + '/media-department/settings' })
  await sleep(4500)
  const stChecks = await evalJs(`(() => {
    const text = document.body.innerText
    const planDisplay = [...document.querySelectorAll('.section-desc')].map(x => x.textContent?.trim())
    return {
      planSection: planDisplay.find(x => x && x.includes('当前套餐')) || '',
      hasFakePlan: text.includes('基础版'),
      hasPhase1Demo: text.includes('Phase 1 演示'),
      hasEmergencyStop: !!document.querySelector('.emergency-stop-btn'),
      plansGrid: !!document.querySelector('.plans-grid'),
      planCards: [...document.querySelectorAll('.plan-card')].map(c => c.innerText.replace(/\\n/g, ' ').slice(0, 60)),
    }
  })()`)
  console.log('\n=== /media-department/settings 验收 ===')
  console.log(JSON.stringify(stChecks, null, 2))
  await send('Page.captureScreenshot', { format: 'png' }).then(async r => {
    const fs = await import('fs')
    fs.writeFileSync('/tmp/reality-settings.png', Buffer.from(r.data, 'base64'))
    console.log('📸 截图: /tmp/reality-settings.png')
  })

  ws.close()
  chrome.kill()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
