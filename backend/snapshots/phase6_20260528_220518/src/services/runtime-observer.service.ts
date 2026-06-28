/**
 * services/runtime-observer.service.ts — Runtime Observation Layer v1
 *
 * Phase 3A: Shadow Observation Layer
 * 不侵入 runtime，只记录，不控制
 *
 * 设计原则：
 *   1. 所有 observer 方法都是 fire-and-forget（不 await，不 throw）
 *   2. 所有 trace 都通过日志系统记录（console.log，后期可切到 structured log）
 *   3. 所有 trace 都带 executionId
 *   4. 绝不参与任何执行路径
 */

import type { RuntimeContext } from './runtime-context.js'
import type { TaskPayload } from '../queue/queue-manager.js'

// ============ 全局单调时钟（P1-2A） ============
// 所有 observer event 使用同一个时钟源，保证时间顺序可比较
export const globalClock = {
  _offset: Date.now(),
  _counter: 0,
  now(): number {
    this._counter++
    // 高位：wall clock，低位：单调递增序列号，保证同一毫秒内的顺序
    return Date.now() * 1000 + (this._counter % 1000)
  },
  reset(): void {
    this._offset = Date.now()
    this._counter = 0
  },
}

// ============ Types ============

export interface ExecutionEvent {
  type: ExecutionEventType
  executionId: string
  sessionId: string
  userId: string
  timestamp: number
  metadata?: Record<string, any>
}

export type ExecutionEventType =
  | 'context.created'
  | 'context.provider_attached'
  | 'enqueue'
  | 'worker.started'
  | 'worker.context_restored'
  | 'worker.byok_injected'
  | 'provider.selected'
  | 'provider.called'
  | 'provider.success'
  | 'provider.failed'
  | 'provider.fallback'
  | 'checkpoint.saved'
  | 'checkpoint.restored'
  | 'session.ended'

export interface ContextDiff {
  executionId: string
  httpContext?: string // snapshot summary
  workerContext?: string
  diffFields: string[]
  symmetric: boolean
  timestamp: number
}

export interface ProviderDecisionTrace {
  executionId: string
  taskType: string
  chosenProvider: string
  reason: string
  userId: string
  inputSize: number
  timestamp: number
}

// ============ Observer ============

class RuntimeObserver {
  private events: ExecutionEvent[] = []
  private diffs: ContextDiff[] = []
  private decisions: ProviderDecisionTrace[] = []
  private maxMemoryEvents = 1000 // 内存限队列，防止泄露

  /**
   * 记录 execution 事件
   */
  recordEvent(type: ExecutionEventType, ctx: Partial<RuntimeContext>, metadata?: Record<string, any>): void {
    try {
      const event: ExecutionEvent = {
        type,
        executionId: ctx.executionId || 'unknown',
        sessionId: ctx.sessionId || 'unknown',
        userId: ctx.userId || 'anonymous',
        timestamp: globalClock.now(),
        metadata,
      }
      this.events.push(event)
      // trim
      if (this.events.length > this.maxMemoryEvents) {
        this.events = this.events.slice(-this.maxMemoryEvents)
      }
      this.emitToConsole(event)
    } catch {
      // observer 永不抛异常
    }
  }

  /**
   * 记录 context 差异（HTTP vs Worker 对称性检查）
   */
  recordContextDiff(diff: ContextDiff): void {
    try {
      this.diffs.push(diff)
      if (this.diffs.length > this.maxMemoryEvents) {
        this.diffs = this.diffs.slice(-this.maxMemoryEvents)
      }
      if (!diff.symmetric) {
        console.warn(`[Observer] ⚠️ Context asymmetry detected: ${diff.executionId}`)
      }
    } catch {
      // observer 永不抛异常
    }
  }

  /**
   * 记录 provider 选择决策
   */
  recordProviderDecision(
    executionId: string,
    taskType: string,
    chosenProvider: string,
    reason: string,
    payload: Partial<TaskPayload>
  ): void {
    try {
      const trace: ProviderDecisionTrace = {
        executionId,
        taskType,
        chosenProvider,
        reason,
        userId: payload.userId || 'unknown',
        inputSize: JSON.stringify(payload.input || {}).length,
        timestamp: globalClock.now(),
      }
      this.decisions.push(trace)
      if (this.decisions.length > this.maxMemoryEvents) {
        this.decisions = this.decisions.slice(-this.maxMemoryEvents)
      }
      console.log(`[Observer] Provider decision: ${chosenProvider} for ${taskType} (${reason})`)
    } catch {
      // observer 永不抛异常
    }
  }

  // ============ 查询 API（只读，不用于 runtime 控制） ============

  /**
   * 获取某 execution 的事件链
   */
  getExecutionTrace(executionId: string): ExecutionEvent[] {
    return this.events.filter(e => e.executionId === executionId)
  }

  /**
   * 获取所有不对称 context diff
   */
  getAsymmetricDiffs(): ContextDiff[] {
    return this.diffs.filter(d => !d.symmetric)
  }

  /**
   * 获取 provider 选择统计
   */
  getProviderStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const d of this.decisions) {
      stats[d.chosenProvider] = (stats[d.chosenProvider] || 0) + 1
    }
    return stats
  }

  /**
   * 获取系统健康摘要报告
   */
  getHealthSummary(): string {
    const totalEvents = this.events.length
    const asymmetricDiffs = this.getAsymmetricDiffs().length
    const providerStats = this.getProviderStats()
    const errors = this.events.filter(e => e.type === 'provider.failed')
    return [
      `[Observer Summary]`,
      `  Events logged: ${totalEvents}`,
      `  Provider decisions: ${this.decisions.length}`,
      `  Context asymmetric: ${asymmetricDiffs}`,
      `  Provider failures: ${errors.length}`,
      `  Provider distribution: ${JSON.stringify(providerStats)}`,
    ].join('\n')
  }

  // ============ 内部 ============

  private emitToConsole(event: ExecutionEvent): void {
    const meta = event.metadata ? ` ${JSON.stringify(event.metadata)}` : ''
    console.log(`[Observer] ${event.type} ${event.executionId.substring(0, 8)} userId=${event.userId.substring(0, 8)}${meta}`)
  }
}

// ============ Singleton ============

export const runtimeObserver = new RuntimeObserver()
