/**
 * GEO Publishing Service — Real API Implementation
 *
 * Calls:
 *   GET /api/geo/publish/summary/:projectId   — 发布摘要
 *   GET /api/geo/publish/plans/:projectId     — 计划列表
 *   GET /api/geo/publish/claims/:projectId    — claim 列表
 *
 * Maps backend response → frontend PublishingData
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
  distributionHealth: { activeCount: number; totalCount: number }
  pendingUpdates: Array<{ description: string; date: string }>
  latestDistribution: { date: string; impact: number } | null
}

export async function fetchPublishing(projectId: string): Promise<PublishingData> {
  // Fetch summary + plans + claims in parallel
  const [summaryRes, plansRes, claimsRes] = await Promise.allSettled([
    geoApi<{ success: boolean; data: any }>(`publish/summary/${projectId}`),
    geoApi<{ success: boolean; data: any[] }>(`publish/plans/${projectId}`),
    geoApi<{ success: boolean; data: any[] }>(`publish/claims/${projectId}`),
  ])

  const summary = summaryRes.status === 'fulfilled' ? summaryRes.value.data : {}
  const plans = plansRes.status === 'fulfilled' ? plansRes.value.data ?? [] : []
  const claims = claimsRes.status === 'fulfilled' ? claimsRes.value.data ?? [] : []

  // Build channels from summary + plans
  const channelNames = new Set<string>()
  plans.forEach((p: any) => (p.targetChannels ?? []).forEach((ch: string) => channelNames.add(ch)))
  const targetChannels = Array.from(channelNames)

  const channels: PublishingChannel[] = targetChannels.map((name, i) => ({
    id: `ch-${i}`,
    name,
    type: name === 'markdown' ? 'web' : name === 'schema' ? 'ai' : 'search' as any,
    status: 'connected',
    lastSync: null,
    publishable: true,
    health: 'good',
  }))

  const activeCount = channels.filter(c => c.status === 'connected' || c.status === 'ready').length
  const totalPublished = summary?.totalPublished ?? summary?.totalPlans ?? plans.length

  return {
    channels,
    publishingStatus: totalPublished > 0 ? 'published' : 'draft',
    currentVersion: summary?.currentVersion ?? `v${totalPublished}.0.0`,
    contentOverview: {
      total: (claims.length) || totalPublished || 0,
      claims: claims.length || 0,
      evidences: summary?.totalEvidences ?? 0,
      schemas: summary?.totalSchemas ?? 0,
      faqs: 0,
      knowledgeObjects: 0,
    },
    history: plans.map((p: any) => ({
      id: p.id ?? `plan-${Date.now()}`,
      date: p.createdAt ?? p.updatedAt ?? '',
      status: p.status ?? 'draft',
      impact: p.impact ?? p.expectedImpact ?? 0,
    })),
    distributionHealth: { activeCount, totalCount: Math.max(channels.length, 1) },
    pendingUpdates: [],
    latestDistribution: null,
  }
}

export async function publishUpdate(
  projectId: string,
): Promise<{ success: boolean; distributionId: string }> {
  try {
    // First create a plan if needed, then publish
    const claimsRes = await geoApi<{ success: boolean; data: any[] }>(`publish/claims/${projectId}`)
    const claims = claimsRes.data ?? []

    if (claims.length === 0) {
      return { success: false, distributionId: '' }
    }

    // Create plan with all claims
    const planRes = await geoApi<{ success: boolean; data: any }>('publish/plan', {
      method: 'POST',
      body: {
        projectId,
        title: `Publish ${new Date().toISOString().slice(0, 10)}`,
        claimIds: claims.map(c => c.id),
        targetChannels: ['markdown'],
      },
    })

    const planId = planRes.data?.id
    if (!planId) return { success: false, distributionId: '' }

    // Publish the plan
    await geoApi(`publish/plan/${planId}/publish`, { method: 'POST' })
    return { success: true, distributionId: planId }
  } catch {
    return { success: false, distributionId: '' }
  }
}
