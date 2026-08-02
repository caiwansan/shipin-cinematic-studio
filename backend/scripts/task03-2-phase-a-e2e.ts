/**
 * Task03.2 Phase A 生产端到端验证
 * 打开生产域工作台渠道中心 → 注入 admin token → 点抖音「去连接」→ 验证连接弹窗显示登录页截图
 */
import { chromium } from 'playwright'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const TOKEN = process.env.ADMIN_TOKEN || ''
  if (!TOKEN) { console.log('NO_TOKEN'); process.exit(1) }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  // 注入 token（先访问页面再注入再刷新）
  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.evaluate((t) => { localStorage.setItem('auth_token', t) }, TOKEN)
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(6000)

  const text = await page.evaluate(() => document.body.innerText).catch(() => '')
  console.log('PAGE_HAS_渠道中心:', text.includes('渠道中心'))
  console.log('PAGE_HAS_抖音:', text.includes('抖音'))

  // 找「去连接」按钮（抖音卡片）
  const btns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').trim() === '去连接').map(b => {
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
    })
  })
  console.log('GO_CONNECT_BTNS:', JSON.stringify(btns))

  if (btns.length === 0) {
    await page.screenshot({ path: '/tmp/phase-a-e2e-no-btn.png' })
    await browser.close()
    process.exit(1)
  }

  // 点第一个「去连接」（抖音）
  await page.mouse.click(btns[0].x, btns[0].y)
  await sleep(1500)

  // 检查弹窗
  const modal = await page.evaluate(() => {
    const m = document.querySelector('.ac-modal')
    if (!m) return null
    const img = m.querySelector('img')
    return {
      title: (m.querySelector('.ac-modal-title')?.textContent || '').trim(),
      hasImg: !!img,
      imgSrc: img ? (img.getAttribute('src') || '').slice(0, 40) : '',
      status: (m.querySelector('.ac-status')?.textContent || '').trim(),
    }
  })
  console.log('MODAL:', JSON.stringify(modal))

  // 等截图加载
  for (let i = 0; i < 8; i++) {
    await sleep(3000)
    const imgInfo = await page.evaluate(() => {
      const img = document.querySelector('.ac-modal img')
      if (!img) return null
      const src = img.getAttribute('src') || ''
      return { len: src.length, prefix: src.slice(0, 30), loaded: (img as HTMLImageElement).complete }
    })
    console.log('T+' + (i + 1) * 3 + 's IMG:', JSON.stringify(imgInfo))
    if (imgInfo && imgInfo.len > 1000) break
  }

  await page.screenshot({ path: '/tmp/phase-a-e2e-modal.png', fullPage: false })
  console.log('E2E_DONE')
  await browser.close()
  process.exit(0)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
