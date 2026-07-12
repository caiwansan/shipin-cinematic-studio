// ============================================================
// P0-B.3: Presence Evidence Integration — Unified Output Types
//
// PresenceResult is the OUTPUT type used by PresenceService.
// Adaptors internally return ProviderResult (from types.ts).
// This file normalizes engine output for Verification consumption.
// ============================================================

/**
 * Unified presence result — normalizes all adapter outputs
 * into a consistent status model for the Truth Layer.
 */
export interface PresenceResult {
  provider: string
  entity: string
  status: 'FOUND' | 'NOT_FOUND' | 'UNKNOWN' | 'ERROR'
  confidence: number
  checkedAt: string
  latencyMs: number
  reason?: string
  evidence?: PresenceEvidence
}

/**
 * Minimal evidence payload that Presence produces for Verification.
 */
export interface PresenceEvidence {
  requestHash: string
  source: string
  provider: string
  entity: string
  checkedAt: string
  status: string
  confidence: number
}
