/**
 * api/kernel/execution-trace.ts — 全局执行追踪 API
 *
 * Phase 6, Rule 3: 提供统一追踪视图
 * events + DAG + replay 一站式查询
 */

import { getExecutionEvents } from '../../kernel/event-sourcing/execution-event-store.js'
import { buildExecutionDAG } from '../../kernel/dag/execution-dag.js'
import { replayExecution } from '../../kernel/replay/execution-replay.js'

export async function getExecutionTrace(taskId: string) {
  const events = getExecutionEvents(taskId)
  const dag = buildExecutionDAG(events)
  const replay = await replayExecution(taskId)

  return {
    taskId,
    eventCount: events.length,
    events,
    dag,
    replay,
  }
}
