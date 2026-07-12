import type { RuleResult } from './models/RuleResult'
import type { Assessment, DimensionScore } from './models/Assessment'

/**
 * KnowledgeAssessmentEngine
 *
 * Groups RuleResults by dimension (via ruleId prefix), computes DimensionScores.
 * Quality is NOT computed here — it is handled by KnowledgeScoreCalculator.
 */
export class KnowledgeAssessmentEngine {
  assess(ruleResults: RuleResult[]): Assessment {
    const coverageResults = ruleResults.filter((r) => r.ruleId.startsWith('KR-COVERAGE'))
    const freshnessResults = ruleResults.filter((r) => r.ruleId.startsWith('KR-FRESHNESS'))
    const authorityResults = ruleResults.filter((r) => r.ruleId.startsWith('KR-AUTHORITY'))
    const consistencyResults = ruleResults.filter((r) => r.ruleId.startsWith('KR-CONSISTENCY'))

    return {
      version: '1.0',
      coverage: this.buildDimensionScore(coverageResults),
      freshness: this.buildDimensionScore(freshnessResults),
      authority: this.buildDimensionScore(authorityResults),
      consistency: this.buildDimensionScore(consistencyResults),
    }
  }

  private buildDimensionScore(ruleResults: RuleResult[]): DimensionScore {
    const totalDelta = ruleResults.reduce((sum, r) => sum + r.scoreDelta, 0)
    const score = Math.min(100, Math.max(0, 100 + totalDelta))

    let label: string
    if (score >= 70) label = 'A'
    else if (score >= 40) label = 'B'
    else label = 'C'

    const reason = ruleResults.map((r) => r.reason).join('; ')

    return {
      score,
      label,
      reason,
      ruleResults,
    }
  }
}
