/**
 * types/director-decision-contract.ts
 *
 * DirectorDecisionContract — AI 导演决策契约
 *
 * 这是 Asset Quality Observer 与 Task Runtime 之间的决策桥梁。
 *
 * 设计原则：
 *   - Decision 不调用 Provider ❌
 *   - Decision 不修改 Asset ❌
 *   - 所有建议 requiresConfirmation=true ❌ 自动执行
 *   - 状态可追踪（pending → confirmed | rejected）
 *
 * 数据流：
 *   GET /api/director/assets/:assetId/quality
 *     ↓ AssetQualityReport
 *   POST /api/director/assets/:assetId/decision
 *     ↓ DirectorDecisionContract
 *   POST /api/director/decisions/:id/confirm
 *     ↓ status: confirmed | rejected
 *   Task 02.3 → Execution Runtime
 *     ↓ User Confirmed → ExecutionAdapter → Task Runtime → BullMQ → Asset
 *
 * 权限：
 *   - 仅用户可 confirm/reject
 *   - confirm 时验证 CurrentUser.id === ownerId
 *   - AI 不自动修改 decision 状态
 */

// ── 决策类型 ──

/**
 * 决策类型枚举
 *
 * keep            → 质量足够，不需要改动
 * regenerate      → 重新生成整个资产
 * modify_prompt   → 修改 prompt 后重新生成
 * replace_asset   → 替换为其他资产（如场景/角色图）
 */
export type DecisionType =
  | 'keep'
  | 'regenerate'
  | 'modify_prompt'
  | 'replace_asset'

/**
 * 决策确认状态
 *
 * pending   → 已生成，等待用户确认
 * confirmed → 用户确认，可以执行
 * rejected  → 用户拒绝，不执行
 */
export type DecisionStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'

// ── 建议动作 ──

export interface SuggestedAction {
  /** 建议动作的描述 */
  description: string

  /** 受影响的资产 ID 列表 */
  affectedAssets: string[]

  /** 预估成本（可选） */
  estimatedCost?: string
}

// ── 主契约 ──

export interface DirectorDecisionContract {
  /** 决策 ID (UUID) */
  id: string

  /** 决策拥有者 ID（用户 UUID） */
  ownerId: string

  /** 被评估的资产 ID (VideoTask.id) */
  assetId: string

  /** 关联的质量观察报告来源 */
  qualityReportId?: string

  /** 决策类型 */
  decisionType: DecisionType

  /** 决策理由（面向导演 / 用户） */
  reason: string

  /** 置信度 0-100 */
  confidence: number

  /** 建议的动作 */
  suggestedAction: SuggestedAction

  /** 硬编码锁：AI 不能自动执行 */
  requiresConfirmation: true

  /** 确认状态 */
  status: DecisionStatus

  /** 用户确认/拒绝时间 */
  confirmedAt?: string

  /** 用户备注 */
  userNote?: string

  /** 创建时间 */
  createdAt: Date
}

// ── 决策生成输入 ──

export interface DecisionGenerationInput {
  /** 质量报告 */
  qualityReport: {
    score: number
    issues: string[]
    assetType: string
  }

  /** 生产的上下文场景 */
  productionContext: {
    projectId: string
    taskType: string
    specType: string | null
    hasOutput: boolean
  }
}

// ── 决策生成输出 ──

export type DecisionGenerationResult = Omit<
  DirectorDecisionContract,
  'id' | 'createdAt' | 'status'
>

// ── 执行结果 ──

export interface ExecutionTrace {
  /** 关联的决策 ID */
  decisionId: string

  /** 决策类型 */
  decisionType: DecisionType

  /** 执行来源 */
  source: 'director_decision'

  /** 确认者 ID */
  confirmedBy: string

  /** 确认时间 */
  confirmedAt: string

  /** 生成的 Task ID（如果有） */
  generatedTaskId?: string

  /** 执行状态 */
  executionStatus: 'none' | 'queued' | 'completed' | 'failed'

  /** 执行错误信息 */
  executionError?: string
}
