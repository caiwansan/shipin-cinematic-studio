// ============================================================================
// ReferenceAssignment — Reference/Asset Protocol (Chapter ⑧)
//
// Produced by ReferenceResolver. Consumed by CameraPlanBuilder (via
// ReferenceBinding), Provider Adapter, Continuity & Recovery Engine.
// ============================================================================

import type { AssetNodeId, AssetRevisionId } from './asset-graph';
import type { ReferenceBindingId } from './reference-binding';

// ── Reference Coverage ───────────────────────────────────────────────────────

export interface ReferenceCoverage {
  characterCoverage: number;  // 0.0 – 1.0
  sceneCoverage: number;      // 0.0 – 1.0
  shotCoverage: number;       // 0.0 – 1.0
  overallScore: number;       // 0.0 – 1.0

  /** Whether there are critical gaps that block execution */
  hasCriticalGaps: boolean;
  actionRequired: 'none' | 'request_asset_generation' | 'degrade_quality';

  /** Per-reference breakdown */
  gaps: ReferenceGap[];
}

export interface ReferenceGap {
  assetNodeId: AssetNodeId;
  missingRevision?: AssetRevisionId;
  severity: 'critical' | 'moderate' | 'minor';
  description: string;
}

// ── Resolve Policy ───────────────────────────────────────────────────────────

export enum ResolvePolicy {
  FIRST_PASS = 'FIRST_PASS',       // Standard: best available
  RECOVERY = 'RECOVERY',           // Post-recovery: prefer locked, accept degraded
  EXPORT = 'EXPORT',               // Final generation: must resolve all critical
}

// ── Root ReferenceAssignment ─────────────────────────────────────────────────

export interface ReferenceAssignment {
  shotIndex: number;
  bindings: ReferenceBindingId[];
  coverage: ReferenceCoverage;
  policy: ResolvePolicy;
  resolveAttempt: number;  // 1-based, max 2 iterations per spec
}
