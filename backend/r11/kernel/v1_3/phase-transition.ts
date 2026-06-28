/**
 * v1_3/phase-transition.ts
 *
 * v1.3 Temporal Dynamics — Topological Phase Transition
 *
 * Σ(t) → Σ'(t)  when  structural_energy > E_critical
 *
 * 相变是 taxonomy 最剧烈的动力学事件：
 * - MERGE:   F_i ∪ F_j → new F_k
 * - SPLIT:   F_i → F_i1 + F_i2
 * - EMERGE:  new attractor from isolated trajectory
 * - COLLAPSE: basin depth → 0
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { GeometricDistanceField } from "../v1_2/metric/geometry";
import { MembershipFunction } from "../v1_2/metric/membership";
import { MutationField } from "../v1_2/metric/mutation-field";

export type TransitionType = "MERGE" | "SPLIT" | "EMERGE" | "COLLAPSE" | "NONE";

export interface PhaseTransitionEvent {
  type: TransitionType;
  /** 结构能量（触发时的值） */
  structuralEnergy: number;
  /** 临界阈值 */
  criticalThreshold: number;
  /** 涉及的 family */
  involvedFamilies: string[];
  /** 建议的新 family 结构 */
  suggestedStructure: string;
  /** 置信度 */
  confidence: number;
}

export class PhaseTransitionDetector {
  private geometry: GeometricDistanceField;
  private membership: MembershipFunction;
  private mutation: MutationField;

  constructor(public criticalThreshold: number = 0.7) {
    this.geometry = new GeometricDistanceField();
    this.membership = new MembershipFunction(this.geometry);
    this.mutation = new MutationField(this.geometry);
  }

  /**
   * 检测 Σ 是否发生相变。
   */
  detect(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): PhaseTransitionEvent[] {
    const events: PhaseTransitionEvent[] = [];

    const structuralEnergy = this.computeStructuralEnergy(systems, families);

    if (structuralEnergy < this.criticalThreshold) {
      return [{ type: "NONE", structuralEnergy, criticalThreshold: this.criticalThreshold, involvedFamilies: [], suggestedStructure: "unchanged", confidence: 1 }];
    }

    // 检测 MERGE — 两个 family 的 attractor 距离趋近于 0
    const mergeEvents = this.detectMerge(families);
    events.push(...mergeEvents);

    // 检测 SPLIT — family 内部分裂
    const splitEvents = this.detectSplit(systems, families);
    events.push(...splitEvents);

    // 检测 EMERGE — 孤立的 trajectory 形成新 attractor
    const emergeEvents = this.detectEmerge(systems, families);
    events.push(...emergeEvents);

    // 检测 COLLAPSE — basin 坍塌
    const collapseEvents = this.detectCollapse(families);
    events.push(...collapseEvents);

    if (events.length === 0) {
      events.push({
        type: "NONE",
        structuralEnergy,
        criticalThreshold: this.criticalThreshold,
        involvedFamilies: [],
        suggestedStructure: "unchanged",
        confidence: 1,
      });
    }

    return events;
  }

  /**
   * E_structural = Σ boundary_energies
   */
  private computeStructuralEnergy(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): number {
    let totalEnergy = 0;
    let pairs = 0;

    const familyIds = Array.from(families.keys());

    for (let i = 0; i < familyIds.length; i++) {
      for (let j = i + 1; j < familyIds.length; j++) {
        const membersA = families.get(familyIds[i]) ?? [];
        const membersB = families.get(familyIds[j]) ?? [];

        // boundary energy = 1 - mean cross-membership
        let crossMu = 0;
        let crossCount = 0;

        for (const sys of systems) {
          const m = this.membership.multiFamilyMembership(sys, families);
          const muA = m.find((r) => r.familyId === familyIds[i])?.mu ?? 0;
          const muB = m.find((r) => r.familyId === familyIds[j])?.mu ?? 0;
          crossMu += Math.abs(muA - muB);
          crossCount++;
        }

        const avgCrossMu = crossCount > 0 ? crossMu / crossCount : 1;
        const boundaryEnergy = 1 - avgCrossMu;
        totalEnergy += boundaryEnergy;
        pairs++;
      }
    }

    return pairs > 0 ? totalEnergy / pairs : 0;
  }

  private detectMerge(
    families: Map<string, SystemInstance[]>
  ): PhaseTransitionEvent[] {
    const events: PhaseTransitionEvent[] = [];
    const familyIds = Array.from(families.keys());

    for (let i = 0; i < familyIds.length; i++) {
      for (let j = i + 1; j < familyIds.length; j++) {
        const membersA = families.get(familyIds[i]) ?? [];
        const membersB = families.get(familyIds[j]) ?? [];

        const d = this.geometry.distanceToFamily(
          membersA[0],
          membersB
        );

        if (d.compositeDistance < 0.15) {
          events.push({
            type: "MERGE",
            structuralEnergy: 1 - d.compositeDistance,
            criticalThreshold: this.criticalThreshold,
            involvedFamilies: [familyIds[i], familyIds[j]],
            suggestedStructure: `${familyIds[i]}+${familyIds[j]}`,
            confidence: Math.max(0, 1 - d.compositeDistance * 2),
          });
        }
      }
    }

    return events;
  }

  private detectSplit(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): PhaseTransitionEvent[] {
    const events: PhaseTransitionEvent[] = [];

    for (const [familyId, members] of families) {
      if (members.length < 3) continue;

      // 检查 intra-basin variance
      const distances: number[] = [];
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const d = this.geometry.distance(members[i], members[j]);
          distances.push(d.compositeDistance);
        }
      }

      const avgDist = distances.length > 0
        ? distances.reduce((a, b) => a + b, 0) / distances.length
        : 0;

      if (avgDist > 0.4) {
        events.push({
          type: "SPLIT",
          structuralEnergy: avgDist,
          criticalThreshold: this.criticalThreshold,
          involvedFamilies: [familyId],
          suggestedStructure: `${familyId}_A + ${familyId}_B`,
          confidence: Math.min(1, avgDist),
        });
      }
    }

    return events;
  }

  private detectEmerge(
    systems: SystemInstance[],
    families: Map<string, SystemInstance[]>
  ): PhaseTransitionEvent[] {
    const events: PhaseTransitionEvent[] = [];

    for (const sys of systems) {
      const m = this.membership.multiFamilyMembership(sys, families);
      const maxMu = m.length > 0 ? m[0].mu : 0;

      // 对任何已知 family 隶属度都很低 -> potential new attractor
      if (maxMu < 0.15 && families.size > 0) {
        const trajectory = sys.id;
        events.push({
          type: "EMERGE",
          structuralEnergy: 1 - maxMu,
          criticalThreshold: this.criticalThreshold,
          involvedFamilies: [],
          suggestedStructure: `NewFamily_from_${trajectory}`,
          confidence: 1 - maxMu,
        });
      }
    }

    return events;
  }

  private detectCollapse(
    families: Map<string, SystemInstance[]>
  ): PhaseTransitionEvent[] {
    const events: PhaseTransitionEvent[] = [];

    for (const [familyId, members] of families) {
      if (members.length === 0) {
        events.push({
          type: "COLLAPSE",
          structuralEnergy: 1,
          criticalThreshold: this.criticalThreshold,
          involvedFamilies: [familyId],
          suggestedStructure: `_collapsed_${familyId}`,
          confidence: 1,
        });
      }
    }

    return events;
  }
}
