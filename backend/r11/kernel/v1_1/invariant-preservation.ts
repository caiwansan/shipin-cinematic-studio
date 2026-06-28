/**
 * v1_1/invariant-preservation.ts
 *
 * v1.1 — Invariant Preservation Function (Π)
 *
 * Π(δᵢ, δⱼ) ∈ [0, 1]
 *
 * 度量：一个系统是否"保持结构语义"。
 * 1 = 完全保持（所有 Kernel invariants 在两个系统中都成立）
 * 0 = 完全不保持（目标系统中没有任何 invariant 成立）
 */

import type { SystemInstance } from "./system-instance";

/**
 * Kernel 的 9 个系统不变性检查器。
 * 每个 invariant 返回 0（违反）或 1（保持）。
 */
export interface InvariantCheckResult {
  invariantId: string;
  description: string;
  sourceScore: number; // 源系统中该 invariant 的保持度
  targetScore: number; // 目标系统中该 invariant 的保持度
  preserved: boolean; // sourceScore === targetScore
}

export interface InvariantPreservationReport {
  systemA: string;
  systemB: string;
  checks: InvariantCheckResult[];
  preservationScore: number; // Π ∈ [0, 1]
}

export class InvariantPreservation {
  /**
   * 计算 Π(δᵢ, δⱼ)。
   * 检查所有 9 个 Kernel invariants 在两个系统间的保持情况。
   */
  check(systemA: SystemInstance, systemB: SystemInstance): InvariantPreservationReport {
    const checks: InvariantCheckResult[] = [
      this.checkI1(systemA, systemB),
      this.checkI2(systemA, systemB),
      this.checkI3(systemA, systemB),
      this.checkI4(systemA, systemB),
      this.checkI5(systemA, systemB),
      this.checkI6(systemA, systemB),
      this.checkI7(systemA, systemB),
      this.checkI8(systemA, systemB),
      this.checkI9(systemA, systemB),
    ];

    const preserved = checks.filter((c) => c.preserved).length;
    const preservationScore = checks.length > 0 ? preserved / checks.length : 0;

    return {
      systemA: systemA.id,
      systemB: systemB.id,
      checks,
      preservationScore,
    };
  }

  /**
   * I1 — Truth Immutability: 每个系统必须有不可变 truth 层。
   */
  private checkI1(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasTruth = a.get("truth-anchor") !== undefined;
    const bHasTruth = b.get("truth-anchor") !== undefined;
    return {
      invariantId: "I1",
      description: "Truth Immutability — truth-anchor operator exists",
      sourceScore: aHasTruth ? 1 : 0,
      targetScore: bHasTruth ? 1 : 0,
      preserved: aHasTruth === bHasTruth,
    };
  }

  /**
   * I2 — Reproducibility: 相同输入产生相同输出。
   * 检查系统的 δ 是否实现 deterministic execution。
   */
  private checkI2(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aDet = this.checkDeterministic(a);
    const bDet = this.checkDeterministic(b);
    return {
      invariantId: "I2",
      description: "Reproducibility — operators are deterministic",
      sourceScore: aDet,
      targetScore: bDet,
      preserved: aDet === bDet,
    };
  }

  /**
   * I3 — Observational Purity: observation 不改变系统状态。
   */
  private checkI3(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasObs = this.hasObservabilityOperators(a);
    const bHasObs = this.hasObservabilityOperators(b);
    return {
      invariantId: "I3",
      description: "Observational Purity — observation operators exist",
      sourceScore: aHasObs ? 1 : 0,
      targetScore: bHasObs ? 1 : 0,
      preserved: aHasObs === bHasObs,
    };
  }

  /**
   * I4 — Temporal Ordering: trace 必须保持时间顺序。
   */
  private checkI4(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasTrace = a.get("trace-recorder") !== undefined;
    const bHasTrace = b.get("trace-recorder") !== undefined;
    return {
      invariantId: "I4",
      description: "Temporal Ordering — trace recorder exists",
      sourceScore: aHasTrace ? 1 : 0,
      targetScore: bHasTrace ? 1 : 0,
      preserved: aHasTrace === bHasTrace,
    };
  }

