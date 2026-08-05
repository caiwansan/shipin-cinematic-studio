/**
 * S3.2.2 Skill Authorization Adapter — 只读授权判定适配层
 * 依据: S3.2.2 掌柜批准（Task 01-04）
 * 原则:
 *  - Skill Authorization ≠ Skill Execution：只判定「是否有资格使用」，不执行
 *  - 唯一授权来源（Task 01 审计结论）= EcologyLicense（org+plugin, ACTIVE/EXPIRED/SUSPENDED）
 *    （EnterpriseEntitlement/PersonalEntitlement 仅 schema 未建表；EcologyPluginInstall=入口态非授权）
 *  - 判定语义与 LicenseService.checkLicense 一致（惰性到期：ACTIVE 但过期 → EXPIRED）
 *  - 授权 = Entitlement Check（License）+ AgentDefinition Capability Binding（能力绑定）
 *  - Hermes 未触碰（SA5）：本模块零 Hermes 引用
 */
import { prisma } from '../utils/index.js'
import type { SkillLifecycleState } from './skill-lifecycle-adapter.js'

/** S3.2.2 授权状态（SA1-SA4） */
export type SkillAuthorizationState =
  | 'AUTHORIZED' // SA2: 有效授权（License ACTIVE 或免费 Skill）
  | 'NOT_AUTHORIZED' // SA1: 商业 Skill 无有效授权
  | 'EXPIRED' // SA3: License 过期
  | 'SUSPENDED' // License 冻结
  | 'SKILL_PERMISSION_DENIED' // SA4: 越权 Agent（能力未绑定）
  | 'NONE' // 不适用（系统 runtime 能力）

/** 授权来源（entitlementSource） */
export type SkillAuthorizationSource =
  | 'EcologyLicense'
  | 'EnterpriseEntitlement'
  | 'PersonalEntitlement'
  | 'FREE'
  | 'NONE'

export interface SkillAuthorizationResult {
  skillId: string
  authorizationState: SkillAuthorizationState
  reason: string
  entitlementSource: SkillAuthorizationSource
  /** AgentDefinition 能力绑定结果（越权判定，SA4） */
  agentBinding: {
    agentDefinitionId: string
    bound: boolean
    agentCapabilities: string[]
    skillCapabilities: string[]
  } | null
  license: {
    status: string
    licenseType: string
    expireAt: string | null
    organizationId: string | null
  } | null
  checkedAt: string
}

/** compose 纯函数输入 */
export interface AuthorizationComposeInput {
  /** 商业化载体（manifest.billing）或存在 License → 需要授权 */
  required: boolean
  /** 系统 runtime 能力（授权不适用） */
  isRuntimeSkill: boolean
  /** License 判定结果（org 级或任意 org） */
  licenseStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | null
  /** ACTIVE 但已过 expireAt（惰性到期，与 checkLicense 一致） */
  licenseExpired: boolean
  /** null = 未提供 Agent 上下文（lifecycle 视图） */
  agentBound: boolean | null
}

/**
 * 授权状态合成（纯函数，SA1-SA4 可单测）
 * 优先级:
 *   1. 系统 runtime 能力 → NONE（授权不适用）
 *   2. 越权 Agent（能力未绑定）→ SKILL_PERMISSION_DENIED（SA4）
 *   3. 免费 Skill（无需授权）→ AUTHORIZED
 *   4. 无 License → NOT_AUTHORIZED（SA1）
 *   5. License 过期/到期 → EXPIRED（SA3）
 *   6. License 冻结 → SUSPENDED
 *   7. License ACTIVE → AUTHORIZED（SA2）
 */
export function composeAuthorization(input: AuthorizationComposeInput): {
  authorizationState: SkillAuthorizationState
  reason: string
  entitlementSource: SkillAuthorizationSource
} {
  if (input.isRuntimeSkill) {
    return { authorizationState: 'NONE', reason: 'SYSTEM_CAPABILITY_NOT_APPLICABLE', entitlementSource: 'NONE' }
  }
  if (input.agentBound === false) {
    return { authorizationState: 'SKILL_PERMISSION_DENIED', reason: 'AGENT_CAPABILITY_NOT_BOUND', entitlementSource: 'NONE' }
  }
  if (!input.required) {
    return { authorizationState: 'AUTHORIZED', reason: 'FREE_SKILL_NO_ENTITLEMENT_REQUIRED', entitlementSource: 'FREE' }
  }
  if (input.licenseStatus === null) {
    return { authorizationState: 'NOT_AUTHORIZED', reason: 'NO_ACTIVE_LICENSE', entitlementSource: 'EcologyLicense' }
  }
  if (input.licenseStatus === 'EXPIRED' || (input.licenseStatus === 'ACTIVE' && input.licenseExpired)) {
    return { authorizationState: 'EXPIRED', reason: 'LICENSE_EXPIRED', entitlementSource: 'EcologyLicense' }
  }
  if (input.licenseStatus === 'SUSPENDED') {
    return { authorizationState: 'SUSPENDED', reason: 'LICENSE_SUSPENDED', entitlementSource: 'EcologyLicense' }
  }
  return { authorizationState: 'AUTHORIZED', reason: 'LICENSE_ACTIVE', entitlementSource: 'EcologyLicense' }
}

