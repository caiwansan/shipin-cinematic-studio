/**
 * Degrade Continuation Engine
 * 
 * LLM timeout → generate placeholder content
 * JSON parse error → schema repair
 * missing agent → synthetic agent output
 * graph node fail → skip with stub output
 * 
 * NEVER break the pipeline. Always produce something.
 */

import { ExecutionGuard, safeJsonParse, type ExecutionContract, createFallbackNode } from './execution-guard.js'
import { narrativeGateway } from './narrative-gateway.js'

// ============================================================
// Degrade Decision
// ============================================================

export interface DegradeDecision {
  shouldDegrade: boolean
  reason?: string
  mode: 'skip' | 'fallback' | 'async_retry' | 'placeholder' | 'continue'
  fallback?: any
}

/**
 * 判断是否触发降级
 */
export function shouldDegrade(nodeResult: any): DegradeDecision {
  if (!nodeResult) {
    return { shouldDegrade: true, reason: '节点无输出', mode: 'fallback' }
  }

  if (nodeResult._status === 'failed' || nodeResult._status === 'error') {
    return { shouldDegrade: true, reason: nodeResult._error || '节点执行失败', mode: 'fallback' }
  }

  if (nodeResult.ok === false) {
    return { shouldDegrade: true, reason: nodeResult.error || '节点返回不成功', mode: 'fallback' }
  }

  if (nodeResult.degraded === true) {
    return { shouldDegrade: true, reason: '上一节点已降级', mode: 'continue' }
  }

  return { shouldDegrade: false, mode: 'skip' }
}

/**
 * DegradeContinuation — 处理降级后的继续逻辑
 * 
 * 1. LLM timeout → 用 createFallbackNode 生成占位数据
 * 2. JSON 解析失败 → 修复或 fallback 结构化数据
 * 3. 缺失 Agent → 合成 agent 输出
 * 4. Graph 节点失败 → skip with stub
 */
export class DegradeContinuation {
  /**
   * 执行降级继续
   */
  async continue(
    nodeType: string,
    nodeResult: any,
    traceId?: string,
  ): Promise<ExecutionContract> {
    const decision = shouldDegrade(nodeResult)

    // 不需要降级的正常节点
    if (!decision.shouldDegrade) {
      return ExecutionGuard(nodeResult, nodeType, traceId)
    }

    console.log(`[Degrade] 节点 ${nodeType} 已降级: ${decision.reason} (mode: ${decision.mode})`)

    // 异步重试模式 — 入队列异步执行
    if (decision.mode === 'async_retry') {
      try {
        const { enqueueTask } = await import('../queue/queue-manager.js')
        const jobId = await enqueueTask({
          taskType: 'llm',
          projectId: 'degrade-continuation',
          userId: 'system',
          input: { nodeType, originalError: decision.reason },
        })
        return {
          ok: false,
          degraded: true,
          data: createFallbackNode(nodeType),
          node: nodeType,
          traceId,
          fallbackUsed: true,
          next: 'continue_graph',
          jobId,
          error: `异步重试已入队列: ${jobId}`,
        }
      } catch {
        // 入队列也失败，直接 fallback
      }
    }

    // fallback / placeholder 模式
    return {
      ok: false,
      degraded: true,
      data: createFallbackNode(nodeType),
      node: nodeType,
      traceId,
      fallbackUsed: true,
      next: 'continue_graph',
      error: decision.reason,
    }
  }

  /**
   * 处理 LLM 响应：解析 JSON + degrade safe
   */
  handleLLMResponse(
    content: string,
    nodeType: string,
    traceId?: string,
  ): { contract: ExecutionContract; parsedData: any } {
    const fallbackData = createFallbackNode(nodeType)
    const { parsed, degraded, error } = safeJsonParse(content, fallbackData)

    const contract: ExecutionContract = {
      ok: !degraded,
      degraded,
      data: parsed,
      node: nodeType,
      traceId,
      fallbackUsed: degraded,
      next: 'continue_graph',
      error,
    }

    return { contract, parsedData: parsed }
  }

  /**
   * 异步降级处理器 — 当 LLM 超时且 degrade 到 BullMQ
   */
  async handleAsyncDegrade(
    gatewayResult: any,
    nodeType: string,
    traceId?: string,
  ): Promise<ExecutionContract> {
    if (gatewayResult?.degraded && gatewayResult?.jobId) {
      return {
        ok: false,
        degraded: true,
        data: createFallbackNode(nodeType),
        node: nodeType,
        traceId: traceId || gatewayResult.traceId,
        fallbackUsed: true,
        next: 'aigc_pipeline_continue',
        jobId: gatewayResult.jobId,
        error: `任务已异步降级: ${gatewayResult.jobId}`,
      }
    }

    // gatewayResult 正常
    return ExecutionGuard(gatewayResult, nodeType, traceId)
  }
}

export const degradeContinuation = new DegradeContinuation()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

