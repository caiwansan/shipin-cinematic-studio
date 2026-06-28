/**
 * metric/membership.ts
 *
 * v1.2 Metric Core — Soft Membership μ(S, F)
 *
 * μ(S, F_i) = exp(-λ · d(S, μ_i))
 *
 * 几何诱导的隶属度，不是 classifier 平滑。
 * 范围 μ ∈ (0, 1]，1 = 完全属于 attractor basin。
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import { GeometricDistanceField } from "./geometry";

export interface MembershipResult {
  systemId: string;
  familyId: string;
  /** μ ∈ (0, 1] — 动力学归属强度 */
  membership: number;
  /** 到 attractor 的几何距离 */
  distance: number;
  /** λ 参数（衰减率） */
  lambda: number;
}

export class MembershipFunction {
  private geometry: GeometricDistanceField;

  /** λ 衰减率：推荐范围 1.0~5.0。越大 = 边界越尖锐 */
  constructor(geometry?: GeometricDistanceField, public lambda: number = 2.0) {
    this.geometry = geometry ?? new GeometricDistanceField();
  }

  /**
   * μ(S, F_i) = exp(-λ · d(S, μ_i))
   *
   * 计算 system 对 family 的几何隶属度。
   */
  membership(
    system: SystemInstance,
    familyId: string,
    familyMembers: SystemInstance[]
  ): MembershipResult {
    const d = this.geometry.distanceToFamily(system, familyMembers);
    const mu = Math.exp(-this.lambda * d.compositeDistance);

    return {
      systemId: system.id,
      familyId,
      membership: mu,
      distance: d.compositeDistance,
      lambda: this.lambda,
    };
  }

  /**
   * 判定"硬归属"（隶属度阈值）。
   * 当 μ > μ_threshold 时，认为系统在该 family 的 attractor basin 内。
   */
  isInBasin(mu: number, threshold: number = 0.5): boolean {
    return mu > threshold;
  }

  /**
   * 对多个 family 计算隶属度并排序。
   * 返回 (familyId, μ) 降序。
   */
  multiFamilyMembership(
    system: SystemInstance,
    families: Map<string, SystemInstance[]>
  ): Array<{ familyId: string; mu: number; distance: number }> {
    const results: Array<{ familyId: string; mu: number; distance: number }> = [];

    for (const [familyId, members] of families) {
      const m = this.membership(system, familyId, members);
      results.push({ familyId: m.familyId, mu: m.membership, distance: m.distance });
    }

    return results.sort((a, b) => b.mu - a.mu);
  }

  /**
   * 更新 λ 衰减率。
   */
  setLambda(lambda: number): void {
    this.lambda = lambda;
  }
}
