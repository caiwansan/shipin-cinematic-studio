/**
 * stability/r11-stability-service.ts
 *
 * Phase 4 — R11 Stability Service（统一入口）
 *
 * 组合政策引擎、适配器治理、SLA 检查为一层。
 * 供 R11UI 层和路由层调用。
 *
 * 铁律：
 * - 全部只做判断，不做执行
 * - 不修改任何下层结构
 * - 不自动修复
 */

import { DriftPolicyEngine, type DriftDecision } from "./drift-policy";
import { AdapterGovernance, type AdapterVersion } from "./adapter-governance";
import { StabilitySLAEngine, type SLACheckResult, type StabilitySLA } from "./sla";

export * from "./drift-policy";
export * from "./adapter-governance";
export * from "./sla";

export interface StabilityEvaluation {
  domain: string;
  drift: DriftDecision;
  sla: SLACheckResult;
  adapter: AdapterVersion | null;
  adapterLocked: boolean;
  evaluationPassed: boolean;
}

export class R11StabilityService {
  readonly driftPolicy = new DriftPolicyEngine();
  readonly adapterGov = new AdapterGovernance();
  readonly slaEngine = new StabilitySLAEngine();

  /**
   * 统一稳定性评估。
   * 针对一个 domain 的当前 fidelity 和历史数据，给出综合判断。
   */
  evaluate(domain: string, fidelity: number, history: number[]): StabilityEvaluation {
    const drift = this.driftPolicy.evaluate(domain, fidelity);
    const sla = this.slaEngine.check(domain, history);
    const adapter = this.adapterGov.get(domain);

    return {
      domain,
      drift,
      sla,
      adapter: adapter ?? null,
      adapterLocked: adapter?.locked ?? false,
      // 综合：drift + SLA 都 OK 才算通过
      evaluationPassed: drift.status === "OK" && sla.ok,
    };
  }

  /**
   * 检查 adapter 是否可以更新。
   */
  canUpdateAdapter(domain: string, newVersion: string): { allowed: boolean; reason?: string } {
    if (!this.adapterGov.canUpdate(domain, newVersion)) {
      const current = this.adapterGov.get(domain);
      return {
        allowed: false,
        reason: current?.locked
          ? `Adapter ${domain}@${current?.version} is locked`
          : `Adapter ${domain} is at version ${current?.version}`,
      };
    }
    return { allowed: true };
  }
}
