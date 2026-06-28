// ============================================================================
// ExecutionPlan — Execution Protocol (Chapter ⑤)
//
// Produced by CameraPlanBuilder. Consumed by Provider Adapter + Recovery.
// Include CameraPlan (primary), with reserved slots for ActorPlan, MotionPlan,
// AudioPlan, LightingPlan for future expansion.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { DirectorDecisionId } from '../intent/director-decision';
import type { Constraint } from '../constraint/constraint';
import type { ReferenceBinding } from '../reference/reference-binding';

// ── Core Identifier ──────────────────────────────────────────────────────────

export type ExecutionPlanId = string & { readonly __brand: 'ExecutionPlanId' };

export function createExecutionPlanId(): ExecutionPlanId {
  return uuidv4() as ExecutionPlanId;
}

// ── Camera Plan ──────────────────────────────────────────────────────────────

export interface CameraPlan {
  /** Unique ID for this CameraPlan */
  id: string;
  /** Reference to the intent it serves (immutable) */
  directorIntent: string;
  /** Why this camera choice was made */
  motivation: string;
  /** Composition details */
  composition: CameraComposition;
  /** Constraints that apply to this camera plan */
  constraints: Constraint[];
  /** Reference bindings for this shot */
  referenceBindings: ReferenceBinding[];
  /** Reasoning trace for debugging */
  reasoning: string;
  /** Deterministic hash — same input → same value */
  deterministicHash: string;
}

export interface CameraComposition {
  shotSize: 'extreme_wide' | 'wide' | 'full' | 'medium' | 'medium_close_up' | 'close_up' | 'extreme_close_up';
  angle: 'eye_level' | 'low_angle' | 'high_angle' | 'dutch' | 'overhead' | 'point_of_view';
  movement: 'static' | 'pan' | 'tilt' | 'dolly' | 'track' | 'crane' | 'steadicam' | 'handheld';
  lens?: string;
  depthOfField?: 'shallow' | 'medium' | 'deep';
}

// ── Reserved Future Plan Types ───────────────────────────────────────────────

/** Placeholder — to be defined when character animation is a pipeline concern */
export interface ActorPlan {
  id: string;
  characterId: string;
  staging: string;
  blocking: string;
  gesture?: string;
}

/** Placeholder — to be defined when camera motion needs independent planning */
export interface MotionPlan {
  id: string;
  type: string;
  path: string;
  speed: string;
}

/** Placeholder — to be defined when audio generation is integrated */
export interface AudioPlan {
  id: string;
  type: 'dialogue' | 'sfx' | 'music' | 'ambient';
  source: string;
  timing: string;
}

/** Placeholder — to be defined when lighting setup is part of the pipeline */
export interface LightingPlan {
  id: string;
  keyLight: string;
  fillLight: string;
  backLight: string;
  mood: string;
}

// ── Root ExecutionPlan ───────────────────────────────────────────────────────

export interface ExecutionPlan {
  /** Unique identifier */
  id: ExecutionPlanId;
  /** Source DirectorDecision this plan is derived from */
  directorDecisionId: DirectorDecisionId;

  /** Primary: CameraPlan for each shot */
  cameraPlans: CameraPlan[];

  /** Reserved: future plan types */
  actorPlans?: ActorPlan[];
  motionPlans?: MotionPlan[];
  audioPlans?: AudioPlan[];
  lightingPlans?: LightingPlan[];

  /** Deterministic hash for reproducibility */
  deterministicHash: string;

  /** Provider-neutral: no provider-specific fields at this level */
  createdAt: string; // ISO 8601
}
