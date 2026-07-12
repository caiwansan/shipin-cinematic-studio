import type { RuleResult } from '../models/RuleResult'
import type { Evidence } from '../models/Evidence'

/**
 * KR-CITATION-001: Citation attribution count
 * KR-CITATION-002: Authoritative source citations
 */
export function evaluateCitationRules(
  citationCount: number,
  authoritativeCount: number,
  evidence: Evidence[],
): RuleResult[] {
  const results: RuleResult[] = []

  // KR-CITATION-001: Citation count
  if (citationCount >= 3) {
    results.push({
      ruleId: 'KR-CITATION-001',
      scoreDelta: 15,
      reason: 'Sufficient citations',
      evidence,
      priority: 'low',
    })
  } else if (citationCount >= 1) {
    results.push({
      ruleId: 'KR-CITATION-001',
      scoreDelta: 0,
      reason: 'Has citations but could use more',
      evidence,
      priority: 'medium',
    })
  } else {
    results.push({
      ruleId: 'KR-CITATION-001',
      scoreDelta: -20,
      reason: 'No citations detected',
      evidence,
      priority: 'high',
    })
  }

  // KR-CITATION-002: Authoritative citations
  if (authoritativeCount >= 1) {
    results.push({
      ruleId: 'KR-CITATION-002',
      scoreDelta: 15,
      reason: 'Includes authoritative source citations',
      evidence,
      priority: 'medium',
    })
  } else {
    results.push({
      ruleId: 'KR-CITATION-002',
      scoreDelta: 0,
      reason: 'No authoritative citations',
      evidence,
      priority: 'low',
    })
  }

  return results
}
