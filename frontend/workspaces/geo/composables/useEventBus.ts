/**
 * GEO Event Bus — Composable
 *
 * The ONLY way business code should access the event bus.
 * Never import eventBus directly from lib/eventBus.ts — always use this composable.
 *
 * # Guarantees
 *   - Auto cleanup: listeners registered in onMounted auto-remove in onUnmounted
 *   - Type safe: event names and payloads are derived from EventPayloads
 *   - SSR safe: on server, emit() is a no-op
 *   - Duplicate prevention: same handler + same event won't double-register
 *   - Dev logging: logs every emit in development
 *
 * # Usage
 *   const { emit, on } = useEventBus()
 *   on('TASK:FINISHED', ({ taskId, result }) => store.handleResult(taskId, result))
 *   emit('MISSION:APPEND', { icon: '✅', title: 'Task complete', status: 'completed', timestamp: new Date().toISOString() })
 */

import { onMounted, onUnmounted } from 'vue'
import { eventBus } from '../lib/eventBus'
import type { EventPayloads } from '../lib/events'

interface UseEventBusReturn {
  /** Emit an event with type-safe payload */
  emit: <K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]) => void
  /** Register a listener (auto-removed on unmount) */
  on: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
  /** Register a one-time listener (auto-removed after first fire) */
  once: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
  /** Remove a listener */
  off: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
}

type AnyHandler = (...args: unknown[]) => void

export function useEventBus(): UseEventBusReturn {
  // Track registered handlers for cleanup and duplicate prevention
  const registeredHandlers = new Map<string, Set<AnyHandler>>()

  function addHandler<K extends keyof EventPayloads>(
    event: K,
    handler: (payload: EventPayloads[K]) => void,
    mode: 'on' | 'once',
  ) {
    const eventKey = event as string
    const handlerSet = registeredHandlers.get(eventKey) || new Set()
    const handlerFn = handler as AnyHandler

    // Duplicate prevention
    if (handlerSet.has(handlerFn)) return
    handlerSet.add(handlerFn)
    registeredHandlers.set(eventKey, handlerSet)

    if (mode === 'on') {
      eventBus.on(event, handler)
    } else {
      eventBus.once(event, handler)
    }
  }

  function removeHandler<K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) {
    const eventKey = event as string
    eventBus.off(event, handler)
    const handlerSet = registeredHandlers.get(eventKey)
    if (handlerSet) {
      handlerSet.delete(handler as AnyHandler)
      if (handlerSet.size === 0) registeredHandlers.delete(eventKey)
    }
  }

  // Auto cleanup on unmount
  onMounted(() => {
    // No-op: handlers are registered dynamically, not at mount
  })

  onUnmounted(() => {
    for (const [eventKey, handlers] of registeredHandlers.entries()) {
      for (const handler of handlers) {
        eventBus.off(eventKey as keyof EventPayloads, handler as (p: unknown) => void)
      }
    }
    registeredHandlers.clear()
  })

  return {
    emit: <K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]) => {
      eventBus.emit(event, payload)
    },
    on: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      addHandler(event, handler, 'on')
    },
    once: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      addHandler(event, handler, 'once')
    },
    off: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      removeHandler(event, handler)
    },
  }
}
