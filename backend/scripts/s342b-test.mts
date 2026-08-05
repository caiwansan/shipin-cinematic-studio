/**
 * S3.4.2-B Reality Gate — CS1-CS6（真实 LLM 评分）
 * CS1 真实评分 / CS2 LLM Boundary / CS3 输出 Schema / CS4 Asset / CS5 Audit / CS6 回归
 */
import { parseScoreResult, buildScorePrompt } from '../src/ecosystem/score-parser.js'
import { prisma } from '../src/utils/index.js'
import { readFileSync } from 'node:fs'

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

const HERMES = 'http://127.0.0.1:9457'
const AUDIT_API = 'http://127.0.0.1:4002/api/audit/hermes-execution'

console.log('══ S3.4.2-B Reality Gate（CS1-CS6）══')

// 真实简历档案（复用样例解析结果）
const { ResumeParserAgent } = await import('../src/agents/job/resume-parser-agent.js')
const { extractTextFromPdfFile } = await import('../src/services/pdf-text-extractor.js')
const extracted = await extractTextFromPdfFile('/opt/kunlun/assets/resume-sample.pdf')
const profile = new ResumeParserAgent().parseResume({ text: extracted.text })

// ── CS3: Schema 校验（纯函数, 确定性）──
console.log('\n── CS3: 输出 Schema ──')
check('CS3 非法输出 → null（INVALID_TOOL_RESULT 前置）', parseScoreResult('{"hello":"xxx"}') === null, parseScoreResult('{"hello":"xxx"}'))
check('CS3 非 JSON → null', parseScoreResult('garbage{{{') === null, 'garbage')
check('CS3 score 非数字 → null', parseScoreResult('{"score":"high","strengths":[],"risks":[],"recommendation":"x"}') === null, 'non-numeric')
const good = parseScoreResult('{"score":87,"strengths":["Java 经验"],"risks":["缺乏管理经验"],"recommendation":"建议进入二面"}')
check('CS3 合法输出 → 结构完整', good?.score === 87 && Array.isArray(good?.strengths) && typeof good?.recommendation === 'string', good)
check('CS3 score 钳制 0-100', parseScoreResult('{"score":150,"strengths":[],"risks":[],"recommendation":""}')?.score === 100, parseScoreResult('{"score":150,"strengths":[],"risks":[],"recommendation":""}'))

