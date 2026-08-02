/**
 * TASK03.2.1 弹窗 UI 检查 — 状态机 + 二维码 + 阶段条
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
  await page.locator('.ac-card').filter({ hasText: '抖音' }).first().click()
  // 等二维码
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(2500)
    if (await page.locator('.ac-qr-big').count()) break
  }
  const modalText = await page.locator('.ac-modal').innerText().catch(() => '')
  console.log('MODAL_TEXT:', modalText.replace(/\n/g, ' | ').slice(0, 300))
  console.log('---')
  console.log('stage bar count:', await page.locator('.ac-stage').count())
  console.log('mode tabs:', await page.locator('.ac-mode-tab').allInnerTexts())
  console.log('qr-big:', await page.locator('.ac-qr-big').count())
  console.log('qr-refresh-tip:', await page.locator('.ac-qr-refresh-tip').innerText().catch(() => 'N/A'))
  await browser.close()
  console.log('DONE')
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
