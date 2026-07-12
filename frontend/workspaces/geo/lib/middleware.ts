/**
 * GEO Event Bus — Middleware interface
 *
 * Middleware is plugged into the event bus at creation time.
 * Middleware is read-only — it may observe but never mutate or swallow events.
 *
 * # Rules
 *   - beforeEmit/afterEmit MUST NOT modify the payload
 *   - beforeEmit/afterEmit MUST NOT change emit behavior
 *   - Return values are ignored
 *   - Middleware runs in registration order
 */

export interface EventMiddleware {
  /** Human-readable name for debugging */
  name: string
  /** Called before the event is dispatched to listeners */
  beforeEmit?(event: string, payload: unknown): void
  /** Called after the event has been dispatched */
  afterEmit?(event: string, payload: unknown): void
}

/**
 * Creates a middleware that logs every event to console.
 * Only active in development mode.
 */
export function createLoggerMiddleware(): EventMiddleware {
  return {
    name: 'logger',
    beforeEmit(event, payload) {
      // @beta-stub: 生产环境 NODE_ENV=production 时自动跳过
      if (process.env.NODE_ENV !== 'production') {
        console.groupCollapsed(`[GEO EventBus] ${event}`)
        console.log('Payload:', payload)
        console.groupEnd()
      }
    },
  }
}

/**
 * Creates a middleware that tracks events for telemetry.
 * No-op until S1.1D when Telemetry Contract is wired.
 */
export function createTelemetryMiddleware(): EventMiddleware {
  return {
    name: 'telemetry',
    afterEmit() {
      // Reserved for S1.1D — Telemetry Contract
    },
  }
}
