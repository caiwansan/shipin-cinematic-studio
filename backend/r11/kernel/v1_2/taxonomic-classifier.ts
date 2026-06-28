/**
 * v1_2/taxonomic-classifier.ts
 *
 * v1.2 — TaxonomicClassifier
 *
 * 最小可执行分类算子。
 * 作用不是"学习"，而是运行时投影 schema 的实现器。
 *
 * 职责：
 *   1. 接收一个 system instance
 *   2. 使用 projection rules 投影到 taxonomy
 *   3. 输出 {family, morphotype, mutation_flags}
 */

import type { SystemInstance } from "../v1_1/system-instance";
import { InvariantPreservation } from "../v1_1/invariant-preservation";
import { BehavioralDistance } from "../v1_1/behavioral-distance";
import { ExecutionEngine } from "../r10_5/execution-engine";
import type { ClassificationLabel, MorphotypeGrade, ProjectionRule } from "./projection-rules";
import { DEFAULT_RULES, ruleNameOverlap, ruleOperatorCount, ruleKernelOverlap } from "./projection-rules";

/**
 * Taxonomy Configuration — 定义了哪些家族存在及其参考系统。
 */
export interface FamilyConfig {
  id: string;
  name: string;
  referenceSystem: SystemInstance;
  invariantThreshold: number; // τ — 通常 0.78 (7/9)
  morphotypeThresholds: {
    same: number;   // D composite ≤ this → SAME
    variant: number; // D composite ≤ this → VARIANT
    // beyond → DIVERGENT
  };
}

export interface ClassificationResult {
  label: ClassificationLabel;
  config: FamilyConfig | null;
  ruleScores: Record<string, number>;
  invariantScore: number;
  distanceScore: number;
}

export class TaxonomicClassifier {
  private preservation = new InvariantPreservation();
  private distance = new BehavioralDistance();
  private engine = new ExecutionEngine();
  private rules: ProjectionRule[];

  constructor(rules: ProjectionRule[] = DEFAULT_RULES) {
    this.rules = rules;
  }

  /**
   * 分类一个 system instance。
   *
   * π(system) → {family, morphotype, mutation_flags}
   *
   * 分类逻辑使用三层加权判定：
   * 1. Invariant Score (Π) — 是否属于同一理论类 (权重 0.6)
   * 2. Domain Overlap (R2) — 领域语义接近度 (权重 0.3)
   * 3. Kernel Structure (R3) — 内核结构对齐 (权重 0.1)
   */
  classify(
    system: SystemInstance,
    families: FamilyConfig[]
  ): ClassificationResult {
    if (families.length === 0) {
      return {
        label: {
          family: "__UNDEFINED__",
          morphotype: "__UNCLASSIFIED__",
          morphotypeGrade: "SAME",
          mutationFlags: [],
          score: 0,
        },
        config: null,
        ruleScores: {},
        invariantScore: 0,
        distanceScore: 0,
      };
    }

    // 1. 对所有已知 family 计算加权评分
    const scores = families.map((f) => {
      const piResult = this.preservation.check(f.referenceSystem, system);
      const invariantScore = piResult.preservationScore;

      // Domain overlap — same-family systems must share domain operators
      const domainOverlap = ruleNameOverlap.apply(system, f.referenceSystem);
      // Kernel overlap — same-theory systems share kernel operators
      const kernelOverlap = ruleKernelOverlap.apply(system, f.referenceSystem);

      // Weighted composite: Π(0.6) + domain(0.3) + kernel(0.1)
      const compositeScore =
        invariantScore * 0.6 + domainOverlap * 0.3 + kernelOverlap * 0.1;

      return {
        family: f,
        invariantScore,
        compositeScore,
        domainOverlap,
        kernelOverlap,
      };
    });

    // 2. 过滤 and 排序 (按 composite score)
    const candidates = scores
      .filter((s) => s.invariantScore >= s.family.invariantThreshold)
      .sort((a, b) => b.compositeScore - a.compositeScore);

    // 3. 最佳匹配
    if (candidates.length === 0) {
      // 不属于任何已知 family — 需要创建新家族
      return {
        label: {
          family: "__NEW_FAMILY__",
          morphotype: "__NEW__",
          morphotypeGrade: "SAME",
          mutationFlags: ["new_family"],
          score: scores[0]?.compositeScore ?? 0,
        },
        config: null,
        ruleScores: {},
        invariantScore: scores[0]?.invariantScore ?? 0,
        distanceScore: 0,
      };
    }

    const bestFamily = candidates[0];

    // 4. 计算 morphotype
    const morph = this.determineMorphotype(
      system,
      bestFamily.family,
      candidates
    );

    // 5. 计算 rule scores
    const ruleScores: Record<string, number> = {};
    for (const rule of this.rules) {
      ruleScores[rule.id] = rule.apply(system, bestFamily.family.referenceSystem);
    }

    // 6. 计算行为距离
    const distanceScore = this.estimateDistanceScore(system, bestFamily.family);

    return {
      label: {
        family: bestFamily.family.id,
        morphotype: morph.morphotype,
        morphotypeGrade: morph.grade,
        mutationFlags: this.detectMutation(morph.grade, bestFamily.invariantScore),
        score: bestFamily.invariantScore,
      },
      config: bestFamily.family,
      ruleScores,
      invariantScore: bestFamily.invariantScore,
      distanceScore,
    };
  }

  /**
   * 分类后的更新指令。
   * 如果属于新 family，返回应创建的 family config。
   */
  getAction(
    result: ClassificationResult
  ): "assign" | "new_family" | "new_morphotype" | "boundary_warning" {
    if (result.label.family === "__NEW_FAMILY__") return "new_family";
    if (result.label.morphotypeGrade === "DIVERGENT") return "new_morphotype";
    if (result.invariantScore < 0.78 && result.invariantScore >= 0.5)
      return "boundary_warning";
    return "assign";
  }

  /**
   * 为未知系统创建新 family 配置。
   */
  createNewFamilyConfig(
    id: string,
    name: string,
    system: SystemInstance
  ): FamilyConfig {
    return {
      id,
      name,
      referenceSystem: system,
      invariantThreshold: 1.0,
      morphotypeThresholds: {
        same: 0.1,
        variant: 0.4,
      },
    };
  }

  // ─── Private ───

  private determineMorphotype(
    _system: SystemInstance,
    family: FamilyConfig,
    _candidates: any[]
  ): { morphotype: string; grade: MorphotypeGrade } {
    // 简化的 morphotype 判定
    return {
      morphotype: `M_${family.id}`,
      grade: "SAME",
    };
  }

  private estimateDistanceScore(
    _system: SystemInstance,
    _family: FamilyConfig
  ): number {
    // 需要 trace 数据支撑，暂返回默认值
    return 0;
  }

  private detectMutation(
    grade: MorphotypeGrade,
    invariantScore: number
  ): string[] {
    const flags: string[] = [];
    if (grade === "DIVERGENT") flags.push("morphotype_divergence");
    if (grade === "VARIANT") flags.push("morphotype_variant");
    if (invariantScore < 0.78) flags.push("invariant_degradation");
    if (invariantScore < 0.5) flags.push("rupture_risk");
    return flags;
  }
}
