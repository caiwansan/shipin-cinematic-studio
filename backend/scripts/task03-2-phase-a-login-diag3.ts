/**
 * 深度诊断3：完整 dump 登录区元素（含 pointer-events）+ 全部网络请求监听 + 坐标点击
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

  // 监听全部 XHR/fetch 请求（排除静态资源）
  page.on('request', req => {
    const t = req.resourceType()
    if (t === 'xhr' || t === 'fetch') {
      console.log('XHR_REQ:', req.method(), req.url().replace('https://creator.douyin.com', '').slice(0, 140))
    }
  })
  page.on('response', async res => {
    const t = res.request().resourceType()
    if (t === 'xhr' || t === 'fetch') {
      let body = ''
      try { body = (await res.text()).slice(0, 200) } catch {}
      console.log('XHR_RES:', res.status(), res.url().replace('https://creator.douyin.com', '').slice(0, 100), '|', body.slice(0, 150))
    }
  })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)

  // dump 整个登录容器（x>900 区域的元素，含隐藏的）
  const loginZone = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*')).filter(e => {
      const r = e.getBoundingClientRect()
      return r.x > 900 && r.y > 150 && r.y < 800 && r.width > 5 && r.height > 5
    })
    return els.slice(0, 60).map(e => {
      const r = e.getBoundingClientRect()
      const cs = getComputedStyle(e)
      return {
        tag: e.tagName, cls: (e.className + '').slice(0, 60), txt: (e.textContent || '').trim().slice(0, 20),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        pe: cs.pointerEvents, vis: cs.visibility, disp: cs.display,
      }
    })
  })
  console.log('LOGIN_ZONE_DUMP:')
  loginZone.forEach(e => console.log('  ', JSON.stringify(e)))

  // 切验证码登录 tab —— dump tab 区（y<400 的文本）
  const tabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(e => {
      const r = e.getBoundingClientRect()
      return r.x > 1000 && r.y > 250 && r.y < 420 && (e.textContent || '').trim().length <= 10
    }).map(e => {
      const r = e.getBoundingClientRect()
      return { tag: e.tagName, cls: (e.className + '').slice(0, 50), txt: (e.textContent || '').trim(), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
  })
  console.log('TAB_ZONE:', JSON.stringify(tabs))

  await page.screenshot({ path: SHOT('diag3-login-zone') })
  console.log('DIAG3_SHOT_SAVED')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
