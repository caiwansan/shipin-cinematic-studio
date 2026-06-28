/**
 * P4 — ExecutionEvent（执行事件）
 *
 * 事件驱动执行的核心数据类型。
 * 每个事件代表图中一个 Agent Node 的完整生命周期事件。
 *
 * ═══ 宪法 ═══
 * P4 中所有执行必须基于事件驱动。
 * 禁止同步直连式执行（必须经过 EventBus）。
 */

import { Capability } from '../../runtime/capabilities.js'

export type ExecutionEventType =
  | 'node_pending'      // 节点就绪，等待执行
  | 'node_started'      // 节点开始执行
  | 'node_completed'    // 节点执行完成
  | 'node_failed'       // 节点执行失败
  | 'node_skipped'      // 节点条件不符跳过
  | 'graph_started'     // 图开始执行
  | 'graph_completed'   // 图执行完成
  | 'graph_failed'      // 图执行失败
  | 'checkpoint_saved'  // 检查点已保存
  | 'checkpoint_loaded' // 检查点已加载

export interface ExecutionEvent {
  /** 事件类型 */
  type: ExecutionEventType
  /** 图 ID */
  graphId: string
  /** 节点 ID（可选） */
  nodeId?: string
  /** 关联的 Capability */
  capability?: Capability
  /** 执行上下文 payload */
  payload?: any
  /** 错误信息（仅失败事件） */
  error?: string
  /** 时间戳 */
  timestamp: number
  /** 事件唯一 ID */
  eventId: string
  /** 请求追踪 ID */
  requestId?: string
  /** 用户 ID */
  userId?: string
}

export function createExecutionEvent(
  type: ExecutionEventType,
  graphId: string,
  overrides?: Partial<ExecutionEvent>,
): ExecutionEvent {
  return {
    type,
    graphId,
    timestamp: Date.now(),
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...overrides,
  }
}
