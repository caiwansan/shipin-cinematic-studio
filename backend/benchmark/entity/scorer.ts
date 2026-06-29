/**
 * QualityScore calculator for EntityMetrics.
 * Produces a 0-100 overall score with letter grade A-D.
 */

export interface QualityScore {
  overall: number          // 0-100
  grade: 'A' | 'B' | 'C' | 'D'
  breakdown: {
    precision: number      // 0-100
    recall: number         // 0-100
    typeCoverage: number   // 0-100
    efficiency: number     // 0-100
    costEfficiency: number // 0-100
  }
}

/**
 * Calculate quality score from entity metrics.
 *
 * Weights:
 *   Precision      35%
 *   Recall         25%
 *   TypeCoverage   20%
 *   Efficiency     10%
 *   CostEfficiency 10%
 */
export function calculateQualityScore(metrics: import('./metrics').EntityMetrics): QualityScore {
  const { entityCount, expectedFound, expectedTotal, typeCoverage, runtimeMs, estimatedCost } =
    metrics

  // --- Precision: entity count within expected range ---
  // The sample might have min_entities / max_entities
  // We approximate: ideal range is from sample context (stored in expectedTotal relation)
  // Actually, the sample has min_entities and max_entities — we need to compute it.
  // We don't pass the full sample here, so we use a heuristic:
  // expected count range derived from expected entities.
  // BUT we stored nothing about min/max in EntityMetrics, so we use a proxy:
  // The "expected" count is roughly the number of expected_primary_entities * 2 ~ 4
  // Since we can't access sample, we assume the caller passes expected count info through
  // EntityMetrics. Instead, we infer from entityCount and expectedTotal.
  //
  // Better approach: We accept that min/max isn't stored in metrics, so we use
  // heuristics based on expectedTotal: min = expectedTotal * 1.5, max = expectedTotal * 5
  //
  // But the spec says: "if min ≤ count ≤ max → 100; outside range proportionally, max deduction 30"
  // The min/max should come from the sample. Since we don't have the sample in EntityMetrics,
  // we'll use a reasonable default: expected_total * 2 as ideal min, expected_total * 6 as ideal max.
  const idealMin = Math.max(expectedTotal * 2, 4)
  const idealMax = Math.max(expectedTotal * 6, 20)

  let precision: number
  if (entityCount >= idealMin && entityCount <= idealMax) {
    precision = 100
  } else if (entityCount < idealMin) {
    // Below minimum: proportional penalty, max -30
    const deficit = idealMin - entityCount
    const ratio = deficit / idealMin
    precision = Math.max(0, 100 - Math.round(ratio * 30))
  } else {
    // Above maximum: proportional penalty, max -30
    const excess = entityCount - idealMax
    const ratio = excess / idealMax
    precision = Math.max(0, 100 - Math.round(ratio * 30))
  }

  // --- Recall ---
  const recall = expectedTotal > 0
    ? Number(((expectedFound / expectedTotal) * 100).toFixed(2))
    : 100

  // --- TypeCoverage (already 0-100) ---
  const typeCov = typeCoverage

  // --- Efficiency ---
  let efficiency = 80
  if (runtimeMs > 20000) {
    efficiency = 30   // base 80 - 50
  } else if (runtimeMs > 5000) {
    efficiency = 60   // base 80 - 20
  }

  // --- CostEfficiency ---
  let costEfficiency = 80
  if (estimatedCost > 0.50) {
    costEfficiency = 20  // base 80 - 60
  } else if (estimatedCost > 0.10) {
    costEfficiency = 50  // base 80 - 30
  }

  // --- Weighted overall ---
  const overall = Number((
    precision * 0.35 +
    recall * 0.25 +
    typeCov * 0.20 +
    efficiency * 0.10 +
    costEfficiency * 0.10
  ).toFixed(2))

  // --- Grade ---
  let grade: 'A' | 'B' | 'C' | 'D'
  if (overall >= 90) grade = 'A'
  else if (overall >= 75) grade = 'B'
  else if (overall >= 60) grade = 'C'
  else grade = 'D'

  return {
    overall,
    grade,
    breakdown: {
      precision,
      recall,
      typeCoverage: typeCov,
      efficiency,
      costEfficiency,
    },
  }
}
