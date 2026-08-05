/**
 * S3.2.1 Skill Lifecycle Adapter — 只读生命周期适配层
 * 依据: KUNLUN-S3.2-SKILL-LIFECYCLE-DESIGN-GATE.md + S3.2.1 掌柜批准
 * 原则:
 *  - 复用现有 SSOT（AgentDefinition / EcologyPlugin / EcologyPluginPublishRequest / EcologyLicense）
 *  - 只读 Adapter，不修改原模型，零新表（SL2）
 *  - Lifecycle 管状态 / License 管授权 / Hermes 管执行 —— 三者不合并（SL3/SL4）
 *  - executionReady 恒 false：S3.2.1 只让 Skill 拥有真实生命周期状态，不执行
 * 状态机（S3.2.1 生效子集）:
 *   DRAFT → SUBMITTED → APPROVED → PUBLISHED → AVAILABLE
 *   出口: REJECTED / DEPRECATED / DISABLED（任意阶段可废弃）
 *   预留（本阶段不启用）: AUTHORIZED（S3.2.2 授权接线）/ EXECUTABLE（S3.2.3）
 */
import { prisma } from '../utils/index.js'
import type { SkillDefinition } from './skill-manifest-adapter.js'
import { composeAuthorization } from './skill-authorization-adapter.js'
import type { SkillAuthorizationState, SkillAuthorizationSource } from './skill-authorization-adapter.js'

/** S3.2.1 生效的 Skill 生命周期状态 */
export type SkillLifecycleStateName =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'AVAILABLE'
  | 'DEPRECATED'
  | 'DISABLED'
  | 'REJECTED'
// AUTHORIZED / EXECUTABLE: 预留 S3.2.2 / S3.2.3，S3.2.1 不输出

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NONE'

export interface SkillLifecycleAuthorization {
  /** 是否要求授权（商业化载体或存在 License） */
  required: boolean
  /** S3.2.2 升级: 授权态（AUTHORIZED/NOT_AUTHORIZED/EXPIRED/SUSPENDED/SKILL_PERMISSION_DENIED/NONE） */
  status: SkillAuthorizationState
  /** 授权来源（entitlementSource） */
  source: SkillAuthorizationSource
  /** 判定原因 */
  reason: string
  licenseId: string | null
  licenseType: string | null
  expireAt: string | null
}

/** 状态来源明细（Lifecycle Source: 状态来自已有 SSOT，SL1） */
export interface SkillLifecycleSource {
  agentDefinition: {
    code: string
    status: string
    version: string
    updatedAt: string
  } | null
  plugin: {
    pluginId: string
    status: string
    lifecycleState: string
    updatedAt: string
  } | null
  publishRequest: {
    status: string
    reviewNote: string | null
    reviewedAt: string | null
  } | null
  license: {
    status: string
    licenseType: string
    expireAt: string | null
  } | null
}

export interface SkillLifecycleState {
  skillId: string
  name: string
  state: SkillLifecycleStateName
  version: string
  authorization: SkillLifecycleAuthorization
  /** S3.2.1 边界: Lifecycle 不执行（Hermes 执行属 S3.3，SL4） */
  executionReady: false
  source: SkillLifecycleSource
  updatedAt: string
}

/** compose 纯函数输入（来自 DB 解析或映射测试） */
export interface LifecycleComposeInput {
  skill: SkillDefinition
  agentDefinition: {
    status: string
    version: string
    updatedAt: Date | string
  } | null
  runtimeCapability: {
    status: string
  } | null
  plugin: {
    pluginId: string
    status: string
    lifecycleState: string
    updatedAt: Date | string
    /** manifest.billing 存在 = 商业化载体（authorization.required 依据） */
    commercial: boolean
  } | null
  publishRequest: {
    status: string
    reviewNote: string | null
    reviewedAt: Date | string | null
  } | null
  license: {
    status: string
    licenseType: string
    expireAt: Date | string | null
  } | null
}

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString()
}

/**
 * 状态合成（纯函数，Task 03 可直接单测）
 * 优先级（高→低，首个命中生效）:
 *   1. REJECTED  — PublishRequest 被拒（Case D）
 *   2. DISABLED  — AgentDefinition disabled / Plugin lifecycleState DISABLED
 *   3. DEPRECATED— AgentDefinition deprecated / Plugin DEPRECATED（Case B）
 *   4. AVAILABLE — Plugin PUBLISHED（发布=可被发现/授权）
 *   5. AVAILABLE — AgentDefinition active（无插件挂载，Case A）
 *   6. AVAILABLE — RuntimeCapability active
 *   7. DRAFT / SUBMITTED / APPROVED — PublishRequest 审核流（未发布前）
 *   8. DRAFT     — Plugin REGISTERED 无审核流（已创建未提交）
 *   9. DISABLED  — RuntimeCapability 非 active / 未知
 */
