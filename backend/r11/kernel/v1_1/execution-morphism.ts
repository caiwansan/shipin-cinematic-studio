/**
 * v1_1/execution-morphism.ts
 *
 * v1.1 — Execution Morphism (φ)
 *
 * φ : δᵢ → δⱼ
 *
 * 执行形态映射：一个执行系统如何"映射"到另一个系统。
 * 不是等价关系，而是投影关系 —— 系统 A 中的某个 δ 可能映射到
 * 系统 B 中的不同（但语义对应）的 δ。
 */

import type { ExecutionOperator } from "../r10_5/execution-operator";

export interface OperatorMapping {
  sourceOperatorId: string;
  targetOperatorId: string;
  mappingType: "IDENTITY" | "FUNCTIONAL" | "COMPOSITE" | "ABSENT";
  confidence: number; // 0-1, mapping 的可信度
}

export interface MorphismResult {
  source: string;
  target: string;
  operatorMappings: OperatorMapping[];
  coverage: number; // 0-1, 源系统中被映射的 operator 比例
}

export class ExecutionMorphism {
  /**
   * 建立 φ : δᵢ → δⱼ 的执行形态映射。
   * 自动推断两个系统之间 operator 的对应关系。
   *
   * @param sourceId — 源系统 id
   * @param targetId — 目标系统 id
   * @param sourceOperators — 源系统的所有 δ
   * @param targetOperators — 目标系统的所有 δ
   */
  map(
    sourceId: string,
    targetId: string,
    sourceOperators: ExecutionOperator[],
    targetOperators: ExecutionOperator[]
  ): MorphismResult {
    const map = new Map<string, string>();
    const targetMap = new Map(
      targetOperators.map((op) => [op.id, op])
    );

    const mappings: OperatorMapping[] = [];

    for (const srcOp of sourceOperators) {
      // 1. 精确匹配（同名同版）
      if (targetMap.has(srcOp.id)) {
        const tgt = targetMap.get(srcOp.id)!;
        if (tgt.version === srcOp.version) {
          mappings.push({
            sourceOperatorId: srcOp.id,
            targetOperatorId: tgt.id,
            mappingType: "IDENTITY",
            confidence: 1.0,
          });
          continue;
        }
        mappings.push({
          sourceOperatorId: srcOp.id,
          targetOperatorId: tgt.id,
          mappingType: "FUNCTIONAL",
          confidence: 0.85,
        });
        continue;
      }

      // 2. 语义匹配（通配符匹配）
      const semanticMatch = this.findSemanticMatch(
        srcOp.id,
        Array.from(targetMap.values())
      );
      if (semanticMatch) {
        mappings.push({
          sourceOperatorId: srcOp.id,
          targetOperatorId: semanticMatch.id,
          mappingType: "FUNCTIONAL",
          confidence: 0.7,
        });
        continue;
      }

      // 3. 未找到映射
      mappings.push({
        sourceOperatorId: srcOp.id,
        targetOperatorId: "__ABSENT__",
        mappingType: "ABSENT",
        confidence: 0,
      });
    }

    const covered = mappings.filter(
      (m) => m.mappingType !== "ABSENT"
    ).length;

    return {
      source: sourceId,
      target: targetId,
      operatorMappings: mappings,
      coverage: sourceOperators.length > 0 ? covered / sourceOperators.length : 0,
    };
  }

  /**
   * 基于语义的名称匹配。
   * 检查 operator id 是否包含目标系统中的语义关键词。
   */
  private findSemanticMatch(
    operatorId: string,
    targets: ExecutionOperator[]
  ): ExecutionOperator | null {
    const keywords = operatorId.split(/[-_/]/);
    for (const tgt of targets) {
      const tgtKeywords = tgt.id.split(/[-_/]/);
      const overlap = keywords.filter((k) => tgtKeywords.includes(k));
      if (overlap.length >= Math.min(2, keywords.length)) {
        return tgt;
      }
    }
    return null;
  }
}
