/**
 * r11/adapter/adapters/character-image-dag-adapter.ts
 *
 * R11 — Character Image DAG Adapter
 *
 * Domain: character-image-dag
 * R11 Compat: EASY (dependsOn → Edge projection)
 * Source: runtime/character-image-dag.ts
 *
 * Projection mapping:
 *   DAGNode → NormalizedNode { type: "transform" }
 *   dependsOn → NormalizedEdge { type: "depends" }
 *
 * Key design:
 *   - dependsOn creates a directed edge from dependency → dependent
 *   - Nodes without dependsOn are roots (no incoming edges)
 */

import type { GraphAdapter } from "../adapter-types";
import type { ExecutionGraph } from "../../graph/graph-types";

interface ImageDAGNode {
  key: string;
  mode: string;
  prompt: string;
  dependsOn?: string;
  seed: number;
  sortOrder: number;
  optional: boolean;
}

interface CharacterImageDAGInput {
  gridCount: number;
  nodes: ImageDAGNode[];
  userId: string;
  projectId: string;
  characterName: string;
}

export class CharacterImageDAGAdapter implements GraphAdapter<CharacterImageDAGInput> {
  domain = "character-image-dag";
  label = "Character Four-View DAG";

  canAdapt(input: any): input is CharacterImageDAGInput {
    return (
      input &&
      Array.isArray(input.nodes) &&
      input.nodes.length > 0 &&
      typeof input.nodes[0].key === "string" &&
      typeof input.nodes[0].sortOrder === "number"
    );
  }

  project(input: CharacterImageDAGInput): ExecutionGraph {
    const edges: Array<{ from: string; to: string; type: "depends" }> = [];

    for (const node of input.nodes) {
      if (node.dependsOn) {
        edges.push({
          from: node.dependsOn,
          to: node.key,
          type: "depends",
        });
      }
    }

    return {
      domain: this.domain,
      nodes: input.nodes.map((n) => ({
        id: n.key,
        type: "transform",
        raw: {
          mode: n.mode,
          optional: n.optional,
          sortOrder: n.sortOrder,
          seed: n.seed,
        },
        domainId: n.key,
      })),
      edges,
      meta: {
        label: `character-${input.characterName}-dag`,
        timestamp: Date.now(),
      },
    };
  }
}
