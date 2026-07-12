import type { RuleResult } from '../models/RuleResult'
import type { Evidence } from '../models/Evidence'

/**
 * KR-AUTHORITY-001: Source type authority
 * Evaluates whether the knowledge object's sources include authoritative references.
 */
export function evaluateAuthorityRules(
  sourceTypes: string[],
  evidence: Evidence[],
): RuleResult[] {
  const results: RuleResult[] = []

  const hasAuthoritative = sourceTypes.some(
    (s) => s.includes('official') || s.includes('government') || s.includes('academic'),
  )
  const hasReference = sourceTypes.some(
    (s) => s.includes('wikipedia') || s.includes('encyclopedia'),
  )

  if (hasAuthoritative) {
    results.push({
      ruleId: 'KR-AUTHORITY-001',
      scoreDelta: 15,
      reason: 'Sources include authoritative references',
      evidence,
      priority: 'low',
    })
  } else if (hasReference) {
    results.push({
      ruleId: 'KR-AUTHORITY-001',
      scoreDelta: 5,
      reason: 'Sources include reference materials',
      evidence,
      priority: 'medium',
    })
  } else {
    results.push({
      ruleId: 'KR-AUTHORITY-001',
      scoreDelta: -10,
      reason: 'No authoritative or reference sources cited',
      evidence,
      priority: 'high',
    })
  }

  return results
}
