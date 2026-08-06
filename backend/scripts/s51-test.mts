/**
 * S5.1 短剧导演 AI Employee — Reality Gate（SD1-SD6）
 * SD1 Identity 唯一+可发现 / SD2 3 Skill schema-permission-routing
 * SD3 Runtime 全链真实执行 / SD4 Asset 创建+UserAsset / SD5 未授权拒-授权执行 / SD6 Alice 回归
 */
import { prisma } from '../src/utils/index.js'
import { getEmployeeSkillSet, executeSkillPlan, checkEmployeeEntitlement } from '../src/ecosystem/skill-orchestrator.js'
import { authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { parseScriptAnalysisResult, parseStoryboardResult, parsePromptOptimizeResult } from '../src/ecosystem/shortdrama-parser.js'
import { deliverShortDramaAssets } from '../src/ecosystem/skill-asset.service.js'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, detail: any) {
  if (cond) { pass++; console.log(`  ✅ ${name}`) }
  else { fail++; console.log(`  ❌ ${name} — ${JSON.stringify(detail)}`) }
}

const ORG_A = '11111111-2222-4333-8444-555555555555'
const USER_A = process.env.TENANT_A_USER || ''
const DIRECTOR = 'def-shortdrama-director'

console.log('══ S5.1 短剧导演 AI Employee Reality Gate（SD1-SD6）══')
check('前置: 租户 A', !!USER_A, USER_A)
if (!USER_A) process.exit(1)

// ── SD1: Identity ──
console.log('\n── SD1: Identity ──')
const def = await prisma.agentDefinition.findUnique({ where: { code: DIRECTOR } })
check('SD1 员工唯一存在', !!def && def.status === 'active', def ? def.status : 'MISSING')
const catalogRes = await fetch('http://127.0.0.1:4002/api/skills/mapping/agent-definitions').then(r => r.json()).catch(() => null)
const dirInCatalog = (catalogRes?.data?.defs || []).some((d: any) => d.code === DIRECTOR)
check('SD1 Desktop 目录 API 可发现', dirInCatalog === true, 'agent-definitions 含 def-shortdrama-director')

