// ============================================================
// ExecutionEvent 工厂函数
// ============================================================

import { v4 as uuidv4 } from 'uuid'
import type { ExecutionEvent, ExecutionEventType } from './types'

export function createExecutionEvent(params: {
  executionId: string
  graphId: string
  type: ExecutionEventType
  nodeId?: string
  data?: Record<string, unknown>
}): ExecutionEvent {
  return {
    id: uuidv4(),
    executionId: params.executionId,
    graphId: params.graphId,
    type: params.type,
    nodeId: params.nodeId,
    timestamp: new Date().toISOString(),
    data: params.data,
  }
}
