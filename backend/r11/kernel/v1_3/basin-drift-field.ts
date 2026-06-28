/**
 * v1_3/basin-drift-field.ts
 *
 * v1.3 Temporal Dynamics — Basin Drift Tensor Field
 *
 * D_i(t) = drift_field(F_i, t)
 * F_i(t+1) = F_i(t) + Δ_geometry(t)
 *
 * Family 不是静态 attractor，而是 continuously deformed attractor。
 * 漂移张量场由外源注入 + 内源形变耦合驱动。
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { GeometricDistanceField } from "../v1_2/metric/geometry";
import { MembershipFunction } from "../v1_2/metric/membership";
import { projectToManifold, graphEditDistance } from "../v1_2/metric/execution-manifold";

export interface BasinDriftResult {
  familyId: string;
  /** 漂移张量 */
  driftVector: number[];
  /** 外源分量 */
  externalComponent: number[];
  /** 内源分量 */
  internalComponent: number[];
  /** 漂移强度 */
  driftIntensity: number;
  /** attractor 老化系数（若无 injection 则加固） */
  agingCoefficient: number;
}

export interface DriftTensorField {
  drifts: Map<string, BasinDriftResult>;
  /** 总场能量 */
  fieldEnergy: number;
}

export class BasinDriftField {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;

  constructor() {
    this.geometry = new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
  }

  /**
   * 计算所有 family 的漂移张量。
   *
   * D_i_ext = Σ_{S in Δ_injected} (μ_i - π(S)) · w_i(S)
   * D_i_int = -η · Σ_{S in F_i} ∇·τ(S) / |F_i|
   */
  compute(
    families: Map<string, SystemInstance[]>,
    injectedSystems: SystemInstance[] = []
  ): DriftTensorField {
    const drifts = new Map<string, BasinDriftResult>();

    for (const [familyId, members] of families) {
      const drift = this.computeFamilyDrift(familyId, members, injectedSystems);
      drifts.set(familyId, drift);
    }

    const totalEnergy = Array.from(drifts.values())
      .reduce((sum, d) => sum + d.driftIntensity, 0);

    return { drifts, fieldEnergy: totalEnergy };
  }

  private computeFamilyDrift(
    familyId: string,
    members: SystemInstance[],
    injectedSystems: SystemInstance[]
  ): BasinDriftResult {
    // 外源分量: D_i_ext = Σ (attractor - projection) * weight
    const extComponents: number[] = [];
    for (const inj of injectedSystems) {
      const d = this.geometry.distanceToFamily(inj, members);
      const w = this.computeInfluenceWeight(inj, members);
      extComponents.push(d.compositeDistance * w);
    }

    const externalVector = extComponents.length > 0
      ? [extComponents.reduce((a, b) => a + b, 0) / extComponents.length]
      : [0];

    // 内源分量: D_i_int = -η · mean trajectory gradient
    const internalVector = [this.computeInternalDrift(members)];

    // 漂移向量 = ext + int
    const driftVector = [
      externalVector[0] + internalVector[0],
    ];

    const driftIntensity = Math.abs(driftVector[0]);

    // 老化系数：无 injection 时 attractor 加固（老化系数高 = 抗拒 drift）
    const agingCoefficient = injectedSystems.length === 0
      ? Math.min(0.1 + members.length * 0.02, 0.5)
      : Math.max(0.01, 0.1 - injectedSystems.length * 0.02);

    return {
      familyId,
      driftVector,
      externalComponent: externalVector,
      internalComponent: internalVector,
      driftIntensity,
      agingCoefficient,
    };
  }

  /**
   * 外源系统的 family 影响权重。
   * 越接近 family attractor，权重越高（但过于接近则无影响）。
   */
  private computeInfluenceWeight(
    system: SystemInstance,
    familyMembers: SystemInstance[]
  ): number {
    const d = this.geometry.distanceToFamily(system, familyMembers);
    // 中间距离产生最大影响力
    // 太近 = 已经在 basin 内 = 不产生 drift
    // 太远 = 不相关 = 不产生 drift
    return d.compositeDistance * Math.exp(-d.compositeDistance);
  }

  /**
   * 内源漂移 — morphotype field 的平均梯度。
   * 简化为 family 成员间的 trajectory 差异度。
   */
  private computeInternalDrift(members: SystemInstance[]): number {
    if (members.length < 2) return 0;

    // Family 成员间的执行结构相似度
    const traces = members.map((m) => projectToManifold(m).executionTrace);
    let totalDist = 0;
    let pairs = 0;

    for (let i = 0; i < traces.length; i++) {
      for (let j = i + 1; j < traces.length; j++) {
        totalDist += graphEditDistance(traces[i], traces[j]);
        pairs++;
      }
    }

    const avgDist = pairs > 0 ? totalDist / pairs : 0;
    // 内源漂移持续向 basin 中心收缩（负值）
    return -avgDist * 0.1;
  }
}
