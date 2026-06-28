/**
 * r11/ui/view-models/structure.vm.ts
 *
 * Structure ViewModel — Passive data projection from ExecutionGraph
 *
 * 规则：
 *   - 不计算，只投影
 *   - 所有字段直接来自 ExecutionGraph
 *   - 无解释（no "important", "anomaly", "suspicious"）
 */

import type { ExecutionGraph, NormalizedNode, NormalizedEdge } from "../../graph/graph-types";
import type { FidelityReport } from "../../test/fidelity-test";

/** 节点投影 — 只做字段保留 */
export interface StructureNodeVM {
  id: string;
  type: string;
  domainId?: string;
  rawSnippet?: string; // raw 前 80 字符摘要
  outgoingEdges: number;
  incomingEdges: number;
}

/** 边投影 */
export interface StructureEdgeVM {
  from: string;
  to: string;
  type: string;
}

/** 视图状态枚举 — 纯 passive toggle */
export type ViewMode = "raw" | "normalized";

/** 结构视图完整状态 */
export interface StructureViewState {
  domain: string;
  viewMode: ViewMode;
  nodes: StructureNodeVM[];
  edges: StructureEdgeVM[];
  meta: {
    nodeCount: number;
    edgeCount: number;
    adapterLabel?: string;
    rawNodeCount?: number;
    rawEdgeCount?: number;
  };
  fidelity?: {
    score: number;
    nodeLoss: number;
    edgeLoss: number;
    semanticRetention: number;
  };
}

export class StructureViewModel {
  /**
   * Build view state from normalized execution graph.
   * Pure field derivation — no interpretation.
   */
  fromGraph(graph: ExecutionGraph, viewMode: ViewMode, fidelity?: FidelityReport): StructureViewState {
    // Compute degree counts
    const inDegree = new Map<string, number>();
    const outDegree = new Map<string, number>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      outDegree.set(node.id, 0);
    }
    for (const edge of graph.edges) {
      outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const nodes: StructureNodeVM[] = graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      domainId: n.domainId,
      rawSnippet: n.raw ? JSON.stringify(n.raw).slice(0, 80) : undefined,
      outgoingEdges: outDegree.get(n.id) || 0,
      incomingEdges: inDegree.get(n.id) || 0,
    }));

    const edges: StructureEdgeVM[] = graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      type: e.type,
    }));

    return {
      domain: graph.domain,
      viewMode,
      nodes,
      edges,
      meta: {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        adapterLabel: graph.meta?.label,
      },
      fidelity: fidelity
        ? {
            score: fidelity.fidelityScore,
            nodeLoss: fidelity.nodeLoss,
            edgeLoss: fidelity.edgeLoss,
            semanticRetention: fidelity.semanticRetention,
          }
        : undefined,
    };
  }
}