export function composeLifecycleState(input: LifecycleComposeInput): {
  state: SkillLifecycleStateName
  authorization: SkillLifecycleAuthorization
  updatedAt: string
} {
  const { skill, agentDefinition, runtimeCapability, plugin, publishRequest, license } = input
  const isRuntime = skill.id.startsWith('runtime:')

  // 1. REJECTED
  if (publishRequest?.status === 'REJECTED') {
    return buildResult('REJECTED')
  }
  // 2. DISABLED
  if (agentDefinition?.status === 'disabled' || plugin?.lifecycleState === 'DISABLED') {
    return buildResult('DISABLED')
  }
  // 3. DEPRECATED（任意阶段可废弃）
  if (agentDefinition?.status === 'deprecated' || plugin?.status === 'DEPRECATED' || plugin?.lifecycleState === 'DEPRECATED') {
    return buildResult('DEPRECATED')
  }
  // 4. Plugin 已发布 → AVAILABLE
  if (plugin?.status === 'PUBLISHED') {
    return buildResult('AVAILABLE')
  }
  // 5. AgentDefinition 独立 Skill → AVAILABLE
  if (agentDefinition && agentDefinition.status === 'active') {
    return buildResult('AVAILABLE')
  }
  // 6. Runtime 能力 → AVAILABLE
  if (isRuntime) {
    return buildResult(runtimeCapability?.status === 'active' ? 'AVAILABLE' : 'DISABLED')
  }
  // 7. 审核流（未发布）
  if (publishRequest) {
    const st = publishRequest.status
    if (st === 'DRAFT') return buildResult('DRAFT')
    if (st === 'SUBMITTED') return buildResult('SUBMITTED')
    if (st === 'APPROVED') return buildResult('APPROVED')
  }
  // 8. Plugin 已注册未提交
  if (plugin) {
    return buildResult('DRAFT')
  }
  // 9. 未知
  return buildResult('DISABLED')

  function buildResult(state: SkillLifecycleStateName) {
    // 授权维度（S3.2.2: Entitlement Check 合成；License 管授权，独立于 Lifecycle 状态 — SL3）
    // lifecycle 视图无 Agent 上下文（agentBound=null），agent 级判定见 authorization 端点
    const authRequired = Boolean(plugin?.commercial) || Boolean(license)
    const licenseStatus = license
      ? (license.status as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED')
      : null
    const licenseExpired = Boolean(
      license?.expireAt && new Date(license.expireAt as any) <= new Date()
    )
    const auth = composeAuthorization({
      required: authRequired,
      isRuntimeSkill: skill.id.startsWith('runtime:'),
      licenseStatus,
      licenseExpired,
      agentBound: null,
    })
    const authorization: SkillLifecycleAuthorization = {
      required: authRequired,
      status: auth.authorizationState,
      source: auth.entitlementSource,
      reason: auth.reason,
      licenseId: null,
      licenseType: license?.licenseType ?? null,
      expireAt: iso(license?.expireAt),
    }
    const timestamps = [
      agentDefinition?.updatedAt,
      plugin?.updatedAt,
      publishRequest?.reviewedAt,
      license?.expireAt,
    ].filter(Boolean) as Array<Date | string>
    const updatedAt =
      timestamps.length > 0
        ? iso(timestamps.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)))
        : new Date(0).toISOString()
    return { state, authorization, updatedAt: updatedAt || new Date(0).toISOString() }
  }
}

/**
 * 解析 Skill 的完整生命周期（DB 只读）
 * 关联规则:
 *  - AgentDefinition: skill.source.agentDefinition（code 匹配）
 *  - RuntimeCapability: skill.id = runtime:{capability}
 *  - Plugin: manifest.skills / manifest.capabilities 引用 skillId（结构就绪；
 *    当前 Catalog 无插件挂载型 Skill，返回 null）
 *  - PublishRequest / License: 经 Plugin 关联（pluginId 唯一键 → EcologyPlugin.id）
 */
