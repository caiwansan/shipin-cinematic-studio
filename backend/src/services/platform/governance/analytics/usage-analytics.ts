// ============================================================
// Usage Analytics — KMKI-PLAT-012
// ============================================================

import { analyticsRepository } from '../repositories/analytics.repository.js'
import { usageRepository } from '../repositories/usage.repository.js'
import { billingRepository } from '../repositories/billing.repository.js'
import type { UsageSummary, CostTrend } from '../types.js'

export class UsageAnalytics {
  async aggregateDaily(tenantId: string, date: Date): Promise<void> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    // Aggregate token usage
    const tokenUsage = await usageRepository.getDailyTotal(tenantId, date, 'token')
    await analyticsRepository.upsert({
      tenantId, date, metric: 'dailyTokenCount', value: tokenUsage,
    })
    // Aggregate costs
    const dailyCost = await billingRepository.getTotalCost(tenantId, startOfDay, endOfDay)
    await analyticsRepository.upsert({
      tenantId, date, metric: 'dailyCost', value: dailyCost,
    })
  }

  async getTopCapabilities(tenantId: string, period: { from: Date; to: Date }, limit = 10): Promise<Array<{ capability: string; count: number }>> {
    return analyticsRepository.getTopCapabilities(tenantId, period.from, period.to, limit)
  }

  async getCostTrend(tenantId: string, period: { from: Date; to: Date }): Promise<CostTrend> {
    const records = await analyticsRepository.findByTenantAndPeriod(tenantId, 'dailyCost', period.from, period.to)
    return {
      period: `${period.from.toISOString()}_${period.to.toISOString()}`,
      data: records.map(r => ({ date: r.date.toISOString(), cost: r.value })),
    }
  }

  async getUsageSummary(tenantId: string, period: { from: Date; to: Date }): Promise<UsageSummary> {
    const [tokenRecords, imageRecords, videoRecords, audioRecords, workflowRecords] = await Promise.all([
      usageRepository.findByTenant(tenantId, { fromDate: period.from, toDate: period.to, resourceType: 'token' }),
      usageRepository.findByTenant(tenantId, { fromDate: period.from, toDate: period.to, resourceType: 'image' }),
      usageRepository.findByTenant(tenantId, { fromDate: period.from, toDate: period.to, resourceType: 'video' }),
      usageRepository.findByTenant(tenantId, { fromDate: period.from, toDate: period.to, resourceType: 'audio' }),
      usageRepository.findByTenant(tenantId, { fromDate: period.from, toDate: period.to, resourceType: 'workflow' }),
    ])
    const totalCost = await billingRepository.getTotalCost(tenantId, period.from, period.to)
    return {
      totalTokens: tokenRecords.reduce((sum, r) => sum + r.amount, 0),
      totalImages: imageRecords.reduce((sum, r) => sum + r.amount, 0),
      totalVideoMinutes: videoRecords.reduce((sum, r) => sum + r.amount, 0),
      totalAudioMinutes: audioRecords.reduce((sum, r) => sum + r.amount, 0),
      totalWorkflowRuns: workflowRecords.reduce((sum, r) => sum + r.amount, 0),
      totalCost,
    }
  }
}

export const usageAnalytics = new UsageAnalytics()
