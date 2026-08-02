/**
 * 诊断4：原生 setter 填手机号（触发 React onChange）+ 读 value + 按钮状态变化
 */
import { chromium } from 'playwright'

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

  page.on('request', req => {
    if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
      const u = req.url()
      if (/send_sms|sms_code|challenge|captcha/i.test(u)) {
        console.log('REQ:', req.method(), u.replace('https://creator.douyin.com', '').slice(0, 110), '|', req.postData()?.slice(0, 80) || '')
      }
    }
  })
  page.on('response', async res => {
    if (/send_sms|sms_code|challenge|captcha/i.test(res.url())) {
      let body = ''
      try { body = (await res.text()).slice(0, 200) } catch {}
      console.log('RES:', res.status(), res.url().replace('https://creator.douyin.com', '').slice(0, 90), '|', body.slice(0, 160))
    }
  })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  // 方式1：原生 setter + input 事件（React 受控组件标准做法）
  const setRes = await page.evaluate((phone) => {
    const input = document.querySelector('input.yKcGN1NT') as HTMLInputElement
    if (!input) return 'NO_INPUT'
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, phone)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
    return 'SETTER_DONE'
  }, PHONE)
  console.log('SETTER:', setRes)
  await page.waitForTimeout(1500)

  // 读 value
  const val = await page.evaluate(() => {
    const input = document.querySelector('input.yKcGN1NT') as HTMLInputElement
    return input ? input.value : 'NO_INPUT'
  }).catch(() => 'ERR')
  console.log('PHONE_VALUE:', JSON.stringify(val))

  // 按钮 class 前后对比
  const clsBefore = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG')
    return s ? (s.className + '') : 'NOT_FOUND'
  }).catch(() => 'ERR')
  console.log('SPAN_CLS_BEFORE:', clsBefore)

  // 方式2：也试 type 输入（清空重输）
  const phoneInput = page.locator('input.yKcGN1NT').first()
  await phoneInput.click({ timeout: 5000 }).catch(() => {})
  await phoneInput.press('Control+A').catch(() => {})
  await phoneInput.type(PHONE, { delay: 50 }).catch((e: any) => console.log('TYPE_ERR:', e.message))
  await page.waitForTimeout(1000)
  const val2 = await page.evaluate(() => {
    const input = document.querySelector('input.yKcGN1NT') as HTMLInputElement
    return input ? input.value : 'NO_INPUT'
  }).catch(() => 'ERR')
  console.log('PHONE_VALUE_AFTER_TYPE:', JSON.stringify(val2))
  const clsAfter = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG')
    return s ? (s.className + '') : 'NOT_FOUND'
  }).catch(() => 'ERR')
  console.log('SPAN_CLS_AFTER_TYPE:', clsAfter)

  // 点获取验证码
  const clickRes = await page.evaluate(() => {
    const span = document.querySelector('span.gKXDWaPG')
    const parent = span?.closest('div') as HTMLElement
    parent?.click()
    return 'CLICKED:' + !!parent
  }).catch((e: any) => 'ERR:' + e.message)
  console.log(clickRes)

  // 等 8 秒观察
  await sleep(8000)
  await page.screenshot({ path: SHOT('diag4-after-click') })
  const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ')).catch(() => '')
  console.log('PAGE_TEXT:', text.slice(0, 400))
  const frames = page.frames().map(f => f.url().slice(0, 90)).filter(u => /verify|captcha/.test(u))
  console.log('VERIFY_FRAMES:', JSON.stringify(frames))
  console.log('DIAG4_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
