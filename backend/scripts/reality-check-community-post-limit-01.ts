/**
 * COMMUNITY-POST-LIMIT-REWARD-01 — 社区发帖钻石奖励（前 N 篇有奖、发帖不限量）Reality Gate
 *
 * 掌柜 2026-08-07 12:48 定调（规则变更）：当天前 20 篇发帖有奖励，后面没奖励，但不限制发帖数量
 *   - 不再 429 限发：发帖永远成功
 *   - 奖励按「发帖名次」判定（N = community_daily_post_limit，默认 20），与审核顺序无关
 *   - 第 N+1 篇起审核通过也正常展示，只是无奖励
 *   - 非当日发帖（昨天的帖子今天审核）不参与当天奖励
 *   - 奖励 = community_post_reward_diamonds（默认 2 钻石/篇，后台可调）
 *
 * G1 配置默认值：SYSTEM_CONFIG_DEFAULTS 20/2
 * G2 发帖不限量（HTTP）：临时设上限=2 → 连发 3 篇全 200（第 3 篇也成功，remaining 到 0 封底）
 * G3 奖励按发帖名次（乱序审核验证）：先审第 3 篇（名次3>2）→ 不奖励但帖子 approved；
 *    再审第 2/1 篇 → 各 +2，CoinLog/rewardCoins/CommunityReward 全链路
 * G4 非当日发帖：昨天发的帖今天审核 → 不奖励
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
  console.log('═══ COMMUNITY-POST-LIMIT-REWARD-01 Reality Gate（前 N 篇有奖·发帖不限量）═══\n')
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

  // ── 准备：临时配置（奖励名额 2 / 奖励 2）+ 测试用户 + 管理员 ──
  await prisma.systemConfig.upsert({ where: { key: 'community_daily_post_limit' }, update: { value: '2' }, create: { key: 'community_daily_post_limit', value: '2', group: 'site' } })
  await prisma.systemConfig.upsert({ where: { key: 'community_post_reward_diamonds' }, update: { value: '2' }, create: { key: 'community_post_reward_diamonds', value: '2', group: 'site' } })

  const user = await prisma.user.create({
    data: { email, username, passwordHash: await bcrypt.hash(password, 10) },
  })
  console.log(`  测试用户: ${email} (${user.id})`)

  const login = await api('/api/auth/login', 'POST', { email, password })
  check('准备 用户登录成功', login.status === 200 && !!login.json?.accessToken)
  const userToken = login.json?.accessToken
  // 生产 admin 密码已轮换：不碰真实管理员，临时创建一个测试管理员用于审核，测完即删
  const adminUsername = `limit_admin_${suffix}`
  const adminPassword = 'AdminTest@123'
  await prisma.adminUser.create({
    data: { username: adminUsername, passwordHash: await bcrypt.hash(adminPassword, 10), role: 'superadmin', displayName: 'limit-test' },
  })
  const adminLogin = await api('/api/admin/login', 'POST', { username: adminUsername, password: adminPassword })
  const adminToken = adminLogin.json?.token
  check('准备 管理员登录成功', !!adminToken)

  // ── G2 发帖不限量（奖励名额=2，仍可发第 3 篇）──
  console.log('\n── G2 发帖不限量（奖励名额=2，发 3 篇全成功）──')
  const p1 = await api('/api/community/posts', 'POST', { title: '测试帖1', content: '内容1' }, userToken)
  check('G2 第 1 篇发布成功', p1.status === 200 && !!p1.json?.post, `(status=${p1.status})`)
  check('G2 第 1 篇 remaining=1（还能得 1 篇奖励）', p1.json?.daily?.remaining === 1, `(remaining=${p1.json?.daily?.remaining})`)
  const post1Id = p1.json?.post?.id

  const p2 = await api('/api/community/posts', 'POST', { title: '测试帖2', content: '内容2' }, userToken)
  check('G2 第 2 篇发布成功', p2.status === 200 && !!p2.json?.post, `(status=${p2.status})`)
  check('G2 第 2 篇 remaining=0', p2.json?.daily?.remaining === 0, `(remaining=${p2.json?.daily?.remaining})`)
  const post2Id = p2.json?.post?.id

  const p3 = await api('/api/community/posts', 'POST', { title: '测试帖3', content: '内容3' }, userToken)
  check('G2 第 3 篇仍发布成功（不限制数量）', p3.status === 200 && !!p3.json?.post, `(status=${p3.status})`)
  check('G2 第 3 篇 remaining 封底 0', p3.json?.daily?.remaining === 0, `(remaining=${p3.json?.daily?.remaining})`)
  const post3Id = p3.json?.post?.id

  // ── G3 奖励按发帖名次（乱序审核：先审第 3 篇，验证与审核顺序无关）──
  // 注意：admin-posts.ts 从未注册（死代码）；线上真实审核入口 = /api/community/admin/posts/:id/approve（x-admin-token）
  console.log('\n── G3 奖励按发帖名次（乱序审核：先审第 3 篇）──')
  const approve = (postId: string) =>
    fetch(`${BASE}/api/community/admin/posts/${postId}/approve`, {
      method: 'PATCH',
      headers: { 'x-admin-token': adminToken, 'Content-Type': 'application/json' },
    })

  // 先审第 3 篇：当天第 3 篇，名次 3 > 名额 2 → 通过但无奖励
  const a3 = await approve(post3Id)
  check('G3 第 3 篇审核通过（帖子正常）', a3.status === 200, `(status=${a3.status})`)
  const post3Db = await prisma.communityPost.findUnique({ where: { id: post3Id } })
  check('G3 第 3 篇状态 approved（无奖也正常展示）', post3Db?.status === 'approved', `(status=${post3Db?.status})`)
  const m0 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G3 第 3 篇无奖励（余额 0）', (m0?.credits ?? 0) === 0, `(credits=${m0?.credits})`)
  check('G3 第 3 篇 rewardCoins=0', post3Db?.rewardCoins === 0, `(rewardCoins=${post3Db?.rewardCoins})`)

  // 再审第 2 篇：名次 2 ≤ 名额 → +2
  const a2 = await approve(post2Id)
  check('G3 第 2 篇审核通过', a2.status === 200, `(status=${a2.status})`)
  const m2 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G3 第 2 篇奖励 +2（余额 2）', m2?.credits === 2, `(credits=${m2?.credits})`)

  // 最后审第 1 篇：名次 1 → +2
  const a1 = await approve(post1Id)
  check('G3 第 1 篇审核通过', a1.status === 200, `(status=${a1.status})`)
  const m1 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G3 第 1 篇奖励 +2（余额 4）', m1?.credits === 4, `(credits=${m1?.credits})`)

  const logs = await prisma.coinLog.findMany({ where: { userId: user.id, type: 'reward', remark: '社区发帖奖励' }, orderBy: { createdAt: 'asc' } })
  check('G3 CoinLog 流水 2 条 +2', logs.length === 2 && logs.every(l => l.amount === 2), `(count=${logs.length})`)
  const rw = await prisma.communityReward.count({ where: { userId: user.id } })
  check('G3 CommunityReward 明细 2 条', rw === 2, `(count=${rw})`)

  // ── G4 非当日发帖：昨天发的帖今天审核 → 不奖励 ──
  console.log('\n── G4 非当日发帖（昨日帖今天审核 → 无奖励）──')
  const yesterday = new Date(Date.now() - 86400000)
  const extra1 = await prisma.communityPost.create({ data: { userId: user.id, title: '昨日帖A', content: '昨日内容A', status: 'pending', createdAt: yesterday } })
  await approve(extra1.id)
  const m3 = await prisma.membership.findUnique({ where: { userId: user.id } })
  check('G4 昨日帖审核后余额仍为 4', m3?.credits === 4, `(credits=${m3?.credits})`)
  const logAfter = await prisma.coinLog.count({ where: { userId: user.id, type: 'reward', remark: '社区发帖奖励' } })
  check('G4 流水仍为 2 条', logAfter === 2, `(count=${logAfter})`)
  const extra1Db = await prisma.communityPost.findUnique({ where: { id: extra1.id } })
  check('G4 昨日帖状态 approved 但 rewardCoins=0', extra1Db?.status === 'approved' && extra1Db?.rewardCoins === 0, `(status=${extra1Db?.status}, rewardCoins=${extra1Db?.rewardCoins})`)

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