/** 解析 JSON 字段（容错） */
function parseJson(raw: string | null | undefined): any {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/**
 * Task 02: 授权判定（只读）
 * 输入: { skillId, agentDefinitionId?, organizationId?, userId? }
 * 判定链:
 *   SkillLifecycleState（载体/商业化/any-org license）
 *   → AgentDefinition Capability Binding（agent.capabilities ⊇ skill.capabilities）
 *   → EcologyLicense（org 级判定，语义同 LicenseService.checkLicense）
 * 输出: { skillId, authorizationState, reason, entitlementSource }
 */
export async function authorizeSkill(params: {
  skillId: string
  agentDefinitionId?: string | null
  organizationId?: string | null
  userId?: string | null
}): Promise<SkillAuthorizationResult | null> {
  const { getSkillLifecycle } = await import('./skill-lifecycle-adapter.js')
  const lifecycle = await getSkillLifecycle(params.skillId)
  if (!lifecycle) return null

  const isRuntimeSkill = params.skillId.startsWith('runtime:')

  // ── 1. AgentDefinition 能力绑定（SA4 判据）──
  let agentBinding: SkillAuthorizationResult['agentBinding'] = null
  if (params.agentDefinitionId) {
    const agent = await prisma.agentDefinition
      .findUnique({ where: { code: params.agentDefinitionId }, select: { capabilities: true } })
      .catch(() => null)
    const { getSkill } = await import('./skill-manifest-adapter.js')
    const skillDef = await getSkill(params.skillId)
    const skillCaps = skillDef?.capabilities ?? []
    const agentCaps = parseJson(agent?.capabilities) || []
    const agentCapsArr = Array.isArray(agentCaps) ? agentCaps : [agentCaps]
    const bound = agentCapsArr.length > 0 && skillCaps.every((c: string) => agentCapsArr.includes(c))
    agentBinding = {
      agentDefinitionId: params.agentDefinitionId,
      bound,
      agentCapabilities: agentCapsArr,
      skillCapabilities: skillCaps,
    }
  }

  // ── 2. License 判定（org 级优先，无 org 取任意 org 最新）──
  const carrierPluginId = lifecycle.source.plugin?.pluginId ?? null
  let licenseRow: {
    id: string
    status: string
    licenseType: string
    expireAt: Date | null
    organizationId: string
  } | null = null
  if (carrierPluginId) {
    const q = {
      where: params.organizationId
        ? { organizationId_pluginId: { organizationId: params.organizationId, pluginId: carrierPluginId } }
        : { plugin: { pluginId: carrierPluginId } },
      orderBy: { updatedAt: 'desc' as const },
      select: {
        id: true,
        status: true,
        licenseType: true,
        expireAt: true,
        organizationId: true,
      },
    }
    licenseRow = params.organizationId
      ? ((await prisma.ecologyLicense.findUnique(q as any).catch(() => null)) as any)
      : ((await prisma.ecologyLicense.findFirst(q as any).catch(() => null)) as any)
  }

  const licenseStatus = licenseRow?.status as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | null | undefined
  const licenseExpired = Boolean(licenseRow && licenseRow.expireAt && new Date(licenseRow.expireAt) <= new Date())

  const composed = composeAuthorization({
    required: lifecycle.authorization.required,
    isRuntimeSkill,
    licenseStatus: licenseStatus ?? null,
    licenseExpired,
    agentBound: agentBinding ? agentBinding.bound : null,
  })

  return {
    skillId: params.skillId,
    authorizationState: composed.authorizationState,
    reason: composed.reason,
    entitlementSource: composed.entitlementSource,
    agentBinding,
    license: licenseRow
      ? {
          status: licenseRow.status,
          licenseType: licenseRow.licenseType,
          expireAt: licenseRow.expireAt ? licenseRow.expireAt.toISOString() : null,
          organizationId: licenseRow.organizationId,
        }
      : null,
    checkedAt: new Date().toISOString(),
  }
}
