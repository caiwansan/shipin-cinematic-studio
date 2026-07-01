/**
 * Demand Corpus — In-memory Store
 *
 * P0-T003: Natural Demand Corpus Foundation
 * CRUD + filtering by scenarioId / industryId / entityType
 */

import { DemandExpression } from './types';
import { seedDemandExpressions } from './seed-data';

export class DemandStore {
  private items: Map<string, DemandExpression>;

  constructor() {
    this.items = new Map(seedDemandExpressions.map((d) => [d.id, { ...d }]));
  }

  // ── CRUD ───────────────────────────────────────────────────────

  list(): DemandExpression[] {
    return Array.from(this.items.values()).map((d) => ({ ...d }));
  }

  get(id: string): DemandExpression | undefined {
    const d = this.items.get(id);
    return d ? { ...d } : undefined;
  }

  create(data: DemandExpression): DemandExpression {
    if (this.items.has(data.id)) {
      throw new Error(`DemandExpression with id '${data.id}' already exists`);
    }
    this.items.set(data.id, { ...data });
    return { ...data };
  }

  update(id: string, data: Partial<DemandExpression>): DemandExpression | undefined {
    const existing = this.items.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id };
    this.items.set(id, updated);
    return { ...updated };
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  // ── Query / Filter ─────────────────────────────────────────────

  /** Filter by scenarioId (exact match) */
  findByScenarioId(scenarioId: string): DemandExpression[] {
    return this.list().filter((d) => d.scenarioId === scenarioId);
  }

  /** Filter by industryId (exact match) */
  findByIndustryId(industryId: string): DemandExpression[] {
    return this.list().filter((d) => d.industryId === industryId);
  }

  /** Filter by entityType (exact match) */
  findByEntityType(entityType: string): DemandExpression[] {
    return this.list().filter((d) => d.entityType === entityType);
  }

  /** Combined filter: supports all optional fields */
  find(filters: {
    scenarioId?: string;
    industryId?: string;
    entityType?: string;
  }): DemandExpression[] {
    return this.list().filter((d) => {
      if (filters.scenarioId && d.scenarioId !== filters.scenarioId) return false;
      if (filters.industryId && d.industryId !== filters.industryId) return false;
      if (filters.entityType && d.entityType !== filters.entityType) return false;
      return true;
    });
  }

  /** Total count */
  count(): number {
    return this.items.size;
  }

  /** Reset to seed data */
  reset(): void {
    this.items = new Map(seedDemandExpressions.map((d) => [d.id, { ...d }]));
  }
}

/** Singleton instance */
export const demandStore = new DemandStore();
