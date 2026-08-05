/**
 * S3.4.1-BLOCKED Reality Gate — RP1-RP4（零 LLM 阶段验收）
 * RP1: 真实 PDF 输入 → 文本提取 → 结构化解析（确定性, 无 LLM）
 * RP2: resume.parse Skill 经 Hermes Tool Policy 真实执行 → 结构化结果
 * RP3: KernelEvent 审计完整
 * RP4: 全链路不涉及 LLM（源码断言 + 结果 llmInvolved=false）
 */
import { readFileSync } from 'node:fs'

const HERMES = 'http://127.0.0.1:9457'
const AUDIT_API = 'http://127.0.0.1:4002/api/audit/hermes-execution'
const SAMPLE_PDF = process.env.KUNLUN_RESUME_SAMPLE || '/opt/kunlun/assets/resume-sample.pdf'

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

console.log('══ S3.4.1-BLOCKED Reality Gate（RP1-RP4, 零 LLM）══')

// ── RP1: 真实 PDF → 结构化解析 ──
console.log('\n── RP1: 真实 PDF 简历输入 ──')
const pdfExists = (() => {
  try { return readFileSync(SAMPLE_PDF).length > 100 } catch { return false }
})()
check('RP1 样例 PDF 存在', pdfExists, SAMPLE_PDF)

const { extractTextFromPdfFile } = await import('../src/services/pdf-text-extractor.js')
const extracted = await extractTextFromPdfFile(SAMPLE_PDF).catch((e) => ({ text: '', error: e.message }))
check('RP1 PDF 文本提取非空', (extracted.text || '').length > 50, (extracted.text || '').slice(0, 40))

const { ResumeParserAgent } = await import('../src/agents/job/resume-parser-agent.js')
const agent = new ResumeParserAgent()
const profile = agent.parseResume({ text: extracted.text, fileName: 'resume-sample.pdf' })
check('RP1 姓名提取 = 张伟', profile.name === '张伟', profile.name)
check('RP1 邮箱提取', profile.email === 'zhangwei@example.com', profile.email)
check('RP1 电话提取', profile.phone === '13812345678', profile.phone)
check('RP1 技能提取 ≥ 5', (profile.skills || []).length >= 5, profile.skills)
check('RP1 经验年限 = 5', profile.experienceYears === 5, profile.experienceYears)
const quality = agent.evaluateQuality(profile)
check('RP1 质量评分（规则引擎）', typeof quality.score === 'number' && quality.score >= 50, quality)

// ── RP2: resume.parse Skill 经 Hermes 真实执行 ──
console.log('\n── RP2: resume.parse Skill Execution ──')
const inv = await fetch(`${HERMES}/invocations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invocationId: 'inv-rp2-' + Date.now(),
    skillId: 'def-resume-parser',
    agentDefinitionId: 'def-resume-parser',
    tool: 'resume.parse',
    input: { filePath: SAMPLE_PDF },
    policy: { allowedTools: ['resume.parse', 'profile.extract'] },
  }),
}).then((r) => r.json()).catch((e) => ({ fetchError: e.message }))
check('RP2 status = COMPLETED', inv.status === 'COMPLETED', inv.status)
check('RP2 result.source = real', inv.result?.result?.source === 'real', inv.result?.result?.source)
check('RP2 result.profile.name = 张伟', inv.result?.result?.profile?.name === '张伟', inv.result?.result?.profile?.name)
check('RP2 llmInvolved = false', inv.result?.result?.llmInvolved === false, inv.result?.result?.llmInvolved)

// ── RP3: KernelEvent 审计 ──
console.log('\n── RP3: Cloud Audit ──')
let found: any = null
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 500))
  const events = await fetch(`${AUDIT_API}`).then((r) => r.json()).catch(() => ({ data: { events: [] } }))
  found = (events?.data?.events ?? []).find((e: any) => e.payload?.executionId === inv.executionId) ?? null
  if (found) break
}
check('RP3 审计事件存在', !!found, inv.executionId)
check('RP3 审计含 toolCalls/result', found?.payload?.toolCalls?.length > 0 && !!found?.payload?.result, found?.payload)

// ── RP4: 零 LLM 断言 ──
console.log('\n── RP4: 不涉及 LLM ──')
const internalSrc = readFileSync(new URL('../src/routes/skill-tools-internal.routes.ts', import.meta.url), 'utf-8')
const hermesSrc = readFileSync(new URL('../../tools/hermes-runtime-skill.mjs', import.meta.url), 'utf-8')
const llmRefs =
  (internalSrc.match(/invokeAI|Gateway|deepseek|openai/i) || []).length +
  (hermesSrc.match(/invokeAI|Gateway|deepseek|openai/i) || []).length
check('RP4 内部路由无 LLM 引用', llmRefs === 0, `${llmRefs} hits`)
check('RP4 结果声明 llmInvolved=false', inv.result?.result?.llmInvolved === false, inv.result?.result?.llmInvolved)

// ── Asset 管道（Task 02）──
console.log('\n── Task 02: Asset Delivery ──')
const { prisma } = await import('../src/utils/index.js')
const user = await prisma.user.findFirst({ where: { email: 'tenant_org_test@audit.local' } }).catch(() => null)
check('测试用户存在', !!user?.id, user?.id)
if (user?.id) {
  // 确保测试用户有 membership（UserAsset 外键指向 membership.userId）
  const membership = await prisma.membership.findUnique({ where: { userId: user.id } }).catch(() => null)
  if (!membership) {
    await prisma.membership.create({ data: { userId: user.id } })
    console.log('  (membership seeded for test user)')
  }
  const { deliverSkillAssets } = await import('../src/ecosystem/skill-asset.service.js')
  const delivered = await deliverSkillAssets({
    userId: user.id,
    title: '张伟-候选人分析',
    profile,
    quality,
  })
  check('任务资产目录生成（2 文件）', delivered.files.length === 2, delivered.files.map((f) => f.fileName))
  check('JSON 资产落库', delivered.assets.length === 2 && delivered.userAssets.length === 2, { assets: delivered.assets.length, userAssets: delivered.userAssets.length })
  // 静态 URL 可访问
  const jsonUrl = `http://127.0.0.1:4002${delivered.files[0].url}`
  const urlCheck = await fetch(jsonUrl).then((r) => r.status).catch(() => 0)
  check('Workspace 资产 URL 可访问（/uploads/）', urlCheck === 200, urlCheck)
}

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
