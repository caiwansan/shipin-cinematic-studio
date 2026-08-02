/**
 * TASK03.2 Phase A 辅助 — 真实扫码登录引导
 * 启动持久化浏览器 → 打开抖音创作者中心 → 截图二维码/登录界面
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'
import { channelService } from '../src/services/enterprise/channel.service.js'
import fs from 'fs'

const ACCOUNT_ID = process.env.ACCOUNT_ID || '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
const OUT_DIR = process.env.OUT_DIR || '/root/.openclaw/media/qqbot'
const SHOT = `${OUT_DIR}/douyin-qr-${Date.now()}.png`

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const profilePath = browserRuntime.getProfilePath('douyin', ACCOUNT_ID)
  console.log('profile:', profilePath, 'exists:', fs.existsSync(profilePath))

  const sessionId = `douyin:${ACCOUNT_ID}`
  const { context } = await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: true })
  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://creator.douyin.com/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(e => console.log('goto warn:', e.message))
  await new Promise(r => setTimeout(r, 8000))

  const url = page.url()
  console.log('url:', url)

  // 判断登录态
  const html = await page.content()
  const hasQR = /qr|qrcode|二维码|scan|login/.test(html)
  const hasWorkbench = /内容管理|作品管理|数据概览|创作者中心/.test(html)
  console.log('hasQR:', hasQR, '| hasWorkbench:', hasWorkbench)

  // 全页截图
  await page.screenshot({ path: SHOT, fullPage: false })
  console.log('SHOT_SAVED:', SHOT)

  // 也存一份状态文件供后续阶段使用
  fs.writeFileSync('/tmp/task032-state.json', JSON.stringify({
    accountId: ACCOUNT_ID,
    sessionId,
    profilePath,
    url,
    hasQR,
    hasWorkbench,
    shot: SHOT,
  }, null, 2))

  // 保留浏览器运行，等待掌柜扫码
  console.log('BROWSER_KEPT_OPEN')
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
