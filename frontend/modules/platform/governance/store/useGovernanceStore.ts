// ============================================================
// Governance Store — KMKI-PLAT-012
// ============================================================

import { defineStore } from 'pinia'
import { governanceApi } from '../services/governance.service.js'
import type {
  TenantDTO, SubscriptionDTO, SubscriptionPlanDTO, QuotaDTO,
  UsageRecordDTO, AuditLogDTO, UsageSummary, GovernanceOverview,
  RoleDTO, PolicyDTO,
} from '../types/index.js'

export const useGovernanceStore = defineStore('governance', {
  state: () => ({
    // Current tenant context
    currentTenantId: '',
    tenant: null as TenantDTO | null,
    // Subscription
    activeSubscription: null as SubscriptionDTO | null,
    plans: [] as SubscriptionPlanDTO[],
    // Quota & Usage
    quota: null as QuotaDTO | null,
    usageRecords: [] as UsageRecordDTO[],
    // Audit
    recentAudit: [] as AuditLogDTO[],
    // Analytics
    usageSummary: null as UsageSummary | null,
    costTrend: null as Array<{ date: string; cost: number }> | null,
    // Roles
    roles: [] as RoleDTO[],
    // Overview
    overview: null as GovernanceOverview | null,
    // Loading
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isSubscribed: (state) => !!state.activeSubscription,
    hasActivePlan: (state) => state.activeSubscription?.status === 'active',
    currentPlanName: (state) => state.activeSubscription?.plan?.name || 'Free',
    quotaUsagePercent: (state) => {
      if (!state.quota) return {}
      return {
        dailyTokens: state.quota.dailyTokens > 0 ? Math.min(100, (state.usageRecords.filter(r => r.resourceType === 'token').reduce((s, r) => s + r.amount, 0) / state.quota.dailyTokens) * 100) : 0,
        imageCredits: state.quota.imageCredits > 0 ? Math.min(100, (state.usageRecords.filter(r => r.resourceType === 'image').reduce((s, r) => s + r.amount, 0) / state.quota.imageCredits) * 100) : 0,
        videoMinutes: state.quota.videoMinutes > 0 ? Math.min(100, (state.usageRecords.filter(r => r.resourceType === 'video').reduce((s, r) => s + r.amount, 0) / state.quota.videoMinutes) * 100) : 0,
      }
    },
  },

  actions: {
    async loadOverview(tenantId: string) {
      this.loading = true
      this.error = null
      try {
        this.currentTenantId = tenantId
        this.overview = await governanceApi.getOverview(tenantId)
        this.tenant = this.overview.tenant || null
        this.activeSubscription = this.overview.subscription || null
        this.quota = this.overview.quota || null
        this.usageRecords = this.overview.usage || []
        this.recentAudit = this.overview.recentAudit || []
      } catch (e: any) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    async loadPlans(activeOnly = true) {
      try {
        this.plans = await governanceApi.getPlans(activeOnly)
      } catch (e: any) {
        this.error = e.message
      }
    },

    async loadUsageSummary(tenantId: string) {
      try {
        this.usageSummary = await governanceApi.getUsageSummary(tenantId)
      } catch (e: any) {
        this.error = e.message
      }
    },

    async loadCostTrend(tenantId: string) {
      try {
        const result = await governanceApi.getCostTrend(tenantId)
        this.costTrend = result.data
      } catch (e: any) {
        this.error = e.message
      }
    },

    async loadAuditLogs(tenantId: string, limit = 20) {
      try {
        this.recentAudit = await governanceApi.getRecentAudit(tenantId, limit)
      } catch (e: any) {
        this.error = e.message
      }
    },

    async subscribe(tenantId: string, planId: string) {
      try {
        this.activeSubscription = await governanceApi.subscribe(tenantId, planId)
        // Refresh overview after subscription change
        await this.loadOverview(tenantId)
      } catch (e: any) {
        this.error = e.message
      }
    },

    reset() {
      this.$reset()
    },
  },
})
