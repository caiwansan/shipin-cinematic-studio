/**
 * v1_2/stress/mutation-trigger-matrix.ts
 *
 * v1.2 Stress Phase — Mutation Trigger Matrix
 *
 * MUT(i, j) = f(invariant_violation, topology_shift, capability_break, projection_conflict)
 *
 * 四个触发维度完全独立。
 * MUT ≠ "新分类"。MUT = "分类失败事件"。
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import { InvariantPreservation } from "../../v1_1/invariant-preservation";
import type { FamilyConfig } from "../taxonomic-classifier";

// ─── Mutation Trigger Dimensions ───

export interface MutationTriggerResult {
  /** 是否触发突变 */
  triggered: boolean;

  /** 各维度得分 */
  invariantViolation: number;   // 0-1, 1 = 完全违反
  topologyShift: number;        // 0-1, 1 = 完全偏离
  capabilityBreak: number;      // 0-1, 1 = 能力闭合失败
  projectionConflict: number;   // 0-1, 1 = 分类投影不一致

  /** 突变类型 */
  mutationType: "CONSERVATIVE" | "DRIFT" | "RUPTURE" | "NONE";

  /** 强度 */
  intensity: number;
}

export class MutationTriggerMatrix {
  private preservation = new InvariantPreservation();

  /**
   * 计算 MUT(i, j) — 系统 i 相对于 family j 的突变触发状态。
   */
  evaluate(
    system: SystemInstance,
    family: FamilyConfig
  ): MutationTriggerResult {
    const invariants = this.measureInvariantViolation(system, family);
    const topologyShift = this.measureTopologyShift(system, family);
    const capabilityBreak = this.measureCapabilityBreak(system, family);
    const projectionConflict = this.measureProjectionConflict(system, family);

    const intensity =
      invariants * 0.4 +
      topologyShift * 0.25 +
      capabilityBreak * 0.2 +
      projectionConflict * 0.15;

    const triggered =
      invariants > 0.5 ||
      topologyShift > 0.5 ||
      capabilityBreak > 0.5 ||
      projectionConflict > 0.5 ||
      intensity > 0.3;

    return {
      triggered,
      invariantViolation: invariants,
      topologyShift,
      capabilityBreak,
      projectionConflict,
      mutationType: this.classifyMutation(intensity, invariants),
      intensity,
    };
  }

  /**
   * 维度 1: Invariant Violation
   * Π 的逆指标 — 1 - Π
   * 1 = 完全不变量破坏，0 = 完美保持
   */
  private measureInvariantViolation(
    system: SystemInstance,
    family: FamilyConfig
  ): number {
    const result = this.preservation.check(family.referenceSystem, system);
    return 1 - result.preservationScore;
  }

  /**
   * 维度 2: Topology Shift
   * operator 集合的大小/结构差异度
   */
  private measureTopologyShift(
    system: SystemInstance,
    family: FamilyConfig
  ): number {
    const refOps = family.referenceSystem.operators;
    const sysOps = system.operators;

    const refCount = refOps.size;
    const sysCount = sysOps.size;

    if (refCount === 0 && sysCount === 0) return 0;

    // 重叠率 + 大小差异
    let overlap = 0;
    for (const name of sysOps.keys()) {
      if (refOps.has(name)) overlap++;
    }

    const maxSize = Math.max(refCount, sysCount);
    const overlapRatio = maxSize > 0 ? overlap / maxSize : 0;
    const sizeDiff = maxSize > 0 ? Math.abs(refCount - sysCount) / maxSize : 0;

    // 无重叠 + 大小接近 = 拓扑完全偏离 (shift = 1)
    // 完全重叠 + 大小相等 = 拓扑一致 (shift = 0)
    return (1 - overlapRatio) * 0.6 + sizeDiff * 0.4;
  }

  /**
   * 维度 3: Capability Break
   * 能力闭合失败度 — 检查是否缺少执行系统所需的最小结构
   */
  private measureCapabilityBreak(
    system: SystemInstance,
    _family: FamilyConfig
  ): number {
    const ops = Array.from(system.operators.values());

    // 执行系统的最小能力层
    const hasExecution = ops.some((op) =>
      op.id.includes("execution") || op.id.includes("engine")
    );
    const hasTransformation = ops.length >= 2; // 至少 2 个 δ
    const hasTraceable = true; // 所有 δ 都可以 trace

    const missing = [hasExecution, hasTransformation, hasTraceable].filter(
      (v) => !v
    ).length;

    return missing / 3;
  }

  /**
   * 维度 4: Projection Conflict
   * 分类投影不一致度 — system 被分类到多个 family 时的置信度落差
   */
  private measureProjectionConflict(
    _system: SystemInstance,
    _family: FamilyConfig
  ): number {
    // 简版：当前只有两个 family，投影冲突度暂为默认
    // 完整版需要跨所有 known families 的评分分布方差
    return 0;
  }

  /**
   * 基于强度和不变量退化度分类突变类型。
   */
  private classifyMutation(
    intensity: number,
    invariantViolation: number
  ): "CONSERVATIVE" | "DRIFT" | "RUPTURE" | "NONE" {
    if (intensity > 0.6 && invariantViolation > 0.5) return "RUPTURE";
    if (intensity > 0.3 || invariantViolation > 0.22) return "DRIFT";
    if (intensity > 0.1) return "CONSERVATIVE";
    return "NONE";
  }
}
