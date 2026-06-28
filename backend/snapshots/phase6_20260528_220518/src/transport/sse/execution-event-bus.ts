/**
 * Phase SSE Wiring — Execution Event Bus
 *
 * A lightweight event bus that Kernel uses to broadcast execution events.
 * This is NOT StreamPlane's chunk-level event bus.
 * This is graph-level: "a graph execution completed/failed/progressed".
 *
 * Separation:
 *   StreamEventBus   → stream chunks (internal to StreamPlane)
 *   ExecutionEventBus → graph execution lifecycles (Kernel → external world)
 *
 * R1_KERNEL_ZERO_TRANSPORT_AWARENESS — Kernel emits events, doesn't know who subscribes
 * R2_EVENTS_ARE_GRAPH_LEVEL — Not chunk-level, not provider-level
 */

export interface ExecutionEvent {
  /** Execution/job ID */
  executionId: string
  /** Event type */
  type: 'progress' | 'node_completed' | 'completed' | 'failed' | 'cancelled'
  /** Capability being executed */
  capability: string
  /** The execution mode */
  mode: 'SYNC' | 'STREAM' | 'ASYNC'
  /** Progress estimate (0.0-1.0), null if unknown */
  progress: number | null
  /** Optional payload (result, error info, etc.) */
  payload?: Record<string, unknown>
  /** When the event was created */
  timestamp: number
}

type EventHandler = (event: ExecutionEvent) => void

/**
 * ExecutionEventBus — graph-level execution event distribution.
 * Singleton, process-local.
 */
export class ExecutionEventBus {
  private handlers = new Set<EventHandler>()

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: ExecutionEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch {
        // Silently skip broken handlers
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

/** Global singleton */
export const globalExecutionBus = new ExecutionEventBus()
