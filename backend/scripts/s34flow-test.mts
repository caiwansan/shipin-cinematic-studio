/**
 * S3.4 Final Task 02 — 真实数据流映射 Reality Gate
 * DF1 映射纯函数（path 解析/缺源保持）
 * DF2 校验: inputMap 数据源必须 ∈ dependsOn
 * DF3 全链集成: resume.parse 输出 → candidate.score / interview.evaluate 输入（真实运行）
 * DF4 回归: 既有无映射计划不受影响
 */
import { resolveStepInput, executeSkillPlan, validatePlan } from '../src/ecosystem/skill-orchestrator.js'
import type { SkillPlanStep, PlanStepInput } from '../src/ecosystem/skill-orchestrator.js'

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

console.log('══ S3.4 Final Task 02（数据流映射）══')

// ── DF1: resolveStepInput 纯函数 ──
console.log('\n── DF1: 映射纯函数 ──')
const fakeParse = { result: { result: { profile: { name: '张伟', skills: ['java'] }, quality: { score: 80 } } } }
const results = new Map<string, any>([['p1', fakeParse]])
const step = {
  stepId: 's2', skillId: 'def-candidate-scorer', tool: 'candidate.score',
  input: { jobRequirement: 'Java' }, dependsOn: ['p1'], status: 'PENDING' as any,
  result: null, error: null, errorType: null, attempts: 0, durationMs: 0, executionId: null,
  inputMap: { resumeProfile: { from: 'p1', path: 'result.result.profile' } },
} as SkillPlanStep
const merged = resolveStepInput(step, results)
check('DF1 path 映射正确（resumeProfile 来自解析输出）', merged.resumeProfile?.name === '张伟' && merged.jobRequirement === 'Java', merged)
const stepNoMap = { ...step, inputMap: undefined }
check('DF1 无映射 → 原输入保持', JSON.stringify(resolveStepInput(stepNoMap, results)) === JSON.stringify({ jobRequirement: 'Java' }), resolveStepInput(stepNoMap, results))
const missing = new Map<string, any>()
check('DF1 缺源 → 不覆盖', resolveStepInput(step, missing).resumeProfile === undefined, resolveStepInput(step, missing))

// ── DF2: inputMap 依赖校验 ──
console.log('\n── DF2: 数据源必须 ∈ dependsOn ──')
const bad = validatePlan({
  steps: [{ stepId: 'x', skillId: 'def-candidate-scorer', tool: 'candidate.score', inputMap: { resumeProfile: { from: 'not-a-dep', path: 'a' } } }],
  employeeSkillSet: ['def-candidate-scorer'],
})
check('DF2 非依赖数据源 → INPUT_MAP_NOT_DEPENDENCY', bad.errors.some((e) => e.startsWith('INPUT_MAP_NOT_DEPENDENCY')), bad.errors)
const good = validatePlan({
  steps: [
    { stepId: 'p1', skillId: 'def-resume-parser', tool: 'resume.parse' },
    { stepId: 's2', skillId: 'def-candidate-scorer', tool: 'candidate.score', dependsOn: ['p1'], inputMap: { resumeProfile: { from: 'p1', path: 'result.result.profile' } } },
  ],
  employeeSkillSet: ['def-resume-parser', 'def-candidate-scorer'],
})
check('DF2 合法依赖映射 → 通过', good.ok === true, good.errors)

// ── DF3: 全链集成（真实数据流）──
console.log('\n── DF3: 真实数据流全链 ──')
const SAMPLE_TRANSCRIPT = '面试官: 请介绍你的 Java 经验。候选人: 我有 5 年 Java 开发经验，主导过订单系统重构。'
const steps: PlanStepInput[] = [
  { stepId: 'p1', skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf' } },
  {
    stepId: 's2', skillId: 'def-candidate-scorer', tool: 'candidate.score', dependsOn: ['p1'],
    input: { jobRequirement: 'Java 工程师' },
    inputMap: { resumeProfile: { from: 'p1', path: 'result.result.profile' } },
  },
  {
    stepId: 's3', skillId: 'def-interview-evaluator', tool: 'interview.evaluate', dependsOn: ['p1'],
    input: { interviewTranscript: SAMPLE_TRANSCRIPT, jobRequirement: 'Java 工程师' },
    inputMap: { resume: { from: 'p1', path: 'result.result.profile' } },
  },
]
const r = await executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', fallback: 'STOP', steps }).catch(() => null)
if (r?.plan) {
  check('DF3 全链 COMPLETED', r.plan.status === 'COMPLETED', r.plan.status)
  const p1 = r.plan.steps.find((s) => s.stepId === 'p1')
  const s2 = r.plan.steps.find((s) => s.stepId === 's2')
  const s3 = r.plan.steps.find((s) => s.stepId === 's3')
  check('DF3 resume.parse 真实（张伟）', p1?.result?.result?.profile?.name === '张伟', p1?.result?.result?.profile?.name)
  check('DF3 candidate.score 真实（数据流注入后评分）', s2?.status === 'COMPLETED' && s2?.result?.result?.source === 'real', s2?.status)
  check('DF3 interview.evaluate 真实（数据流注入后评估）', s3?.status === 'COMPLETED' && s3?.result?.result?.source === 'real', s3?.status)
} else {
  check('DF3 全链', false, r?.errors || 'null')
}

// ── DF4: 回归 ──
console.log('\n── DF4: 回归 ──')
const rg = await executeSkillPlan({ fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf' } }] }).catch(() => null)
check('DF4 无映射计划不受影响', rg?.plan?.status === 'COMPLETED', rg?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
