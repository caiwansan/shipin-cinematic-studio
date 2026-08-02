/**
 * 诊断5：真实鼠标点击「获取验证码」SPAN 中心（完整事件链 pointerdown→mousedown→...→click）
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
      if (/send_sms|sms_code|challenge|captcha|verify/i.test(u)) {
        console.log('REQ:', req.method(), u.replace('https://creator.douyin.com', '').slice(0, 110), '|', req.postData()?.slice(0, 100) || '')
      }
    }
  })
  page.on('response', async res => {
    if (/send_sms|sms_code|challenge|captcha|verify/i.test(res.url())) {
      let body = ''
      try { body = (await res.text()).slice(0, 200) } catch {}
      console.log('RES:', res.status(), res.url().replace('https://creator.douyin.com', '').slice(0, 90), '|', body.slice(0, 150))
    }
  })

  await page.goto('https://creator.douyin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(8000)

  // 原生 setter 填手机号
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
  const val = await page.evaluate(() => (document.querySelector('input.yKcGN1NT') as HTMLInputElement)?.value || 'EMPTY').catch(() => 'ERR')
  console.log('PHONE_VALUE:', JSON.stringify(val))

  // 拿 SPAN 精确坐标
  const spanBox = await page.evaluate(() => {
    const s = document.querySelector('span.gKXDWaPG') as HTMLElement
    if (!s) return null
    const r = s.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, cls: s.className + '' }
  }).catch(() => null)
  console.log('SPAN_BOX:', JSON.stringify(spanBox))

  if (spanBox) {
    // 1) evaluate click span 自身
    const evalClick = await page.evaluate(() => {
      const s = document.querySelector('span.gKXDWaPG') as HTMLElement
      s?.click()
      return 'SPAN_CLICKED:' + !!s
    }).catch((e: any) => 'ERR:' + e.message)
    console.log(evalClick)
    await sleep(4000)
    if (!(await page.evaluate(() => document.body.innerText.includes('验证码已发送') || document.body.innerText.includes('重新获取') || document.body.innerText.includes('秒后')))) {
      // 2) 真实鼠标点击 SPAN 中心
      const cx = spanBox.x + spanBox.w / 2
      const cy = spanBox.y + spanBox.h / 2
      await page.mouse.move(cx, cy, { steps: 5 })
      await sleep(300)
      await page.mouse.down()
      await sleep(150)
      await page.mouse.up()
      console.log('MOUSE_CLICK_SPAN_CENTER:', Math.round(cx), Math.round(cy))
      await sleep(500)
      await page.mouse.click(cx, cy)
      console.log('MOUSE_CLICK_2X')
    } else {
      console.log('STATE_CHANGED_AFTER_EVAL')
    }
  }

  // 观察 10 秒
  for (let i = 0; i < 10; i++) {
    await sleep(1000)
    if (i === 2 || i === 6 || i === 9) {
      const state = await page.evaluate(() => {
        const s = document.querySelector('span.gKXDWaPG') as HTMLElement
        const all = Array.from(document.querySelectorAll('*')).filter(e => {
          const t = (e.textContent || '').trim()
          return /重新获取|秒后|已发送|发送频繁|验证码/.test(t) && t.length < 30
        }).map(e => (e.textContent || '').trim()).slice(0, 5)
        return { span: s ? (s.className + '|' + s.textContent) : 'GONE', msgs: all }
      }).catch(() => null)
      console.log('T+' + (i + 1) + 's:', JSON.stringify(state))
    }
  }
  await page.screenshot({ path: SHOT('diag5-final') })
  const text = await page.evaluate(() => (document.body?.innerText || '').replace(/\n+/g, ' | ')).catch(() => '')
  console.log('PAGE_TEXT:', text.slice(0, 400))
  console.log('DIAG5_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
