// 昆仑茶馆 IM-CHA-M6 验收：青花瓷主题 / 消息头像昵称 / 红包卡片 / 抢红包弹窗
// 用法: node frontend/scripts/verify-chat-m6.mjs
import { spawn } from 'node:child_process'

const CHROME = '/opt/google/chrome/chrome'
const BASE = 'https://aigc.fushtn.com'
const LOGIN = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' }
const PORT = 9340
const USER_DATA = '/tmp/chrome-chat-m6-check'
const SHOT = '/root/shipin-cinematic-studio/docs/reality/IM-M6-REDPACKET-01.png'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

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

const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(LOGIN),
})
const token = (await loginRes.json()).accessToken
if (!token) { console.log('❌ 登录失败'); process.exit(1) }
console.log('✅ 登录成功')

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
  const pageWs = await getPageWs()
  ws = new WebSocket(pageWs)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result)
    }
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')

  // 登录态注入（localStorage token）
  await cdp('Page.navigate', { url: BASE + '/chat' })
  await sleep(3500)
  await evalJS(`localStorage.setItem('auth_token', ${JSON.stringify(token)})`)
  await cdp('Page.reload', { ignoreCache: true })
  await sleep(6000)

  // 1. 青花瓷主题
  const theme = await evalJS(`(() => {
    const page = document.querySelector('.tea-page')
    if (!page) return null
    const cs = getComputedStyle(page)
    return { bg: cs.backgroundColor, color: cs.color }
  })()`)
  check('青花瓷宣纸底', theme && theme.bg.includes('246, 241, 227'), JSON.stringify(theme))
  const watermark = await evalJS(`!!document.querySelector('.tea-page') && getComputedStyle(document.querySelector('.tea-page')).backgroundImage.includes('data:image/svg')`)
  check('青花缠枝水印', watermark === true)

  // 2. 消息列表 + 头像 + 昵称
  const rows = await evalJS(`(() => {
    const list = document.querySelectorAll('.msg-row')
    const avatars = document.querySelectorAll('.msg-avatar')
    const authors = [...document.querySelectorAll('.msg-author')].map(e => e.textContent)
    return { total: list.length, avatarCount: avatars.length, authors: authors.slice(0, 8) }
  })()`)
  check('消息渲染', rows.total > 0, `消息 ${rows.total} 条`)
  check('消息头像显示', rows.avatarCount >= rows.total, `头像 ${rows.avatarCount}/${rows.total}`)
  check('昵称显示', rows.authors.length > 0 && rows.authors.every((n) => n && n !== '未知茶客'), rows.authors.join('/'))

  // 3. 发红包 → 卡片
  const rpRes = await evalJS(`fetch('/api/im/red-packets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('auth_token') },
    body: JSON.stringify({ channelId: 'kl_public_tea', channelType: 4, totalDiamonds: 66, count: 6, mode: 'lucky', note: '青花瓷红包测试' })
  }).then(r => r.json())`)
  check('发红包 API', rpRes.success === true, JSON.stringify(rpRes.data || rpRes.error))
  const rpId = rpRes.data?.id

  await sleep(2500)
  const card = await evalJS(`(() => {
    const cards = [...document.querySelectorAll('.rp-card')]
    return cards.length ? { count: cards.length, note: cards[cards.length - 1].querySelector('.rp-card-note')?.textContent } : null
  })()`)
  check('红包卡片渲染', !!card, JSON.stringify(card))

  // 4. 点卡片 → 抢红包弹窗
  await evalJS(`window.__klOpenRedPacket(${JSON.stringify(rpId)})`)
  await sleep(2000)
  const detail = await evalJS(`(() => {
    const m = document.querySelector('.rp-detail-modal')
    if (!m) return null
    return {
      note: m.querySelector('.rp-detail-note')?.textContent,
      from: m.querySelector('.rp-detail-from')?.textContent,
      hasOpen: !!m.querySelector('.rp-open-btn'),
      grabs: m.querySelectorAll('.rp-grab-item').length,
    }
  })()`)
  check('抢红包弹窗', !!detail, JSON.stringify(detail))
  check('弹窗祝福语/来源', detail && detail.note.includes('青花瓷红包测试') && detail.from.includes('tenant'), JSON.stringify(detail))

  // 5. 截图
  await cdp('Page.captureScreenshot', { format: 'png' }).then(async (r) => {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(SHOT, Buffer.from(r.data, 'base64'))
    check('截图保存', true, SHOT)
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n===== M6 验收 ${results.length - failed.length}/${results.length} PASS =====`)
  process.exit(failed.length ? 1 : 0)
} catch (e) {
  console.error('❌ 脚本异常:', e.message)
  process.exit(2)
} finally {
  try { chrome.kill() } catch { /* ignore */ }
}
