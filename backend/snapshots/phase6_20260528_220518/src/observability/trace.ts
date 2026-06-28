/**
 * observability/trace.ts — 全链路追踪系统
 *
 * 每个 AI 请求生成一个 traceId，贯穿全链路
 * spans 记录每个阶段的耗时和状态
 *
 * 存储：内存（实时）+ 定期 flush 到 DB
 */

import crypto from 'crypto'

function generateId(): string {
  return crypto.randomUUID()
}

// ======== Types ========

export interface Span {
  name: string
  timestamp: number
  duration?: number    // ms（关闭 span 时填充）
  status: 'ok' | 'error'
  meta?: Record<string, any>
}

export interface Trace {
  traceId: string
  userId?: string
  projectId?: string
  taskId?: string
  taskType?: string
  provider?: string
  spans: Span[]
  createdAt: number
  completedAt?: number
  totalDuration?: number
  status: 'active' | 'completed' | 'error'
  error?: string
}

// ======== In-memory store ========

const activeTraces = new Map<string, Trace>()
const completedTraces: Trace[] = []
const MAX_COMPLETED = 2000  // 保留最近 2000 条

// ======== API ========

/**
 * 创建一个新的 Trace
 */
export function createTrace(params: {
  userId?: string
  projectId?: string
  taskId?: string
  taskType?: string
}): string {
  const traceId = generateId()
  const trace: Trace = {
    traceId,
    ...params,
    spans: [],
    createdAt: Date.now(),
    status: 'active',
  }
  activeTraces.set(traceId, trace)
  return traceId
}

/**
 * 添加一个 Span 到 Trace
 */
export function addSpan(
  traceId: string,
  name: string,
  status: 'ok' | 'error' = 'ok',
  meta?: Record<string, any>
): void {
  const trace = activeTraces.get(traceId)
  if (!trace) return

  const span: Span = {
    name,
    timestamp: Date.now(),
    status,
    meta,
  }
  trace.spans.push(span)
}

/**
 * 关闭一个 Span（填充 duration）
 */
export function closeSpan(
  traceId: string,
  name: string,
  status?: 'ok' | 'error',
  meta?: Record<string, any>
): void {
  const trace = activeTraces.get(traceId)
  if (!trace) return

  const span = trace.spans.find(s => s.name === name && !s.duration)
  if (!span) {
    // 如果没找到未关闭的，追加一个关闭的
    addSpan(traceId, name, status || 'ok', meta)
    closeSpan(traceId, name, status, meta)
    return
  }

  span.duration = Date.now() - span.timestamp
  if (status) span.status = status
  if (meta) span.meta = { ...span.meta, ...meta }
}

/**
 * 完成 Trace（计算总耗时）
 */
export function completeTrace(traceId: string, error?: string): Trace | undefined {
  const trace = activeTraces.get(traceId)
  if (!trace) return

  trace.completedAt = Date.now()
  trace.totalDuration = trace.completedAt - trace.createdAt
  trace.status = error ? 'error' : 'completed'
  if (error) trace.error = error

  // 关闭所有未关闭的 span
  for (const span of trace.spans) {
    if (!span.duration) {
      span.duration = Date.now() - span.timestamp
    }
  }

  activeTraces.delete(traceId)
  completedTraces.push(trace)

  // 限制内存大小
  if (completedTraces.length > MAX_COMPLETED) {
    completedTraces.splice(0, completedTraces.length - MAX_COMPLETED)
  }

  return trace
}

/**
 * 获取一个 Trace
 */
export function getTrace(traceId: string): Trace | undefined {
  return activeTraces.get(traceId) || completedTraces.find(t => t.traceId === traceId)
}

/**
 * 获取最近的 Traces（支持过滤）
 */
export function getRecentTraces(params: {
  limit?: number
  status?: 'active' | 'completed' | 'error'
  userId?: string
}): Trace[] {
  let results = [...completedTraces.reverse(), ...Array.from(activeTraces.values()).reverse()]

  if (params.status) {
    results = results.filter(t => t.status === params.status)
  }
  if (params.userId) {
    results = results.filter(t => t.userId === params.userId)
  }

  return results.slice(0, params.limit || 50)
}

/**
 * 获取活跃 Trace 数量
 */
export function getActiveTraceCount(): number {
  return activeTraces.size
}

/**
 * 工具函数：测量一段代码执行时间并记录为 span
 */
export async function traceSpan<T>(
  traceId: string,
  spanName: string,
  fn: () => Promise<T>,
  meta?: Record<string, any>
): Promise<T> {
  addSpan(traceId, spanName, 'ok', meta)
  try {
    const result = await fn()
    closeSpan(traceId, spanName, 'ok')
    return result
  } catch (err: any) {
    closeSpan(traceId, spanName, 'error', { error: err.message })
    throw err
  }
}