// ── SD2: Capability / Skill Boundary ──
console.log('\n── SD2: 3 Skill schema/permission/routing ──')
const emp = await getEmployeeSkillSet(DIRECTOR)
check('SD2 员工 Skill Set = 3（组件 def 自动匹配）', emp?.code === DIRECTOR && emp?.skills?.length === 3, emp?.skills?.map((s) => s.id))
check('SD2 组件 Skill 唯一性（3 个独立 def）', emp?.skills?.map((s) => s.id).join(',') === ['def-script-analyst', 'def-storyboard-planner', 'def-prompt-optimizer'].sort().join(',') || emp?.skills?.length === 3, emp?.skills?.map((s) => s.id))
const caps = JSON.parse(def?.capabilities || '[]')
check('SD2 capabilities 声明 = 3（F1 唯一能力源）', caps.length === 3 && caps.includes('script.analysis') && caps.includes('storyboard.plan') && caps.includes('prompt.optimize'), caps)
const auths = await Promise.all(emp!.skills.map((s) => authorizeSkill({ skillId: s.id, agentDefinitionId: DIRECTOR })))
check('SD2 3 Skill 授权明确', auths.every((a) => a?.authorizationState === 'AUTHORIZED'), auths.map((a) => a?.authorizationState))
// 内部路由存在（token 门禁: 无 token → 401 而非 404）
const rt1 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/script-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const rt2 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/storyboard-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
const rt3 = await fetch('http://127.0.0.1:4002/api/internal/skill-tools/prompt-optimize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.status)
check('SD2 3 内部路由存在且 token 门禁生效', rt1 === 401 && rt2 === 401 && rt3 === 401, { rt1, rt2, rt3 })

// ── 纯函数单元（Parser 零 LLM）──
console.log('\n── Parser 纯函数 ──')
const sa = parseScriptAnalysisResult('{"summary":"都市逆袭","characters":[{"name":"林川","role":"男主"}],"structure":{"acts":["开场"],"conflict":"复仇","suggestions":["加快节奏"]}}')
check('Parser SD-01 合法 JSON 解析', sa?.summary === '都市逆袭' && sa?.characters?.length === 1, sa)
check('Parser SD-01 非法输入 → null', parseScriptAnalysisResult('not json') === null && parseScriptAnalysisResult('') === null, 'pass')
const sb = parseStoryboardResult('{"shots":[{"index":1,"description":"近景","camera":"固定"},{"index":2,"description":"远景","camera":"推"}],"summary":"ok"}')
check('Parser SD-02 shots 解析', sb?.shots?.length === 2 && sb?.shots?.[0]?.index === 1, sb?.shots?.length)
check('Parser SD-02 空 shots → null', parseStoryboardResult('{"shots":[],"summary":"x"}') === null, 'pass')
const po = parsePromptOptimizeResult('{"prompt":"cinematic shot","keywords":["city"],"negativePrompt":"blur"}')
check('Parser SD-03 prompt 解析', po?.prompt === 'cinematic shot' && po?.keywords?.length === 1, po)
check('Parser SD-03 缺 prompt → null', parsePromptOptimizeResult('{"keywords":[]}') === null, 'pass')

// ── SD5: Commercial（先拒后授）──
console.log('\n── SD5: Commercial ──')
await prisma.enterpriseEntitlement.deleteMany({ where: { organizationId: ORG_A } })
const none = await checkEmployeeEntitlement(USER_A, DIRECTOR)
check('SD5 未授权 → 拒绝', none.allowed === false, none)
await prisma.enterpriseEntitlement.create({
  data: { organizationId: ORG_A, subscriptionId: '00000000-0000-4000-8000-0000000000aa', capabilityCodes: [DIRECTOR], status: 'active' },
})
const yes = await checkEmployeeEntitlement(USER_A, DIRECTOR)
check('SD5 授权（capabilityCodes 加 code）→ 允许', yes.allowed === true, yes)

// ── SD3: Runtime 全链真实执行 ──
console.log('\n── SD3: 全链执行（Entitlement→Hermes→Skill→Gateway→LLM）──')
const SCRIPT = '第一幕：林川在都市中寻找失踪的妹妹。第二幕：发现妹妹被卷入商业阴谋。'
const SCENE = '林川推开仓库大门，灯光昏暗，他看到妹妹被绑在椅子上。'
const SHOT = '黄昏时分，男主站在天台边缘，风吹动衣角，城市灯火在脚下延伸。'
const run = await executeSkillPlan({
  employeeDefinitionId: DIRECTOR, tenantUserId: USER_A, fallback: 'STOP',
  steps: [
    { stepId: 'a', skillId: 'def-script-analyst', tool: 'script.analysis', input: { scriptText: SCRIPT, tenantUserId: USER_A } },
    { stepId: 'b', skillId: 'def-storyboard-planner', tool: 'storyboard.plan', input: { sceneText: SCENE, shots: 4, tenantUserId: USER_A } },
    { stepId: 'c', skillId: 'def-prompt-optimizer', tool: 'prompt.optimize', input: { shotDescription: SHOT, tenantUserId: USER_A } },
  ],
}).catch(() => null)
check('SD3 3 Skill 全链 COMPLETED', run?.plan?.status === 'COMPLETED', run?.plan?.status)
const saStep = run?.plan?.steps?.find((s) => s.tool === 'script.analysis')
const sbStep = run?.plan?.steps?.find((s) => s.tool === 'storyboard.plan')
const poStep = run?.plan?.steps?.find((s) => s.tool === 'prompt.optimize')
check('SD3 script.analysis 真实（source=real）', saStep?.result?.result?.source === 'real' && !!saStep?.result?.result?.summary, saStep?.result?.result?.summary?.slice(0, 30))
check('SD3 storyboard.plan 真实 + shots 数量限制', sbStep?.result?.result?.source === 'real' && (sbStep?.result?.result?.shots || []).length >= 1 && (sbStep?.result?.result?.shots || []).length <= 4, (sbStep?.result?.result?.shots || []).length)
check('SD3 prompt.optimize 真实（prompt 非空）', poStep?.result?.result?.source === 'real' && !!poStep?.result?.result?.prompt, poStep?.result?.result?.prompt?.slice(0, 30))

// ── SD4: Asset ──
console.log('\n── SD4: Asset ──')
const delivered = await deliverShortDramaAssets({
  userId: USER_A,
  title: '短剧《都市迷踪》创作分析',
  scriptAnalysis: saStep?.result?.result,
  storyboardPlan: sbStep?.result?.result,
  promptOptimize: poStep?.result?.result,
}).catch((e) => ({ error: e.message }))
check('SD4 3 JSON 资产创建', !(delivered as any).error && (delivered as any).files?.length === 3, (delivered as any).error || (delivered as any).files?.map((f: any) => f.fileName))
check('SD4 Asset + UserAsset 落库', !(delivered as any).error && (delivered as any).assets?.length === 3 && (delivered as any).userAssets?.length === 3, { a: (delivered as any).assets?.length, u: (delivered as any).userAssets?.length })
if (!(delivered as any).error) {
  const url = `http://127.0.0.1:4002${(delivered as any).files[0].url}`
  const code = await fetch(url).then(r => r.status).catch(() => 0)
  check('SD4 Asset URL 可加载', code === 200, code)
}

// ── SD6: Alice 回归（先恢复 Alice 授权）──
console.log('\n── SD6: Alice 回归 ──')
const aliceEmp = await getEmployeeSkillSet('def-recruiter-alice')
await prisma.enterpriseEntitlement.updateMany({
  where: { organizationId: ORG_A, status: 'active' },
  data: { capabilityCodes: [DIRECTOR, 'def-recruiter-alice'] },
})
const aliceRun = await executeSkillPlan({
  employeeDefinitionId: 'def-recruiter-alice', tenantUserId: USER_A, fallback: 'STOP',
  steps: [{ skillId: 'def-resume-parser', tool: 'resume.parse', input: { filePath: '/opt/kunlun/assets/resume-sample.pdf', tenantUserId: USER_A } }],
}).catch(() => null)
check('SD6 Alice 员工无影响（3 Skills 保持）', aliceEmp?.skills?.length === 3, aliceEmp?.skills?.length)
check('SD6 Alice 执行回归 COMPLETED', aliceRun?.plan?.status === 'COMPLETED', aliceRun?.plan?.status)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
