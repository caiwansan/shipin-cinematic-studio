// ============================================================
// Sprint P0-B.5 — Dashboard Repository (Read-Only Aggregator)
//
// NOT a real repository — just a coordination layer that
// imports and calls existing repositories. No direct Prisma.
// ============================================================

import { presenceRepository } from '../presence/presence.repository'
import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository'
import { optimizationExecutionRepository } from '../repositories/optimization-execution.repository'
import { verificationResultRepository } from '../repositories/verification-result.repository'
import { geoProjectRepository } from '../repositories/geo-project.repository'

export interface BrandSummary {
  project: any | null
  latestSnapshot: any | null
  presenceCount: number
}

export interface PresenceSummary {
  providers: Array<{
    provider: string
    status: string
    confidence: number
    source: string
    checkedAt: string
  }>
  total: number
}

export interface VerificationSummary {
  totalRuns: number
  latestDelta: number | null
  latestIsImprovement: boolean | null
  avgDelta: number | null
  latestVerifiedAt: string | null
}

export interface ProviderStat {
  provider: string
  checkCount: number
  latestStatus: string
  latestConfidence: number
  avgConfidence: number
  lastCheckedAt: string | null
}

export interface ProviderStatistics {
  providers: ProviderStat[]
  totalChecks: number
}

export const dashboardRepository = {
  /**
   * Returns project info + latest score snapshot + presence counts.
   */
  async getBrandSummary(projectId: string): Promise<BrandSummary> {
    const project = await geoProjectRepository.findUnique({ where: { id: projectId } })

    const latestSnapshot = await geoScoreSnapshotRepository.findFirst(
      { where: { projectId } },
    )

    const presenceCount = await presenceRepository.countByProject(projectId)

    return { project, latestSnapshot, presenceCount }
  },

  /**
   * Returns latest presence evidence per provider.
   */
  async getPresenceSummary(projectId: string): Promise<PresenceSummary> {
    const records = await presenceRepository.findLatestByProject(projectId)

    // Deduplicate: keep only the latest record per provider
    const providerMap = new Map<string, any>()
    for (const record of records) {
      if (!providerMap.has(record.provider)) {
        providerMap.set(record.provider, record)
      }
    }

    const providers = Array.from(providerMap.values()).map((r) => ({
      provider: r.provider,
      status: r.status,
      confidence: r.confidence,
      source: r.source,
      checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : String(r.checkedAt),
    }))

    return { providers, total: providers.length }
  },

  /**
   * Returns total verification runs, latest delta, avg delta.
   */
  async getVerificationSummary(projectId: string): Promise<VerificationSummary> {
    const totalRuns = await verificationResultRepository.count({ projectId })

    const latestResult = await verificationResultRepository.findMany(
      { projectId },
      { orderBy: { verifiedAt: 'desc' as const }, take: 1 }
    )

    let latestDelta: number | null = null
    let latestIsImprovement: boolean | null = null
    let latestVerifiedAt: string | null = null
    if (latestResult.length > 0) {
      latestDelta = latestResult[0].deltaWhenVerified ?? null
      latestIsImprovement = latestResult[0].isImprovement ?? null
      latestVerifiedAt = latestResult[0].verifiedAt
        ? latestResult[0].verifiedAt instanceof Date
          ? latestResult[0].verifiedAt.toISOString()
          : String(latestResult[0].verifiedAt)
        : null
    }

    // Compute average delta across all verification results
    let avgDelta: number | null = null
    if (totalRuns > 0) {
      const allResults = await verificationResultRepository.findMany(
        { projectId },
        { orderBy: { verifiedAt: 'asc' as const } }
      )
      const deltas = allResults
        .map((r: any) => r.deltaWhenVerified)
        .filter((d: any) => typeof d === 'number')
      if (deltas.length > 0) {
        avgDelta = deltas.reduce((sum: number, d: number) => sum + d, 0) / deltas.length
      }
    }

    return { totalRuns, latestDelta, latestIsImprovement, avgDelta, latestVerifiedAt }
  },

  /**
   * Per-provider stats: check count, latest status, avg confidence.
   */
  async getProviderStatistics(projectId: string): Promise<ProviderStatistics> {
    const records = await presenceRepository.findLatestByProject(projectId)

    const providerStats = new Map<string, { checks: number; confidences: number[]; latestStatus: string; latestConfidence: number; lastCheckedAt: Date | null }>()

    for (const record of records) {
      const existing = providerStats.get(record.provider) || {
        checks: 0,
        confidences: [],
        latestStatus: record.status,
        latestConfidence: record.confidence,
        lastCheckedAt: record.checkedAt,
      }
      existing.checks++
      existing.confidences.push(record.confidence)
      // Since records are sorted DESC by checkedAt, the first one we see per provider is the latest
      // (map.set only happens on first encounter)
      if (!providerStats.has(record.provider)) {
        providerStats.set(record.provider, existing)
      }
    }

    const providers = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      checkCount: stats.checks,
      latestStatus: stats.latestStatus,
      latestConfidence: stats.latestConfidence,
      avgConfidence: stats.confidences.length > 0
        ? stats.confidences.reduce((sum, c) => sum + c, 0) / stats.confidences.length
        : 0,
      lastCheckedAt: stats.lastCheckedAt instanceof Date ? stats.lastCheckedAt.toISOString() : null,
    }))

    const totalChecks = records.length

    return { providers, totalChecks }
  },
}
