/**
 * GEO Publishing Store — Pinia Store
 *
 * Manages publishing state: distribution health, channels, pending updates, history.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchPublishing, publishUpdate } from '../services/publishingService'
import type {
  PublishingData,
  PublishingChannel,
  ContentOverview,
  PublishingHistoryItem,
} from '../services/publishingService'

export interface PublishingStatus {
  status: 'idle' | 'running' | 'success' | 'error'
  errorMessage: string | null
}

export const usePublishingStore = defineStore('geo-publishing', () => {
  const channels = ref<PublishingChannel[]>([])
  const publishingStatus = ref<'published' | 'draft'>('draft')
  const currentVersion = ref<string>('')
  const contentOverview = ref<ContentOverview>({ total: 0, claims: 0, evidences: 0, schemas: 0, faqs: 0, knowledgeObjects: 0 })
  const history = ref<PublishingHistoryItem[]>([])

  // Backward compatible derived fields
  const distributionHealth = computed(() => {
    const activeCount = channels.value.filter(c => c.status === 'connected' || c.status === 'ready').length
    return { activeCount, totalCount: channels.value.length }
  })
  const pendingUpdates = ref<Array<{ description: string; date: string }>>([])
  const latestDistribution = ref<{ date: string; impact: number } | null>(null)

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const publishStatus = ref<PublishingStatus>({ status: 'idle', errorMessage: null })
  const projectId = ref<string>('default')

  const hasData = computed(() => channels.value.length > 0)
  const pendingCount = computed(() => pendingUpdates.value.length)
  const activeChannelCount = computed(() => channels.value.filter(c => c.status === 'connected' || c.status === 'ready').length)
  const hasPendingUpdates = computed(() => pendingCount.value > 0)

  async function fetchPubData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchPublishing(projectId.value)
      channels.value = data.channels
      publishingStatus.value = data.publishingStatus
      currentVersion.value = data.currentVersion
      contentOverview.value = data.contentOverview
      history.value = data.history
      pendingUpdates.value = data.pendingUpdates
      latestDistribution.value = data.latestDistribution
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
    channels, publishingStatus, currentVersion, contentOverview, history,
    distributionHealth, pendingUpdates, latestDistribution,
    isLoading, error, publishStatus, projectId,
    hasData, pendingCount, activeChannelCount, hasPendingUpdates,
    fetchPublishing: fetchPubData, publish, setProject,
  }
})
