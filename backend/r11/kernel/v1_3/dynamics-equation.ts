/**
 * v1_3/dynamics-equation.ts
 *
 * v1.3 Temporal Dynamics — Σ(t) 数值求解器
 *
 * dΣ/dt = α_ext · F_ext(Σ) + α_int · F_int(Σ) + α_ent · F_entropy(Σ)
 *
 * 这是 v1.3 的核心积分器，将流形几何 + 三种时间驱动耦合为一。
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { GeometricDistanceField } from "../v1_2/metric/geometry";
import { MembershipFunction } from "../v1_2/metric/membership";
import { MutationField } from "../v1_2/metric/mutation-field";
import type { ProjectionResult } from "../v1_2/metric/projection-layer";
import { ProjectionLayer } from "../v1_2/metric/projection-layer";
import { projectToManifold } from "../v1_2/metric/execution-manifold";

export interface DynamicsConfig {
  alphaExt: number;
  alphaInt: number;
  alphaEnt: number;
  dt: number;
}

export interface TimestepResult {
  /** 演化后的 system → family 投影 */
  projections: Map<string, ProjectionResult>;
  /** 该时间步各力贡献 */
  forceExt: number;
  forceInt: number;
  forceEnt: number;
  /** 总变化量 */
  totalDelta: number;
  /** 边界漂移 */
  boundaryFlux: number;
}

export interface EvolutionSnapshot {
  step: number;
  time: number;
  result: TimestepResult;
}

export class DynamicsEquation {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;
  private mutation: MutationField;
  private projector: ProjectionLayer;
  private config: DynamicsConfig;

  constructor(config?: Partial<DynamicsConfig>) {
    this.geometry = new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
    this.mutation = new MutationField(this.geometry);
    this.projector = new ProjectionLayer();
    this.config = {
      alphaExt: config?.alphaExt ?? 1.0,
      alphaInt: config?.alphaInt ?? 0.1,
      alphaEnt: config?.alphaEnt ?? 0.01,
      dt: config?.dt ?? 0.1,
    };
  }

  /**
   * 执行单步演化:
   * Σ(t+dt) = Σ(t) + dΣ · dt
   */
  step(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): TimestepResult {
    const projections = new Map<string, ProjectionResult>();

    // 计算所有系统的当前投影
    for (const sys of systems) {
      projections.set(sys.id, this.projector.project(sys, families));
    }

    // F_ext: 外源注入驱动力 — 由 boundary crossing 和 novelty 驱动
    const forceExt = this.computeExternalForce(projections, families);

    // F_int: 内源平滑 — morphotype field 的散度
    const forceInt = this.computeInternalForce(systems);

    // F_ent: 结构熵响应 — 隶属度场均匀化
    const forceEnt = this.computeEntropyForce(systems, families);

    // 总通量
    const boundaryFlux = this.computeBoundaryFlux(projections);

    // dΣ = α_ext·F_ext + α_int·F_int + α_ent·F_ent
    const totalDelta =
      this.config.alphaExt * forceExt +
      this.config.alphaInt * forceInt +
      this.config.alphaEnt * forceEnt +
      boundaryFlux * 0.1;

    return {
      projections,
      forceExt,
      forceInt,
      forceEnt,
      totalDelta,
      boundaryFlux,
    };
  }

  /**
   * 外源驱动力 F_ext。
   * 由 boundary crossing 事件和 novelty（新 family / 低隶属度）驱动。
   */
  private computeExternalForce(
    projections: Map<string, ProjectionResult>,
    _families: Map<string, SystemInstance[]>
  ): number {
    let totalForce = 0;
    for (const [, proj] of projections) {
      // 低 μ → 系统处于 basin 边缘 → 产生外源驱动力
      const muValues = proj.membershipVector.map((m) => m.mu);
      const avgMu = muValues.length > 0
        ? muValues.reduce((a, b) => a + b, 0) / muValues.length
        : 0;

      // boundary crossing → 驱动力增大
      const bcPenalty = proj.mutation.isBoundaryCrossing ? 0.3 : 0;

      totalForce += (1 - avgMu) + bcPenalty;
    }
    return projections.size > 0 ? totalForce / projections.size : 0;
  }

  /**
   * 内源平滑力 F_int。
   * -λ_int · ∇·(morphotype_field) · dt
   * 简化为同 family 内成员间的平均距离。
   */
  private computeInternalForce(systems: SystemInstance[]): number {
    if (systems.length < 2) return 0;

    const distances: number[] = [];
    for (let i = 0; i < Math.min(systems.length, 10); i++) {
      for (let j = i + 1; j < Math.min(systems.length, 10); j++) {
        const d = this.geometry.distance(systems[i], systems[j]);
        distances.push(d.compositeDistance);
      }
    }

    const avgDist = distances.length > 0
      ? distances.reduce((a, b) => a + b, 0) / distances.length
      : 0;

    // 内源力总是降低梯度: -(normalized dispersion)
    return -avgDist * this.config.dt;
  }

  /**
   * 结构熵响应 F_entropy。
   * -α_H · ∇H(Σ) · dt
   * 由 membership 场的熵梯度驱动。
   */
  private computeEntropyForce(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): number {
    if (systems.length === 0 || families.size === 0) return 0;

    // H(Σ) = average μ variance = partition sharpness
    const muValues: number[] = [];
    for (const sys of systems) {
      const m = this.membership.multiFamilyMembership(sys, families);
      const maxMu = m.length > 0 ? m[0].mu : 0;
      muValues.push(maxMu);
    }

    const avgMaxMu = muValues.length > 0
      ? muValues.reduce((a, b) => a + b, 0) / muValues.length
      : 0;

    // 低 avgMaxMu → 边界模糊 → 熵高 → 向清晰化方向形变
    return (0.5 - avgMaxMu) * this.config.dt;
  }

  /**
   * 边界通量 — 跨 basin 的迁移强度。
   */
  private computeBoundaryFlux(
    projections: Map<string, ProjectionResult>
  ): number {
    let flux = 0;
    let count = 0;

    for (const [, proj] of projections) {
      if (proj.membershipVector.length >= 2) {
        // 隶属度向量间的"折叠度"
        const mu1 = proj.membershipVector[0].mu;
        const mu2 = proj.membershipVector[1].mu;
        if (mu1 > 0.1 && mu2 > 0.1) {
          flux += Math.abs(mu1 - mu2) / (mu1 + mu2);
          count++;
        }
      }
    }

    return count > 0 ? flux / count : 0;
  }

  setConfig(config: Partial<DynamicsConfig>): void {
    Object.assign(this.config, config);
  }
}
