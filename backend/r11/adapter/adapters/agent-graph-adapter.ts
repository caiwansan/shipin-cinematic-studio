/**
 * r11/adapter/adapters/agent-graph-adapter.ts
 *
 * R11 — AgentGraph Adapter
 *
 * Domain: core AgentGraph
 * R11 Compat: HIGH (near 1:1 mapping)
 * Source: core/agent-graph/agent-graph.ts
 *
 * Projection mapping:
 *   AgentNode → NormalizedNode { type: "agent" }
 *   AgentEdge → NormalizedEdge { type: "flow" }
 */

import type { GraphAdapter } from "../adapter-types";
import type { ExecutionGraph } from "../../graph/graph-types";

interface AgentNode {
  id: string;
  type?: string;
  [key: string]: any;
}

interface AgentEdge {
  from: string;
  to: string;
  label?: string;
}

interface AgentGraphInput {
  name?: string;
  nodes: Map<string, AgentNode> | AgentNode[];
  edges: AgentEdge[];
}

export class AgentGraphAdapter implements GraphAdapter<AgentGraphInput> {
  domain = "agent-graph";
  label = "Core AgentGraph DAG";

  canAdapt(input: any): input is AgentGraphInput {
    return (
      input &&
      (input.nodes instanceof Map || Array.isArray(input.nodes)) &&
      Array.isArray(input.edges) &&
      input.edges.length >= 0
    );
  }

  project(input: AgentGraphInput): ExecutionGraph {
    const nodes = input.nodes instanceof Map
      ? Array.from(input.nodes.values())
      : input.nodes;

    return {
      domain: this.domain,
      nodes: nodes.map((n: AgentNode) => ({
        id: n.id,
        type: "agent",
        raw: n,
        domainId: n.id,
      })),
      edges: (input.edges as AgentEdge[]).map((e) => ({
        from: e.from,
        to: e.to,
        type: "flow",
      })),
      meta: {
        label: input.name || "agent-graph",
        timestamp: Date.now(),
      },
    };
  }
}
