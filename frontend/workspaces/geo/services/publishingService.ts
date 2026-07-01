/**
 * GEO Publishing Service — Real API Implementation
 *
 * GET /api/v1/geo/publishing/{projectId}
 * POST /api/v1/geo/publishing/{projectId}/publish
 *
 * API Returns: { success, data: { channels, publishingStatus, currentVersion, contentOverview, history } }
 * Mapped to: PublishingData (Product Language)
 */
import { geoApi } from './api'

export interface PublishingChannel {
  id: string
  name: string
  type: 'web' | 'ai' | 'search'
  status: 'connected' | 'not_connected' | 'ready'
  lastSync: string | null
  publishable: boolean
  health: 'good' | 'unknown'
}

export interface ContentOverview {
  total: number
  claims: number
  evidences: number
  schemas: number
  faqs: number
  knowledgeObjects: number
}

export interface PublishingHistoryItem {
  id: string
  date: string
  status: string
  impact: number
}

export interface PublishingData {
  channels: PublishingChannel[]
  publishingStatus: 'published' | 'draft'
  currentVersion: string
  contentOverview: ContentOverview
  history: PublishingHistoryItem[]
  // Derived for backward compatibility
  distributionHealth: {
    activeCount: number
    totalCount: number
  }
  pendingUpdates: Array<{
    description: string
    date: string
  }>
  latestDistribution: {
    date: string
    impact: number
  } | null
}

export async function fetchPublishing(projectId: string): Promise<PublishingData> {
  const raw = await geoApi<{ success: boolean; data: any }>(`publishing/${projectId}`)
  const d = raw.data

  const channels: PublishingChannel[] = (d.channels ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    type: c.type ?? 'web',
    status: c.status ?? 'not_connected',
    lastSync: c.lastSync ?? null,
    publishable: c.publishable ?? false,
    health: c.health ?? 'unknown',
  }))

  const activeCount = channels.filter(c => c.status === 'connected' || c.status === 'ready').length

  return {
    channels,
    publishingStatus: d.publishingStatus ?? 'draft',
    currentVersion: d.currentVersion ?? 'v0.0.0',
    contentOverview: d.contentOverview ?? { total: 0, claims: 0, evidences: 0, schemas: 0, faqs: 0, knowledgeObjects: 0 },
    history: (d.history ?? []).map((h: any) => ({
      id: h.id ?? 'unknown',
      date: h.date ?? '',
      status: h.status ?? '',
      impact: h.impact ?? 0,
    })),
    // Derived for backward compatibility
    distributionHealth: { activeCount, totalCount: channels.length },
    pendingUpdates: [],
    latestDistribution: null,
  }
}

export async function publishUpdate(
  projectId: string,
): Promise<{ success: boolean; distributionId: string }> {
  const raw = await geoApi<{ success: boolean; data: any }>(`publishing/${projectId}/publish`, {
    method: 'POST',
  })
  return {
    success: raw.success ?? false,
    distributionId: raw.data?.version ?? raw.data?.id ?? `pub-${Date.now()}`,
  }
}
