/**
 * metric/geometry.ts
 *
 * v1.2 Metric Core — Geometric Distance Field
 *
 * d(S1, S2) = w1·d_exec + w2·d_state + w3·d_cap
 *
 * 核心 metric：流形上的 distance function。
 * 从 trajectory-based observables 计算几何距离。
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import { projectToManifold, graphEditDistance, stateDynamicsDivergence, capabilitySequenceDistance } from "./execution-manifold";

export interface GeometricDistance {
  executionGraphDistance: number;
  stateDynamicsDistance: number;
  capabilityDistance: number;
  compositeDistance: number;
}

export class GeometricDistanceField {
  private weights: { exec: number; state: number; cap: number };

  constructor(weights?: { exec: number; state: number; cap: number }) {
    this.weights = weights ?? { exec: 0.4, state: 0.35, cap: 0.25 };
  }

  /**
   * d(S1, S2) — 计算两个 system 在 ℳ 上的几何距离。
   */
  distance(systemA: SystemInstance, systemB: SystemInstance): GeometricDistance {
    const tA = projectToManifold(systemA);
    const tB = projectToManifold(systemB);

    const execDist = graphEditDistance(
      tA.initialState.operatorIds,
      tB.initialState.operatorIds
    );

    const stateDist = stateDynamicsDivergence(
      tA.executionTrace,
      tB.executionTrace
    );

    const capDist = capabilitySequenceDistance(
      tA.capabilityActivationSequence,
      tB.capabilityActivationSequence
    );

    const composite =
      this.weights.exec * execDist +
      this.weights.state * stateDist +
      this.weights.cap * capDist;

    return {
      executionGraphDistance: execDist,
      stateDynamicsDistance: stateDist,
      capabilityDistance: capDist,
      compositeDistance: composite,
    };
  }

  /**
   * 计算 system 到 family attractor μ_i 的距离。
   * attractor = 该 family 中所有 member 的 "stable execution dynamics fixed point"
   * 简化为：最小平均距离的 reference system。
   */
  distanceToFamily(
    system: SystemInstance,
    familyMembers: SystemInstance[]
  ): GeometricDistance {
    if (familyMembers.length === 0) {
      return {
        executionGraphDistance: 1,
        stateDynamicsDistance: 1,
        capabilityDistance: 1,
        compositeDistance: 1,
      };
    }

    // family attractor = 离所有 member 最近的 reference（不是 centroid 是 prototype）
    let bestDist = Infinity;
    let result: GeometricDistance = {
      executionGraphDistance: 1,
      stateDynamicsDistance: 1,
      capabilityDistance: 1,
      compositeDistance: 1,
    };

    for (const member of familyMembers) {
      const d = this.distance(system, member);
      if (d.compositeDistance < bestDist) {
        bestDist = d.compositeDistance;
        result = d;
      }
    }

    return result;
  }

  /**
   * 更新距离权重。
   */
  setWeights(weights: { exec?: number; state?: number; cap?: number }): void {
    if (weights.exec !== undefined) this.weights.exec = weights.exec;
    if (weights.state !== undefined) this.weights.state = weights.state;
    if (weights.cap !== undefined) this.weights.cap = weights.cap;
  }
}
