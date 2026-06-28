/**
 * exposure-contract.ts — Phase A-5 暴露层契约
 *
 * 定义 Execude / Trace / Replay 三个端口的输入/输出格式。
 * 这是系统的"对外 API 契约"——任何调用方都应基于此契约构建。
 *
 * @phase decision-runtime
 */

import type { DecisionTrace } from '../telemetry/decision-trace.js'

// ══════════════════════════════════════════════
// 1. 执行契约（POST /decision/execute）
// ══════════════════════════════════════════════

export interface ExecuteContractRequest {
  requirement: string
  mode?: 'strict' | 'exploratory'
  context?: string
  source?: string
}

export interface ExecuteContractResponse {
  traceId: string
  report: string | null
  summary: string | null
  status: 'COMPLETED' | 'FAILED' | 'REJECTED'
  validation: {
    isValid: boolean
    healthScore: number
    errors: number
    warnings: number
  }
  durationMs: number
  error?: string
}

// ══════════════════════════════════════════════
// 2. Trace 查询契约（GET /decision/trace/:id）
// ══════════════════════════════════════════════

export interface TraceContractResponse {
  traceId: string
  rawInput: string
  status: string
  durationMs: number
  nodePath: Array<{
    nodeType: string
    success: boolean
    error: string | null
    outputSummary: string | null
  }>
  events: Array<{
    eventType: string
    source: string
    payload: Record<string, unknown>
    timestamp: number
  }>
  validation: {
    isValid: boolean
    healthScore: number
    summary: string
  }
}

// ══════════════════════════════════════════════
// 3. 回放契约（POST /decision/replay）
// ══════════════════════════════════════════════

export interface ReplayContractRequest {
  traceId: string
  mode?: 'strict' | 'exploratory'
}

export interface ReplayContractResponse extends ExecuteContractResponse {}

// ══════════════════════════════════════════════
// 4. 列表契约（GET /decision/traces）
// ══════════════════════════════════════════════

export interface TraceSummary {
  traceId: string
  rawInput: string
  status: string
  durationMs: number
  createdAt: number
}

export interface ListTracesContractResponse {
  total: number
  traces: TraceSummary[]
}

// ══════════════════════════════════════════════
// 5. 统计契约（GET /decision/stats）
// ══════════════════════════════════════════════

export interface StatsContractResponse {
  totalTraces: number
  totalErrors: number
  recentTraces: number
}
