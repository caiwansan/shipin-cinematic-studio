/**
 * S4.1 BYOK Reality Gate — BY1-BY5（真实租户凭证闭环）
 * BY1 Credential Boundary（Skill 无 Key / Log 无 Key）
 * BY2 Tenant Isolation（A 租户凭证不可被 B 租户使用）
 * BY3 Runtime Routing（同 Skill 不同 Tenant 走不同 Provider）
 * BY4 Failure Reality（无效凭证 → 明确错误 + Audit + 无敏感泄露）
 * BY5 Full Alice E2E（租户身份 → Planner/Skills → BYOK Provider → 资产 → 审计）
 */
import { prisma } from '../src/utils/index.js'
import { encryptKey } from '../src/services/crypto.service.js'
import { userModelResolver } from '../src/services/user-model-resolver.js'
import { unifiedAIGateway } from '../src/services/unified-ai-gateway.js'
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
const ORG_A = '11111111-2222-4333-8444-555555555555' // tenant_org_test 昆仑镜验收测试企业
const ORG_B = 'ce80a00f-b4c3-4912-b9e3-380fa33dc46e' // tenant_iso_test 测试企业
const USER_A = process.env.TENANT_A_USER || ''
const USER_B = process.env.TENANT_B_USER || ''
const DEV_KEY = process.env.DEEPSEEK_DEV_API_KEY || ''

console.log('══ S4.1 BYOK Reality Gate（BY1-BY5）══')
check('前置: dev key 可用', DEV_KEY.length > 20, DEV_KEY.length)
check('前置: 租户 A/B 用户', !!USER_A && !!USER_B, { A: USER_A, B: USER_B })
if (!DEV_KEY || !USER_A || !USER_B) {
  console.log('FATAL: 前置缺失（DEV key / 租户用户）')
  process.exit(1)
}

// ── 凭证种子（加密存储; A=deepseek 真实, B=volcengine 占位路由）──
console.log('\n── 种子: 租户凭证（加密）──')
const upsertCred = async (orgId: string, provider: string, model: string, key: string, status = 'ACTIVE') => {
  const ref = encryptKey(key)
  return prisma.tenantProviderCredential.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, provider, modelName: model, credentialRef: ref, status },
    update: { provider, modelName: model, credentialRef: ref, status },
  })
}
const credA = await upsertCred(ORG_A, 'deepseek', 'deepseek-v4-flash', DEV_KEY)
const credB = await upsertCred(ORG_B, 'volcengine', 'doubao-route-test', 'sk-invalid-tenant-b')
check('凭证 A 落库（加密 ref）', !!credA.id && !credA.credentialRef.includes('sk-'), 'encrypted')
const rawRow = await prisma.$queryRawUnsafe<{ credential_ref: string }[]>('SELECT credential_ref FROM tenant_provider_credentials WHERE id = $1', credA.id).catch(() => [])
check('BY1 DB 无明文 Key（encryptKey 格式 iv:tag:cipher）', (rawRow[0]?.credential_ref || '').split(':').length === 3, rawRow[0]?.credential_ref?.slice(0, 20))

// ── BY1: Credential Boundary ──
console.log('\n── BY1: Credential Boundary ──')
const hermesSrc = readFileSync(new URL('../../tools/hermes-runtime-skill.mjs', import.meta.url), 'utf-8')
const skillSrc = readFileSync(new URL('../src/ecosystem/skill-orchestrator.ts', import.meta.url), 'utf-8')
check('BY1 Skill/工具层零 Key 引用', !/DEEPSEEK_DEV_API_KEY|apiKey/.test(hermesSrc) && !/apiKey/.test(skillSrc), 'no key in skill layer')
const resolved = await userModelResolver.resolve('llm', USER_A)
check('BY1 Resolver 进程内获取 Key（source=tenant-credential）', resolved?.source === 'tenant-credential' && resolved.apiKey.length > 20, resolved?.source)
check('BY1 凭证来源为 A 租户 deepseek', resolved?.provider === 'deepseek', resolved?.provider)

// ── BY2: Tenant Isolation ──
console.log('\n── BY2: Tenant Isolation ──')
const resolvedB = await userModelResolver.resolve('llm', USER_B)
check('BY2 B 租户解析到自身凭证（volcengine）, 非 A 的 deepseek', resolvedB?.provider === 'volcengine' && resolvedB?.source === 'tenant-credential', { provider: resolvedB?.provider, source: resolvedB?.source })
// 交叉验证: 若隔离失效, B 会拿到 A 的 deepseek
check('BY2 无跨租户泄露（B ≠ deepseek/A 凭证）', resolvedB?.provider !== 'deepseek', resolvedB?.provider)

