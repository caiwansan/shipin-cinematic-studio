// ============================================================
// Health Checker — periodic health checks with caching
// KMKI-PLAT-008
// ============================================================

import { contractRepository } from '../repositories/contract.repository'
import { resourceHealth } from './resource-health'
import type { ResourceContract } from '../types'

interface HealthCheckConfig {
  intervalMs: number      // How often to run checks
  concurrency: number     // Max concurrent checks
  timeoutMs: number       // Per-check timeout
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  intervalMs: 5 * 60 * 1000,   // 5 minutes
  concurrency: 5,
  timeoutMs: 10000,              // 10 seconds
}

// Cache of latest health status per resource
const healthCache = new Map<string, { status: string; checkedAt: number }>()
let intervalHandle: ReturnType<typeof setInterval> | null = null
let config: HealthCheckConfig = { ...DEFAULT_CONFIG }

export const healthChecker = {
  /**
   * Start periodic health checks.
   */
  start(cfg?: Partial<HealthCheckConfig>): void {
    if (intervalHandle) {
      console.warn('[HealthChecker] Already running. Restarting...')
      this.stop()
    }
    config = { ...DEFAULT_CONFIG, ...cfg }
    console.log(`[HealthChecker] Starting with interval ${config.intervalMs}ms`)

    // Run immediately, then on interval
    this.runAllChecks()
    intervalHandle = setInterval(() => this.runAllChecks(), config.intervalMs)
  },

  /**
   * Stop periodic health checks.
   */
  stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle)
      intervalHandle = null
    }
  },

  /**
   * Run health checks for all active resources.
   */
  async runAllChecks(): Promise<void> {
    try {
      const result = await contractRepository.list({ status: 'active', limit: 200 })
      const resources = result.items

      // Process in batches to control concurrency
      for (let i = 0; i < resources.length; i += config.concurrency) {
        const batch = resources.slice(i, i + config.concurrency)
        await Promise.allSettled(batch.map(r => this.checkResource(r)))
      }

      console.log(`[HealthChecker] ✅ Checked ${resources.length} resources`)
    } catch (err: any) {
      console.error('[HealthChecker] ❌ Failed to run checks:', err.message)
    }
  },

  /**
   * Check a single resource with timeout.
   */
  async checkResource(resource: ResourceContract): Promise<void> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), config.timeoutMs)
      )
      const checkPromise = resourceHealth.check(resource)
      const health = await Promise.race([checkPromise, timeoutPromise])

      healthCache.set(resource.id, {
        status: health.status,
        checkedAt: Date.now(),
      })
    } catch (err: any) {
      healthCache.set(resource.id, {
        status: 'down',
        checkedAt: Date.now(),
      })
      console.warn(`[HealthChecker] ⚠️ ${resource.name}: ${err.message}`)
    }
  },

  /**
   * Check a specific resource by ID.
   */
  async checkResourceById(resourceId: string): Promise<{ status: string; checkedAt: number } | null> {
    const resource = await contractRepository.findById(resourceId)
    if (!resource) return null
    await this.checkResource(resource)
    return healthCache.get(resourceId) || null
  },

  /**
   * Get cached health for a resource.
   */
  getCached(resourceId: string): { status: string; checkedAt: number } | undefined {
    return healthCache.get(resourceId)
  },

  /**
   * Get all cached health statuses.
   */
  getAllCached(): Map<string, { status: string; checkedAt: number }> {
    return new Map(healthCache)
  },

  /**
   * Get cache stats.
   */
  getStats(): { cached: number; running: boolean; intervalMs: number } {
    return {
      cached: healthCache.size,
      running: intervalHandle !== null,
      intervalMs: config.intervalMs,
    }
  },
}
