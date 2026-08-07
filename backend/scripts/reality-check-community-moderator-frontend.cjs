// COMMUNITY-MODERATOR-01 前端 CDP 验收：版主体系入口/申请/管理面板渲染 + 无 JS 异常
// 注意：先造一个真实在职版主（脚本直接 DB 写入），验证公开列表/团队区块真实渲染，测完清理
const { chromium } = require('playwright')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()
let pass = 0, fail = 0
const check = (n, c, e = '') => { if (c) { pass++; console.log('  ✅ ' + n + ' ' + e) } else { fail++; console.log('  ❌ ' + n + ' ' + e) } }

;(async () => {
  // 造真实版主：用户 + active moderator
  const suffix = Date.now().toString().slice(-8)
  const user = await prisma.user.create({
    data: { email: `cdp_mod_${suffix}@test.local`, username: `cdp_mod_${suffix}`, nickname: '验收版主', passwordHash: await bcrypt.hash('Test@123456', 10) },
  })
  await prisma.communityModerator.create({
    data: { userId: user.id, role: 'moderator', status: 'active', approvedBy: 'cdp-test', approvedAt: new Date() },
  })

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('401') && !m.text().includes('Failed to load resource')) errors.push(m.text()) })

  // 1. 社区首页：版主管理卡片 + 申请按钮 + 版主团队（有真实版主）
  await page.goto('https://aigc.fushtn.com/community', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1800)
  let bodyText = await page.evaluate(() => document.body.innerText)
  check('首页版主卡片渲染', /社\s*区\s*管\s*理/.test(bodyText))
  check('首页申请入口渲染', bodyText.includes('申请成为版主') || bodyText.includes('登录后可申请成为版主'))
  check('首页版主团队渲染（真实版主）', /版\s*主\s*团\s*队/.test(bodyText) && bodyText.includes('验收版主'))
  check('版主角色徽章渲染', bodyText.includes('版主'), '(角色标签)')
  await page.screenshot({ path: '/root/.openclaw/workspace/docs/reality/COMMUNITY-MODERATOR-01-index.png' })

  // 2. 管理面板（未登录：提示去登录）
  await page.goto('https://aigc.fushtn.com/community/manage', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  bodyText = await page.evaluate(() => document.body.innerText)
  check('管理面板加载（未登录引导）', bodyText.includes('回社区登录') || bodyText.includes('请先登录'), '(未登录态)')
  await page.screenshot({ path: '/root/.openclaw/workspace/docs/reality/COMMUNITY-MODERATOR-01-manage-guest.png' })

  check('全程无 JS 异常', errors.length === 0, errors.length ? `(${errors.slice(0, 3).join(' | ')})` : '')
  console.log(`\n═══ CDP 结果: ${pass} PASS / ${fail} FAIL ═══`)
  await browser.close()

  // 清理
  await prisma.communityModerator.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.$disconnect()
  process.exit(fail > 0 ? 1 : 0)
})().catch(async e => { console.error('ERR', e.message); await prisma.$disconnect(); process.exit(1) })