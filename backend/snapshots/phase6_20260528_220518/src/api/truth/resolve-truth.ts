/**
 * api/truth/resolve-truth.ts — Truth 解析 API
 *
 * Phase 7, Rule 4: 返回系统针对某个 task 的规范结果
 */

import { getExecutionEvents } from '../../kernel/event-sourcing/execution-event-store.js'
import { arbitrate } from '../../truth/arbitration-engine.js'
import { getTruth } from '../../truth/store/truth-store.js'
import type { ExecutionResult } from '../../truth/truth-model.js'

export async function resolveTruth(taskId: string) {
  // 先查已存储的 truth
  const stored = getTruth(taskId)
  if (stored) {
    return {
      source: 'stored',
      taskId: stored.taskId,
      winner: stored.winner,
      score: stored.score,
      allResults: stored.allResults,
      timestamp: stored.timestamp,
    }
  }

  // 没有 truth，从 events 重建
  const events = getExecutionEvents(taskId)
  const completedEvents = events.filter(e => e.type === 'adapter_complete')

  const results: ExecutionResult[] = completedEvents.map(e => ({
    output: e.output,
    provider: e.runtime.provider,
    model: e.runtime.model,
    latency: 0,
    cost: 0,
  }))

  if (results.length === 0) {
    return { source: 'none', taskId, message: '无完成事件，无法解析 truth' }
  }

  const arbResult = await arbitrate(results)

  return {
    source: 'reconstructed',
    taskId,
    winner: arbResult.winner,
    score: arbResult.score,
    allScored: arbResult.allScored,
  }
}
