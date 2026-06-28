/**
 * execution-trace/trace.service.ts — Trace Recorder
 *
 * 职责：记录每一次执行的完整时间线。
 *
 * 存储策略：
 *   - 内存环缓冲（默认保留最近 1000 条）
 *   - 不落盘（v1）
 *   - input/output 自动摘要（非完整 payload）
 *
 * 使用方式：
 *   // 在 adapter 入口处
 *   const step = traceService.startTrace(userId, taskType, provider, model, input)
 *   traceService.addStep(traceId, { name: 'safety-check', timestamp: Date.now() })
 *   // ... 执行 ...
 *   traceService.finishTrace(traceId, result)
 *   // 或
 *   traceService.failTrace(traceId, error)
 */

import type { ExecutionTrace, ExecutionStep } from './types.js'
import { summarizeInput, summarizeOutput } from './types.js'

const DEFAULT_MAX_TRACES = 1000

export class ExecutionTraceService {
  private traces = new Map<string, ExecutionTrace>()
  private maxTraces: number

  constructor(maxTraces = DEFAULT_MAX_TRACES) {
    this.maxTraces = maxTraces
  }

  /**
   * 开始一条 trace。返回 traceId。
   */
  startTrace(params: {
    userId: string
    requestId?: string
    taskType: string
    provider: string
    model: string
    input: any
  }): string {
    this.evictIfNeeded()

    const id = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const trace: ExecutionTrace = {
      id,
      userId: params.userId,
      requestId: params.requestId,
      taskType: params.taskType,
      provider: params.provider,
      model: params.model,
      inputSummary: summarizeInput(params.input),
      status: 'running',
      startTime: Date.now(),
      steps: [
        {
          name: 'trace-start',
          timestamp: Date.now(),
          data: { taskType: params.taskType, provider: params.provider, model: params.model },
        },
      ],
    }

    this.traces.set(id, trace)
    return id
  }

  /**
   * 添加执行步骤
   */
  addStep(traceId: string, step: Omit<ExecutionStep, 'timestamp'> & { timestamp?: number }): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    const lastStep = trace.steps[trace.steps.length - 1]
    const now = step.timestamp || Date.now()

    trace.steps.push({
      name: step.name,
      timestamp: now,
      durationMs: lastStep ? now - lastStep.timestamp : undefined,
      data: step.data,
    })
  }

  /**
   * 标记成功
   */
  finishTrace(traceId: string, output: any): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    trace.status = 'success'
    trace.outputSummary = summarizeOutput(output)
    trace.endTime = Date.now()

    trace.steps.push({
      name: 'trace-finish',
      timestamp: Date.now(),
      data: { status: 'success' },
    })
  }

  /**
   * 标记失败
   */
  failTrace(traceId: string, error: any): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    trace.status = 'failed'
    trace.error = error?.message || String(error || '')
    trace.endTime = Date.now()

    trace.steps.push({
      name: 'trace-finish',
      timestamp: Date.now(),
      data: { status: 'failed', error: trace.error },
    })
  }

  /**
   * 标记被 block（safety gate 拦截）
   */
  blockTrace(traceId: string, reason: string): void {
    const trace = this.traces.get(traceId)
    if (!trace) return

    trace.status = 'blocked'
    trace.error = reason
    trace.endTime = Date.now()
  }

  // ── 查询 ──

  /** 获取一条 trace */
  get(traceId: string): ExecutionTrace | undefined {
    return this.traces.get(traceId)
  }

  /** 列出所有 trace（支持分页） */
  list(options?: { limit?: number; offset?: number; userId?: string }): ExecutionTrace[] {
    const all = Array.from(this.traces.values())

    // 按时间倒序
    all.sort((a, b) => b.startTime - a.startTime)

    // 按用户过滤
    const filtered = options?.userId
      ? all.filter(t => t.userId === options.userId)
      : all

    const offset = options?.offset || 0
    const limit = options?.limit || 50
    return filtered.slice(offset, offset + limit)
  }

  /** 获取最近一次失败的 trace */
  getLastFailure(userId?: string): ExecutionTrace | undefined {
    const all = Array.from(this.traces.values())
      .filter(t => t.status === 'failed')
      .filter(t => !userId || t.userId === userId)
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    return all[0]
  }

  /** 清除旧 trace */
  clear(): void {
    this.traces.clear()
  }

  // ── 内部 ──

  private evictIfNeeded(): void {
    if (this.traces.size < this.maxTraces) return

    // 删除最旧的 20%
    const sorted = Array.from(this.traces.entries())
      .sort(([, a], [, b]) => a.startTime - b.startTime)
    const toDelete = Math.ceil(this.maxTraces * 0.2)
    for (let i = 0; i < toDelete; i++) {
      this.traces.delete(sorted[i][0])
    }
  }
}

/**
 * 全局单例
 */
export const traceService = new ExecutionTraceService()
