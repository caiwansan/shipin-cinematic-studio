/**
 * kernel/dag/execution-dag.ts — DAG 执行图构建
 *
 * Phase 6, Rule 3: DAG 必须匹配真实执行
 * 从 events 构建有向无环图
 */

import type { ExecutionEvent } from '../event-sourcing/execution-event-store.js'

export interface DagNode {
  id: string
  taskId: string
  type: ExecutionEvent['type']
  eventId: string
  parentId: string | null
  timestamp: number
  error?: string
}

export function buildExecutionDAG(events: ExecutionEvent[]): DagNode[] {
  // 按时间排序
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp)

  return sorted.map((event, index) => ({
    id: `${event.taskId}-${index}`,
    taskId: event.taskId,
    type: event.type,
    eventId: event.id,
    /** 上一步事件作为 parent */
    parentId: index > 0 ? `${event.taskId}-${index - 1}` : null,
    timestamp: event.timestamp,
    error: event.error,
  }))
}
