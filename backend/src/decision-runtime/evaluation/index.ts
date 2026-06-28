/**
 * geometry-index.ts — P1.3 Evaluation Geometry: Barrel Export
 */

export { EVALUATION_AXES, getAxis, getAxisNames, type EvaluationAxis } from './axis-definitions.js'
export { type CandidateInfo, type CandidateVector, type ScoredEvidence, buildCandidateVector, buildAllVectors } from './candidate-vector.js'
export { type DominanceRelation, type ParetoFrontier, computeParetoFrontier, computeDominanceRelations, selectBalancedCandidate, selectMaxDistantCandidate } from './dominance-analysis.js'
export { type GeometryMetrics, computeGeometryMetrics } from './geometry-metrics.js'
export { type GeometryResult, evaluateGeometry, extractRecommendations } from './geometry-engine.js'
