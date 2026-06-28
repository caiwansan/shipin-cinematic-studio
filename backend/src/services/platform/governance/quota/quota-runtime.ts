// ============================================================
// Quota Runtime — KMKI-PLAT-012
// ============================================================

import { quotaRepository } from '../repositories/quota.repository.js'
import { usageRepository } from '../repositories/usage.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { createQuotaExceededEvent } from '../events/governance-events.js'
import type { QuotaDTO, QuotaCheckResult } from '../types.js'

export class QuotaRuntime {
  async initQuota(tenantId: string, config?: Partial<QuotaDTO>): Promise<QuotaDTO> {
    return quotaRepository.init(tenantId, config)
  }

  async checkQuota(tenantId: string, resourceType: string, amount = 1): Promise<QuotaCheckResult> {
    const quota = await quotaRepository.findByTenant(tenantId)
    if (!quota) {
      return { allowed: false, current: 0, limit: 0, resourceType }
    }
    const limit = (quota as any)[resourceType] ?? 0
    if (limit <= 0) {
      return { allowed: false, current: 0, limit: 0, resourceType }
    }
    let currentUsage = 0
    const now = new Date()
    if (resourceType === 'dailyTokens') {
      currentUsage = await usageRepository.getDailyTotal(tenantId, now, 'token')
    } else if (resourceType === 'monthlyTokens') {
      currentUsage = await usageRepository.getMonthlyTotal(tenantId, now.getFullYear(), now.getMonth() + 1, 'token')
    } else if (resourceType === 'imageCredits') {
      currentUsage = await usageRepository.getDailyTotal(tenantId, now, 'image')
    } else if (resourceType === 'videoMinutes') {
      currentUsage = await usageRepository.getDailyTotal(tenantId, now, 'video')
    } else if (resourceType === 'speechMinutes') {
      currentUsage = await usageRepository.getDailyTotal(tenantId, now, 'audio')
    }
    const allowed = currentUsage + amount <= limit
    if (!allowed) {
      platformEventBus.emit(createQuotaExceededEvent(tenantId, { resourceType, current: currentUsage, limit, requested: amount }))
    }
    return { allowed, current: currentUsage, limit, resourceType }
  }

  async consumeQuota(tenantId: string, resourceType: string, amount: number, source: string, sourceId?: string, capability?: string): Promise<QuotaCheckResult> {
    const check = await this.checkQuota(tenantId, resourceType, amount)
    if (!check.allowed) {
      await auditRepository.log({
        tenantId, action: 'quotaExceeded',
        resource: resourceType, resourceId: sourceId,
        details: { resourceType, amount, source, current: check.current, limit: check.limit },
      })
      return check
    }
    const unitMap: Record<string, string> = {
      dailyTokens: 'tokens', monthlyTokens: 'tokens', imageCredits: 'credits',
      videoMinutes: 'minutes', speechMinutes: 'minutes', concurrentJobs: 'count',
      workflowRuns: 'count', agentSessions: 'count', storage: 'bytes', workspaceCount: 'count',
    }
    await usageRepository.record({
      tenantId,
      resourceType: resourceType.replace(/^(daily|monthly)/, '').toLowerCase(),
      amount,
      unit: unitMap[resourceType] || 'count',
      capability,
      source,
      sourceId,
    })
    return check
  }

  async getUsage(tenantId: string, period?: { from?: Date; to?: Date }): Promise<any> {
    const now = new Date()
    const from = period?.from || new Date(now.getFullYear(), now.getMonth(), 1)
    const to = period?.to || now
    const usage = await usageRepository.findByTenant(tenantId, { fromDate: from, toDate: to })
    const quota = await quotaRepository.findByTenant(tenantId)
    return { usage, quota, period: { from, to } }
  }

  async getDailyUsage(tenantId: string): Promise<any> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const usage = await usageRepository.findByTenant(tenantId, { fromDate: startOfDay })
    return { date: startOfDay, records: usage }
  }
}

export const quotaRuntime = new QuotaRuntime()
