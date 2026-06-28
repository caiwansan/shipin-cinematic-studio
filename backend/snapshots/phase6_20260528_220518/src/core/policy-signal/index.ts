/**
 * Policy Signal Barrel — Phase 1B
 */

export { createPolicySignal } from './policy-signal.types.js'
export type {
  PolicySignal,
  PolicySignalMeta,
  PolicySignalFeatures,
  PolicySignalFeatureWeights,
  PolicySignalEffectiveWeights,
  PolicySignalConfidenceDetail,
} from './policy-signal.types.js'
export { convertRouteDecisionToSignal, convertDecisionsToSignals } from './render-intelligence-adapter.js'
export type { AdapterInput } from './render-intelligence-adapter.js'
