/**
 * Graph Runtime v1 — Main Runtime (VM) [Never-Break Mode]
 *
 * 永不中断的管线执行器：
 * - 任何节点失败 → 占位数据 + degraded 标记
 * - 不终止后续阶段
 * - 依赖节点失败时，下游节点仍可执行（使用占位数据）
 * - 支持 retry (max 2)
 */

import type { ExecutionPlan, ExecutionStep } from '../compiler/graph.compiler.js'
import { ExecutionContext, createContext, type ExecutionEvent } from './context.js'
import { executeStep, getExecutor } from './node.executor.js'
import { resolveIncomingEdges } from './edge.resolver.js'

// ============================================================
// Fallback Factory (inline to avoid circular dependency)
// ============================================================

function createFallbackData(nodeType: string): any {
  switch (nodeType) {
    case 'character':
    case 'character_design':
      return { characters: [{ name: '主角', role: 'protagonist' }], _fallback: true }
    case 'scene':
    case 'scene_design':
      return { scenes: [{ id: 'scene_001', name: '默认场景', mood: 'neutral' }], _fallback: true }
    case 'storyboard':
      return { storyboards: [{ scene: '默认场景', shots: 1 }], _fallback: true }
    case 'llm':
      return { text: '' }
    case 'video_gen':
      return { video: [], _fallback: true }
    default:
      return { _fallback: true, _empty: true }
  }
}

// ============================================================
// Runtime Execution Result
// ============================================================

export interface RuntimeResult {
  ok: boolean
  allDegraded: boolean
  executionTimeMs: number
  events: ExecutionEvent[]
  stepResults: Map<string, any>
  totalSteps: number
  succeededSteps: number
  degradedSteps: number
  skippedSteps: number
}

// ============================================================
// Runtime (Never-Break Mode)
// ============================================================

export class GraphRuntime {
  private abortController: AbortController | null = null

  async execute(plan: ExecutionPlan): Promise<RuntimeResult> {
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    const ctx = createContext()
    const stepResults = new Map<string, any>()
    const startTime = Date.now()

    // Group steps by phase
    const phases = new Map<number, ExecutionStep[]>()
    for (const step of plan.steps) {
      const p = phases.get(step.phase) ?? []
      p.push(step)
      phases.set(step.phase, p)
    }

    const sortedPhases = [...phases.entries()].sort(([a], [b]) => a - b)

    let succeededSteps = 0
    let degradedSteps = 0
    let skippedSteps = 0

    for (const [phaseIdx, steps] of sortedPhases) {
      if (signal.aborted) break

      // Execute all steps in this phase in parallel
      const phasePromises = steps.map(async (step) => {
        try {
          const executor = getExecutor(step.nodeType)
          if (!executor) {
            // 没有注册执行器 → 占位数据
            const fallback = createFallbackData(step.nodeType)
            stepResults.set(step.nodeId, { ...fallback, _status: 'fallback', _degraded: true })
            ctx.storeOutput(step.nodeId, { ...fallback, _status: 'fallback', _degraded: true })
            return
          }

          // Retry logic: max 2 attempts
          let lastError: any = null
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const result = await executor.execute(step, ctx, signal)
              if (result && result._status !== 'failed' && result._status !== 'error') {
                stepResults.set(step.nodeId, { ...result, _degraded: false })
                ctx.storeOutput(step.nodeId, { ...result, _degraded: false })
                return
              }
              lastError = result?._error || 'execution returned failure'
            } catch (err: any) {
              lastError = err.message
              if (attempt === 0) {
                // Wait before retry
                await new Promise(r => setTimeout(r, 200))
              }
            }
          }

          // All retries failed → fallback
          const fallback = createFallbackData(step.nodeType)
          stepResults.set(step.nodeId, {
            ...fallback,
            _status: 'degraded',
            _degraded: true,
            _error: lastError,
          })
          ctx.storeOutput(step.nodeId, {
            ...fallback,
            _status: 'degraded',
            _degraded: true,
            _error: lastError,
          })
        } catch (err: any) {
          // 顶层异常不中断流程
          const fallback = createFallbackData(step.nodeType)
          stepResults.set(step.nodeId, { ...fallback, _status: 'error', _degraded: true, _error: err.message })
          ctx.storeOutput(step.nodeId, { ...fallback, _status: 'error', _degraded: true, _error: err.message })
        }
      })

      await Promise.allSettled(phasePromises)
    }

    // Count results
    for (const step of plan.steps) {
      const result = ctx.getOutput(step.nodeId)
      if (!result) {
        skippedSteps++
      } else if (result._degraded) {
        degradedSteps++
      } else if (result._status === 'failed' || result._status === 'error') {
        degradedSteps++ // count as degraded, not fail (never fails)
      } else {
        succeededSteps++
      }
    }

    const totalTime = Date.now() - startTime

    return {
      ok: succeededSteps > 0 || degradedSteps < plan.totalSteps,
      allDegraded: degradedSteps === plan.totalSteps,
      executionTimeMs: totalTime,
      events: ctx.getEvents(),
      stepResults,
      totalSteps: plan.totalSteps,
      succeededSteps,
      degradedSteps,
      skippedSteps,
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}

export function createRuntime(): GraphRuntime {
  return new GraphRuntime()
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "graph-runtime",
  "mode": "SHADOW"
};

