// ============================================================
// C0-004: VerificationRequest Domain
//
// Verification 只认这个对象
// Manual Verify / API Verify / Mission Verify 全部统一
// ============================================================

/**
 * 验证状态
 */
export type VerificationStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped'

/**
 * 验证来源
 */
export type VerificationSource = 'auto_mission' | 'manual_review' | 'api_trigger' | 'scheduled'

/**
 * VerificationRequest — 验证引擎的唯一输入
 *
 * 由 MissionCompleted 事件触发生成
 * 验证引擎只认此对象，不直接接触 DiscoveryResult 或 Mission
 */
export interface VerificationRequest {
  /** 验证请求 ID */
  id: string
  /** 关联项目 */
  projectId: string
  /** 关联实体 */
  entityId: string
  /** 来源执行 ID */
  executionId: string
  /** 关联 Mission ID */
  missionId: string
  /** 关联 ActionPlan ID */
  actionPlanId: string

  /** 验证来源 */
  source: VerificationSource

  /** 预期产出描述 — 做对了什么才算通过 */
  expectedOutcome: string

  /** 基准参考 — 验证前状态的快照 */
  baselineReference: {
    description: string
    timestamp: string
  }

  /** 需要验证的证据列表 */
  evidence: {
    claimId: string
    claim: string
    expectedSource: string
  }[]

  /** 当前状态 */
  status: VerificationStatus

  /** 验证结果分数（0-100） */
  score?: number

  /** 验证结论 */
  conclusion?: string

  /** 失败原因 */
  failureReasons?: string[]

  /** 创建时间 */
  createdAt: string

  /** 完成时间 */
  completedAt?: string
}
