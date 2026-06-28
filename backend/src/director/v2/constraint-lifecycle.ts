// ============================================================================
// A3.3 Constraint Lifecycle — State transitions
//
// Enforces monotonic state transitions for constraints.
// Transitions are one-directional: ACTIVE → {SATISFIED|COMPROMISED|VIOLATED}
// → OVERRIDDEN → EXPIRED
// ============================================================================

import type { Constraint, ConstraintId } from '@director-v2/protocols/constraint/constraint';
import { ConstraintState, hasHardViolations } from '@director-v2/protocols/constraint/constraint';
import type { ConstraintRegistry } from './constraint-registry';

// ── Allowed transitions ──────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ConstraintState, ConstraintState[]> = {
  [ConstraintState.ACTIVE]:        [ConstraintState.SATISFIED, ConstraintState.COMPROMISED, ConstraintState.VIOLATED, ConstraintState.EXPIRED],
  [ConstraintState.SATISFIED]:     [ConstraintState.COMPROMISED, ConstraintState.VIOLATED, ConstraintState.OVERRIDDEN, ConstraintState.EXPIRED],
  [ConstraintState.COMPROMISED]:   [ConstraintState.VIOLATED, ConstraintState.OVERRIDDEN, ConstraintState.EXPIRED],
  [ConstraintState.VIOLATED]:      [ConstraintState.OVERRIDDEN, ConstraintState.EXPIRED],
  [ConstraintState.OVERRIDDEN]:    [ConstraintState.EXPIRED],
  [ConstraintState.EXPIRED]:       [],
};

// ── Transition error ─────────────────────────────────────────────────────────

export class InvalidConstraintTransitionError extends Error {
  constructor(constraintId: ConstraintId, from: ConstraintState, to: ConstraintState) {
    super(`Invalid constraint state transition: ${constraintId} from ${from} → ${to}`);
    this.name = 'InvalidConstraintTransitionError';
  }
}

// ── Lifecycle Engine ─────────────────────────────────────────────────────────

export class ConstraintLifecycleEngine {
  constructor(private registry: ConstraintRegistry) {}

  /**
   * Attempt to transition a constraint to a new state.
   * Throws InvalidConstraintTransitionError if disallowed.
   */
  transition(constraintId: ConstraintId, to: ConstraintState): void {
    const constraint = this.registry.get(constraintId);
    if (!constraint) {
      throw new Error(`Constraint not found: ${constraintId}`);
    }

    const allowed = ALLOWED_TRANSITIONS[constraint.state];
    if (!allowed.includes(to)) {
      throw new InvalidConstraintTransitionError(constraintId, constraint.state, to);
    }

    this.registry.updateState(constraintId, to);
  }

  /**
   * Evaluate all ACTIVE constraints — transition to SATISFIED or VIOLATED
   * based on external evaluation results.
   *
   * @param constraintStates  Map of constraintId → evaluated state
   */
  evaluateAll(constraintStates: Map<ConstraintId, ConstraintState>): void {
    for (const [id, evaluatedState] of constraintStates) {
      const c = this.registry.get(id);
      if (!c) continue;
      if (c.state !== ConstraintState.ACTIVE && c.state !== ConstraintState.SATISFIED) continue;

      const targetState = evaluatedState; // SATISFIED | COMPROMISED | VIOLATED
      this.transition(id, targetState);
    }
  }

  /**
   * Progress all VIOLATED constraints that were handled (e.g. by Recovery)
   */
  resolve(constraintId: ConstraintId): void {
    this.transition(constraintId, ConstraintState.OVERRIDDEN);
  }

  /**
   * Expire constraints that are no longer relevant (shot already generated).
   */
  expireUpToShotIndex(shotIndex: number): void {
    for (const constraint of this.registry.getAll()) {
      if (constraint.state === ConstraintState.EXPIRED) continue;
      if (constraint.lifetime && constraint.lifetime.toShotIndex <= shotIndex) {
        this.transition(constraint.id, ConstraintState.EXPIRED);
      }
    }
  }
}
