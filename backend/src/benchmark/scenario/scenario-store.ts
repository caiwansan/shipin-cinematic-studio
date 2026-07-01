import { Industry, Scenario } from './types';
import { seedIndustries, seedScenarios } from './seed-data';

/**
 * In-memory Scenario Store
 * Supports CRUD for industries and scenarios + filtering by industryId
 */
export class ScenarioStore {
  private industries: Map<string, Industry>;
  private scenarios: Map<string, Scenario>;

  constructor() {
    this.industries = new Map(seedIndustries.map((i) => [i.id, { ...i }]));
    this.scenarios = new Map(seedScenarios.map((s) => [s.id, this.deepCloneScenario(s)]));
  }

  // ── Industry CRUD ──────────────────────────────────────────────

  listIndustries(): Industry[] {
    return Array.from(this.industries.values());
  }

  getIndustry(id: string): Industry | undefined {
    return this.industries.get(id);
  }

  createIndustry(industry: Industry): Industry {
    if (this.industries.has(industry.id)) {
      throw new Error(`Industry with id '${industry.id}' already exists`);
    }
    this.industries.set(industry.id, { ...industry });
    return { ...industry };
  }

  updateIndustry(id: string, data: Partial<Industry>): Industry | undefined {
    const existing = this.industries.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id };
    this.industries.set(id, updated);
    return { ...updated };
  }

  deleteIndustry(id: string): boolean {
    return this.industries.delete(id);
  }

  // ── Scenario CRUD ─────────────────────────────────────────────

  listScenarios(): Scenario[] {
    return Array.from(this.scenarios.values()).map((s) => this.deepCloneScenario(s));
  }

  getScenario(id: string): Scenario | undefined {
    const s = this.scenarios.get(id);
    return s ? this.deepCloneScenario(s) : undefined;
  }

  createScenario(scenario: Scenario): Scenario {
    if (this.scenarios.has(scenario.id)) {
      throw new Error(`Scenario with id '${scenario.id}' already exists`);
    }
    this.scenarios.set(scenario.id, this.deepCloneScenario(scenario));
    return this.deepCloneScenario(scenario);
  }

  updateScenario(id: string, data: Partial<Scenario>): Scenario | undefined {
    const existing = this.scenarios.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, id };
    // Preserve intents if not being replaced
    if (!data.intents) {
      updated.intents = existing.intents;
    }
    this.scenarios.set(id, this.deepCloneScenario(updated));
    return this.deepCloneScenario(updated);
  }

  deleteScenario(id: string): boolean {
    return this.scenarios.delete(id);
  }

  // ── Query ──────────────────────────────────────────────────────

  /** Get all scenarios for a given industry */
  getScenariosByIndustry(industryId: string): Scenario[] {
    return Array.from(this.scenarios.values())
      .filter((s) => s.industryId === industryId)
      .map((s) => this.deepCloneScenario(s));
  }

  /** Get all scenarios grouped by industry */
  getScenarioTree(): { industry: Industry; scenarios: Scenario[] }[] {
    return this.listIndustries().map((industry) => ({
      industry,
      scenarios: this.getScenariosByIndustry(industry.id),
    }));
  }

  // ── Helpers ────────────────────────────────────────────────────

  private deepCloneScenario(s: Scenario): Scenario {
    return {
      ...s,
      intents: s.intents.map((intent) => ({
        ...intent,
        naturalExpressions: [...intent.naturalExpressions],
        representativeQuestions: [...intent.representativeQuestions],
      })),
    };
  }

  /** Reset store to seed data */
  reset(): void {
    this.industries = new Map(seedIndustries.map((i) => [i.id, { ...i }]));
    this.scenarios = new Map(seedScenarios.map((s) => [s.id, this.deepCloneScenario(s)]));
  }
}

/** Singleton instance */
export const scenarioStore = new ScenarioStore();
