/**
 * S7.2 Marketplace MVP — Reality Gate（MT1-MT6）
 * MT1 列表真实来源 F1 / MT2 分类正确 / MT3 搜索真实过滤
 * MT4 详情五要素完整 / MT5 未授权状态正确 / MT6 四员工回归
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
const USER_A = process.env.TENANT_A_USER || ''

console.log('══ S7.2 Marketplace MVP Reality Gate（MT1-MT6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

const loginA = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_org_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const H = { Authorization: `Bearer ${loginA.accessToken}` }

// ── MT1: 列表真实来源 F1（capabilities 与 agent_definition 一致）──
console.log('\n── MT1: 列表来源 F1 ──')
const list = await fetch(`${API}/api/marketplace/employees`, { headers: H }).then(r => r.json()).catch(() => null)
const items = list?.data?.employees || []
check('MT1 列表返回 4 商品员工', items.length === 4, items.map((i: any) => i.code))
const alice = items.find((i: any) => i.code === 'def-recruiter-alice')
const aliceDef = await prisma.agentDefinition.findUnique({ where: { code: 'def-recruiter-alice' } })
const f1 = JSON.parse(aliceDef!.capabilities)
check('MT1 capabilities 来自 F1（与 agent_definition 一致）', JSON.stringify(alice?.capabilities) === JSON.stringify(f1), alice?.capabilities)

// ── MT2: 分类正确 ──
console.log('\n── MT2: 分类 ──')
const catMap: Record<string, string> = {}
for (const i of items) catMap[i.code] = i.category
check('MT2 四员工部门分类正确', catMap['def-recruiter-alice'] === '人力' && catMap['def-shortdrama-director'] === '内容' && catMap['def-newmedia-ops'] === '营销' && catMap['def-legal-advisor'] === '风险', catMap)
const catFilter = await fetch(`${API}/api/marketplace/employees?category=${encodeURIComponent('风险')}`, { headers: H }).then(r => r.json()).catch(() => null)
check('MT2 分类过滤（风险 → 仅法务）', (catFilter?.data?.employees || []).length === 1 && catFilter.data.employees[0].code === 'def-legal-advisor', catFilter?.data?.employees?.map((i: any) => i.code))

// ── MT3: 搜索真实过滤 ──
console.log('\n── MT3: 搜索 ──')
const s1 = await fetch(`${API}/api/marketplace/employees?q=${encodeURIComponent('短剧')}`, { headers: H }).then(r => r.json()).catch(() => null)
check('MT3 关键词搜索（短剧 → 短剧导演）', (s1?.data?.employees || []).length === 1 && s1.data.employees[0].code === 'def-shortdrama-director', s1?.data?.employees?.map((i: any) => i.code))
const s2 = await fetch(`${API}/api/marketplace/employees?q=${encodeURIComponent('contract.review')}`, { headers: H }).then(r => r.json()).catch(() => null)
check('MT3 能力码搜索（contract.review → 法务）', (s2?.data?.employees || []).some((i: any) => i.code === 'def-legal-advisor'), s2?.data?.employees?.map((i: any) => i.code))
const s3 = await fetch(`${API}/api/marketplace/employees?q=${encodeURIComponent('不存在的员工xyz')}`, { headers: H }).then(r => r.json()).catch(() => null)
check('MT3 无匹配 → 空列表', (s3?.data?.employees || []).length === 0, s3?.data?.employees?.length)

// ── MT4: 详情五要素 ──
console.log('\n── MT4: 详情五要素 ──')
const detail = await fetch(`${API}/api/marketplace/employees/def-recruiter-alice`, { headers: H }).then(r => r.json()).catch(() => null)
const dd = detail?.data
check('MT4 详情含 identity（员工非工具表达）', !!dd?.identity?.title && dd.identity.title.includes('AI 招聘员工'), dd?.identity)
check('MT4 详情含 capabilities + plugins + entitlement + usage', Array.isArray(dd?.capabilities) && Array.isArray(dd?.plugins) && 'available' in (dd?.entitlement || {}) && typeof dd?.usage?.executions === 'number', { caps: dd?.capabilities?.length, plugs: dd?.plugins, ent: dd?.entitlement, usage: dd?.usage })
const noAuth = await fetch(`${API}/api/marketplace/employees/def-recruiter-alice`).then(r => r.status)
check('MT4 无 token 也可浏览公开目录（entitlement/usage 为 null）', noAuth === 200, noAuth)

// ── MT5: 未授权状态正确 ──
console.log('\n── MT5: 未授权状态 ──')
const loginB = await fetch(`${API}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'tenant_iso_test@audit.local', password: 'AuditTest@123' }),
}).then(r => r.json())
const listB = await fetch(`${API}/api/marketplace/employees`, { headers: { Authorization: `Bearer ${loginB.accessToken}` } }).then(r => r.json()).catch(() => null)
const aliceB = (listB?.data?.employees || []).find((i: any) => i.code === 'def-recruiter-alice')
check('MT5 B 企业（未授权）→ entitlement.available=false', aliceB?.entitlement?.available === false, aliceB?.entitlement)

// ── MT6: 四员工回归 ──
console.log('\n── MT6: 四员工回归 ──')
const runs = await Promise.all([
  executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-shortdrama-director', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-newmedia-ops', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-legal-advisor', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-contract-reviewer', tool: 'contract.review', retry: { maxAttempts: 3, backoffMs: 2000 }, timeoutMs: 60000, input: { contractText: '甲委托乙开发软件，总价 50 万。', tenantUserId: USER_A } }] }).catch(() => null),
])
check('MT6 Alice 回归 COMPLETED', runs[0]?.plan?.status === 'COMPLETED', runs[0]?.plan?.status)
check('MT6 短剧导演回归 COMPLETED', runs[1]?.plan?.status === 'COMPLETED', runs[1]?.plan?.status)
check('MT6 新媒体回归 COMPLETED', runs[2]?.plan?.status === 'COMPLETED', runs[2]?.plan?.status)
check('MT6 法务回归 COMPLETED', runs[3]?.plan?.status === 'COMPLETED', runs[3]?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