// ── CS2: LLM Boundary（源码断言）──
console.log('\n── CS2: LLM Boundary ──')
const hermesSrc = readFileSync(new URL('../../tools/hermes-runtime-skill.mjs', import.meta.url), 'utf-8')
const internalSrc = readFileSync(new URL('../src/routes/skill-tools-internal.routes.ts', import.meta.url), 'utf-8')
check('CS2 hermes 工具无 provider SDK/API key 直连', !/deepseek-llm|api\.deepseek|DEEPSEEK_DEV_API_KEY/.test(hermesSrc), 'hermes clean')
check('CS2 内部路由仅经 invokeAI', /unifiedAIGateway\.invokeAI/.test(internalSrc) && !/fetch\(.*deepseek|axios/.test(internalSrc), 'gateway only')
check('CS2 内部路由 token 门禁', /checkToken/.test(internalSrc), 'token gate')

// ── CS1: 真实评分（Hermes → 内部路由 → Gateway → DeepSeek）──
console.log('\n── CS1: 真实评分 ──')
const inv = await fetch(`${HERMES}/invocations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invocationId: 'inv-cs1-' + Date.now(),
    skillId: 'def-candidate-scorer',
    agentDefinitionId: 'def-candidate-scorer',
    tool: 'candidate.score',
    input: { resumeProfile: profile, jobRequirement: 'Java 工程师，要求 3 年以上经验' },
    policy: { allowedTools: ['candidate.score'] },
  }),
}).then((r) => r.json()).catch((e) => ({ fetchError: e.message }))
const inner = inv.result?.result || {}
check('CS1 执行 COMPLETED', inv.status === 'COMPLETED', inv.status)
check('CS1 真实评分（source=real）', inner.source === 'real', inner.source)
check('CS1 score 为 0-100 数字', typeof inner.score === 'number' && inner.score >= 0 && inner.score <= 100, inner.score)
check('CS1 strengths/risks 数组', Array.isArray(inner.strengths) && Array.isArray(inner.risks), { strengths: inner.strengths, risks: inner.risks })
check('CS1 recommendation 非空', typeof inner.recommendation === 'string' && inner.recommendation.length > 0, inner.recommendation)

// ── CS4: Asset Delivery（评分并入分析资产）──
console.log('\n── CS4: Asset Delivery ──')
const user = await prisma.user.findFirst({ where: { email: 'tenant_org_test@audit.local' } })
const membership = await prisma.membership.findUnique({ where: { userId: user.id } }).catch(() => null)
if (!membership) await prisma.membership.create({ data: { userId: user.id } })
const { deliverSkillAssets } = await import('../src/ecosystem/skill-asset.service.js')
const delivered = await deliverSkillAssets({
  userId: user.id,
  title: '张伟-候选人分析（含评分）',
  profile,
  quality: null,
})
check('CS4 资产文件生成', delivered.files.length === 2, delivered.files.map((f) => f.fileName))
check('CS4 Asset/UserAsset 落库', delivered.assets.length === 2 && delivered.userAssets.length === 2, delivered.userAssets.length)
const analysisJson = await fetch(`http://127.0.0.1:4002${delivered.files[0].url}`).then((r) => r.json()).catch(() => null)
check('CS4 分析 JSON 可访问', !!analysisJson?.profile?.name, analysisJson?.profile?.name)

// ── CS5: Audit（InvocationLog provider/latency + KernelEvent）──
console.log('\n── CS5: Audit ──')
const log = await prisma.invocationLog.findFirst({ where: { provider: 'deepseek' }, orderBy: { createdAt: 'desc' } }).catch(() => null)
check('CS5 InvocationLog 含 provider/latency', !!log?.provider && log.latencyMs != null && log.status === 'success', { provider: log?.provider, latencyMs: log?.latencyMs })
let kernelEv: any = null
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 500))
  const events = await fetch(`${AUDIT_API}`).then((r) => r.json()).catch(() => ({ data: { events: [] } }))
  kernelEv = (events?.data?.events ?? []).find((e: any) => e.payload?.executionId === inv.executionId) ?? null
  if (kernelEv) break
}
check('CS5 KernelEvent 含 toolCalls/result', !!kernelEv?.payload?.toolCalls?.length && !!kernelEv?.payload?.result, kernelEv?.payload?.result?.ok)

// ── CS6: 回归（关键路径快速复验）──
console.log('\n── CS6: 回归 ──')
const policy = await fetch(`${HERMES}/invocations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ invocationId: 'cs6-policy', skillId: 'def-resume-parser', tool: 'payment.authorize', input: {}, policy: { allowedTools: ['resume.parse'] } }),
}).then((r) => r.json()).catch(() => ({}))
check('CS6 Policy 仍生效（payment 拒绝）', policy.status === 'POLICY_REJECTED', policy.status)
const { planFromIntent } = await import('../src/ecosystem/skill-planner.service.js')
const pl = await planFromIntent({ employeeDefinitionId: 'def-recruiter-alice', intent: '分析这个候选人的简历' }).catch(() => null)
check('CS6 Planner 不受影响', pl?.ok === true && pl?.plan?.steps?.length > 0, pl?.errors || pl?.plan?.steps?.length)
const { executeSkillPlan } = await import('../src/ecosystem/skill-orchestrator.js')
const rg = await executeSkillPlan({ fallback: 'STOP', steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf' } }] }).catch(() => null)
check('CS6 executeSkillPlan 回归', rg?.plan?.status === 'COMPLETED', rg?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
