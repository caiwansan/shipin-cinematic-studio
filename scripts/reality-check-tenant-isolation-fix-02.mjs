// SPRINT-MEDIA-TENANT-ISOLATION-FIX-02 Reality Gate
// 方案 A（掌柜批准）：ChannelAccount = 用户私有资产（ownerId 第一归属）+ ChannelAccountShare 授权层
// 无授权组（A1-A6 应 PASS）：跨企业 403 / 同企业无授权不可见 / IDOR 关闭 / 写路径防串号
// 授权组（A7-A9）：share READ 可见 → MANAGE 可管理 → 撤销不可见（系统种子后验证）
import { readFileSync } from 'node:fs'

const API = 'http://127.0.0.1:4002'
const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}  ${name} — ${detail}`)
}

async function login(account, password = 'AuditTest@123') {
  const r = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  return (await r.json()).accessToken
}

const tB = await login('tenant_org_test@audit.local') // 昆仑镜账号 B（非南波万 owner）
const tIso = await login('tenant_iso_test@audit.local') // 无组织用户
const HB = { Authorization: 'Bearer ' + tB }
const HI = { Authorization: 'Bearer ' + tIso }

// 南波万账号（ownerId=0ba5bf98 幽灵，非账号B）
const all = await (await fetch(API + '/api/enterprise/channels/accounts', { headers: HB })).json()
const southDouyin = (await (await fetch(API + '/api/enterprise/channels/accounts', { headers: HB })).json())
// 通过全局拿南波万 id（用旧 org 列表接口不受用户过滤影响？——不，用已知 id）
// 直接查 DB 拿南波万账号 id（验收脚本用管理通道，不依赖受限 API）
const { PrismaClient } = await import('/root/shipin-cinematic-studio/backend/node_modules/@prisma/client/index.js')
const prisma = new PrismaClient()
const south = await prisma.enterpriseChannelAccount.findFirst({ where: { channelName: '南坡万' } })
const southId = south.id

// ═══ 无授权组 ═══
// A1 跨企业：无组织用户 owner-view 403（保持）
const isoOv = await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', { headers: HI })
record('A1 无组织用户 owner-view 403（跨企业隔离保持）', isoOv.status === 403, `status=${isoOv.status}`)

// A2 同企业无授权：账号B accounts 不含南波万
const acB = await (await fetch(API + '/api/enterprise/channels/accounts', { headers: HB })).json()
const hasSouth = (acB.data || []).some((a) => a.id === southId)
record('A2 账号B(无授权) 账号列表不含南波万', !hasSouth, `账号B 列表 ${(acB.data || []).length} 条，南波万${hasSouth ? '可见❌' : '不可见✅'}`)

// A3 同企业无授权：账号B owner-view 不含南波万 workspace
const ovB = await (await fetch(API + '/api/enterprise/workspaces/owner-view?businessType=media', { headers: HB })).json()
const wsOfSouth = (ovB.data || []).filter((w) => String(w.channelAccountId) === southId)
record('A3 账号B(无授权) owner-view 不含南波万 workspace', wsOfSouth.length === 0, `返回 ${(ovB.data || []).length} 条，南波万 workspace ${wsOfSouth.length} 条`)

// A4 IDOR 关闭：无组织用户读南波万 reality 403
const r4 = await fetch(API + '/api/enterprise/channels/' + southId + '/reality', { headers: HI })
record('A4 无组织用户读南波万 reality 403（IDOR 关闭）', r4.status === 403, `status=${r4.status}`)

// A5 同企业无授权：账号B 读南波万 reality 403
const r5 = await fetch(API + '/api/enterprise/channels/' + southId + '/reality', { headers: HB })
record('A5 账号B(无授权) 读南波万 reality 403', r5.status === 403, `status=${r5.status}`)

// A6 写路径防串号：账号B ensure-account 不得取到南波万账号（应新建自己账号）
const r6 = await fetch(API + '/api/enterprise/channels/runtime/douyin/ensure-account', { method: 'POST', headers: HB })
const r6j = await r6.json()
const ensuredId = r6j.data?.id
const ensured = ensuredId ? await prisma.enterpriseChannelAccount.findUnique({ where: { id: ensuredId } }) : null
const ensuredOwner = ensured?.ownerId ? await prisma.user.findUnique({ where: { id: ensured.ownerId } }).catch(() => null) : null
record(
  'A6 账号B ensure-account 不串号（新建 owner=自己的账号）',
  !!ensured && ensured.id !== southId && !!ensuredOwner && ensuredOwner.email === 'tenant_org_test@audit.local',
  `ensure 返回 ${ensuredId === southId ? '南波万❌' : String(ensuredId).slice(0, 8)}（owner=${String(ensured?.ownerId).slice(0, 8)} → ${ensuredOwner?.email || '非账号B❌'}）`
)

// ═══ 授权组（系统种子：南波万 → 账号B MANAGE）═══
const tBUser = await prisma.user.findUnique({ where: { email: 'tenant_org_test@audit.local' } })
await prisma.channelAccountShare.upsert({
  where: { channelAccountId_granteeUserId: { channelAccountId: southId, granteeUserId: tBUser.id } },
  create: { channelAccountId: southId, granteeUserId: tBUser.id, permission: 'MANAGE', createdBy: 'system' },
  update: { permission: 'MANAGE' },
})
console.log('  种子：南波万 → 账号B MANAGE 已插入')

// A7 授权后可见：账号B accounts 含南波万 + reality 200
const acB2 = await (await fetch(API + '/api/enterprise/channels/accounts', { headers: HB })).json()
const hasSouth2 = (acB2.data || []).some((a) => a.id === southId)
const r7 = await fetch(API + '/api/enterprise/channels/' + southId + '/reality', { headers: HB })
record('A7 授权(MANAGE)后 账号B 可见南波万（列表+reality 200）', hasSouth2 && r7.status === 200, `列表${hasSouth2 ? '可见' : '不可见'}, reality=${r7.status}`)

// A8 MANAGE 可管理：账号B 给账号C 创建 share
const r8 = await fetch(API + '/api/enterprise/channels/' + southId + '/shares', {
  method: 'POST',
  headers: { ...HB, 'Content-Type': 'application/json' },
  body: JSON.stringify({ granteeUserId: '00000000-0000-0000-0000-00000000test', permission: 'READ' }),
})
record('A8 MANAGE 授权人可创建共享', r8.status === 200, `status=${r8.status}（授权层管理面生效）`)

// A9 撤销后不可见：撤销账号B 的 MANAGE → accounts 不再含南波万
await prisma.channelAccountShare.deleteMany({ where: { channelAccountId: southId, granteeUserId: tBUser.id } })
const acB3 = await (await fetch(API + '/api/enterprise/channels/accounts', { headers: HB })).json()
const hasSouth3 = (acB3.data || []).some((a) => a.id === southId)
record('A9 撤销授权后 账号B 不可见南波万', !hasSouth3, `撤销后列表含南波万：${hasSouth3 ? '❌' : '✅'}`)

await prisma.$disconnect()
const fails = results.filter((r) => !r.pass)
console.log(`\n结果: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL`)
