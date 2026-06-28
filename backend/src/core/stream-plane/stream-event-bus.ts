/**
 * Phase 3A — Stream Event Bus
 *
 * In-process event bus for stream chunk distribution.
 *
 * Design decisions:
 *   - Local (process-level) — no Redis, no message queue
 *     Phase 3 concern: type contract, not transport.
 *   - session-scoped publish/subscribe — consumers filter by sessionId
 *   - No persistence — if a subscriber isn't registered when a chunk
 *     is emitted, that chunk is not replayed. The caller must pre-register.
 *
 * Future (Phase 4/Kernel): if cross-process streaming is required,
 * this will be backed by BullMQ event streams or Redis pubsub.
 * The StreamChunk type contract remains unchanged.
 */

type StreamChunkListener = (chunk: import('./stream-chunk.js').StreamChunk) => void

/**
 * StreamEventBus — publish chunks, subscribe by sessionId.
 *
 * Usage:
 *   const bus = new StreamEventBus()
 *   bus.subscribe(sessionId, (chunk) => { ... })
 *   bus.emit(chunk)
 *   bus.unsubscribe(sessionId, listener)
 */
export class StreamEventBus {
  /** Map of sessionId → Set of listeners */
  private listeners = new Map<string, Set<StreamChunkListener>>()
  /** Global listeners (receive ALL chunks) */
  private globalListeners = new Set<StreamChunkListener>()

  /**
   * Subscribe to chunks for a specific session.
   * Returns an unsubscribe function.
   */
  subscribe(sessionId: string, fn: StreamChunkListener): () => void {
    let set = this.listeners.get(sessionId)
    if (!set) {
      set = new Set()
      this.listeners.set(sessionId, set)
    }
    set.add(fn)
    return () => this.unsubscribe(sessionId, fn)
  }

  /**
   * Subscribe to ALL chunks across all sessions (for monitoring/observability).
   */
  subscribeGlobal(fn: StreamChunkListener): () => void {
    this.globalListeners.add(fn)
    return () => this.globalListeners.delete(fn)
  }

  /**
   * Remove a specific listener from a session.
   */
  unsubscribe(sessionId: string, fn: StreamChunkListener): void {
    const set = this.listeners.get(sessionId)
    if (set) {
      set.delete(fn)
      if (set.size === 0) this.listeners.delete(sessionId)
    }
  }

  /**
   * Remove all listeners for a session.
   */
  unsubscribeAll(sessionId: string): void {
    this.listeners.delete(sessionId)
  }

  /**
   * Emit a chunk to all listeners.
   * Chunks go to: global listeners + session-scoped listeners.
   */
  emit(chunk: import('./stream-chunk.js').StreamChunk): void {
    // Session-scoped listeners
    const sessionListeners = this.listeners.get(chunk.sessionId)
    if (sessionListeners) {
      for (const fn of sessionListeners) {
        try { fn(chunk) } catch (err) {
          console.error(`[StreamEventBus] Session listener error:`, err)
        }
      }
    }

    // Global listeners
    for (const fn of this.globalListeners) {
      try { fn(chunk) } catch (err) {
        console.error(`[StreamEventBus] Global listener error:`, err)
      }
    }
  }

  /**
   * Check if a session has any registered listeners.
   */
  hasListeners(sessionId: string): boolean {
    return this.listeners.has(sessionId) || this.globalListeners.size > 0
  }

  /**
   * Total active sessions being listened to.
   */
  get activeSessionCount(): number {
    return this.listeners.size
  }

  /**
   * Remove all listeners. (Useful for testing / cleanup.)
   */
  clear(): void {
    this.listeners.clear()
    this.globalListeners.clear()
  }
}

/**
 * Global singleton event bus for stream chunks.
 * All stream sessions in the system publish to this bus.
 * Components subscribe to the sessions they care about.
 */
export const globalStreamBus = new StreamEventBus()
