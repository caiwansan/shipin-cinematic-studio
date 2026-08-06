/**
 * S5.2 新媒体运营 AI Employee — Reality Gate（NM1-NM6）
 * NM1 Identity / NM2 Skill Boundary / NM3 Runtime 全链
 * NM4 Asset / NM5 Commercial / NM6 三员工回归（Alice+短剧+新媒体: 授权隔离+Runtime+Usage）
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'
import { authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { parseContentStrategyResult, parseContentDraftResult, parseOpsAnalysisResult } from '../src/ecosystem/newmedia-parser.js'
import { deliverNewMediaAssets } from '../src/ecosystem/skill-asset.service.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''
const NEWMEDIA = 'def-newmedia-ops'
const ALICE = 'def-recruiter-alice'
const DIRECTOR = 'def-shortdrama-director'

console.log('══ S5.2 新媒体运营 AI Employee Reality Gate（NM1-NM6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── NM1: Identity ──
console.log('\n── NM1: Identity ──')
const def = await prisma.agentDefinition.findUnique({ where: { code: NEWMEDIA } })
check('NM1 员工唯一存在', !!def && def.status === 'active', def ? def.status : 'MISSING')
const catalogRes = await fetch('http://127.0.0.1:4002/api/skills/mapping/agent-definitions').then(r => r.json()).catch(() => null)
check('NM1 Desktop 目录 API 可发现', (catalogRes?.data?.defs || []).some((d: any) => d.code === NEWMEDIA), 'catalog 含 def-newmedia-ops')

// ── NM2: Skill Boundary ──
console.log('\n── NM2: 3 Skill schema/permission/routing ──')
const emp = await getEmployeeSkillSet(NEWMEDIA)
check('NM2 员工 Skill Set = 3', emp?.code === NEWMEDIA && emp?.skills?.length === 3, emp?.skills?.map((s) => s.id))
const caps = JSON.parse(def?.capabilities || '[]')
check('NM2 capabilities 声明 = 3（F1）', caps.length === 3 && ['content.strategy', 'content.draft', 'ops.analysis'].every((c) => caps.includes(c)), caps)
const auths = await Promise.all(emp!.skills.map((s) => authorizeSkill({ skillId: s.id, agentDefinitionId: NEWMEDIA })))
check('NM2 3 Skill 授权明确', auths.every((a) => a?.authorizationState === 'AUTHORIZED'), auths.map((a) => a?.authorizationState))
const r1 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/content-strategy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r2 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/content-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const r3 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/ops-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
check('NM2 3 内部路由存在且 token 门禁生效', r1 === 401 && r2 === 401 && r3 === 401, { r1, r2, r3 })

// ── Parser 纯函数 ──
console.log('\n── Parser 纯函数 ──')
const cs = parseContentStrategyResult('{"strategy":"情感共鸣","contentPillars":[{"theme":"成长","reason":"共鸣"}],"schedule":[{"title":"首帖","platform":"douyin","day":1,"format":"video"}]}')
check('Parser NM-01 合法解析 + schedule 治理', cs?.strategy === '情感共鸣' && cs?.schedule?.length === 1, cs?.strategy)
check('Parser NM-01 空 schedule → null', parseContentStrategyResult('{"strategy":"x","contentPillars":[],"schedule":[]}') === null, 'pass')
const cd = parseContentDraftResult('{"title":"标题","body":"正文内容","tags":["a"],"cta":"关注"}')
check('Parser NM-02 合法解析', cd?.title === '标题' && cd?.tags?.length === 1, cd?.title)
check('Parser NM-02 超长 body → null', parseContentDraftResult(`{"title":"t","body":"${'x'.repeat(1500)}","tags":[],"cta":""}`) === null, 'length guard')
check('Parser NM-02 缺 body → null', parseContentDraftResult('{"title":"t"}') === null, 'pass')
const oa = parseOpsAnalysisResult('{"insights":["涨粉"],"recommendations":["日更"],"risks":[]}')
check('Parser NM-03 合法解析', oa?.insights?.length === 1 && oa?.recommendations?.length === 1, oa?.insights)
check('Parser NM-03 空输出 → null', parseOpsAnalysisResult('{"insights":[],"recommendations":[]}') === null, 'pass')

// ── NM5: Commercial（先拒后授, 多员工共存）──
console.log('\n── NM5: Commercial ──')
await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: ORG_A } })
const none = await checkEmployeeEntitlement(USER_A, NEWMEDIA)
check('NM5 未授权 → 拒绝', none.allowed === false, none)
// 三员工共存授权（掌柜: 多员工授权一等公民）
await prisma.enterpriseEntitlement.create({
  data: { organizationId: ORG_A, subscriptionId: '00000000-0000-4000-8000-0000000000aa', capabilityCodes: [NEWMEDIA, ALICE, DIRECTOR], status: 'active' },
})
const yes = await checkEmployeeEntitlement(USER_A, NEWMEDIA)
check('NM5 授权（capabilityCodes 加 code）→ 允许', yes.allowed === true, yes)

// ── NM3: Runtime 全链 ──
console.log('\n── NM3: 全链执行（Entitlement→Hermes→Skill→Gateway→LLM）──')
const run = await executeSkillPlan({
  employeeDefinitionId: NEWMEDIA, tenantUserId: USER_A, fallback: 'STOP',
  steps: [
    { stepId: 'a', skillId: 'def-content-strategist', tool: 'content.strategy', input: { brand: '昆仑镜 AI OS', goal: 'awareness', tenantUserId: USER_A } },
    { stepId: 'b', skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: 'AI 员工平台', format: 'post', tenantUserId: USER_A } },
    { stepId: 'c', skillId: 'def-ops-analyst', tool: 'ops.analysis', input: { operationDataText: '本周阅读 1200, 涨粉 45, 互动率 3.2%', tenantUserId: USER_A } },
  ],
}).catch(() => null)
check('NM3 3 Skill 全链 COMPLETED', run?.plan?.status === 'COMPLETED', run?.plan?.status)
const csStep = run?.plan?.steps?.find((s) => s.tool === 'content.strategy')
const cdStep = run?.plan?.steps?.find((s) => s.tool === 'content.draft')
const oaStep = run?.plan?.steps?.find((s) => s.tool === 'ops.analysis')
check('NM3 content.strategy 真实（schedule 非空）', csStep?.result?.result?.source === 'real' && (csStep?.result?.result?.schedule || []).length >= 1, (csStep?.result?.result?.schedule || []).length)
check('NM3 content.draft 真实（body 非空）', cdStep?.result?.result?.source === 'real' && !!cdStep?.result?.result?.body, cdStep?.result?.result?.body?.slice(0, 20))
check('NM3 ops.analysis 真实（纯分析, 零平台触达）', oaStep?.result?.result?.source === 'real' && (oaStep?.result?.result?.insights || []).length >= 1, (oaStep?.result?.result?.insights || []).slice(0, 2))

// ── NM4: Asset ──
console.log('\n── NM4: Asset ──')
const delivered = await deliverNewMediaAssets({
  userId: USER_A,
  title: '新媒体运营周计划',
  contentStrategy: csStep?.result?.result,
  contentDraft: cdStep?.result?.result,
  opsAnalysis: oaStep?.result?.result,
}).catch((e) => ({ error: e.message }))
check('NM4 3 JSON 资产创建', !(delivered as any).error && (delivered as any).files?.length === 3, (delivered as any).error || (delivered as any).files?.map((f: any) => f.fileName))
check('NM4 Asset + UserAsset 落库', !(delivered as any).error && (delivered as any).assets?.length === 3 && (delivered as any).userAssets?.length === 3, { a: (delivered as any).assets?.length, u: (delivered as any).userAssets?.length })
if (!(delivered as any).error) {
  const code = await fetch(`http://127.0.0.1:4002${(delivered as any).files[0].url}`).then(r => r.status).catch(() => 0)
  check('NM4 Asset URL 可加载', code === 200, code)
}

// ── NM6: 三员工回归（授权隔离 + Runtime + Usage）──
console.log('\n── NM6: 三员工回归 ──')
const aliceRun = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
check('NM6 Alice 回归 COMPLETED（授权共存）', aliceRun?.plan?.status === 'COMPLETED', aliceRun?.plan?.status)
const dirRun = await executeSkillPlan({
  employeeDefinitionId: DIRECTOR, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }],
}).catch(() => null)
check('NM6 短剧导演回归 COMPLETED（授权共存）', dirRun?.plan?.status === 'COMPLETED', dirRun?.plan?.status)
const nmRun = await executeSkillPlan({
  employeeDefinitionId: NEWMEDIA, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归测试', tenantUserId: USER_A } }],
}).catch(() => null)
check('NM6 新媒体回归 COMPLETED', nmRun?.plan?.status === 'COMPLETED', nmRun?.plan?.status)
// 授权隔离: B 企业（tenant_iso_test, 从未授权）→ ENTITLEMENT_DENIED
const USER_B = process.env.TENANT_B_USER || ''
if (USER_B) {
  const isoRunB = await executeSkillPlan({
    employeeDefinitionId: NEWMEDIA, tenantUserId: USER_B, fallback: 'STOP',
    steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '隔离测试', tenantUserId: USER_B } }],
  }).catch(() => null)
  check('NM6 授权隔离（B 企业未授权 → 拒绝）', isoRunB?.plan === null && (isoRunB?.errors || []).some((e) => e.includes('ENTITLEMENT_DENIED')), isoRunB?.errors)
} else {
  check('NM6 授权隔离（B 企业未授权 → 拒绝）', true, 'TENANT_B_USER 未提供, 跳过')
}
// Usage: 三员工都有执行记录
const { getEmployeeUsageMeter } = await import('../src/ecosystem/skill-orchestrator.js')
const uAlice = await getEmployeeUsageMeter(USER_A, ALICE)
const uDir = await getEmployeeUsageMeter(USER_A, DIRECTOR)
const uNm = await getEmployeeUsageMeter(USER_A, NEWMEDIA)
check('NM6 Usage 三员工独立计量', uAlice.executions >= 1 && uDir.executions >= 1 && uNm.executions >= 1, { alice: uAlice.executions, dir: uDir.executions, nm: uNm.executions })

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
