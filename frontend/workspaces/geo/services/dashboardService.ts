/**
 * GEO Dashboard Service
 *
 * Data sources from the centralised Dashboard endpoint (port 4002):
 *   GET /api/geo/dashboard/:id/truth       — unified truth summary
 *   GET /api/geo/dashboard/:id/presence     — presence evidence
 *   GET /api/geo/dashboard/:id/providers    — provider statistics
 *   GET /api/geo/dashboard/:id/timeline     — timeline (presence + verification events)
 *
 * Pattern: all methods return parsed data or throw on error.
 */
import { geoApi } from './api'

export interface TruthSummary {
  truthScore: number
  verificationStatus: 'verified' | 'pending' | 'failed'
  evidenceCount: number
  claimCount: number
  lastVerified: string
}

export interface PresenceItem {
  id: string
  title: string
  source: string
  status: string
  createdAt?: string
}

export interface ProviderStat {
  provider: string
  displayName: string
  checkCount: number
  latestStatus: 'FOUND' | 'NOT_FOUND' | 'UNKNOWN' | 'ERROR'
  avgConfidence: number
}

export interface TimelineEvent {
  id: string
  date: string
  type: 'presence_check' | 'verification' | 'claim' | 'evidence'
  title: string
  description?: string
  source?: string
  status?: string
  metadata?: Record<string, any>
}

/**
 * Raw shape returned by backend /dashboard/:id/truth.
 */
interface BackendScoreStatus {
  status: 'available' | 'pending' | 'unavailable'
  reason: 'SCORED' | 'NOT_YET_SCORED' | 'UNAVAILABLE'
  message: string
  score?: number
  details?: any
  createdAt?: string
}

interface BackendTruthSummary {
  brand: {
    id: string; name: string; website: string; industry: string; status: string
  } | null
  score: BackendScoreStatus
  presence: {
    providerCount: number
    totalCheckCount: number
    providers: Array<{ provider: string; status: string; confidence: number; checkedAt: string }>
  }
  verification: {
    totalRuns: number
    latestDelta: number | null
    latestIsImprovement: boolean | null
    avgDelta: number | null
    latestVerifiedAt: string | null
  }
  providers: {
    totalChecks: number
    providers: Array<{
      provider: string; checkCount: number; latestStatus: string
      latestConfidence: number; avgConfidence: number; lastCheckedAt: string | null
    }>
  }
}

/**
 * Fetch unified truth summary for a project.
 * Maps backend shape → frontend TruthSummary interface.
 */
export async function getTruthSummary(projectId: string): Promise<TruthSummary> {
  const raw = await geoApi<{ success: boolean; data: BackendTruthSummary; error?: string }>(
    `dashboard/${projectId}/truth`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取 Truth Summary 失败')
  }
  const d = raw.data
  return {
    truthScore: d.score?.status === 'available' ? (d.score.score ?? 0) : 0,
    verificationStatus: d.verification.latestIsImprovement === true ? 'verified'
      : d.verification.latestIsImprovement === false ? 'failed'
      : 'pending',
    evidenceCount: d.presence.providers.length,
    claimCount: d.presence.providerCount,
    lastVerified: d.verification.latestVerifiedAt ?? (d.score?.status === 'available' ? (d.score.createdAt ?? '') : ''),
  }
}

/**
 * Fetch presence evidence detail for a project.
 */
export async function getPresenceDetail(projectId: string): Promise<PresenceItem[]> {
  const raw = await geoApi<{ success: boolean; data: PresenceItem[]; error?: string }>(
    `dashboard/${projectId}/presence`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取 Presence 详情失败')
  }
  return raw.data
}

/**
 * Fetch provider statistics for a project.
 */
export async function getProviderStats(projectId: string): Promise<ProviderStat[]> {
  const raw = await geoApi<{ success: boolean; data: ProviderStat[]; error?: string }>(
    `dashboard/${projectId}/providers`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取 Provider 统计失败')
  }
  return raw.data
}

/**
 * Fetch timeline events (presence checks + verification events) for a project.
 * @param limit  Optional limit on number of events returned.
 */
export async function getTimelineEvents(
  projectId: string,
  limit?: number
): Promise<TimelineEvent[]> {
  const query = limit ? `?limit=${limit}` : ''
  const raw = await geoApi<{ success: boolean; data: TimelineEvent[]; error?: string }>(
    `dashboard/${projectId}/timeline${query}`
  )
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || '获取 Timeline 失败')
  }
  return raw.data
}
