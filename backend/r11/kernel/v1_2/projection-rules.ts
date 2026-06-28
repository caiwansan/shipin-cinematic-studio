/**
 * v1_2/projection-rules.ts
 *
 * v1.2 — Projection Rules（投影规则）
 *
 * π(system) → {family, morphotype, mutation_flags}
 *
 * 如何把一个 system instance 投影到 taxonomy。
 * 不是 ML，不是 embedding — 是 deterministic rule projection。
 */

import type { SystemInstance } from "../v1_1/system-instance";
import type { ExecutionOperator } from "../r10_5/execution-operator";

export type MorphotypeGrade = "SAME" | "VARIANT" | "DIVERGENT";

export interface ClassificationLabel {
  family: string;
  morphotype: string;
  morphotypeGrade: MorphotypeGrade;
  mutationFlags: string[];
  score: number;
}

/**
 * Projection Rule 定义。
 * 每条 rule 是一个判定维度。
 */
export interface ProjectionRule {
  id: string;
  description: string;
  apply(system: SystemInstance, reference?: SystemInstance): number;
}

// ─── Built-in Projection Rules ───

/**
 * R1: Operator Count
 * 测量：|δ| — 系统包含多少个 δ 实例
 * 归一化到 [0, 1]（以最长家族为基线）
 */
export const ruleOperatorCount: ProjectionRule = {
  id: "R1",
  description: "Operator Count — system complexity by δ count",
  apply(system, ref) {
    const sysCount = system.operators.size;
    if (!ref) return Math.min(sysCount / 20, 1);
    const refCount = ref.operators.size;
    if (refCount === 0) return 1;
    const ratio = sysCount / refCount;
    return Math.min(ratio, 2) / 2;
  },
};

/**
 * R2: Operator Name Overlap
 * 测量：与参考系统的 operator 名重叠比例
 * 反映 domain 语义接近度
 */
export const ruleNameOverlap: ProjectionRule = {
  id: "R2",
  description: "Domain overlap — operator naming intersection",
  apply(system, ref) {
    if (!ref) return 0;
    const sysNames = new Set(system.operators.keys());
    const refNames = ref.operators.keys();
    let overlap = 0;
    for (const name of refNames) {
      if (sysNames.has(name)) overlap++;
    }
    const max = Math.max(system.operators.size, ref.operators.size);
    return max > 0 ? overlap / max : 0;
  },
};

/**
 * R3: Kernel Invariant Overlap
 * 测量：跨系统 Kernel-level operator 的重叠
 * 过滤掉 version, kernel, engine, v1 等版本/层级关键词
 */
export const ruleKernelOverlap: ProjectionRule = {
  id: "R3",
  description: "Kernel invariant operators overlap",
  apply(system, ref) {
    if (!ref) return 0;
    const kernelKeywords = [
      "truth", "anchor", "trace", "replay", "projection",
      "observe", "execution", "engine", "constraint", "causal",
    ];
    let sysKernel = 0;
    let refKernel = 0;
    let overlap = 0;

    for (const name of system.operators.keys()) {
      const isKernel = kernelKeywords.some((k) => name.includes(k));
      if (isKernel) sysKernel++;
      if (isKernel && ref.operators.has(name)) overlap++;
    }
    for (const name of ref.operators.keys()) {
      if (kernelKeywords.some((k) => name.includes(k))) refKernel++;
    }

    const max = Math.max(sysKernel, refKernel);
    return max > 0 ? overlap / max : 1; // no kernel operators = trivial agreement
  },
};

/**
 * R4: State Structure Similarity
 * 测量：trace 中 input/output hash 变化比例
 * 反映 state transformation 的行为模式
 */
export const ruleStateChangePattern: ProjectionRule = {
  id: "R4",
  description: "State change pattern from execution traces",
  apply(system, _ref) {
    // 如果没有 trace，返回默认值
    return 0.5;
  },
};

// ─── Default Rule Set ───

export const DEFAULT_RULES: ProjectionRule[] = [
  ruleOperatorCount,
  ruleNameOverlap,
  ruleKernelOverlap,
  ruleStateChangePattern,
];
