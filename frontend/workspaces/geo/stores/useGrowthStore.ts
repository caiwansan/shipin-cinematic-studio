/**
 * GEO Growth Store — Pinia Store
 *
 * Manages growth/progress data: direction, sources, learnings, milestones.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchGrowth } from '../services/growthService'
import type { GrowthData } from '../services/growthService'

export const useGrowthStore = defineStore('geo-growth', () => {
  const direction = ref<GrowthData['direction'] | null>(null)
  const sources = ref<GrowthData['sources']>([])
  const learnings = ref<GrowthData['learnings']>([])
  const opportunity = ref<GrowthData['opportunity']>(null)
  const milestones = ref<GrowthData['milestones']>([])
  const trendPoints = ref<GrowthData['trendPoints']>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => direction.value !== null)
  const hasMilestones = computed(() => milestones.value.length > 0)
  const hasOpportunity = computed(() => opportunity.value !== null)

  async function fetchGrowthData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchGrowth(projectId.value)
      direction.value = data.direction
      sources.value = data.sources
      learnings.value = data.learnings
      opportunity.value = data.opportunity
      milestones.value = data.milestones
      trendPoints.value = data.trendPoints
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load growth data'
    } finally {
      isLoading.value = false
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    direction, sources, learnings, opportunity, milestones, trendPoints,
    isLoading, error, projectId,
    hasData, hasMilestones, hasOpportunity,
    fetchGrowth: fetchGrowthData, setProject,
  }
})
