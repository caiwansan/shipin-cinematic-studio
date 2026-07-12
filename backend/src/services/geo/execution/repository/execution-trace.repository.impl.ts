// ============================================================
// ExecutionTraceRepository — 内存实现
// ============================================================
// RC1 使用 Map 存储，后续可替换为 Prisma 实现

import type { ExecutionEvent, ExecutionGraph } from '../types'
import type { IExecutionTraceRepository } from './execution-trace.repository'

export class InMemoryExecutionTraceRepository
  implements IExecutionTraceRepository
{
  private events: Map<string, ExecutionEvent[]> = new Map()
  private graphs: Map<string, ExecutionGraph> = new Map()

  async saveEvent(event: ExecutionEvent): Promise<void> {
    const key = event.executionId
    const existing = this.events.get(key) ?? []
    existing.push({ ...event })
    this.events.set(key, existing)
  }

  async getEvents(executionId: string): Promise<ExecutionEvent[]> {
    return this.events.get(executionId) ?? []
  }

  async getGraph(executionId: string): Promise<ExecutionGraph | null> {
    const graph = this.graphs.get(executionId)
    return graph ? { ...graph } : null
  }

  // 仅在测试/工具方法中使用
  saveGraph(graph: ExecutionGraph): void {
    this.graphs.set(graph.context.executionId, { ...graph })
  }
}
