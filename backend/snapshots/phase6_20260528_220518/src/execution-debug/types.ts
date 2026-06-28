/**
 * execution-debug/types.ts — Debug 类型定义
 *
 * Debug Layer 是纯事后的"解释层"，不参与任何执行路径。
 * 输入：trace + provider state
 * 输出：结构化原因链
 */

import type { ExecutionTrace } from '../execution-trace/index.js'
import type { ProviderState } from '../runtime/provider-state/index.js'

/** 根因类型 */
export type RootCauseType =
  | 'SAFETY_BLOCK'
  | 'INVALID_KEY'
  | 'BILLING_FAILED'
  | 'PROVIDER_ERROR'
  | 'LATENCY'
  | 'PROVIDER_DOWN'
  | 'CIRCUIT_OPEN'
  | 'DEGRADED'
  | 'UNKNOWN'

/** 单条根因 */
export interface RootCause {
  type: RootCauseType
  /** 机器可读原因 */
  reason: string
  /** 用户可读建议 */
  suggestion?: string
  /** 关联数据 */
  data?: Record<string, any>
}

/** Debug 报告 */
export interface DebugReport {
  traceId: string
  trace?: Pick<ExecutionTrace, 'status' | 'provider' | 'model' | 'taskType' | 'startTime' | 'endTime' | 'error'>
  summary: {
    status: string
    durationMs: number
    provider: string
    model: string
  }
  rootCauses: RootCause[]
  humanReadable: string
}

/** 分析摘要 */
export interface AnalysisSummary {
  total: number
  failures: number
  slow: number
  avgDurationMs: number
  providerStats: Record<string, { success: number; fail: number; avgDurationMs: number }>
}
