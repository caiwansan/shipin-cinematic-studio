// ============================================================
// ExecutionTraceRepository — 接口定义
// ============================================================
// 定义于 RFC2 / RC4，但在 RC1 中已需要用于 scheduler 集成

import type { ExecutionEvent, ExecutionGraph } from '../types'

export interface IExecutionTraceRepository {
  saveEvent(event: ExecutionEvent): Promise<void>
  getEvents(executionId: string): Promise<ExecutionEvent[]>
  getGraph(executionId: string): Promise<ExecutionGraph | null>
}
