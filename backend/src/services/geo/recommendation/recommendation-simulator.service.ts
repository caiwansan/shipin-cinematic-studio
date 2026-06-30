// ============================================================
// GEO Recommendation Simulator — Score Simulation Engine (v3)
// Simulates "what-if" scenarios without modifying real data
// ============================================================

import { calculateScore, ScoreVirtualOverrides, ScoreExplainability } from './recommendation-score.service.js'

export interface SimulationScenario {
  additionalKnowledge: number   // how many KOs to add
  additionalClaims: number
  additionalEvidence: number
  additionalEntities: number
  hasWebsite: boolean
  hasFAQ: boolean
  hasSchema: boolean
}

export interface SimulationBreakdown {
  visibility: { before: number; after: number }
  authority: { before: number; after: number }
  content: { before: number; after: number }
  website: { before: number; after: number }
  knowledge: { before: number; after: number }
}

export interface SimulationResult {
  currentScore: number
  simulatedScore: number
  improvement: number
  breakdown: SimulationBreakdown
  estimatedVisibilityIncrease: string
}

/**
 * Simulate a score based on a "what-if" scenario.
 * Does NOT modify actual data — all changes are virtual.
 */
export async function simulateScore(
  projectId: string,
  scenario: SimulationScenario
): Promise<SimulationResult> {
  const current = await calculateScore(projectId)

  const virtualOverrides: ScoreVirtualOverrides = {
    virtualKnowledge: scenario.additionalKnowledge,
    virtualClaims: scenario.additionalClaims,
    virtualEvidence: scenario.additionalEvidence,
    virtualEntities: scenario.additionalEntities,
    hasWebsiteOverride: scenario.hasWebsite || undefined,
    hasFAQOverride: scenario.hasFAQ || undefined,
    hasSchemaOverride: scenario.hasSchema || undefined,
  }

  const simulated = await calculateScore(projectId, virtualOverrides)

  const improvement = simulated.overall - current.overall

  // Estimate visibility increase based on score changes
  const visibilityIncrease = estimateVisibilityIncrease(
    current.breakdown.visibility.score,
    simulated.breakdown.visibility.score
  )

  return {
    currentScore: current.overall,
    simulatedScore: simulated.overall,
    improvement,
    breakdown: {
      visibility: {
        before: current.breakdown.visibility.score,
        after: simulated.breakdown.visibility.score,
      },
      authority: {
        before: current.breakdown.authority.score,
        after: simulated.breakdown.authority.score,
      },
      content: {
        before: current.breakdown.content.score,
        after: simulated.breakdown.content.score,
      },
      website: {
        before: current.breakdown.website.score,
        after: simulated.breakdown.website.score,
      },
      knowledge: {
        before: current.breakdown.knowledge.score,
        after: simulated.breakdown.knowledge.score,
      },
    },
    estimatedVisibilityIncrease: visibilityIncrease,
  }
}

/**
 * Estimate visibility increase percentage based on score improvements.
 * Uses a heuristic: each 10-point improvement ≈ +5-8% visibility.
 */
function estimateVisibilityIncrease(currentVis: number, simulatedVis: number): string {
  const diff = simulatedVis - currentVis
  if (diff <= 0) return '+0%'

  // Heuristic: 10 points = ~6% visibility boost, diminishing returns
  const pctIncrease = Math.round(diff * 0.6)
  return `+${Math.min(pctIncrease, 45)}%`
}
