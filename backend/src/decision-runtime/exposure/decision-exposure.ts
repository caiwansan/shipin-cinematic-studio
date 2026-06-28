/**
 * decision-exposure.ts — Phase A-5 Decision Runtime Exposure Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * DecisionExposure — 决策运行时暴露层核心
 * ═══════════════════════════════════════════════════════════════
 *
 * 此层是 Decision Compiler Kernel 的"对外暴露接口"。
 * 它不包含任何业务逻辑，只做三件事：
 *   1. 编排请求的声明周期（创建 Runtime → 执行 → 返回结果）
 *   2. 提供执行/追踪/回放三个端口的统一数据格式
 *   3. 记录每个请求的来源和结果（审计）
 *
 * 宪法约束（不可违反）：
 *   1. 此层不修改任何内核逻辑
 *   2. 此层不修改评分/语义/模型
 *   3. 此层只做"编排 / 调度 / 查询"
 *   4. 此层禁止引入新的智能能力
 *   5. 所有返回数据的格式必须在 exposure-contract.ts 中定义
 *
 * @phase decision-runtime
 */

import { DecisionRuntime, RuntimeStatus } from '../runtime/decision-runtime.js'
import { decisionTelemetry } from '../telemetry/decision-telemetry.js'
import { executionValidator } from '../validation/execution-validator.js'
import { decisionObserver } from '../telemetry/decision-observer.js'
import type { DecisionTrace } from '../telemetry/decision-trace.js'
import type { DecisionSnapshot } from '../contracts/decision-snapshot.js'

// ============================================================
// 1. 请求/响应类型
// ============================================================

/**
 * 执行模式
 *   - strict: 严格模式（Validation 失败时不会输出结果）
 *   - exploratory: 探索模式（即使 Validation 失败也输出结果，但附带警告）
 */
export type ExecutionMode = 'strict' | 'exploratory'

export interface ExecuteRequest {
  /** 用户的需求描述（自然语言） */
  requirement: string
  /** 执行模式（默认 exploratory） */
  mode?: ExecutionMode
  /** 可选的额外上下文（JSON 字符串，供 A-4 世界摄入使用） */
  context?: string
  /** 请求来源标识（用于审计） */
  source?: string
}

export interface ExecuteResponse {
  /** 此次执行的 Trace ID */
  traceId: string
  /** 生成的决策报告（markdown 文本） */
  report: string | null
  /** 报告摘要 */
  summary: string | null
  /** 执行状态 */
  status: string
  /** 验证结果摘要 */
  validation: {
    isValid: boolean
    healthScore: number
    errors: number
    warnings: number
  }
  /** 执行耗时（ms） */
  durationMs: number
  /** 若 mode=strict 且验证失败，error 包含失败原因 */
  error?: string
}

export interface TraceQueryResponse {
  /** Trace ID */
  traceId: string
  /** 原始输入 */
  rawInput: string
  /** 执行状态 */
  status: string
  /** 执行耗时 */
  durationMs: number
  /** 节点执行路径 */
  nodePath: Array<{
    nodeType: string
    success: boolean
    error: string | null
    outputSummary: string | null
  }>
  /** 事件日志 */
  events: Array<{
    eventType: string
    source: string
    payload: Record<string, unknown>
    timestamp: number
  }>
  /** 验证结果 */
  validation: {
    isValid: boolean
    healthScore: number
    summary: string
  }
}

export interface ReplayRequest {
  /** 要回放的 Trace ID */
  traceId: string
  /** 执行模式 */
  mode?: ExecutionMode
}

// ============================================================
// 2. 暴露层核心
// ============================================================

export interface DecisionExposure {
  /**
   * 执行一次决策
   *
   * 流程：
   *   1. 创建 Runtime 实例
   *   2. 执行 run(requirement)
   *   3. 收集结果
   *   4. 若 strict 模式且验证失败，返回错误
   *   5. 返回 ExecuteResponse
   */
  execute(req: ExecuteRequest): Promise<ExecuteResponse>

  /**
   * 查询 Trace 详情
   *
   * 流程：
   *   1. 查找 traceId
   *   2. 展开节点路径和事件日志
   *   3. 返回 TraceQueryResponse
   */
  getTrace(traceId: string): TraceQueryResponse | null

  /**
   * 回放 Trace
   *
   * 流程：
   *   1. 创建 Runtime 实例
   *   2. 执行 replay(traceId)
   *   3. 返回 ExecuteResponse
   *
   * 确定性保证：相同 Trace → 相同输出
   */
  replay(req: ReplayRequest): Promise<ExecuteResponse>

  /**
   * 获取系统中所有 Trace 的摘要列表
   */
  listTraces(limit?: number): Array<{
    traceId: string
    rawInput: string
    status: string
    durationMs: number
    createdAt: number
  }>

  /**
   * 获取当前 Runtime 统计
   */
  getStats(): {
    totalTraces: number
    totalErrors: number
    recentTraces: number
  }
}

// ============================================================
// 3. 默认实现
// ============================================================

/**
 * Runtime 实例池：记录活跃的 Runtime 实例
 * 用于支持 execute/replay 操作
 */
const runtimePool = new Map<string, DecisionRuntime>()

