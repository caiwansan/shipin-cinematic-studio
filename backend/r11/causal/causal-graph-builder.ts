/**
 * causal/causal-graph-builder.ts
 *
 * Phase 5 — Causal Graph Builder
 *
 * 将多条 CausalReport 合并为因果图。
 * 用于 UI 展示多条 drift trace 的合并视图。
 *
 * 铁律：
 * - 不做时序推断
 * - 不做缺失值填充
 * - 不做跨 trace 关联（除非显式链接）
 */

import type { CausalNode, CausalEdge, CausalReport } from "./causal-types";

export interface UnifiedCausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  reportsCount: number;
  layers: string[];
}

export class CausalGraphBuilder {
  /**
   * Merge multiple CausalReports into a unified graph.
   * Deduplicates nodes by id.
   */
  merge(reports: CausalReport[]): UnifiedCausalGraph {
    const nodeMap = new Map<string, CausalNode>();
    const edgeSet = new Set<string>();
    const edges: CausalEdge[] = [];

    for (const report of reports) {
      for (const node of report.trace.chain) {
        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, node);
        }
      }
      for (const edge of report.trace.edges) {
        const key = `${edge.from}→${edge.to}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push(edge);
        }
      }
    }

    // Collect all layers
    const layers = [...new Set(reports.flatMap((r) => r.impactedLayers))];

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
      reportsCount: reports.length,
      layers,
    };
  }
}
