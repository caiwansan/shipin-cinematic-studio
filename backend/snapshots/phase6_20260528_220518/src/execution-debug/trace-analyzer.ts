/**
 * execution-debug/trace-analyzer.ts — 行为分析引擎
 *
 * 分析多条 trace，找出模式和趋势。
 *
 * 纯计算函数 — 不碰任何外部状态。
 */

import type { ExecutionTrace } from '../execution-trace/index.js'
import type { AnalysisSummary } from './types.js'

const SLOW_THRESHOLD_MS = 5000

export function analyzeTracePatterns(traces: ExecutionTrace[]): AnalysisSummary {
  let failures = 0
  let slow = 0
  let totalDuration = 0
  const providerStats: Record<string, { success: number; fail: number; totalDuration: number }> = {}

  for (const t of traces) {
    if (t.status === 'failed') failures++

    const duration = (t.endTime && t.startTime) ? t.endTime - t.startTime : 0
    totalDuration += duration

    if (duration > SLOW_THRESHOLD_MS) slow++

    if (!providerStats[t.provider]) {
      providerStats[t.provider] = { success: 0, fail: 0, totalDuration: 0 }
    }
    providerStats[t.provider].totalDuration += duration
    if (t.status === 'success') {
      providerStats[t.provider].success++
    } else {
      providerStats[t.provider].fail++
    }
  }

  // 计算平均
  const providerAverages: AnalysisSummary['providerStats'] = {}
  for (const [name, s] of Object.entries(providerStats)) {
    const count = s.success + s.fail
    providerAverages[name] = {
      success: s.success,
      fail: s.fail,
      avgDurationMs: count > 0 ? Math.round(s.totalDuration / count) : 0,
    }
  }

  return {
    total: traces.length,
    failures,
    slow,
    avgDurationMs: traces.length > 0 ? Math.round(totalDuration / traces.length) : 0,
    providerStats: providerAverages,
  }
}
