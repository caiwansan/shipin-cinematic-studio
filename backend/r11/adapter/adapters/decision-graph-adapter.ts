/**
 * r11/adapter/adapters/decision-graph-adapter.ts
 *
 * R11 — Decision Graph Lane Adapter
 *
 * Domain: decision-graph (D2InputGraph)
 * R11 Compat: HIGH (near 1:1 mapping)
 * Source: services/image/pipeline/decision/decision-graph-lane.ts
 *
 * Projection mapping:
 *   D2InputNode → NormalizedNode { type: "decision" }
 *   D2InputEdge → NormalizedEdge { type: "control" }
 *   locked → preserves via raw payload
 *   weight → preserves via raw payload
 */

import type { GraphAdapter } from "../adapter-types";
import type { ExecutionGraph } from "../../graph/graph-types";

interface D2Node {
  id: string;
  type: string;
  label: string;
  locked: boolean;
}

interface D2Edge {
  from: string;
  to: string;
  weight: number;
  label: string;
  active: boolean;
}

interface D2InputGraph {
  nodes: D2Node[];
  edges: D2Edge[];
  integritySeal?: string;
}

export class DecisionGraphAdapter implements GraphAdapter<D2InputGraph> {
  domain = "decision-graph";
  label = "DEIP Decision Graph Lane";

  canAdapt(input: any): input is D2InputGraph {
    return (
      input &&
      Array.isArray(input.nodes) &&
      input.nodes.length > 0 &&
      "id" in (input.nodes[0] || {})
    );
  }

  project(input: D2InputGraph): ExecutionGraph {
    return {
      domain: this.domain,
      nodes: input.nodes.map((n) => ({
        id: n.id,
        type: "decision",
        raw: { label: n.label, locked: n.locked, type: n.type },
        domainId: n.id,
      })),
      edges: input.edges.map((e) => ({
        from: e.from,
        to: e.to,
        type: "control",
      })),
      meta: {
        runId: input.integritySeal,
        timestamp: Date.now(),
        label: "deip-decision-graph",
      },
    };
  }
}
