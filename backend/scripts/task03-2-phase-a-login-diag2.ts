/**
 * 深度诊断2：监听发短信网络请求 + dump 验证码登录面板真实 DOM
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

  // 网络监听：发短信相关请求
  page.on('request', req => {
    const u = req.url()
    if (/send|sms|code|verify|captcha|passport/i.test(u)) {
      console.log('REQ:', req.method(), u.slice(0, 160), '| post:', req.postData()?.slice(0, 120) || '')
    }
  })
  page.on('response', async res => {
    const u = res.url()
    if (/send|sms|code|verify|captcha|passport/i.test(u)) {
      let body = ''
      try { body = (await res.text()).slice(0, 300) } catch {}
      console.log('RES:', res.status(), u.slice(0, 160), '| body:', body)
    }
  })
  page.on('console', msg => { if (/captcha|verify|sms|code/i.test(msg.text())) console.log('CONSOLE:', msg.text().slice(0, 200)) })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  // 切验证码登录 tab
  try { await page.getByText('验证码登录', { exact: false }).first().click({ timeout: 8000 }) } catch (e: any) { console.log('TAB_ERR:', e.message) }
  await page.waitForTimeout(2500)

  // dump 登录面板区域的所有可交互元素
  const dump = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('input, button, [role="button"], [class*="btn"], [class*="Button"], a')).filter(e => {
      const r = e.getBoundingClientRect()
      return r.width > 20 && r.height > 20
    })
    return els.map(e => {
      const r = e.getBoundingClientRect()
      return {
        tag: e.tagName, type: (e as HTMLInputElement).type || '', ph: (e as HTMLInputElement).placeholder || '',
        cls: (e.className + '').slice(0, 80), txt: (e.textContent || '').trim().slice(0, 30),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      }
    }).slice(0, 40)
  })
  console.log('DOM_DUMP:', JSON.stringify(dump, null, 0))

  // 手机号输入框
  const phoneInput = page.locator('input[placeholder*="手机号"], input[type="tel"]').first()
  await phoneInput.fill(PHONE, { timeout: 15000 })
  console.log('PHONE_FILLED')
  await page.waitForTimeout(800)

  // 找「获取验证码」元素（任意 tag）
  const targets = page.getByText('获取验证码', { exact: false })
  const n = await targets.count()
  console.log('GETCODE_TEXT_COUNT:', n)
  for (let i = 0; i < n; i++) {
    const tag = await targets.nth(i).evaluate(el => {
      const r = el.getBoundingClientRect()
      return { tag: el.tagName, cls: (el.className + '').slice(0, 80), txt: (el.textContent || '').trim().slice(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }).catch(() => null)
    console.log('GETCODE_EL[' + i + ']:', JSON.stringify(tag))
  }

  // 点击可见的那个
  let clicked = false
  for (let i = 0; i < n; i++) {
    try {
      const visible = await targets.nth(i).isVisible()
      if (visible) {
        await targets.nth(i).click({ timeout: 5000 })
        console.log('CLICKED_EL[' + i + ']')
        clicked = true
        break
      }
    } catch {}
  }
  if (!clicked) console.log('NO_CLICK')

  // 观察 12 秒：按钮倒计时 / 滑块 iframe / 网络请求
  for (let s = 0; s < 12; s++) {
    await sleep(1000)
    const btnText = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(e => (e.textContent || '').trim() === '获取验证码' || /重新获取|秒后/.test((e.textContent || '')))
      return el ? (el.textContent || '').trim().slice(0, 30) : null
    }).catch(() => null)
    const frames = page.frames().map(f => f.url().slice(0, 90)).filter(u => /verify|captcha/.test(u))
    if (s === 0 || s === 4 || s === 8 || s === 11) {
      console.log('T+' + (s + 1) + 's btnText:', btnText, '| verifyFrames:', JSON.stringify(frames))
    }
  }
  await page.screenshot({ path: SHOT('diag2-final') })
  console.log('DIAG2_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
