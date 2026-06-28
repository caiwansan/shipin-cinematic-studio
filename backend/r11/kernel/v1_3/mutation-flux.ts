/**
 * v1_3/mutation-flux.ts
 *
 * v1.3 Temporal Dynamics — Mutation Flux Dynamics
 *
 * MUT(t) = ∫ boundary(t) flux_density ds
 * d(MUT_ij)/dt = boundary_flux_density_ij - boundary_retention_rate_ij
 *
 * MUT 不再是"事件"，而是"通过 basin boundary 的累积流量"。
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { GeometricDistanceField } from "../v1_2/metric/geometry";
import { MembershipFunction } from "../v1_2/metric/membership";
import { MutationField } from "../v1_2/metric/mutation-field";
import type { MutationFieldResult } from "../v1_2/metric/mutation-field";

export interface MutationFluxResult {
  /** 按 family pair 的通量矩阵 */
  fluxMatrix: Map<string, Map<string, number>>;
  /** 总通量 */
  totalFlux: number;
  /** 突变流相位 */
  phase: "LAMINAR" | "TURBULENT" | "CRITICAL";
  /** 各 system 的贡献 */
  systemFluxes: Map<string, number>;
}

export class MutationFlux {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;
  private mutation: MutationField;

  constructor() {
    this.geometry = new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
    this.mutation = new MutationField(this.geometry);
  }

  /**
   * 计算当前 Σ 的突变流场。
   *
   * flux_density_ij = Σ_{S near boundary(F_i, F_j)} |μ_i(S) - μ_j(S)| / d(S, μ_i)
   */
  compute(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): MutationFluxResult {
    const fluxMatrix = new Map<string, Map<string, number>>();
    const systemFluxes = new Map<string, number>();

    // 初始化通量矩阵
    for (const [fid] of families) {
      fluxMatrix.set(fid, new Map());
      for (const [fid2] of families) {
        fluxMatrix.get(fid)!.set(fid2, 0);
      }
    }

    // 对每个系统计算 flux contribution
    for (const sys of systems) {
      const membershipResults = this.membership.multiFamilyMembership(sys, families);
      const mut = this.mutation.evaluate(sys, families);

      let systemFlux = 0;

      for (let i = 0; i < membershipResults.length; i++) {
        for (let j = i + 1; j < membershipResults.length; j++) {
          const fi = membershipResults[i].familyId;
          const fj = membershipResults[j].familyId;
          const mui = membershipResults[i].mu;
          const muj = membershipResults[j].mu;

          // 只在边界附近计算通量
          if (mui > 0.1 && muj > 0.1) {
            const d = this.geometry.distanceToFamily(sys, families.get(fi) ?? []);
            const fluxDensity = Math.abs(mui - muj) / Math.max(d.compositeDistance, 0.01);
            const retention = Math.min(mui, muj) * 0.1;

            const ft = Math.max(0, fluxDensity - retention);

            const currentFi = fluxMatrix.get(fi)?.get(fj) ?? 0;
            fluxMatrix.get(fi)?.set(fj, currentFi + ft);

            const currentFj = fluxMatrix.get(fj)?.get(fi) ?? 0;
            fluxMatrix.get(fj)?.set(fi, currentFj + ft);

            systemFlux += ft;
          }
        }
      }

      // 突变流量调节
      if (mut.isBoundaryCrossing) {
        systemFlux *= 1.5;
      }

      systemFluxes.set(sys.id, systemFlux);
    }

    // 总通量
    const totalFlux = Array.from(systemFluxes.values())
      .reduce((sum, f) => sum + f, 0);

    // 确定相位
    const phase = totalFlux < 0.2 ? "LAMINAR"
      : totalFlux < 0.6 ? "TURBULENT"
      : "CRITICAL";

    return { fluxMatrix, totalFlux, phase, systemFluxes };
  }

  /**
   * 计算 d(MUT)/dt — 突变流变化率。
   */
  fluxDerivative(
    currentFlux: number,
    previousFlux: number,
    dt: number
  ): number {
    return dt > 0 ? (currentFlux - previousFlux) / dt : 0;
  }
}
