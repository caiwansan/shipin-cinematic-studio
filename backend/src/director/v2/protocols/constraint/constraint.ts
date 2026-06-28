// ============================================================================
// Constraint — Constraint Protocol (Chapter ⑥)
//
// Unified constraint interface across the entire pipeline.
// Produced by SpatialPlanner. Consumed by CameraPlanBuilder, Recovery,
// Provider Adapter, Evaluation.
//
// Constraint lifecycle: ACTIVE → SATISFIED | COMPROMISED | VIOLATED |
//                        OVERRIDDEN | EXPIRED
// Monotonicity: constraints only added, never silently removed.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

export type ConstraintId = string & { readonly __brand: 'ConstraintId' };

export function createConstraintId(): ConstraintId {
  return uuidv4() as ConstraintId;
}

// ── Constraint Source ────────────────────────────────────────────────────────

export enum ConstraintSource {
  DIRECTOR_INTENT = 'DIRECTOR_INTENT',
  SPATIAL_PLANNER = 'SPATIAL_PLANNER',
  BEAT_PLANNER = 'BEAT_PLANNER',
  SHOT_PLANNER = 'SHOT_PLANNER',
  PERFORMANCE_DIRECTOR = 'PERFORMANCE_DIRECTOR',
  CAMERA_DIRECTOR = 'CAMERA_DIRECTOR',
  CONTINUITY = 'CONTINUITY',
  PROVIDER = 'PROVIDER',
}

// ── Constraint Priority ──────────────────────────────────────────────────────

export enum ConstraintPriority {
  /** Hard constraints are violations — execution must not proceed */
  HARD = 'HARD',
  /** Soft constraints are preferences — violation is tolerated but penalized */
  SOFT = 'SOFT',
  /** Optional constraints — best effort, no penalty */
  OPTIONAL = 'OPTIONAL',
}

// ── Constraint State (Lifecycle) ─────────────────────────────────────────────

export enum ConstraintState {
  /** Created and active, not yet evaluated */
  ACTIVE = 'ACTIVE',
  /** Evaluated and satisfied */
  SATISFIED = 'SATISFIED',
  /** Evaluated and partially satisfied with acceptable compromise */
  COMPROMISED = 'COMPROMISED',
  /** Evaluated and violated (HARD violation blocks execution) */
  VIOLATED = 'VIOLATED',
  /** Explicitly overridden with documented reason */
  OVERRIDDEN = 'OVERRIDDEN',
  /** No longer applicable (e.g., shot already generated) */
  EXPIRED = 'EXPIRED',
}

// ── Constraint Scope ─────────────────────────────────────────────────────────

export enum ConstraintScope {
  /** Applies within a single shot */
  SHOT = 'SHOT',
  /** Applies across a pair of adjacent shots */
  SHOT_PAIR = 'SHOT_PAIR',
  /** Applies within an entire scene */
  SCENE = 'SCENE',
  /** Applies across a sequence of scenes */
  SEQUENCE = 'SEQUENCE',
  /** Applies to the entire video */
  GLOBAL = 'GLOBAL',
}

// ── Constraint Category ──────────────────────────────────────────────────────

export enum ConstraintCategory {
  SPATIAL = 'SPATIAL',
  TEMPORAL = 'TEMPORAL',
  STYLE = 'STYLE',
  NARRATIVE = 'NARRATIVE',
  TECHNICAL = 'TECHNICAL',
  COMPOSITION = 'COMPOSITION',
  LIGHTING = 'LIGHTING',
  CAMERA = 'CAMERA',
  REFERENCE = 'REFERENCE',
}

// ── Constraint Payload ───────────────────────────────────────────────────────

export interface ConstraintPayload {
  /** Human-readable statement of the constraint */
  statement: string;
  /** Structured data (provider-neutral, varies by category) */
  data?: Record<string, unknown>;
}

// ── Root Constraint ──────────────────────────────────────────────────────────

export interface Constraint {
  /** Unique constraint ID */
  id: ConstraintId;
  /** Where this constraint came from */
  source: ConstraintSource;
  /** Priority level */
  priority: ConstraintPriority;
  /** Current lifecycle state */
  state: ConstraintState;
  /** Category for grouping */
  category: ConstraintCategory;
  /** Scope of applicability */
  scope: ConstraintScope;
  /** Optional lifetime bound (e.g., applies only to shot #3–#5) */
  lifetime?: { fromShotIndex: number; toShotIndex: number };
  /** Constraint payload */
  payload: ConstraintPayload;
  /** Reason/evidence for this constraint's creation */
  reason: string;
  /** Which DirectorDecision revision generated this constraint */
  generatedFromRevision: number;
  /** Optional asset binding */
  assetBindingId?: string;
}

// ── Helper ───────────────────────────────────────────────────────────────────

export function isConstraintViolated(constraint: Constraint): boolean {
  return constraint.state === ConstraintState.VIOLATED;
}

export function isHardConstraintViolated(constraint: Constraint): boolean {
  return constraint.priority === ConstraintPriority.HARD && constraint.state === ConstraintState.VIOLATED;
}

export function hasHardViolations(constraints: Constraint[]): boolean {
  return constraints.some(isHardConstraintViolated);
}
