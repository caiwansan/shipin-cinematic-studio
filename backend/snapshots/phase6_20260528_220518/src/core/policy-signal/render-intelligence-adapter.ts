/**
 * Render-Intelligence → PolicySignal Adapter — Phase 1B
 *
 * Converts RouteDecision (render-intelligence output) into standardized PolicySignal.
 * Pure transformation: no decision logic, no execution, no side effects.
 * Does NOT modify render-intelligence internals.
 *
 * Observability-only fields:
 * - confidence_detail: decomposes raw vs boosted confidence
 * - effective_weights: accounts for normalization factors
 * - meta.decision_path: traces how the decision was arrived at
 *
 * Input:  RouteDecision (from renderIntelligence.decide())
 *         + original constraints + prompt context
 * Output: PolicySignal (standardized decision signal)
 */

import {
  createPolicySignal,
  type PolicySignal,
  type PolicySignalEffectiveWeights,
} from './policy-signal.types.js'
import type { RouteDecision, RoutingConstraints } from '../../production-loop/render-intelligence.js'
import { costLearner } from '../../production-loop/cost-learner.js'

export interface AdapterInput {
  decision: RouteDecision
  constraints?: RoutingConstraints
  prompt_duration?: number
  /** Override: whether the confidence was boosted by "clear winner" heuristic */
  confidence_boosted?: boolean
  /** Override: raw confidence before any boost */
  confidence_raw?: number
}

/**
 * Compute effective weights — actual contribution of each factor considering norm ceilings.
 *
 * render-intelligence normalization:
 *   qScore = qualityScore / 10
 *   speedScore = 1 - min(latency / 120000, 1)
 *   costScore = 1 - min(cost / 1, 1)
 *
 * Effective weight = (normalizedScore × declaredWeight) / sum(all normalizedScores × declaredWeight)
 */
function computeEffectiveWeights(
  qualityScore: number,  // 1-10
  latencyMs: number,
  costUsd: number,
  declaredWeights: { quality: number; latency: number; cost: number },
): PolicySignalEffectiveWeights {
  const qNorm = Math.max(0, Math.min(1, qualityScore / 10))
  const sNorm = 1 - Math.min(latencyMs / 120000, 1)
  const cNorm = 1 - Math.min(costUsd / 1, 1)

  const total =
    qNorm * declaredWeights.quality +
    sNorm * declaredWeights.latency +
    cNorm * declaredWeights.cost

  if (total === 0) {
    return { ...declaredWeights }
  }

  return {
    quality: +(qNorm * declaredWeights.quality / total).toFixed(4),
    latency: +(sNorm * declaredWeights.latency / total).toFixed(4),
    cost: +(cNorm * declaredWeights.cost / total).toFixed(4),
  }
}

/**
 * Detect decision path from reason string and constraint context.
 */
function detectDecisionPath(
  decision: RouteDecision,
  constraints?: RoutingConstraints,
): 'normal' | 'fallback' | 'forced' | 'preferred' {
  const reason = decision.reason?.toLowerCase() || ''
  if (reason.includes('fallback') || reason.includes('falling back')) return 'fallback'
  if (constraints?.forceProvider) return 'forced'
  if (constraints?.preferredProvider) return 'preferred'
  return 'normal'
}

/**
 * Detect if confidence was boosted by "clear winner" heuristic.
 * render-intelligence boosts: +0.1 if no other candidate scores > 0.8.
 */
function detectConfidenceBoost(decision: RouteDecision): { raw: number; boosted: boolean } {
  const confidence = decision.confidence || 0
  // Heuristic detection: confidence ≥ 0.95 with scoring language in reason suggests boost
  const reason = decision.reason?.toLowerCase() || ''
  const isBoosted =
    (confidence >= 0.95 && reason.includes('score')) ||
    (confidence === 1 && !reason.includes('force')) ||
    (confidence === 0.9 && !reason.includes('prefer'))

  // Estimate raw: if boosted, subtract 0.1
  const raw = isBoosted ? +(confidence - 0.1).toFixed(2) : confidence

  return { raw, boosted: isBoosted }
}

