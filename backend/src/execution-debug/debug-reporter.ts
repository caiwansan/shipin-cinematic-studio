/**
 * execution-debug/debug-reporter.ts — Debug 报告生成器
 *
 * 整合根因分析 + trace + state，输出完整报告。
 */

import type { ExecutionTrace } from '../execution-trace/index.js'
import type { ProviderState } from '../runtime/provider-state/index.js'
import type { DebugReport } from './types.js'
import { analyzeFailure, generateHumanReadable } from './root-cause.engine.js'

export function generateDebugReport(trace: ExecutionTrace, state?: ProviderState): DebugReport {
  const rootCauses = analyzeFailure(trace, state)

  return {
    traceId: trace.id,
    trace: {
      status: trace.status,
      provider: trace.provider,
      model: trace.model,
      taskType: trace.taskType,
      startTime: trace.startTime,
      endTime: trace.endTime,
      error: trace.error,
    },
    summary: {
      status: trace.status,
      durationMs: trace.endTime && trace.startTime ? trace.endTime - trace.startTime : 0,
      provider: trace.provider,
      model: trace.model,
    },
    rootCauses,
    humanReadable: generateHumanReadable(rootCauses),
  }
}
