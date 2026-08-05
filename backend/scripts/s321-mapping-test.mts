/**
 * S3.2.1 Task 03 — 状态映射验证（Reality Test）
 * Case A: AgentDefinition active            → AVAILABLE        （真实数据）
 * Case B: Plugin DEPRECATED                 → DEPRECATED       （映射逻辑，线上无样本）
 * Case C: License EXPIRED                   → AUTHORIZED=false（映射逻辑，线上无样本）
 * Case D: PublishRequest REJECTED           → REJECTED         （映射逻辑，线上无样本）
 * 补充:   发布+审核+授权 全链 PUBLISHED     → AVAILABLE + auth ACTIVE（映射逻辑）
 *         runtime skill（真实数据）         → AVAILABLE
 * 原则: 零写库（纯 compose + 只读 getSkillLifecycle）
 */
import { composeLifecycleState, getSkillLifecycle } from '../src/ecosystem/skill-lifecycle-adapter.js'
import type { LifecycleComposeInput } from '../src/ecosystem/skill-lifecycle-adapter.js'

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

const skill = {
  id: 'resume-parser',
  name: 'ResumeParser',
  version: '1.0.0',
  description: null,
  category: 'official',
  capabilities: ['resume.parse'],
  requiredTools: [],
  permissions: [],
  lifecycleState: 'active',
  source: { agentDefinition: 'def-resume-parser', runtimeCapabilities: [] },
} as any

function input(over: Partial<LifecycleComposeInput>): LifecycleComposeInput {
  return {
    skill,
    agentDefinition: null,
    runtimeCapability: null,
    plugin: null,
    publishRequest: null,
    license: null,
    ...over,
  }
}

console.log('══ S3.2.1 Task 03 状态映射验证 ══')

// ── Case A: AgentDefinition active → AVAILABLE（真实数据走 DB）──
console.log('\n── Case A: AgentDefinition active → AVAILABLE ──')
const realA = await getSkillLifecycle('def-resume-parser').catch((e) => {
  console.log('  (DB 查询失败):', e.message)
  return null
})
if (realA) {
  check('def-resume-parser 真实解析', true, null)
  check('state = AVAILABLE', realA.state === 'AVAILABLE', realA.state)
  check('source.agentDefinition.status = active', realA.source.agentDefinition?.status === 'active', realA.source.agentDefinition)
  check('executionReady = false（S3.2.1 边界）', realA.executionReady === false, realA.executionReady)
} else {
  check('def-resume-parser 真实解析', false, 'null')
}
// compose 等价性（纯函数同输入）
const a = composeLifecycleState(input({ agentDefinition: { status: 'active', version: '1.0.0', updatedAt: new Date() } }))
check('compose: active → AVAILABLE', a.state === 'AVAILABLE', a.state)

// ── Case B: Plugin DEPRECATED → DEPRECATED ──
console.log('\n── Case B: Plugin DEPRECATED → DEPRECATED ──')
const b = composeLifecycleState(
  input({
    plugin: { pluginId: 'demo-skill-plugin', status: 'DEPRECATED', lifecycleState: 'ACTIVE', updatedAt: new Date(), commercial: true },
  }),
)
check('plugin.status DEPRECATED → state DEPRECATED', b.state === 'DEPRECATED', b.state)

// ── Case C: License EXPIRED → AUTHORIZED=false（authorization.status=EXPIRED）──
console.log('\n── Case C: License EXPIRED → AUTHORIZED=false ──')
const c = composeLifecycleState(
  input({
    plugin: { pluginId: 'demo-skill-plugin', status: 'PUBLISHED', lifecycleState: 'ACTIVE', updatedAt: new Date(), commercial: true },
    license: { status: 'EXPIRED', licenseType: 'subscription', expireAt: new Date(Date.now() - 86400000) },
  }),
)
check('license EXPIRED → authorization.status EXPIRED', c.authorization.status === 'EXPIRED', c.authorization)
check('license EXPIRED → 非授权（!= ACTIVE）', c.authorization.status !== 'ACTIVE', c.authorization.status)

// ── Case D: PublishRequest REJECTED → REJECTED ──
console.log('\n── Case D: PublishRequest REJECTED → REJECTED ──')
const d = composeLifecycleState(
  input({
    plugin: { pluginId: 'demo-skill-plugin', status: 'REGISTERED', lifecycleState: 'ACTIVE', updatedAt: new Date(), commercial: true },
    publishRequest: { status: 'REJECTED', reviewNote: 'capability 越权', reviewedAt: new Date() },
  }),
)
check('publishRequest REJECTED → state REJECTED', d.state === 'REJECTED', d.state)

// ── 补充 1: 全链 PUBLISHED + APPROVED + License ACTIVE → AVAILABLE + auth ACTIVE ──
console.log('\n── 补充: 发布+审核+授权 全链 ──')
const e = composeLifecycleState(
  input({
    plugin: { pluginId: 'demo-skill-plugin', status: 'PUBLISHED', lifecycleState: 'ACTIVE', updatedAt: new Date(), commercial: true },
    publishRequest: { status: 'APPROVED', reviewNote: 'ok', reviewedAt: new Date() },
    license: { status: 'ACTIVE', licenseType: 'subscription', expireAt: new Date(Date.now() + 86400000 * 30) },
  }),
)
check('全链 state = AVAILABLE', e.state === 'AVAILABLE', e.state)
check('全链 authorization.required = true（商业化载体）', e.authorization.required === true, e.authorization)
check('全链 authorization.status = ACTIVE', e.authorization.status === 'ACTIVE', e.authorization)

// ── 补充 2: 审核流中间态 SUBMITTED → SUBMITTED ──
const f = composeLifecycleState(
  input({
    plugin: { pluginId: 'demo-skill-plugin', status: 'REGISTERED', lifecycleState: 'ACTIVE', updatedAt: new Date(), commercial: true },
    publishRequest: { status: 'SUBMITTED', reviewNote: null, reviewedAt: null },
  }),
)
check('SUBMITTED → state SUBMITTED', f.state === 'SUBMITTED', f.state)

// ── 补充 3: runtime skill（真实数据）──
console.log('\n── 补充: runtime skill 真实解析 ──')
const g = await getSkillLifecycle('runtime:agent.lifecycle').catch(() => null)
if (g) {
  check('runtime:agent.lifecycle 真实解析', true, null)
  check('state = AVAILABLE', g.state === 'AVAILABLE', g.state)
  check('authorization.required = false（系统能力非商业）', g.authorization.required === false, g.authorization)
} else {
  check('runtime:agent.lifecycle 真实解析', false, 'null')
}

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
