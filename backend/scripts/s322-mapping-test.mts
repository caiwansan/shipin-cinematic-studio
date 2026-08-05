/**
 * S3.2.2 Task 04 — Reality Gate SA1-SA5（零写库）
 * SA1 无 License          → AVAILABLE + NOT_AUTHORIZED
 * SA2 有效 License        → AVAILABLE + AUTHORIZED
 * SA3 过期 License        → EXPIRED
 * SA4 越权 Agent          → SKILL_PERMISSION_DENIED
 * SA5 Hermes 未触碰       → 适配器零 Hermes 引用
 * 真实数据: def-resume-parser（免费 Skill）/ runtime 能力
 */
import { composeAuthorization, authorizeSkill } from '../src/ecosystem/skill-authorization-adapter.js'
import { composeLifecycleState, getSkillLifecycle } from '../src/ecosystem/skill-lifecycle-adapter.js'
import type { LifecycleComposeInput } from '../src/ecosystem/skill-lifecycle-adapter.js'
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

const skill = {
  id: 'resume-parser',
  name: 'ResumeParser',
  version: '1.0.0',
  description: null,
  category: 'official',
  capabilities: ['resume.parse', 'profile.extract'],
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

const commercialPlugin = {
  pluginId: 'demo-skill-plugin',
  status: 'PUBLISHED' as const,
  lifecycleState: 'ACTIVE' as const,
  updatedAt: new Date(),
  commercial: true,
}

console.log('══ S3.2.2 Task 04 Reality Gate ══')

// ── SA1: 商业 Skill 无 License → NOT_AUTHORIZED ──
console.log('\n── SA1: 无 License → NOT_AUTHORIZED ──')
const sa1 = composeAuthorization({ required: true, isRuntimeSkill: false, licenseStatus: null, licenseExpired: false, agentBound: null })
check('SA1 授权态 = NOT_AUTHORIZED', sa1.authorizationState === 'NOT_AUTHORIZED', sa1)
check('SA1 来源 = EcologyLicense', sa1.entitlementSource === 'EcologyLicense', sa1.entitlementSource)
// lifecycle 联动: 商业 Skill 无 License
const lc1 = composeLifecycleState(input({ plugin: commercialPlugin }))
check('SA1 lifecycle.state = AVAILABLE', lc1.state === 'AVAILABLE', lc1.state)
check('SA1 lifecycle.authorization.status = NOT_AUTHORIZED', lc1.authorization.status === 'NOT_AUTHORIZED', lc1.authorization)

// ── SA2: 有效 License → AUTHORIZED ──
console.log('\n── SA2: 有效 License → AUTHORIZED ──')
const sa2 = composeAuthorization({ required: true, isRuntimeSkill: false, licenseStatus: 'ACTIVE', licenseExpired: false, agentBound: null })
check('SA2 授权态 = AUTHORIZED', sa2.authorizationState === 'AUTHORIZED', sa2)
check('SA2 来源 = EcologyLicense', sa2.entitlementSource === 'EcologyLicense', sa2.entitlementSource)
const lc2 = composeLifecycleState(
  input({ plugin: commercialPlugin, license: { status: 'ACTIVE', licenseType: 'subscription', expireAt: new Date(Date.now() + 86400000 * 30) } }),
)
check('SA2 lifecycle.authorization.status = AUTHORIZED', lc2.authorization.status === 'AUTHORIZED', lc2.authorization)
check('SA2 lifecycle.authorization.source = EcologyLicense', lc2.authorization.source === 'EcologyLicense', lc2.authorization.source)

// ── SA3: 过期 License → EXPIRED ──
console.log('\n── SA3: 过期 License → EXPIRED ──')
const sa3 = composeAuthorization({ required: true, isRuntimeSkill: false, licenseStatus: 'EXPIRED', licenseExpired: true, agentBound: null })
check('SA3 授权态 = EXPIRED', sa3.authorizationState === 'EXPIRED', sa3)
// 惰性到期: ACTIVE 但过 expireAt
const sa3b = composeAuthorization({ required: true, isRuntimeSkill: false, licenseStatus: 'ACTIVE', licenseExpired: true, agentBound: null })
check('SA3b 惰性到期（ACTIVE+过期）→ EXPIRED', sa3b.authorizationState === 'EXPIRED', sa3b)

// ── SA4: 越权 Agent → SKILL_PERMISSION_DENIED ──
console.log('\n── SA4: 越权 Agent → SKILL_PERMISSION_DENIED ──')
const sa4 = composeAuthorization({ required: true, isRuntimeSkill: false, licenseStatus: 'ACTIVE', licenseExpired: false, agentBound: false })
check('SA4 授权态 = SKILL_PERMISSION_DENIED', sa4.authorizationState === 'SKILL_PERMISSION_DENIED', sa4)

// ── SA5: Hermes 未触碰（源码检查）──
console.log('\n── SA5: Hermes 未触碰 ──')
const authSrc = readFileSync(new URL('../src/ecosystem/skill-authorization-adapter.ts', import.meta.url), 'utf-8')
const lcSrc = readFileSync(new URL('../src/ecosystem/skill-lifecycle-adapter.ts', import.meta.url), 'utf-8')
const routeSrc = readFileSync(new URL('../src/routes/skill-lifecycle.routes.ts', import.meta.url), 'utf-8')
const hermesHits =
  (authSrc.match(/import .*hermes|HermesRuntime|hermesRuntime|\.invoke\(|hermes\./i) || []).length +
  (lcSrc.match(/import .*hermes|HermesRuntime|hermesRuntime|\.invoke\(|hermes\./i) || []).length +
  (routeSrc.match(/import .*hermes|HermesRuntime|hermesRuntime|\.invoke\(|hermes\./i) || []).length
check('SA5 Hermes 引用 = 0', hermesHits === 0, `${hermesHits} hits`)

// ── 真实数据: def-resume-parser ──
console.log('\n── 真实数据: def-resume-parser（免费官方 Skill）──')
const realLc = await getSkillLifecycle('def-resume-parser').catch(() => null)
if (realLc) {
  check('lifecycle.state = AVAILABLE', realLc.state === 'AVAILABLE', realLc.state)
  check('lifecycle.authorization.required = false（无商业载体）', realLc.authorization.required === false, realLc.authorization)
  check('lifecycle.authorization.status = AUTHORIZED（免费）', realLc.authorization.status === 'AUTHORIZED', realLc.authorization)
  check('lifecycle.authorization.source = FREE', realLc.authorization.source === 'FREE', realLc.authorization.source)
  check('lifecycle.executionReady = false（边界不变）', realLc.executionReady === false, realLc.executionReady)
} else {
  check('lifecycle 真实解析', false, 'null')
}

const realAuth = await authorizeSkill({ skillId: 'def-resume-parser', agentDefinitionId: 'def-resume-parser' }).catch(() => null)
if (realAuth) {
  check('authorizeSkill 真实解析', true, null)
  check('绑定 Agent → AUTHORIZED', realAuth.authorizationState === 'AUTHORIZED', realAuth.authorizationState)
  check('agentBinding.bound = true', realAuth.agentBinding?.bound === true, realAuth.agentBinding)
} else {
  check('authorizeSkill 真实解析', false, 'null')
}

const denyAuth = await authorizeSkill({ skillId: 'def-resume-parser', agentDefinitionId: 'ghost-agent' }).catch(() => null)
check('越权 Agent（ghost-agent）→ SKILL_PERMISSION_DENIED', denyAuth?.authorizationState === 'SKILL_PERMISSION_DENIED', denyAuth?.authorizationState)

const runtimeAuth = await authorizeSkill({ skillId: 'runtime:agent.lifecycle' }).catch(() => null)
check('runtime 能力 → NONE（不适用）', runtimeAuth?.authorizationState === 'NONE', runtimeAuth?.authorizationState)

const missing = await authorizeSkill({ skillId: 'not-exist' }).catch(() => null)
check('未知 Skill → null（404）', missing === null, missing)

console.log(`\n══ 结果: ${pass} PASS / ${fail} FAIL ══`)
process.exit(fail > 0 ? 1 : 0)
