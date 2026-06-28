/**
 * r11/adapter/adapters/prompt-version-graph-adapter.ts
 *
 * R11 — Prompt Version Graph Adapter
 *
 * Domain: prompt-version-graph
 * R11 Compat: HIGH (explicit DAG with version edges)
 * Source: runtime/prompt/PromptVersionGraph.ts
 *
 * Projection mapping:
 *   VersionNode → NormalizedNode { type: "pipeline" }
 *   Version edge → NormalizedEdge { type: "version" }
 */

import type { GraphAdapter } from "../adapter-types";
import type { ExecutionGraph } from "../../graph/graph-types";

interface VersionNode {
  id: string;
  prompt?: string;
  timestamp?: number;
  [key: string]: any;
}

interface VersionEdge {
  from: string;
  to: string;
  label?: string;
}

interface PromptVersionGraphInput {
  name?: string;
  nodes: VersionNode[];
  edges: VersionEdge[];
  [key: string]: any;
}

export class PromptVersionGraphAdapter implements GraphAdapter<PromptVersionGraphInput> {
  domain = "prompt-version-graph";
  label = "Prompt Version Graph DAG";

  canAdapt(input: any): input is PromptVersionGraphInput {
    return (
      input &&
      Array.isArray(input.nodes) &&
      Array.isArray(input.edges) &&
      typeof input.name !== "undefined"
    );
  }

  project(input: PromptVersionGraphInput): ExecutionGraph {
    return {
      domain: this.domain,
      nodes: input.nodes.map((n, i) => ({
        id: n.id || `node_${i}`,
        type: "pipeline",
        raw: { prompt: n.prompt?.slice(0, 100), timestamp: n.timestamp },
        domainId: n.id,
      })),
      edges: input.edges.map((e) => ({
        from: e.from,
        to: e.to,
        type: "version",
      })),
      meta: {
        label: input.name || "prompt-version-graph",
        timestamp: Date.now(),
      },
    };
  }
}
