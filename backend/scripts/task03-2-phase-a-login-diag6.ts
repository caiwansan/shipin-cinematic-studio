/**
 * 诊断6：elementFromPoint 遮挡检查 + 全事件触发 + 顶部 tab 区完整 dump
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
      console.log('RES:', res.status(), res.url().replace('https://creator.douyin.com', '').slice(0, 90), '|', body.slice(0, 150))
    }
  })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  // 顶部区域完整 dump（y 100-320, x 900-1400）——找所有 tab
  const topZone = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(e => {
      const r = e.getBoundingClientRect()
      return r.x > 900 && r.y > 100 && r.y < 330 && r.width > 20 && r.height > 10
    }).slice(0, 40).map(e => {
      const r = e.getBoundingClientRect()
      return { tag: e.tagName, cls: (e.className + '').slice(0, 50), txt: (e.textContent || '').trim().slice(0, 15), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    })
  })
  console.log('TOP_ZONE:', JSON.stringify(topZone))

  // 填手机号
  await page.evaluate((phone) => {
    const input = document.querySelector('input.yKcGN1NT') as HTMLInputElement
    if (!input) return
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    setter.call(input, phone)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
  }, PHONE)
  await page.waitForTimeout(1500)

  // elementFromPoint 检查遮挡
  const hit = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG') as HTMLElement
    if (!s) return 'NO_SPAN'
    const r = s.getBoundingClientRect()
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    const el = document.elementFromPoint(cx, cy)
    const chain = []
    let cur: HTMLElement | null = el as HTMLElement
    for (let i = 0; cur && i < 6; i++) {
      chain.push(cur.tagName + '.' + ((cur.className + '').split(' ')[0] || '') + ' pe=' + getComputedStyle(cur).pointerEvents)
      cur = cur.parentElement
    }
    return { cx: Math.round(cx), cy: Math.round(cy), hit: el ? el.tagName + '.' + ((el.className + '').split(' ')[0] || '') : 'NULL', isSpan: el === s || s.contains(el as Node), chain }
  }).catch((e: any) => 'ERR:' + e.message)
  console.log('HIT_TEST:', JSON.stringify(hit))

  // 全事件触发（span + 父 div）
  const evtRes = await page.evaluate(() => {
    const targets = [document.querySelector('span.gKXDWaPG'), document.querySelector('span.gKXDWaPG')?.closest('div')]
    let fired = 0
    for (const t of targets) {
      if (!t) continue
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'touchstart', 'touchend']) {
        try {
          t.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }))
          fired++
        } catch {}
      }
    }
    return 'EVENTS_FIRED:' + fired
  }).catch((e: any) => 'ERR:' + e.message)
  console.log(evtRes)

  await sleep(6000)
  const btnState = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG') as HTMLElement
    return { span: s ? (s.className + '|' + s.textContent) : 'GONE', hasCountdown: /重新获取|秒后|已发送/.test(document.body.innerText) }
  }).catch(() => null)
  console.log('BTN_STATE:', JSON.stringify(btnState))
  await page.screenshot({ path: SHOT('diag6-final') })
  console.log('DIAG6_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
