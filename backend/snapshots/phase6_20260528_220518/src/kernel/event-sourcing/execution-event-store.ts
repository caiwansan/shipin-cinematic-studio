/**
 * kernel/event-sourcing/execution-event-store.ts — 执行事件溯源
 *
 * Phase 6, Rule 1: 每条执行必须事件溯源
 * 追踪：adapter_execute, adapter_complete, provider_call, governance, audit
 */

import crypto from 'crypto'

export interface ExecutionEvent {
  id: string
  taskId: string
  type: 'adapter_execute' | 'adapter_complete' | 'adapter_failed'
    | 'governance_gate' | 'audit_log' | 'dequeued' | 'error'
  runtime: { userId: string; provider: string; model: string }
  input?: any
  output?: any
  error?: string
  timestamp: number
}

const eventStore: ExecutionEvent[] = []
const MAX_EVENTS = 5000

export function appendExecutionEvent(event: Omit<ExecutionEvent, 'id' | 'timestamp'>): void {
  const full: ExecutionEvent = {
    id: crypto.randomUUID().slice(0, 12),
    ...event,
    timestamp: Date.now(),
  }

  eventStore.push(full)

  // 限制内存大小
  if (eventStore.length > MAX_EVENTS) {
    eventStore.splice(0, eventStore.length - MAX_EVENTS)
  }
}

export function getExecutionEvents(taskId?: string): ExecutionEvent[] {
  if (taskId) {
    return eventStore.filter(e => e.taskId === taskId)
  }
  return eventStore.slice(-200).reverse()
}

export function clearEventStore(): void {
  eventStore.length = 0
}
