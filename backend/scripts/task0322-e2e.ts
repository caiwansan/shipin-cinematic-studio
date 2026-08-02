/**
 * TASK03.2.2 E2E — Channel Runtime Identity System 前端验收
 * G4: 已连接账号卡片（账号/头像/AI员工/权限）+ 确认绑定弹窗
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('https://aigc.fushtn.com/', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const tokenRes = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
    const j = await res.json()
    return j.token || j.data?.token || ''
  })
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t); localStorage.setItem('admin_token', t); localStorage.setItem('token', t)
  }, tokenRes)
  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  // 1. 打开抖音连接弹窗 → 验证确认卡片出现前的正常流程（未登录 → 二维码）
  await page.locator('.ac-card').filter({ hasText: '抖音' }).first().click()
  console.log('clicked douyin card')
  let qrShown = false
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(2500)
    if (await page.locator('.ac-qr-big').count()) { qrShown = true; console.log('QR shown at ~' + ((i+1)*2.5) + 's'); break }
  }
  console.log('QR:', qrShown)

  // 2. 验证确认卡片 UI 结构存在（探针未检测到登录时不应显示）
  const confirmCard = await page.locator('.ac-confirm').count()
  console.log('confirm card (should be 0 while not logged in):', confirmCard)
  const stageBar = await page.locator('.ac-stage').count()
  console.log('stage bar:', stageBar)

  await page.screenshot({ path: '/root/.openclaw/media/qqbot/task0322-modal.png' })
  console.log('SHOT_SAVED')

  // 3. 关闭弹窗，验证卡片未连接态
  await page.locator('.ac-modal-close').click().catch(() => {})
  await page.waitForTimeout(800)
  const douyinCard = page.locator('.ac-card').filter({ hasText: '抖音' }).first()
  const cardText = await douyinCard.innerText()
  console.log('DOUYIN_CARD:', cardText.replace(/\n/g, ' | ').slice(0, 200))
  await browser.close()
  console.log('DONE')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
