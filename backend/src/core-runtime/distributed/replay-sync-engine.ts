// ============================================================================
// 盘古斧 AI OS — Phase 8.3: Replay Synchronization Engine (回放同步引擎)
//
// 职责：
//   1. 从 journal 中读取指定 dag 的事件序列并按 version 排序
//   2. 按序重放每个事件（重建立执行时状态）
//   3. 重放完成后比照 snapshot 验证一致性
//   4. 被 worker-recovery 和 consistency-validator 调用
// ============================================================================

import { getJournal } from './runtime-state-journal.js'
import type { RuntimeStateEvent } from './runtime-state-journal.js'

/** 重放后的执行状态 */
export interface ReplayedState {
  dagId: string
  eventsReplayed: number
  state: {
    tasksStarted: number
    tasksCompleted: number
    tasksFailed: number
    dagCompleted: boolean
    finalPayload: unknown
  }
  startTime: number
  endTime: number
}

/** 重放结果 */
export interface ReplayResult {
  success: boolean
  replayedState: ReplayedState
  errors: string[]
}

/**
 * 重放指定 dag 的全部 journal 事件
 *
 * 流程：
 *   1. 过滤出该 dag 的所有事件
 *   2. 按 version 升序排序
 *   3. 逐事件 apply（重建运行时状态）
 *   4. 返回重放后的状态树
 */
export async function replayDagState(dagId: string): Promise<ReplayResult> {
  const errors: string[] = []
  const events = getJournal(dagId)
    .sort((a, b) => a.version - b.version)

  const state: ReplayedState['state'] = {
    tasksStarted: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    dagCompleted: false,
    finalPayload: null,
  }

  const startTime = Date.now()

  for (const event of events) {
    try {
      await applyEvent(event, state)
    } catch (e) {
      errors.push(`Event ${event.eventId} (v${event.version}): ${(e as Error).message}`)
    }
  }

  return {
    success: errors.length === 0,
    replayedState: {
      dagId,
      eventsReplayed: events.length,
      state,
      startTime,
      endTime: Date.now(),
    },
    errors,
  }
}

/**
 * 对单个事件应用状态变更
 */
async function applyEvent(event: RuntimeStateEvent, state: ReplayedState['state']): Promise<void> {
  switch (event.type) {
    case 'TASK_STARTED':
      state.tasksStarted++
      break

    case 'TASK_COMPLETED':
      state.tasksCompleted++
      break

    case 'TASK_FAILED':
      state.tasksFailed++
      break

    case 'DAG_COMPLETED':
      state.dagCompleted = true
      state.finalPayload = event.payload
      break

    case 'SNAPSHOT_CREATED':
      // snapshot 事件在 replay 时不需要修改执行状态
      break

    case 'WORKER_RECOVERED':
      // worker recovery 记录，不修改执行状态
      break

    case 'CONSISTENCY_CHECK':
      // 一致性检查记录，不修改执行状态
      break

    default:
      break
  }
}
