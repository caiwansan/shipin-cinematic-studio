/**
 * S7.3 财务经营分析 AI Employee — Reality Gate（FA1-FA6）
 * FA1 Identity+Marketplace 发现 / FA2 Skill Boundary / FA3 Runtime（含平台计费域 0 引用扫描）
 * FA4 Asset / FA5 Commercial（五员工共存）/ FA6 五员工回归
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'
import { authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { parseFinancialReportResult, parseExpenseAnalysisResult, parseBusinessInsightResult } from '../src/ecosystem/finance-parser.js'
import { deliverFinanceAssets } from '../src/ecosystem/skill-asset.service.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''
const FIN = 'def-finance-analyst'
const OTHERS = ['def-recruiter-alice', 'def-shortdrama-director', 'def-newmedia-ops', 'def-legal-advisor']

console.log('══ S7.3 财务经营分析 AI Employee Reality Gate（FA1-FA6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── FA1: Identity ──
console.log('\n── FA1: Identity + Marketplace ──')
const def = await prisma.agentDefinition.findUnique({ where: { code: FIN } })
check('FA1 员工唯一存在', !!def && def.status === 'active', def ? def.status : 'MISSING')
const mkt = await fetch('http://127.0.0.1:4002/api/marketplace/employees').then(r => r.json()).catch(() => null)
const finItem = (mkt?.data?.employees || []).find((i: any) => i.code === FIN)
check('FA1 Marketplace 可发现 + 分类=财务', !!finItem && finItem.category === '财务', finItem ? finItem.category : 'MISSING')
check('FA1 Marketplace 五员工齐', (mkt?.data?.employees || []).length === 5, (mkt?.data?.employees || []).length)

// ── FA2: Skill Boundary ──
console.log('\n── FA2: 3 Skill schema/permission/routing ──')
const emp = await getEmployeeSkillSet(FIN)
check('FA2 员工 Skill Set = 3', emp?.code === FIN && emp?.skills?.length === 3, emp?.skills?.map((s) => s.id))
const auths = await Promise.all(emp!.skills.map((s) => authorizeSkill({ skillId: s.id, agentDefinitionId: FIN })))
check('FA2 3 Skill 授权明确', auths.every((a) => a?.authorizationState === 'AUTHORIZED'), auths.map((a) => a?.authorizationState))
const r1 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/financial-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r2 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/expense-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r3 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/business-insight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
check('FA2 3 内部路由存在且 token 门禁生效', r1 === 401 && r2 === 401 && r3 === 401, { r1, r2, r3 })

// ── Parser 纯函数 ──
console.log('\n── Parser 纯函数 ──')
const fr = parseFinancialReportResult('{"summary":"营收增长","trends":[{"item":"营收","direction":"up","note":"+15%"}],"anomalies":[{"item":"毛利率","description":"下降"}]}')
check('Parser FA-01 合法解析', fr?.summary === '营收增长' && fr?.trends?.length === 1, fr?.trends?.length)
check('Parser FA-01 非法 → null', parseFinancialReportResult('not json') === null && parseFinancialReportResult('') === null, 'pass')
const ea = parseExpenseAnalysisResult('{"categories":[{"name":"差旅","amount":5000,"share":25}],"anomalies":[],"suggestions":[]}')
check('Parser FA-02 合法解析（amount 校验）', ea?.categories?.length === 1 && ea.categories[0].amount === 5000, ea?.categories)
check('Parser FA-02 空 categories → null', parseExpenseAnalysisResult('{"categories":[]}') === null, 'pass')
const bi = parseBusinessInsightResult('{"insights":["现金流健康"],"riskFlags":[{"item":"回款","level":"high","note":"账期拉长"}],"suggestions":[]}')
check('Parser FA-03 合法解析', bi?.insights?.length === 1 && bi?.riskFlags?.[0]?.level === 'high', bi?.riskFlags?.[0])
check('Parser FA-03 空输出 → null', parseBusinessInsightResult('{"insights":[],"riskFlags":[]}') === null, 'pass')

// ── FA5: Commercial（五员工共存）──
console.log('\n── FA5: Commercial ──')
await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: ORG_A } })
const none = await checkEmployeeEntitlement(USER_A, FIN)
check('FA5 未授权 → 拒绝', none.allowed === false, none)
await prisma.enterpriseEntitlement.create({
  data: { organizationId: ORG_A, subscriptionId: '00000000-0000-4000-8000-0000000000aa', capabilityCodes: [FIN, ...OTHERS], status: 'active' },
})
const yes = await checkEmployeeEntitlement(USER_A, FIN)
check('FA5 授权（五员工共存）→ 允许', yes.allowed === true, yes)

// ── FA3: Runtime 全链 + 合规扫描 ──
console.log('\n── FA3: 全链执行 ──')
const REPORT = '2026 年 Q2 营收 500 万，环比增长 15%，毛利率 42%。研发投入 120 万。应收账款账期 60 天。'
const EXPENSE = '差旅费 5000 元，办公费 3000 元，市场推广 20000 元，服务器 8000 元。'
const run = await executeSkillPlan({
  employeeDefinitionId: FIN, tenantUserId: USER_A, fallback: 'STOP',
  steps: [
    { stepId: 'a', skillId: 'def-financial-reporter', tool: 'financial.report', timeoutMs: 60000, retry: { maxAttempts: 3, backoffMs: 2000 }, input: { reportText: REPORT, tenantUserId: USER_A } },
    { stepId: 'b', skillId: 'def-expense-analyst', tool: 'expense.analysis', timeoutMs: 60000, retry: { maxAttempts: 3, backoffMs: 2000 }, input: { expenseText: EXPENSE, tenantUserId: USER_A } },
    { stepId: 'c', skillId: 'def-business-insighter', tool: 'business.insight', timeoutMs: 60000, retry: { maxAttempts: 3, backoffMs: 2000 }, input: { metricsText: REPORT, tenantUserId: USER_A } },
  ],
}).catch(() => null)
check('FA3 3 Skill 全链 COMPLETED', run?.plan?.status === 'COMPLETED', run?.plan?.status)
const frS = run?.plan?.steps?.find((s) => s.tool === 'financial.report')
const eaS = run?.plan?.steps?.find((s) => s.tool === 'expense.analysis')
const biS = run?.plan?.steps?.find((s) => s.tool === 'business.insight')
check('FA3 financial.report 真实（summary 非空）', frS?.result?.result?.source === 'real' && !!frS?.result?.result?.summary, frS?.result?.result?.summary?.slice(0, 20))
check('FA3 expense.analysis 真实（categories 非空）', eaS?.result?.result?.source === 'real' && (eaS?.result?.result?.categories || []).length >= 1, (eaS?.result?.result?.categories || []).length)
check('FA3 business.insight 真实（insights 非空）', biS?.result?.result?.source === 'real' && (biS?.result?.result?.insights || []).length >= 1, (biS?.result?.result?.insights || []).slice(0, 2))
// 合规扫描: 新代码 0 narrativeGateway / 0 wallet / 0 billing / 0 subscription
import { readFileSync } from 'node:fs'
const newCode = readFileSync('/root/shipin-cinematic-studio/backend/src/ecosystem/finance-parser.ts', 'utf-8') + readFileSync('/root/shipin-cinematic-studio/backend/src/routes/skill-tools-internal.routes.ts', 'utf-8')
check('FA3 新代码 0 narrativeGateway 调用', !newCode.includes('narrativeGateway.'), '0')
check('FA3 新代码 0 wallet / billing / subscription 引用（平台计费域隔离）', !/prisma\.(wallet|subscription|creatorWallet|assetTransaction)/.test(newCode) && !newCode.includes('creatorWallet'), '0')

// ── FA4: Asset ──
console.log('\n── FA4: Asset ──')
const delivered = await deliverFinanceAssets({
  userId: USER_A,
  title: '2026 Q2 经营分析',
  financialReport: frS?.result?.result,
  expenseAnalysis: eaS?.result?.result,
  businessInsight: biS?.result?.result,
}).catch((e) => ({ error: e.message }))
check('FA4 3 JSON 资产创建', !(delivered as any).error && (delivered as any).files?.length === 3, (delivered as any).error || (delivered as any).files?.map((f: any) => f.fileName))
check('FA4 Asset + UserAsset 落库', !(delivered as any).error && (delivered as any).assets?.length === 3 && (delivered as any).userAssets?.length === 3, { a: (delivered as any).assets?.length, u: (delivered as any).userAssets?.length })
if (!(delivered as any).error) {
  const code = await fetch(`http://127.0.0.1:4002${(delivered as any).files[0].url}`).then(r => r.status).catch(() => 0)
  check('FA4 Asset URL 可加载', code === 200, code)
}

// ── FA6: 五员工回归 ──
console.log('\n── FA6: 五员工回归 ──')
const runs = await Promise.all([
  executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-shortdrama-director', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-newmedia-ops', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: 'def-legal-advisor', tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-contract-reviewer', tool: 'contract.review', retry: { maxAttempts: 3, backoffMs: 2000 }, timeoutMs: 60000, input: { contractText: '甲委托乙开发软件。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: FIN, tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-financial-reporter', tool: 'financial.report', retry: { maxAttempts: 3, backoffMs: 2000 }, timeoutMs: 60000, input: { reportText: REPORT, tenantUserId: USER_A } }] }).catch(() => null),
])
check('FA6 Alice 回归 COMPLETED', runs[0]?.plan?.status === 'COMPLETED', runs[0]?.plan?.status)
check('FA6 短剧导演回归 COMPLETED', runs[1]?.plan?.status === 'COMPLETED', runs[1]?.plan?.status)
check('FA6 新媒体回归 COMPLETED', runs[2]?.plan?.status === 'COMPLETED', runs[2]?.plan?.status)
check('FA6 法务回归 COMPLETED', runs[3]?.plan?.status === 'COMPLETED', runs[3]?.plan?.status)
check('FA6 财务回归 COMPLETED（五员工共存）', runs[4]?.plan?.status === 'COMPLETED', runs[4]?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
