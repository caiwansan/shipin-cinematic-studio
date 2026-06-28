/**
 * drift/drift-detector.ts
 *
 * Drift 检测器 — 连续 DriftRecord 间的差异比较
 *
 * - 只做 hash diff + fidelity delta
 * - 不输出解释性标签
 * - regression = fidelityScore 下降
 */

import type { DriftRecord, DriftDelta, DriftReport } from "./types";

export class DriftDetector {
  /**
   * 比较两条相邻记录的 drift。
   * prev 必须早于 curr（调用者保证时序）。
   */
  detect(prev: DriftRecord, curr: DriftRecord): DriftDelta {
    return {
      projectionDrift: prev.projectionHash !== curr.projectionHash,
      replayDrift: prev.replayHash !== curr.replayHash,
      fidelityDelta: +(curr.fidelityScore - prev.fidelityScore).toFixed(4),
      regression: curr.fidelityScore < prev.fidelityScore,
    };
  }

  /**
   * 生成全部 drift 报告，含按 domain 分组的历史。
   */
  generateReport(records: DriftRecord[]): DriftReport {
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const domains = [...new Set(sorted.map((r) => r.domain))];

    const deltas = [];
    for (let i = 1; i < sorted.length; i++) {
      deltas.push({
        fromIdx: i - 1,
        toIdx: i,
        delta: this.detect(sorted[i - 1], sorted[i]),
      });
    }

    return {
      totalRecords: sorted.length,
      domains,
      latestRecord: sorted.length > 0 ? sorted[sorted.length - 1] : null,
      deltas,
      regressions: deltas.filter((d) => d.delta.regression).map((d) => d.delta),
    };
  }
}
