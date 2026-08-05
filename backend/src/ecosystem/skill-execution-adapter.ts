/**
 * S3.2.3 Skill Execution Adapter — 执行意图适配层（不执行）
 * 依据: S3.2.3 掌柜批准（Task 01-04）
 * 原则:
 *  - Authorization 通过 ≠ 直接执行：本模块只生成执行意图（runtimePolicy + allowedTools），交给 Hermes
 *  - 拒绝路径（未授权/越权）在 Hermes 之前拦截（SE2）
 *  - allowedTools 从 Skill 真实 capabilities 推导（执行操作），deniedTools 为 H-D 禁止集
 *  - 本模块零执行、零 Hermes 调用（Hermes 调用只在 routes 层编排时发生）
 */
import type { SkillAuthorizationState } from './skill-authorization-adapter.js'

/** H-D Hermes Capability Boundary 禁止集（掌柜 S3.2.3 清单） */
export const H_D_DENIED_TOOLS: string[] = ['payment.*', 'identity.modify', 'registry.write', 'native.exec']

export interface SkillExecutionIntent {
  allowed: boolean
  skillId: string
  name: string | null
  version: string
  agentDefinitionId: string | null
  /** S3.2.2 授权态（拒绝时给出原因） */
  authorizationState: SkillAuthorizationState
  reason: string
  runtimePolicy?: {
    boundary: 'H-D'
    allowedTools: string[]
    allowedResources: string[]
    deniedTools: string[]
  }
  allowedTools?: string[]
  /** S3.2.3 打开: AUTHORIZED Skill 具备执行条件（实际执行仍经 Hermes Policy, SE3） */
  executionReady?: boolean
}

/** compose 纯函数输入 */
export interface ExecutionComposeInput {
  skillId: string
  name: string | null
  version: string
  agentDefinitionId: string | null
  capabilities: string[]
  requiredTools: string[]
  authorizationState: SkillAuthorizationState
  authorizationReason: string
}

/**
 * 执行意图合成（纯函数，SE1/SE2 可单测）
 * - 授权通过 → allowed:true + runtimePolicy（SE1）
 * - 授权拒绝 → allowed:false + reason（SE2: Hermes 前拦截）
 */
export function composeExecutionIntent(input: ExecutionComposeInput): SkillExecutionIntent {
  const denied = input.authorizationState !== 'AUTHORIZED'
  if (denied) {
    return {
      allowed: false,
      skillId: input.skillId,
      name: input.name,
      version: input.version,
      agentDefinitionId: input.agentDefinitionId,
      authorizationState: input.authorizationState,
      reason: input.authorizationReason,
    }
  }
  // 执行操作 = Skill capabilities（真实数据）；资源类型 = requiredTools（supportedResources）
  const allowedTools = Array.from(new Set(input.capabilities.filter(Boolean)))
  const allowedResources = Array.from(new Set(input.requiredTools.filter(Boolean)))
  return {
    allowed: true,
    skillId: input.skillId,
    name: input.name,
    version: input.version,
    agentDefinitionId: input.agentDefinitionId,
    authorizationState: input.authorizationState,
    reason: 'EXECUTION_INTENT_READY',
    runtimePolicy: {
      boundary: 'H-D',
      allowedTools,
      allowedResources,
      deniedTools: H_D_DENIED_TOOLS,
    },
    allowedTools,
    executionReady: true,
  }
}

/**
 * Task 02: 生成 Skill 执行意图（只读，不执行）
 * 输入: { skillId, agentDefinitionId?, organizationId?, userId? }
 * 链路: Skill Authorization（S3.2.2）→ 能力绑定 → runtimePolicy → 意图
 */
export async function prepareSkillExecution(params: {
  skillId: string
  agentDefinitionId?: string | null
  organizationId?: string | null
  userId?: string | null
}): Promise<SkillExecutionIntent | null> {
  const { authorizeSkill } = await import('./skill-authorization-adapter.js')
  const { getSkill } = await import('./skill-manifest-adapter.js')

  const auth = await authorizeSkill(params)
  if (!auth) return null // skill 不存在

  const skill = await getSkill(params.skillId)
  if (!skill) return null

  return composeExecutionIntent({
    skillId: params.skillId,
    name: skill.name,
    version: skill.version,
    agentDefinitionId: params.agentDefinitionId ?? null,
    capabilities: skill.capabilities,
    requiredTools: skill.requiredTools,
    authorizationState: auth.authorizationState,
    authorizationReason: auth.reason,
  })
}
