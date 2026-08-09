// REALITY-CHECK-COMMUNITY-READ-TRACKING-01
// 掌柜 2026-08-07 拍板：完读率埋点阶段一（只采集落库，不接排序公式）
// 验收：
//  G1 有效会话（>=15s && >=40%）落库
//  G2 30s 内重复上报被限频丢弃（幂等防刷）
//  G3 无效会话（<15s 且 <40%）静默忽略不落库
//  G4 query token 认证（sendBeacon 场景）可用
//  G5 无效 token → 401
//  G6 read-stats 聚合正确（sessions/avgSeconds/validSessions/completion）
//  G7 清理测试数据
import { prisma } from '../src/utils/index.js'
import bcrypt from 'bcryptjs'

const suffix = Date.now().toString().slice(-6)
const BASE = 'http://127.0.0.1:4002'
let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${detail ? ` ${detail}` : ''}`)
  ok ? pass++ : fail++
}

async function api(path: string, method = 'GET', body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log('═══ 完读率埋点 阶段一 验收 ═══\n')

  const post = await prisma.communityPost.findFirst({ select: { id: true, title: true, viewCount: true } })
  check('准备 存在可用帖子', !!post, `(${post?.title?.slice(0, 14)}, views=${post?.viewCount})`)
  if (!post) return

  const user = await prisma.user.create({
    data: {
      email: `readtest_${suffix}@audit.local`,
      username: `readtest_${suffix}`,
      passwordHash: await bcrypt.hash('AuditTest@123', 10),
      createdAt: new Date(Date.now() - 30 * 86400000),
    },
  })
  const login = await api('/api/auth/login', 'POST', { email: user.email, password: 'AuditTest@123' })
  const token = login.json?.accessToken
  check('准备 用户登录成功', login.status === 200 && !!token)

  const report = (seconds: number, depth: number, t?: string) =>
    api(`/api/community/posts/${post.id}/read-progress`, 'POST', { seconds, depth }, t || token)

  // G1 有效会话落库
  console.log('\n── G1 有效会话落库 ──')
  const r1 = await report(30, 0.8)
  check('G1 30s/80% 会话上报成功', r1.status === 200 && r1.json?.ok === true, `(status=${r1.status})`)

  // G2 30s 内重复上报被限频
  console.log('\n── G2 限频幂等 ──')
  const r2 = await report(45, 0.9)
  check('G2 立即重复上报被丢弃(rate_limited)', r2.json?.ignored === 'rate_limited', `(${JSON.stringify(r2.json)})`)

  // G3 无效会话静默忽略
  console.log('\n── G3 无效会话忽略 ──')
  await sleep(31_000)
  const r3 = await report(5, 0.1)
  check('G3 5s/10% 无效会话被忽略', r3.status === 200 && r3.json?.ok === true && !r3.json?.ignored, `(status=${r3.status})`)

  // G4 query token（sendBeacon 场景）
  console.log('\n── G4 query token 认证 ──')
  const r4 = await fetch(`${BASE}/api/community/posts/${post.id}/read-progress?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seconds: 45, depth: 0.9 }),
  }).then((r) => r.json())
  check('G4 query token 上报成功', r4?.ok === true, `(${JSON.stringify(r4)})`)

  // G5 无效 token → 401
  console.log('\n── G5 无效 token ──')
  const r5 = await report(30, 0.8, 'invalid.token.here')
  check('G5 无效 token 被拒 401', r5.status === 401, `(status=${r5.status})`)

  // G6 聚合正确
  console.log('\n── G6 read-stats 聚合 ──')
  const stats = await api(`/api/community/posts/${post.id}/read-stats`)
  const s = stats.json
  check('G6 sessions=2（有效30s + query45s；重复/无效被滤）', s?.sessions === 2, `(sessions=${s?.sessions})`)
  check('G6 avgSeconds=(30+45)/2=38', s?.avgSeconds === 38, `(avg=${s?.avgSeconds})`)
  check('G6 validSessions=2', s?.validSessions === 2, `(valid=${s?.validSessions})`)
  check('G6 completion=2/viewCount', s?.completion === 2 / (post.viewCount || 1), `(completion=${s?.completion?.toFixed(3)})`)

  // G7 清理
  console.log('\n── G7 清理 ──')
  await prisma.communityReadSession.deleteMany({ where: { userId: user.id } })
  await prisma.membership.deleteMany({ where: { userId: user.id } })
  await prisma.user.deleteMany({ where: { id: user.id } })
  check('G7 测试会话/用户已清理', true, `(sessions=${s?.sessions} 条 + 用户 1 个)`)

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
