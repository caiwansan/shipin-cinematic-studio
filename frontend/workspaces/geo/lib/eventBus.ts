/**
 * GEO Event Bus — Core instance
 *
 * Wraps mitt with typed events, middleware pipeline, and dev inspector.
 *
 * # Architecture
 *
 *   emit('TASK:UPDATED', payload)
 *        │
 *        ▼
 *   middleware[].beforeEmit(event, payload)    ← observe only, read-only
 *        │
 *        ▼
 *   mitt.emit(event, payload)                  ← actual dispatch
 *        │
 *        ▼
 *   middleware[].afterEmit(event, payload)     ← observe only
 *
 * # Rules
 *   - Middleware MUST NOT mutate payload
 *   - Middleware MUST NOT swallow events
 *   - Business code MUST use useEventBus() composable, not this file directly
 *
 * # Dev Inspector
 *   window.__GEO_EVENTBUS__ available in dev mode only
 */

import mitt from 'mitt'
import type { EventPayloads } from './events'
import type { EventMiddleware } from './middleware'

/** Dev inspector API exposed on window in development */
export interface GeoEventBusInspector {
  history(): Array<{ event: string; payload: unknown; timestamp: number }>
  listeners(event?: string): number
  last(): { event: string; payload: unknown; timestamp: number } | null
  clear(): void
  stats(): { total: number; byEvent: Record<string, number> }
}

interface CreateEventBusOptions {
  middlewares?: EventMiddleware[]
  dev?: boolean
}

interface GeoEventBus {
  emit: <K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]) => void
  on: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
  off: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
  once: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => void
  /** Expose mitt instance for replay/debug (not for direct emit) */
  _mitt: ReturnType<typeof mitt<EventPayloads>>
}

export function createEventBus(options: CreateEventBusOptions = {}): GeoEventBus {
  const mittInstance = mitt<EventPayloads>()
  const middlewares = options.middlewares || []
  const isDev = options.dev || false

  // Dev inspector state
  let eventHistory: Array<{ event: string; payload: unknown; timestamp: number }> = []
  const MAX_HISTORY = 500
  let emitCount = 0
  const emitCountByEvent: Record<string, number> = {}

  function emit<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
    // Run beforeEmit middleware (read-only)
    for (const mw of middlewares) {
      mw.beforeEmit?.(event as string, payload)
    }

    // Actual dispatch via mitt
    mittInstance.emit(event as string, payload)

    // Run afterEmit middleware (read-only)
    for (const mw of middlewares) {
      mw.afterEmit?.(event as string, payload)
    }

    // Dev inspector logging
    if (isDev) {
      const entry = { event: event as string, payload, timestamp: Date.now() }
      eventHistory.push(entry)
      if (eventHistory.length > MAX_HISTORY) {
        eventHistory.shift()
      }
      emitCount++
      emitCountByEvent[event as string] = (emitCountByEvent[event as string] || 0) + 1
    }
  }

  const bus: GeoEventBus = {
    emit,
    on: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      mittInstance.on(event as string, handler as (p: unknown) => void)
    },
    off: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      mittInstance.off(event as string, handler as (p: unknown) => void)
    },
    once: <K extends keyof EventPayloads>(event: K, handler: (payload: EventPayloads[K]) => void) => {
      const wrapped = (p: unknown) => {
        handler(p as EventPayloads[K])
        mittInstance.off(event as string, wrapped)
      }
      mittInstance.on(event as string, wrapped)
    },
    _mitt: mittInstance,
  }

  // Dev inspector
  const hasGlobal = typeof window !== 'undefined' || typeof globalThis !== 'undefined'
  if (isDev && hasGlobal) {
    const target = typeof window !== 'undefined' ? window : globalThis as any
    target.__GEO_EVENTBUS__ = {
      history: () => [...eventHistory],
      listeners: (event?: string) => {
        // mitt doesn't expose listener counts publicly
        // We approximate via mittInstance.all
        const all = (mittInstance as any).all as Map<string, Set<Function>>
        if (!all) return 0
        if (event) return all.get(event)?.size || 0
        let total = 0
        for (const handlers of all.values()) total += handlers.size
        return total
      },
      last: () => eventHistory.length > 0 ? eventHistory[eventHistory.length - 1] : null,
      clear: () => { eventHistory = [] },
      stats: () => ({ total: emitCount, byEvent: { ...emitCountByEvent } }),
    } satisfies GeoEventBusInspector
  }

  return bus
}

// Singleton instance — shared across the GEO workspace
// Production: import this and wrap with useEventBus()
// Development: window.__GEO_EVENTBUS__ available
export const eventBus = createEventBus({
  dev: process.env.NODE_ENV !== 'production',
})
