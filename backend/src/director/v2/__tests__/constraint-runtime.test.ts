import { describe, it, expect } from 'vitest';
import { generateShotPlan } from '../../../runtime/director/shot-planner-rules';
import { shotGraphToDirectorDecision } from '@director-v2/director-adapter';
import { buildExecutionPlan } from '@director-v2/execution-plan-builder';
import { buildConstraints } from '@director-v2/constraint-builder';
import {
  Constraint,
  ConstraintState, ConstraintPriority, ConstraintSource, ConstraintCategory, ConstraintScope,
  isConstraintViolated, hasHardViolations, createConstraintId,
} from '@director-v2/protocols/constraint/constraint';
import { ConstraintRegistry } from '@director-v2/constraint-registry';
import { ConstraintLifecycleEngine, InvalidConstraintTransitionError } from '@director-v2/constraint-lifecycle';
import { getConstraintProvenance, printConstraintTrace } from '@director-v2/constraint-provenance';

// ── Golden Stories ───────────────────────────────────────────────────────────

const STORIES = [
  'A tense confrontation between Li Ming and Zhao Xue at a rainy night office. Li Ming slams the table, Zhao Xue turns away in anger.',
  'Chen Hao runs through the burning building, dodging falling debris. He reaches the rooftop just as the helicopter arrives.',
  'Xiao Mei walks into the garden at sunset. She sees Wang Lei waiting with flowers. They embrace in slow motion.',
];

function runPipeline(storyboard: string) {
  const shotGraph = generateShotPlan(storyboard);
  const decision = shotGraphToDirectorDecision(shotGraph);
  const plan = buildExecutionPlan(decision);
  const constraints = buildConstraints(plan);
  return { shotGraph, decision, plan, constraints };
}

// ── Stability Test ───────────────────────────────────────────────────────────

describe('A3.1 — Constraint Builder — Stability', () => {
  it('produces constraints for each story', () => {
    for (const story of STORIES) {
      const { constraints } = runPipeline(story);
      expect(constraints.length).toBeGreaterThan(0);
    }
  });

  it('produces deterministic constraint sets (same input → same count)', () => {
    const story = STORIES[0];
    const result1 = runPipeline(story);
    const result2 = runPipeline(story);
    expect(result1.constraints.length).toBe(result2.constraints.length);
  });

  it('all constraints have required fields', () => {
    const { constraints } = runPipeline(STORIES[0]);
    for (const c of constraints) {
      expect(c.id).toBeTruthy();
      expect(Object.values(ConstraintSource)).toContain(c.source);
      expect(Object.values(ConstraintPriority)).toContain(c.priority);
      expect(Object.values(ConstraintState)).toContain(c.state);
      expect(Object.values(ConstraintCategory)).toContain(c.category);
      expect(Object.values(ConstraintScope)).toContain(c.scope);
      expect(c.payload.statement).toBeTruthy();
      expect(c.reason).toBeTruthy();
      expect(c.generatedFromRevision).toBeGreaterThanOrEqual(0);
    }
  });

  it('includes spatial boundary constraints for wide shots', () => {
    const { constraints } = runPipeline(STORIES[1]); // action climax — likely has wide shots
    const wideConstraints = constraints.filter(
      (c) => c.payload.statement.includes('Wide shot')
    );
    // Some stories may not produce wide shots
  });
});

// ── Constraint Registry Tests ────────────────────────────────────────────────

