/**
 * DashboardRepository — SSOT for per-project Dashboard data
 *
 * Uses aggregate endpoint:
 *   GET /projects/:projectId/dashboard   → { project, discoveryReport, actionPlan, verificationReport }
 *
 * Internal DTO mapping translates aggregate response into typed cache fields.
 * No UI changes required — external interface (types + methods) preserved.
 */

import { geoApi } from '../services/api'
import type { Repository, RepositoryState } from './base-repository'
import { createInitialState } from './base-repository'
import type {
  TruthSummary,
  PresenceItem,
  ProviderStat,
  TimelineEvent,
} from '../services/dashboardService'

export type { TruthSummary, PresenceItem, ProviderStat, TimelineEvent }

export interface DashboardCache {
  truth: TruthSummary | null
  presence: PresenceItem[]
  providers: ProviderStat[]
  timeline: TimelineEvent[]
}

let _instance: DashboardRepository | null = null

export function getDashboardRepository(): DashboardRepository {
  if (!_instance) {
    _instance = new DashboardRepository()
  }
  return _instance
}

export class DashboardRepository implements Repository<DashboardCache> {
  private state: RepositoryState<DashboardCache> = createInitialState()
  private _projectId: string | null = null

  setProjectId(id: string): void {
    if (this._projectId !== id) {
      this._projectId = id
      this.invalidate()
    }
  }

  getProjectId(): string | null {
    return this._projectId
  }

  get(): DashboardCache | null {
    return this.state.data
  }

  isLoading(): boolean {
    return this.state.loading
  }

  getError(): string | null {
    return this.state.error
  }

  invalidate(): void {
    this.state = createInitialState()
  }

  async refresh(): Promise<DashboardCache> {
    if (!this._projectId) throw new Error('No project ID set')
    if (this.state.loading && this.state.data) return this.state.data

    this.state.loading = true
    this.state.error = null

    try {
      const pid = this._projectId
      // Single aggregate endpoint — canonical contract
      const raw = await geoApi<{ success: boolean; data: any; error?: string }>(
        `projects/${pid}/dashboard`,
      )

      const d = raw.data
      const project = d?.project ?? {}
      const discoveryReport = d?.discoveryReport ?? null
      const actionPlan = d?.actionPlan ?? null
      const verificationReport = d?.verificationReport ?? null

      // Map aggregate response → typed cache fields
      const cache: DashboardCache = this._mapAggregate(
        project, discoveryReport, actionPlan, verificationReport,
      )

      this.state.data = cache
      this.state.lastFetched = Date.now()
      this.state.loading = false

      return cache
    } catch (err: any) {
      this.state.error = err?.message || 'Unknown error'
      this.state.loading = false
      throw err
    }
  }

  /** Convenience getters (backward compatible, all share a single cache) */

  async getTruth(projectId: string): Promise<TruthSummary | null> {
    this.setProjectId(projectId)
    const cached = this.state.data?.truth
    if (cached && this.state.lastFetched && Date.now() - this.state.lastFetched < 30_000) return cached
    await this.refresh()
    return this.state.data?.truth ?? null
  }

  async getPresence(projectId: string): Promise<PresenceItem[]> {
    this.setProjectId(projectId)
    const cached = this.state.data?.presence
    if (cached && this.state.lastFetched && Date.now() - this.state.lastFetched < 30_000) return cached
    await this.refresh()
    return this.state.data?.presence ?? []
  }

  async getProviders(projectId: string): Promise<ProviderStat[]> {
    this.setProjectId(projectId)
    const cached = this.state.data?.providers
    if (cached && this.state.lastFetched && Date.now() - this.state.lastFetched < 30_000) return cached
    await this.refresh()
    return this.state.data?.providers ?? []
  }

  async getTimeline(projectId: string, _limit?: number): Promise<TimelineEvent[]> {
    this.setProjectId(projectId)
    const cached = this.state.data?.timeline
    if (cached && this.state.lastFetched && Date.now() - this.state.lastFetched < 30_000) return cached
    await this.refresh()
    return this.state.data?.timeline ?? []
  }

  // ── Private mapping ──

  private _mapAggregate(project: any, _discoveryReport: any, _actionPlan: any, verificationReport: any): DashboardCache {
    return {
      truth: this._mapTruth(project, verificationReport),
      presence: this._mapPresence(project),
      providers: this._mapProviders(project),
      timeline: this._mapTimeline(project, verificationReport),
    }
  }

  private _mapTruth(project: any, verificationReport: any): TruthSummary | null {
    if (!project) return null
    return {
      truthScore: project.score ?? project.adi ?? 0,
      verificationStatus:
        verificationReport?.latestIsImprovement === true ? 'verified'
        : verificationReport?.latestIsImprovement === false ? 'failed'
        : 'pending',
      evidenceCount: project.entityCount ?? project.evidenceCount ?? 0,
      claimCount: project.claimCount ?? 0,
      lastVerified: verificationReport?.latestVerifiedAt ?? project.updatedAt ?? '',
    }
  }

  private _mapPresence(project: any): PresenceItem[] {
    if (!project?.presenceProviders) return []
    return project.presenceProviders.map((p: any) => ({
      id: p.provider ?? p.name ?? p.id ?? '',
      title: p.displayName ?? p.name ?? p.provider ?? '',
      source: p.provider ?? '',
      status: p.latestStatus ?? p.status ?? 'UNKNOWN',
      createdAt: p.lastCheckedAt ?? project.updatedAt ?? '',
    }))
  }

  private _mapProviders(project: any): ProviderStat[] {
    if (!project?.presenceProviders) return []
    return project.presenceProviders.map((p: any) => ({
      provider: p.provider ?? '',
      displayName: p.displayName ?? p.provider ?? '',
      checkCount: p.checkCount ?? 0,
      latestStatus: (p.latestStatus ?? 'UNKNOWN') as 'FOUND' | 'NOT_FOUND' | 'UNKNOWN' | 'ERROR',
      avgConfidence: p.avgConfidence ?? p.confidence ?? 0,
    }))
  }

  private _mapTimeline(project: any, verificationReport: any): TimelineEvent[] {
    const events: TimelineEvent[] = []

    // Add verification events if available
    if (verificationReport?.history) {
      for (const h of verificationReport.history) {
        events.push({
          id: h.id ?? `v-${events.length}`,
          date: h.createdAt ?? h.date ?? project.updatedAt ?? '',
          type: 'verification',
          title: h.title ?? `验证 #${events.length + 1}`,
          description: h.description ?? '',
          status: h.status ?? 'completed',
        })
      }
    }

    // Fallback: project timeline
    if (events.length === 0 && project.updatedAt) {
      events.push({
        id: 'project-created',
        date: project.createdAt ?? project.updatedAt,
        type: 'presence_check',
        title: '品牌注册',
        description: `项目 ${project.name ?? ''} 已创建`,
        status: 'completed',
      })
    }

    return events
  }
}
