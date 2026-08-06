/**
 * S7.4-B Marketplace Landing Page — Reality Gate（LB1-LB4）
 * LB1 Landing 五员工齐全 / LB2 fitsFor+responsibilities / LB3 禁承诺数字 / LB4 五员工回归
 * Phase C 附带: 演示租户数据隔离审计
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
const EMPLOYEES = ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops', 'def-legal-advisor', 'def-finance-analyst']

console.log('══ S7.4-B Landing Page Reality Gate（LB1-LB4）+ Phase C 审计 ══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── LB1: Landing 五员工齐全 ──
console.log('\n── LB1: Landing 齐全 ──')
const landings: Record<string, any> = {}
for (const c of EMPLOYEES) {
  const d = await fetch(`${API}/api/marketplace/employees/${c}`).then(r => r.json()).catch(() => null)
  landings[c] = d?.data?.landing
}
check('LB1 五员工 landing 齐全', EMPLOYEES.every((c) => !!landings[c]?.positioning), Object.fromEntries(EMPLOYEES.map((c) => [c, !!landings[c]])))

// ── LB2: 价值表达（positioning/fitsFor/responsibilities）──
console.log('\n── LB2: 价值表达 ──')
check('LB2 Alice: 「你的 24 小时招聘经理」', landings['def-recruiter-alice']?.positioning === '你的 24 小时招聘经理', landings['def-recruiter-alice']?.positioning)
check('LB2 Alice fitsFor + responsibilities 完整', (landings['def-recruiter-alice']?.fitsFor || []).length >= 1 && (landings['def-recruiter-alice']?.responsibilities || []).length >= 3, landings['def-recruiter-alice'])
check('LB2 五员工 positioning 均为 24 小时价值表达', EMPLOYEES.every((c) => (landings[c]?.positioning || '').includes('24 小时')), Object.fromEntries(EMPLOYEES.map((c) => [c, landings[c]?.positioning])))

// ── LB3: 禁承诺数字 ──
console.log('\n── LB3: 合规（禁承诺具体节省数字）──')
const landingText = JSON.stringify(landings)
check('LB3 landing 无具体节省/ROI 数字承诺', !/节省.*(元|%|小时|天|倍)/.test(landingText) && !landingText.includes('ROI'), '0 promises')
const src = (await import('node:fs')).readFileSync('/root/shipin-cinematic-studio/backend/src/routes/marketplace.routes.ts', 'utf-8')
check('LB3 源码无承诺数字（guardrail 保持）', !src.includes('ROI') && (src.includes('节省') ? src.includes('禁承诺') : true), '0 promises, guardrail comment present')

// ── Phase C: 演示租户数据隔离审计 ──
console.log('\n── Phase C: 演示租户隔离审计 ──')
const gov = await prisma.govOrganization.findUnique({ where: { id: ORG_A }, select: { tenantId: true } })
const members = gov?.tenantId ? await prisma.govUser.findMany({ where: { tenantId: gov.tenantId }, select: { email: true, role: true } }).catch(() => []) : []
check('C1 演示企业成员全为测试/演示账号', members.every((m: any) => (m.email || '').includes('audit.local') || (m.email || '').includes('@scs.com') || (m.email || '').includes('qq_') || (m.email || '').includes('fushtn.com')), members.map((m: any) => m.email))
const ent = await prisma.enterpriseEntitlement.findFirst({ where: { organizationId: ORG_A } })
check('C2 演示企业授权仅测试员工（无真实业务数据依赖）', Array.isArray((ent as any)?.capabilityCodes) && (ent as any).capabilityCodes.every((c: string) => c.startsWith('def-')), (ent as any)?.capabilityCodes)

// ── LB4: 五员工回归 ──
console.log('\n── LB4: 五员工回归 ──')
const runs = await Promise.all([
  executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-shortdrama-director', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-newmedia-ops', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-legal-advisor', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-contract-reviewer', tool: 'contract.review', retry: { maxAttempts: 3, backoffMs: 2000 }, timeoutMs: 60000, input: { contractText: '甲委托乙开发软件。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-finance-analyst', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-financial-reporter', tool: 'financial.report', retry: { maxAttempts: 3, backoffMs: 2000 }, timeoutMs: 60000, input: { reportText: 'Q2 营收 500 万。', tenantUserId: USER_A } }] }).catch(() => null),
])
check('LB4 五员工回归全 COMPLETED', runs.every((r) => r?.plan?.status === 'COMPLETED'), runs.map((r) => r?.plan?.status))

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
