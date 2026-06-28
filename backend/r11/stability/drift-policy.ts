/**
 * stability/drift-policy.ts
 *
 * Phase 4 — Drift Policy Engine
 *
 * 将观测结果（fidelity score）转换为约束决策（OK / WARN / BLOCK）。
 *
 * 铁律：
 * - 只做阈值比较，不做自动修复
 * - 全部 policy feature-gated 可关闭
 * - 不改变 R10/R11 核心逻辑
 */

export interface DriftPolicy {
  domain: string;
  warnThreshold: number;
  blockThreshold: number;
  enabled: boolean;
}

export type DriftStatus = "OK" | "WARN" | "BLOCK";

export interface DriftDecision {
  status: DriftStatus;
  reason?: string;
  fidelity: number;
  warnThreshold: number;
  blockThreshold: number;
}

const DEFAULT_POLICIES: Record<string, Omit<DriftPolicy, "domain">> = {
  default: { warnThreshold: 0.98, blockThreshold: 0.95, enabled: true },
};

export class DriftPolicyEngine {
  private policies: Map<string, DriftPolicy> = new Map();

  constructor() {
    this.setDefaultPolicy("default");
  }

  /**
   * Set a policy for a domain.
   */
  setPolicy(domain: string, policy: Omit<DriftPolicy, "domain">): void {
    this.policies.set(domain, { domain, ...policy });
  }

  /**
   * Get the effective policy for a domain (domain-specific or default).
   */
  getPolicy(domain: string): DriftPolicy {
    return this.policies.get(domain) ?? this.policies.get("default")!;
  }

  /**
   * Reset to default for a domain.
   */
  resetPolicy(domain: string): void {
    this.policies.delete(domain);
  }

  /**
   * Evaluate fidelity against policy.
   * BLOCK > WARN > OK (highest severity wins).
   */
  evaluate(domain: string, fidelity: number): DriftDecision {
    const policy = this.getPolicy(domain);

    if (!policy.enabled) {
      return {
        status: "OK",
        fidelity,
        warnThreshold: policy.warnThreshold,
        blockThreshold: policy.blockThreshold,
      };
    }

    if (fidelity < policy.blockThreshold) {
      return {
        status: "BLOCK",
        reason: `fidelity ${fidelity.toFixed(4)} < blockThreshold ${policy.blockThreshold}`,
        fidelity,
        warnThreshold: policy.warnThreshold,
        blockThreshold: policy.blockThreshold,
      };
    }

    if (fidelity < policy.warnThreshold) {
      return {
        status: "WARN",
        reason: `fidelity ${fidelity.toFixed(4)} < warnThreshold ${policy.warnThreshold}`,
        fidelity,
        warnThreshold: policy.warnThreshold,
        blockThreshold: policy.blockThreshold,
      };
    }

    return {
      status: "OK",
      fidelity,
      warnThreshold: policy.warnThreshold,
      blockThreshold: policy.blockThreshold,
    };
  }

  /**
   * Get all registered policies.
   */
  listPolicies(): DriftPolicy[] {
    return Array.from(this.policies.values());
  }

  private setDefaultPolicy(domain: string): void {
    this.policies.set(domain, {
      domain,
      ...DEFAULT_POLICIES.default,
    });
  }
}
