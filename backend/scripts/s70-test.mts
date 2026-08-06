/**
 * S7.0 法务合同审查 AI Employee — Reality Gate（LG1-LG6）
 * LG1 Identity / LG2 Skill Boundary + Parser / LG3 Runtime（unifiedAIGateway, 0 narrativeGateway, 含 legal/ 扫描）
 * LG4 Asset / LG5 Commercial / LG6 四员工回归
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'
import { authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { parseContractReviewResult, parseRiskAnalysisResult, parseClauseOptimizeResult } from '../src/ecosystem/legal-parser.js'
import { deliverLegalAssets } from '../src/ecosystem/skill-asset.service.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''
const LEGAL = 'def-legal-advisor'
const ALICE = 'def-recruiter-alice'
const DIRECTOR = 'def-shortdrama-director'
const NEWMEDIA = 'def-newmedia-ops'

console.log('══ S7.0 法务合同审查 AI Employee Reality Gate（LG1-LG6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── LG1: Identity ──
console.log('\n── LG1: Identity ──')
const def = await prisma.agentDefinition.findUnique({ where: { code: LEGAL } })
check('LG1 员工唯一存在', !!def && def.status === 'active', def ? def.status : 'MISSING')
const cat = await fetch('http://127.0.0.1:4002/api/skills/mapping/agent-definitions').then(r => r.json()).catch(() => null)
check('LG1 Desktop 目录 API 可发现', (cat?.data?.defs || []).some((d: any) => d.code === LEGAL), 'catalog 含 def-legal-advisor')

// ── LG2: Skill Boundary ──
console.log('\n── LG2: 3 Skill schema/permission/routing ──')
const emp = await getEmployeeSkillSet(LEGAL)
check('LG2 员工 Skill Set = 3', emp?.code === LEGAL && emp?.skills?.length === 3, emp?.skills?.map((s) => s.id))
const auths = await Promise.all(emp!.skills.map((s) => authorizeSkill({ skillId: s.id, agentDefinitionId: LEGAL })))
check('LG2 3 Skill 授权明确', auths.every((a) => a?.authorizationState === 'AUTHORIZED'), auths.map((a) => a?.authorizationState))
const r1 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/contract-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r2 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/risk-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r3 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/clause-optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
check('LG2 3 内部路由存在且 token 门禁生效', r1 === 401 && r2 === 401 && r3 === 401, { r1, r2, r3 })

// ── Parser 纯函数 ──
console.log('\n── Parser 纯函数 ──')
const cr = parseContractReviewResult('{"summary":"服务合同","keyClauses":[{"title":"付款","content":"30 天"}],"risks":[{"level":"high","description":"违约金过高"}]}')
check('Parser LG-01 合法解析 + 数量治理', cr?.summary === '服务合同' && cr?.risks?.length === 1, cr?.risks?.length)
check('Parser LG-01 非法 → null', parseContractReviewResult('not json') === null && parseContractReviewResult('') === null, 'pass')
const ra = parseRiskAnalysisResult('{"riskLevel":"high","riskItems":[{"risk":"违约金","impact":"高","suggestion":"协商"}],"suggestions":["重议"]}')
check('Parser LG-02 合法解析（riskLevel 校验）', ra?.riskLevel === 'high' && ra?.riskItems?.length === 1, ra)
check('Parser LG-02 空 riskItems → null', parseRiskAnalysisResult('{"riskLevel":"low","riskItems":[]}') === null, 'pass')
const co = parseClauseOptimizeResult('{"optimizedClause":"新条款","reason":"更平衡","tradeoff":"周期延长"}')
check('Parser LG-03 合法解析', co?.optimizedClause === '新条款' && !!co?.tradeoff, co)
check('Parser LG-03 缺条款 → null', parseClauseOptimizeResult('{"reason":"x"}') === null, 'pass')

// ── LG5: Commercial ──
console.log('\n── LG5: Commercial ──')
await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: ORG_A } })
const none = await checkEmployeeEntitlement(USER_A, LEGAL)
check('LG5 未授权 → 拒绝', none.allowed === false, none)
await prisma.enterpriseEntitlement.create({
  data: { organizationId: ORG_A, subscriptionId: '00000000-0000-4000-8000-0000000000aa', capabilityCodes: [LEGAL, ALICE, DIRECTOR, NEWMEDIA], status: 'active' },
})
const yes = await checkEmployeeEntitlement(USER_A, LEGAL)
check('LG5 授权（四员工共存）→ 允许', yes.allowed === true, yes)

// ── LG3: Runtime 全链（unifiedAIGateway, 禁 narrativeGateway）──
console.log('\n── LG3: 全链执行 ──')
const CONTRACT = '甲方委托乙方开发软件，总价 50 万元，分三期付款。若乙方延期交付，每日违约金为合同总额的 1%。'
const run = await executeSkillPlan({
  employeeDefinitionId: LEGAL, tenantUserId: USER_A, fallback: 'STOP',
  steps: [
    { stepId: 'a', skillId: 'def-contract-reviewer', tool: 'contract.review', timeoutMs: 60000, input: { contractText: CONTRACT, tenantUserId: USER_A } },
    { stepId: 'b', skillId: 'def-risk-analyst', tool: 'risk.analysis', timeoutMs: 60000, input: { contractText: CONTRACT, tenantUserId: USER_A } },
    { stepId: 'c', skillId: 'def-clause-optimizer', tool: 'clause.optimize', timeoutMs: 60000, input: { clauseText: '违约金每日 1%', goal: '更平衡的违约条款', tenantUserId: USER_A } },
  ],
}).catch(() => null)
check('LG3 3 Skill 全链 COMPLETED', run?.plan?.status === 'COMPLETED', { status: run?.plan?.status, stepErrors: run?.plan?.steps?.filter((s: any) => s.status === 'FAILED').map((s: any) => ({ t: s.tool, e: s.error })) })
const crStep = run?.plan?.steps?.find((s) => s.tool === 'contract.review')
const raStep = run?.plan?.steps?.find((s) => s.tool === 'risk.analysis')
const coStep = run?.plan?.steps?.find((s) => s.tool === 'clause.optimize')
check('LG3 contract.review 真实（summary 非空）', crStep?.result?.result?.source === 'real' && !!crStep?.result?.result?.summary, crStep?.result?.result?.summary?.slice(0, 20))
check('LG3 risk.analysis 真实（riskItems 非空）', raStep?.result?.result?.source === 'real' && (raStep?.result?.result?.riskItems || []).length >= 1, (raStep?.result?.result?.riskItems || []).length)
check('LG3 clause.optimize 真实（optimizedClause 非空）', coStep?.result?.result?.source === 'real' && !!coStep?.result?.result?.optimizedClause, coStep?.result?.result?.optimizedClause?.slice(0, 20))
// LG3 合规扫描: legal/ 目录 + 新代码 0 narrativeGateway/0 regulation 直调
import { readdirSync, readFileSync } from 'node:fs'
const legalDir = '/root/shipin-cinematic-studio/backend/src/routes/legal'
const files = readdirSync(legalDir)
const newCode = readFileSync('/root/shipin-cinematic-studio/backend/src/ecosystem/legal-parser.ts', 'utf-8') + readFileSync('/root/shipin-cinematic-studio/backend/src/routes/skill-tools-internal.routes.ts', 'utf-8')
check('LG3 新代码 0 narrativeGateway 调用', !newCode.includes('narrativeGateway.'), '0')
check('LG3 新代码 0 regulation 直调', !newCode.includes('regulation.route') && !newCode.includes('regulation-fetch'), '0')
check('LG3 legal/ 目录未被触碰（旧体系隔离）', files.length >= 9 && !files.includes('legal-skill.routes.ts'), files.length)

// ── LG4: Asset ──
console.log('\n── LG4: Asset ──')
const delivered = await deliverLegalAssets({
  userId: USER_A,
  title: '软件开发合同审查',
  contractReview: crStep?.result?.result,
  riskAnalysis: raStep?.result?.result,
  clauseOptimize: coStep?.result?.result,
}).catch((e) => ({ error: e.message }))
check('LG4 3 JSON 资产创建', !(delivered as any).error && (delivered as any).files?.length === 3, (delivered as any).error || (delivered as any).files?.map((f: any) => f.fileName))
check('LG4 Asset + UserAsset 落库', !(delivered as any).error && (delivered as any).assets?.length === 3 && (delivered as any).userAssets?.length === 3, { a: (delivered as any).assets?.length, u: (delivered as any).userAssets?.length })
if (!(delivered as any).error) {
  const code = await fetch(`http://127.0.0.1:4002${(delivered as any).files[0].url}`).then(r => r.status).catch(() => 0)
  check('LG4 Asset URL 可加载', code === 200, code)
}

// ── LG6: 四员工回归 ──
console.log('\n── LG6: 四员工回归 ──')
const runs = await Promise.all([
  executeSkillPlan({ employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: DIRECTOR, tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: NEWMEDIA, tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }] }).catch(() => null),
  executeSkillPlan({ employeeDefinitionId: LEGAL, tenantUserId: USER_A, fallback: 'STOP', steps: [{ skillId: 'def-contract-reviewer', tool: 'contract.review', input: { contractText: CONTRACT, tenantUserId: USER_A } }] }).catch(() => null),
])
check('LG6 Alice 回归 COMPLETED', runs[0]?.plan?.status === 'COMPLETED', runs[0]?.plan?.status)
check('LG6 短剧导演回归 COMPLETED', runs[1]?.plan?.status === 'COMPLETED', runs[1]?.plan?.status)
check('LG6 新媒体回归 COMPLETED', runs[2]?.plan?.status === 'COMPLETED', runs[2]?.plan?.status)
check('LG6 法务回归 COMPLETED（四员工共存）', runs[3]?.plan?.status === 'COMPLETED', runs[3]?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
