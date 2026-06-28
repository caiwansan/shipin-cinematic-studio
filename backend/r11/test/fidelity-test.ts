/**
 * r11/test/fidelity-test.ts
 *
 * Phase 2 — Projection Fidelity Test Harness
 *
 * 验证：raw graph ≈ adapter(R11 graph) 的投影忠实度
 *
 * 三指标：
 *   1. NodeLoss — 节点数量损失（raw vs projected）
 *   2. EdgeLoss — 边数量损失
 *   3. SemanticRetention — 语义保留率（raw type 转换是否完整）
 *
 * 判定标准：
 *   fidelityScore > 0.95 → 通过
 *   0.80–0.95           → 警告（部分 info loss）
 *   < 0.80              → 失败（投影丢失关键语义）
 */

import { AdapterRegistry } from "../adapter/adapter-registry";
import type { ExecutionGraph } from "../graph/graph-types";

export interface FidelityReport {
  domain: string;
  rawSize: number;
  projectedSize: number;
  nodeLoss: number;
  edgeLoss: number;
  semanticRetention: number;
  fidelityScore: number;
  issues: string[];
}

export class FidelityTest {
  constructor(private registry: AdapterRegistry) {}

  run(domain: string, rawGraph: any): FidelityReport {
    const issues: string[] = [];

    // 1. Project
    const projected = this.registry.projectByDomain(domain, rawGraph);

    if (!projected || !projected.nodes) {
      return {
        domain,
        rawSize: 0,
        projectedSize: 0,
        nodeLoss: 0,
        edgeLoss: 0,
        semanticRetention: 0,
        fidelityScore: 0,
        issues: ["projection returned null or invalid structure"],
      };
    }

    // 2. Size comparison
    const rawSize = JSON.stringify(rawGraph).length;
    const projectedSize = JSON.stringify(projected).length;

    // 3. Node loss
    const rawNodes = this.countRawNodes(rawGraph);
    const projectedNodes = projected.nodes.length;
    const nodeLoss = rawNodes - projectedNodes;
    if (nodeLoss > 0) {
      issues.push(`node loss: ${nodeLoss} nodes disappeared (raw=${rawNodes}, projected=${projectedNodes})`);
    }
    if (nodeLoss < 0) {
      issues.push(`node gain: ${-nodeLoss} phantom nodes (projected > raw)`);
    }

    // 4. Edge loss
    const rawEdges = this.countRawEdges(rawGraph);
    const projectedEdges = projected.edges.length;
    const edgeLoss = rawEdges - projectedEdges;
    if (edgeLoss !== 0) {
      issues.push(`edge count changed: raw=${rawEdges}, projected=${projectedEdges}, diff=${Math.abs(edgeLoss)}`);
    }

    // 5. Semantic retention
    // Check that each projected node has a valid type and domainId preserved
    const typedNodes = projected.nodes.filter((n) => n.type !== "unknown").length;
    const nodesWithId = projected.nodes.filter((n) => n.domainId !== undefined).length;
    const typedEdges = projected.edges.filter((e) => e.type !== "unknown").length;

    const retentionFactors = [
      rawNodes > 0 ? typedNodes / rawNodes : 1,     // 30% weight
      rawNodes > 0 ? nodesWithId / rawNodes : 1,     // 30% weight
      rawEdges > 0 ? typedEdges / rawEdges : 1,       // 20% weight
      nodeLoss === 0 ? 1 : Math.max(0, 1 - Math.abs(nodeLoss) / Math.max(rawNodes, 1)), // 10% weight
      edgeLoss === 0 ? 1 : Math.max(0, 1 - Math.abs(edgeLoss) / Math.max(rawEdges, 1)), // 10% weight
    ];

    const semanticRetention =
      retentionFactors[0] * 0.3 +
      retentionFactors[1] * 0.3 +
      retentionFactors[2] * 0.2 +
      retentionFactors[3] * 0.1 +
      retentionFactors[4] * 0.1;

    // 6. Fidelity score (composite)
    const fidelityScore = Math.min(1, Math.max(0, semanticRetention));

    if (fidelityScore > 0.95) {
      // pass
    } else if (fidelityScore > 0.8) {
      issues.push(`fidelity warning: ${(fidelityScore * 100).toFixed(1)}% — partial info loss detected`);
    } else {
      issues.push(`fidelity FAIL: ${(fidelityScore * 100).toFixed(1)}% — semantic degradation`);
    }

    return {
      domain,
      rawSize,
      projectedSize,
      nodeLoss,
      edgeLoss,
      semanticRetention: Math.round(semanticRetention * 1000) / 1000,
      fidelityScore: Math.round(fidelityScore * 1000) / 1000,
      issues,
    };
  }

  private countRawNodes(raw: any): number {
    if (Array.isArray(raw.nodes)) return raw.nodes.length;
    if (raw.nodes instanceof Map) return raw.nodes.size;
    if (raw.gridCount !== undefined) return raw.nodes?.length || 0;
    return 0;
  }

  private countRawEdges(raw: any): number {
    if (Array.isArray(raw.edges)) return raw.edges.length;
    // For dependsOn-style graphs, edges are implicit in node.dependsOn
    if (Array.isArray(raw.nodes) && raw.nodes.some((n: any) => n.dependsOn)) {
      return raw.nodes.filter((n: any) => n.dependsOn).length;
    }
    return 0;
  }

  /**
   * Run fidelity test on all registered adapters with provided test cases.
   */
  async runAll(testCases: Map<string, any>): Promise<FidelityReport[]> {
    const results: FidelityReport[] = [];

    for (const [domain, rawGraph] of testCases) {
      try {
        results.push(this.run(domain, rawGraph));
      } catch (err: any) {
        results.push({
          domain,
          rawSize: 0,
          projectedSize: 0,
          nodeLoss: 0,
          edgeLoss: 0,
          semanticRetention: 0,
          fidelityScore: 0,
          issues: [`error: ${err.message}`],
        });
      }
    }

    return results;
  }
}
