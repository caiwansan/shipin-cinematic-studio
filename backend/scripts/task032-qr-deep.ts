/**
 * TASK03.2 — 深入定位二维码：扫描主文档 + iframe 内 canvas/img
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'

const ACCOUNT_ID = process.env.ACCOUNT_ID || '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
const sessionId = `douyin:${ACCOUNT_ID}`
const profilePath = browserRuntime.getProfilePath('douyin', ACCOUNT_ID)

async function main() {
  const { context } = await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: true })
  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://creator.douyin.com/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {})
  await new Promise(r => setTimeout(r, 8000))

  console.log('=== main frame ===')
  const mainInfo = await page.evaluate(() => {
    const out: any[] = []
    document.querySelectorAll('canvas, img, svg').forEach((el, i) => {
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.height < 40) return
      const src = (el as HTMLImageElement).src || ''
      out.push({ i, tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), src: src.slice(0, 90), cls: (el.className || '').toString().slice(0, 40) })
    })
    return out
  })
  mainInfo.forEach(c => console.log(JSON.stringify(c)))

  console.log('=== iframes:', page.frames().length, '===')
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    const url = frame.url().slice(0, 100)
    const info = await frame.evaluate(() => {
      const out: any[] = []
      document.querySelectorAll('canvas, img').forEach((el, i) => {
        const r = el.getBoundingClientRect()
        if (r.width < 40 || r.height < 40) return
        const src = (el as HTMLImageElement).src || ''
        out.push({ tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), src: src.slice(0, 90), cls: (el.className || '').toString().slice(0, 40) })
      })
      return out
    }).catch(() => [])
    console.log('iframe:', url, '→', JSON.stringify(info).slice(0, 400))
  }

  // 全页截图（含二维码区域）
  const shot = `/root/.openclaw/media/qqbot/douyin-loginpage-${Date.now()}.png`
  await page.screenshot({ path: shot, fullPage: true })
  console.log('FULLPAGE_SHOT:', shot)
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
