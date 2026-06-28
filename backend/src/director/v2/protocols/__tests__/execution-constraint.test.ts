import { describe, it, expect } from 'vitest';
import { createExecutionPlanId, ExecutionPlan, CameraPlan, CameraComposition } from '../execution/execution-plan';
import {
  Constraint, ConstraintPriority, ConstraintState, ConstraintCategory, ConstraintScope, ConstraintSource, createConstraintId,
  isConstraintViolated, isHardConstraintViolated, hasHardViolations,
} from '../constraint/constraint';
import { createDirectorDecisionId } from '../intent/director-decision';

describe('ExecutionPlan — Execution Protocol', () => {
  it('generates unique ID', () => {
    expect(createExecutionPlanId()).toBeTruthy();
    expect(createExecutionPlanId()).not.toBe(createExecutionPlanId());
  });

  it('builds a CameraPlan with required fields', () => {
    const plan: CameraPlan = {
      id: 'cam-001',
      directorIntent: 'Establish power dynamic',
      motivation: 'Low angle emphasizes dominance',
      composition: {
        shotSize: 'medium',
        angle: 'low_angle',
        movement: 'static',
      },
      constraints: [],
      referenceBindings: [],
      reasoning: 'Character A is confronting B',
      deterministicHash: 'abc123',
    };

    expect(plan.composition.shotSize).toBe('medium');
    expect(plan.composition.angle).toBe('low_angle');
  });

  it('builds a full ExecutionPlan', () => {
    const decisionId = createDirectorDecisionId();
    const plan: ExecutionPlan = {
      id: createExecutionPlanId(),
      directorDecisionId: decisionId,
      cameraPlans: [],
      deterministicHash: 'plan-hash',
      createdAt: new Date().toISOString(),
    };
    expect(plan.directorDecisionId).toBe(decisionId);
    expect(plan.cameraPlans).toHaveLength(0);
  });
});

describe('Constraint — Constraint Protocol', () => {
  it('creates a constraint with all fields', () => {
    const c: Constraint = {
      id: createConstraintId(),
      source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.SPATIAL,
      scope: ConstraintScope.SHOT,
      payload: {
        statement: 'Character A must be on the left side of frame',
        data: { characterId: 'char_a', zone: 'left_third' },
      },
      reason: 'Power dynamic requires spatial separation',
      generatedFromRevision: 1,
    };
    expect(c.state).toBe(ConstraintState.ACTIVE);
    expect(c.priority).toBe(ConstraintPriority.HARD);
    expect(c.source).toBe(ConstraintSource.DIRECTOR_INTENT);
  });

  it('isConstraintViolated returns correct values', () => {
    const ok: Constraint = {
      id: createConstraintId(), source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD, state: ConstraintState.SATISFIED,
      category: ConstraintCategory.SPATIAL, scope: ConstraintScope.SHOT,
      payload: { statement: 'test' }, reason: 'test', generatedFromRevision: 1,
    };
    const violated: Constraint = {
      id: createConstraintId(), source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD, state: ConstraintState.VIOLATED,
      category: ConstraintCategory.SPATIAL, scope: ConstraintScope.SHOT,
      payload: { statement: 'test' }, reason: 'test', generatedFromRevision: 1,
    };

    expect(isConstraintViolated(ok)).toBe(false);
    expect(isConstraintViolated(violated)).toBe(true);
    expect(isHardConstraintViolated(violated)).toBe(true);
    expect(hasHardViolations([ok, violated])).toBe(true);
    expect(hasHardViolations([ok])).toBe(false);
  });
});
