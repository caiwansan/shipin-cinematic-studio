import type { RuleResult } from '../models/RuleResult'
import type { Evidence } from '../models/Evidence'

/**
 * KR-CONSISTENCY-001: Entity consistency across statements
 * Evaluates contradictions in entity references.
 */
export function evaluateConsistencyRules(
  entityMentions: number,
  contradictions: number,
  evidence: Evidence[],
): RuleResult[] {
  const results: RuleResult[] = []

  if (contradictions === 0 && entityMentions > 3) {
    results.push({
      ruleId: 'KR-CONSISTENCY-001',
      scoreDelta: 20,
      reason: 'High entity consistency across statements',
      evidence,
      priority: 'low',
    })
  } else if (contradictions === 0) {
    results.push({
      ruleId: 'KR-CONSISTENCY-001',
      scoreDelta: 10,
      reason: 'No contradictions detected',
      evidence,
      priority: 'low',
    })
  } else {
    results.push({
      ruleId: 'KR-CONSISTENCY-001',
      scoreDelta: -20,
      reason: `Contains ${contradictions} conflicting statement(s)`,
      evidence,
      priority: 'high',
    })
  }

  return results
}
