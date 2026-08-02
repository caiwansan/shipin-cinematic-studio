/**
 * TASK03.2 — 工作台渠道中心实测 v2：长等待 + 轮询检测二维码出现
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
  console.log('admin token:', tokenRes ? 'OK' : 'NONE')

  await page.evaluate((t) => {
    localStorage.setItem('admin_token', t)
    localStorage.setItem('token', t)
    localStorage.setItem('auth_token', t)
  }, tokenRes)

  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { timeout: 45000, waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)

  const douyinCard = page.locator('.ac-card', { hasText: '抖音' }).first()
  console.log('douyin card found:', await douyinCard.count())
  if (await douyinCard.count() === 0) {
    await page.screenshot({ path: '/root/.openclaw/media/qqbot/douyin-workbench-nocard.png', fullPage: true })
    console.log('NO_CARD — saved'); await browser.close(); return
  }

  await douyinCard.click()
  console.log('clicked, waiting for browser launch + qr...')

  // 轮询最多 60s：等 .ac-qr-big 出现
  let found = false
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(2500)
    const n = await page.locator('.ac-qr-big').count().catch(() => 0)
    const modalText = await page.locator('.ac-modal').innerText().catch(() => '')
    const snippet = modalText.slice(0, 80).replace(/\n/g, ' | ')
    console.log(`[${i * 2.5}s] qr-big: ${n} | modal: ${snippet}`)
    if (n > 0) { found = true; break }
    // 登录成功也会退出
    if (modalText.includes('连接成功')) { found = true; console.log('ALREADY CONNECTED'); break }
  }

  if (found) {
    const qrImg = page.locator('.ac-qr-big').first()
    const src = await qrImg.getAttribute('src')
    console.log('QR src length:', src?.length ?? 0)
    await qrImg.screenshot({ path: '/root/.openclaw/media/qqbot/douyin-workbench-qr.png' })
    console.log('QR_SAVED')
  }
  await page.screenshot({ path: '/root/.openclaw/media/qqbot/douyin-workbench-modal.png', fullPage: false })
  console.log('MODAL_SHOT_SAVED')

  await browser.close()
  console.log('DONE')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