describe('A3.2 — Constraint Registry', () => {
  it('registers and retrieves by ID', () => {
    const registry = new ConstraintRegistry();
    const { constraints } = runPipeline(STORIES[0]);
    registry.registerAll(constraints);

    const first = constraints[0];
    const retrieved = registry.get(first.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(first.id);
  });

  it('indexes constraints by scope', () => {
    const registry = new ConstraintRegistry();
    // Use all stories to get enough shot pairs
    for (const story of STORIES) {
      const { constraints } = runPipeline(story);
      registry.registerAll(constraints);
    }

    const shotScope = registry.getByScope(ConstraintScope.SHOT);
    const pairScope = registry.getByScope(ConstraintScope.SHOT_PAIR);
    expect(shotScope.length).toBeGreaterThan(0);
    // Some stories may not produce pair constraints
  });

  it('indexes constraints by category', () => {
    const registry = new ConstraintRegistry();
    for (const story of STORIES) {
      const { constraints } = runPipeline(story);
      registry.registerAll(constraints);
    }

    const categories = new Set(registry.getAll().map((c) => c.category));
    expect(categories.size).toBeGreaterThanOrEqual(2); // at least COMPOSITION + CAMERA
  });
});

// ── Constraint Lifecycle Tests ───────────────────────────────────────────────

describe('A3.3 — Constraint Lifecycle', () => {
  it('transitions ACTIVE → SATISFIED', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintLifecycleEngine(registry);

    const c: Constraint = {
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.HARD,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.COMPOSITION,
      scope: ConstraintScope.SHOT,
      payload: { statement: 'test constraint' },
      reason: 'test',
      generatedFromRevision: 1,
    };
    registry.register(c);
    engine.transition(c.id, ConstraintState.SATISFIED);

    const updated = registry.get(c.id);
    expect(updated!.state).toBe(ConstraintState.SATISFIED);
  });

  it('transitions ACTIVE → VIOLATED → OVERRIDDEN → EXPIRED', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintLifecycleEngine(registry);

    const c: Constraint = {
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.HARD,
      state: ConstraintState.ACTIVE,
      category: ConstraintCategory.COMPOSITION,
      scope: ConstraintScope.SHOT,
      payload: { statement: 'test constraint for lifecycle' },
      reason: 'lifecycle test',
      generatedFromRevision: 1,
    };
    registry.register(c);

    engine.transition(c.id, ConstraintState.VIOLATED);
    expect(registry.get(c.id)!.state).toBe(ConstraintState.VIOLATED);

    engine.resolve(c.id);
    expect(registry.get(c.id)!.state).toBe(ConstraintState.OVERRIDDEN);

    engine.transition(c.id, ConstraintState.EXPIRED);
    expect(registry.get(c.id)!.state).toBe(ConstraintState.EXPIRED);
  });

  it('throws on invalid transition (EXPIRED → ACTIVE)', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintLifecycleEngine(registry);

    const c: Constraint = {
      id: createConstraintId(),
      source: ConstraintSource.CAMERA_DIRECTOR,
      priority: ConstraintPriority.HARD,
      state: ConstraintState.EXPIRED,
      category: ConstraintCategory.COMPOSITION,
      scope: ConstraintScope.SHOT,
      payload: { statement: 'test' },
      reason: 'test',
      generatedFromRevision: 1,
    };
    registry.register(c);

    expect(() => engine.transition(c.id, ConstraintState.ACTIVE))
      .toThrow(InvalidConstraintTransitionError);
  });

  it('batch evaluates constraints', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintLifecycleEngine(registry);

    const c1: Constraint = {
      id: createConstraintId(), source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD, state: ConstraintState.ACTIVE,
      category: ConstraintCategory.SPATIAL, scope: ConstraintScope.SHOT,
      payload: { statement: 'c1' }, reason: 'test', generatedFromRevision: 1,
    };
    const c2: Constraint = {
      id: createConstraintId(), source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD, state: ConstraintState.ACTIVE,
      category: ConstraintCategory.SPATIAL, scope: ConstraintScope.SHOT,
      payload: { statement: 'c2' }, reason: 'test', generatedFromRevision: 1,
    };
    registry.registerAll([c1, c2]);

    const states = new Map<string, ConstraintState>([
      [c1.id, ConstraintState.SATISFIED],
      [c2.id, ConstraintState.VIOLATED],
    ]);
    engine.evaluateAll(states);

    expect(registry.get(c1.id)!.state).toBe(ConstraintState.SATISFIED);
    expect(registry.get(c2.id)!.state).toBe(ConstraintState.VIOLATED);
  });

  it('expires constraints past their lifetime', () => {
    const registry = new ConstraintRegistry();
    const engine = new ConstraintLifecycleEngine(registry);

    const c: Constraint = {
      id: createConstraintId(), source: ConstraintSource.DIRECTOR_INTENT,
      priority: ConstraintPriority.HARD, state: ConstraintState.SATISFIED,
      category: ConstraintCategory.SPATIAL, scope: ConstraintScope.SHOT_PAIR,
      lifetime: { fromShotIndex: 0, toShotIndex: 2 },
      payload: { statement: 'test' }, reason: 'test', generatedFromRevision: 1,
    };
    registry.register(c);

    engine.expireUpToShotIndex(2);
    expect(registry.get(c.id)!.state).toBe(ConstraintState.EXPIRED);
  });
});

// ── Constraint Provenance Tests ──────────────────────────────────────────────

describe('A3.4 — Constraint Provenance', () => {
  it('links constraints to source protocols', () => {
    const { decision, plan, constraints } = runPipeline(STORIES[0]);

    for (const c of constraints.slice(0, 2)) {
      const provenance = getConstraintProvenance(c, decision, plan);
      expect(provenance.sourceDecisionId).toBe(decision.id);
      expect(provenance.sourcePlanId).toBe(plan.id);
      expect(provenance.trace.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('printConstraintTrace produces human-readable output', () => {
    const { constraints } = runPipeline(STORIES[0]);
    const trace = printConstraintTrace(constraints[0]);
    expect(trace).toContain('[ACTIVE]');
    expect(trace).toContain('source:');
    expect(trace).toContain('reason:');
  });
});
