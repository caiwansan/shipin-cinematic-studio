/**
 * Phase A — Capability & Candidate Type Definitions
 *
 * The core type contract for the capability-aware execution system.
 * These types replace `string` as the representation of "which provider/model to use."
 *
 * Key principles:
 * - Capability is locked to 4 values — never extend at this level
 * - Candidate is the atomic execution unit (provider + model + capability)
 * - ProviderDescriptor is for UI/registration only — NEVER enters PolicyAdapter
 */

// ============================================================
// Capability — the only semantic entry dimension
// ============================================================

/** Never extend beyond these 4. Sub-types (t2i/i2i) are execution params, NOT capabilities. */
export type Capability = 'image' | 'video' | 'llm' | 'tts'

/** Ordered list used for validation and iteration. Do not add here. */
export const ALL_CAPABILITIES: readonly Capability[] = ['image', 'video', 'llm', 'tts'] as const

// ============================================================
// Candidate — the atomic execution unit
// ============================================================

/**
 * A Candidate is a concrete execution option: "run this provider's model for this capability."
 *
 * PolicyAdapter receives Candidate[] as input. Worker dispatches by (provider, capability).
 * The Candidate is the smallest unit that both Policy and Worker agree on.
 */
export interface Candidate {
  provider: string
  model: string
  capability: Capability

  // Normalized scores (0.0–1.0). Used by PolicyAdapter for ranking.
  cost: number       // lower = cheaper
  latency: number    // lower = faster
  quality: number    // higher = better
  reliability: number // higher = more reliable
}

// ============================================================
// ProviderDescriptor — visible metadata for UI/admin
// ============================================================

/**
 * Describes a provider to the outside world (admin panel, API responses).
 * NOT used in execution path — Candidate is the execution type.
 */
export interface ProviderDescriptor {
  id: string
  name: string
  capabilities: Capability[]
  models: string[]
  /** Schema of configuration fields required to use this provider (e.g., { apiKey: 'string' }) */
  configSchema: Record<string, 'string' | 'number' | 'boolean'>
}

// ============================================================
// ModelPluginAdapter — the contract each provider plugin implements
// ============================================================

/**
 * Each provider plugin (volcengine, openai, etc.) implements this interface.
 * The PluginRegistry collects all adapters and exposes merged Candidate views.
 */
export interface NormalizedRequest {
  prompt?: string
  model?: string
  params?: Record<string, unknown>
  signal?: AbortSignal
}

export interface NormalizedResponse {
  content: string | string[]
  model: string
  latencyMs: number
  raw?: unknown  // original provider response, for debugging
}

export interface ModelPluginAdapter {
  provider: string
  /** Returns all Candidates this plugin can provide. Called once at registration. */
  models(): Candidate[]
  /** Execute a single request. The Candidate determines which model to use. */
  execute(request: NormalizedRequest, candidate: Candidate, signal?: AbortSignal): Promise<NormalizedResponse>
  /** Quick health check — is this plugin functional? */
  healthCheck(): Promise<boolean>
  /** Human-readable label */
  label(): string
}
