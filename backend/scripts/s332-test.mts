/**
 * S3.3.2 Task 05 — Reality Test（SC7-SC11, 零写库）
 * SC7  retry 生效（mock.flaky 首次 transient 失败 → 重试成功）
 * SC8  timeout 生效（mock.slow 超时 → TIMEOUT, 不重试则 FAILED）
 * SC9  parallel step（同层独立 step 并发执行, 时长 < 串行总和）
 * SC10 dependency failure（依赖失败 → 依赖者 SKIPPED(DEPENDENCY_FAILED)）
 * SC11 S3.2.3 regression（单 Skill 执行链路不变）
 */
import {
  executeSkillPlan,
  buildLevels,
  topoSortSteps,
} from '../src/ecosystem/skill-orchestrator.js'

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

const runId = 'run-' + Date.now()
console.log('══ S3.3.2 Reality Test（SC7-SC11）══')

// ── SC7: retry 生效 ──
console.log('\n── SC7: retry（mock.flaky 首次失败→重试成功）──')
const sc7 = await executeSkillPlan({
  fallback: 'STOP',
  retry: { maxAttempts: 3, backoffMs: 50 },
  steps: [{ skillId: 'def-test-harness', tool: 'mock.flaky', input: { runId }, timeoutMs: 5000 }],
}).catch(() => null)
if (sc7?.plan) {
  const step = sc7.plan.steps[0]
  check('SC7 step COMPLETED（重试后成功）', step.status === 'COMPLETED', step.status)
  check('SC7 attempts = 2（1 失败 + 1 成功）', step.attempts === 2, step.attempts)
  check('SC7 result.flaky = false', step.result?.result?.flaky === false, step.result)
  check('SC7 plan COMPLETED', sc7.plan.status === 'COMPLETED', sc7.plan.status)
} else {
  check('SC7 执行', false, sc7?.errors || 'null')
}

// ── SC8: timeout 生效 ──
console.log('\n── SC8: timeout（mock.slow 5s > timeoutMs 800ms）──')
const sc8 = await executeSkillPlan({
  fallback: 'STOP',
  retry: { maxAttempts: 1 },
  timeoutMs: 800,
  steps: [{ skillId: 'def-test-harness', tool: 'mock.slow', input: { sleepMs: 5000 } }],
}).catch(() => null)
if (sc8?.plan) {
  const step = sc8.plan.steps[0]
  check('SC8 step FAILED', step.status === 'FAILED', step.status)
  check('SC8 errorType = TIMEOUT', step.errorType === 'TIMEOUT', step.errorType)
  check('SC8 attempts = 1（无重试配置）', step.attempts === 1, step.attempts)
  check('SC8 plan FAILED', sc8.plan.status === 'FAILED', sc8.plan.status)
} else {
  check('SC8 执行', false, sc8?.errors || 'null')
}

// ── SC8b: execution deadline 生效 ──
console.log('\n── SC8b: plan deadline（2×2s 并行 + deadline 1.5s）──')
const sc8b = await executeSkillPlan({
  fallback: 'CONTINUE',
  timeoutMs: 10000,
  deadlineMs: 1500,
  steps: [
    { stepId: 'p1', skillId: 'def-test-harness', tool: 'mock.slow', input: { sleepMs: 2000 } },
    { stepId: 'p2', skillId: 'def-test-harness', tool: 'mock.slow', input: { sleepMs: 2000 } },
  ],
}).catch(() => null)
if (sc8b?.plan) {
  check('SC8b plan FAILED（deadline exceeded）', sc8b.plan.status === 'FAILED', sc8b.plan.status)
  check('SC8b failureReason = DEADLINE_EXCEEDED', sc8b.plan.failureReason === 'DEADLINE_EXCEEDED', sc8b.plan.failureReason)
} else {
  check('SC8b 执行', false, sc8b?.errors || 'null')
}

