// ============================================================
// Platform Event Bus — unified event bus interface
// ARCH-001-D: All Runtimes must use this interface instead of own EventEmitter
// ============================================================

import type { PlatformEvent, PlatformEventType } from './event-types.js'

export type EventHandler = (event: PlatformEvent) => void

/**
 * Platform Event Bus interface.
 * Implementation can be in-memory (default), Redis, or Kafka.
 */
export interface IEventBus {
  /** Subscribe to a specific event type */
  on(type: PlatformEventType, handler: EventHandler): () => void

  /** Subscribe to all events */
  onAny(handler: EventHandler): () => void

  /** Unsubscribe from a specific event type */
  off(type: PlatformEventType, handler: EventHandler): void

  /** Emit an event to all subscribers */
  emit(event: PlatformEvent): void

  /** Get recent event history for observability */
  getHistory(type?: PlatformEventType): PlatformEvent[]

  /** Clear all listeners and history */
  clear(): void
}

// ============================================================
// Default In-Memory Implementation
// ============================================================

export class InMemoryEventBus implements IEventBus {
  private listeners: Map<PlatformEventType, Set<EventHandler>> = new Map()
  private globalListeners: Set<EventHandler> = new Set()
  private history: PlatformEvent[] = []
  private maxHistory = 200

  on(type: PlatformEventType, handler: EventHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler)
    return () => this.off(type, handler)
  }

  onAny(handler: EventHandler): () => void {
    this.globalListeners.add(handler)
    return () => { this.globalListeners.delete(handler) }
  }

  off(type: PlatformEventType, handler: EventHandler): void {
    this.listeners.get(type)?.delete(handler)
  }

  emit(event: PlatformEvent): void {
    // Store in history
    this.history.push(event)
    if (this.history.length > this.maxHistory) {
      this.history.splice(0, Math.floor(this.maxHistory * 0.25))
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type)
    if (typeListeners) {
      for (const handler of typeListeners) {
        try { handler(event) } catch (err) {
          console.error(`[EventBus] Error in ${event.type} handler:`, err)
        }
      }
    }

    // Notify global listeners
    for (const handler of this.globalListeners) {
      try { handler(event) } catch (err) {
        console.error(`[EventBus] Error in global handler:`, err)
      }
    }
  }

  getHistory(type?: PlatformEventType): PlatformEvent[] {
    if (type) return this.history.filter(e => e.type === type)
    return [...this.history]
  }

  clear(): void {
    this.listeners.clear()
    this.globalListeners.clear()
    this.history = []
  }
}

// Singleton instance
export const platformEventBus: IEventBus = new InMemoryEventBus()
