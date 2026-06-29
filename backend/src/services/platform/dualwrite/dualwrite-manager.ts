// ============================================================
// DualWriteManager — Stage 3 Dual Write Layer
// Repository-level dual write orchestration with hooks.
// 
// Lifecycle:
//   Service → Repository (Legacy Write) → emit event
//   DualWriteManager.listen(event) → check flag → execute hook → watcher
// ============================================================

import { FeatureFlagService } from './feature-flag-service'

// ─── Types ─────────────────────────────────────────────────

export interface WriteEvent {
  type: 'CREATE' | 'UPDATE' | 'DELETE'
  entity: string        // 'Project', 'GeoProjectProfile', etc.
  oldData?: any
  newData?: any
  entityId: string
  tenantId: string
  timestamp: Date
}

export interface SyncResult {
  success: boolean
  target: string
  latencyMs: number
  error?: string
  oldData?: any
  newData?: any
}

export interface DualWriteHook {
  name: string
  entity: string
  enabled: boolean
  sync(event: WriteEvent): Promise<SyncResult>
}

export interface WatcherReport {
  totalSyncs: number
  successCount: number
  failureCount: number
  mismatchCount: number
  avgLatencyMs: number
  failures: Array<{ event: string; error: string; time: Date }>
  mismatches: Array<{ event: string; detail: string; time: Date }>
}

/**
 * Lightweight event sink interface.
 * Default: in-memory only (no persistence).
 * Inject PrismaEventSink for DB persistence.
 */
export interface EventSink {
  record(event: {
    entity: string
    entityId: string
    operation: string
    status: string
    latencyMs: number
    error?: string
    flags?: string // JSON
    diff?: string  // JSON
  }): Promise<void>
}

// ─── Manager ───────────────────────────────────────────────

export class DualWriteManager {
  private hooks: Map<string, DualWriteHook> = new Map()
  private flagService: FeatureFlagService
  private eventSink: EventSink | null = null

  // Watcher state
  private totalSyncs = 0
  private successCount = 0
  private failureCount = 0
  private mismatchCount = 0
  private totalLatencyMs = 0
  private failures: Array<{ event: string; error: string; time: Date }> = []
  private mismatches: Array<{ event: string; detail: string; time: Date }> = []

  constructor(flagService: FeatureFlagService) {
    this.flagService = flagService
  }

  /**
   * Inject an event sink for persistence (e.g., PrismaEventSink).
   */
  setEventSink(sink: EventSink): void {
    this.eventSink = sink
  }

  /**
   * Register a dual-write hook. Each hook maps to one entity.
   */
  registerHook(hook: DualWriteHook): void {
    if (this.hooks.has(hook.entity)) {
      console.warn(`[DualWrite] Overwriting hook for entity: ${hook.entity}`)
    }
    this.hooks.set(hook.entity, hook)
    console.log(`[DualWrite] Hook registered: ${hook.name} (entity=${hook.entity})`)
  }

  /**
   * Handle a write event: find matching hook, execute sync.
   * This is the main entry point called from Repository layer.
   */
  async onWrite(event: WriteEvent): Promise<SyncResult | null> {
    const hook = this.hooks.get(event.entity)
    if (!hook) return null

    // Check feature flag for this entity
    const flagKey = this.getFlagKey(event.entity)
    if (!this.flagService.isEnabled(flagKey)) {
      return null  // Dual write disabled for this entity
    }

    if (!hook.enabled) return null

    const start = Date.now()
    try {
      const result = await hook.sync(event)
      const latency = Date.now() - start

      this.totalSyncs++
      this.totalLatencyMs += latency

      if (result.success) {
        this.successCount++
      } else {
        this.failureCount++
        this.failures.push({ event: event.entity, error: result.error || 'unknown', time: new Date() })
        console.error(`[DualWrite] Sync failed for ${event.entity}:${event.entityId}`, result.error)
      }

      // Build diff for watcher
      let diff: string | undefined
      if (result.oldData && result.newData) {
        const mismatch = this.detectMismatch(result.oldData, result.newData)
        if (mismatch) {
          this.mismatchCount++
          this.mismatches.push({
            event: `${event.entity}:${event.entityId}`,
            detail: mismatch,
            time: new Date(),
          })
          console.warn(`[DualWrite] Mismatch detected: ${event.entity}:${event.entityId} — ${mismatch}`)
          diff = mismatch
        }
      }

      // Persist event
      const status = result.success ? 'SUCCESS' : 'FAIL'
      if (this.eventSink) {
        this.eventSink.record({
          entity: event.entity,
          entityId: event.entityId,
          operation: event.type,
          status,
          latencyMs: latency,
          error: result.error,
          flags: JSON.stringify({ [flagKey]: true }),
          diff,
        }).catch(e => console.error('[DualWrite] Event sink error:', e))
      }

      return { ...result, latencyMs: latency }
    } catch (err: any) {
      const latency = Date.now() - start
      this.totalSyncs++
      this.failureCount++
      this.failures.push({ event: event.entity, error: err.message, time: new Date() })
      console.error(`[DualWrite] Hook error for ${event.entity}:${event.entityId}`, err)

      // Persist failure event
      if (this.eventSink) {
        this.eventSink.record({
          entity: event.entity,
          entityId: event.entityId,
          operation: event.type,
          status: 'FAIL',
          latencyMs: latency,
          error: err.message,
          flags: JSON.stringify({ [flagKey]: true }),
        }).catch(e => console.error('[DualWrite] Event sink error:', e))
      }

      return { success: false, target: hook.name, latencyMs: latency, error: err.message }
    }
  }

  /**
   * Get watcher report for the monitoring dashboard.
   */
  getReport(): WatcherReport {
    return {
      totalSyncs: this.totalSyncs,
      successCount: this.successCount,
      failureCount: this.failureCount,
      mismatchCount: this.mismatchCount,
      avgLatencyMs: this.totalSyncs > 0 ? Math.round(this.totalLatencyMs / this.totalSyncs) : 0,
      failures: [...this.failures],
      mismatches: [...this.mismatches],
    }
  }

  /**
   * Reset watcher counters (e.g., after a monitoring window).
   */
  resetWatcher(): void {
    this.totalSyncs = 0
    this.successCount = 0
    this.failureCount = 0
    this.mismatchCount = 0
    this.totalLatencyMs = 0
    this.failures = []
    this.mismatches = []
  }

  // ─── Private ───────────────────────────────────────────

  private getFlagKey(entity: string): string {
    const map: Record<string, string> = {
      'Project': 'DUAL_WRITE_PROJECT',
      'GeoProjectProfile': 'DUAL_WRITE_GEO_PROFILE',
    }
    return map[entity] || `DUAL_WRITE_${entity.toUpperCase()}`
  }

  private detectMismatch(oldData: any, newData: any): string | null {
    const diffs: string[] = []
    for (const key of Object.keys(oldData)) {
      const oldVal = JSON.stringify(oldData[key])
      const newVal = JSON.stringify(newData[key])
      if (oldVal !== newVal) {
        diffs.push(`${key}: ${oldVal} → ${newVal}`)
      }
    }
    return diffs.length > 0 ? diffs.join('; ') : null
  }
}
