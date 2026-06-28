/**
 * PolicySignal Schema — Phase 1B
 *
 * Standardized decision signal output for all intelligence sources.
 * Current source: render-intelligence
 * Future sources: heuristic scorer, LLM Registry
 *
 * This is a DATA schema only. No decision logic. No execution.
 * Weights are EXPOSED but NOT applied at this layer.
 */

export interface PolicySignalFeatureWeights {
  quality: number     // e.g. 0.4 from render-intelligence
  latency: number     // e.g. 0.3
  cost: number        // e.g. 0.3
}

/**
 * Effective weights account for normalization factors.
 * For example: declared cost weight = 0.3, but with norm ceiling of $1,
 * typical inputs (< $0.10) produce near-max costScore, inflating cost's effective contribution.
 */
export interface PolicySignalEffectiveWeights {
  quality: number     // actual contribution considering norm factors
  latency: number
  cost: number
}

export interface PolicySignalConfidenceDetail {
  raw: number         // confidence before any boost/modification
  boosted: boolean    // true if the raw confidence was modified by a secondary heuristic
  final: number       // confidence after modifications (same as top-level confidence)
}

export interface PolicySignalFeatures {
  fallback_risk: number       // 0.0 – 1.0 (higher = more likely to need fallback)
  latency_variance: number    // variance / mean (relative dispersion)
}

export interface PolicySignalMeta {
  source: 'render-intelligence' | 'heuristic' | 'registry'
  model: string                 // the model that produced this signal
  computational_model: 'job' | 'stateless'
  decision_path: 'normal' | 'fallback' | 'forced' | 'preferred'
  is_fallback: boolean
  fallback_chain: string[]      // ordered list of providers attempted
  sla_tier: 'fast' | 'balanced' | 'production'
  timestamp: number
}

export interface PolicySignal {
  provider_id: string
  capability: string            // 'video' | 'image' | 'tts' | 'llm'
  confidence: number            // 0.0 – 1.0 (final)
  confidence_detail: PolicySignalConfidenceDetail
  quality_score: number         // normalized 0.0 – 1.0
  latency_ms: number            // predicted or observed
  cost_score: number            // normalized 0.0 – 1.0 (lower = cheaper)
  reliability_score: number     // normalized 0.0 – 1.0 (higher = more reliable)
  weights: PolicySignalFeatureWeights      // declared weights from source
  effective_weights: PolicySignalEffectiveWeights  // actual contributions considering norm factors
  features: PolicySignalFeatures
  meta: PolicySignalMeta
}

/**
 * Factory to create a new PolicySignal with defaults.
 * Ensures all fields are populated (no undefined).
 */
export function createPolicySignal(overrides: Partial<PolicySignal>): PolicySignal {
  const now = Date.now()

  const confidence = overrides.confidence ?? 0
  const cd = overrides.confidence_detail
  const confidenceDetail = cd
    ? { raw: cd.raw ?? confidence, boosted: cd.boosted ?? false, final: cd.final ?? confidence }
    : { raw: confidence, boosted: false, final: confidence }

  return {
    provider_id: overrides.provider_id || 'unknown',
    capability: overrides.capability || 'unknown',
    confidence,
    confidence_detail: confidenceDetail,
    quality_score: overrides.quality_score ?? 0,
    latency_ms: overrides.latency_ms ?? 0,
    cost_score: overrides.cost_score ?? 1,
    reliability_score: overrides.reliability_score ?? 0.5,
    weights: {
      quality: overrides.weights?.quality ?? 0.4,
      latency: overrides.weights?.latency ?? 0.3,
      cost: overrides.weights?.cost ?? 0.3,
    },
    effective_weights: overrides.effective_weights || {
      quality: overrides.weights?.quality ?? 0.4,
      latency: overrides.weights?.latency ?? 0.3,
      cost: overrides.weights?.cost ?? 0.3,
    },
    features: {
      fallback_risk: overrides.features?.fallback_risk ?? 0,
      latency_variance: overrides.features?.latency_variance ?? 0,
    },
    meta: {
      source: overrides.meta?.source || 'heuristic',
      model: overrides.meta?.model || 'unknown',
      computational_model: overrides.meta?.computational_model || 'stateless',
      decision_path: overrides.meta?.decision_path || 'normal',
      is_fallback: overrides.meta?.is_fallback ?? false,
      fallback_chain: overrides.meta?.fallback_chain || [],
      sla_tier: overrides.meta?.sla_tier || 'balanced',
      timestamp: overrides.meta?.timestamp || now,
    },
  }
}
