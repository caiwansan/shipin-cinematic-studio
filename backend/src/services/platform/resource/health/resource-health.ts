// ============================================================
// Resource Health — health check service
// KMKI-PLAT-008: Availability / Latency / Error Rate / Rate Limit / Quota
// ============================================================

import type { ResourceContract, ResourceHealth, HealthStatus } from '../types'
import { healthRepository } from '../repositories/health.repository'
import { PlatformError } from '@platform/errors/platform-errors'

/**
 * Health Check function type.
 * Each resource type can register its own health check implementation.
 */
export type HealthCheckFn = (resource: ResourceContract, endpoint?: string) => Promise<{
  status: HealthStatus
  latencyMs: number
  errorRate?: number
  rateLimitRemaining?: number
  quotaRemaining?: number
  failureReason?: string
}>

// Registered health checkers by resource type
const healthCheckers = new Map<string, HealthCheckFn>()

/**
 * Register a health checker for a resource type.
 */
export function registerHealthChecker(type: string, checker: HealthCheckFn): void {
  healthCheckers.set(type, checker)
}

export const resourceHealth = {
  /**
   * Check a resource's health.
   */
  async check(resource: ResourceContract, endpoint?: string): Promise<ResourceHealth> {
    const checker = healthCheckers.get(resource.type)
    let result: {
      status: HealthStatus
      latencyMs: number
      errorRate?: number
      rateLimitRemaining?: number
      quotaRemaining?: number
      failureReason?: string
    }

    if (checker) {
      try {
        result = await checker(resource, endpoint)
      } catch (err: any) {
        result = {
          status: 'down',
          latencyMs: 0,
          failureReason: err.message,
        }
      }
    } else {
      // Default: mark as unknown for unregistered types
      result = {
        status: 'unknown',
        latencyMs: 0,
      }
    }

    const healthRecord: Omit<ResourceHealth, 'id' | 'checkedAt'> = {
      resourceId: resource.id,
      status: result.status,
      latencyMs: result.latencyMs,
      errorRate: result.errorRate,
      rateLimitRemaining: result.rateLimitRemaining,
      quotaRemaining: result.quotaRemaining,
      failureReason: result.failureReason,
      metadata: JSON.stringify({ checkedBy: 'resourceHealth.check', resourceType: resource.type }),
    }

    return healthRepository.create(healthRecord)
  },

  /**
   * Get latest health for a resource.
   */
  async getLatest(resourceId: string): Promise<ResourceHealth | null> {
    return healthRepository.findLatestByResourceId(resourceId)
  },

  /**
   * Get health history for a resource.
   */
  async getHistory(resourceId: string, limit: number = 20): Promise<ResourceHealth[]> {
    return healthRepository.listByResourceId(resourceId, limit)
  },

  /**
   * Get aggregated health overview.
   */
  async getAggregated(): Promise<Record<string, number>> {
    return healthRepository.getAggregatedHealth()
  },

  /**
   * Get all currently unhealthy (down) resources.
   */
  async getUnhealthy(): Promise<ResourceHealth[]> {
    return healthRepository.listUnhealthy('down')
  },

  /**
   * Get all degraded resources.
   */
  async getDegraded(): Promise<ResourceHealth[]> {
    return healthRepository.listUnhealthy('degraded')
  },
}
