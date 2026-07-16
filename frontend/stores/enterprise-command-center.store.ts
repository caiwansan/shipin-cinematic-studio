/**
 * Enterprise Command Center Store — IMP-02 Update
 * 
 * 责任：聚合所有 Section 数据，组合 4 CEO Metrics
 * 禁止：UI State (expanded/selected/hover/modal)
 * 
 * CTO Frozen Rule: Store 只管理 Domain Data + Loading Lifecycle + Error Lifecycle
 */

import { defineStore } from 'pinia'
import type {
  EnterpriseDataEnvelope,
  MetricValue,
  Decision,
  ActionProgress,
  Signal,
  ChannelAccount,
  SyncStatus,
  Outcome,
  EvidenceGraph,
} from '~/types/enterprise-envelope'
import { SourceRegistry } from '~/types/enterprise-envelope'
import * as service from '~/services/enterprise-command-center.service'

// ─── IMP-04: Action Stage 冻结 ───
export type ActionStage = 'pending' | 'approved' | 'executing' | 'completed' | 'verified' | 'rejected'

export const useCommandCenterStore = defineStore('commandCenter', {
  state: () => ({
    // Section 1: Today Intelligence — 4 CEO Metrics
    todayMetrics: [] as EnterpriseDataEnvelope<MetricValue>[],

    // Section 2: Decision Queue
    decisionQueue: [] as EnterpriseDataEnvelope<Decision>[],
    decisionLoading: false,
    // IMP-03: Evidence (UI state for expanded evidence — tracked per decision)
    evidenceCache: {} as Record<string, EnterpriseDataEnvelope<EvidenceGraph>>,
    evidenceLoading: false,

    // Section 3: Execution Timeline
    activeActions: [] as EnterpriseDataEnvelope<ActionProgress>[],
    pendingApprovalActions: [] as EnterpriseDataEnvelope<ActionProgress>[],

    // Section 4: Business Signals
    signals: [] as EnterpriseDataEnvelope<Signal>[],

    // Section 5: Channel Health
    channelAccounts: [] as EnterpriseDataEnvelope<ChannelAccount>[],
    syncStatus: null as EnterpriseDataEnvelope<SyncStatus> | null,

    // Section 6: Outcome Snapshot
    latestOutcome: null as EnterpriseDataEnvelope<Outcome> | null,

    // Lifecycle
    loading: false,
    error: null as string | null,
  }),

  getters: {
    hasUrgentDecision: (state) =>
      state.decisionQueue.some(d => d.data.priorityLevel === 'P1' || d.data.priorityLevel === 'P2'),

    hasActiveActions: (state) => state.activeActions.length > 0,

    hasHighRiskSignal: (state) =>
      state.signals.some(s => s.data.severity === 'high'),
  },

  actions: {
    /**
     * IMP-02: 加载并组合 4 CEO Metrics
     * 
     * Events → OperationEvent (dashboard.businessMetrics.todayTasks)
     * Decisions → DecisionEngine (decisions/top count)
     * Actions → ActionLifecycle (actions/active count)
     * OutcomeΔ → OutcomeIntelligence (latest outcome)
     */
    async loadAll() {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) {
        this.error = 'No tenantId — please login'
        this.loading = false
        return
      }

      this.loading = true
      this.error = null

      try {
        // 并行加载所有 Section 数据
        const [dashboardResult, decisionResult, actionResult, signalResult, channelResult, syncResult, outcomeResult] =
          await Promise.all([
            service.getTodayMetrics(tenantId).catch(() => null),
            service.getDecisionQueue(tenantId).catch(() => []),
            service.getActiveActions(tenantId).catch(() => []),
            service.getSignals(tenantId).catch(() => []),
            service.getChannelStatus(tenantId).catch(() => []),
            service.getSyncStatus(tenantId).catch(() => null),
            service.getLatestOutcome(tenantId).catch(() => null),
          ])

        // Store raw data
        this.decisionQueue = decisionResult
        this.activeActions = actionResult
        this.signals = signalResult
        this.channelAccounts = channelResult
        this.syncStatus = syncResult
        this.latestOutcome = outcomeResult

        // IMP-02: 组合 4 CEO Metrics
        // Each metric must have: label + value + source + freshness
        const now = new Date().toISOString()
        const metrics: EnterpriseDataEnvelope<MetricValue>[] = []

        // 1. Events — from OperationEvent (dashboard)
        const eventsValue = dashboardResult?.data?.value ?? 0
        metrics.push({
          data: { value: eventsValue, label: 'Events Today' },
          source: SourceRegistry.OperationEvent,
          freshness: now,
          timestamp: now,
        })

        // 2. Decisions — from DecisionEngine (top N count)
        metrics.push({
          data: { value: decisionResult.length, label: 'Decisions' },
          source: SourceRegistry.DecisionEngine,
          freshness: now,
          timestamp: now,
        })

        // 3. Actions — from ActionLifecycle (active count)
        metrics.push({
          data: { value: actionResult.length, label: 'Actions' },
          source: SourceRegistry.ActionLifecycle,
          freshness: now,
          timestamp: now,
        })

        // 4. OutcomeΔ — from OutcomeIntelligence (latest outcome status)
        const outcomeLabel = outcomeResult?.data?.status
          ? `Outcome: ${outcomeResult.data.status}`
          : 'Outcome: —'
        metrics.push({
          data: { value: outcomeLabel, label: 'OutcomeΔ' },
          source: SourceRegistry.OutcomeIntelligence,
          freshness: outcomeResult?.freshness || now,
          timestamp: outcomeResult?.timestamp || now,
        })

        this.todayMetrics = metrics
      } catch (e: any) {
        this.error = e.message || String(e)
      } finally {
        this.loading = false
      }
    },

    async loadDecisions() {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return

      this.decisionLoading = true
      try {
        this.decisionQueue = await service.getDecisionQueue(tenantId)
      } catch (e: any) {
        this.error = e.message || String(e)
      } finally {
        this.decisionLoading = false
      }
    },

    /**
     * IMP-03: Load evidence graph for a decision
     */
    async loadEvidence(decisionId: string) {
      // Return cached if available
      if (this.evidenceCache[decisionId]) {
        return this.evidenceCache[decisionId]
      }

      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return null

      this.evidenceLoading = true
      try {
        const envelope = await service.getEvidence(tenantId, decisionId)
        this.evidenceCache[decisionId] = envelope
        return envelope
      } catch (e: any) {
        this.error = e.message || String(e)
        return null
      } finally {
        this.evidenceLoading = false
      }
    },

    /**
     * IMP-04: Approve action (Pending → Approved)
     */
    async approveAction(actionId: string) {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return

      await service.approveAction(tenantId, actionId)
      // Refresh active actions
      this.loadAll()
    },

    /**
     * IMP-04: Reject action (Pending → Rejected)
     */
    async rejectAction(actionId: string) {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return

      await service.rejectAction(tenantId, actionId)
      // Refresh active actions
      this.loadAll()
    },

    async acceptDecision(decisionId: string, note = 'Accepted via Command Center') {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return

      await service.acceptDecision(tenantId, decisionId, note)
      this.loadDecisions()
    },

    async rejectDecision(decisionId: string) {
      const authStore = useAuthStore()
      const tenantId = authStore.tenantId
      if (!tenantId) return

      await service.rejectDecision(tenantId, decisionId)
      this.loadDecisions()
    },
  },
})
