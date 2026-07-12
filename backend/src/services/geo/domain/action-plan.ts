// ============================================================
// C0-003: ActionPlan Domain
//
// ActionPlan 是 Discovery → Recommendations → Mission 之间的桥梁。
// Mission 不负责"做什么"，只负责"什么时候做、怎么执行"。
// ActionPlan 包含 Recommendations 的输出——已经排好序的行动项。
// ============================================================

/**
 * 行动项优先级
 */
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'

/**
 * 行动项状态
 */
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

/**
 * 单个行动项 — Mission 的最小执行单元
 */
export interface ActionItem {
  /** 唯一标识 */
  id: string
  /** 行动标题 */
  title: string
  /** 行动描述 */
  description: string
  /** 优先级 */
  priority: ActionPriority
  /** 预计工作量（分钟） */
  estimatedEffortMinutes: number
  /** 预计影响力（评分提升分） */
  estimatedImpact: number
  /** 前置行动 ID 列表 */
  prerequisites: string[]
  /** 依赖的 DiscoverySignal ID */
  signalId?: string
  /** 关联的 Provider */
  provider?: string
  /** 附加证据/参考 */
  evidence?: string[]
  /** 分类标签 */
  category?: string
  /** 来源引擎 */
  source: 'recommendation' | 'discovery' | 'manual' | 'system'
}

/**
 * 行动计划 — 一组有序的行动项
 * 由 Recommendations 引擎在 Discovery 完成后生成
 */
export interface ActionPlan {
  /** 计划 ID */
  id: string
  /** 关联项目 */
  projectId: string
  /** 关联实体 */
  entityId: string
  /** 来源 Discovery 执行 ID */
  executionId: string
  /** 创建时间 */
  createdAt: string
  /** 总体目标描述 */
  objective: string
  /** 行动项列表（按优先级排序） */
  actions: ActionItem[]
  /** 是否已经提交到 Mission Queue */
  queued: boolean
}
