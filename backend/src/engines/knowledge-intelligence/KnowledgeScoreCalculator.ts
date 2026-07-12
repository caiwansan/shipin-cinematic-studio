import type { Assessment } from './models/Assessment'

export interface QualityResult {
  score: number
  label: 'A' | 'B' | 'C'
  reason: string
}

/**
 * KnowledgeScoreCalculator
 *
 * Computes an overall Quality score from the 4 Assessment dimensions.
 */
export class KnowledgeScoreCalculator {
  calculate(assessment: Assessment): QualityResult {
    const score =
      (assessment.coverage.score +
        assessment.freshness.score +
        assessment.authority.score +
        assessment.consistency.score) /
      4

    let label: 'A' | 'B' | 'C'
    if (score >= 70) label = 'A'
    else if (score >= 40) label = 'B'
    else label = 'C'

    // Find the lowest dimension to generate a reason
    const dimensions = [
      { name: 'Coverage', score: assessment.coverage.score },
      { name: 'Freshness', score: assessment.freshness.score },
      { name: 'Authority', score: assessment.authority.score },
      { name: 'Consistency', score: assessment.consistency.score },
    ] as const

    const lowest = dimensions.reduce((min, d) => (d.score < min.score ? d : min), dimensions[0])

    const reason = `${lowest.name} is low, consider improving AI ${lowest.name.toLowerCase()} coverage`

    return {
      score: Math.round(score * 100) / 100,
      label,
      reason,
    }
  }
}
