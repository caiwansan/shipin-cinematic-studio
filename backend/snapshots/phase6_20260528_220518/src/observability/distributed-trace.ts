/**
 * observability/distributed-trace.ts — 分布式追踪贯穿层
 *
 * 将 trace 系统集成到：
 * - API 路由
 * - 队列
 * - Worker
 * - Provider
 * - DB
 * - SSE 事件
 */

import { createTrace, addSpan, completeTrace, getTrace, Trace } from './trace.js'
import { prisma } from '../utils/index.js'

export { createTrace, addSpan, completeTrace, getTrace }
export type { Trace }

/**
 * 创建一个带完整 Meta 的追踪
 */
export function createWorkflowTrace(params: {
  userId: string
  projectId: string
  taskId: string
  taskType: string
  provider?: string
}): string {
  return createTrace(params)
}

/**
 * 记录 Provider 调用 span
 */
export function traceProviderCall(
  traceId: string,
  providerName: string,
  success: boolean,
  durationMs: number,
  meta?: Record<string, any>,
): void {
  addSpan(traceId, `provider:${providerName}`, success ? 'ok' : 'error', {
    durationMs,
    ...meta,
  })
}

/**
 * 记录队列 span
 */
export function traceQueue(
  traceId: string,
  action: 'enqueue' | 'dequeue' | 'retry',
  meta?: Record<string, any>,
): void {
  addSpan(traceId, `queue:${action}`, 'ok', meta)
}

/**
 * 完成追踪并持久化到 DB
 */
export async function completeWorkflowTrace(
  traceId: string,
  status: 'completed' | 'error',
  error?: string,
): Promise<void> {
  completeTrace(traceId, error)

  // 异步持久化到 DB
  try {
    const trace = getTrace(traceId)
    if (trace) {
      await prisma.taskLog.create({
        data: {
          taskId: trace.taskId || '',
          eventId: traceId,
          level: status === 'error' ? 'error' : 'info',
          message: `Workflow ${status}: ${trace.totalDuration || 0}ms`,
          metadata: {
            traceId,
            totalDuration: trace.totalDuration,
            spanCount: trace.spans.length,
            spans: trace.spans.map(s => ({
              name: s.name,
              duration: s.duration,
              status: s.status,
            })),
          },
        },
      }).catch(() => {})
    }
  } catch { }
}
