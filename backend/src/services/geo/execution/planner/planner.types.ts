// ============================================================
// Execution Planner — 规划层类型定义 (RC3-1)
// ============================================================
// PlanningRequest 是统一规划请求，不绑定 Mission。
// Verification / Knowledge / Publishing 都通过 Adapter 转换。

import type { NodeType, ProviderPolicy, RetryConfig } from '../types'

/**
 * PlanningRequest — 统一规划请求
 * 任何来源（Mission / Verification / Publishing / manual）都通过 Adapter
 * 转换为 PlanningRequest，再由 ExecutionPlanner 统一处理。
 */
export interface PlanningRequest {
  id: string
  sourceType: string // 'mission' | 'verification' | 'publishing' | 'manual'
  sourceId: string
  brandId: string
  tenantId: string
  priority: 'low' | 'normal' | 'high'
  steps: PlanningStep[]
  providerPolicy: ProviderPolicy
  metadata: Record<string, unknown>
}

/**
 * PlanningStep — 规划中的单个步骤
 */
export interface PlanningStep {
  id: string
  label: string
  type: NodeType
  capability: string
  dependsOn: string[] // 依赖的其他 step id
  config: Record<string, unknown>
  retryConfig?: RetryConfig
  timeout?: number
}

/**
 * PlanningResult — 规划结果
 */
export interface PlanningResult {
  requestId: string
  sourceType: string
  sourceId: string
  graph: {
    nodes: PlanningNodeResult[]
    edges: PlanningEdgeResult[]
  }
  validation: ValidationResult
  createdAt: string
}

/**
 * PlanningNodeResult — 规划结果中的节点摘要
 */
export interface PlanningNodeResult {
  id: string
  label: string
  type: NodeType
  capability: string
  dependencies: string[]
  config: Record<string, unknown>
  retryConfig: RetryConfig | null
  timeout: number
}

/**
 * PlanningEdgeResult — 规划结果中的边
 */
export interface PlanningEdgeResult {
  from: string
  to: string
}

/**
 * ValidationResult — DAG 校验结果
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

/**
 * ValidationError — 校验错误
 */
export interface ValidationError {
  code:
    | 'CYCLE_DETECTED'
    | 'MISSING_DEPENDENCY'
    | 'UNKNOWN_NODE_TYPE'
    | 'EMPTY_GRAPH'
    | 'SELF_DEPENDENCY'
  message: string
  nodeId?: string
}

/**
 * ValidationWarning — 校验警告（可执行但建议关注）
 */
export interface ValidationWarning {
  code:
    | 'NODE_WITHOUT_DEPENDENCIES'
    | 'UNCONNECTED_SUBGRAPH'
    | 'SINGLE_NODE_GRAPH'
  message: string
  nodeId?: string
}
