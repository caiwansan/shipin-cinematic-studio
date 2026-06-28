/**
 * kernel/replay/deterministic-executor.ts — 确定性重执行契约
 *
 * Phase 6, Rule 5: 系统在回放下必须是确定性的
 * 先尝试回放，无结果时才执行新任务
 */

import { replayExecution } from './execution-replay.js'
import type { ExecutionState } from './execution-replay.js'

export interface DeterministicTask {
  id: string
  execute(): Promise<any>
}

/**
 * 确定性执行：优先回放，无数据时执行新任务
 */
export async function deterministicExecute(task: DeterministicTask): Promise<{
  state: ExecutionState
  source: 'replay' | 'fresh'
}> {
  // Phase 6, Rule 2: 尝试回放
  const replay = await replayExecution(task.id)

  if (replay.finalOutput !== undefined) {
    console.log(`[kernel/replay] ✅ 回放命中: taskId=${task.id}`)
    return { state: replay, source: 'replay' }
  }

  // 无回放数据或执行失败，执行新任务
  console.log(`[kernel/replay] 无回放数据或已失败，执行新任务: taskId=${task.id}`)
  const result = await task.execute()

  // 更新状态
  const freshState: ExecutionState = {
    taskId: task.id,
    events: replay.events,
    finalOutput: result,
    finalError: undefined,
    duration: 0,
  }

  return { state: freshState, source: 'fresh' }
}
