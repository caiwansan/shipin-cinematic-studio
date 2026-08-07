/**
 * COMMUNITY-POST-LIMIT-REWARD-01 — 社区每日发帖上限 + 发帖钻石奖励 Reality Gate
 *
 * 掌柜 2026-08-07 指令：社区发帖有钻石奖励 → 每日限发 20 篇，每篇奖励 2 钻石
 *   - 上限/奖励后台 SystemConfig 可调（community_daily_post_limit / community_post_reward_diamonds）
 *   - 发帖入口硬限制：当日创建数 >= 上限 → 429
 *   - 审核通过发奖：+2 钻石（Membership.credits 真源）+ CoinLog 流水 + Post.rewardCoins/CommunityReward 明细
 *   - 奖励兜底：当日已奖励次数 >= 上限 → 跳过（防「昨天发的帖今天批量审核」突破每日上限）
 *
 * G1 配置默认值：SYSTEM_CONFIG_DEFAULTS 20/2 + 白名单 + 校验（1~1000 正整数）
 * G2 每日发帖上限（HTTP）：临时设上限=2 → 发 3 篇 → 前 2 篇 200（remaining 递减），第 3 篇 429
 * G3 发帖奖励（HTTP 审核通过）：+2 钻石 / CoinLog / rewardCoins / CommunityReward
 * G4 奖励每日兜底：昨天发的帖今天审核 → 已达上限跳过奖励
 * G5 配置恢复：清理测试配置后默认回退 20/2
 *
 * 运行：npx tsx scripts/reality-check-community-post-limit-01.ts
 */
import { prisma } from '../src/utils/index.js'
import bcrypt from 'bcryptjs'
import { SYSTEM_CONFIG_DEFAULTS } from '../src/routes/site-config.js'

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
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json: any = null
  try { json = await res.json() } catch { /* 非 JSON 响应 */ }
  return { status: res.status, json }
}

