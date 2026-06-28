// ============================================================================
// ReferenceBinding — Bridge from Reference/Asset Protocol into Execution Plan
//
// ReferenceBinding is the bridge type: it connects ReferenceAssignments
// (asset-level) to CameraPlans (execution-level). It is produced by
// ReferenceResolver and consumed by CameraPlanBuilder.
// ============================================================================

import type { AssetNodeId } from './asset-graph';

export type ReferenceBindingId = string & { readonly __brand: 'ReferenceBindingId' };

// ── Reference Binding ────────────────────────────────────────────────────────

export interface ReferenceBinding {
  /** Unique binding ID */
  id: ReferenceBindingId;
  /** Which asset node this binding points to */
  assetNodeId: AssetNodeId;
  /** How this binding should be used */
  usage: 'composition_reference' | 'style_reference' | 'character_reference' | 'environment_reference' | 'lighting_reference';
  /** Relevance weight (0.0 – 1.0) */
  relevance: number;
  /** Locked by user? Locked references must NOT be removed */
  locked: boolean;
  /** Expected coverage contribution */
  expectedCoverage: number;
}
