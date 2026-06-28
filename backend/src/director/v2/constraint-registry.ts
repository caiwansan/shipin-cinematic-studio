// ============================================================================
// A3.2 Constraint Registry — Runtime constraint tracking
//
// Provides indexed access to all constraints by constraintId, shotIndex,
// category, and scope. Enables Recovery to find constraints without
// re-scanning ExecutionPlans.
// ============================================================================

import type { Constraint, ConstraintId } from '@director-v2/protocols/constraint/constraint';
import { ConstraintState } from '@director-v2/protocols/constraint/constraint';

export class ConstraintRegistry {
  private constraints = new Map<ConstraintId, Constraint>();
  private byShotIndex = new Map<number, Constraint[]>();
  private byScope = new Map<string, Constraint[]>();
  private byCategory = new Map<string, Constraint[]>();

  register(constraint: Constraint): void {
    this.constraints.set(constraint.id, constraint);
    this.indexBy(constraint);
  }

  registerAll(constraints: Constraint[]): void {
    constraints.forEach((c) => this.register(c));
  }

  get(constraintId: ConstraintId): Constraint | undefined {
    return this.constraints.get(constraintId);
  }

  getAll(): Constraint[] {
    return Array.from(this.constraints.values());
  }

  getByShotIndex(shotIndex: number): Constraint[] {
    return this.byShotIndex.get(shotIndex) ?? [];
  }

  getByScope(scope: string): Constraint[] {
    return this.byScope.get(scope) ?? [];
  }

  getByCategory(category: string): Constraint[] {
    return this.byCategory.get(category) ?? [];
  }

  updateState(constraintId: ConstraintId, newState: ConstraintState): void {
    const c = this.constraints.get(constraintId);
    if (c) {
      c.state = newState;
    }
  }

  clear(): void {
    this.constraints.clear();
    this.byShotIndex.clear();
    this.byScope.clear();
    this.byCategory.clear();
  }

  get count(): number {
    return this.constraints.size;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private indexBy(constraint: Constraint): void {
    // By shot index (infer from lifetime or scope)
    if (constraint.lifetime) {
      for (let i = constraint.lifetime.fromShotIndex; i <= constraint.lifetime.toShotIndex; i++) {
        this.addToMapArray(this.byShotIndex, i, constraint);
      }
    }

    // By scope
    this.addToMapArray(this.byScope, constraint.scope, constraint);

    // By category
    this.addToMapArray(this.byCategory, constraint.category, constraint);
  }

  private addToMapArray<K>(map: Map<K, Constraint[]>, key: K, value: Constraint): void {
    const arr = map.get(key) ?? [];
    arr.push(value);
    map.set(key, arr);
  }
}
