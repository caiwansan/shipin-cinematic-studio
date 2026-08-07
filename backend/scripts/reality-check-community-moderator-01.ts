/**
 * COMMUNITY-MODERATOR-01 — 社区版主体系 Reality Gate（掌柜 2026-08-07）
 *
 * 场景：会员申请成为版主/副版主 → 站长审批 → 版主管理帖子（审核/加精/置顶/删帖）
 *
 * G1 公开版主列表：初始空；在职版主展示昵称+角色
 * G2 申请流程：申请 → pending → /me 身份 → 重复申请 409 → 驳回后可重申
 * G3 权限边界：非版主访问管理接口 403；普通会员不能审批申请 401
 * G4 站长审批：批准为版主(active) / 批准为副版主(co_moderator) / 驳回(rejected)
 * G5 版主管理全链路：审核通过(+2钻) / 驳回(带原因) / 加精 / 置顶 / 删帖(软删)
 * G6 数据隔离：软删帖子不出现在公开列表；deleted 在版主管理列表可见
 * G7 卸任：removed 后管理权限失效 403；公开列表不再展示
 * G8 站长审批接口校验：申请不存在 404 / 重复批准 409
 *
 * 运行：npx tsx scripts/reality-check-community-moderator-01.ts
 */
import { prisma } from '../src/utils/index.js'
import bcrypt from 'bcryptjs'

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
  try { json = await res.json() } catch { /* 非 JSON */ }
  return { status: res.status, json }
}

