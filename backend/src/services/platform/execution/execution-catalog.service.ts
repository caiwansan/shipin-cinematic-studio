// ============================================================
// Execution Catalog Service — execution plan querying and browsing
// ============================================================

import { executionPlanRepository } from './repositories/execution-plan.repository'
import { executionHistoryRepository } from './repositories/execution-history.repository'
import { executionMetricsRepository } from './repositories/execution-metrics.repository'
import type { ExecutionPlanQuery } from './types'
import type { PlatformContext } from '@platform/context/platform-context'

export const executionCatalogService = {
  /**
   * Search plans by keyword across name, capabilityId, metadata.
   */
  async searchPlans(
    keyword: string,
    query?: Partial<ExecutionPlanQuery>,
    ctx?: PlatformContext,
  ) {
    const fullQuery: ExecutionPlanQuery = {
      ...query,
      capabilityId: query?.capabilityId,
    }
    const { items } = await executionPlanRepository.list(fullQuery, ctx)

    const lowerKeyword = keyword.toLowerCase()
    const filtered = items.filter(plan =>
      plan.capabilityId.toLowerCase().includes(lowerKeyword) ||
      plan.id.toLowerCase().includes(lowerKeyword) ||
      plan.version.toLowerCase().includes(lowerKeyword) ||
      (plan.metadata?.contractName as string || '').toLowerCase().includes(lowerKeyword),
    )

    return { items: filtered, total: filtered.length }
  },

  /**
   * Get recent executions.
   */
  async getRecentExecutions(
    limit = 20,
    ctx?: PlatformContext,
  ) {
    return executionHistoryRepository.list({}, limit, ctx)
  },

  /**
   * Get recent failures.
   */
  async getRecentFailures(
    count = 10,
    ctx?: PlatformContext,
  ) {
    return executionHistoryRepository.getRecentFailures(count, ctx)
  },

  /**
   * Get execution dashboard overview.
   */
  async getDashboard(ctx?: PlatformContext) {
    const globalMetrics = await executionMetricsRepository.getGlobal(ctx)
    const strategyMetrics = await executionMetricsRepository.getByStrategy(ctx)
    const recentExecutions = await executionHistoryRepository.list({}, 10, ctx)

    return {
      globalMetrics,
      strategyMetrics,
      recentExecutions: recentExecutions.items,
      totalPlans: (await executionPlanRepository.list({}, ctx)).total,
    }
  },

  /**
   * List all available plan IDs.
   */
  async listAllPlans(ctx?: PlatformContext) {
    return executionPlanRepository.listIds(ctx)
  },
}
