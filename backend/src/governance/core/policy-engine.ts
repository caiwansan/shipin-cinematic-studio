import { SystemLayer, LayerRules } from './layer-definitions.js';

export interface Violation {
  file: string;
  line: number;
  layer: SystemLayer;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export type PolicyMode = 'observe' | 'warn' | 'block';

export class PolicyEngine {
  private violations: Violation[] = [];
  private mode: PolicyMode = 'observe';

  constructor(mode: PolicyMode = 'observe') {
    this.mode = mode;
  }

  setMode(mode: PolicyMode): void {
    this.mode = mode;
    console.log(`[Governance] Policy mode: ${mode}`);
  }

  report(violation: Violation): void {
    this.violations.push(violation);
    const prefix = this.mode === 'block' ? '❌ BLOCKED' : this.mode === 'warn' ? '⚠️ WARN' : '🔍 OBSERVE';
    console.log(`[Governance] ${prefix} ${violation.file}:${violation.line} — ${violation.message}`);
    if (this.mode === 'block' && violation.severity === 'HIGH') {
      throw new Error(`[Governance] CONTRACT VIOLATION: ${violation.message}`);
    }
  }

  getViolations(): Violation[] {
    return [...this.violations];
  }

  getSummary(): { total: number; bySeverity: Record<string, number> } {
    const bySeverity: Record<string, number> = {};
    for (const v of this.violations) {
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    }
    return { total: this.violations.length, bySeverity };
  }

  getMode(): PolicyMode {
    return this.mode;
  }
}

export const governanceEngine = new PolicyEngine();
