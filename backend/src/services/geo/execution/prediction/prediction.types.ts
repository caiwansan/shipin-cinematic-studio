// ============================================================
// RC3-3 — Prediction Layer 类型定义
// ============================================================
// 注意：只预测，不优化。估算结果供 PlanningResult 展示。
// Runtime 不关心任何预测值。

import type { ExecutionAssignment } from '../resource/resource.types'

/**
 * EstimationResult — 预估结果
 * 包含总时长、总成本、置信度、关键路径、资源汇总、节点估算、假设说明
 */
export interface EstimationResult {
  /** 预估总时长 (ms) */
  estimatedDuration: number
  /** 预估总成本 (tokens/credits) */
  estimatedCost: number
  /** 置信度: low | medium | high */
  confidence: 'low' | 'medium' | 'high'
  /** 关键路径分析 */
  criticalPath: CriticalPathAnalysis
  /** 按资源类型汇总 */
  resourceSummary: ResourceSummary[]
  /** 每个节点的估算详情 */
  nodeEstimates: NodeEstimate[]
  /** 估算假设说明 */
  assumptions: string[]
}

/**
 * CriticalPathAnalysis — 关键路径分析
 */
export interface CriticalPathAnalysis {
  /** 关键路径上的节点 ID 列表（按顺序） */
  pathNodeIds: string[]
  /** 关键路径总时长 (ms) */
  criticalDuration: number
  /** 总时长 (ms) */
  totalDuration: number
  /** 可通过并行节省的时长 (ms) */
  parallelizableDuration: number
  /** 并行因子 (0~1, 0=全串行, 1=全并行) */
  parallelismFactor: number
  /** 瓶颈节点 ID */
  bottleneckNodeId: string | null
}

/**
 * ResourceSummary — 按资源类型汇总
 */
export interface ResourceSummary {
  /** 资源类型: 'llm_provider' | 'crawler' | ... */
  resourceType: string
  /** 使用的节点数 */
  count: number
  /** 预估使用量 */
  estimatedUsage: number
  /** 预估成本 */
  estimatedCost: number
  /** 各 Provider 的节点数 */
  providers: { name: string; count: number }[]
}

/**
 * NodeEstimate — 单个节点的估算
 */
export interface NodeEstimate {
  nodeId: string
  /** 预估节点时长 (ms) */
  estimatedDuration: number
  /** 预估节点成本 */
  estimatedCost: number
  assignedProvider: string
  capability: string
  resourceType: string
}

/**
 * PredictionContext — 估算上下文
 * 由 PredictionService 构建后传入 IEstimator
 */
export interface PredictionContext {
  graphId: string
  assignments: ExecutionAssignment[]
  /** provider → costPerToken */
  providerCostMap: Map<string, number>
  /** provider → averageLatency ms */
  providerLatencyMap: Map<string, number>
  nodeCount: number
  edgeCount: number
}