export function createDecisionExposure(): DecisionExposure {
  async function execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    const startTime = Date.now()
    const runtime = new DecisionRuntime()
    const traceId = `dr_${startTime}_${randomSuffix()}`
    runtimePool.set(traceId, runtime)

    try {
      const trace = await runtime.run(req.requirement)
      const durationMs = trace.durationMs ?? (Date.now() - startTime)

      // 提取报告内容
      const reportEvent = trace.events.find(e => (e.eventType as string) === 'report_generated')
      const reportContent = reportEvent?.payload?.reportContent as string | undefined
      const reportSummary = reportEvent?.payload?.reportSummary as string | undefined

      // 验证结果
      const validationResult = executionValidator.validateTrace(trace)

      // strict 模式：验证不通过返回错误
      if (req.mode === 'strict' && !validationResult.isValid) {
        return {
          traceId,
          report: null,
          summary: null,
          status: 'REJECTED',
          validation: {
            isValid: false,
            healthScore: validationResult.healthScore,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length,
          },
          durationMs,
          error: `严格模式拒绝: ${validationResult.summary}`,
        }
      }

      return {
        traceId,
        report: reportContent ?? null,
        summary: reportSummary ?? null,
        status: 'COMPLETED',
        validation: {
          isValid: validationResult.isValid,
          healthScore: validationResult.healthScore,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length,
        },
        durationMs,
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime
      return {
        traceId,
        report: null,
        summary: null,
        status: 'FAILED',
        validation: {
          isValid: false,
          healthScore: 0,
          errors: 1,
          warnings: 0,
        },
        durationMs,
        error: err.message,
      }
    } finally {
      // 释放 Runtime 实例（保留 Trace 在 Telemetry 中）
      setTimeout(() => runtimePool.delete(traceId), 5000)
    }
  }

  function getTrace(traceId: string): TraceQueryResponse | null {
    const trace = decisionTelemetry.exportTrace(traceId)
    if (!trace) return null

    // 构建节点路径
    const nodePath = trace.nodes.map(n => ({
      nodeType: n.nodeType,
      success: n.success,
      error: n.error ?? null,
      outputSummary: n.outputSummary ?? null,
    }))

    // 构建事件日志
    const events = trace.events.map(e => ({
      eventType: e.eventType,
      source: e.agentName,
      payload: e.payload as Record<string, unknown>,
      timestamp: new Date(e.timestamp).getTime(),
    }))

    // 验证结果
    const validationResult = executionValidator.validateTrace(trace)

    return {
      traceId: trace.traceId,
      rawInput: trace.rawInput,
      status: trace.status,
      durationMs: trace.durationMs ?? 0,
      nodePath,
      events,
      validation: {
        isValid: validationResult.isValid,
        healthScore: validationResult.healthScore,
        summary: validationResult.summary,
      },
    }
  }

  async function replay(req: ReplayRequest): Promise<ExecuteResponse> {
    const startTime = Date.now()
    const runtime = new DecisionRuntime()
    const traceId = `dr_replay_${startTime}_${randomSuffix()}`
    runtimePool.set(traceId, runtime)

    try {
      const trace = await runtime.replay(req.traceId)
      const durationMs = trace.durationMs ?? (Date.now() - startTime)

      const reportEvent = trace.events.find(e => (e.eventType as string) === 'report_generated')
      const reportContent = reportEvent?.payload?.reportContent as string | undefined
      const reportSummary = reportEvent?.payload?.reportSummary as string | undefined

      const validationResult = executionValidator.validateTrace(trace)

      if (req.mode === 'strict' && !validationResult.isValid) {
        return {
          traceId,
          report: null,
          summary: null,
          status: 'REJECTED',
          validation: {
            isValid: false,
            healthScore: validationResult.healthScore,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length,
          },
          durationMs,
          error: `严格模式拒绝: ${validationResult.summary}`,
        }
      }

      return {
        traceId,
        report: reportContent ?? null,
        summary: reportSummary ?? null,
        status: 'COMPLETED',
        validation: {
          isValid: validationResult.isValid,
          healthScore: validationResult.healthScore,
          errors: validationResult.errors.length,
          warnings: validationResult.warnings.length,
        },
        durationMs,
      }
    } catch (err: any) {
      return {
        traceId,
        report: null,
        summary: null,
        status: 'FAILED',
        validation: { isValid: false, healthScore: 0, errors: 1, warnings: 0 },
        durationMs: Date.now() - startTime,
        error: err.message,
      }
    } finally {
      setTimeout(() => runtimePool.delete(traceId), 5000)
    }
  }

  function listTraces(limit?: number) {
    const max = limit ?? 20

    const allTraces = decisionTelemetry.listTraces(max)
      .map(t => ({
        traceId: t.traceId,
        rawInput: t.rawInput,
        status: t.status,
        durationMs: t.durationMs,
        createdAt: new Date(t.startedAt).getTime(),
      }))

    return allTraces
  }

  function getStats() {
    const allTraces = decisionTelemetry.listTraces(9999)
    const totalTraces = allTraces.length
    const totalErrors = allTraces.filter(t => t.status === 'failed').length
    const recentTraces = allTraces.filter(t => {
      const cutoff = Date.now() - 3600000 // 最近 1 小时
      const createdAt = new Date(t.startedAt).getTime()
      return createdAt > cutoff
    }).length

    return { totalTraces, totalErrors, recentTraces }
  }

  return { execute, getTrace, replay, listTraces, getStats }
}

// ============================================================
// 4. 工具函数
// ============================================================

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 8)
}
