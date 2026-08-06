/**
 * S4.4 P0 JWT Identity Authority — Reality Gate
 * JI1: JWT 身份权威（入口不再接受 tenantUserId 传参）
 * JI2: 无 token → 401; 伪造 query tenantUserId → 无效（身份 = JWT）
 * JI3: JWT 路径全链（from-intent / execute / entitlement / usage）
 * JI4: step input 身份注入防护（伪造 tenantUserId 被覆盖为 JWT 身份）
 * JI5: 回归（S4.2 CR3 隔离语义保持; 内部路由 token 门禁保持）
 */
import { prisma } from '../src/utils/index.js'
import { executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const API = 'http://127.0.0.1:4002'
const ORG_A = '11111111-2222-4333-8444-555555555555'
const ALICE = 'def-recruiter-alice'

console.log('══ S4.4 P0 JWT Identity Authority（JI1-JI5）══')

// 登录 A 租户拿 JWT（真实 login API）
const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const token = loginRes.accessToken
check('前置: 登录获取 JWT', !!token && typeof token === 'string' && token.split('.').length === 3, token?.slice(0, 25) + '…')
if (!token) process.exit(1)
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

// ── JI1: 入口身份 = JWT（query/body 的 tenantUserId 被忽略）──
console.log('\n── JI1: JWT 身份权威 ──')
// 伪造一个不存在的租户 id 放 query——身份必须仍是 JWT 用户（A 已授权 → ACTIVE）
const entRes = await fetch(`${API}/api/skills/employees/${ALICE}/entitlement?tenantUserId=00000000-0000-4000-8000-000000000099`, { headers: H }).then(r => r.json())
check('JI1 entitlement: 伪造 query 租户无效（身份 = JWT, 仍 ACTIVE）', entRes?.data?.entitlementState === 'ACTIVE', entRes?.data)
const entRes2 = await fetch(`${API}/api/skills/employees/${ALICE}/entitlement`, { headers: H }).then(r => r.json())
check('JI1 entitlement: 无 query 也正常（纯 JWT）', entRes2?.data?.entitlementState === 'ACTIVE', entRes2?.data)

// ── JI2: 无 token → 401 ──
console.log('\n── JI2: 无 token 拒绝 ──')
const noAuth1 = await fetch(`${API}/api/skills/employees/${ALICE}/entitlement`).then(r => r.status)
const noAuth2 = await fetch(`${API}/api/skills/employees/${ALICE}/usage`).then(r => r.status)
const noAuth3 = await fetch(`${API}/api/skills/plans/from-intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeDefinitionId: ALICE, intent: 'x' }) }).then(r => r.status)
check('JI2 无 token → 401（entitlement/usage/planner）', noAuth1 === 401 && noAuth2 === 401 && noAuth3 === 401, { noAuth1, noAuth2, noAuth3 })

// ── JI3: JWT 路径全链 ──
console.log('\n── JI3: JWT 全链 ──')
const planRes = await fetch(`${API}/api/skills/plans/from-intent`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ employeeDefinitionId: ALICE, intent: '对候选人做完整招聘评估', tenantUserId: '00000000-0000-4000-8000-000000000099' }),
}).then(r => r.json())
check('JI3 planner 走 JWT（伪造 tenantUserId 忽略, 仍生成计划）', planRes?.data?.ok === true, planRes?.data?.errors || 'ok')
const steps = (planRes?.data?.plan?.steps || []).map((s: any) => ({
  stepId: s.stepId, skillId: s.skillId, tool: s.tool, dependsOn: s.dependsOn,
  input: s.skillId === 'def-resume-parser'
    ? { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: '00000000-0000-4000-8000-000000000099' }
    : s.skillId === 'def-interview-evaluator'
      ? { resume: { name: '张伟' }, interviewRecord: { questions: [{ question: 'Java?', answer: '5 年' }] }, jobRequirement: 'Java', tenantUserId: '00000000-0000-4000-8000-000000000099' }
      : { resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: 'Java', tenantUserId: '00000000-0000-4000-8000-000000000099' },
}))
const execRes = await fetch(`${API}/api/skills/plans/execute`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ employeeDefinitionId: ALICE, steps, fallback: 'STOP', tenantUserId: '00000000-0000-4000-8000-000000000099' }),
}).then(r => r.json())
check('JI3 execute 走 JWT 全链 COMPLETED（3 Skills 真实）', execRes?.data?.status === 'COMPLETED', execRes?.data?.status)
const usageRes = await fetch(`${API}/api/skills/employees/${ALICE}/usage`, { headers: H }).then(r => r.json())
check('JI3 usage 走 JWT（executions ≥ 1）', (usageRes?.data?.executions || 0) >= 1, usageRes?.data?.executions)

// ── JI4: step input 身份注入防护 ──
console.log('\n── JI4: 身份注入防护 ──')
const injectRes = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: 'f5131f3f-61ac-4d19-aa40-b8b8d31ac7b3', fallback: 'STOP',
  steps: [{
    stepId: 'inj', skillId: 'def-resume-parser', tool: 'resume.parse',
    input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: 'FORGED-TENANT-123' },
  }],
})
const forged = injectRes?.plan?.steps?.[0]?.input?.tenantUserId
check('JI4 step 伪造 tenantUserId 被覆盖为入口身份', forged === 'f5131f3f-61ac-4d19-aa40-b8b8d31ac7b3', forged)

// ── JI5: 回归（内部路由 token 门禁 + CR3 隔离）──
console.log('\n── JI5: 回归 ──')
const internalNoToken = await fetch(`${API}/api/internal/skill-tools/resume-parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.status)
check('JI5 内部路由 token 门禁保持（无 token → 401）', internalNoToken === 401, internalNoToken)
// B 租户登录 → 未授权（隔离保持）
const loginB = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const entB = await fetch(`${API}/api/skills/employees/${ALICE}/entitlement`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json())
check('JI5 B 租户 JWT → 未授权（企业隔离保持）', entB?.data?.entitlementState !== 'ACTIVE', entB?.data)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