/**
 * Compute fallback risk based on available options and confidence.
 * Note: this is an observability field; actual fallback behavior is exception-driven.
 */
function computeFallbackRisk(
  decision: RouteDecision,
  confidence: number,
  isFallback: boolean,
): number {
  if (isFallback) return 1.0

  // Few alternatives = higher risk
  const altCount = decision.alternatives?.length || 0
  const altFactor = Math.max(0, 1 - altCount / 5)  // 0 alternatives = risk 1, 5+ = risk 0

  // Low confidence = higher risk
  const confidenceRisk = 1 - confidence

  return +(Math.min(1, altFactor * 0.5 + confidenceRisk * 0.5)).toFixed(4)
}

/**
 * Convert RouteDecision to PolicySignal.
 * This is a one-way transformation: RouteDecision → PolicySignal.
 * Reverse is not needed (PolicySignal is richer).
 */
export function convertRouteDecisionToSignal(input: AdapterInput): PolicySignal {
  const { decision, constraints, prompt_duration, confidence_boosted, confidence_raw } = input

  // Confidence decomposition
  const confidence = Math.max(0, Math.min(1, decision.confidence || 0))
  const boostInfo = confidence_boosted !== undefined
    ? { raw: confidence_raw ?? confidence, boosted: confidence_boosted }
    : detectConfidenceBoost(decision)
  const rawConfidence = boostInfo.raw

  // Normalize quality (render-intelligence doesn't expose it in RouteDecision)
  const quality_score = 0  // not available from RouteDecision

  // Cost score: raw USD → normalized 0-1
  const rawCost = decision.estimatedCost || 0
  const cost_score = 1 - Math.min(rawCost / 1, 1)

  // Decision path
  const decisionPath = detectDecisionPath(decision, constraints)

  // Effective weights (using typical quality score 7 as heuristic since RouteDecision doesn't carry raw scores)
  const effectiveWeights = computeEffectiveWeights(
    7,  // heuristic: typical quality score for video providers
    decision.estimatedLatencyMs || 30000,
    decision.estimatedCost || 0.01,
    { quality: 0.4, latency: 0.3, cost: 0.3 },
  )

  // Fallback risk
  const is_fallback = decisionPath === 'fallback'
  const fallback_risk = computeFallbackRisk(decision, confidence, is_fallback)

  // Reliability: not yet tracked, default 0.5
  const reliability_score = 0.5

  // Latency variance: not yet tracked, default 0
  const latency_variance = 0

  // Declared weights (from render-intelligence hardcoded values)
  const weights = { quality: 0.4, latency: 0.3, cost: 0.3 }

  return createPolicySignal({
    provider_id: decision.chosenProvider,
    capability: 'video',
    confidence,
    confidence_detail: {
      raw: rawConfidence,
      boosted: boostInfo.boosted,
      final: confidence,
    },
    quality_score,
    latency_ms: decision.estimatedLatencyMs || 0,
    cost_score,
    reliability_score,
    weights,
    effective_weights: effectiveWeights,
    features: {
      fallback_risk,
      latency_variance,
    },
    meta: {
      source: 'render-intelligence',
      model: decision.chosenModel,
      computational_model: 'job',
      decision_path: decisionPath,
      is_fallback,
      fallback_chain: decision.alternatives?.map(a => a.provider) || [],
      sla_tier: decision.slaTier || 'balanced',
      timestamp: Date.now(),
    },
  })
}

/**
 * Batch conversion: convert multiple RouteDecisions (e.g. for status endpoint).
 */
export function convertDecisionsToSignals(
  decisions: AdapterInput[],
): PolicySignal[] {
  return decisions.map(d => convertRouteDecisionToSignal(d))
}