// ── SC9: parallel step（同层独立 step 并发）──
console.log('\n── SC9: parallel（2 个独立 step 各 1.2s, 并发 < 2.4s）──')
const t0 = Date.now()
const sc9 = await executeSkillPlan({
  fallback: 'STOP',
  timeoutMs: 10000,
  maxParallel: 4,
  steps: [
    { stepId: 'q1', skillId: 'def-test-harness', tool: 'mock.slow', input: { sleepMs: 1200 } },
    { stepId: 'q2', skillId: 'def-test-harness', tool: 'mock.slow', input: { sleepMs: 1200 } },
  ],
}).catch(() => null)
const sc9Duration = Date.now() - t0
if (sc9?.plan) {
  check('SC9 双 step COMPLETED', sc9.plan.steps.every((s) => s.status === 'COMPLETED'), sc9.plan.steps.map((s) => s.status))
  check('SC9 并发执行（耗时 < 2300ms, 串行需 2400ms）', sc9Duration < 2300, `${sc9Duration}ms`)
  check('SC9 plan COMPLETED', sc9.plan.status === 'COMPLETED', sc9.plan.status)
} else {
  check('SC9 执行', false, sc9?.errors || 'null')
}

// ── SC9b: buildLevels 分层正确（纯函数）──
const levels = buildLevels(
  [
    { stepId: 'a', dependsOn: [] },
    { stepId: 'b', dependsOn: [] },
    { stepId: 'c', dependsOn: ['a', 'b'] },
  ],
  ['a', 'b', 'c'],
)
check('SC9b 分层 = [[a,b],[c]]', JSON.stringify(levels) === JSON.stringify([['a', 'b'], ['c']]), levels)

// ── SC10: dependency failure ──
console.log('\n── SC10: 依赖失败 → 依赖者 SKIPPED ──')
const sc10 = await executeSkillPlan({
  fallback: 'CONTINUE',
  retry: { maxAttempts: 1 },
  steps: [
    { stepId: 's1', skillId: 'def-resume-parser', tool: 'payment.authorize', input: {} },
    { stepId: 's2', skillId: 'def-candidate-scorer', tool: 'candidate.score', input: {}, dependsOn: ['s1'] },
  ],
}).catch(() => null)
if (sc10?.plan) {
  check('SC10 s1 FAILED（POLICY_REJECTED）', sc10.plan.steps[0].status === 'FAILED' && sc10.plan.steps[0].errorType === 'POLICY_REJECTED', sc10.plan.steps[0].status)
  check('SC10 s2 SKIPPED（DEPENDENCY_FAILED）', sc10.plan.steps[1].status === 'SKIPPED' && sc10.plan.steps[1].errorType === 'DEPENDENCY_FAILED', sc10.plan.steps[1])
  check('SC10 plan PARTIAL_COMPLETED', sc10.plan.status === 'PARTIAL_COMPLETED', sc10.plan.status)
} else {
  check('SC10 执行', false, sc10?.errors || 'null')
}

// ── SC11: S3.2.3 regression（单 Skill 执行链路）──
console.log('\n── SC11: S3.2.3 回归 ──')
const sc11 = await executeSkillPlan({
  fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { file: 'resume.pdf' } }],
}).catch(() => null)
check('SC11 单 Skill COMPLETED', sc11?.plan?.status === 'COMPLETED' && sc11?.plan?.steps[0]?.result?.ok === true, sc11?.plan?.status)
check('SC11 工具仍受 Policy（payment 拒绝）', (await executeSkillPlan({
  fallback: 'STOP',
  retry: { maxAttempts: 1 },
  steps: [{ skillId: 'def-resume-parser', tool: 'payment.authorize', input: {} }],
}).catch(() => null))?.plan?.status === 'FAILED', 'policy still enforced')

// ── 审计增强验证（duration/failureReason/attempts 入 KernelEvent）──
console.log('\n── Task 04: 审计增强 ──')
let planEv: any = null
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 500))
  const events = await fetch('http://127.0.0.1:4002/api/audit/hermes-execution').then((r) => r.json()).catch(() => ({ data: { events: [] } }))
  planEv = (events?.data?.events ?? []).find((e: any) => e.payload?.executionId === sc7?.plan?.planId) ?? null
  if (planEv) break
}
const p = planEv?.payload
check('审计含 steps 明细（attempts/durationMs/errorType）', !!p?.toolCalls?.length && 'attempts' in p.toolCalls[0] && 'durationMs' in p.toolCalls[0], p?.toolCalls?.[0])
check('审计含 result.failureReason/planDurationMs', 'planDurationMs' in (p?.result || {}) && 'failureReason' in (p?.result || {}), p?.result)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
