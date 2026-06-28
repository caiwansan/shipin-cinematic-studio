// ============================================================
// Governance Service — KMKI-PLAT-012
// Frontend API client for governance operations
// ============================================================

import type {
  TenantDTO, GovOrganizationDTO, SubscriptionPlanDTO, SubscriptionDTO,
  QuotaDTO, UsageRecordDTO, BillingRecordDTO, AuditLogDTO,
  PolicyDTO, RoleDTO, LicenseDTO, GovernanceOverview,
  UsageSummary, CapabilityUsage, ApiResponse,
} from '../types/index.js'

const BASE = '/api/platform/governance'

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.error || 'API error')
  return json.data
}

export class GovernanceApiService {
  // ─── Tenant ───
  async createTenant(data: { name: string; type: string; metadata?: any }): Promise<TenantDTO> {
    return fetchApi(`${BASE}/tenants`, { method: 'POST', body: JSON.stringify(data) })
  }
  async getTenant(id: string): Promise<TenantDTO> {
    return fetchApi(`${BASE}/tenants/${id}`)
  }
  async listTenants(): Promise<TenantDTO[]> {
    return fetchApi(`${BASE}/tenants`)
  }

  // ─── Subscription / Plans ───
  async getPlans(activeOnly = true): Promise<SubscriptionPlanDTO[]> {
    return fetchApi(`${BASE}/plans?activeOnly=${activeOnly}`)
  }
  async subscribe(tenantId: string, planId: string): Promise<SubscriptionDTO> {
    return fetchApi(`${BASE}/subscriptions`, { method: 'POST', body: JSON.stringify({ tenantId, planId }) })
  }
  async getActiveSubscription(tenantId: string): Promise<SubscriptionDTO> {
    return fetchApi(`${BASE}/subscriptions/active/${tenantId}`)
  }
  async cancelSubscription(tenantId: string): Promise<void> {
    return fetchApi(`${BASE}/subscriptions/${tenantId}/cancel`, { method: 'POST' })
  }

  // ─── Capability Auth ───
  async checkCapability(tenantId: string, capability: string): Promise<{ allowed: boolean }> {
    return fetchApi(`${BASE}/auth/check?tenantId=${tenantId}&capability=${capability}`)
  }

  // ─── Quota ───
  async getUsage(tenantId: string, from?: string, to?: string): Promise<{ usage: UsageRecordDTO[]; quota: QuotaDTO }> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return fetchApi(`${BASE}/quota/usage/${tenantId}?${params}`)
  }
  async checkQuota(tenantId: string, resourceType: string, amount = 1): Promise<any> {
    return fetchApi(`${BASE}/quota/check?tenantId=${tenantId}&resourceType=${resourceType}&amount=${amount}`)
  }
  async consumeQuota(tenantId: string, resourceType: string, amount: number, source: string): Promise<any> {
    return fetchApi(`${BASE}/quota/consume`, { method: 'POST', body: JSON.stringify({ tenantId, resourceType, amount, source }) })
  }

  // ─── Billing ───
  async getBillingHistory(tenantId: string, from?: string, to?: string): Promise<BillingRecordDTO[]> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return fetchApi(`${BASE}/billing/history/${tenantId}?${params}`)
  }
  async estimateCost(capability: string, resourceType: string, usage: number): Promise<{ estimatedCost: number }> {
    return fetchApi(`${BASE}/billing/estimate?capability=${capability}&resourceType=${resourceType}&usage=${usage}`)
  }

  // ─── Audit ───
  async getRecentAudit(tenantId: string, limit = 20): Promise<AuditLogDTO[]> {
    return fetchApi(`${BASE}/audit/recent/${tenantId}?limit=${limit}`)
  }
  async queryAudit(tenantId: string, filters?: Record<string, string>): Promise<{ items: AuditLogDTO[]; total: number }> {
    const params = new URLSearchParams(filters || {})
    return fetchApi(`${BASE}/audit/query/${tenantId}?${params}`)
  }

  // ─── Analytics ───
  async getUsageSummary(tenantId: string, from?: string, to?: string): Promise<UsageSummary> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return fetchApi(`${BASE}/analytics/summary/${tenantId}?${params}`)
  }
  async getCostTrend(tenantId: string, from?: string, to?: string): Promise<{ data: Array<{ date: string; cost: number }> }> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return fetchApi(`${BASE}/analytics/cost-trend/${tenantId}?${params}`)
  }
  async getTopCapabilities(tenantId: string, from?: string, to?: string, limit = 10): Promise<CapabilityUsage[]> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('limit', limit.toString())
    return fetchApi(`${BASE}/analytics/top-capabilities/${tenantId}?${params}`)
  }

  // ─── Overview ───
  async getOverview(tenantId: string): Promise<GovernanceOverview> {
    return fetchApi(`${BASE}/overview/${tenantId}`)
  }
}

export const governanceApi = new GovernanceApiService()
