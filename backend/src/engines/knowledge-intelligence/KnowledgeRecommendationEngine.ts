import type { Assessment } from './models/Assessment'

export interface Recommendation {
  priority: 'High' | 'Medium' | 'Low'
  expectedBenefit: string
  estimatedImpact: string
  reason: string
}

/**
 * KnowledgeRecommendationEngine
 *
 * Generates a recommendation based on the lowest-scoring dimension.
 */
export class KnowledgeRecommendationEngine {
  generate(assessment: Assessment): Recommendation {
    const dimensions = [
      { name: 'coverage', score: assessment.coverage.score } as const,
      { name: 'freshness', score: assessment.freshness.score } as const,
      { name: 'authority', score: assessment.authority.score } as const,
      { name: 'consistency', score: assessment.consistency.score } as const,
    ]

    const lowest = dimensions.reduce((min, d) => (d.score < min.score ? d : min), dimensions[0])

    switch (lowest.name) {
      case 'coverage':
        return {
          priority: 'High',
          expectedBenefit: 'Increase AI citation coverage',
          estimatedImpact: '+12%',
          reason: 'Low coverage limits AI scenario matching',
        }
      case 'freshness':
        return {
          priority: 'High',
          expectedBenefit: 'Improve freshness score',
          estimatedImpact: '+8%',
          reason: 'Stale content may reduce search ranking',
        }
      case 'authority':
        return {
          priority: 'Medium',
          expectedBenefit: 'Strengthen source authority',
          estimatedImpact: '+5%',
          reason: 'Authoritative sources increase citation trust',
        }
      case 'consistency':
        return {
          priority: 'Medium',
          expectedBenefit: 'Resolve content contradictions',
          estimatedImpact: '+3%',
          reason: 'Inconsistent entity references reduce AI comprehension',
        }
    }
  }
}
