/**
 * Phase A+B — Merged Candidate View
 *
 * Combines system-provided candidates (from registered plugins) with
 * user-provided candidates (from userApiKey table) into a single
 * ordered list for PolicyAdapter consumption.
 *
 * This is the single entry point for building the execution candidate pool.
 * All call sites (images.ts, ai-tasks.ts, worker-runtime.ts) go through this.
 */

import type { Capability, Candidate } from './types.js'
import { pluginRegistry } from './plugin-registry.js'
import { resolveFallbackChain, mergeCandidates, candidateListToFallbackChain } from './fallback-resolver.js'
import { userInstanceRegistry } from '../runtime/user-instance-registry.js'
import { ALL_CAPABILITIES } from './types.js'

/**
 * Default system provider IDs mapped by capability.
 * Used as fallback when no plugins are registered yet.
 */
const SYSTEM_DEFAULTS: Record<Capability, { provider: string; model: string }[]> = {
  image: [
    { provider: 'siliconflow', model: 'black-forest-labs/FLUX.1-dev' },
    { provider: 'aliyun', model: 'wanx2.1-t2i-turbo' },
    { provider: 'volcengine', model: 'doubao-seedream-4-0-250828' },
  ],
  video: [
    { provider: 'volcengine', model: 'video-01' },
  ],
  llm: [
    { provider: 'deepseek', model: 'deepseek-v4-flash' },
    { provider: 'openai', model: 'gpt-4o-mini' },
  ],
  tts: [
    { provider: 'volcengine', model: 'volcengine-tts' },
  ],
}

/**
 * Get the effective candidate list for a given capability and user.
 *
 * Ordering:
 * 1. User's enabled instances (if any) appear first
 * 2. System-provided candidates appear as fallback
 * 3. Same (provider, model, capability) dedup — user version wins
 *
 * @param userId - Optional. If provided, user's registered keys are included.
 * @param capability - The capability to filter by.
 * @param legacyFallbackChain - Optional. If provided, restricts to these providers in this order.
 * @returns Ordered list of Candidates
 */
export async function getEffectiveCandidates(
  userId: string | undefined,
  capability: Capability,
  legacyFallbackChain?: string[]
): Promise<Candidate[]> {
  // 1. Try plugin registry (will be empty until adapters are registered)
  let systemCandidates = legacyFallbackChain
    ? resolveFallbackChain(legacyFallbackChain, capability)
    : pluginRegistry.getCandidates(capability)

  // 2. If no plugins registered, use system defaults
  if (systemCandidates.length === 0) {
    systemCandidates = buildFallbackChainFromDefaults(capability)
  }

  // 3. Get user candidates if userId provided
  let userCandidates: Candidate[] = []
  if (userId) {
    const ctx = await userInstanceRegistry.get(userId)
    if (ctx && ctx.enabledPlugins.length > 0) {
      userCandidates = buildUserCandidates(ctx, capability)
    }
  }

  // 4. Merge: user first, deduped by (provider, model, capability)
  return mergeCandidates(userCandidates, systemCandidates)
}

/**
 * Build fallback candidates from system default provider model mappings.
 */
function buildFallbackChainFromDefaults(capability: Capability): Candidate[] {
  const defaults = SYSTEM_DEFAULTS[capability]
  if (!defaults || defaults.length === 0) return []

  const scores: Record<string, { cost: number; latency: number; quality: number; reliability: number }> = {
    siliconflow: { cost: 0.7, latency: 0.6, quality: 0.7, reliability: 0.8 },
    aliyun: { cost: 0.5, latency: 0.7, quality: 0.8, reliability: 0.85 },
    volcengine: { cost: 0.3, latency: 0.8, quality: 0.9, reliability: 0.9 },
    deepseek: { cost: 0.2, latency: 0.9, quality: 0.85, reliability: 0.85 },
    openai: { cost: 0.8, latency: 0.7, quality: 0.95, reliability: 0.95 },
  }

  return defaults.map(def => {
    const s = scores[def.provider] || { cost: 0.5, latency: 0.5, quality: 0.5, reliability: 0.5 }
    return {
      provider: def.provider,
      model: def.model,
      capability,
      cost: s.cost,
      latency: s.latency,
      quality: s.quality,
      reliability: s.reliability,
    }
  })
}

/**
 * Build candidates from a user's plugin context.
 */
function buildUserCandidates(ctx: import('../runtime/user-instance-registry.js').UserPluginContext, capability: Capability): Candidate[] {
  const candidates: Candidate[] = []

  for (const pluginId of ctx.enabledPlugins) {
    const defaults = SYSTEM_DEFAULTS[capability]
    const defaultModel = defaults?.find(d => d.provider === pluginId)?.model
    if (!defaultModel) continue  // user's plugin doesn't support this capability

    candidates.push({
      provider: pluginId,
      model: ctx.modelOverrides[pluginId] || defaultModel,
      capability,
      cost: 0.3,   // user providers default to lower cost perception
      latency: 0.5, // user providers — unknown latency, conservative
      quality: 0.7,  // user providers — unknown quality, conservative
      reliability: 0.6, // user providers — unknown reliability, conservative
    })
  }

  return candidates
}

/**
 * Shorthand: build fallback chain from raw provider list.
 * Used by images.ts and ai-tasks.ts when they probe available providers.
 */
export function buildFallbackChainFromProviderIds(
  providerIds: string[],
  capability: Capability
): Candidate[] {
  return resolveFallbackChain(providerIds, capability)
}

export { candidateListToFallbackChain, resolveFallbackChain, mergeCandidates }
