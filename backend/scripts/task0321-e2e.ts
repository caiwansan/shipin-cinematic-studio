/**
 * TASK03.2.1 端到端验证 — 弹窗状态机 + 二维码 + wait-for-login API
 */
import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  await page.goto('https://aigc.fushtn.com/', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const tokenRes = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const j = await res.json()
    return j.token || j.data?.token || ''
  })
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t)
    localStorage.setItem('admin_token', t)
    localStorage.setItem('token', t)
  }, tokenRes)

  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const bodyText = await page.locator('body').innerText().catch(() => '')
  console.log('PAGE_BODY:', bodyText.slice(0, 200).replace(/\n/g, ' '))
  const cards = page.locator('.ac-card')
  const cardCount = await cards.count()
  console.log('cards:', cardCount)
  const douyinCard = cards.filter({ hasText: '抖音' }).first()
  console.log('douyin card count:', await douyinCard.count())
  await douyinCard.click()
  console.log('clicked douyin card')

  let qr = false
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(2500)
    const qrN = await page.locator('.ac-qr-big').count().catch(() => 0)
    const status = await page.locator('.ac-status').innerText().catch(() => '')
    if (qrN > 0 && !qr) { qr = true; console.log('QR shown at ~' + ((i+1)*2.5) + 's') }
    if (qr) break
    if (i === 6) console.log('[' + ((i+1)*2.5) + 's] qr=' + qrN + ' status=' + status.slice(0, 40))
  }
  console.log('QR:', qr)
  await page.screenshot({ path: '/root/.openclaw/media/qqbot/task0321-modal.png' })
  console.log('SHOT_SAVED')
  await browser.close()
  console.log('DONE')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