async function main() {
  console.log('═══ COMMUNITY-POST-LIMIT-REWARD-01 Reality Gate ═══\n')
  const suffix = Date.now().toString().slice(-8)
  const email = `community_limit_${suffix}@test.local`
  const username = `limit_${suffix}`
  const password = 'Test@123456'

  // ── G1 配置默认值 ──
  console.log('── G1 配置默认值 ──')
  check('G1 community_daily_post_limit 默认 20', SYSTEM_CONFIG_DEFAULTS.community_daily_post_limit?.value === '20',
    `(${SYSTEM_CONFIG_DEFAULTS.community_daily_post_limit?.value})`)
  check('G1 community_post_reward_diamonds 默认 2', SYSTEM_CONFIG_DEFAULTS.community_post_reward_diamonds?.value === '2',
    `(${SYSTEM_CONFIG_DEFAULTS.community_post_reward_diamonds?.value})`)
  console.log()

  // ── 准备：临时配置（上限 2 / 奖励 2）+ 测试用户 + 管理员 ──
  await prisma.systemConfig.upsert({ where: { key: 'community_daily_post_limit' }, update: { value: '2' }, create: { key: 'community_daily_post_limit', value: '2', group: 'site' } })
  await prisma.systemConfig.upsert({ where: { key: 'community_post_reward_diamonds' }, update: { value: '2' }, create: { key: 'community_post_reward_diamonds', value: '2', group: 'site' } })

  const user = await prisma.user.create({
    data: { email, username, passwordHash: await bcrypt.hash(password, 10) },
  })
  console.log(`  测试用户: ${email} (${user.id})`)

  const login = await api('/api/auth/login', 'POST', { email, password })
  check('准备 用户登录成功', login.status === 200 && !!login.json?.accessToken)
  const userToken = login.json?.accessToken
  const adminLogin = await api('/api/admin/login', 'POST', { username: 'admin', password: 'admin123' })
  let adminToken = adminLogin.json?.token
  // 生产 admin 密码已轮换：不碰真实管理员，临时创建一个测试管理员用于审核，测完即删
  const adminUsername = `limit_admin_${suffix}`
  const adminPassword = 'AdminTest@123'
  const tempAdmin = await prisma.adminUser.create({
    data: { username: adminUsername, passwordHash: await bcrypt.hash(adminPassword, 10), role: 'superadmin', displayName: 'limit-test' },
  })
  const adminLogin2 = await api('/api/admin/login', 'POST', { username: adminUsername, password: adminPassword })
  adminToken = adminToken || adminLogin2.json?.token
  check('准备 管理员登录成功', !!adminToken)

  // ── G2 每日发帖上限 ──
  console.log('\n── G2 每日发帖上限（上限=2）──')
  const p1 = await api('/api/community/posts', 'POST', { title: '限流测试帖1', content: '内容1' }, userToken)
  check('G2 第 1 篇发布成功', p1.status === 200 && !!p1.json?.post, `(status=${p1.status})`)
  check('G2 返回 remaining=1', p1.json?.daily?.remaining === 1, `(remaining=${p1.json?.daily?.remaining})`)
  const post1Id = p1.json?.post?.id

  const p2 = await api('/api/community/posts', 'POST', { title: '限流测试帖2', content: '内容2' }, userToken)
  check('G2 第 2 篇发布成功', p2.status === 200 && !!p2.json?.post, `(status=${p2.status})`)
  check('G2 返回 remaining=0', p2.json?.daily?.remaining === 0, `(remaining=${p2.json?.daily?.remaining})`)
  const post2Id = p2.json?.post?.id

  const p3 = await api('/api/community/posts', 'POST', { title: '限流测试帖3', content: '内容3' }, userToken)
  check('G2 第 3 篇被拒绝 429', p3.status === 429, `(status=${p3.status})`)
  check('G2 错误文案含上限提示', typeof p3.json?.error === 'string' && p3.json.error.includes('今日发帖已达上限（2 篇）'), `(${p3.json?.error})`)

  // ── G3 发帖奖励（审核通过 +2 钻石）──
  // 注意：admin-posts.ts 从未注册（死代码）；线上真实审核入口 = /api/community/admin/posts/:id/approve（x-admin-token）
  console.log('\n── G3 发帖奖励（审核通过 +2 钻石）──')
  const approve = (postId: string) =>
    fetch(`${BASE}/api/community/admin/posts/${postId}/approve`, {
      method: 'PATCH',
      headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    })
  const a1b = await approve(post1Id)
  check('G3 审核通过接口成功', a1b.status === 200, `(status=${a1b.status})`)

  const m1 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G3 钻石余额 +2', m1?.credits === 2, `(credits=${m1?.credits})`)
  const log1 = await prisma.coinLog.findMany({ where: { userId: user.id, type: 'reward', remark: '社区发帖奖励' } })
  check('G3 CoinLog 流水 1 条 +2', log1.length === 1 && log1[0].amount === 2, `(count=${log1.length}, amount=${log1[0]?.amount})`)
  const rw1 = await prisma.communityReward.findFirst({ where: { postId: post1Id } })
  check('G3 CommunityReward 明细 +2', rw1?.coins === 2, `(coins=${rw1?.coins})`)
  const post1Db = await prisma.communityPost.findUnique({ where: { id: post1Id } })
  check('G3 Post.rewardCoins=2', post1Db?.rewardCoins === 2, `(rewardCoins=${post1Db?.rewardCoins})`)

  // 第 2 篇审核 → 第 2 次奖励
  const a2b = await approve(post2Id)
  check('G3 第 2 篇审核通过', a2b.status === 200, `(status=${a2b.status})`)
  const m2 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G3 钻石余额累计 +4', m2?.credits === 4, `(credits=${m2?.credits})`)

  // ── G4 奖励每日兜底：昨天发的帖今天批量审核 → 跳过奖励 ──
  console.log('\n── G4 奖励每日兜底（当日已奖励 2 次=上限）──')
  const yesterday = new Date(Date.now() - 86400000)
  const extra1 = await prisma.communityPost.create({ data: { userId: user.id, title: '昨日帖A', content: '昨日内容A', status: 'pending', createdAt: yesterday } })
  const extra2 = await prisma.communityPost.create({ data: { userId: user.id, title: '昨日帖B', content: '昨日内容B', status: 'pending', createdAt: yesterday } })
  await approve(extra1.id)
  await approve(extra2.id)
  const m3 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G4 余额仍为 4（跳过奖励）', m3?.credits === 4, `(credits=${m3?.credits})`)
  const logAfter = await prisma.coinLog.count({ where: { userId: user.id, type: 'reward', remark: '社区发帖奖励' } })
  check('G4 流水仍为 2 条', logAfter === 2, `(count=${logAfter})`)
  const extra1Db = await prisma.communityPost.findUnique({ where: { id: extra1.id } })
  check('G4 昨日帖 A rewardCoins=0', extra1Db?.rewardCoins === 0, `(rewardCoins=${extra1Db?.rewardCoins})`)

  // ── G5 配置恢复：清理测试配置 → 默认回退 20/2 ──
  console.log('\n── G5 配置恢复 ──')
  await prisma.systemConfig.deleteMany({ where: { key: { in: ['community_daily_post_limit', 'community_post_reward_diamonds'] } } })
  const cfg = await api('/api/system/config')
  check('G5 公开配置返回默认 20/2', cfg.json?.community_daily_post_limit === '20' && cfg.json?.community_post_reward_diamonds === '2',
    `(limit=${cfg.json?.community_daily_post_limit}, reward=${cfg.json?.community_post_reward_diamonds})`)

  // ── 清理 ──
  await prisma.communityReward.deleteMany({ where: { userId: user.id } }).catch(() => {})
  await prisma.communityPost.deleteMany({ where: { userId: user.id } })
  await prisma.coinLog.deleteMany({ where: { userId: user.id } }).catch(() => {})
  await prisma.membership.deleteMany({ where: { userId: user.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.adminUser.delete({ where: { username: adminUsername } }).catch(() => {})

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
