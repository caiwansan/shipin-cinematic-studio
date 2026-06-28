/**
 * Capability Analytics Builder
 *
 * 将 Coverage Index（静态）产出 + 后续动态指标汇聚为 CapabilityAnalytics。
 *
 * 当前版本只使用 Coverage Index 走通全部流程；
 * execution/negotiator/planner/runner 字段预留为 null。
 * 后续 Pipeline Metrics 挂入后自动填充。
 */

import { CapabilityRegistry } from '../capabilities/registry.js'
import { scanAllDatasets } from '../coverage/CoverageScanner.js'
import type { CoverageEntry } from '../coverage/CoverageIndex.js'
import type { CapabilityAnalytics, Health, AnalyticsSummary, AnalyticsSnapshot } from './AnalyticsTypes.js'
import { computeHealth, computeCoverageStatus } from './AnalyticsTypes.js'

export function buildAnalytics(): CapabilityAnalytics[] {
  const coverageEntries = scanAllDatasets()
  const coverageMap = new Map(coverageEntries.map(e => [e.capability, e]))

  const analytics: CapabilityAnalytics[] = []

  for (const capDef of CapabilityRegistry.all) {
    const cover = coverageMap.get(capDef.id)

    const primaryCoverage = cover?.primaryDatasets.length ?? 0
    const secondaryCoverage = cover?.secondaryDatasets.length ?? 0
    const total = primaryCoverage + secondaryCoverage
    // coverageScore: max 100 per covered capability, capped at 100 for >5 datasets
    const coverageScore = total > 0 ? Math.min(Math.round((total / 5) * 100), 100) : 0

    const status = computeCoverageStatus(primaryCoverage, secondaryCoverage)

    const health = computeHealth(coverageScore, null)

    analytics.push({
      capability: capDef.id,
      name: capDef.name,
      group: capDef.group ?? '',
      stage: capDef.stage,
      difficulty: capDef.difficulty,

      primaryCoverage,
      secondaryCoverage,
      coverageScore,
      coverageStatus: status,

      executions: null,
      successRate: null,
      averageScore: null,
      resolutionRate: null,
      confidence: null,
      confidenceVariance: null,
      plannerHitRate: null,
      averageLatency: null,
      averageTokens: null,

      health,
    })
  }

  return analytics
}

export function computeSummary(analytics: CapabilityAnalytics[]): AnalyticsSummary {
  let healthy = 0
  let weak = 0
  let critical = 0
  let totalCoverageScore = 0

  for (const a of analytics) {
    if (a.health === 'healthy') healthy++
    else if (a.health === 'weak') weak++
    else if (a.health === 'critical') critical++
    totalCoverageScore += a.coverageScore
  }

  const total = analytics.length

  return {
    total,
    healthy,
    weak,
    critical,
    healthScore: total > 0 ? Math.round((healthy / total) * 100) : 0,
    averageCoverage: total > 0 ? Math.round(totalCoverageScore / total) : 0,
  }
}

export function buildSnapshot(): AnalyticsSnapshot {
  const analytics = buildAnalytics()
  const summary = computeSummary(analytics)

  return {
    generated: new Date().toISOString(),
    registryId: 'v1',
    registryVersion: '1.0.0',
    analytics,
    summary,
    trends: [],
  }
}
