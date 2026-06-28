/**
 * kernel/replay/execution-replay.ts — 执行回放引擎
 *
 * Phase 6, Rule 2: 每个 task 必须可回放
 * 从 event store 重建执行状态
 */

import { getExecutionEvents, type ExecutionEvent } from '../event-sourcing/execution-event-store.js'

export interface ExecutionState {
  taskId: string
  events: ExecutionEvent[]
  finalOutput: any
  finalError?: string
  duration: number
}

function applyEvent(state: any, event: ExecutionEvent): any {
  switch (event.type) {
    case 'adapter_execute':
      return { ...state, input: event.input, adapterStarted: event.timestamp }

    case 'adapter_complete':
      return { ...state, finalOutput: event.output, adapterCompleted: event.timestamp, error: undefined }

    case 'adapter_failed':
      return { ...state, error: event.error, finalOutput: undefined, adapterCompleted: event.timestamp }

    case 'governance_gate':
      return { ...state, governancePassed: true, warnings: event.output }

    case 'error':
      return { ...state, error: event.error, finalOutput: undefined }

    default:
      return state
  }
}

export async function replayExecution(taskId: string): Promise<ExecutionState> {
  const events = getExecutionEvents(taskId)

  if (events.length === 0) {
    return {
      taskId,
      events: [],
      finalOutput: undefined,
      duration: 0,
    }
  }

  let state: any = { taskId }

  for (const event of events) {
    state = applyEvent(state, event)
  }

  const firstTimestamp = events[0]?.timestamp || 0
  const lastTimestamp = events[events.length - 1]?.timestamp || 0

  return {
    taskId,
    events,
    finalOutput: state.finalOutput,
    finalError: state.error,
    duration: lastTimestamp - firstTimestamp,
  }
}
