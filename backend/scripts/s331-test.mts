/**
 * S3.3.1 Reality Gate — OC1/OC2/OC3 + SC1-SC6（零写库，除种子数据已建）
 * OC1: 多 Skill 绑定视图（Alice → 3 Skills）
 * OC2: 授权逐段生效（每个 Skill 独立 AUTHORIZED）
 * OC3: Hermes 原子性保持（每 step 独立 Sub-Agent 执行）
 * SC1: 无 Skill.capabilities 第二份定义 / SC2 授权逐段 / SC3 Hermes 原子
 * SC4: PARTIAL_COMPLETED 可表达入审计 / SC5 零新表 / SC6 S3.2.3 回归
 */
import {
  topoSortSteps,
  composePlanStatus,
  validatePlan,
  getEmployeeSkillSet,
  executeSkillPlan,
} from '../src/ecosystem/skill-orchestrator.js'

const AUDIT_API = 'http://127.0.0.1:4002/api/audit/hermes-execution'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`)
  }
}

console.log('══ S3.3.1 Reality Gate（OC1-OC3 + SC1-SC6）══')

// ── OC1: 多 Skill 绑定视图 ──
console.log('\n── OC1: Alice 多 Skill 绑定视图 ──')
const alice = await getEmployeeSkillSet('def-recruiter-alice').catch(() => null)
if (alice) {
  const skillIds = alice.skills.map((s) => s.id).sort()
  check('OC1 Alice 绑定 3 Skills', JSON.stringify(skillIds) === JSON.stringify(['def-candidate-scorer', 'def-interview-evaluator', 'def-resume-parser']), skillIds)
  check('OC1 能力来自 AgentDefinition.capabilities（F1）', alice.capabilities.includes('candidate.score') && alice.capabilities.includes('interview.evaluate'), alice.capabilities)
} else {
  check('OC1 Alice 绑定视图', false, 'null')
}

// ── OC-0.2: SkillPlan 纯内存 ──
console.log('\n── OC-0.2: SkillPlan 不入库 ──')
const plan1 = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice',
  fallback: 'STOP',
  steps: [
    { skillId: 'def-resume-parser', tool: 'resume.parse', input: { file: 'resume.pdf' } },
    { skillId: 'def-candidate-scorer', tool: 'candidate.score', input: { candidateId: 'c-1' }, dependsOn: ['def-resume-parser:resume.parse'] },
    { skillId: 'def-interview-evaluator', tool: 'interview.evaluate', input: { candidateId: 'c-1' }, dependsOn: ['def-candidate-scorer:candidate.score'] },
  ],
}).catch(() => null)
if (plan1 && plan1.plan) {
  check('OC-0.2 plan 返回（内存对象）', !!plan1.plan.planId && plan1.plan.steps.length === 3, plan1.plan.planId)
  // ── DAG 顺序（Q3: ResumeParser → CandidateScoring → InterviewEvaluation）──
  const order = plan1.plan.steps.map((s) => s.stepId)
  check('Q3 DAG 顺序正确', JSON.stringify(order) === JSON.stringify(['def-resume-parser:resume.parse', 'def-candidate-scorer:candidate.score', 'def-interview-evaluator:interview.evaluate']), order)
  // ── OC3: 每 step 原子执行 + COMPLETED ──
  check('OC3 全 step COMPLETED', plan1.plan.steps.every((s) => s.status === 'COMPLETED'), plan1.plan.steps.map((s) => s.status))
  check('OC3 每 step 有结果', plan1.plan.steps.every((s) => s.result?.ok === true), plan1.plan.steps.map((s) => s.result?.ok))
  check('SC4 状态 COMPLETED', plan1.plan.status === 'COMPLETED', plan1.plan.status)
} else {
  check('OC-0.2 编排执行', false, plan1?.errors || 'null')
}

// ── OC2: 授权逐段生效（审计中每 step 独立记录 + 全部 AUTHORIZED 前置）──
console.log('\n── OC2: 授权逐段生效 ──')
const { prepareSkillExecution } = await import('../src/ecosystem/skill-execution-adapter.js')
const authRes = await Promise.all(
  ['def-resume-parser', 'def-candidate-scorer', 'def-interview-evaluator'].map((id) =>
    prepareSkillExecution({ skillId: id, agentDefinitionId: 'def-recruiter-alice' }),
  ),
)
check('OC2 每 Skill 独立 AUTHORIZED', authRes.every((a) => a?.allowed === true && a?.authorizationState === 'AUTHORIZED'), authRes.map((a) => a?.authorizationState))

// ── SC4: PARTIAL_COMPLETED（fallback=SKIP, 中间 step 失败）──
console.log('\n── SC4: PARTIAL_COMPLETED（fallback=SKIP）──')
const plan2 = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice',
  fallback: 'SKIP',
  steps: [
    { skillId: 'def-resume-parser', tool: 'resume.parse', input: {} },
    { skillId: 'def-candidate-scorer', tool: 'payment.authorize', input: {} }, // 越权工具 → POLICY_REJECTED
    { skillId: 'def-interview-evaluator', tool: 'interview.evaluate', input: {} },
  ],
}).catch(() => null)
if (plan2 && plan2.plan) {
  const statuses = plan2.plan.steps.map((s) => s.status)
  check('SC4 状态 = PARTIAL_COMPLETED', plan2.plan.status === 'PARTIAL_COMPLETED', plan2.plan.status)
  check('SC4 step2 FAILED（POLICY_REJECTED）', statuses[1] === 'FAILED' && (plan2.plan.steps[1].error || '').includes('POLICY_REJECTED'), plan2.plan.steps[1])
  check('SC4 step3 继续完成（SKIP 语义）', statuses[2] === 'COMPLETED', statuses)
} else {
  check('SC4 PARTIAL_COMPLETED', false, plan2?.errors || 'null')
}

// ── SC4b: fallback=STOP → FAILED ──
const plan3 = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice',
  fallback: 'STOP',
  steps: [
    { skillId: 'def-resume-parser', tool: 'resume.parse', input: {} },
    { skillId: 'def-candidate-scorer', tool: 'payment.authorize', input: {} },
    { skillId: 'def-interview-evaluator', tool: 'interview.evaluate', input: {} },
  ],
}).catch(() => null)
if (plan3 && plan3.plan) {
  check('SC4b STOP → FAILED', plan3.plan.status === 'FAILED', plan3.plan.status)
  check('SC4b 后续 step SKIPPED', plan3.plan.steps[2].status === 'SKIPPED', plan3.plan.steps.map((s) => s.status))
} else {
  check('SC4b STOP', false, plan3?.errors || 'null')
}

// ── DAG 校验: 环拒绝 / 越权 Skill 拒绝（F1 绑定）──
console.log('\n── DAG / 绑定校验（纯函数）──')
const cycle = topoSortSteps([
  { stepId: 'a', dependsOn: ['b'] },
  { stepId: 'b', dependsOn: ['a'] },
])
check('DAG 环 → null', cycle === null, cycle)
const badBind = validatePlan({
  steps: [{ skillId: 'not-bound-skill', tool: 'x' }],
  employeeSkillSet: ['def-resume-parser'],
})
check('F1 未绑定 Skill → 拒绝', badBind.errors.some((e) => e.startsWith('SKILL_NOT_BOUND')), badBind.errors)
const good = validatePlan({
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse' }],
  employeeSkillSet: ['def-resume-parser'],
})
check('绑定通过', good.ok === true, good.errors)

// ── SC5: 零新表（源码检查: 无 skillPlan 表引用 / 无 prisma 写入）──
console.log('\n── SC5: 零新表 ──')
const orchSrc = (await import('node:fs')).readFileSync(new URL('../src/ecosystem/skill-orchestrator.ts', import.meta.url), 'utf-8')
const hasWrites = /prisma\.[a-zA-Z]+\.(create|createMany|update|delete|upsert)/.test(orchSrc)
check('SC5 无 SkillPlan 表 / 无 prisma 写入', !orchSrc.includes('skillPlan') && !hasWrites, { skillPlanRefs: (orchSrc.match(/skillPlan/g) || []).length, writes: hasWrites })

// ── SC6: S3.2.3 回归（单 Skill 执行链路不变）──
console.log('\n── SC6: S3.2.3 回归 ──')
const single = await executeSkillPlan({
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: {} }],
  fallback: 'STOP',
}).catch(() => null)
check('SC6 单 Skill 编排仍 COMPLETED', single?.plan?.status === 'COMPLETED' && single?.plan?.steps[0]?.result?.ok === true, single?.plan?.status)

// ── 审计: planId 入 KernelEvent ──
console.log('\n── 审计: planId 落库（Q3 冻结）──')
let planEv: any = null
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 500))
  const events = await fetch(`${AUDIT_API}`).then((r) => r.json()).catch(() => ({ data: { events: [] } }))
  const evs = events?.data?.events ?? []
  planEv = evs.find((e: any) => e.payload?.executionId === plan1?.plan?.planId) ?? null
  if (planEv) break
}
check('审计含 planId/status/steps', !!planEv && !!planEv.payload?.toolCalls?.length && ['completed', 'partial_completed', 'failed'].includes(planEv.payload?.status), planEv?.payload?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
