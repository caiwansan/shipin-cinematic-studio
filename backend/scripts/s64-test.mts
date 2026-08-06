/**
 * S6.4 Phase B Billing UI Reality — Reality Gate（BL1-BL6）
 * BL1 Plan 视图真实 / BL2 三员工授权 / BL3 Capability 来自 F1
 * BL4 Usage 与 InvocationLog 一致 / BL5 非管理员 403 / BL6 三员工回归
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeUsageMeter, executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''

console.log('══ S6.4 Billing UI Reality Gate（BL1-BL6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// 临时提升 A 用户为 owner（测试后还原）
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

const overview = await fetch(`${API}/api/admin/billing/overview`, { headers: HA }).then(r => r.json()).catch(() => null)
const data = overview?.data

// ── BL1: Plan Reality ──
console.log('\n── BL1: Plan Reality ──')
check('BL1 overview 返回 plan 视图（derived）', !!data?.plan && data.plan.source === 'derived' && data.plan.employeeCount === 3, data?.plan)
check('BL1 席位推导 Professional（3 员工）', data?.plan?.tier === 'Professional' && data?.plan?.employeeLimit === 3, data?.plan)

// ── BL2: Employee Reality ──
console.log('\n── BL2: Employee Reality ──')
const codes = (data?.employees || []).map((e: any) => e.code)
check('BL2 三员工授权展示', ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops'].every((c) => codes.includes(c)), codes)

// ── BL3: Capability 来自 F1 ──
console.log('\n── BL3: Capability Reality（F1）──')
const aliceView = (data?.employees || []).find((e: any) => e.code === 'def-recruiter-alice')
const aliceDef = await prisma.agentDefinition.findUnique({ where: { code: 'def-recruiter-alice' } })
const f1Caps = JSON.parse(aliceDef!.capabilities)
check('BL3 Alice capabilities 来自 agent_definition（F1, 4 能力）', JSON.stringify(aliceView?.capabilities) === JSON.stringify(f1Caps) && f1Caps.length === 4, aliceView?.capabilities)

// ── BL4: Usage 一致性 ──
console.log('\n── BL4: Usage Reality ──')
const meterAlice = await getEmployeeUsageMeter(USER_A, 'def-recruiter-alice')
const viewAliceUsage = aliceView?.usage
check('BL4 overview usage = Usage Meter（Alice）', viewAliceUsage?.executions === meterAlice.executions && viewAliceUsage?.successful === meterAlice.successful, { view: viewAliceUsage, meter: { e: meterAlice.executions, s: meterAlice.successful } })
const totalFromMeters = (await Promise.all(codes.map((c: string) => getEmployeeUsageMeter(USER_A, c)))).reduce((n, m) => n + m.executions, 0)
check('BL4 activity.totalExecutions = 员工 Meter 求和', data?.activity?.totalExecutions === totalFromMeters, { api: data?.activity?.totalExecutions, sum: totalFromMeters })

// ── BL5: 非管理员拒绝 ──
console.log('\n── BL5: Permission Reality ──')
const bRes = await fetch(`${API}/api/admin/billing/overview`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json()).catch(() => null)
check('BL5 B 用户（非 A 管理员）→ 403', bRes?.error === 'FORBIDDEN' || bRes?.error === 'NO_ORGANIZATION', bRes)
const noToken = await fetch(`${API}/api/admin/billing/overview`).then(r => r.status)
check('BL5 无 token → 401', noToken === 401, noToken)

// ── BL6: 三员工回归 + 还原 ──
console.log('\n── BL6: 三员工回归 ──')
await prisma.organization.update({ where: { id: ORG_A }, data: { ownerId: prevOwner } })
check('BL6 owner 已还原', (await prisma.organization.findUnique({ where: { id: ORG_A }, select: { ownerId: true } }))?.ownerId === prevOwner, prevOwner)
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
check('BL6 Alice 回归 COMPLETED', rA?.plan?.status === 'COMPLETED', rA?.plan?.status)
check('BL6 短剧导演回归 COMPLETED', rD?.plan?.status === 'COMPLETED', rD?.plan?.status)
check('BL6 新媒体回归 COMPLETED', rN?.plan?.status === 'COMPLETED', rN?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
