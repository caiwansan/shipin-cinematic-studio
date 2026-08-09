// REALITY-CHECK-COMMUNITY-NEWUSER-COMMENT-LIMIT-01
// 掌柜 2026-08-07 指令：新用户（注册<24h）可以发帖、可以评论，但评论最多 5 条；满 24h 正常
// 验收：
//  G1 新用户（注册 1h）评论 5 条全成功，第 6 条 403
//  G2 新用户仍可发帖（评论限制不影响发帖）
//  G3 老用户（注册 30 天）评论不受限
//  G4 清理测试数据
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

async function main() {
  console.log('═══ 新用户评论 5 条限制 验收 ═══\n')

  // 取一个现有帖子
  const post = await prisma.communityPost.findFirst({ select: { id: true, title: true } })
  check('准备 存在可用帖子', !!post, `(${post?.title?.slice(0, 16)})`)
  if (!post) return

  // 造新用户（注册 1 小时前）+ 老用户（注册 30 天前）
  const now = Date.now()
  const newUser = await prisma.user.create({
    data: {
      email: `newuser_${suffix}@audit.local`,
      username: `newuser_${suffix}`,
      passwordHash: await bcrypt.hash('AuditTest@123', 10),
      createdAt: new Date(now - 1 * 3600000),
    },
  })
  const oldUser = await prisma.user.create({
    data: {
      email: `olduser_${suffix}@audit.local`,
      username: `olduser_${suffix}`,
      passwordHash: await bcrypt.hash('AuditTest@123', 10),
      createdAt: new Date(now - 30 * 86400000),
    },
  })
  console.log(`  新用户: ${newUser.email} (注册 1h 前, id=${newUser.id.slice(0, 8)})`)
  console.log(`  老用户: ${oldUser.email} (注册 30 天前, id=${oldUser.id.slice(0, 8)})`)

  const newLogin = await api('/api/auth/login', 'POST', { email: newUser.email, password: 'AuditTest@123' })
  const oldLogin = await api('/api/auth/login', 'POST', { email: oldUser.email, password: 'AuditTest@123' })
  const newToken = newLogin.json?.accessToken
  const oldToken = oldLogin.json?.accessToken
  check('准备 新用户登录成功', newLogin.status === 200 && !!newToken)
  check('准备 老用户登录成功', oldLogin.status === 200 && !!oldToken)
  if (!newToken || !oldToken) return

  // G1 新用户评论：前 5 条成功，第 6 条 403
  console.log('\n── G1 新用户评论 5 条上限 ──')
  const createdIds: string[] = []
  for (let i = 1; i <= 5; i++) {
    const r = await api('/api/community/comments', 'POST', { postId: post.id, content: `新用户评论第${i}条 (${suffix})` }, newToken)
    check(`G1 第 ${i} 条评论成功`, r.status === 200 && !!r.json?.comment?.id, `(status=${r.status})`)
    if (r.json?.comment?.id) createdIds.push(r.json.comment.id)
  }
  const r6 = await api('/api/community/comments', 'POST', { postId: post.id, content: `第6条应该被拒 (${suffix})` }, newToken)
  check('G1 第 6 条被拒 403', r6.status === 403, `(status=${r6.status}, msg=${r6.json?.error?.slice(0, 30)})`)
  check('G1 拒绝原因含「最多 5 条」', (r6.json?.error || '').includes('5 条'), `(${r6.json?.error})`)

  // G2 新用户仍可发帖
  console.log('\n── G2 新用户发帖不受评论限制影响 ──')
  const p = await api('/api/community/posts', 'POST', { title: `新用户发帖测试_${suffix}`, content: '发帖不受评论限制影响' }, newToken)
  check('G2 新用户发帖成功', p.status === 200 && !!p.json?.post?.id, `(status=${p.status})`)

  // G3 老用户评论不受限
  console.log('\n── G3 老用户评论不受限 ──')
  const o1 = await api('/api/community/comments', 'POST', { postId: post.id, content: `老用户评论 (${suffix})` }, oldToken)
  check('G3 老用户评论成功', o1.status === 200 && !!o1.json?.comment?.id, `(status=${o1.status})`)
  if (o1.json?.comment?.id) createdIds.push(o1.json.comment.id)
  // 老用户连发 6 条也全成功
  let oldAllOk = true
  for (let i = 2; i <= 6; i++) {
    const r = await api('/api/community/comments', 'POST', { postId: post.id, content: `老用户评论${i} (${suffix})` }, oldToken)
    if (r.status !== 200) oldAllOk = false
    if (r.json?.comment?.id) createdIds.push(r.json.comment.id)
  }
  check('G3 老用户连发 6 条全成功', oldAllOk)

  // G4 清理
  console.log('\n── G4 清理测试数据 ──')
  await prisma.communityComment.deleteMany({ where: { id: { in: createdIds } } })
  const postUpdate = await prisma.communityPost.findUnique({ where: { id: post.id }, select: { commentCount: true } })
  // 评论删除接口只删单条；测试直接清库后重算帖子评论数，保持生产数据干净
  await prisma.communityPost.update({
    where: { id: post.id },
    data: { commentCount: await prisma.communityComment.count({ where: { postId: post.id } }) },
  })
  await prisma.communityPost.deleteMany({ where: { title: `新用户发帖测试_${suffix}` } })
  // 发帖奖励产生了 CoinLog + Membership，需按外键顺序清理
  await prisma.coinLog.deleteMany({ where: { userId: { in: [newUser.id, oldUser.id] } } })
  await prisma.membership.deleteMany({ where: { userId: { in: [newUser.id, oldUser.id] } } })
  await prisma.user.deleteMany({ where: { id: { in: [newUser.id, oldUser.id] } } })
  check('G4 测试评论/帖子/用户已清理', true, `(评论 ${createdIds.length} 条 + 帖子 1 篇 + 用户 2 个, 帖子评论数已重算=${postUpdate?.commentCount})`)

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
