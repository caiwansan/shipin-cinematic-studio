// 验证昆仑茶馆聊天页：消息再多也不撑高页面 / 输入框钉在视口底部 / 消息区内部滚动
// CDP 方式（与 verify-tea-e2e.mjs 一致），用法: node scripts/verify-chat-fixed-layout.mjs
import { spawn } from 'node:child_process'

const CHROME = '/opt/google/chrome/chrome'
const BASE = 'https://aigc.fushtn.com'
const LOGIN = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' }
const PORT = 9335
const USER_DATA = '/tmp/chrome-chat-layout-check'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

// CDP 工具
let ws = null
let msgId = 0
const pending = new Map()
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evalJS(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('eval error: ' + JSON.stringify(r.exceptionDetails).slice(0, 300))
  return r.result?.value
}

// 1. 登录拿 token
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(LOGIN),
})
const token = (await loginRes.json()).accessToken
if (!token) { console.log('❌ 登录失败'); process.exit(1) }
console.log('✅ 登录成功')

// 2. 启动 headless chrome
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--user-data-dir=${USER_DATA}`, `--remote-debugging-port=${PORT}`, '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' })

async function getPageWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* chrome 还没起来 */ }
    await sleep(500)
  }
  throw new Error('chrome devtools 不可达')
}

try {
  const pageWsUrl = await getPageWs()
  ws = new WebSocket(pageWsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
    }
  }
  await cdp('Runtime.enable')
  await cdp('Page.enable')

  // 3. 先导航到站点（about:blank 不能访问 localStorage），注入 token 后再进 /chat
  await cdp('Page.navigate', { url: BASE })
  await sleep(4000)
  await evalJS(`localStorage.setItem('auth_token', ${JSON.stringify(token)}); location.href = '/chat'`)
  await sleep(6000)
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  const hasTea = await evalJS(`!!document.querySelector('.tea-page')`)
  check('页面打开（.tea-page 存在）', hasTea)

  // 4. 页面锁死视口
  const pageDim = await evalJS(`(() => {
    const el = document.querySelector('.tea-page')
    return { scrollH: el.scrollHeight, clientH: el.clientHeight, bodyScrollH: document.body.scrollHeight, bodyClientH: document.documentElement.clientHeight }
  })()`)
  check('页面锁死视口（scrollHeight ≤ clientHeight）', pageDim && pageDim.scrollH <= pageDim.clientH + 1, JSON.stringify(pageDim))

  // 5. 输入框初始在视口内
  const inputBefore = await evalJS(`(() => {
    const bar = document.querySelector('.msg-input-bar')
    if (!bar) return null
    const r = bar.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, visible: r.top >= 0 && r.bottom <= window.innerHeight }
  })()`)
  check('输入框初始钉在视口内', !!inputBefore?.visible, JSON.stringify(inputBefore))

  // 6. 灌入 300 条消息
  const msgListInfo = await evalJS(`(() => {
    const list = document.querySelector('.msg-list')
    if (!list) return null
    for (let i = 0; i < 300; i++) {
      const row = document.createElement('div')
      row.className = 'msg-row'
      row.innerHTML = '<div class="msg-bubble"><div class="msg-content">刷屏消息 #' + i + ' —— 测试聊天内容足够长以验证内部滚动不撑高页面</div></div>'
      list.appendChild(row)
    }
    return { scrollH: list.scrollHeight, clientH: list.clientHeight, scrollable: list.scrollHeight > list.clientHeight, overflowY: getComputedStyle(list).overflowY }
  })()`)
  check('消息区内部滚动（可滚动 + overflow-y:auto）', !!msgListInfo?.scrollable && msgListInfo?.overflowY === 'auto', JSON.stringify(msgListInfo))

  // 7. 刷屏后页面仍不撑高、输入框仍在视口内
  const pageAfter = await evalJS(`(() => {
    const el = document.querySelector('.tea-page')
    return { scrollH: el.scrollHeight, clientH: el.clientHeight }
  })()`)
  check('刷屏 300 条后页面仍锁死', pageAfter && pageAfter.scrollH <= pageAfter.clientH + 1, JSON.stringify(pageAfter))

  const inputAfter = await evalJS(`(() => {
    const bar = document.querySelector('.msg-input-bar')
    if (!bar) return null
    const r = bar.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight, visible: r.top >= 0 && r.bottom <= window.innerHeight }
  })()`)
  check('刷屏后输入框仍钉在视口底部', !!inputAfter?.visible, JSON.stringify(inputAfter))

  // 8. 滚动到底能看到最后一条
  const lastSeen = await evalJS(`(() => {
    const list = document.querySelector('.msg-list')
    list.scrollTop = list.scrollHeight
    const rows = list.querySelectorAll('.msg-row')
    const last = rows[rows.length - 1]
    if (!last) return false
    const lr = last.getBoundingClientRect(); const lr2 = list.getBoundingClientRect()
    return lr.bottom <= lr2.bottom + 2
  })()`)
  check('滚动到底能看到最后一条消息', lastSeen)

  // 9. 截图
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  const fs = await import('node:fs')
  fs.writeFileSync('/root/shipin-cinematic-studio/frontend/scripts/chat-fixed-layout.png', Buffer.from(shot.data, 'base64'))
  console.log('📸 截图: scripts/chat-fixed-layout.png')
} catch (e) {
  check('验证执行', false, e.message)
} finally {
  try { ws?.close() } catch {}
  chrome.kill('SIGKILL')
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
process.exit(failed.length ? 1 : 0)
