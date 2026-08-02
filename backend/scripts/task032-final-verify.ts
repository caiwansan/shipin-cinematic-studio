/**
 * TASK03.2 最终验证 — 工作台弹窗二维码 + 页面稳定
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
    return j.token || j.data?.token || j.accessToken || ''
  })
  await page.evaluate((t) => {
    localStorage.setItem('admin_token', t)
    localStorage.setItem('token', t)
    localStorage.setItem('auth_token', t)
  }, tokenRes)

  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const douyinCard = page.locator('.ac-card', { hasText: '抖音' }).first()
  console.log('douyin card:', await douyinCard.count())
  await douyinCard.click()
  console.log('clicked')

  // 轮询等二维码
  let found = false
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2500)
    const n = await page.locator('.ac-qr-big').count().catch(() => 0)
    const modalText = await page.locator('.ac-modal').innerText().catch(() => '')
    console.log(`[${i * 2.5}s] qr-big: ${n} | ${modalText.slice(0, 60).replace(/\n/g, ' ')}`)
    if (n > 0) { found = true; break }
  }
  console.log('QR_FOUND:', found)
  if (found) {
    const src = await page.locator('.ac-qr-big').first().getAttribute('src')
    console.log('QR src len:', src?.length ?? 0)
    await page.locator('.ac-qr-big').first().screenshot({ path: '/root/.openclaw/media/qqbot/douyin-final-qr.png' })
    console.log('QR_SAVED')
  }
  await page.screenshot({ path: '/root/.openclaw/media/qqbot/douyin-final-modal.png', fullPage: false })
  await browser.close()
  console.log('DONE')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
