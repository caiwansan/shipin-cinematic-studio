/**
 * GEO Publishing Service — Real API Implementation
 *
 * GET /api/v1/geo/publishing/{projectId}
 * POST /api/v1/geo/publishing/{projectId}/publish
 */
import { ofetch } from 'ofetch'

export interface PublishingData {
  distributionHealth: {
    activeCount: number
    totalCount: number
  }
  channels: Array<{
    name: string
    status: 'connected' | 'pending' | 'error' | 'not-set-up'
    lastSync?: string
  }>
  pendingUpdates: Array<{
    description: string
    date: string
  }>
  latestDistribution: {
    date: string
    impact: number
  } | null
  history: Array<{
    id: string
    date: string
    status: string
    impact: number
  }>
  currentVersion: string
}

const API_BASE = '/api/v1/geo'

export async function fetchPublishing(projectId: string): Promise<PublishingData> {
  return ofetch(`${API_BASE}/publishing/${projectId}`)
}

export async function publishUpdate(
  projectId: string,
): Promise<{ success: boolean; distributionId: string }> {
  return ofetch(`${API_BASE}/publishing/${projectId}/publish`, {
    method: 'POST',
  })
}
