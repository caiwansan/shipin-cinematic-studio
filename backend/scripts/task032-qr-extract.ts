/**
 * TASK03.2 — 提取登录二维码元素 → 高清放大截图
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

  // 找到二维码 img：data:image/png base64 且尺寸 ~178x178 且在登录卡片区域 (x>700)
  const qrInfo = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    const hit = imgs.find(el => {
      const r = el.getBoundingClientRect()
      const src = el.src || ''
      return src.startsWith('data:image/png') && r.width >= 140 && r.width <= 240 && r.x > 600
    })
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), src: (hit as HTMLImageElement).src }
  })

  if (!qrInfo) { console.log('QR_NOT_FOUND'); return }
  console.log('QR:', JSON.stringify({ x: qrInfo.x, y: qrInfo.y, w: qrInfo.w, h: qrInfo.h }))

  // 方式1：直接用 base64 原图（最清晰）→ 放大 4 倍
  const fs = await import('fs')
  const b64 = qrInfo.src.replace(/^data:image\/png;base64,/, '')
  const raw = Buffer.from(b64, 'base64')
  const rawPath = '/root/.openclaw/media/qqbot/douyin-qr-raw.png'
  fs.writeFileSync(rawPath, raw)
  console.log('RAW_SAVED:', rawPath, raw.length, 'bytes')

  // 方式2：元素截图（与页面渲染一致）
  const elShot = '/root/.openclaw/media/qqbot/douyin-qr-element.png'
  const els = await page.$$('img')
  for (const el of els) {
    const box = await el.boundingBox()
    if (box && Math.round(box.width) === qrInfo.w && Math.round(box.x) === qrInfo.x) {
      await el.screenshot({ path: elShot })
      console.log('ELEMENT_SHOT:', elShot)
      break
    }
  }

  // 方式3：区域裁剪（含白边，放大 4x）
  const clipShot = '/root/.openclaw/media/qqbot/douyin-qr-clip4x.png'
  const pad = 60
  await page.screenshot({
    path: clipShot,
    clip: { x: Math.max(0, qrInfo.x - pad), y: Math.max(0, qrInfo.y - pad), width: qrInfo.w + pad * 2, height: qrInfo.h + pad * 2 },
  })
  console.log('CLIP_SHOT:', clipShot)
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
