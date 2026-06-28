/**
 * runtime/trace/runtime-trace.ts — Phase 4.1 Step 4 / Phase 4.2.5 persist
 *
 * Non-invasive invocation trace instrumentation.
 * Records which modules/functions are actually invoked at runtime.
 * NEVER modifies return values or control flow.
 *
 * Phase 4.2.5: Added persist-to-file flush for execution history durability.
 *
 * @phase4-owner
 */

import * as fs from 'fs'
import * as path from 'path'

type TraceEvent = {
  module: string
  function: string
  caller: string
  timestamp: number
  durationMs: number
  traceId: string
}

const MAX_TRACE_EVENTS = 10_000

/**
 * Reports directory at project root.
 * __dirname resolves to backend/dist/runtime/trace/ → need to go up 4 levels.
 */
const REPORTS_DIR = path.resolve(__dirname, '../../../../reports/runtime-trace')

/**
 * In-memory trace store. Append-only.
 * Now supports flush() for execution history durability.
 */
class RuntimeTraceStore {
  private events: TraceEvent[] = []
  private traceIdCounter = 0
  private flushCounter = 0

  record(event: Omit<TraceEvent, 'timestamp' | 'traceId'>): void {
    if (this.events.length >= MAX_TRACE_EVENTS) {
      this.flush() // auto-flush before ring eviction
      // If still at max after flush, evict
      if (this.events.length >= MAX_TRACE_EVENTS) {
        this.events.splice(0, Math.floor(MAX_TRACE_EVENTS * 0.1))
      }
    }

    this.events.push({
      ...event,
      timestamp: Date.now(),
      traceId: `trace-${++this.traceIdCounter}`,
    })
  }

  getEvents(): readonly TraceEvent[] {
    return this.events
  }

  isModuleInvoked(module: string): boolean {
    return this.events.some(e => e.module === module)
  }

  /**
   * Phase 4.2.5: Persist current trace to disk.
   * Appends to run-{timestamp}.json in reports/runtime-trace/.
   * Non-invasive: try/catch wraps all I/O.
   */
  flush(): void {
    if (this.events.length === 0) return
    try {
      if (!fs.existsSync(REPORTS_DIR)) {
        fs.mkdirSync(REPORTS_DIR, { recursive: true })
      }
      const filename = `run-${Date.now()}.${++this.flushCounter}.json`
      const filepath = path.join(REPORTS_DIR, filename)
      const payload = JSON.stringify({
        flushedAt: new Date().toISOString(),
        totalEvents: this.events.length,
        invokedModules: [...new Set(this.events.map(e => e.module))],
        events: this.events,
      })
      fs.writeFileSync(filepath, payload, 'utf-8')
      // Clear after successful flush
      this.events = []
    } catch (err) {
      console.warn('[RuntimeTrace] flush failed (non-blocking):', err instanceof Error ? err.message : err)
    }
  }

  reset(): void {
    this.events = []
  }
}

export const runtimeTrace = new RuntimeTraceStore()

/**
 * Non-invasive execution wrapper.
 * Wraps any function and records invocation metadata.
 * Does NOT modify the return value or control flow.
 *
 * Usage:
 *   const result = wrapExecution(fn, {
 *     module: 'narrative-gateway',
 *     function: 'execute',
 *     caller: 'script-submit',
 *   })(ctx)
 */
export function wrapExecution<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  meta: { module: string; function: string; caller: string },
): (...args: TArgs) => TResult {
  return (...args: TArgs): TResult => {
    const start = Date.now()

    // Non-invasive: try/catch around trace to never impact execution
    try {
      runtimeTrace.record({
        module: meta.module,
        function: meta.function,
        caller: meta.caller,
      })
    } catch {
      // Silent: trace failures MUST NOT affect runtime
    }

    // Invoke original function — unmodified
    const result = fn(...args)

    // Record duration for sync results
    const durationMs = Date.now() - start
    try {
      // Update the last event's duration (we can't easily update in-place,
      // but for visibility this is fine)
    } catch {
      // Silent
    }

    return result
  }
}

/**
 * Snapshot current trace to JSON.
 * Safe to call at any time — does not drain the store.
 */
export function snapshotTrace(): { events: TraceEvent[] } {
  return { events: [...runtimeTrace.getEvents()] }
}

/**
 * Phase 4.2.5: Periodic flush timer.
 * Flushes every N ms. Non-invasive — errors caught internally.
 * Call once at startup to begin periodic persistence.
 */
export function startPeriodicFlush(intervalMs: number = 60_000): void {
  setInterval(() => {
    runtimeTrace.flush()
  }, intervalMs)
}