async function main() {
  console.log('═══ COMMUNITY-MODERATOR-01 社区版主体系 Reality Gate ═══\n')
  const suffix = Date.now().toString().slice(-8)
  const password = 'Test@123456'

  // ── 准备：普通会员 userA（申请版主）/ userB（普通会员）/ 站长 ──
  const mkUser = async (prefix: string) => {
    const u = await prisma.user.create({
      data: { email: `${prefix}_${suffix}@test.local`, username: `${prefix}_${suffix}`, passwordHash: await bcrypt.hash(password, 10) },
    })
    const login = await api('/api/auth/login', 'POST', { email: u.email, password })
    return { user: u, token: login.json?.accessToken }
  }
  const A = await mkUser('moda')
  const B = await mkUser('modb')
  console.log(`  测试用户: A=${A.user.email} B=${B.user.email}`)

  const adminUsername = `mod_admin_${suffix}`
  await prisma.adminUser.create({
    data: { username: adminUsername, passwordHash: await bcrypt.hash('AdminTest@123', 10), role: 'superadmin', displayName: 'mod-test' },
  })
  const adminLogin = await api('/api/admin/login', 'POST', { username: adminUsername, password: 'AdminTest@123' })
  const adminToken = adminLogin.json?.token
  check('准备 站长登录成功', !!adminToken)

  // ── G1 公开版主列表 ──
  console.log('\n── G1 公开版主列表 ──')
  const g1 = await api('/api/community/moderators')
  check('G1 初始列表为空数组', Array.isArray(g1.json?.moderators) && g1.json.moderators.length === 0, `(count=${g1.json?.moderators?.length})`)

  // ── G2 申请流程 ──
  console.log('\n── G2 申请流程 ──')
  const ap1 = await api('/api/community/moderator/apply', 'POST', { note: '热爱社区，愿维护秩序' }, A.token)
  check('G2 申请成功 → pending', ap1.status === 200 && ap1.json?.status === 'pending', `(status=${ap1.json?.status})`)
  const me = await api('/api/community/moderator/me', 'GET', undefined, A.token)
  check('G2 /me 返回申请中', me.json?.status === 'pending' && me.json?.isModerator === false)
  const ap2 = await api('/api/community/moderator/apply', 'POST', {}, A.token)
  check('G2 重复申请 → 409', ap2.status === 409, `(status=${ap2.status})`)

  // ── G3 权限边界 ──
  console.log('\n── G3 权限边界 ──')
  const g3a = await api('/api/community/moderator/posts?status=pending', 'GET', undefined, A.token)
  check('G3 申请中(非版主)管理 → 403', g3a.status === 403, `(status=${g3a.status})`)
  const g3b = await api('/api/community/moderator/posts?status=pending', 'GET', undefined, B.token)
  check('G3 普通会员管理 → 403', g3b.status === 403, `(status=${g3b.status})`)
  const g3c = await api('/api/community/moderator/posts?status=pending', 'GET')
  check('G3 未登录管理 → 401', g3c.status === 401, `(status=${g3c.status})`)
  const g3d = await api('/api/community/admin/moderator/applications', 'GET', undefined, undefined, 'bad-token')
  check('G3 无效站长 token → 401', g3d.status === 401, `(status=${g3d.status})`)

  // ── G4 站长审批 ──
  console.log('\n── G4 站长审批 ──')
  const apps = await api('/api/community/admin/moderator/applications', 'GET', undefined, undefined, adminToken)
  const appA = apps.json?.applications?.find((a: any) => a.userId === A.user.id)
  check('G4 申请出现在站长列表', !!appA, `(status=${appA?.status})`)
  const apr1 = await api(`/api/community/admin/moderator/applications/${appA.id}/approve`, 'PATCH', { role: 'moderator' }, undefined, adminToken)
  check('G4 批准为版主', apr1.status === 200 && apr1.json?.role === 'moderator', `(role=${apr1.json?.role})`)
  const me2 = await api('/api/community/moderator/me', 'GET', undefined, A.token)
  check('G4 批准后 /me 是版主', me2.json?.isModerator === true && me2.json?.role === 'moderator')
  const g4dup = await api(`/api/community/admin/moderator/applications/${appA.id}/approve`, 'PATCH', {}, undefined, adminToken)
  check('G4 重复批准 → 409', g4dup.status === 409, `(status=${g4dup.status})`)
  const g4nf = await api('/api/community/admin/moderator/applications/00000000-0000-0000-0000-000000000000/approve', 'PATCH', {}, undefined, adminToken)
  check('G4 不存在申请 → 404', g4nf.status === 404, `(status=${g4nf.status})`)

  // B 申请副版主
  await api('/api/community/moderator/apply', 'POST', { note: '申请副版主' }, B.token)
  const apps2 = await api('/api/community/admin/moderator/applications', 'GET', undefined, undefined, adminToken)
  const appB = apps2.json?.applications?.find((a: any) => a.userId === B.user.id)
  const aprB = await api(`/api/community/admin/moderator/applications/${appB.id}/approve`, 'PATCH', { role: 'co_moderator' }, undefined, adminToken)
  check('G4 批准为副版主', aprB.status === 200 && aprB.json?.role === 'co_moderator', `(role=${aprB.json?.role})`)
  const meB = await api('/api/community/moderator/me', 'GET', undefined, B.token)
  check('G4 副版主 /me 正确', meB.json?.isModerator === true && meB.json?.role === 'co_moderator')

  // ── G5 版主管理全链路 ──
  console.log('\n── G5 版主管理全链路 ──')
  const g1list = await api('/api/community/moderators')
  check('G5 公开列表展示 2 位版主', g1list.json?.moderators?.length === 2, `(count=${g1list.json?.moderators?.length})`)
  check('G5 列表含昵称与角色', g1list.json?.moderators?.some((m: any) => m.role === 'moderator' && m.nickname) === true)

  // 发 3 帖：p1(通过) p2(驳回) p3(删除)
  const mkPost = async (token: string, title: string) => {
    const r = await api('/api/community/posts', 'POST', { title, content: `内容-${title}` }, token)
    return r.json?.post?.id
  }
  const p1 = await mkPost(B.token, '版主测试帖-通过')
  const p2 = await mkPost(B.token, '版主测试帖-驳回')
  const p3 = await mkPost(B.token, '版主测试帖-删除')

  const apr = await api(`/api/community/moderator/posts/${p1}/approve`, 'PATCH', undefined, A.token)
  check('G5 版主审核通过', apr.status === 200 && apr.json?.success === true, `(status=${apr.status})`)
  const p1db = await prisma.communityPost.findUnique({ where: { id: p1 } })
  check('G5 通过后 status=approved + 奖励', p1db?.status === 'approved' && p1db?.rewardCoins === 2, `(status=${p1db?.status}, rewardCoins=${p1db?.rewardCoins})`)
  check('G5 reviewedBy 记录版主身份', (p1db?.reviewedBy || '').includes('版主'), `(${p1db?.reviewedBy})`)

  const rej = await api(`/api/community/moderator/posts/${p2}/reject`, 'PATCH', { reason: '内容违规' }, A.token)
  check('G5 版主驳回(带原因)', rej.status === 200, `(status=${rej.status})`)
  const p2db = await prisma.communityPost.findUnique({ where: { id: p2 } })
  check('G5 驳回状态+原因落库', p2db?.status === 'rejected' && p2db?.rejectReason === '内容违规', `(status=${p2db?.status}, reason=${p2db?.rejectReason})`)

  const ess = await api(`/api/community/moderator/posts/${p1}/essence`, 'PATCH', undefined, A.token)
  check('G5 加精', ess.json?.isEssence === true)
  const pin = await api(`/api/community/moderator/posts/${p1}/pin`, 'PATCH', undefined, A.token)
  check('G5 置顶', pin.json?.isPinned === true)
  const pin2 = await api(`/api/community/moderator/posts/${p1}/pin`, 'PATCH', undefined, A.token)
  check('G5 取消置顶', pin2.json?.isPinned === false)
  await api(`/api/community/moderator/posts/${p1}/pin`, 'PATCH', undefined, A.token) // 恢复置顶

  const del = await api(`/api/community/moderator/posts/${p3}`, 'DELETE', undefined, A.token)
  check('G5 版主删帖', del.status === 200, `(status=${del.status})`)
  const p3db = await prisma.communityPost.findUnique({ where: { id: p3 } })
  check('G5 删帖=软删 status=deleted（数据保留）', p3db?.status === 'deleted', `(status=${p3db?.status})`)

  // ── G6 数据隔离 ──
  console.log('\n── G6 数据隔离 ──')
  const pub = await api('/api/community/posts?pageSize=50')
  const pubTitles = (pub.json?.posts || []).map((p: any) => p.title)
  check('G6 软删帖不出现在公开列表', !pubTitles.includes('版主测试帖-删除'))
  check('G6 已驳回帖不出现在公开列表', !pubTitles.includes('版主测试帖-驳回'))
  check('G6 已通过帖出现在公开列表', pubTitles.includes('版主测试帖-通过'))
  const modList = await api('/api/community/moderator/posts?status=deleted', 'GET', undefined, A.token)
  check('G6 版主管理列表可见已删除帖', (modList.json?.posts || []).some((p: any) => p.id === p3))

  // ── G7 卸任 ──
  console.log('\n── G7 卸任 ──')
  const rm = await api(`/api/community/admin/moderators/${appB.id}/remove`, 'PATCH', undefined, undefined, adminToken)
  check('G7 卸任成功', rm.status === 200, `(status=${rm.status})`)
  const meB2 = await api('/api/community/moderator/me', 'GET', undefined, B.token)
  check('G7 卸任后 /me 非版主', meB2.json?.isModerator === false && meB2.json?.status === 'removed')
  const g7a = await api('/api/community/moderator/posts?status=pending', 'GET', undefined, B.token)
  check('G7 卸任后管理 → 403', g7a.status === 403, `(status=${g7a.status})`)
  const g7b = await api('/api/community/moderators')
  check('G7 公开列表只剩 1 位版主', g7b.json?.moderators?.length === 1, `(count=${g7b.json?.moderators?.length})`)

  // ── G8 驳回后重申 ──
  console.log('\n── G8 驳回后重申 ──')
  // 先让 C 申请被驳回，再重申
  const C = await mkUser('modc')
  await api('/api/community/moderator/apply', 'POST', { note: '第一次申请' }, C.token)
  const apps3 = await api('/api/community/admin/moderator/applications', 'GET', undefined, undefined, adminToken)
  const appC = apps3.json?.applications?.find((a: any) => a.userId === C.user.id)
  await api(`/api/community/admin/moderator/applications/${appC.id}/reject`, 'PATCH', undefined, undefined, adminToken)
  const meC1 = await api('/api/community/moderator/me', 'GET', undefined, C.token)
  check('G8 驳回后状态 rejected', meC1.json?.status === 'rejected')
  const reapp = await api('/api/community/moderator/apply', 'POST', { note: '重申' }, C.token)
  check('G8 重申成功 → pending', reapp.status === 200 && reapp.json?.status === 'pending' && reapp.json?.reapplied === true, `(reapplied=${reapp.json?.reapplied})`)

  // ── 清理 ──
  for (const { user } of [A, B, C]) {
    await prisma.communityModerator.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await prisma.communityPost.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await prisma.coinLog.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await prisma.membership.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  }
  await prisma.adminUser.delete({ where: { username: adminUsername } }).catch(() => {})

  console.log(`\n═══ 结果: ${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error('脚本异常:', e); process.exit(1) })
