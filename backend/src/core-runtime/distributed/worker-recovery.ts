// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Worker Recovery (Worker 故障恢复)
//
// 职责：
//   1. 通过 replay-sync-engine 恢复 worker 的执行状态
//   2. 恢复完成后创建 WORKER_RECOVERED journal 事件
//   3. 提供简单故障隔离：仅恢复指定 dag 的状态
// ============================================================================

import { replayDagState } from './replay-sync-engine.js'
import { appendRuntimeEvent, getMaxVersion } from './runtime-state-journal.js'

export interface RecoveryResult {
  dagId: string
  recovered: boolean
  eventsReplayed: number
  durationMs: number
  error?: string
}

/**
 * 恢复 worker 指定 dag 的执行状态
 *
 * 流程：
 *   1. 调用 replayDagState() 重放全部 events
 *   2. 记录 WORKER_RECOVERED 事件到 journal
 *   3. 返回恢复结果
 */
export async function recoverWorkerState(dagId: string): Promise<RecoveryResult> {
  const startTime = Date.now()

  try {
    const replayResult = await replayDagState(dagId)

    if (!replayResult.success) {
      return {
        dagId,
        recovered: false,
        eventsReplayed: replayResult.replayedState.eventsReplayed,
        durationMs: Date.now() - startTime,
        error: `Replay errors: ${replayResult.errors.join('; ')}`,
      }
    }

    // 记录恢复事件
    appendRuntimeEvent(
      'system',
      dagId,
      'WORKER_RECOVERED',
      {
        eventsReplayed: replayResult.replayedState.eventsReplayed,
        state: replayResult.replayedState.state,
        durationMs: Date.now() - startTime,
      },
    )

    return {
      dagId,
      recovered: true,
      eventsReplayed: replayResult.replayedState.eventsReplayed,
      durationMs: Date.now() - startTime,
    }
  } catch (e) {
    return {
      dagId,
      recovered: false,
      eventsReplayed: 0,
      durationMs: Date.now() - startTime,
      error: (e as Error).message,
    }
  }
}

/**
 * 批量恢复多个 dag 的状态
 */
export async function recoverMultipleDags(dagIds: string[]): Promise<RecoveryResult[]> {
  const results: RecoveryResult[] = []
  for (const dagId of dagIds) {
    results.push(await recoverWorkerState(dagId))
  }
  return results
}
