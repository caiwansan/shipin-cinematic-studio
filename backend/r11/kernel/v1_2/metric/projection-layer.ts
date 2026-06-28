/**
 * metric/projection-layer.ts
 *
 * v1.2 Metric Core — Projection Layer (旧 classifier 降级)
 *
 * π: ℳ → Σ_observed
 *
 * 旧 classifier 不再"决定归属"。
 * 它只是"投影观测"——将流形上的几何结构投影到可读的分类标签。
 *
 * 身份变化：
 *   OLD: classifier = truth arbiter  →  NEW: projection = observational interface
 *   OLD: in/out decision             →  NEW: μ ∈ (0, 1]
 *   OLD: rules determine family      →  NEW: geometry determines family
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import { GeometricDistanceField } from "./geometry";
import { MembershipFunction } from "./membership";
import { MutationField } from "./mutation-field";
import type { MutationFieldResult } from "./mutation-field";

export interface ProjectionResult {
  systemId: string;
  /** 最近 family（观测标签） */
  closestFamily: string;
  /** 隶属度向量投影 */
  membershipVector: Array<{ familyId: string; mu: number }>;
  /** 几何距离投影 */
  distanceVector: Array<{ familyId: string; distance: number }>;
  /** 突变场投影 */
  mutation: MutationFieldResult;
}

export class ProjectionLayer {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;
  private mutation: MutationField;

  constructor() {
    this.geometry = new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
    this.mutation = new MutationField(this.geometry);
  }

  /**
   * π(system) — 将系统投影到可读的分类观测空间。
   */
  project(
    system: SystemInstance,
    families: Map<string, SystemInstance[]>
  ): ProjectionResult {
    const membershipResults = this.membership.multiFamilyMembership(system, families);
    const closestFamily = membershipResults.length > 0 ? membershipResults[0].familyId : "__UNDEFINED__";

    const distanceResults = this.computeDistances(system, families);

    const mutationResult = this.mutation.evaluate(system, families);

    return {
      systemId: system.id,
      closestFamily,
      membershipVector: membershipResults.map((r) => ({
        familyId: r.familyId,
        mu: r.mu,
      })),
      distanceVector: distanceResults,
      mutation: mutationResult,
    };
  }

  /**
   * π^{-1}(label) — 从观测标签反查流形区域（仅用于调试/解释）。
   * 不能保证唯一性。
   */
  inverseProject(
    label: string,
    families: Map<string, SystemInstance[]>
  ): number {
    // 在流形上找到该 label 对应的 attractor basin 范围
    const members = families.get(label);
    if (!members || members.length === 0) return 0;
    // 返回 basin "紧度"（平均内部距离）
    const distances = members.flatMap((a) =>
      members.map((b) => this.geometry.distance(a, b).compositeDistance)
    );
    const avgDist =
      distances.length > 0
        ? distances.reduce((sum, d) => sum + d, 0) / distances.length
        : 0;
    return avgDist;
  }

  private computeDistances(
    system: SystemInstance,
    families: Map<string, SystemInstance[]>
  ): Array<{ familyId: string; distance: number }> {
    const results: Array<{ familyId: string; distance: number }> = [];
    for (const [familyId, members] of families) {
      const d = this.geometry.distanceToFamily(system, members);
      results.push({ familyId, distance: d.compositeDistance });
    }
    return results.sort((a, b) => a.distance - b.distance);
  }
}
