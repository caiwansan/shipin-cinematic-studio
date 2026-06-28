/**
 * Graph Adapter — convert between simplified (pipeline) and full (Graph DSL) formats
 *
 * The frontend sends edges as { source: "n1", target: "n2" }
 * The Graph DSL expects { source: { nodeId: "n1", port: "...", type: "..." }, ... }
 */

import type { Graph, GraphEdge } from '../../graph-runtime/core/graph.types.js'

/**
 * Convert a simplified graph (from frontend) to the full Graph DSL format.
 * Ports and types are inferred from node schemas.
 */
export function convertToGraphDSL(raw: any): Graph {
  const nodes = (raw.nodes ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    label: n.label ?? n.id,
    position: n.position ?? { x: 0, y: 0 },
    metadata: n.metadata ?? {},
    config: n.config ?? {},
    inputSlots: n.inputSlots ?? [],
    outputSlots: n.outputSlots ?? [],
  }))

  const edges: GraphEdge[] = (raw.edges ?? []).map((e: any, i: number) => {
    // Handle both formats
    const sourceId = typeof e.source === 'object' ? (e.source as any).nodeId : e.source
    const targetId = typeof e.target === 'object' ? (e.target as any).nodeId : e.target

    return {
      id: e.id ?? `edge_${i}`,
      source: {
        nodeId: sourceId,
        port: e.sourceHandle ?? (typeof e.source === 'object' ? (e.source as any).port : 'output'),
        type: e.sourceType ?? (typeof e.source === 'object' ? (e.source as any).type : 'json'),
      },
      target: {
        nodeId: targetId,
        port: e.targetHandle ?? (typeof e.target === 'object' ? (e.target as any).port : 'input'),
        type: e.targetType ?? (typeof e.target === 'object' ? (e.target as any).type : 'json'),
      },
      semantic: {
        relation: e.relation ?? 'dataflow',
      },
      validation: {
        strict: true,
        allowCast: false,
      },
      condition: e.condition,
    }
  })

  const graph: Graph = {
    id: raw.id ?? `graph_${Date.now()}`,
    nodes,
    edges,
    metadata: {
      version: '1.0.0',
      createdAt: Date.now(),
    },
  }

  return graph
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

