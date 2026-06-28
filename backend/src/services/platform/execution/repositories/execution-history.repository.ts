// ============================================================
// Execution History Repository — History records
// ============================================================

import type { ExecutionHistoryRecord, ExecutionResult } from '../types.js'
import { RepositoryError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'

const historyStore = new Map<string, ExecutionHistoryRecord[]>()

export const executionHistoryRepository = {
  /**
   * Record a new history entry from an execution result.
   */
  async record(result: ExecutionResult, _ctx?: PlatformContext): Promise<ExecutionHistoryRecord> {
    const record: ExecutionHistoryRecord = {
      id: `hist-${result.planId}-${Date.now()}`,
      planId: result.planId,
      capabilityId: result.capabilityId,
      status: result.status,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      totalSteps: result.metrics.totalSteps,
      completedSteps: result.metrics.completedSteps,
      failedSteps: result.metrics.failedSteps,
      strategyUsed: result.metrics.strategyUsed,
      error: result.error?.message,
      metadata: {
        ...result.context?.metadata,
        schemaVersion: result.schemaVersion,
      },
    }

    const key = result.capabilityId
    if (!historyStore.has(key)) {
      historyStore.set(key, [])
    }
    historyStore.get(key)!.push(record)

    return record
  },

  /**
   * Get history for a specific capability.
   */
  async getByCapabilityId(
    capabilityId: string,
    limit = 50,
    _ctx?: PlatformContext,
  ): Promise<ExecutionHistoryRecord[]> {
    const records = historyStore.get(capabilityId) || []
    return records.slice(-limit)
  },

  /**
   * Get history by plan ID.
   */
  async getByPlanId(planId: string, _ctx?: PlatformContext): Promise<ExecutionHistoryRecord | null> {
    for (const records of historyStore.values()) {
      const found = records.find(r => r.planId === planId)
      if (found) return found
    }
    return null
  },

  /**
   * Get all history records, optionally filtered by capability.
   */
  async list(
    filter?: { capabilityId?: string; status?: string; fromDate?: string; toDate?: string },
    limit = 100,
    _ctx?: PlatformContext,
  ): Promise<{ items: ExecutionHistoryRecord[]; total: number }> {
    let allRecords: ExecutionHistoryRecord[] = []
    for (const records of historyStore.values()) {
      allRecords = allRecords.concat(records)
    }

    if (filter?.capabilityId) {
      allRecords = allRecords.filter(r => r.capabilityId === filter.capabilityId)
    }
    if (filter?.status) {
      allRecords = allRecords.filter(r => r.status === filter.status)
    }
    if (filter?.fromDate) {
      allRecords = allRecords.filter(r => r.startedAt >= filter.fromDate!)
    }
    if (filter?.toDate) {
      allRecords = allRecords.filter(r => r.startedAt <= filter.toDate!)
    }

    allRecords.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    const total = allRecords.length
    allRecords = allRecords.slice(0, limit)

    return { items: allRecords, total }
  },

  /**
   * Get recent failures for monitoring.
   */
  async getRecentFailures(
    count = 10,
    _ctx?: PlatformContext,
  ): Promise<ExecutionHistoryRecord[]> {
    const allRecords: ExecutionHistoryRecord[] = []
    for (const records of historyStore.values()) {
      allRecords.push(...records)
    }

    return allRecords
      .filter(r => r.status === 'failed')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, count)
  },

  /**
   * Clear all history (for testing).
   */
  async clear(_ctx?: PlatformContext): Promise<void> {
    historyStore.clear()
  },
}
