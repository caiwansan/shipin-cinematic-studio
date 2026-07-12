import type { RuleResult } from '../models/RuleResult'
import type { Evidence } from '../models/Evidence'
import { getClock } from '../Clock'

/**
 * KR-FRESHNESS-001: Content freshness based on days since last update
 * KR-FRESHNESS-002: Unknown last updated date penalty
 */
export function evaluateFreshnessRules(
  lastUpdated: string | null | undefined,
  evidence: Evidence[],
): RuleResult[] {
  const results: RuleResult[] = []

  if (lastUpdated == null) {
    // KR-FRESHNESS-002: No update date
    results.push({
      ruleId: 'KR-FRESHNESS-002',
      scoreDelta: -25,
      reason: 'Last updated date unknown',
      evidence,
      priority: 'high',
    })
    return results
  }

  // KR-FRESHNESS-001: Age-based freshness
  const updatedDate = new Date(lastUpdated)
  const now = getClock().now()
  const diffDays = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 30) {
    results.push({
      ruleId: 'KR-FRESHNESS-001',
      scoreDelta: 20,
      reason: 'Recently updated',
      evidence,
      priority: 'low',
    })
  } else if (diffDays <= 90) {
    results.push({
      ruleId: 'KR-FRESHNESS-001',
      scoreDelta: 0,
      reason: 'Updated within quarter',
      evidence,
      priority: 'low',
    })
  } else if (diffDays <= 180) {
    results.push({
      ruleId: 'KR-FRESHNESS-001',
      scoreDelta: -10,
      reason: 'Not updated in 3-6 months',
      evidence,
      priority: 'medium',
    })
  } else {
    results.push({
      ruleId: 'KR-FRESHNESS-001',
      scoreDelta: -20,
      reason: 'Stale — last updated > 180 days ago',
      evidence,
      priority: 'high',
    })
  }

  return results
}
