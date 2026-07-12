/**
 * MissionRepository — SSOT for Mission/Dashboard data
 *
 * Endpoints consumed:
 *   GET /api/geo/dashboard/mission → DashboardMission
 */

import { geoApi } from '../services/api'
import type { Repository, RepositoryState } from './base-repository'
import { createInitialState } from './base-repository'
import type { DashboardMission } from '../services/dashboardMissionService'

export type { DashboardMission }

let _instance: MissionRepository | null = null

export function getMissionRepository(): MissionRepository {
  if (!_instance) {
    _instance = new MissionRepository()
  }
  return _instance
}

export class MissionRepository implements Repository<DashboardMission> {
  private state: RepositoryState<DashboardMission> = createInitialState()

  get(): DashboardMission | null {
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

  async refresh(): Promise<DashboardMission> {
    if (this.state.loading) {
      // Return existing data if already loading
      if (this.state.data) return this.state.data
      throw new Error('Already loading')
    }

    this.state.loading = true
    this.state.error = null

    try {
      const raw = await geoApi<{ success: boolean; data: DashboardMission; error?: string }>(
        'dashboard/mission',
      )

      if (!raw.success || !raw.data) {
        throw new Error(raw.error || 'Failed to fetch mission data')
      }

      this.state.data = raw.data
      this.state.lastFetched = Date.now()
      this.state.loading = false

      return raw.data
    } catch (err: any) {
      this.state.error = err?.message || 'Unknown error'
      this.state.loading = false
      throw err
    }
  }

  /** Convenience: get mission in a single call */
  async getMission(): Promise<DashboardMission> {
    const cached = this.get()
    if (cached && this.state.lastFetched && Date.now() - this.state.lastFetched < 30_000) {
      return cached
    }
    return this.refresh()
  }
}
