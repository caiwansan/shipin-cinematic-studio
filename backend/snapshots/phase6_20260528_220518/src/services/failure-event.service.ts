/**
 * services/failure-event.service.ts — P1-3: Execution Failure Semantics
 *
 * 将 "task failed" 从无语义状态升级为结构化 failure event。
 * Append-only, DB persisted, stage-aware。
 *
 * 设计原则：
 * 1. NEVER 修改 task.status（failure event 是附加信息，不是状态覆盖）
 * 2. 所有 failure event 必须带 stage + errorType + retryable
 * 3. 写入失败静默忽略（fire-and-forget 级别）
 * 4. failureEvents[] 是 append-only 数组
 */

import { prisma } from '../utils/index.js'

export interface FailureEvent {
  executionId: string
  taskId: string
  stage: 'enqueue' | 'worker' | 'provider' | 'persistence' | 'post_process'
  errorType: 'timeout' | 'cancelled' | 'provider_error' | 'invalid_response' | 'system_error'
  retryable: boolean
  message: string
  timestamp: number
  contextSnapshot?: Record<string, any>
}

/**
 * 记录 FailureEvent 到 task 的 failureEvents Json 字段（append-only）
 * 写入失败静默忽略（不干扰主流程）
 */
export async function recordFailureEvent(event: FailureEvent): Promise<void> {
  try {
    // 只查询 failureEvents 字段（避免读取大对象）
    const existing = await prisma.videoTask.findUnique({
      where: { id: event.taskId },
      select: { failureEvents: true },
    })
    if (!existing) return

    const events: FailureEvent[] = Array.isArray(existing.failureEvents) ? existing.failureEvents as FailureEvent[] : []
    events.push(event)

    await prisma.videoTask.update({
      where: { id: event.taskId },
      data: { failureEvents: events },
    })
  } catch {
    // 静默忽略：failure event 不能阻塞任务执行
  }
}

/**
 * 批量查询 failure events（用于前端/调试）
 */
export async function getFailureEvents(taskId: string): Promise<FailureEvent[]> {
  try {
    const task = await prisma.videoTask.findUnique({
      where: { id: taskId },
      select: { failureEvents: true },
    })
    return Array.isArray(task?.failureEvents) ? task?.failureEvents as FailureEvent[] : []
  } catch {
    return []
  }
}
