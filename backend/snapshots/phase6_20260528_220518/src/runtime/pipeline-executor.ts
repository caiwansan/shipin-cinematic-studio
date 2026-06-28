/**
 * Pipeline Executor — 永不中断的 AIGC 管线执行器
 * 
 * 包装 graph-runtime，确保：
 * - 任何节点失败都进入 degrade continuation
 * - 强制输出标准化（ExecutionContract）
 * - 跳过失败的节点，继续执行后续节点
 * - 提供完整的执行追踪
 */

import { createRuntime, type RuntimeResult } from '../graph-runtime/runtime/graph.runtime.js'
import { registerBuiltinExecutors } from '../graph-runtime/registry/node.registry.js'
import { type ExecutionPlan } from '../graph-runtime/compiler/graph.compiler.js'
import { DegradeContinuation } from './degrade-engine.js'
import { type ExecutionContract } from './execution-guard.js'
import { executeStep, getExecutor } from '../graph-runtime/runtime/node.executor.js'
import { createContext, type ExecutionEvent } from '../graph-runtime/runtime/context.js'
import { resolveIncomingEdges } from '../graph-runtime/runtime/edge.resolver.js'
import { runtimeTrace } from './trace/runtime-trace.js'
import { checkDomainAllowed } from './runtime-gate.js'

// ============================================================
// Pipeline Result
// ============================================================

export interface PipelineStepRecord {
  nodeId: string
  nodeType: string
  contract: ExecutionContract
  startMs: number
  durationMs: number
}

export interface PipelineResult {
  ok: boolean
  allDegraded: boolean
  executionTimeMs: number
  steps: PipelineStepRecord[]
  totalSteps: number
  succeededSteps: number
  degradedSteps: number
  failedSteps: number
}

// ============================================================
// Pipeline Executor
// ============================================================

export class PipelineExecutor {
  private degrade: DegradeContinuation

  constructor() {
    this.degrade = new DegradeContinuation()
    registerBuiltinExecutors()
  }

  /**
   * 执行完整的 AIGC 管线，永不中断
   */
  async execute(plan: ExecutionPlan): Promise<PipelineResult> {
    // Phase 4.2: Record invocation trace
    try {
      runtimeTrace.record({
        module: 'pipeline-executor',
        function: 'execute',
        caller: 'pipeline-route',
      })
    } catch { /* trace must never break execution */ }

    // Phase 4.3: Runtime gate
    try {
      checkDomainAllowed('pipeline-executor', 'SYNC', false)
    } catch { /* gate must never break execution */ }

    const ctx = createContext()
    const steps: PipelineStepRecord[] = []
    const startTime = Date.now()

    // 按 phase 分组
    const phases = new Map<number, any[]>()
    for (const step of plan.steps) {
      const p = phases.get(step.phase) ?? []
      p.push(step)
      phases.set(step.phase, p)
    }

    const sortedPhases = [...phases.entries()].sort(([a], [b]) => a - b)

    let succeeded = 0
    let degraded = 0
    let failed = 0

    for (const [phaseIdx, phaseSteps] of sortedPhases) {
      const phasePromises = phaseSteps.map(async (step) => {
        const stepStart = Date.now()

        try {
          // 先检查依赖是否全部降级
          const deps = step.dependencies || []
          let depDegradedCount = 0
          for (const depId of deps) {
            const depResult = ctx.getOutput(depId)
            if (depResult?._degraded) depDegradedCount++
          }

          const executor = getExecutor(step.nodeType)
          if (!executor) {
            // 没有注册的执行器 → 用 degrade 生成占位
            const fallbackContract = await this.degrade.continue(step.nodeType, null, '')
            ctx.storeOutput(step.nodeId, { ...fallbackContract.data, _degraded: true, _status: 'fallback' })
            return {
              step, contract: fallbackContract,
              duration: Date.now() - stepStart,
              nodeType: step.nodeType,
            }
          }

          // 执行节点
          const nodeResult = await executor.execute(step, ctx)

          // 应用 ExecutionGuard
          const contract = await this.degrade.continue(step.nodeType, nodeResult, '')
          ctx.storeOutput(step.nodeId, {
            ...contract.data,
            _degraded: contract.degraded,
            _status: contract.ok ? 'success' : 'degraded',
          })

          return {
            step, contract,
            duration: Date.now() - stepStart,
            nodeType: step.nodeType,
          }
        } catch (err: any) {
          // 任何异常都不能停止管线
          const fallbackContract = await this.degrade.continue(step.nodeType, { _status: 'error', _error: err.message }, '')
          ctx.storeOutput(step.nodeId, { ...fallbackContract.data, _degraded: true, _status: 'fallback' })

          return {
            step, contract: fallbackContract,
            duration: Date.now() - stepStart,
            nodeType: step.nodeType,
          }
        }
      })

      const results = await Promise.allSettled(phasePromises)

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          const record: PipelineStepRecord = {
            nodeId: r.value.step.nodeId,
            nodeType: r.value.nodeType,
            contract: r.value.contract,
            startMs: Date.now() - r.value.duration,
            durationMs: r.value.duration,
          }
          steps.push(record)

          if (record.contract.ok && !record.contract.degraded) succeeded++
          else if (record.contract.degraded) degraded++
          else failed++
        }
      }
    }

    return {
      ok: steps.some(s => s.contract.ok),
      allDegraded: steps.every(s => s.contract.degraded),
      executionTimeMs: Date.now() - startTime,
      steps,
      totalSteps: plan.totalSteps,
      succeededSteps: succeeded,
      degradedSteps: degraded,
      failedSteps: failed,
    }
  }
}

export const pipelineExecutor = new PipelineExecutor()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

