// ============================================================
// NodeStateMachine — RC1
// ============================================================
// 实现 10 种 NodeStatus 之间的状态转换。
// 所有状态变化必须通过 transition() 执行，确保产生 ExecutionEvent。

import type { ExecutionEventType, ExecutionNode, NodeStatus } from '../types'

// ─── 转换规则表 ───
// pending  → node_queued     → queued
// queued   → node_started    → running
// running  → node_completed  → completed
// running  → node_failed     → failed
// running  → node_retry      → retrying
// retrying → node_started    → running
// retrying → node_failed     → failed
// running  → node_timeout    → timeout
// running  → node_fallback   → fallback
// fallback → node_started    → running
// fallback → node_failed     → failed
// any      → node_cancelled  → cancelled

type TransitionMap = Record<string, Record<string, NodeStatus>>

const TRANSITIONS: TransitionMap = {
  pending: {
    node_queued: 'queued',
  },
  queued: {
    node_started: 'running',
    node_cancelled: 'cancelled',
  },
  running: {
    node_completed: 'completed',
    node_failed: 'failed',
    node_retry: 'retrying',
    node_timeout: 'timeout',
    node_fallback: 'fallback',
    node_cancelled: 'cancelled',
  },
  retrying: {
    node_started: 'running',
    node_failed: 'failed',
    node_cancelled: 'cancelled',
  },
  fallback: {
    node_started: 'running',
    node_failed: 'failed',
    node_cancelled: 'cancelled',
  },
  completed: {},
  failed: {},
  timeout: {},
  cancelled: {},
  waiting_dependency: {
    node_queued: 'queued',
    node_cancelled: 'cancelled',
  },
}

// 事件到目标状态的映射（反向查找用）
export const EVENT_TO_NEXT_STATUS: Record<string, NodeStatus> = {
  node_queued: 'queued',
  node_started: 'running',
  node_completed: 'completed',
  node_failed: 'failed',
  node_retry: 'retrying',
  node_timeout: 'timeout',
  node_fallback: 'fallback',
  node_cancelled: 'cancelled',
}

export class NodeStateMachine {
  /**
   * 根据当前 status + event 计算下一个 status。
   * 如果转换非法，抛出错误。
   */
  transition(node: ExecutionNode, event: ExecutionEventType): NodeStatus {
    const fromStatus = node.status
    const allowed = TRANSITIONS[fromStatus]

    if (!allowed) {
      throw new Error(
        `状态机非法: 状态 '${fromStatus}' 不在转换表中`,
      )
    }

    const nextStatus = allowed[event]
    if (!nextStatus) {
      throw new Error(
        `状态机非法: 从 '${fromStatus}' 通过事件 '${event}' 的转换未定义`,
      )
    }

    return nextStatus
  }

  /**
   * 返回是否允许从 from 转换到 to。
   */
  canTransition(from: NodeStatus, to: NodeStatus): boolean {
    const allowed = TRANSITIONS[from]
    if (!allowed) return false
    return Object.values(allowed).includes(to)
  }

  /**
   * 返回当前状态下允许的所有事件。
   */
  getAllowedTransitions(fromStatus: NodeStatus): ExecutionEventType[] {
    const allowed = TRANSITIONS[fromStatus]
    if (!allowed) return []
    return Object.keys(allowed) as ExecutionEventType[]
  }
}
