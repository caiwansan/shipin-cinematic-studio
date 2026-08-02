/**
 * 诊断：点「获取验证码」后页面到底发生了什么（滑块/错误提示/倒计时）
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const PHONE = '19138085989'
const SHOT = (name: string) => `/tmp/browser-sessions/phase-a-${name}.png`

async function main() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  const page = await context.newPage()
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // @ts-ignore
    window.chrome = window.chrome || { runtime: {} }
  })
  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  // 切验证码登录 tab
  try { await page.getByText('验证码登录', { exact: false }).first().click({ timeout: 8000 }) } catch {}
  await page.waitForTimeout(2000)

  // 填手机号
  const phoneInput = page.locator('input[placeholder*="手机号"], input[type="tel"]').first()
  await phoneInput.fill(PHONE, { timeout: 15000 })
  await page.waitForTimeout(500)

  // 点获取验证码
  const btn = page.getByRole('button', { name: '获取验证码' }).first()
  const beforeText = await btn.innerText().catch(() => '?')
  console.log('BTN_BEFORE:', beforeText)
  await btn.click({ timeout: 10000 }).catch((e: any) => console.log('CLICK_ERR:', e.message))
  await sleep(1000)
  const afterText = await btn.innerText().catch(() => '?')
  console.log('BTN_AFTER_1S:', afterText)
  await sleep(4000)
  const afterText2 = await btn.innerText().catch(() => '?')
  console.log('BTN_AFTER_5S:', afterText2)

  // 页面可见文本（找错误提示/toast）
  const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | '))
  console.log('PAGE_TEXT:', text.slice(0, 600))

  // iframe 检测（滑块验证通常在 iframe）
  const frames = page.frames().map(f => ({ url: f.url().slice(0, 120), name: f.name() }))
  console.log('FRAMES:', JSON.stringify(frames))

  // 弹窗/遮罩
  const dialogs = await page.$$eval('[class*="dialog"], [class*="modal"], [class*="captcha"], [class*="slide"]', els => els.map(e => e.className).slice(0, 10)).catch(() => [])
  console.log('DIALOG_CLASSES:', JSON.stringify(dialogs))

  await page.screenshot({ path: SHOT('diag-after-getcode') })
  console.log('DIAG_SHOT_SAVED')

  await sleep(30000)
  const afterText3 = await btn.innerText().catch(() => '?')
  console.log('BTN_AFTER_35S:', afterText3)
  const text2 = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ')).catch(() => '')
  console.log('PAGE_TEXT_35S:', text2.slice(0, 400))
  await page.screenshot({ path: SHOT('diag-35s') })
  console.log('DIAG_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
