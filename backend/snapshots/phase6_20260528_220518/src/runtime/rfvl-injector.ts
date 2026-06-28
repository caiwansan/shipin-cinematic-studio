/**
 * runtime/rfvl-injector.ts — RFVL Runtime Formal Verification Layer
 *
 * 注入点：在不修改任何执行逻辑的前提下，在关键路径上插入
 * ExecutionProof 的 seal 调用。
 *
 * 注入路径:
 *   1. SEEL Gate  (ai-tasks.ts)       → sealGate()
 *   2. Queue      (queue-manager.ts)   → sealQueue()
 *   3. Worker     (worker-runtime.ts)  → attach + sealModelSelection()
 *   4. Adapter    (registry.ts)        → sealAdapter()
 *   5. Provider   (provider layer)     → sealProvider()
 *
 * 用法:
 *   const trace = RFVL.startTrace(requestId)
 *   trace.sealGate(...)  // 在入口
 *   trace.sealQueue(...) // 入队后
 *   trace.sealModelSelection(...) // MSAL 决策后
 *   // ...
 *   trace.sealProvider(...) // provider 返回后
 *   const proof = trace.export()
 *   // proof.verified → true/false
 *   // 可写入 observe 层或日志
 */

import { ExecutionProof, type ExecutionProofChain } from './execution-proof.js'

// ─── RFVL 单例 ─────────────────────────────────────────────────

class RFVLEngine {
  private traces = new Map<string, ExecutionProof>()
  private proofs: ExecutionProofChain[] = []

  /** 启动一个新 trace */
  startTrace(requestId?: string): ExecutionProof {
    const proof = new ExecutionProof(requestId)
    this.traces.set(proof.getTraceId(), proof)
    return proof
  }

  /** 获取已有 trace */
  getTrace(traceId: string): ExecutionProof | undefined {
    return this.traces.get(traceId)
  }

  /** 完成一个 trace：验证 + 归档 */
  completeTrace(traceId: string): ExecutionProofChain | null {
    const proof = this.traces.get(traceId)
    if (!proof) return null
    const chain = proof.export()
    this.proofs.push(chain)
    this.traces.delete(traceId)
    return chain
  }

  /** 获取所有已完成的证明链 */
  getCompletedProofs(limit = 100): ExecutionProofChain[] {
    return this.proofs.slice(-limit)
  }

  /** 检查最近 N 个 trace 的违规率 */
  getViolationRate(limit = 100): { total: number; violations: number; rate: number } {
    const recent = this.proofs.slice(-limit)
    const total = recent.length
    const violations = recent.filter(p => !p.verified).length
    return { total, violations, rate: total > 0 ? violations / total : 0 }
  }

  /** 清除所有 traces */
  reset(): void {
    this.traces.clear()
    this.proofs = []
  }
}

export const rfvl = new RFVLEngine()

// ─── Trace ID Generation (for SEEL Gate injection) ──────────────────

/**
 * 生成全局唯一的 trace ID
 * 在 SEEL Gate (/api/tasks/ai-generate) 的请求入口调用
 *
 * Usage:
 *   const traceId = RFVL.generateTraceId()
 *   // 附加到 payload 传递给 worker
 *   payload.traceId = traceId
 */
export function generateTraceId(): string {
  const { randomUUID } = require('crypto')
  return `rfvl-${randomUUID().substring(0, 8)}-${Date.now().toString(36)}`
}

// ─── Convenience: 一步完成完整 trace（简化使用时） ─────────────────

/**
 * 创建一个标准 5 步证明链：
 *   SEEL_GATE → QUEUE → MSAL → ADAPTER → PROVIDER
 */
export function createStandardProof(
  requestId: string,
  context: {
    entry: string
    route: string
    method: string
    taskId: string
    model: string
    provider: string
    adapterName: string
    adapterRule: string
    providerStatus: number
    providerDurationMs: number
  }
): ExecutionProofChain {
  const proof = new ExecutionProof(requestId)
  
  proof.sealGate({
    entry: context.entry,
    route: context.route,
    method: context.method,
  })
  
  proof.sealQueue({
    taskId: context.taskId,
    queueName: 'ai-runtime',
    timestamp: Date.now(),
  })
  
  proof.sealModelSelection({
    model: context.model,
    provider: context.provider,
    decisionSource: 'MSAL',
    hasUserConfig: true,
  })
  
  proof.sealAdapter({
    adapterName: context.adapterName,
    matchRule: context.adapterRule,
    modelName: context.model,
  })
  
  proof.sealProvider({
    status: context.providerStatus,
    durationMs: context.providerDurationMs,
  })
  
  return proof.export()
}
