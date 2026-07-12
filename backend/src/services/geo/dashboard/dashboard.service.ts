// ============================================================
// Sprint P0-B.5 — Dashboard Service
//
// Aggregates data from DashboardRepository + TimelineService.
// No direct Prisma access — delegates to existing services/repos.
// ============================================================

import { dashboardRepository } from './dashboard.repository'
import { TimelineService } from '../verification/timeline.service'
import type { TimelineEvent } from '../verification/timeline.service'
import { prisma } from '../../../utils/index'

export interface ScoreStatus {
  status: 'available' | 'pending' | 'unavailable'
  reason: 'SCORED' | 'NOT_YET_SCORED' | 'UNAVAILABLE'
  message: string
  score?: number
  details?: any
  createdAt?: string
}

export interface TruthSummary {
  brand: {
    id: string
    name: string
    website: string
    industry: string
    status: string
  } | null
  score: ScoreStatus
  presence: {
    providerCount: number
    totalCheckCount: number
    providers: Array<{
      provider: string
      status: string
      confidence: number
      checkedAt: string
    }>
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
      provider: string
      checkCount: number
      latestStatus: string
      latestConfidence: number
      avgConfidence: number
      lastCheckedAt: string | null
    }>
  }
}

export class DashboardService {
  private timelineService: TimelineService

  constructor() {
    this.timelineService = new TimelineService(prisma)
  }

  /**
   * Unified Truth Summary — calls all dashboardRepository methods and
   * returns a single response.
   */
  async getTruthSummary(projectId: string): Promise<TruthSummary> {
    const [brandSummary, presenceSummary, verificationSummary, providerStats] = await Promise.all([
      dashboardRepository.getBrandSummary(projectId),
      dashboardRepository.getPresenceSummary(projectId),
      dashboardRepository.getVerificationSummary(projectId),
      dashboardRepository.getProviderStatistics(projectId),
    ])

    const project = brandSummary.project
      ? {
          id: brandSummary.project.id,
          name: brandSummary.project.name,
          website: brandSummary.project.website || '',
          industry: brandSummary.project.industry || '',
          status: brandSummary.project.status || 'draft',
        }
      : null

    const score: ScoreStatus = brandSummary.latestSnapshot
      ? {
          status: 'available',
          reason: 'SCORED',
          message: '已生成评分',
          score: brandSummary.latestSnapshot.scores?.overall ?? brandSummary.latestSnapshot.snapshot?.overall ?? 0,
          details: brandSummary.latestSnapshot.snapshot ?? null,
          createdAt: brandSummary.latestSnapshot.createdAt
            ? brandSummary.latestSnapshot.createdAt instanceof Date
              ? brandSummary.latestSnapshot.createdAt.toISOString()
              : String(brandSummary.latestSnapshot.createdAt)
            : '',
        }
      : {
          status: 'pending',
          reason: 'NOT_YET_SCORED',
          message: '完成首次 Discovery 后自动生成评分',
        }

    return {
      brand: project,
      score,
      presence: {
        providerCount: presenceSummary.total,
        totalCheckCount: providerStats.totalChecks,
        providers: presenceSummary.providers.map((p) => ({
          provider: p.provider,
          status: p.status,
          confidence: p.confidence,
          checkedAt: p.checkedAt,
        })),
      },
      verification: verificationSummary,
      providers: providerStats,
    }
  }

  /**
   * Delegates to TimelineService.getTimeline().
   */
  async getTimeline(projectId: string, limit?: number): Promise<TimelineEvent[]> {
    return this.timelineService.getTimeline(projectId, limit)
  }
}
