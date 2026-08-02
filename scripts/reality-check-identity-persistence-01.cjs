/**
 * SPRINT-MEDIA-IDENTITY-PERSISTENCE-FIX-01 — 验收脚本（G1/G4/G5）
 * 浏览器实测：登录 → 打开渠道页 → 校验 owner-view 卡片真实状态 → 刷新 → 状态保持
 * 用法：node scripts/reality-check-identity-persistence-01.cjs [--screenshot]
 */
const { chromium } = require('playwright')

const BASE = 'https://aigc.fushtn.com'
const API = 'http://localhost:4002'

async function main() {
  const takeScreenshot = process.argv.includes('--screenshot')
  const results = []
  const check = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name} — ${detail}`) }

  // 1. 登录拿 token
  const loginRes = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const loginJson = await loginRes.json()
  const token = loginJson.token || loginJson.data?.token
  if (!token) { console.error('登录失败', JSON.stringify(loginJson).slice(0, 300)); process.exit(1) }
  check('G0 登录获取 token', true, token.slice(0, 16) + '...')

  // 2. Reality API 四层状态（08a0f643 douyin 账号）
  const realityRes = await fetch(`${API}/api/enterprise/channels/08a0f643-fb0d-48d5-af18-ad87bd9a34fb/reality`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const realityJson = await realityRes.json()
  const rd = realityJson.data || {}
  check('T5 Reality API 返回四层结构', !!rd.browser && !!rd.identity && !!rd.account && !!rd.employee, JSON.stringify(Object.keys(rd)))
  check('T5 identity 实时探针（非DB快照）', typeof rd.identity?.loggedIn === 'boolean' && !!rd.identity?.checkedAt, `loggedIn=${rd.identity?.loggedIn} checkedAt=${rd.identity?.checkedAt}`)
  check('G5 未登录 → usable=false', rd.employee?.usable === false, `usable=${rd.employee?.usable} account=${rd.account?.connectionStatus}`)

  // 3. owner-view（后端 identity 块）
  const ovRes = await fetch(`${API}/api/enterprise/workspaces/owner-view?businessType=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ovJson = await ovRes.json()
  const rows = ovJson.data || []
  check('G4 owner-view 返回行', rows.length > 0, `rows=${rows.length}`)
  const row = rows.find(r => r.workspaceId === 'b27a2e1e-9669-4ce2-9482-50a750b249b5')
  check('T4 owner-view 含 identity 块', !!row?.identity && ['verified', 'stale', 'missing'].includes(row.identity.status), `identity.status=${row?.identity?.status}`)
  check('G5 未登录账号 online=false', row?.online === false, `online=${row?.online} workerStatus=${row?.workerStatus}`)

  // 4. 浏览器实测（G1 刷新保持 + G4 前端渲染真实状态）
  const browser = await chromium.launch({ executablePath: '/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome'.replace('*', ''), headless: true, args: ['--no-sandbox'] })
    .catch(() => chromium.launch({ headless: true, args: ['--no-sandbox'] }))
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // 注入 admin token（auth middleware 需要）
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t)
    document.cookie = `auth_token=${t}; path=/; max-age=86400`
  }, token)

  // 打开渠道页
  await page.goto(`${BASE}/workspace/media/accounts`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('G4 页面渲染「我的 AI 员工」工作区', bodyText.includes('我的 AI 员工'), 'owner-view 卡片区存在')
  check('G4 展示真实离线状态（登录已过期）', bodyText.includes('登录已过期') || bodyText.includes('离线'), `包含: ${bodyText.includes('登录已过期') ? '登录已过期' : bodyText.includes('离线') ? '离线' : '无'}`)
  check('G4 展示账号身份行', bodyText.includes('账号身份'), 'identity 行已渲染')

  // 刷新页面 → 状态保持（G1）
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const bodyText2 = await page.evaluate(() => document.body.innerText)
  check('G1 刷新后状态保持（仍显示过期/离线，不闪回已连接）', bodyText2.includes('登录已过期') || bodyText2.includes('离线'), '刷新后状态一致')
  check('G1 刷新后无假在线', !bodyText2.includes('工作中'), '未出现「工作中」假象')

  if (takeScreenshot) {
    await page.screenshot({ path: '/root/shipin-cinematic-studio/docs/reality/IDENTITY-PERSISTENCE-01-accounts.png', fullPage: false })
    console.log('📸 screenshot saved')
  }
  await browser.close()

  // 汇总
  const failed = results.filter(r => !r.pass)
  console.log(`\n===== 结果: ${results.length - failed.length}/${results.length} PASS =====`)
  if (failed.length) { console.log('失败项:'); failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`)) }
  process.exit(failed.length ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e.message); process.exit(1) })
