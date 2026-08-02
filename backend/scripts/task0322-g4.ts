/**
 * TASK03.2.2 E2E — G4 已连接账号卡片渲染验收
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
  await page.waitForTimeout(7000)

  const douyinCard = page.locator('.ac-card').filter({ hasText: '抖音' }).first()
  const cardText = await douyinCard.innerText()
  console.log('DOUYIN_CARD_TEXT:')
  console.log(cardText.replace(/\n/g, ' | ').slice(0, 300))
  console.log('---')
  console.log('connected class:', await douyinCard.evaluate((el) => el.className))
  console.log('bound card count:', await page.locator('.ac-bound').count())
  console.log('bound tags:', await page.locator('.ac-bound-tag').allInnerTexts())
  console.log('avatar img:', await page.locator('.ac-bound-avatar-img').count())

  await page.screenshot({ path: '/root/.openclaw/media/qqbot/task0322-g4-connected.png' })
  console.log('SHOT_SAVED')
  await browser.close()
  console.log('DONE')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
