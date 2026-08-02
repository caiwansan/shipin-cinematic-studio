/* SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 — 浏览器实测截图：新媒体工作台 Owner View */
const { chromium } = require('/root/shipin-cinematic-studio/backend/node_modules/playwright-core')

;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })

  // demo 登录
  const login = await page.request.post('https://aigc.fushtn.com/api/auth/login', {
    data: { email: 'demo@scs.com', password: 'demo123456' },
  })
  const lj = await login.json()
  const token = lj.accessToken || lj.token
  await page.addInitScript((t) => {
    try { localStorage.setItem('token', t); localStorage.setItem('auth_token', t) } catch {}
  }, token)

  // 渠道中心页
  await page.goto('https://aigc.fushtn.com/workspace/media/accounts', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(6000)

  // 检查 Owner View 区
  const ownerTitle = await page.locator('.ac-owner-title').first().textContent().catch(() => null)
  const ownerCards = await page.locator('.ac-owner-card').count()
  const aliceName = await page.locator('.ac-owner-name').first().textContent().catch(() => '')
  const aliceRole = await page.locator('.ac-owner-role').first().textContent().catch(() => '')
  const dept = await page.locator('.ac-owner-dept').first().textContent().catch(() => '')
  const state = await page.locator('.ac-owner-state').first().textContent().catch(() => '')
  const wsRow = await page.locator('.ac-owner-row').first().textContent().catch(() => '')

  console.log('ownerTitle:', ownerTitle)
  console.log('cards:', ownerCards, '| name:', aliceName, '| role:', aliceRole, '| dept:', dept, '| state:', state)
  console.log('workstation row:', wsRow)

  // 截图
  await page.screenshot({ path: '/root/shipin-cinematic-studio/docs/reality/DOMAIN-BOUNDARY-FIX-01-accounts.png', fullPage: false })
  console.log('screenshot saved')

  await browser.close()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
