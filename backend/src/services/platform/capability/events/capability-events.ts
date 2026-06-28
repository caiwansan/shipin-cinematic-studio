// ============================================================
// Capability Events — event definitions and publishing
// Events: Registered, Updated, Deprecated, Removed, Validated, Resolved
// ============================================================

import type { CapabilityEvent, CapabilityEventType } from '../types.js'

type EventHandler = (event: CapabilityEvent) => void

export class CapabilityEventBus {
  private listeners: Map<CapabilityEventType, Set<EventHandler>> = new Map()
  private globalListeners: Set<EventHandler> = new Set()
  private history: CapabilityEvent[] = []
  private maxHistorySize = 100

  /**
   * Subscribe to a specific event type
   */
  on(eventType: CapabilityEventType, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(handler)

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler)
    }
  }

  /**
   * Subscribe to all events
   */
  onAny(handler: EventHandler): () => void {
    this.globalListeners.add(handler)
    return () => {
      this.globalListeners.delete(handler)
    }
  }

  /**
   * Unsubscribe from a specific event type
   */
  off(eventType: CapabilityEventType, handler: EventHandler): void {
    this.listeners.get(eventType)?.delete(handler)
  }

  /**
   * Emit an event
   */
  emit(event: CapabilityEvent): void {
    // Add to history
    this.history.push(event)
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type)
    if (typeListeners) {
      for (const handler of typeListeners) {
        try {
          handler(event)
        } catch (err) {
          console.error(`[CapabilityEventBus] Error in ${event.type} handler:`, err)
        }
      }
    }

    // Notify global listeners
    for (const handler of this.globalListeners) {
      try {
        handler(event)
      } catch (err) {
        console.error(`[CapabilityEventBus] Error in global handler:`, err)
      }
    }
  }

  /**
   * Get event history
   */
  getHistory(eventType?: CapabilityEventType): CapabilityEvent[] {
    if (eventType) {
      return this.history.filter(e => e.type === eventType)
    }
    return [...this.history]
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear()
    this.globalListeners.clear()
  }

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: CapabilityEventType): number {
    return this.listeners.get(eventType)?.size || 0
  }
}

// Singleton
export const capabilityEventBus = new CapabilityEventBus()
