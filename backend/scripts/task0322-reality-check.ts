/**
 * TASK03.2.2 Reality Check — Channel Runtime Identity System 验收
 * G1 Identity / G2 Session / G3 Health / G4 Frontend
 * 断言脚本（浏览器生产域实测）
 */
import { chromium } from 'playwright'

const API = 'https://aigc.fushtn.com'
const results: { name: string; pass: boolean; detail?: string }[] = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(API + '/', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const tokenRes = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const j = await res.json()
    return j.token || j.data?.token || ''
  })
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t); localStorage.setItem('admin_token', t); localStorage.setItem('token', t)
  }, tokenRes)

  // ── G3 Health：runtime-health 三态接口 ──
  const health = await page.evaluate(async () => {
    const t = localStorage.getItem('auth_token') || ''
    const acc = await fetch('/api/enterprise/channels/runtime/douyin/ensure-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: '{}' }).then(r => r.json())
    const h = await fetch(`/api/enterprise/channels/runtime/${acc.data.id}/runtime-health`, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json())
    return h.data
  })
  check('G3: health 返回 browser 态', ['online', 'offline', 'degraded'].includes(health.browser), `browser=${health.browser}`)
  check('G3: health 返回 session 态', ['valid', 'invalid', 'degraded', 'unknown'].includes(health.session), `session=${health.session}`)
  check('G3: health 返回 account 态', ['connected', 'expired', 'none'].includes(health.account), `account=${health.account}`)
  check('G3: health 返回 permission 标签', typeof health.permission === 'string' && health.permission.length > 0, `permission=${health.permission}`)
  check('G3: health 返回 lastCheck 人类可读', typeof health.lastCheck === 'string', `lastCheck=${health.lastCheck}`)

  // ── G4 Frontend：账号卡片 ──
  await page.goto(API + '/workspace/media/accounts', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(7000)
  const card = page.locator('.ac-card').filter({ hasText: '抖音' }).first()
  check('G4: 抖音卡片存在', await card.count() === 1)
  check('G4: 未连接态默认显示', (await card.innerText()).includes('未连接'), 'DB 已恢复 PENDING')

  // ── 弹窗流程：二维码 + 确认卡片不误显 ──
  await card.click()
  let qrShown = false
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2500)
    if (await page.locator('.ac-qr-big').count()) { qrShown = true; break }
  }
  check('G4: 弹窗二维码显示', qrShown)
  check('G4: 未登录不误显确认卡片', await page.locator('.ac-confirm').count() === 0)
  check('G4: 未登录不误显已连接', await page.locator('.ac-modal-success').count() === 0)
  await page.locator('.ac-modal-close').click().catch(() => {})
  await page.waitForTimeout(600)

  await browser.close()

  const pass = results.filter(r => r.pass).length
  console.log(`\n===== ${pass}/${results.length} PASS =====`)
  process.exit(pass === results.length ? 0 : 1)
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
