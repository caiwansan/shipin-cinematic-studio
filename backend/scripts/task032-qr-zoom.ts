/**
 * TASK03.2 — 定位并放大二维码元素，单独输出高清截图
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import fs from 'fs'

const ACCOUNT_ID = process.env.ACCOUNT_ID || '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
const sessionId = `douyin:${ACCOUNT_ID}`
const profilePath = browserRuntime.getProfilePath('douyin', ACCOUNT_ID)

async function main() {
  const { context } = await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: true })
  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://creator.douyin.com/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {})
  await new Promise(r => setTimeout(r, 6000))

  // 列出所有候选元素（img/canvas）及其位置尺寸
  const candidates = await page.evaluate(() => {
    const out: any[] = []
    document.querySelectorAll('img, canvas').forEach((el, i) => {
      const r = el.getBoundingClientRect()
      const src = (el as HTMLImageElement).src || ''
      const cls = el.className || ''
      const parentCls = el.parentElement?.className || ''
      const parentText = (el.parentElement?.textContent || '').trim().slice(0, 60)
      // 过滤掉极小/极大元素
      if (r.width > 30 && r.width < 600 && r.height > 30 && r.height < 600) {
        out.push({ i, tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), src: src.slice(0, 80), cls, parentCls, parentText })
      }
    })
    return out
  })

  console.log('CANDIDATES:')
  candidates.forEach(c => console.log(JSON.stringify(c)))

  // 智能选择：优先 src 含 qr/qrcode 的 img，其次 canvas，取最大的
  let target: any = null
  const qrLike = candidates.filter(c => /qr|qrcode|login|captcha/i.test(c.src + c.cls + c.parentCls))
  if (qrLike.length) {
    qrLike.sort((a, b) => b.w * b.h - a.w * a.h)
    target = qrLike[0]
  } else if (candidates.length) {
    candidates.sort((a, b) => b.w * b.h - a.w * a.h)
    target = candidates[0]
  }

  if (!target) { console.log('NO_TARGET'); return }

  console.log('TARGET:', JSON.stringify(target))

  // 按元素截图（Playwright element screenshot 自带元素裁剪，天然高清）
  const shot = `/root/.openclaw/media/qqbot/douyin-qr-zoom-${Date.now()}.png`
  const el = (await page.$$('img, canvas'))[target.i]
  if (el) {
    await el.screenshot({ path: shot })
    console.log('ELEMENT_SHOT:', shot)
  } else {
    // 兜底：区域裁剪放大
    const clip = { x: target.x, y: target.y, width: target.w, height: target.h }
    await page.screenshot({ path: shot, clip })
    console.log('CLIP_SHOT:', shot)
  }
  fs.writeFileSync('/tmp/task032-qr-target.json', JSON.stringify({ target, shot }))
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
