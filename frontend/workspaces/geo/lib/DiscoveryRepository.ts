/**
 * DiscoveryRepository — SSOT for Discovery data
 *
 * Endpoints consumed:
 *   GET /discovery/report?entity=       → DiscoveryReport
 *   GET /discovery/action-plan?entity=  → ActionPlanItem[]
 */

import { geoApi } from '../services/api'
import type { Repository, RepositoryState } from './base-repository'
import { createInitialState } from './base-repository'
import type { DiscoveryReport, ActionPlanItem } from '../services/discoveryService'

export type { DiscoveryReport, ActionPlanItem, DiscoveryOpportunity, DiscoveryScenario } from '../services/discoveryService'

interface DiscoveryCache {
  report: DiscoveryReport | null
  actionPlans: ActionPlanItem[]
}

let _instance: DiscoveryRepository | null = null
const CACHE_TTL = 60_000 // 1 minute

export function getDiscoveryRepository(): DiscoveryRepository {
  if (!_instance) {
    _instance = new DiscoveryRepository()
  }
  return _instance
}

export class DiscoveryRepository implements Repository<DiscoveryCache> {
  private state: RepositoryState<DiscoveryCache> = createInitialState()
  private _entity: string | null = null

  /** Set the active entity. Invalidates cache on change. */
  setEntity(entity: string): void {
    if (this._entity !== entity) {
      this._entity = entity
      this.invalidate()
    }
  }

  getEntity(): string | null {
    return this._entity
  }

  get(): DiscoveryCache | null {
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

  isFresh(): boolean {
    return !!(this.state.lastFetched && Date.now() - this.state.lastFetched < CACHE_TTL)
  }

  async refresh(): Promise<DiscoveryCache> {
    if (!this._entity) throw new Error('No entity set')
    if (this.state.loading && this.state.data) return this.state.data

    this.state.loading = true
    this.state.error = null

    try {
      const entity = this._entity
      const encoded = encodeURIComponent(entity)
      const [reportRaw, planRaw] = await Promise.all([
        geoApi<{ success: boolean; data: DiscoveryReport }>(
          `discovery/report?entity=${encoded}`,
        ),
        geoApi<{ success: boolean; data: { actionPlans: ActionPlanItem[] } }>(
          `discovery/action-plan?entity=${encoded}`,
        ),
      ])

      const cache: DiscoveryCache = {
        report: reportRaw?.data ?? null,
        actionPlans: planRaw?.data?.actionPlans ?? [],
      }

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

  /** Convenience: get report with auto-refresh */
  async getReport(entity: string): Promise<DiscoveryReport | null> {
    this.setEntity(entity)
    if (this.isFresh() && this.state.data?.report) return this.state.data.report
    await this.refresh()
    return this.state.data?.report ?? null
  }

  /** Convenience: get action plans with auto-refresh */
  async getActionPlans(entity: string): Promise<ActionPlanItem[]> {
    this.setEntity(entity)
    if (this.isFresh() && this.state.data?.actionPlans) return this.state.data.actionPlans
    await this.refresh()
    return this.state.data?.actionPlans ?? []
  }
}
