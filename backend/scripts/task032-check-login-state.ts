/**
 * TASK03.2 — 登录态检测：DOM 特征精确判断（二维码/手机验证码登录/已登录工作台）
 */
import { browserRuntime } from '../src/services/media/browser-runtime.service.js'

const ACCOUNT_ID = process.env.ACCOUNT_ID || '08a0f643-fb0d-48d5-af18-ad87bd9a34fb'
const sessionId = `douyin:${ACCOUNT_ID}`
const profilePath = browserRuntime.getProfilePath('douyin', ACCOUNT_ID)

async function main() {
  const { context } = await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: true })
  const page = context.pages()[0] || await context.newPage()
  await page.goto('https://creator.douyin.com/', { timeout: 45000, waitUntil: 'domcontentloaded' }).catch(() => {})
  await new Promise(r => setTimeout(r, 6000))

  const url = page.url()
  const html = await page.content()

  // 特征 1：二维码图片元素（抖音登录二维码是 img 或 canvas）
  const qrImg = await page.$$eval('img', imgs => imgs.filter(i => {
    const src = (i.src || '').toLowerCase()
    return src.includes('qr') || src.includes('qrcode') || src.includes('captcha') || src.includes('login')
  }).length).catch(() => 0)

  // 特征 2：登录表单元素
  const loginForm = await page.$$eval('form, input, button', els => {
    const text = els.map(e => (e.textContent || '').trim()).join(' ')
    return /扫码|登录|验证码|手机号/.test(text) ? text.slice(0, 100) : ''
  }).catch(() => '')

  // 特征 3：工作台特征（已登录）
  const workbench = await page.$$eval('a, span, div', els => {
    const text = els.map(e => (e.textContent || '').trim()).join('|')
    const hits = ['内容管理', '作品管理', '数据概览', '创作服务', '发布作品'].filter(w => text.includes(w))
    return hits.join(',')
  }).catch(() => '')

  // 截图供掌柜确认
  const shot = `/root/.openclaw/media/qqbot/douyin-state-${Date.now()}.png`
  await page.screenshot({ path: shot })

  console.log(JSON.stringify({
    url,
    qrImgCount: qrImg,
    loginFormHint: loginForm.slice(0, 80),
    workbenchHits: workbench,
    shot,
  }, null, 2))
  console.log('SHOT:', shot)
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1) })
