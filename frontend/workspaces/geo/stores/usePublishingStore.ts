/**
 * GEO Publishing Store — Pinia Store
 *
 * Manages publishing state: distribution health, channels, pending updates, history.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchPublishing, publishUpdate } from '../services/publishingService'
import type { PublishingData } from '../services/publishingService'

export interface PublishingStatus {
  status: 'idle' | 'running' | 'success' | 'error'
  errorMessage: string | null
}

export const usePublishingStore = defineStore('geo-publishing', () => {
  const distributionHealth = ref<PublishingData['distributionHealth'] | null>(null)
  const channels = ref<PublishingData['channels']>([])
  const pendingUpdates = ref<PublishingData['pendingUpdates']>([])
  const latestDistribution = ref<PublishingData['latestDistribution']>(null)
  const history = ref<PublishingData['history']>([])
  const currentVersion = ref<string>('')
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const publishStatus = ref<PublishingStatus>({ status: 'idle', errorMessage: null })
  const projectId = ref<string>('default')

  const hasData = computed(() => distributionHealth.value !== null)
  const pendingCount = computed(() => pendingUpdates.value.length)
  const activeChannelCount = computed(() => channels.value.filter(c => c.status === 'connected').length)
  const hasPendingUpdates = computed(() => pendingCount.value > 0)

  async function fetchPubData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchPublishing(projectId.value)
      distributionHealth.value = data.distributionHealth
      channels.value = data.channels
      pendingUpdates.value = data.pendingUpdates
      latestDistribution.value = data.latestDistribution
      history.value = data.history
      currentVersion.value = data.currentVersion
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load publishing data'
    } finally {
      isLoading.value = false
    }
  }

  async function publish(): Promise<void> {
    publishStatus.value = { status: 'running', errorMessage: null }
    try {
      const result = await publishUpdate(projectId.value)
      publishStatus.value = { status: 'success', errorMessage: null }
      await fetchPubData()
    } catch (err) {
      publishStatus.value = {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Publish failed',
      }
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    distributionHealth, channels, pendingUpdates, latestDistribution,
    history, currentVersion, isLoading, error, publishStatus, projectId,
    hasData, pendingCount, activeChannelCount, hasPendingUpdates,
    fetchPublishing: fetchPubData, publish, setProject,
  }
})
