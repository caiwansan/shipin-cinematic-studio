/**
 * metric/mutation-field.ts
 *
 * v1.2 Metric Core — Mutation as Differential Geometry
 *
 * MUT(S) = basin boundary crossing indicator
 * MUT ∈ ℝ⁺ — 连续量，不是 0/1
 *
 * mutation = taxonomy under structural deformation
 * MUT = ||∂τ_S / ∂t|| under topology instability
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import { GeometricDistanceField } from "./geometry";
import { MembershipFunction } from "./membership";
import { projectToManifold, graphEditDistance } from "./execution-manifold";

export interface MutationFieldResult {
  systemId: string;
  /** μ_mut ∈ ℝ⁺ — 连续突变强度 */
  intensity: number;
  /** 各分量 */
  executionInstability: number;
  membershipInstability: number;
  structuralGradient: number;
  /** 突变类型 */
  mutationType: "CONSERVATIVE" | "DRIFT" | "RUPTURE" | "NONE";
  /** 是否是 basin boundary crossing */
  isBoundaryCrossing: boolean;
}

/**
 * Mutation 在 metric taxonomy 中的连续表述。
 */
export class MutationField {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;

  constructor(geometry?: GeometricDistanceField) {
    this.geometry = geometry ?? new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
  }

  /**
   * 计算 system S 在 family 结构中的突变强度。
   *
   * MUT(S) = ||∂τ_S / ∂t|| under topology instability
   * 这里用三个指标近似：
   * 1. execution instability — structure change 速率
   * 2. membership instability — 在不同 family 间的隶属度落差
   * 3. structural gradient — 与 nearest attractor 的结构偏差
   */
  evaluate(
    system: SystemInstance,
    families: Map<string, SystemInstance[]>
  ): MutationFieldResult {
    const manifold = projectToManifold(system);

    // 1. Execution instability: operator 序列的 self-edit distance
    // 近似：operator 版本间的差异度
    const versionDiffs = Array.from(manifold.initialState.operatorVersions.entries())
      .map(([id, ver]) => ({ id, ver }));
    const execInstability = versionDiffs.length > 0
      ? versionDiffs.filter(({ ver }) => ver.includes("fake") || ver !== "v1.0.0" && ver !== "v1").length / versionDiffs.length
      : 0;

    // 2. Membership instability: 跨 family 的隶属度落差
    const membershipResults = this.membership.multiFamilyMembership(system, families);
    const muValues = membershipResults.map((r) => r.mu);
    const muMean = muValues.length > 0
      ? muValues.reduce((a, b) => a + b, 0) / muValues.length
      : 0;
    const muVariance = muValues.length > 0
      ? muValues.reduce((sum, mu) => sum + (mu - muMean) ** 2, 0) / muValues.length
      : 0;
    const membershipInstability = Math.min(muVariance * 5, 1); // normalize

    // 3. Structural gradient: 最近 family 与次近 family 的隶属度差
    const sorted = membershipResults.sort((a, b) => b.mu - a.mu);
    const structuralGradient = sorted.length >= 2
      ? Math.abs(sorted[0].mu - sorted[1].mu)
      : 0;

    // Composite intensity
    const intensity =
      execInstability * 0.35 +
      membershipInstability * 0.35 +
      structuralGradient * 0.3;

    return {
      systemId: system.id,
      intensity,
      executionInstability: execInstability,
      membershipInstability,
      structuralGradient,
      mutationType: this.classifyMutation(intensity, execInstability),
      isBoundaryCrossing: this.detectBoundaryCrossing(sorted),
    };
  }

  /**
   * 检测 basin boundary crossing。
   * 当系统对多个 family 的隶属度接近（μ 方差小）时，可能在边界上。
   */
  private detectBoundaryCrossing(
    sortedFamilies: Array<{ familyId: string; mu: number; distance: number }>
  ): boolean {
    if (sortedFamilies.length < 2) return false;
    // 如果 top 2 的隶属度都在 [0.3, 0.7] 范围且接近
    const mu1 = sortedFamilies[0].mu;
    const mu2 = sortedFamilies[1].mu;
    return (
      mu1 >= 0.15 &&
      mu1 <= 0.85 &&
      mu2 >= 0.15 &&
      Math.abs(mu1 - mu2) < 0.3
    );
  }

  private classifyMutation(
    intensity: number,
    execInstability: number
  ): "CONSERVATIVE" | "DRIFT" | "RUPTURE" | "NONE" {
    if (intensity > 0.6 || execInstability > 0.5) return "RUPTURE";
    if (intensity > 0.3 || execInstability > 0.2) return "DRIFT";
    if (intensity > 0.1) return "CONSERVATIVE";
    return "NONE";
  }
}
