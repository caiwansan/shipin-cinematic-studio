/**
 * observation/types.ts — 观测层类型定义
 *
 * 观测层职责：
 *   - 将执行结果投影为可视结构
 *   - 不参与执行决策
 *   - 不修改执行状态
 *
 * 所属层：Observation Layer
 */

/** 可视化节点 */
export interface VisualNode {
  id: string
  type: string
  label: string
  status: VisualNodeStatus
  /** 执行耗时（ms） */
  durationMs?: number
  /** 错误信息 */
  error?: string
}

/** 可视化边 */
export interface VisualEdge {
  from: string
  to: string
}

/** 可视化图 */
export interface VisualGraph {
  id: string
  nodes: VisualNode[]
  edges: VisualEdge[]
}

/** 节点状态 */
export type VisualNodeStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'blocked'

/** 执行时间线条目 */
export interface ObservationTimelineItem {
  nodeId: string
  type: string
  label: string
  status: VisualNodeStatus
  durationMs?: number
  startTime?: string
  endTime?: string
  error?: string
}
