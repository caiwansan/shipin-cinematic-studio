/**
 * Phase A — Barrel export for provider-registry
 *
 * Single import for all consumers:
 *   import { getEffectiveCandidates, pluginRegistry, Candidate, Capability } from '../core/provider-registry/index.js'
 */

// Registry
export { pluginRegistry, PluginRegistry } from './plugin-registry.js'

// Candidate resolution
export { getEffectiveCandidates, buildFallbackChainFromProviderIds, candidateListToFallbackChain, resolveFallbackChain, mergeCandidates } from './merged-view.js'

// Types
export type { Capability, Candidate, ProviderDescriptor, ModelPluginAdapter, NormalizedRequest, NormalizedResponse } from './types.js'
export { ALL_CAPABILITIES } from './types.js'
