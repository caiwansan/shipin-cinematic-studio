// ============================================================
// Capability Metadata — BA-02 Sprint
// SSOT: Hardcoded from BA-01 Truth Classification.
// Scores are computed frontend-side (computed() in BrandOverview),
// so their _meta is static constants, not backend API responses.
//
// For aiPresence and verification, _meta comes from their
// respective backend route responses.
// ============================================================

import type { CapabilityMetadata } from '../types/foundation/capability'

/**
 * Static metadata for each score metric.
 * These come from BA-01 Truth Classification and never change
 * until the underlying engine/provider is upgraded.
 */
export const SCORE_META: Record<string, CapabilityMetadata> = {
  identityScore: {
    source: 'Brand Profile DB',
    truthLevel: 'TRUE',
    capabilityLevel: 'Production',
    updatedAt: new Date().toISOString(),
  },
  knowledgeScore: {
    source: 'EntityCount / ScanCount',
    truthLevel: 'DERIVED',
    capabilityLevel: 'Production',
    updatedAt: new Date().toISOString(),
  },
  optimizationScore: {
    source: 'ADI from DB',
    truthLevel: 'ESTIMATION',
    capabilityLevel: 'Production',
    updatedAt: new Date().toISOString(),
  },
  completenessPercent: {
    source: 'Dashboard Service',
    truthLevel: 'DERIVED',
    capabilityLevel: 'Production',
    updatedAt: new Date().toISOString(),
  },
}

/**
 * CapabilityMetadata for aiPresence.
 * Updated at runtime from presence route response.
 */
export const PRESENCE_STUB_META: CapabilityMetadata = {
  source: 'Presence Engine',
  truthLevel: 'SIMULATED',
  capabilityLevel: 'Simulated',
  updatedAt: new Date().toISOString(),
}

/**
 * CapabilityMetadata for verification.
 * Updated at runtime from verification route response.
 */
export const VERIFICATION_META: CapabilityMetadata = {
  source: 'Verification Engine',
  truthLevel: 'TRUE',
  capabilityLevel: 'Production',
  updatedAt: new Date().toISOString(),
}
