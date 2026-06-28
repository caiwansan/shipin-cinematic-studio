/**
 * Constraint Physics — 类型定义
 *
 * v3.5 约束相互作用引擎
 * v3.6 接入层：ResolvedDirectorUnderstanding
 * - Conflict Graph：记录约束间的张力关系
 * - Resolution Function：weighted_tradeoff 解算
 * - Slack Allocation：将 creative_slack 分配到具体 Agent
 */

// ============================================================
// Conflict Graph
// ============================================================

/** 冲突边 — 两个约束节点之间存在张力 */
export interface ConflictEdge {
  a: string       // 约束节点 key，如 'characterIdentity'
  b: string       // 约束节点 key
  tension: number // 0.0-1.0 冲突强度。0=一致，1=完全冲突
  description: string
}

/** 冲突图 */
export interface ConflictGraph {
  nodes: string[]
  edges: ConflictEdge[]
  // 计算属性（由引擎生成）
  totalTension?: number
  maxTensionEdges?: ConflictEdge[]
}

// ============================================================
// Resolution
// ============================================================

/** 冲突方向（哪个约束胜出） */
export type ConflictResolution = 'a_wins' | 'b_wins' | 'weighted_tradeoff' | 'equal_compromise'

/** 单条冲突的解算结果 */
export interface ResolutionResult {
  conflictKey: string   // 'characterIdentity↔cameraFreedom'
  resolution: ConflictResolution
  aWeight: number       // 最终生效 weight
  bWeight: number
  deviation: number     // 与原始约束的偏差值（用于 review 汇报）
  reason: string        // 人类可读解释
}

/** 完整冲突解算输出 */
export interface ConflictResolutionOutput {
  resolutions: ResolutionResult[]
  fullGraph: ConflictGraph
  timestamp: number
}

// ============================================================
// Slack Allocation
// ============================================================

/** 松弛分配目标 */
export interface SlackAllocation {
  target: string         // 目标 key，如 'cinematicShot.cameraFreedom'
  allocatedSlack: number // 0.0-1.0 分配的松弛量
  reason: string
}

/** Slack 分配输出 */
export interface SlackAllocationOutput {
  creativeSlack: number        // 原始 slack
  allocations: SlackAllocation[]
  unallocated: number          // 未分配余量
  timestamp: number
}

// ============================================================
// 引擎主类型
// ============================================================

/** 约束相互作用引擎输入 */
export interface ConstraintPhysicsInput {
  constraintField: Record<string, { weight: number; mode: string; description?: string }>
  hardThreshold?: number       // weight >= 此值视为 hard，默认 0.9
  softHardThreshold?: number   // weight >= 此值视为 soft_hard，默认 0.7
}

/** 约束相互作用引擎输出 — 一步完成解算 + slack 分配 */
export interface ConstraintPhysicsOutput {
  conflictGraph: ConflictGraph
  resolutions: ResolutionResult[]
  slackAllocation: SlackAllocationOutput
  creativeSlack: number
  timestamp: number
}

// ============================================================
// v3.6 — 接入层类型
// ============================================================

/** 解析后的 constraintField（weight 已根据冲突解算调整） */
export type ResolvedConstraintField = Record<string, {
  original: number       // 原始 weight
  resolved: number       // 冲突解算后的 weight
  mode: string
  description?: string
  deviation: number      // resolved - original
}>

/** 主导力 — 当前场景中影响力最大的约束 */
export interface DominantForce {
  key: string
  resolvedWeight: number
  conflictsWon: number   // 在此约束上获胜的冲突数
}

/** 物理引擎接入层输出 */
export interface PhysicallyValidatedDirectorUnderstanding {
  /** 原始 Director Understanding（保持不变） */
  directorUnderstanding: any
  /** 替换了 raw constraintField 的约束数据 */
  resolvedConstraintField: ResolvedConstraintField
  /** 冲突决策日志 */
  conflictDecisions: ResolutionResult[]
  /** Slack 分配映射 */
  slackAllocationMap: SlackAllocationOutput
  /** 主导力列表（按 resolvedWeight 排序） */
  dominantForces: DominantForce[]
  /** human-readable 物理报告 */
  physicsReport: {
    totalTension: number
    edgeCount: number
    slack: number
    decisions: string[]
  }
}

// ============================================================
// v4 — Feedback Bias Layer
// ============================================================

/** 偏置层条目 — 记录单个约束的反馈累积 */
export interface BiasEntry {
  key: string
  totalRounds: number       // 累计轮次
  accumulatedBias: number   // 累积偏置值
  currentBias: number       // decay 后的当前偏置
  lastUpdated: number       // timestamp
}

/** 偏置层 — 跨运行状态 */
export interface FeedbackBiasLayer {
  projectId: string
  entries: BiasEntry[]
  lastRoundTimestamp: number
  totalFeedbackRounds: number
}

/** 反馈输入 */
export interface FeedbackInput {
  slackInfluenceScores: Array<{ shotId: string; score: number }>
  shotPerturbations: Array<{ shotId: string; cameraDrift: number; timingShift: number }>
  projectId: string
}

/** 偏置层输出 — 准备注入下一轮 resolve() */
export interface BiasAdjustedField {
  projectId: string
  adjustedWeights: Record<string, number>  // key → adjustedWeight
  biasApplied: boolean
  totalRounds: number
}