export async function resolveSkillLifecycle(skill: SkillDefinition): Promise<SkillLifecycleState> {
  let agentDefinition: LifecycleComposeInput['agentDefinition'] = null
  let runtimeCapability: LifecycleComposeInput['runtimeCapability'] = null
  let plugin: LifecycleComposeInput['plugin'] = null
  let publishRequest: LifecycleComposeInput['publishRequest'] = null
  let license: LifecycleComposeInput['license'] = null
  let licenseId: string | null = null

  // 1. AgentDefinition 宿主
  if (skill.source.agentDefinition) {
    const def = await prisma.agentDefinition
      .findUnique({ where: { code: skill.source.agentDefinition } })
      .catch(() => null)
    if (def) {
      agentDefinition = {
        status: def.status,
        version: def.version,
        updatedAt: def.updatedAt,
      }
    }
  }

  // 2. Runtime 能力
  if (skill.id.startsWith('runtime:') && skill.source.runtimeCapabilities?.length) {
    const capName = skill.source.runtimeCapabilities[0]
    const cap = await prisma.ecologyRuntimeCapability
      .findFirst({ where: { capability: capName }, select: { status: true } })
      .catch(() => null)
    if (cap) runtimeCapability = { status: cap.status }
  }

  // 3. Plugin 载体（manifest 引用 skillId；当前无数据，结构就绪）
  const linkedPlugin = await prisma.ecologyPlugin
    .findFirst({
      where: {
        OR: [
          { manifest: { path: ['skills'], array_contains: [skill.id] } },
          { manifest: { path: ['capabilities'], array_contains: [skill.id] } },
        ],
      },
    })
    .catch(() => null)

  if (linkedPlugin) {
    const manifest = (linkedPlugin.manifest as any) || {}
    plugin = {
      pluginId: linkedPlugin.pluginId,
      status: linkedPlugin.status,
      lifecycleState: linkedPlugin.lifecycleState,
      updatedAt: linkedPlugin.updatedAt,
      commercial: Boolean(manifest.billing),
    }
    // 4. 审核流（唯一键 pluginId → EcologyPlugin.id）
    const pr = await prisma.ecologyPluginPublishRequest
      .findFirst({
        where: { plugin: { pluginId: linkedPlugin.pluginId } },
        orderBy: { updatedAt: 'desc' },
        select: { status: true, reviewNote: true, reviewedAt: true },
      })
      .catch(() => null)
    if (pr) {
      publishRequest = { status: pr.status, reviewNote: pr.reviewNote, reviewedAt: pr.reviewedAt }
    }
    // 5. 授权（License）
    const lic = await prisma.ecologyLicense
      .findFirst({
        where: { plugin: { pluginId: linkedPlugin.pluginId } },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true, licenseType: true, expireAt: true },
      })
      .catch(() => null)
    if (lic) {
      license = { status: lic.status, licenseType: lic.licenseType, expireAt: lic.expireAt }
      licenseId = lic.id
    }
  }

  const composed = composeLifecycleState({
    skill,
    agentDefinition,
    runtimeCapability,
    plugin,
    publishRequest,
    license,
  })

  const source: SkillLifecycleSource = {
    agentDefinition: agentDefinition
      ? {
          code: skill.source.agentDefinition!,
          status: agentDefinition.status,
          version: agentDefinition.version,
          updatedAt: iso(agentDefinition.updatedAt)!,
        }
      : null,
    plugin: plugin ? { pluginId: plugin.pluginId, status: plugin.status, lifecycleState: plugin.lifecycleState, updatedAt: iso(plugin.updatedAt)! } : null,
    publishRequest: publishRequest
      ? { status: publishRequest.status, reviewNote: publishRequest.reviewNote, reviewedAt: iso(publishRequest.reviewedAt) }
      : null,
    license: license ? { status: license.status, licenseType: license.licenseType, expireAt: iso(license.expireAt) } : null,
  }

  return {
    skillId: skill.id,
    name: skill.name,
    state: composed.state,
    version: skill.version,
    authorization: { ...composed.authorization, licenseId },
    executionReady: false,
    source,
    updatedAt: composed.updatedAt,
  }
}

/** 查询入口: 按 skillId 返回统一生命周期视图（只读） */
export async function getSkillLifecycle(skillId: string): Promise<SkillLifecycleState | null> {
  const { getSkill } = await import('./skill-manifest-adapter.js')
  const skill = await getSkill(skillId)
  if (!skill) return null
  return resolveSkillLifecycle(skill)
}
