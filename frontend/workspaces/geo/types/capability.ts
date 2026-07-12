/**
 * GEO Capability — Type definitions
 *
 * A capability answers a single question: "can I use this feature?"
 * It does NOT cover: UI permissions, route guards, user auth, license, feature rollout.
 *
 * Resolution order (strict):
 *   Default → Edition Override → Deployment Config → Runtime Override (Dev only) → Computed
 */

/** Built-in capability keys */
export type CapabilityKey =
  | 'missionCenter'
  | 'brandWorkspace'
  | 'publishing'
  | 'insights'
  | 'growth'
  | 'discovery'
  | 'verification'
  | 'recommendations'
  | 'copilot'

/** Edition types that can provide overrides */
export type Edition = 'community' | 'pro' | 'enterprise'

/** Source of truth for the resolved value */
export type CapabilitySource = 'default' | 'edition' | 'deployment' | 'runtime' | 'computed'

/** Single capability entry */
export interface CapabilityEntry {
  enabled: boolean
  source: CapabilitySource
}

/** Full capability state map */
export type CapabilityMap = Record<CapabilityKey, CapabilityEntry>

/** Edition-based capability overrides */
export type EditionOverrideMap = Partial<Record<Edition, Partial<Record<CapabilityKey, boolean>>>>
