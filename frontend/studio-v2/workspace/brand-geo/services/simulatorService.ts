// ============================================================
// Simulator Service v3 — GEO Recommendation Simulator
// Calls backend simulation endpoint via GEOApiClient
// ============================================================

import { client } from '../clients/GEOApiClient'

// ── Types ──

export interface SimulationScenario {
  additionalKnowledge: number
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
 * POST /api/geo/recommendation/simulate
 * Run a "what-if" simulation
 */
export async function simulateScore(
  projectId: string,
  scenario: SimulationScenario
): Promise<SimulationResult> {
  const res = await client.post('/recommendation/simulate', { projectId, scenario })
  return res.data?.data
}
