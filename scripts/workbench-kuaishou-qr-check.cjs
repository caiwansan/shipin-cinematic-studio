/**
 * KUAISHOU-QR-FIX-01 — 工作台实测：快手账号重新登录 → 弹窗二维码显示
 * 验证前端 /workspace/media/accounts 渠道中心：点快手卡片 → connectModal → qrCode img 渲染
 * 用法：node scripts/workbench-kuaishou-qr-check.cjs
 */
const { chromium } = require('/root/shipin-cinematic-studio/backend/node_modules/playwright')

const BASE = 'https://aigc.fushtn.com'
const API = 'http://localhost:4002'

async function main() {
  // 1. 登录
  const loginRes = await fetch(`${API}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const token = (await loginRes.json()).token
  if (!token) { console.error('登录失败'); process.exit(1) }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t)
    document.cookie = `auth_token=${t}; path=/; max-age=86400`
  }, token)

  // 2. 打开渠道中心
  await page.goto(`${BASE}/workspace/media/accounts`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const text = await page.evaluate(() => document.body.innerText)
  console.log('页面标题区:', text.slice(0, 80).replace(/\n/g, ' | '))

  // 3. 找快手平台卡片（文本含「快手」的可点卡片）
  const cardInfo = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div'))
      .filter(el => (el.textContent || '').includes('快手') && el.textContent.length < 200 && el.offsetParent !== null)
      .map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 60), txt: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) }))
    return cards.slice(0, 12)
  })
  console.log('快手相关元素:', JSON.stringify(cardInfo, null, 1))

  // 4. 点击快手卡片（找 ac-card 且包含快手文本的）
  const clicked = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.ac-card'))
      .find(el => (el.textContent || '').includes('快手') && el.offsetParent !== null)
    if (!card) return 'NO_CARD'
    card.click()
    return 'CLICKED:' + (card.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  })
  console.log('点击卡片:', clicked)
  await page.waitForTimeout(5000)

  // 5. 检查弹窗 + 二维码
  const modalState = await page.evaluate(() => {
    const modal = document.querySelector('.ac-modal-mask')
    const qrImg = document.querySelector('.ac-qr-big')
    const confirmCard = document.querySelector('.ac-confirm')
    const stage = document.querySelector('.ac-stage')
    return {
      modalOpen: !!modal,
      qrRendered: !!qrImg && qrImg.src.startsWith('data:image') && qrImg.naturalWidth > 0,
      qrSrc: qrImg ? qrImg.src.slice(0, 40) : '',
      qrW: qrImg ? qrImg.naturalWidth : 0,
      bodyText: (document.body.innerText || '').slice(0, 200).replace(/\n/g, ' | '),
    }
  })
  console.log('弹窗状态:', JSON.stringify(modalState, null, 1))

  // 6. 等待二维码出现（轮询最多 40s——首次要启动浏览器+点tab+等渲染）
  let qrOk = false
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    const st = await page.evaluate(() => {
      const qrImg = document.querySelector('.ac-qr-big')
      const shot = document.querySelector('.ac-shot')
      return {
        qr: qrImg ? (qrImg.src.startsWith('data:image') && qrImg.naturalWidth > 0) : false,
        qrSrc: qrImg ? qrImg.src.slice(0, 30) : '',
        shot: shot ? (shot.src.startsWith('data:image') && shot.naturalWidth > 0) : false,
        stage: (document.querySelector('.ac-stage')?.textContent || '').trim().slice(0, 60),
      }
    })
    if (st.qr || st.shot) { qrOk = true; console.log(`第${i + 1}s 二维码出现:`, JSON.stringify(st)); break }
    if (i % 10 === 9) console.log(`第${i + 1}s 仍无二维码, stage=${st.stage}`)
  }

  // 7. 截图（弹窗打开状态）
  await page.waitForTimeout(1500)
  await page.screenshot({ path: '/root/shipin-cinematic-studio/docs/reality/KUAISHOU-QR-WORKBENCH-modal.png' })
  // 同时截一张整页（弹窗可能被遮）
  await page.screenshot({ path: '/root/shipin-cinematic-studio/docs/reality/KUAISHOU-QR-WORKBENCH-page.png', fullPage: false })

  console.log(qrOk ? '✅ 工作台二维码显示成功' : '❌ 工作台二维码未出现')
  await browser.close()
  process.exit(qrOk ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1) })
