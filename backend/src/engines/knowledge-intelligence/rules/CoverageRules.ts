import type { RuleResult } from '../models/RuleResult'
import type { Evidence } from '../models/Evidence'

/**
 * KR-COVERAGE-001: AI scenario coverage
 * Evaluates how many AI scenarios this knowledge object covers.
 */
export function evaluateCoverageRules(
  scenarioCount: number,
  totalScenarios: number,
  evidence: Evidence[],
): RuleResult[] {
  const results: RuleResult[] = []

  const ratio = totalScenarios > 0 ? scenarioCount / totalScenarios : 0

  if (ratio >= 0.6) {
    results.push({
      ruleId: 'KR-COVERAGE-001',
      scoreDelta: 20,
      reason: 'Good AI scenario coverage',
      evidence,
      priority: 'low',
    })
  } else if (ratio >= 0.3) {
    results.push({
      ruleId: 'KR-COVERAGE-001',
      scoreDelta: 0,
      reason: 'Moderate AI scenario coverage',
      evidence,
      priority: 'medium',
    })
  } else {
    results.push({
      ruleId: 'KR-COVERAGE-001',
      scoreDelta: -15,
      reason: `Low AI scenario coverage — only ${scenarioCount}/${totalScenarios} scenarios covered`,
      evidence,
      priority: 'high',
    })
  }

  return results
}
