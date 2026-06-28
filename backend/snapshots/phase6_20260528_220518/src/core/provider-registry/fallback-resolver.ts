/**
 * Phase A — Fallback Resolver
 *
 * Converts a `string[]` (legacy fallback_chain of provider IDs) into
 * `Candidate[]` (capability-consistent execution units).
 *
 * Key invariant: The resolved Candidate list contains ONLY candidates
 * matching the specified capability. Cross-capability fallback is
 * architecturally impossible.
 *
 * This is the bridge between the old `fallback_chain: string[]` world
 * and the new `Candidate[]` world. PolicySignal.meta.fallback_chain
 * remains `string[]` for backward compatibility; this resolver is the
 * single point of conversion.
 */

import type { Candidate, Capability } from './types.js'
import { pluginRegistry } from './plugin-registry.js'

/**
 * Resolve a legacy fallback chain (provider IDs) into capability-consistent Candidates.
 *
 * Rules:
 * 1. Only providers registered in the plugin registry are included
 * 2. Only candidates matching `capability` are included
 * 3. Order of `fallbackChain` is preserved as the primary sort key
 * 4. If a provider has multiple models for the same capability, all are included
 *    (maintaining the provider's relative position)
 * 5. No candidate outside the requested capability can appear in the result
 *
 * @param fallbackChain - Ordered list of provider IDs (from PolicySignal.meta.fallback_chain)
 * @param capability - The capability to filter by
 * @returns Ordered list of Candidates, normalized and capability-safe
 */
export function resolveFallbackChain(
  fallbackChain: string[],
  capability: Capability
): Candidate[] {
  if (!fallbackChain || fallbackChain.length === 0) {
    return []
  }

  const candidates: Candidate[] = []
  const seen = new Set<string>()  // dedup by "provider:model:capability"

  for (const providerId of fallbackChain) {
    const adapter = pluginRegistry.getAdapter(providerId)
    if (!adapter) continue

    for (const candidate of adapter.models()) {
      if (candidate.capability !== capability) continue

      const key = `${candidate.provider}:${candidate.model}:${candidate.capability}`
      if (seen.has(key)) continue
      seen.add(key)

      candidates.push(candidate)
    }
  }

  return candidates
}

/**
 * Merge system candidates with user candidates.
 * User candidates take priority (appear first, dedup by provider+model+capability).
 *
 * @param userCandidates - Candidates from user's registered API keys
 * @param systemCandidates - Candidates from system plugins
 * @returns Merged list with user candidates first, no duplicates
 */
export function mergeCandidates(
  userCandidates: Candidate[],
  systemCandidates: Candidate[]
): Candidate[] {
  const seen = new Set<string>()
  const merged: Candidate[] = []

  // User first
  for (const c of userCandidates) {
    const key = `${c.provider}:${c.model}:${c.capability}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(c)
  }

  // System fallback
  for (const c of systemCandidates) {
    const key = `${c.provider}:${c.model}:${c.capability}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(c)
  }

  return merged
}

/**
 * Build a fallback_chain `string[]` from Candidate[].
 * This is the reverse of resolveFallbackChain — used when we need
 * to pass Candidate[] back into the legacy format for PolicySignal.
 *
 * @param candidates - Ordered list of Candidates
 * @returns Ordered list of provider IDs (unique, preserving order)
 */
export function candidateListToFallbackChain(candidates: Candidate[]): string[] {
  const seen = new Set<string>()
  const chain: string[] = []

  for (const c of candidates) {
    if (seen.has(c.provider)) continue
    seen.add(c.provider)
    chain.push(c.provider)
  }

  return chain
}
