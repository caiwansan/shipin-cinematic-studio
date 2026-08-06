/**
 * S5.3 Plugin Enhancement Reality — Reality Gate（PE1-PE6）
 * PE1 Plugin Identity / PE2 License 双层 / PE3 注入生效
 * PE4 F1 Boundary / PE5 Runtime Boundary / PE6 三员工回归
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'
import { getOrgEnhancementsForSkills, applyEnhancements } from '../src/ecosystem/plugin-enhancement.js'
import { buildScorePrompt } from '../src/ecosystem/score-parser.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''
const PLUGIN_ID = 'plugin-recruitment-jd-template'
const ALICE = 'def-recruiter-alice'
const DIRECTOR = 'def-shortdrama-director'
const NEWMEDIA = 'def-newmedia-ops'

console.log('══ S5.3 Plugin Enhancement Reality Gate（PE1-PE6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── PE1: Plugin Identity ──
console.log('\n── PE1: Plugin Identity ──')
const plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId: PLUGIN_ID } })
check('PE1 插件唯一存在', !!plugin && plugin.status === 'PUBLISHED', plugin ? plugin.status : 'MISSING')
const enhs0 = (plugin?.manifest as any)?.enhancements || []
check('PE1 manifest.enhancements 声明正确（挂载 candidate.score）', enhs0.length === 1 && enhs0[0]?.skillId === 'candidate.score' && Array.isArray(enhs0[0]?.templates) && enhs0[0].templates.length >= 1, enhs0)

// ── PE2: License 双层 ──
console.log('\n── PE2: License 双层 ──')
const lic = await prisma.ecologyLicense.findFirst({ where: { organizationId: ORG_A, pluginId: plugin!.id, status: 'ACTIVE' } })
check('PE2 企业插件授权存在（EcologyLicense ACTIVE）', !!lic, lic?.status)
const enhsA = await getOrgEnhancementsForSkills(ORG_A, ['candidate.score'])
check('PE2 有授权 → 增强可取', enhsA.length === 1 && enhsA[0].skillId === 'candidate.score', enhsA.map((e) => e.type))
const enhsB = await getOrgEnhancementsForSkills('ce80a00f-b4c3-4912-b9e3-380fa33dc46e', ['candidate.score'])
check('PE2 无授权组织 → 空（降级不拒绝）', enhsB.length === 0, enhsB.length)

// ── PE3: 注入生效（同一 Skill: 无插件 vs 有插件）──
console.log('\n── PE3: Enhancement Injection ──')
const basePrompt = buildScorePrompt({ resumeProfile: { name: '张伟', skills: ['java'] }, jobRequirement: 'Java' })
const enhanced = applyEnhancements(basePrompt, enhsA)
check('PE3 注入后 prompt 含 JD 模板', enhanced.user.includes('JD templates from licensed plugin') && enhanced.user.includes('互联网研发岗'), 'injected')
check('PE3 无增强 → prompt 原样', applyEnhancements(basePrompt, []).user === basePrompt.user, 'unchanged')
// 全链: 授权企业（A）执行 candidate.score（真实, 增强生效）; 未授权企业（B 无插件授权）基础执行
const runA = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-candidate-scorer', tool: 'candidate.score', input: { resumeProfile: { name: '张伟', skills: ['java', 'redis'] }, jobRequirement: '互联网研发岗', tenantUserId: USER_A } }],
}).catch(() => null)
check('PE3 A 企业全链 COMPLETED（增强链路真实）', runA?.plan?.status === 'COMPLETED', runA?.plan?.status)
check('PE3 candidate.score source=real', runA?.plan?.steps?.[0]?.result?.result?.source === 'real', runA?.plan?.steps?.[0]?.result?.result?.source)

// ── PE4: F1 Boundary ──
console.log('\n── PE4: F1 Boundary ──')
const aliceEmp = await getEmployeeSkillSet(ALICE)
check('PE4 Alice capabilities 不变（3 Skills, 零新增）', aliceEmp?.skills?.length === 3, aliceEmp?.skills?.map((s) => s.id))
const defCount = await prisma.agentDefinition.count()
check('PE4 AgentDefinition 零新增（插件不建 Agent）', defCount === 13, defCount) // 5 招聘 + 4 短剧 + 4 新媒体（S5.1/S5.2 seed 后）
const aliceCaps = JSON.parse((await prisma.agentDefinition.findUnique({ where: { code: ALICE } }))!.capabilities)
check('PE4 Alice capabilities 声明不变（4 能力）', aliceCaps.length === 4, aliceCaps)

// ── PE5: Runtime Boundary 扫描 ──
console.log('\n── PE5: Runtime Boundary ──')
const hermesSrc = (await import('node:fs')).readFileSync('/root/shipin-cinematic-studio/tools/hermes-runtime-skill.mjs', 'utf-8')
check('PE5 Hermes 无插件直调（0 插件引用）', !hermesSrc.includes('plugin-recruitment') && !hermesSrc.includes('manifest.enhancements'), '0')
const routeSrc = (await import('node:fs')).readFileSync('/root/shipin-cinematic-studio/backend/src/routes/skill-tools-internal.routes.ts', 'utf-8')
const noKey = !/sk-[A-Za-z0-9]{8,}/.test(routeSrc)
const invokeCount = (routeSrc.match(/unifiedAIGateway\.invokeAI/g) || []).length
const noNarrativeCall = !routeSrc.includes('narrativeGateway.') // 注释提及不计
check('PE5 内部路由零 Key / 零直调模型（invokeAI 唯一入口）', noKey && invokeCount >= 4 && noNarrativeCall, { invokeCount, noKey, noNarrativeCall })

// ── PE6: 三员工回归 ──
console.log('\n── PE6: 三员工回归 ──')
const rAlice = await executeSkillPlan({
  employeeDefinitionId: ALICE, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
const rDir = await executeSkillPlan({
  employeeDefinitionId: DIRECTOR, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: '第一幕：林川寻找妹妹。', tenantUserId: USER_A } }],
}).catch(() => null)
const rNm = await executeSkillPlan({
  employeeDefinitionId: NEWMEDIA, tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-content-copywriter', tool: 'content.draft', input: { topic: '回归', tenantUserId: USER_A } }],
}).catch(() => null)
check('PE6 Alice 回归 COMPLETED', rAlice?.plan?.status === 'COMPLETED', rAlice?.plan?.status)
check('PE6 短剧导演回归 COMPLETED', rDir?.plan?.status === 'COMPLETED', rDir?.plan?.status)
check('PE6 新媒体回归 COMPLETED', rNm?.plan?.status === 'COMPLETED', rNm?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