// ── BY3: Runtime Routing（同 Skill 不同租户 → 不同 Provider）──
console.log('\n── BY3: Runtime Routing ──')
const routeA = await userModelResolver.resolve('llm', USER_A)
const routeB = await userModelResolver.resolve('llm', USER_B)
check('BY3 同一 capability 不同租户路由不同 provider', routeA?.provider === 'deepseek' && routeB?.provider === 'volcengine' && routeA?.provider !== routeB?.provider, { A: routeA?.provider, B: routeB?.provider })

// ── BY4: Failure Reality（B 凭证无效 → 明确错误 + Audit + 无泄露）──
console.log('\n── BY4: Failure Reality ──')
// 将 B 凭证改为不支持的 provider, 模拟无效凭证（gateway 快速失败, 无外部网络依赖）
await prisma.tenantProviderCredential.update({ where: { id: credB.id }, data: { provider: 'bogus-provider', modelName: 'x' } })
const failRes = await unifiedAIGateway.invokeAI({
  userId: USER_B,
  projectId: '00000000-0000-4000-8000-000000000001',
  agentType: 'orchestrator' as any,
  capability: 'llm',
  input: { messages: [{ role: 'user', content: 'ping' }] },
}).catch((e) => ({ status: 'error', error: e.message }))
check('BY4 明确错误（不支持的服务商）', failRes.status === 'error' && /不支持的服务商/.test(failRes.error || ''), failRes.error)
check('BY4 错误无敏感信息（不含 Key）', !/sk-|apiKey|credential/i.test(failRes.error || ''), failRes.error)
const failLog = await prisma.invocationLog.findFirst({ where: { provider: 'bogus-provider' }, orderBy: { createdAt: 'desc' } }).catch(() => null)
check('BY4 Audit 记录失败（InvocationLog status=failed）', failLog?.status === 'failed', failLog?.status)

// ── BY5: Full Alice E2E（租户 A 身份 → 全链 BYOK）──
console.log('\n── BY5: Full Alice E2E ──')
await prisma.tenantProviderCredential.update({ where: { id: credB.id }, data: { provider: 'volcengine', modelName: 'doubao-route-test' } }) // 还原 B
const { planFromIntent } = await import('../src/ecosystem/skill-planner.service.js')
const { executeSkillPlan } = await import('../src/ecosystem/skill-orchestrator.js')
const SAMPLE_TRANSCRIPT = '面试官: 请介绍你的 Java 经验。候选人: 我有 5 年 Java 开发经验。'
const pl = await planFromIntent({ employeeDefinitionId: 'def-recruiter-alice', intent: '对候选人做完整招聘评估', tenantUserId: USER_A }).catch(() => null)
check('BY5 Planner 经租户 A 凭证执行', pl?.ok === true && pl?.plan?.steps?.length > 0, pl?.errors || 'ok')
const steps = (pl?.plan?.steps || []).map((s: any) => ({
  stepId: s.stepId, skillId: s.skillId, tool: s.tool, dependsOn: s.dependsOn,
  input: s.skillId === 'def-resume-parser'
    ? { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A }
    : s.skillId === 'def-interview-evaluator'
      ? { resume: { name: '张伟' }, interviewTranscript: SAMPLE_TRANSCRIPT, jobRequirement: 'Java', tenantUserId: USER_A }
      : { resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: 'Java', tenantUserId: USER_A },
}))
const e2e = await executeSkillPlan({ employeeDefinitionId: 'def-recruiter-alice', fallback: 'STOP', steps }).catch(() => null)
check('BY5 全链 COMPLETED（租户 A BYOK 凭证）', e2e?.plan?.status === 'COMPLETED', e2e?.plan?.status)
const scoreStep = e2e?.plan?.steps.find((s) => s.tool === 'candidate.score')
check('BY5 candidate.score 真实（source=real）', scoreStep?.result?.result?.source === 'real', scoreStep?.result?.result?.source)
const lastLog = await prisma.invocationLog.findFirst({ where: { provider: 'deepseek' }, orderBy: { createdAt: 'desc' } }).catch(() => null)
check('BY5 InvocationLog provider=deepseek（租户 A 凭证路由审计）', lastLog?.provider === 'deepseek' && lastLog?.status === 'success', lastLog?.provider)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
