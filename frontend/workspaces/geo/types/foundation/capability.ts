// ============================================================
// CapabilityMetadata — BA-02 Capability Transparency
// SSOT: Pure domain model, no UI fields (colors, icons, labels).
// Backend returns `_meta` in API responses; frontend maps to UI.
// ============================================================

/**
 * Truth level of the data source.
 * - TRUE: actual data from production DB
 * - ESTIMATION: computed from partial data
 * - DERIVED: computed from other TRUE/ESTIMATION data
 * - SIMULATED: simulated/stub engine, no real API call
 * - NO_EVIDENCE: no data source available
 */
export type TruthLevel =
  | 'TRUE'
  | 'ESTIMATION'
  | 'DERIVED'
  | 'SIMULATED'
  | 'NO_EVIDENCE'

/**
 * Capability maturity level of the engine/provider.
 * - Production: fully operational in production
 * - Beta: feature-complete but not fully validated
 * - Simulated: simulated engine, no real API integration
 * - Unavailable: not yet implemented / unavailable
 */
export type CapabilityLevel =
  | 'Production'
  | 'Beta'
  | 'Simulated'
  | 'Unavailable'

/**
 * Metadata for a single data point's capability transparency.
 * Returned in API `_meta` responses, consumed by frontend CapabilityBadge.
 */
export interface CapabilityMetadata {
  /** Source engine or service name, e.g. "Brand Profile DB" */
  source: string
  /** Truth level of this data point */
  truthLevel: TruthLevel
  /** Capability maturity level */
  capabilityLevel: CapabilityLevel
  /** ISO-8601 timestamp of when data was last updated */
  updatedAt: string
}

/**
 * Map of metric keys to their capability metadata.
 * Returned at API response top level alongside `data`.
 */
export interface CapabilityMetaMap {
  [metricKey: string]: CapabilityMetadata
}
