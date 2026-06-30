import { calculateScore } from '../recommendation/recommendation-score.service'
import type { ScoreExplainability } from '../recommendation/recommendation-score.service'

export interface ScorerResult {
  overallScore: number
  dimensions: {
    visibility: { score: number; details: any[] }
    authority: { score: number; details: any[] }
    content: { score: number; details: any[] }
    website: { score: number; details: any[] }
    knowledge: { score: number; details: any[] }
  }
  rawScore: ScoreExplainability
}

/**
 * Score a project using the existing GeoScorer.
 * This is the ONLY place that calls calculateScore for verification.
 * Zero modification to GeoScorer — just call and map results.
 */
export async function scoreProject(projectId: string): Promise<ScorerResult> {
  const score = await calculateScore(projectId)

  return {
    overallScore: score.overall,
    dimensions: {
      visibility: { score: score.breakdown.visibility.score, details: score.breakdown.visibility.details || [] },
      authority: { score: score.breakdown.authority.score, details: score.breakdown.authority.details || [] },
      content: { score: score.breakdown.content.score, details: score.breakdown.content.details || [] },
      website: { score: score.breakdown.website.score, details: score.breakdown.website.details || [] },
      knowledge: { score: score.breakdown.knowledge.score, details: score.breakdown.knowledge.details || [] },
    },
    rawScore: score,
  }
}
