/**
 * r11/test/phase2-runner.ts
 *
 * Phase 2 — 统一验证入口
 *
 * 组合 FidelityTest + ReplayConsistencyTest 为单一验证管线。
 *
 * 输出 verdict：
 *   pass = fidelityScore > 0.95 && replay stable === true
 *   报告每个 domain 的完整 fidelity + replay 详情
 */

import { AdapterRegistry } from "../adapter/adapter-registry";
import { R11Service } from "../r11-service";
import { FidelityTest, type FidelityReport } from "./fidelity-test";
import { ReplayConsistencyTest, type ReplayConsistencyReport } from "./replay-consistency-test";

export interface Phase2Report {
  timestamp: string;
  domains: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: Array<{
    domain: string;
    fidelity: FidelityReport;
    replay: ReplayConsistencyReport | null;
    verdict: {
      pass: boolean;
      confidence: number;
      reason: string;
    };
  }>;
}

export class Phase2Runner {
  private fidelity: FidelityTest;
  private replay: ReplayConsistencyTest;

  constructor(
    registryOrR11: AdapterRegistry | R11Service,
    private r11?: R11Service
  ) {
    if (registryOrR11 instanceof AdapterRegistry) {
      this.fidelity = new FidelityTest(registryOrR11);
      this.replay = new ReplayConsistencyTest(
        this.r11 || new R11Service()
      );
    } else {
      this.fidelity = new FidelityTest(registryOrR11.getRegistry());
      this.replay = new ReplayConsistencyTest(registryOrR11);
    }
  }

  async run(
    testCases: Map<string, any>,
    replayIterations: number = 3
  ): Promise<Phase2Report> {
    // Run fidelity tests for all domains in parallel
    const fidelityResults = await this.fidelity.runAll(testCases);

    // Run replay tests for all domains
    const replayResults = await this.replay.runAll(testCases, replayIterations);

    // Combine into per-domain results
    const fidelityMap = new Map(fidelityResults.map((r) => [r.domain, r]));
    const replayMap = new Map(replayResults.map((r) => [r.domain, r]));

    const domains = Array.from(testCases.keys());
    const results: Phase2Report["results"] = [];
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const domain of domains) {
      const fResult = fidelityMap.get(domain);
      const rResult = replayMap.get(domain) || null;

      if (!fResult) continue;

      const fidelityPass = fResult.fidelityScore > 0.95;
      const replayPass = rResult ? rResult.stable : true;
      const isWarning =
        !fidelityPass && fResult.fidelityScore > 0.8;

      const pass = fidelityPass && replayPass;

      let reason = "";
      if (pass) {
        reason = `fidelity=${(fResult.fidelityScore * 100).toFixed(1)}%`;
        if (rResult) reason += `, replay=${rResult.iterations}x stable`;
      } else {
        const failures: string[] = [];
        if (!fidelityPass) failures.push(`fidelity ${(fResult.fidelityScore * 100).toFixed(1)}%`);
        if (rResult && !rResult.stable) failures.push(`replay unstable (${rResult.divergences} divergences)`);
        reason = failures.join("; ");
      }

      results.push({
        domain,
        fidelity: fResult,
        replay: rResult,
        verdict: {
          pass,
          confidence: Math.round(fResult.fidelityScore * 1000) / 1000,
          reason,
        },
      });

      if (pass) passed++;
      else if (isWarning) warnings++;
      else failed++;
    }

    return {
      timestamp: new Date().toISOString(),
      domains,
      summary: {
        total: domains.length,
        passed,
        failed,
        warnings,
      },
      results,
    };
  }

  /**
   * Print human-readable Phase 2 report.
   */
  printReport(report: Phase2Report): string {
    const lines: string[] = [];
    lines.push(`\n=== R11 Phase 2 Verification Report ===`);
    lines.push(`Timestamp: ${report.timestamp}`);
    lines.push(`\nSummary: ${report.summary.passed}/${report.summary.total} passed`);
    if (report.summary.warnings > 0) lines.push(`  ⚠ ${report.summary.warnings} warnings`);
    if (report.summary.failed > 0) lines.push(`  ❌ ${report.summary.failed} failed`);

    for (const r of report.results) {
      const icon = r.verdict.pass ? "✅" : r.fidelity.fidelityScore > 0.8 ? "⚠️" : "❌";
      lines.push(`\n${icon} ${r.domain}`);
      lines.push(`   Fidelity:  ${(r.fidelity.fidelityScore * 100).toFixed(1)}%`);
      lines.push(`   NodeLoss:  ${r.fidelity.nodeLoss}  EdgeLoss: ${r.fidelity.edgeLoss}`);
      lines.push(`   Semantic:  ${(r.fidelity.semanticRetention * 100).toFixed(1)}%`);
      if (r.replay) {
        lines.push(`   Replay:    ${r.replay.stable ? "stable" : "UNSTABLE"} (${r.replay.iterations}x, ${r.replay.divergences} divergences)`);
      }
      if (r.verdict.reason) {
        lines.push(`   Verdict:   ${r.verdict.reason}`);
      }
      if (r.fidelity.issues.length > 0) {
        for (const issue of r.fidelity.issues.slice(0, 3)) {
          lines.push(`   ⚠ ${issue}`);
        }
      }
    }

    lines.push(`\n=== End Report ===`);
    return lines.join("\n");
  }
}
