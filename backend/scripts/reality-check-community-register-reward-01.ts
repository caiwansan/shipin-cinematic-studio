/**
 * COMMUNITY-REGISTER-REWARD-01 — 注册送钻石 Reality Gate（掌柜 2026-08-07：注册送 10 钻石）
 *
 * G1 手机号注册 → credits=10 + CoinLog 流水（amount=10, remark=注册奖励）
 * G2 注册接口响应 credits=10（freshCredits 回读）
 * G3 短信快捷登录自动建号 → credits=10
 * G4 老用户重复登录不重复送（credits 仍 10，仅 1 条注册奖励流水）
 * G5 配置可调：community_register_reward_diamonds=5 → 送 5；=0 → 不送（credits=0 无流水）
 * G6 后台 admin 创建会员不自动送（显式 coins）
 *
 * 运行：npx tsx scripts/reality-check-community-register-reward-01.ts
 */
import { prisma } from '../src/utils/index.js'

const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name} ${extra}`) }
  else { fail++; console.log(`  ❌ ${name} ${extra}`) }
}

async function api(path: string, method = 'GET', body?: any, token?: string, adminToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (adminToken) headers['x-admin-token'] = adminToken
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json: any = null
  try { json = await res.json() } catch { /* 非 JSON */ }
  return { status: res.status, json }
}

async function makeSmsCode(phone: string, code = '888866') {
  await prisma.smsCode.create({
    data: { phone, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000), used: false },
  })
}

async function main() {
  console.log('═══ COMMUNITY-REGISTER-REWARD-01 注册送钻石 Reality Gate ═══\n')
  const suffix = Date.now().toString().slice(-8)
  const cleanupUsers: string[] = []

  const delUser = async (id: string) => {
    cleanupUsers.push(id)
    await prisma.coinLog.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.smsCode.deleteMany({ where: { phone: { contains: suffix } } }).catch(() => {})
    await prisma.membership.deleteMany({ where: { userId: id } }).catch(() => {})
    await prisma.user.delete({ where: { id } }).catch(() => {})
  }

  // ── G1 手机号注册送 10 钻 ──
  console.log('── G1 手机号注册 → +10 钻石 ──')
  const p1 = `139${suffix}`
  await makeSmsCode(p1)
  const r1 = await api('/api/auth/register', 'POST', { phone: p1, username: '注册奖励测试A', password: 'Test@123456', code: '888866' })
  const u1 = r1.json?.user
  check('G1 注册成功', !!u1?.id, `(credits=${u1?.credits})`)
  check('G1 注册响应 credits=10', u1?.credits === 10, `(credits=${u1?.credits})`)
  const log1 = await prisma.coinLog.findMany({ where: { userId: u1?.id, remark: '注册奖励' } })
  check('G1 CoinLog 流水 amount=10 remark=注册奖励', log1.length === 1 && log1[0].amount === 10 && log1[0].type === 'reward', `(amount=${log1[0]?.amount})`)
  const mem1 = await prisma.membership.findUnique({ where: { userId: u1?.id } })
  check('G1 余额真源 credits=10', mem1?.credits === 10, `(credits=${mem1?.credits})`)
  await delUser(u1.id)

  // ── G3 短信快捷登录自动建号送 10 ──
  console.log('\n── G3 短信快捷登录自动建号 → +10 钻石 ──')
  const p3 = `138${suffix}`
  await makeSmsCode(p3)
  const r3 = await api('/api/auth/sms/login', 'POST', { phone: p3, code: '888866' })
  const u3 = r3.json?.user
  const db3 = await prisma.user.findUnique({ where: { phone: p3 } })
  check('G3 自动建号成功', !!db3)
  const mem3 = await prisma.membership.findUnique({ where: { userId: db3?.id } })
  check('G3 新用户 credits=10', mem3?.credits === 10, `(credits=${mem3?.credits})`)
  const log3 = await prisma.coinLog.findMany({ where: { userId: db3?.id, remark: '注册奖励' } })
  check('G3 CoinLog 流水 1 条 amount=10', log3.length === 1 && log3[0].amount === 10)

  // ── G4 老用户重复登录不重复送 ──
  console.log('\n── G4 老用户重复登录不重复送 ──')
  await makeSmsCode(p3) // 复用手机号造新验证码再登录
  const r4 = await api('/api/auth/sms/login', 'POST', { phone: p3, code: '888866' })
  check('G4 老用户登录成功', r4.status === 200)
  const mem4 = await prisma.membership.findUnique({ where: { userId: db3?.id } })
  check('G4 余额仍 10（不重复送）', mem4?.credits === 10, `(credits=${mem4?.credits})`)
  const log4 = await prisma.coinLog.findMany({ where: { userId: db3?.id, remark: '注册奖励' } })
  check('G4 注册奖励流水仅 1 条', log4.length === 1, `(count=${log4.length})`)
  await delUser(db3.id)

  // ── G5 配置可调 ──
  console.log('\n── G5 配置可调（systemConfig）──')
  // 5 钻石
  await prisma.systemConfig.upsert({
    where: { key: 'community_register_reward_diamonds' },
    update: { value: '5' },
    create: { key: 'community_register_reward_diamonds', value: '5' },
  })
  const p5 = `137${suffix}`
  await makeSmsCode(p5)
  const r5 = await api('/api/auth/register', 'POST', { phone: p5, username: '注册奖励测试B', password: 'Test@123456', code: '888866' })
  check('G5 配置=5 时注册送 5', r5.json?.user?.credits === 5, `(credits=${r5.json?.user?.credits})`)
  const mem5 = await prisma.membership.findUnique({ where: { userId: r5.json?.user?.id } })
  const log5 = await prisma.coinLog.findMany({ where: { userId: r5.json?.user?.id, remark: '注册奖励' } })
  check('G5 流水 amount=5', log5.length === 1 && log5[0].amount === 5, `(amount=${log5[0]?.amount})`)
  await delUser(r5.json?.user?.id)

  // 0 = 关闭
  await prisma.systemConfig.update({ where: { key: 'community_register_reward_diamonds' }, data: { value: '0' } })
  const p0 = `136${suffix}`
  await makeSmsCode(p0)
  const r0 = await api('/api/auth/register', 'POST', { phone: p0, username: '注册奖励测试C', password: 'Test@123456', code: '888866' })
  check('G5 配置=0 时注册不送（credits=0）', r0.json?.user?.credits === 0, `(credits=${r0.json?.user?.credits})`)
  const log0 = await prisma.coinLog.findMany({ where: { userId: r0.json?.user?.id, remark: '注册奖励' } })
  check('G5 无注册奖励流水', log0.length === 0, `(count=${log0.length})`)
  await delUser(r0.json?.user?.id)

  // 恢复默认 10
  await prisma.systemConfig.update({ where: { key: 'community_register_reward_diamonds' }, data: { value: '10' } })

  // ── G6 后台创建会员不自动送 ──
  console.log('\n── G6 后台创建会员不自动送 ──')
  const an = `rw_admin_${suffix}`
  await prisma.adminUser.create({ data: { username: an, passwordHash: await (await import('bcryptjs')).default.hash('AdminTest@123', 10), role: 'superadmin', displayName: 'rw-test' } })
  const al = await api('/api/admin/login', 'POST', { username: an, password: 'AdminTest@123' })
  const at = al.json?.token
  const r6 = await api('/api/admin/members', 'POST', { email: `rw_${suffix}@admin.local`, username: '后台建号', password: 'Test@123456', tier: 'free', coins: 88 }, at)
  const u6 = r6.json?.data
  const mem6 = await prisma.membership.findUnique({ where: { userId: u6?.id } })
  check('G6 后台创建显式 coins=88', mem6?.credits === 88, `(credits=${mem6?.credits})`)
  const log6 = await prisma.coinLog.findMany({ where: { userId: u6?.id, remark: '注册奖励' } })
  check('G6 无注册奖励流水', log6.length === 0)
  await delUser(u6?.id)
  await prisma.adminUser.delete({ where: { username: an } }).catch(() => {})

  // 清理测试用户的 smsCode
  for (const phone of [p1, p3, p5, p0]) await prisma.smsCode.deleteMany({ where: { phone } }).catch(() => {})
  await prisma.systemConfig.deleteMany({ where: { key: 'community_register_reward_diamonds' } }).catch(() => {})

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