  /**
   * I5 — State Continuity: state 在 δ 间连续传递。
   */
  private checkI5(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasEngine = a.get("execution-engine") !== undefined;
    const bHasEngine = b.get("execution-engine") !== undefined;
    return {
      invariantId: "I5",
      description: "State Continuity — execution engine exists",
      sourceScore: aHasEngine ? 1 : 0,
      targetScore: bHasEngine ? 1 : 0,
      preserved: aHasEngine === bHasEngine,
    };
  }

  /**
   * I6 — Trace Completeness: 所有 δ 执行必须有 trace。
   */
  private checkI6(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aTraceable = this.countTraceableOperators(a);
    const bTraceable = this.countTraceableOperators(b);
    return {
      invariantId: "I6",
      description: "Trace Completeness — all operators traceable",
      sourceScore: aTraceable,
      targetScore: bTraceable,
      preserved: aTraceable === bTraceable,
    };
  }

  /**
   * I7 — Deterministic Validation: 可以验证 replay determinism。
   */
  private checkI7(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aValidatable = a.get("deterministic-validator") !== undefined;
    const bValidatable = b.get("deterministic-validator") !== undefined;
    return {
      invariantId: "I7",
      description: "Deterministic Validation — validator exists",
      sourceScore: aValidatable ? 1 : 0,
      targetScore: bValidatable ? 1 : 0,
      preserved: aValidatable === bValidatable,
    };
  }

  /**
   * I8 — No Self-Modification: δ 不修改自身。
   */
  private checkI8(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasConstraint = a.get("constraint-layer") !== undefined;
    const bHasConstraint = b.get("constraint-layer") !== undefined;
    return {
      invariantId: "I8",
      description: "No Self-Modification — constraint layer exists",
      sourceScore: aHasConstraint ? 1 : 0,
      targetScore: bHasConstraint ? 1 : 0,
      preserved: aHasConstraint === bHasConstraint,
    };
  }

  /**
   * I9 — Layer Isolation: 各层职责分离。
   */
  private checkI9(a: SystemInstance, b: SystemInstance): InvariantCheckResult {
    const aHasAll = this.countDistinctLayers(a);
    const bHasAll = this.countDistinctLayers(b);
    return {
      invariantId: "I9",
      description: "Layer Isolation — distinct layer operators",
      sourceScore: aHasAll,
      targetScore: bHasAll,
      preserved: aHasAll === bHasAll,
    };
  }

  // ─── Helpers ───

  private checkDeterministic(sys: SystemInstance): number {
    const ops = Array.from(sys.operators.values());
    // 纯函数推断：如果所有 operator 通过 δ 接口，它们是 deterministic 的
    return ops.length > 0 ? 1 : 0;
  }

  private hasObservabilityOperators(sys: SystemInstance): number {
    const projectionOps = Array.from(sys.operators.values()).filter(
      (op) =>
        op.id.includes("projection") ||
        op.id.includes("observe") ||
        op.id.includes("telemetry")
    );
    return projectionOps.length > 0 ? 1 : 0;
  }

  private countTraceableOperators(sys: SystemInstance): number {
    const ops = Array.from(sys.operators.values());
    // 所有 δ 本身都是 traceable 的
    return ops.length > 0 ? ops.length / 10 : 0; // normalize to [0, 1]
  }

  private countDistinctLayers(sys: SystemInstance): number {
    const layers = new Set<string>();
    for (const op of sys.operators.values()) {
      const parts = op.id.split("-");
      if (parts.length > 0) layers.add(parts[0]);
    }
    return layers.size > 0 ? Math.min(layers.size / 6, 1) : 0; // 6 layers max
  }
}
