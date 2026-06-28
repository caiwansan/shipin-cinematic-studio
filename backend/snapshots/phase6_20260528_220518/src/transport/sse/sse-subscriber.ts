/**
 * Phase SSE Wiring — SSE Subscriber
 *
 * Subscribes to globalExecutionBus and fans out events to
 * connected SSE clients, partitioned by executionId.
 *
 * R3_EXECUTION_SCOPED_FANOUT — Events are dispatched to executionId-specific client pools
 * R4_SSE_NOT_TRUTH — SSE does NOT write to ExecutionStore
 */

import { globalExecutionBus } from './execution-event-bus.js'

/**
 * Minimal Response interface for SSE clients.
 */
interface SseResponse {
  write(data: string): void
  on(event: 'close', handler: () => void): void
}

/**
 * SseSubscriber — bridges execution events to SSE clients.
 */
export class SseSubscriber {
  private clients = new Map<string, Set<SseResponse>>()

  constructor() {
    globalExecutionBus.subscribe(this.handleEvent.bind(this))
  }

  /**
   * Add a client response to receive events for an execution.
   */
  addClient(executionId: string, res: SseResponse): void {
    if (!this.clients.has(executionId)) {
      this.clients.set(executionId, new Set())
    }
    this.clients.get(executionId)!.add(res)

    // Send initial connected event
    res.write(`event: connected\ndata: {"executionId":"${executionId}"}\n\n`)

    // Cleanup on disconnect
    res.on('close', () => {
      const pool = this.clients.get(executionId)
      if (pool) {
        pool.delete(res)
        if (pool.size === 0) {
          this.clients.delete(executionId)
        }
      }
    })
  }

  /**
   * Handle an execution event from the bus.
   */
  private handleEvent(event: {
    executionId: string
    type: string
    capability: string
    mode: string
    progress: number | null
    payload?: Record<string, unknown>
    timestamp: number
  }): void {
    const pool = this.clients.get(event.executionId)
    if (!pool || pool.size === 0) return

    const data = JSON.stringify(event)
    const sseMessage = `event: ${event.type}\ndata: ${data}\n\n`

    for (const client of pool) {
      try {
        client.write(sseMessage)
      } catch {
        pool.delete(client)
      }
    }
  }

  /**
   * Total connected clients.
   */
  get clientCount(): number {
    let count = 0
    for (const pool of this.clients.values()) {
      count += pool.size
    }
    return count
  }

  /**
   * Number of active execution streams.
   */
  get streamCount(): number {
    return this.clients.size
  }
}

/** Global singleton */
export const globalSseSubscriber = new SseSubscriber()
