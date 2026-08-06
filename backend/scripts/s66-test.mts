/**
 * S6.6 Enterprise Center Polish — Reality Gate（EC1-EC6）
 * EC1 中心聚合（org+成员）/ EC2 三员工 / EC3 插件 / EC4 套餐
 * EC5 权限隔离（非管理员 403 + 入口隐藏） / EC6 三员工回归
 */
import { prisma } from '../src/utils/index.js'
import { executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''

console.log('══ S6.6 Enterprise Center Reality Gate（EC1-EC6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// 临时提升 owner（测试后还原）
const org = await prisma.organization.findUnique({ where: { id: ORG_A }, select: { ownerId: true } })
const prevOwner = org!.ownerId
await prisma.organization.update({ where: { id: ORG_A }, data: { ownerId: USER_A } })
const loginA = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const HA = { Authorization: `Bearer ${loginA.accessToken}` }
const loginB = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())

const ent = await fetch(`${API}/api/admin/enterprise`, { headers: HA }).then(r => r.json()).catch(() => null)
const billing = await fetch(`${API}/api/admin/billing/overview`, { headers: HA }).then(r => r.json()).catch(() => null)

// ── EC1: 中心聚合 ──
console.log('\n── EC1: Enterprise Center 聚合 ──')
check('EC1 企业信息（名称/owner）', !!ent?.data?.organization?.name && !!ent?.data?.organization?.ownerId, ent?.data?.organization)
check('EC1 成员列表（含 owner 与当前用户）', Array.isArray(ent?.data?.members) && ent.data.members.length >= 1 && ent.data.members.some((m: any) => m.email === 'tenant_org_test@audit.local'), ent?.data?.members?.map((m: any) => m.email))

// ── EC2: 三员工 ──
console.log('\n── EC2: AI 员工 ──')
const empCodes = (billing?.data?.employees || []).map((e: any) => e.code)
check('EC2 三员工聚合展示', ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops'].every((c) => empCodes.includes(c)), empCodes)

// ── EC3: 插件 ──
console.log('\n── EC3: 插件增强 ──')
const plugCodes = (billing?.data?.plugins || []).map((p: any) => p.code)
check('EC3 插件增强列表（含 JD 模板）', plugCodes.includes('plugin-recruitment-jd-template'), plugCodes)

// ── EC4: 套餐 ──
console.log('\n── EC4: 套餐信息 ──')
check('EC4 套餐视图（Professional 3/3 derived）', billing?.data?.plan?.tier === 'Professional' && billing?.data?.plan?.employeeCount === 3, billing?.data?.plan)

// ── EC5: 权限隔离 ──
console.log('\n── EC5: 权限隔离 ──')
const bRes = await fetch(`${API}/api/admin/enterprise`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json()).catch(() => null)
check('EC5 B 用户（非 A 管理员）→ 403', bRes?.error === 'FORBIDDEN' || bRes?.error === 'NO_ORGANIZATION', bRes)
const noToken = await fetch(`${API}/api/admin/enterprise`).then(r => r.status)
check('EC5 无 token → 401', noToken === 401, noToken)

// ── EC6: 三员工回归 + 还原 ──
console.log('\n── EC6: 三员工回归 ──')
await prisma.organization.update({ where: { id: ORG_A }, data: { ownerId: prevOwner } })
check('EC6 owner 已还原', (await prisma.organization.findUnique({ where: { id: ORG_A }, select: { ownerId: true } }))?.ownerId === prevOwner, prevOwner)
const rA = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
const rD = await executeSkillPlan({
  employeeDefinitionId: 'def-shortdrama-director', tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }],
}).catch(() => null)
const rN = await executeSkillPlan({
  employeeDefinitionId: 'def-newmedia-ops', tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }],
}).catch(() => null)
check('EC6 Alice 回归 COMPLETED', rA?.plan?.status === 'COMPLETED', rA?.plan?.status)
check('EC6 短剧导演回归 COMPLETED', rD?.plan?.status === 'COMPLETED', rD?.plan?.status)
check('EC6 新媒体回归 COMPLETED', rN?.plan?.status === 'COMPLETED', rN?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
