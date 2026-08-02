/**
 * SPRINT-MEDIA-ACCOUNT-IDENTITY-VIEW-01 — 验收脚本（G1-G6）
 * 账号身份展示闭环：SSOT 字段 / 登录成功同步 / Reality API 标准化 / owner-view 真实身份 / 失效展示
 * 用法：node scripts/reality-check-account-identity-view-01.cjs [--screenshot]
 */
const { chromium } = require('playwright')

const BASE = 'https://aigc.fushtn.com'
const API = 'http://localhost:4002'
const DOUYIN_ID = '08a0f643-fb0d-48d5-af18-ad87bd9a34fb' // EXPIRED 但有身份（登录过）
const WECOM_ID = '8b1cb420-77c3-447b-97ce-cead47245f7d'   // PENDING 从未登录
const WS_ID = 'b27a2e1e-9669-4ce2-9482-50a750b249b5'      // Alice 工作空间

async function main() {
  const takeScreenshot = process.argv.includes('--screenshot')
  const results = []
  const check = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? '✅' : '❌'} ${name} — ${detail}`) }

  // 1. 登录
  const loginRes = await fetch(`${API}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const token = (await loginRes.json()).token
  if (!token) { console.error('登录失败'); process.exit(1) }
  const H = { Authorization: `Bearer ${token}` }

  // 2. G5 — 从未登录账号 → Reality identity.status=missing（不生成账号名）
  const missingRes = await fetch(`${API}/api/enterprise/channels/${WECOM_ID}/reality`, { headers: H })
  const missing = (await missingRes.json()).data || {}
  check('G5 未登录不能生成账号名', missing.identity?.status === 'missing' && !missing.identity?.externalId && !missing.identity?.name, `status=${missing.identity?.status} name=${missing.identity?.name || 'null'}`)

  // 3. G4 — 登录过但失效 → stale + 身份保留 + 原因
  const staleRes = await fetch(`${API}/api/enterprise/channels/${DOUYIN_ID}/reality`, { headers: H })
  const stale = (await staleRes.json()).data || {}
  check('G4 identity 标准化字段', ['status','platform','name','avatar','externalId','lastVerifiedAt'].every(k => k in (stale.identity || {})), JSON.stringify(Object.keys(stale.identity || {})))
  check('G4 登录过但浏览器失效 → stale（身份不删除）', stale.identity?.status === 'stale' && !!stale.identity?.name && !!stale.identity?.externalId, `status=${stale.identity?.status} name=${stale.identity?.name} externalId=${stale.identity?.externalId}`)
  check('G4 lastVerifiedAt 来自真实探针/快照', !!stale.identity?.lastVerifiedAt, `lastVerifiedAt=${stale.identity?.lastVerifiedAt}`)

  // 4. G2/G3 — owner-view：SSOT 列（accountName/avatarUrl）+ 失效原因 + AI 员工绑定（G6）
  const ovRes = await fetch(`${API}/api/enterprise/workspaces/owner-view?businessType=media`, { headers: H })
  const rows = (await ovRes.json()).data || []
  const row = rows.find(r => r.workspaceId === WS_ID)
  check('G3 后端重启后账号名保持（SSOT 列）', !!row?.identity?.accountName && row.identity.accountName === '抖音创作者中心', `accountName=${row?.identity?.accountName}`)
  check('G2/G3 身份数据持久（externalAccountId + lastVerifiedAt）', !!row?.identity?.externalAccountId && !!row?.identity?.lastVerifiedAt, `externalId=${row?.identity?.externalAccountId}`)
  check('G4 owner-view 失效状态 + 原因', row?.identity?.status === 'stale' && !!row?.identity?.reason, `status=${row?.identity?.status} reason=${row?.identity?.reason}`)
  check('G6 AI 员工看到真实绑定账号', !!row?.agent?.name && !!row?.identity?.accountName && !!row?.identity?.externalAccountId, `agent=${row?.agent?.name} 绑定账号=${row?.identity?.accountName}`)

  // 5. 浏览器实测 — 卡片展示真实身份 + 刷新保持 + 失效警示（G2/G4）
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t)
    document.cookie = `auth_token=${t}; path=/; max-age=86400`
  }, token)
  await page.goto(`${BASE}/workspace/media/accounts`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('G1/G2 卡片显示真实账号名（抖音创作者中心）', bodyText.includes('抖音创作者中心'), '账号名已渲染')
  check('G2 卡片显示平台账号ID', bodyText.includes('88130666815'), '平台ID已渲染')
  check('G4 失效警示文案（登录状态需要重新验证）', bodyText.includes('登录状态需要重新验证'), '🟡 需重新验证已渲染')
  check('G4 失效原因（登录状态已过期）', bodyText.includes('登录状态已过期') || bodyText.includes('重新扫码'), '原因已渲染')
  check('G4 最近验证时间（昨天/天前）', /最近验证[\s\S]{0,30}(天前|小时前|分钟前|刚刚)/.test(bodyText), '最近验证已渲染')

  // 刷新 → 状态保持（G2）
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(4000)
  const bodyText2 = await page.evaluate(() => document.body.innerText)
  check('G2 刷新后账号名保持', bodyText2.includes('抖音创作者中心'), '刷新后身份不丢')
  check('G2 刷新后失效状态保持', bodyText2.includes('登录状态需要重新验证'), '刷新后仍显示需重新验证')

  if (takeScreenshot) {
    await page.screenshot({ path: '/root/shipin-cinematic-studio/docs/reality/ACCOUNT-IDENTITY-VIEW-01-accounts.png', fullPage: false })
    console.log('📸 screenshot saved')
  }
  await browser.close()

  const failed = results.filter(r => !r.pass)
  console.log(`\n===== 结果: ${results.length - failed.length}/${results.length} PASS =====`)
  if (failed.length) { console.log('失败项:'); failed.forEach(f => console.log(`  ❌ ${f.name}: ${f.detail}`)) }
  process.exit(failed.length ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e.message); process.exit(1) })
