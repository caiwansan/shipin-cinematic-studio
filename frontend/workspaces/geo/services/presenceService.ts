/**
 * GEO Presence Service — AI 可见度分析
 *
 * GET /api/geo/brands/:id/presence
 *
 * Provides the data layer for the Presence section in BrandOverview.vue.
 * All data comes from the PresenceEngine via real backend endpoints.
 */
import { geoApi } from './api'

export interface PresenceOverall {
  score: number
  visibilityCount: number
  totalChecked: number
  averageKnowledge: number
}

export interface PresenceProvider {
  provider: string
  name: string
  group: string
  visibility: 'visible' | 'partial' | 'missing' | 'checking' | 'unknown'
  evidenceLevel: string
  confidence: number
  knowledgeQuality?: number
  evidenceCount: number
  summary: string
  recommendations: string[]
}

export interface PlatformGroups {
  international: string[]
  china: string[]
}

export interface PresenceData {
  overall: PresenceOverall
  providers: PresenceProvider[]
  platformGroups: PlatformGroups
  checkedAt: string
}

export async function fetchPresence(projectId: string): Promise<PresenceData> {
  const raw = await geoApi<{ success: boolean; data: PresenceData; error?: string }>(
    `brands/${projectId}/presence`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取 AI 可见度数据失败')
  }
  return raw.data
}
