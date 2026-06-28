/**
 * v1_2/stress/stability-metric.ts
 *
 * v1.2 Stress Phase — Σ Stability Metric
 *
 * 测量 taxonomy 在结构压强下的稳定性。
 *
 * S(Σ) = α·family_stability + β·morphotype_continuity - γ·mutation_rate
 *
 * 默认权重: α=0.5, β=0.3, γ=0.2
 */

import type { SystemInstance } from "../../v1_1/system-instance";
import type { FamilyConfig, ClassificationResult } from "../taxonomic-classifier";
import { TaxonomicClassifier } from "../taxonomic-classifier";
import { MutationTriggerMatrix } from "./mutation-trigger-matrix";

export interface StabilityReport {
  /** Σ 综合稳定性 S(Σ) ∈ [0, 1] */
  stabilityScore: number;

  /** 各分量 */
  familyStability: number;      // 0-1
  morphotypeContinuity: number; // 0-1
  mutationRate: number;         // 0-1 (越低越好)

  /** 各压力的影响 */
  stressBreakdown: {
    overlapSystems: number;
    partialSystems: number;
    adversarialSystems: number;
  };

  /** 突变统计 */
  mutationStats: {
    total: number;
    conservative: number;
    drift: number;
    rupture: number;
    none: number;
  };

  /** 稳定性分级 */
  grade: "STABLE" | "STRESSED" | "FRAGILE" | "BROKEN";
}

export class StabilityMetric {
  private classifier = new TaxonomicClassifier();
  private mutationMatrix = new MutationTriggerMatrix();

  /**
   * 计算 Σ 在 stress systems 下的稳定性。
   */
  measure(
    families: FamilyConfig[],
    stressSystems: SystemInstance[],
    weights: {
      alpha: number;
      beta: number;
      gamma: number;
    } = { alpha: 0.5, beta: 0.3, gamma: 0.2 }
  ): StabilityReport {
    const classifications: ClassificationResult[] = stressSystems.map((sys) =>
      this.classifier.classify(sys, families)
    );

    const mutations = stressSystems.map((sys) => {
      // 对每个已知 family 计算突变
      const bestFamily = this.findBestFamily(sys, families);
      if (!bestFamily) return null;
      return this.mutationMatrix.evaluate(sys, bestFamily);
    }).filter(Boolean);

    const stableClassified = classifications.filter(
      (c) => c.label.family !== "__NEW_FAMILY__"
    ).length;

    // family_stability: 被正确归入已知 family 的比例
    const familyStability =
      stressSystems.length > 0 ? stableClassified / stressSystems.length : 1;

    // morphotype_continuity: 未触发 morphotype collapse 的比例
    const morphotypes = classifications.map((c) => c.label.morphotypeGrade);
    const divergentOrNew = morphotypes.filter(
      (m) => m === "DIVERGENT"
    ).length;
    const morphotypeContinuity =
      morphotypes.length > 0
        ? 1 - divergentOrNew / morphotypes.length
        : 1;

    // mutation_rate: 触发突变的系统比例
    const triggeredMutations = mutations.filter(
      (m) => m && m.triggered
    ).length;
    const mutationRate =
      mutations.length > 0 ? triggeredMutations / mutations.length : 0;

    // 综合稳定性
    const stabilityScore =
      weights.alpha * familyStability +
      weights.beta * morphotypeContinuity -
      weights.gamma * mutationRate;

    // Stress breakdown by type
    const overlapSystems = this.stressScoreByType(
      stressSystems,
      classifications,
      "OVERLAP"
    );
    const partialSystems = this.stressScoreByType(
      stressSystems,
      classifications,
      "PARTIAL"
    );
    const adversarialSystems = this.stressScoreByType(
      stressSystems,
      classifications,
      "ADVERSARIAL"
    );

    // Mutation stats
    const mutationCounts = {
      conservative: mutations.filter((m) => m && m.mutationType === "CONSERVATIVE").length,
      drift: mutations.filter((m) => m && m.mutationType === "DRIFT").length,
      rupture: mutations.filter((m) => m && m.mutationType === "RUPTURE").length,
      none: mutations.filter((m) => m && m.mutationType === "NONE").length,
      total: triggeredMutations,
    };

    return {
      stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
      familyStability,
      morphotypeContinuity,
      mutationRate,
      stressBreakdown: { overlapSystems, partialSystems, adversarialSystems },
      mutationStats: mutationCounts,
      grade: this.gradeClassification(
        stabilityScore,
        familyStability,
        mutationRate
      ),
    };
  }

  private findBestFamily(
    system: SystemInstance,
    families: FamilyConfig[]
  ): FamilyConfig | null {
    const result = this.classifier.classify(system, families);
    return result.config;
  }

  private stressScoreByType(
    systems: SystemInstance[],
    classifications: ClassificationResult[],
    type: string
  ): number {
    let total = 0;
    let count = 0;
    for (let i = 0; i < systems.length; i++) {
      if (systems[i].id.includes(type.toLowerCase()) || 
          systems[i].description.includes(type.toLowerCase())) {
        total += classifications[i]?.label.score ?? 0;
        count++;
      }
    }
    return count > 0 ? total / count : 1;
  }

  private gradeClassification(
    stabilityScore: number,
    familyStability: number,
    mutationRate: number
  ): "STABLE" | "STRESSED" | "FRAGILE" | "BROKEN" {
    if (stabilityScore >= 0.8 && familyStability >= 0.8 && mutationRate <= 0.2)
      return "STABLE";
    if (stabilityScore >= 0.5 && familyStability >= 0.5 && mutationRate <= 0.4)
      return "STRESSED";
    if (stabilityScore >= 0.2) return "FRAGILE";
    return "BROKEN";
  }
}
