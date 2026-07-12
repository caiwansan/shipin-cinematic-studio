/**
 * Mission Store — Pinia Store for Mission Workspace Page
 *
 * Manages missions, summary, loading/error states.
 * All data comes from the real API via missionService.fetchMissions().
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchMissionWorkspace } from '../services/missionService'
import type { Mission, MissionSummary } from '../types/mission'

export const useMissionStore = defineStore('geo-mission', () => {
  // ── State ──────────────────────────────────────────
  const missions = ref<Mission[]>([])
  const summary = ref<MissionSummary>({ total: 0, p0: 0, p1: 0, p2: 0, p3: 0 })
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────
  /** Missions with P0 priority */
  const p0Missions = computed(() => missions.value.filter(m => m.priority === 'P0'))

  /** Whether there are any missions to display */
  const hasMissions = computed(() => missions.value.length > 0)

  // ── Actions ────────────────────────────────────────
  /**
   * Load missions from the real API.
   * Sets loading/error state appropriately.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await fetchMissionWorkspace()
      missions.value = data.missions
      summary.value = data.summary
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load missions'
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    missions,
    summary,
    loading,
    error,
    // Computed
    p0Missions,
    hasMissions,
    // Actions
    load,
  }
})
