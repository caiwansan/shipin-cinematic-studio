// ============================================================
// Billing Runtime — KMKI-PLAT-012
// ============================================================

import { billingRepository } from '../repositories/billing.repository.js'
import { auditRepository } from '../repositories/audit.repository.js'
import { platformEventBus } from '@platform/events/event-bus.js'
import { createBillingRecordedEvent } from '../events/governance-events.js'
import type { BillingRecordDTO } from '../types.js'

export class BillingRuntime {
  async recordBilling(data: {
    tenantId: string; type: string; amount: number; currency?: string;
    source: string; description?: string; metadata?: Record<string, any>
  }, userId?: string): Promise<BillingRecordDTO> {
    const record = await billingRepository.record(data)
    await auditRepository.log({
      tenantId: data.tenantId, userId, action: 'billing',
      resource: 'billing', resourceId: record.id,
      details: { type: data.type, amount: data.amount, source: data.source },
    })
    platformEventBus.emit(createBillingRecordedEvent(data.tenantId, { type: data.type, amount: data.amount, id: record.id }))
    return record
  }

  async getBillingHistory(tenantId: string, period?: { from?: Date; to?: Date }): Promise<BillingRecordDTO[]> {
    return billingRepository.findByTenant(tenantId, {
      fromDate: period?.from,
      toDate: period?.to,
    })
  }

  async estimateCost(capability: string, resourceType: string, usage: number): Promise<{ estimatedCost: number; currency: string }> {
    const rateCard: Record<string, Record<string, number>> = {
      'video.generate': { token: 0.002, image: 0.05, video: 0.5, audio: 0.01 },
      'image.generate': { token: 0.001, image: 0.03 },
      'audio.synthesize': { token: 0.001, audio: 0.02 },
      'workflow.execute': { token: 0.003, workflow: 0.1 },
    }
    const rates = rateCard[capability]
    if (!rates) return { estimatedCost: 0, currency: 'USD' }
    const unitRate = rates[resourceType] ?? 0.001
    return { estimatedCost: usage * unitRate, currency: 'USD' }
  }

  async getMonthlyCost(tenantId: string, year: number, month: number): Promise<number> {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)
    return billingRepository.getTotalCost(tenantId, start, end)
  }
}

export const billingRuntime = new BillingRuntime()
