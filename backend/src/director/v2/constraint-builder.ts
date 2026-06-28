// ============================================================================
// A3.1 Constraint Builder — ExecutionPlan → Constraint[]
//
// Produces the initial set of constraints from an ExecutionPlan.
// Does NOT read Storyboard, ShotGraph, or any other source.
// The sole input is ExecutionPlan (Intent Protocol's output).
//
// Constraint sources at this stage:
//   - Shot composition rules (180° axis, screen direction)
//   - Character presence consistency
//   - Scene-level spatial boundaries
//   - Camera movement limitations
// ============================================================================

import type { ExecutionPlan, CameraPlan } from '@director-v2/protocols/execution/execution-plan';
import type { Constraint } from '@director-v2/protocols/constraint/constraint';
import { createConstraintId, ConstraintSource, ConstraintPriority, ConstraintState, ConstraintCategory, ConstraintScope } from '@director-v2/protocols/constraint/constraint';

// ── Build Constraints from ExecutionPlan ─────────────────────────────────────

export function buildConstraints(plan: ExecutionPlan): Constraint[] {
  const constraints: Constraint[] = [];

  plan.cameraPlans.forEach((cp, shotIndex) => {
    // 1. Composition rules
    constraints.push(...buildCompositionConstraints(cp, shotIndex));

    // 2. 180° axis rule (between adjacent shots)
    if (shotIndex > 0) {
      constraints.push(...buildAxisConstraints(plan.cameraPlans[shotIndex - 1], cp, shotIndex));
    }

    // 3. Character screen-direction continuity
    constraints.push(...buildScreenDirectionConstraints(cp, shotIndex));

    // 4. Scene-level spatial boundaries
    constraints.push(...buildSpatialBoundaryConstraints(cp, shotIndex));
  });

  return constraints;
}

// ── Composition Constraints ──────────────────────────────────────────────────

function buildCompositionConstraints(cp: CameraPlan, shotIndex: number): Constraint[] {
  const result: Constraint[] = [];
  const gen = `shot-${shotIndex}`;

  // Shot size implies framing constraints
  if (cp.composition.shotSize === 'close_up' || cp.composition.shotSize === 'extreme_close_up') {
    result.push({
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.SOFT,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.COMPOSITION,
      scope: shotIndex > 0 ? ConstraintScope.SHOT_PAIR : ConstraintScope.SHOT,
      payload: {
        statement: `Close-up framing — main subject should occupy >60% of frame width`,
        data: { shotIndex, minSubjectWidth: 0.6, shotSize: cp.composition.shotSize },
      },
      reason: `Close-up requires dominant subject presence in frame`,
      generatedFromRevision: 1,
    });
  }

  // Depth of field constraints
  if (cp.composition.depthOfField === 'shallow') {
    result.push({
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.SOFT,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.COMPOSITION,
      scope: ConstraintScope.SHOT,
      payload: {
        statement: `Shallow depth of field — maintain separation between subject and background`,
        data: { shotIndex, dof: 'shallow', subjectBackgroundDistance: 1.5 },
      },
      reason: `Shallow DOF requires distinct z-depth layers`,
      generatedFromRevision: 1,
    });
  }

  return result;
}

// ── 180° Axis Rule ───────────────────────────────────────────────────────────

function buildAxisConstraints(prev: CameraPlan, curr: CameraPlan, shotIndex: number): Constraint[] {
  const result: Constraint[] = [];

  // If both shots have the same angle type, maintain axis
  if (prev.composition.angle === curr.composition.angle) {
    result.push({
      id: createConstraintId(),
      source: ConstraintSource.CONTINUITY,
      priority: ConstraintPriority.HARD,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.CAMERA,
      scope: ConstraintScope.SHOT_PAIR,
      lifetime: { fromShotIndex: shotIndex - 1, toShotIndex: shotIndex },
      payload: {
        statement: `180° axis rule — camera must not cross the line between consecutive same-angle shots`,
        data: { prevShotIndex: shotIndex - 1, currShotIndex: shotIndex, angle: prev.composition.angle },
      },
      reason: `Crossing the 180° axis breaks spatial continuity`,
      generatedFromRevision: 1,
    });
  }

  return result;
}

// ── Screen Direction Constraints ─────────────────────────────────────────────

function buildScreenDirectionConstraints(cp: CameraPlan, shotIndex: number): Constraint[] {
  const result: Constraint[] = [];

  // Camera movement direction should be consistent within a shot
  if (cp.composition.movement === 'pan' || cp.composition.movement === 'track' || cp.composition.movement === 'dolly') {
    result.push({
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.SOFT,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.CAMERA,
      scope: ConstraintScope.SHOT,
      payload: {
        statement: `Camera movement direction should be consistent within shot`,
        data: { shotIndex, movement: cp.composition.movement },
      },
      reason: `Direction reversal within a shot disorients the viewer`,
      generatedFromRevision: 1,
    });
  }

  return result;
}

// ── Spatial Boundary Constraints ─────────────────────────────────────────────

function buildSpatialBoundaryConstraints(cp: CameraPlan, shotIndex: number): Constraint[] {
  const result: Constraint[] = [];

  // Wide shots imply visible space boundaries
  if (cp.composition.shotSize === 'wide' || cp.composition.shotSize === 'extreme_wide') {
    result.push({
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.SOFT,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.SPATIAL,
      scope: ConstraintScope.SHOT,
      payload: {
        statement: `Wide shot — environment must be fully visible and consistent`,
        data: { shotIndex, shotSize: cp.composition.shotSize, visibilityRange: 'full' },
      },
      reason: `Wide shots expose large spatial areas that must remain consistent`,
      generatedFromRevision: 1,
    });
  }

  return result;
}
