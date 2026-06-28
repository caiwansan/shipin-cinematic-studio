/**
 * drift/adapter-regression-monitor.ts
 *
 * Adapter Regression Monitor
 *
 * 监控 adapter 版本变更前后的 fidelity 稳定度。
 * 当 adapter version 变化时，对比前后记录的 fidelity 是否退化。
 *
 * 铁律：
 * - 只标记 regression 是否发生
 * - 不解释原因
 * - 不推断根因
 */

import type { DriftRecord } from "./types";

export interface RegressionResult {
  stable: boolean;
  degraded: boolean;
  versionChanged: boolean;
  oldVersion: string;
  newVersion: string;
  delta: number;
}

export class AdapterRegressionMonitor {
  /**
   * 检查最近两条同 domain 记录是否出现 regression。
   */
  check(records: DriftRecord[]): RegressionResult {
    if (records.length < 2) {
      return {
        stable: false,
        degraded: false,
        versionChanged: false,
        oldVersion: "",
        newVersion: "",
        delta: 0,
      };
    }

    const latest = records[records.length - 1];
    const prev = records[records.length - 2];
    const versionChanged = latest.adapterVersion !== prev.adapterVersion;
    const degraded = latest.fidelityScore < prev.fidelityScore;

    return {
      stable: !degraded,
      degraded,
      versionChanged,
      oldVersion: prev.adapterVersion,
      newVersion: latest.adapterVersion,
      delta: +(latest.fidelityScore - prev.fidelityScore).toFixed(4),
    };
  }

  /**
   * 跨版本快照对比 —— 当 adapter version 不同时分别检查。
   */
  versionBoundedCheck(
    records: DriftRecord[]
  ): RegressionResult[] {
    const results: RegressionResult[] = [];
    for (let i = 1; i < records.length; i++) {
      const prev = records[i - 1];
      const curr = records[i];
      if (prev.adapterVersion !== curr.adapterVersion) {
        results.push({
          stable: curr.fidelityScore === prev.fidelityScore,
          degraded: curr.fidelityScore < prev.fidelityScore,
          versionChanged: true,
          oldVersion: prev.adapterVersion,
          newVersion: curr.adapterVersion,
          delta: +(curr.fidelityScore - prev.fidelityScore).toFixed(4),
        });
      }
    }
    return results;
  }
}
