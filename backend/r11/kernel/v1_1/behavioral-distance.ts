/**
 * v1_1/behavioral-distance.ts
 *
 * v1.1 — Behavioral Distance Metric (D)
 *
 * 核心度量：两个 δ 系统之间的行为距离。
 *
 * 三元距离函数：
 * D(δᵢ, δⱼ) = (replayDiff, driftDiff, causalDiff)
 *
 * 0 = 完全相同，越大 = 行为差异越大
 */

import type { ExecutionOperator } from "../r10_5/execution-operator";
import type { ExecutionTraceEntry } from "../r10_5/execution-operator";

export interface DistanceReport {
  replayDiff: number;
  driftDiff: number;
  causalDiff: number;
  compositeScore: number;
}

export class BehavioralDistance {
  /**
   * 计算两个 δ 系统之间的距离。
   *
   * @param deltaA — 系统 A 的 δ 实例
   * @param deltaB — 系统 B 的 δ 实例
   * @param traceA — 系统 A 的执行 trace
   * @param traceB — 系统 B 的执行 trace
   */
  distance(
    deltaA: ExecutionOperator,
    deltaB: ExecutionOperator,
    traceA: ExecutionTraceEntry[],
    traceB: ExecutionTraceEntry[]
  ): DistanceReport {
    const replayDiff = this.replayDistance(traceA, traceB);
    const driftDiff = this.driftDistance(traceA, traceB, deltaA, deltaB);
    const causalDiff = this.causalTopologyDistance(traceA, traceB);

    return {
      replayDiff,
      driftDiff,
      causalDiff,
      compositeScore: (replayDiff + driftDiff + causalDiff) / 3,
    };
  }

  /**
   * Replay distance: 相同输入下的输出 hash 差异比例。
   * 比较 trace entries 的 input/output hash pair。
   */
  private replayDistance(
    traceA: ExecutionTraceEntry[],
    traceB: ExecutionTraceEntry[]
  ): number {
    const minLen = Math.min(traceA.length, traceB.length);
    if (minLen === 0) return 1;

    let mismatched = 0;
    for (let i = 0; i < minLen; i++) {
      const a = traceA[i];
      const b = traceB[i];
      if (a.inputStateHash !== b.inputStateHash) mismatched++;
      if (a.outputStateHash !== b.outputStateHash) mismatched++;
    }

    return mismatched / (minLen * 2);
  }

  /**
   * Drift distance: trace 结构的漂移程度。
   * 检查 operator 序列、hash 变化趋势的差异。
   */
  private driftDistance(
    traceA: ExecutionTraceEntry[],
    traceB: ExecutionTraceEntry[],
    _deltaA: ExecutionOperator,
    _deltaB: ExecutionOperator
  ): number {
    const minLen = Math.min(traceA.length, traceB.length);
    if (minLen === 0) return 1;

    // operator 序列一致性
    let seqMismatch = 0;
    for (let i = 0; i < minLen; i++) {
      if (traceA[i].operatorId !== traceB[i].operatorId) seqMismatch++;
    }

    // state change pattern
    let changePatternDiff = 0;
    for (let i = 0; i < minLen; i++) {
      const aChanged = traceA[i].inputStateHash !== traceA[i].outputStateHash;
      const bChanged = traceB[i].inputStateHash !== traceB[i].outputStateHash;
      if (aChanged !== bChanged) changePatternDiff++;
    }

    // hash 演化趋势
    let hashTrendADiff = 0;
    let hashTrendBDiff = 0;
    for (let i = 1; i < minLen; i++) {
      if (traceA[i].outputStateHash !== traceA[i - 1].outputStateHash)
        hashTrendADiff++;
      if (traceB[i].outputStateHash !== traceB[i - 1].outputStateHash)
        hashTrendBDiff++;
    }
    const trendRatio =
      minLen > 1
        ? Math.abs(hashTrendADiff - hashTrendBDiff) / (minLen - 1)
        : 0;

    return (seqMismatch / minLen + changePatternDiff / minLen + trendRatio) / 3;
  }

  /**
   * Causal topology distance: 因果拓扑结构差异。
   * 检查 trace 中 state change pattern 的分布差异。
   * 如果两个系统在相同的 operator 上产生一致的 state change，
   * 则因果拓扑更接近。
   */
  private causalTopologyDistance(
    traceA: ExecutionTraceEntry[],
    traceB: ExecutionTraceEntry[]
  ): number {
    const minLen = Math.min(traceA.length, traceB.length);
    if (minLen === 0) return 1;

    // 计算每个 step 的 state 变化量（hash 是否变化）
    const changesA = traceA.map(
      (e) => (e.inputStateHash !== e.outputStateHash ? 1 : 0)
    );
    const changesB = traceB.map(
      (e) => (e.inputStateHash !== e.outputStateHash ? 1 : 0)
    );

    // 余弦相似度（变化向量）
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < minLen; i++) {
      dotProduct += changesA[i] * changesB[i];
      normA += changesA[i] * changesA[i];
      normB += changesB[i] * changesB[i];
    }

    const cosineSim =
      normA > 0 && normB > 0
        ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
        : normA === normB
          ? 1
          : 0;

    // cosineSim = 1 表示相同拓扑，cosineSim = 0 表示正交拓扑
    return 1 - cosineSim;
  }
}
