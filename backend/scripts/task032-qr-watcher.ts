/**
 * TASK03.2 — 二维码盯梢守护进程
 * 常驻浏览器，每 15s 轮询二维码 src；变化 → 提取最新码 → 保存到固定路径 + 写时间戳
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import fs from 'fs'

const ACCOUNT_ID = process.env.ACCOUNT_ID || '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
const sessionId = `douyin:${ACCOUNT_ID}`
const profilePath = browserRuntime.getProfilePath('douyin', ACCOUNT_ID)
const OUT_RAW = '/root/.openclaw/media/qqbot/douyin-qr-live.png'
const OUT_READY = '/root/.openclaw/media/qqbot/douyin-qr-ready.png'
const STATE = '/tmp/douyin-qr-state.json'

async function extractQR(page: any) {
  return page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'))
    const hit = imgs.find((el: HTMLImageElement) => {
      const r = el.getBoundingClientRect()
      return (el.src || '').startsWith('data:image/png') && r.width >= 140 && r.width <= 240 && r.x > 600
    })
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    return { src: (hit as HTMLImageElement).src, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
}

async function main() {
  const { context } = await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: true })
  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://creator.douyin.com/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {})
  await new Promise(r => setTimeout(r, 5000))

  let lastSrc = ''
  let lastSave = 0

  const saveQR = async (qr: any) => {
    const b64 = qr.src.replace(/^data:image\/png;base64,/, '')
    fs.writeFileSync(OUT_RAW, Buffer.from(b64, 'base64'))
    // 放大 + 白边
    const { execSync } = await import('child_process')
    execSync(`python3 -c "
from PIL import Image
img = Image.open('${OUT_RAW}').convert('RGB')
big = img.resize((1024,1024), Image.LANCZOS)
canvas = Image.new('RGB', (1154,1154), 'white')
canvas.paste(big, (65,65))
canvas.save('${OUT_READY}')
print('saved', canvas.size)
"`)
    lastSave = Date.now()
    fs.writeFileSync(STATE, JSON.stringify({ updatedAt: lastSave, ts: new Date().toISOString() }))
    console.log(`[QR-UPDATED] ${new Date().toISOString()} -> ${OUT_READY}`)
  }

  // 初始提取
  const first = await extractQR(page)
  if (first) { lastSrc = first.src; await saveQR(first) }

  // 轮询
  setInterval(async () => {
    try {
      const qr = await extractQR(page)
      if (!qr) return
      if (qr.src !== lastSrc) {
        lastSrc = qr.src
        await saveQR(qr)
      } else {
        // 每 30s 强制重存一次（防图片内容相同但实际已刷新的情况）
        if (Date.now() - lastSave > 30000) await saveQR(qr)
      }
    } catch (e) {
      console.error('poll err:', (e as Error).message)
    }
  }, 15000)

  console.log('WATCHER_STARTED', new Date().toISOString())
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
