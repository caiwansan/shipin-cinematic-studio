/**
 * S6.3 Enterprise Admin Reality — Reality Gate（EA1-EA6）
 * EA1 管理员身份（A 管理员可管理 A, 不能访问 B）
 * EA2 员工管理（看到三员工）/ EA3 Usage 聚合 / EA4 Plugin 可见
 * EA5 Desktop 普通用户不受影响 / EA6 三员工回归
 */
import { prisma } from '../src/utils/index.js'
import { isOrgAdmin } from '../src/routes/enterprise-admin.routes.js'
import { executeSkillPlan } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const ORG_A = '11111111-2222-4333-8444-555555555555'
const ORG_B = 'ce80a00f-b4c3-4912-b9e3-380fa33dc46e'
const USER_A = process.env.TENANT_A_USER || ''
const USER_B = process.env.TENANT_B_USER || ''

console.log('══ S6.3 Enterprise Admin Reality Gate（EA1-EA6）══')
check('前置: 租户 A/B', !!USER_A && !!USER_B, { A: USER_A, B: USER_B })
if (!USER_A || !USER_B) process.exit(1)

// ── EA1: 管理员身份（纯函数）──
console.log('\n── EA1: 管理员身份 ──')
const realOwner = await prisma.organization.findUnique({ where: { id: ORG_A }, select: { ownerId: true } }).catch(() => null)
check('EA1 前置: org A owner 存在', !!realOwner?.ownerId, realOwner?.ownerId)
check('EA1 owner 是管理员', (await isOrgAdmin(realOwner!.ownerId!, ORG_A)) === true, 'owner=true')
check('EA1 A 普通用户不是管理员', (await isOrgAdmin(USER_A, ORG_A)) === false, 'member=false')
check('EA1 B 用户不能管理 A', (await isOrgAdmin(USER_B, ORG_A)) === false, 'b-for-a=false')

// ── EA1-API: 管理员 API 鉴权（临时提升 A 用户为 owner, 测试后还原）──
console.log('\n── EA1-API: 管理员 API 鉴权 ──')
const prevOwner = realOwner!.ownerId
await prisma.organization.update({ where: { id: ORG_A }, data: { ownerId: USER_A } })
const loginA = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const HA = { Authorization: `Bearer ${loginA.accessToken}` }
const adminEmps = await fetch(`${API}/api/admin/employees`, { headers: HA }).then(r => r.json()).catch(() => null)
check('EA1 管理员可访问 /api/admin/employees', Array.isArray(adminEmps?.data?.employees), adminEmps?.data?.employees?.length)
const loginB = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const adminB2 = await fetch(`${API}/api/admin/employees`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json()).catch(() => null)
check('EA1 B 用户（非 A 管理员）→ 403', adminB2?.error === 'FORBIDDEN' || adminB2?.error === 'NO_ORGANIZATION', adminB2)

// ── EA2: 员工管理（看到三员工授权）──
console.log('\n── EA2: 员工管理 ──')
const emps = adminEmps?.data?.employees || []
check('EA2 管理员看到企业已购员工（含三员工）', ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops'].every((c) => emps.some((e: any) => e.employeeCode === c)), emps.map((e: any) => e.employeeCode))
check('EA2 员工带用量摘要', emps.every((e: any) => typeof e.usage?.executions === 'number'), emps.map((e: any) => e.usage?.executions))

// ── EA3: Usage 聚合（admin usage API 与 Meter 一致）──
console.log('\n── EA3: Usage 聚合 ──')
const adminUsage = await fetch(`${API}/api/admin/employees/def-recruiter-alice/usage`, { headers: HA }).then(r => r.json()).catch(() => null)
const { getEmployeeUsageMeter } = await import('../src/ecosystem/skill-orchestrator.js')
const meter = await getEmployeeUsageMeter(USER_A, 'def-recruiter-alice')
check('EA3 管理员 Usage = Cloud Meter 聚合', adminUsage?.data?.executions === meter.executions, { api: adminUsage?.data?.executions, cloud: meter.executions })

// ── EA4: Plugin 可见 ──
console.log('\n── EA4: Plugin 可见 ──')
const adminPlugs = await fetch(`${API}/api/admin/plugins`, { headers: HA }).then(r => r.json()).catch(() => null)
const jd = (adminPlugs?.data?.plugins || []).find((p: any) => p.pluginCode === 'plugin-recruitment-jd-template')
check('EA4 JD 模板插件授权状态可见', !!jd && jd.licenseStatus === 'ACTIVE' && (jd.enhancements || []).includes('jd-template'), jd)

// ── EA5: Desktop 普通用户流程不受影响 ──
console.log('\n── EA5: 普通用户流程保持 ──')
await prisma.organization.update({ where: { id: ORG_A }, data: { ownerId: prevOwner } }) // 还原 owner
check('EA5 owner 已还原', (await prisma.organization.findUnique({ where: { id: ORG_A }, select: { ownerId: true } }))?.ownerId === prevOwner, prevOwner)
const entA = await fetch(`${API}/api/skills/employees/def-recruiter-alice/entitlement`, { headers: HA }).then(r => r.json()).catch(() => null)
check('EA5 普通员工 API 不受影响（entitlement 正常）', entA?.data?.entitlementState === 'ACTIVE', entA?.data?.entitlementState)

// ── EA6: 三员工回归 ──
console.log('\n── EA6: 三员工回归 ──')
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
check('EA6 Alice 回归 COMPLETED', rA?.plan?.status === 'COMPLETED', rA?.plan?.status)
check('EA6 短剧导演回归 COMPLETED', rD?.plan?.status === 'COMPLETED', rD?.plan?.status)
check('EA6 新媒体回归 COMPLETED', rN?.plan?.status === 'COMPLETED', rN?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
