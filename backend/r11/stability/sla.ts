/**
 * stability/sla.ts
 *
 * Phase 4 — System Stability SLA
 *
 * SLA = Service Level Agreement for projection stability.
 * 定义每个 domain 的 fidelity 基线 + drift 预算。
 *
 * 铁律：
 * - 不做自动修复
 * - 不修改系统状态
 * - 结果全部只读
 */

export interface StabilitySLA {
  domain: string;
  baselineFidelity: number;
  driftBudget: number;
}

export interface SLACheckResult {
  ok: boolean;
  deviation: number;
  baseline: number;
  current: number;
  budget: number;
}

const DEFAULT_SLAS: Record<string, Omit<StabilitySLA, "domain">> = {
  "agent-graph": { baselineFidelity: 1.0, driftBudget: 0.02 },
  "decision-graph": { baselineFidelity: 1.0, driftBudget: 0.02 },
  "character-image-dag": { baselineFidelity: 1.0, driftBudget: 0.02 },
  "prompt-version-graph": { baselineFidelity: 1.0, driftBudget: 0.02 },
};

export class StabilitySLAEngine {
  private slas: Map<string, StabilitySLA> = new Map();

  constructor() {
    for (const [domain, sla] of Object.entries(DEFAULT_SLAS)) {
      this.slas.set(domain, { domain, ...sla });
    }
  }

  /**
   * Set SLA for a domain.
   */
  setSLA(domain: string, sla: Omit<StabilitySLA, "domain">): void {
    this.slas.set(domain, { domain, ...sla });
  }

  /**
   * Get SLA for a domain (falls back to default).
   */
  getSLA(domain: string): StabilitySLA | null {
    return this.slas.get(domain) ?? null;
  }

  /**
   * Check fidelity history against SLA.
   * Returns ok=true if latest fidelity is within driftBudget of baseline.
   */
  check(domain: string, history: number[]): SLACheckResult {
    const sla = this.slas.get(domain);
    if (!sla || history.length === 0) {
      return { ok: true, deviation: 0, baseline: 1.0, current: 1.0, budget: 0.02 };
    }

    const current = history[history.length - 1];
    const deviation = sla.baselineFidelity - current;

    return {
      ok: deviation <= sla.driftBudget,
      deviation,
      baseline: sla.baselineFidelity,
      current,
      budget: sla.driftBudget,
    };
  }

  /**
   * List all registered SLAs.
   */
  listSLAs(): StabilitySLA[] {
    return Array.from(this.slas.values());
  }

  /**
   * Reset SLA for a domain to default.
   */
  resetSLA(domain: string): void {
    const def = DEFAULT_SLAS[domain];
    if (def) {
      this.slas.set(domain, { domain, ...def });
    } else {
      this.slas.delete(domain);
    }
  }
}
