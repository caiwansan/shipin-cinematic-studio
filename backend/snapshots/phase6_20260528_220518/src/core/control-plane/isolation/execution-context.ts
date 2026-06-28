/**
 * P2 — ExecutionContext（隔离执行上下文）
 *
 * 每个任务独立沙箱：
 * - requestId（唯一追踪）
 * - userId（隔离上下文）
 * - timeout（强制超时防止卡死）
 * - abortController（可取消）
 *
 * ═══ 宪法 ═══
 * 每个任务必须拥有独立的 execution context，禁止共享状态。
 */

export interface ExecutionContext {
  requestId: string
  userId: string
  capability: string
  timeout: number
  abortController: AbortController
  createdAt: number
}

export function createExecutionContext(task: {
  userId: string
  capability: string
  timeout?: number
}): ExecutionContext {
  return {
    requestId: crypto.randomUUID(),
    userId: task.userId,
    capability: task.capability,
    timeout: task.timeout || 30_000,
    abortController: new AbortController(),
    createdAt: Date.now(),
  }
}
