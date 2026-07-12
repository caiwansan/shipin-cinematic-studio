// ===================================================
// TimeoutTracker — RC2-2
// 超时检测，产生 ExecutionEvent
// ===================================================

import { createExecutionEvent } from '../event'
import type { ExecutionEvent } from '../types'

export interface TimeoutResult {
  timedOut: boolean
  events: ExecutionEvent[]
}

export class TimeoutTracker {
  /**
   * 检查是否超时
   * @param startedAt — 开始时间（ISO string）
   * @param timeoutMs — 超时限制（ms）
   * @param executionId — 执行 ID
   * @param graphId — 图 ID
   * @param nodeId — 节点 ID
   */
  check(
    startedAt: string,
    timeoutMs: number,
    executionId: string,
    graphId: string,
    nodeId: string,
  ): TimeoutResult {
    const elapsed = Date.now() - new Date(startedAt).getTime()
    if (elapsed >= timeoutMs) {
      const events: ExecutionEvent[] = [
        createExecutionEvent({
          executionId,
          graphId,
          type: 'node_timeout',
          nodeId,
          data: {
            startedAt,
            elapsed,
            timeoutMs,
          },
        }),
      ]
      return { timedOut: true, events }
    }
    return { timedOut: false, events: [] }
  }
}
