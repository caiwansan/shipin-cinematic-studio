/** 最小复现：xvfb + playwright 有头 chromium 打开抖音创作者中心 */
import { chromium } from 'playwright-core'

async function main() {
  console.log('LAUNCHING...')
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })
  console.log('LAUNCHED OK')
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  })
  const page = await context.newPage()
  console.log('NAVIGATING...')
  try {
    await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    console.log('GOTO OK, url=', page.url())
    await page.waitForTimeout(6000)
  } catch (e: any) {
    console.log('GOTO FAIL:', e.message)
  }
  const title = await page.title().catch(() => 'ERR')
  const bodyText = await page.locator('body').innerText().catch(() => 'ERR')
  const imgCount = await page.locator('img').count().catch(() => -1)
  const canvasCount = await page.locator('canvas').count().catch(() => -1)
  console.log('TITLE:', title)
  console.log('BODY_TEXT:', JSON.stringify(bodyText.replace(/\n+/g, ' | ').slice(0, 300)))
  console.log('IMG_COUNT:', imgCount, 'CANVAS_COUNT:', canvasCount)
  await page.screenshot({ path: '/tmp/browser-sessions/minimal-headful.png' })
  console.log('SCREENSHOT: /tmp/browser-sessions/minimal-headful.png')
  console.log('ALIVE_CHECK...')
  await page.waitForTimeout(15000)
  console.log('STILL ALIVE after 15s')
  await browser.close()
  console.log('DONE')
}
main().catch(e => { console.error('MINIMAL_ERROR:', e.message); process.exit(1) })
