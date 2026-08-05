/**
 * S3.2.3 Task 04 — 首次 Skill 真执行 Reality Gate（SE1-SE5）
 * SE1: AUTHORIZED Skill 可进入执行流程（意图生成）
 * SE2: UNAUTHORIZED/越权 Skill 在 Hermes 前拦截
 * SE3: Tool Policy 生效（allowedTools 白名单 + H-D 禁止集）
 * SE4: Result 返回（resume.parse mock）
 * SE5: Cloud Audit 完整（KernelEvent 落库）
 * 前提: hermes-skill-runtime (127.0.0.1:9457) 已启动
 */
import { composeExecutionIntent, prepareSkillExecution } from '../src/ecosystem/skill-execution-adapter.js'

const HERMES = 'http://127.0.0.1:9457'
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

console.log('══ S3.2.3 Task 04 Reality Gate（SE1-SE5）══')

// ── SE1: AUTHORIZED Skill 可进入执行流程 ──
console.log('\n── SE1: AUTHORIZED → 执行意图 ──')
const se1 = composeExecutionIntent({
  skillId: 'def-resume-parser',
  name: 'ResumeParser',
  version: '1.0.0',
  agentDefinitionId: 'def-resume-parser',
  capabilities: ['resume.parse', 'profile.extract'],
  requiredTools: ['resume.pdf', 'resume.docx'],
  authorizationState: 'AUTHORIZED',
  authorizationReason: 'LICENSE_ACTIVE',
})
check('SE1 allowed = true', se1.allowed === true, se1)
check('SE1 allowedTools = capabilities', JSON.stringify(se1.allowedTools) === JSON.stringify(['resume.parse', 'profile.extract']), se1.allowedTools)
check('SE1 deniedTools 含 H-D 禁止集', se1.runtimePolicy?.deniedTools.includes('payment.*') && se1.runtimePolicy?.deniedTools.includes('native.exec'), se1.runtimePolicy?.deniedTools)
check('SE1 executionReady = true', se1.executionReady === true, se1.executionReady)

// 真实数据: prepare def-resume-parser
const realPrepare = await prepareSkillExecution({ skillId: 'def-resume-parser', agentDefinitionId: 'def-resume-parser' }).catch(() => null)
if (realPrepare) {
  check('SE1 真实 prepare: allowed', realPrepare.allowed === true, realPrepare)
  check('SE1 真实 runtimePolicy.allowedTools', JSON.stringify(realPrepare.runtimePolicy?.allowedTools) === JSON.stringify(['resume.parse', 'profile.extract']), realPrepare.runtimePolicy?.allowedTools)
} else {
  check('SE1 真实 prepare', false, 'null')
}

// ── SE2: 越权 Agent → Hermes 前拦截 ──
console.log('\n── SE2: 未授权 → 拦截（Hermes 前）──')
const se2 = composeExecutionIntent({
  skillId: 'def-resume-parser',
  name: 'ResumeParser',
  version: '1.0.0',
  agentDefinitionId: 'ghost-agent',
  capabilities: ['resume.parse', 'profile.extract'],
  requiredTools: [],
  authorizationState: 'SKILL_PERMISSION_DENIED',
  authorizationReason: 'AGENT_CAPABILITY_NOT_BOUND',
})
check('SE2 allowed = false', se2.allowed === false, se2)
check('SE2 无 runtimePolicy（不产生执行意图）', se2.runtimePolicy === undefined, se2.runtimePolicy)
const realDeny = await prepareSkillExecution({ skillId: 'def-resume-parser', agentDefinitionId: 'ghost-agent' }).catch(() => null)
check('SE2 真实越权拒绝', realDeny?.allowed === false && realDeny?.authorizationState === 'SKILL_PERMISSION_DENIED', realDeny)

// ── SE3: Tool Policy 生效 ──
console.log('\n── SE3: Tool Policy（白名单 + H-D 禁止集）──')
const se3 = await fetch(`${HERMES}/invocations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invocationId: 'inv-se3-deny',
    skillId: 'def-resume-parser',
    tool: 'payment.authorize',
    input: { amount: 100 },
    policy: { allowedTools: ['resume.parse', 'profile.extract'], deniedTools: ['payment.*', 'identity.modify', 'registry.write', 'native.exec'] },
  }),
}).then((r) => r.json()).catch((e) => ({ fetchError: e.message }))
check('SE3 payment.authorize → POLICY_REJECTED', se3.status === 'POLICY_REJECTED', se3)

// ── SE4: Result 返回 ──
console.log('\n── SE4: resume.parse 执行返回 Result ──')
const se4 = await fetch(`${HERMES}/invocations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    invocationId: 'inv-se4-ok',
    skillId: 'def-resume-parser',
    agentDefinitionId: 'def-resume-parser',
    tool: 'resume.parse',
    input: { file: 'resume.pdf' },
    policy: { allowedTools: ['resume.parse', 'profile.extract'], deniedTools: [] },
  }),
}).then((r) => r.json()).catch((e) => ({ fetchError: e.message }))
check('SE4 status = COMPLETED', se4.status === 'COMPLETED', se4)
check('SE4 Sub-Agent 状态机完整', JSON.stringify(se4.subAgentStates) === JSON.stringify(['CREATED', 'INITIALIZING', 'READY', 'RUNNING', 'COMPLETED']), se4.subAgentStates)
check('SE4 result 返回', se4.result?.ok === true && !!se4.result?.result, se4.result)

// ── SE5: Cloud Audit 落库 ──
console.log('\n── SE5: Cloud Audit（KernelEvent）──')
await new Promise((r) => setTimeout(r, 500))
const auditEvents = await fetch(`${AUDIT_API}`).then((r) => r.json()).catch(() => ({ data: { events: [] } }))
const events = auditEvents?.data?.events ?? []
const found = events.find((e: any) => e.payload?.executionId === se4.executionId)
check('SE5 审计事件存在', !!found, se4.executionId)
check('SE5 审计含 toolCalls/result/status', found?.payload?.toolCalls?.length > 0 && !!found?.payload?.result && found?.payload?.status === 'completed', found?.payload)

// ── Health 冒烟 ──
const health = await fetch(`${HERMES}/health`).then((r) => r.json()).catch(() => null)
check('Hermes health: ownedBy HERMES_CONTROLLER', health?.ownedBy === 'HERMES_CONTROLLER', health)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
