/**
 * S4.2 Alice Commercial Reality Gate — CR1-CR5 + DF1
 * CR1 Capability（唯一可解释）/ CR2 无 License 拒绝 / CR3 企业隔离授权
 * CR4 Usage / CR5 Full Alice Commercial E2E / DF1 Interview Record Adapter
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement, getEmployeeUsageMeter } from '../src/ecosystem/skill-orchestrator.js'
import { authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { buildInterviewTranscript } from '../src/ecosystem/interview-parser.js'

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

const ORG_A = '11111111-2222-4333-8444-555555555555'
const ORG_B = 'ce80a00f-b4c3-4912-b9e3-380fa33dc46e'
const USER_A = process.env.TENANT_A_USER || ''
const USER_B = process.env.TENANT_B_USER || ''
const SUB_SYNTH = '00000000-0000-4000-8000-0000000000aa'
const ALICE = 'def-recruiter-alice'

console.log('══ S4.2 Alice Commercial Reality Gate（CR1-CR5 + DF1）══')
check('前置: 租户 A/B', !!USER_A && !!USER_B, { A: USER_A, B: USER_B })
if (!USER_A || !USER_B) process.exit(1)

// ── CR1: Capability Reality ──
console.log('\n── CR1: Capability ──')
const alice = await getEmployeeSkillSet(ALICE)
check('CR1 Alice 能力唯一且绑定 3 Skills', alice?.code === ALICE && alice?.skills?.length === 3, alice?.skills?.map((s) => s.id))
const auths = await Promise.all(alice!.skills.map((s) => authorizeSkill({ skillId: s.id, agentDefinitionId: ALICE })))
check('CR1 3 Skills 授权明确（AUTHORIZED/FREE）', auths.every((a) => a?.authorizationState === 'AUTHORIZED'), auths.map((a) => a?.authorizationState))

// ── CR2: 无 License → 拒绝执行 ──
console.log('\n── CR2: 无 License 拒绝 ──')
await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: ORG_A } })
const cr2 = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
check('CR2 无 Entitlement → 拒绝执行（ENTITLEMENT_DENIED）', cr2?.plan === null && (cr2?.errors || []).some((e) => e.startsWith('ENTITLEMENT_DENIED')), cr2?.errors)

// ── CR3: 企业隔离授权 ──
console.log('\n── CR3: 企业隔离 ──')
await prisma.enterpriseEntitlement.create({
  data: { organizationId: ORG_A, subscriptionId: SUB_SYNTH, capabilityCodes: [ALICE], status: 'active' },
})
const entA = await checkEmployeeEntitlement(USER_A, ALICE)
check('CR3 企业 A 授权后 → allowed', entA.allowed === true, entA)
const entB = await checkEmployeeEntitlement(USER_B, ALICE)
check('CR3 企业 B 未授权 → 拒绝（隔离）', entB.allowed === false && /NO_ENTITLEMENT|EMPLOYEE_NOT_ENTITLED/.test(entB.reason), entB)
const execA = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
check('CR3 企业 A 授权后可执行', execA?.plan?.status === 'COMPLETED', execA?.plan?.status)
const execB = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_B, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_B } }],
}).catch(() => null)
check('CR3 企业 B 未授权不执行', execB?.plan === null && (execB?.errors || []).some((e) => e.includes('ENTITLEMENT_DENIED')), execB?.errors)

// ── CR4: Usage ──
console.log('\n── CR4: Usage Meter ──')
const meter = await getEmployeeUsageMeter(USER_A, ALICE)
check('CR4 执行产生 Usage（executions ≥ 1）', meter.executions >= 1, meter.executions)
check('CR4 能力分解含 resume.parse', (meter.skills['resume.parse'] || 0) >= 1, meter.skills)
check('CR4 成功计数正确', meter.successful + meter.failed === meter.executions, { s: meter.successful, f: meter.failed, e: meter.executions })

// ── CR5: Full Alice Commercial E2E ──
console.log('\n── CR5: Full Commercial E2E ──')
const { planFromIntent } = await import('../src/ecosystem/skill-planner.service.js')
const SAMPLE_TRANSCRIPT = '面试官: 请介绍你的 Java 经验。候选人: 我有 5 年 Java 开发经验。'
const pl = await planFromIntent({ employeeDefinitionId: ALICE, intent: '对候选人做完整招聘评估', tenantUserId: USER_A }).catch(() => null)
check('CR5 Planner（授权企业身份）', pl?.ok === true && pl?.plan?.steps?.length > 0, pl?.errors || 'ok')
const steps = (pl?.plan?.steps || []).map((s: any) => ({
  stepId: s.stepId, skillId: s.skillId, tool: s.tool, dependsOn: s.dependsOn,
  input: s.skillId === 'def-resume-parser'
    ? { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A }
    : s.skillId === 'def-interview-evaluator'
      ? { resume: { name: '张伟' }, interviewRecord: { questions: [{ question: 'Java 经验?', answer: '5 年' }] }, jobRequirement: 'Java', tenantUserId: USER_A }
      : { resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: 'Java', tenantUserId: USER_A },
}))
const e2e = await executeSkillPlan({ employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP', steps }).catch(() => null)
check('CR5 全链 COMPLETED（授权+BYOK+Hermes+3Skills）', e2e?.plan?.status === 'COMPLETED', e2e?.plan?.status)
check('CR5 candidate.score 真实', e2e?.plan?.steps.find((s) => s.tool === 'candidate.score')?.result?.result?.source === 'real', 'real')
check('CR5 interview.evaluate 真实（记录适配后）', e2e?.plan?.steps.find((s) => s.tool === 'interview.evaluate')?.result?.result?.source === 'real', 'real')
const meter5 = await getEmployeeUsageMeter(USER_A, ALICE)
check('CR5 Usage 反映 3 Skills 全链', (meter5.skills['resume.parse'] || 0) >= 2 && (meter5.skills['candidate.score'] || 0) >= 1 && (meter5.skills['interview.evaluate'] || 0) >= 1, meter5.skills)

// ── DF1: Interview Record Adapter ──
console.log('\n── DF1: Interview Record Adapter ──')
const t1 = buildInterviewTranscript({ questions: [{ question: 'Java 经验?', answer: '5 年' }, { question: '高并发?', answer: 'Redis 削峰' }] })
check('DF1 questions 结构 → 文本', t1.includes('Q1: Java 经验?') && t1.includes('A2: Redis 削峰'), t1)
const t2 = buildInterviewTranscript({ dialog: [{ speaker: '面试官', text: '你好' }, { speaker: '候选人', text: '你好' }] })
check('DF1 dialog 结构 → 文本', t2.includes('面试官: 你好'), t2)
check('DF1 字符串透传', buildInterviewTranscript('raw transcript') === 'raw transcript', 'pass')
check('DF1 空/非法 → 空串', buildInterviewTranscript(null) === '' && buildInterviewTranscript(123) === '', 'pass')

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
