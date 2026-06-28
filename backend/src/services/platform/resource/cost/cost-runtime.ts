// ============================================================
// Cost Runtime — unified cost recording and aggregation
// KMKI-PLAT-008
// ============================================================

import type { ResourceUsage } from '../types'
import { usageRepository } from '../repositories/usage.repository'
import { costRepository } from '../repositories/cost.repository'
import { PlatformError } from '@platform/errors/platform-errors'

export const costRuntime = {
  /**
   * Record a usage entry after execution.
   */
  async recordUsage(data: Omit<ResourceUsage, 'id' | 'createdAt'>): Promise<ResourceUsage> {
    return usageRepository.create(data)
  },

  /**
   * Get usage history for a tenant.
   */
  async getUsageHistory(tenantId: string, params?: {
    resourceType?: string
    status?: string
    limit?: number
    offset?: number
    startDate?: Date
    endDate?: Date
  }): Promise<{ items: ResourceUsage[]; total: number }> {
    return usageRepository.listByTenant(tenantId, params)
  },

  /**
   * Aggregate usage for a tenant over a period.
   */
  async aggregateUsage(tenantId: string, startDate: Date, endDate: Date): Promise<{
    totalCost: number
    totalTokens: number
    totalRequests: number
    byType: Record<string, { count: number; cost: number; tokens: number }>
  }> {
    return usageRepository.aggregateByTenant(tenantId, startDate, endDate)
  },

  /**
   * Record or update cost aggregation entry.
   */
  async recordCost(data: {
    resourceId: string
    tenantId: string
    workspaceId?: string
    billingPeriod: string
    totalCost: number
    currency?: string
    periodStart: Date
    periodEnd: Date
    metadata?: string
  }): Promise<any> {
    return costRepository.upsert({
      ...data,
      currency: data.currency || 'USD',
    })
  },

  /**
   * Get cost records for a tenant.
   */
  async getCosts(tenantId: string, params?: {
    workspaceId?: string
    billingPeriod?: string
    limit?: number
    offset?: number
  }): Promise<{ items: any[]; total: number }> {
    return costRepository.findByTenant(tenantId, params)
  },

  /**
   * Get total cost for a tenant over a period.
   */
  async getTotalCost(tenantId: string, startDate: Date, endDate: Date): Promise<number> {
    return costRepository.getTotalCost(tenantId, startDate, endDate)
  },

  /**
   * Get monthly cost breakdown for a tenant.
   */
  async getMonthlyBreakdown(tenantId: string, year: number, month: number): Promise<Array<{ resourceId: string; resourceName: string; totalCost: number }>> {
    return costRepository.getMonthlyCostBreakdown(tenantId, year, month)
  },
}
