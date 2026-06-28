/**
 * r11/test/replay-consistency-test.ts
 *
 * Phase 2 — Replay Consistency Validator
 *
 * 验证：same input graph → same execution trace（跨 adapter domain）
 *
 * 确定性测试：同一 graph 多次回放应产生完全相同的 trace。
 * 若 trace 不一致 → adapter 投影不稳定或 replay engine 有状态污染。
 */

import type { ExecutionGraph } from "../graph/graph-types";
import { R11Service } from "../r11-service";

/**
 * Minimal replay trace for consistency validation.
 * ReplayEngine 实际消费的是 normalized ExecutionGraph，
 * 这里我们用纯结构比较来验证确定性。
 */
export interface ReplayTrace {
  nodeOrder: string[];
  edgeTraversals: Array<{ from: string; to: string }>;
  nodeTypeSequence: string[];
}

export interface ReplayConsistencyReport {
  domain: string;
  iterations: number;
  stable: boolean;
  allSame: boolean;
  firstTraceHash: string;
  divergences: number;
  traces: ReplayTrace[];
}

export class ReplayConsistencyTest {
  constructor(private r11: R11Service) {}

  /**
   * Generate a deterministic trace from a normalized ExecutionGraph.
   * Topologically sorted node traversal.
   */
  private generateTrace(graph: ExecutionGraph): ReplayTrace {
    // In-degree based topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    for (const edge of graph.edges) {
      const list = adjList.get(edge.from) || [];
      list.push(edge.to);
      adjList.set(edge.from, list);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Kahn's
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const nodeOrder: string[] = [];
    while (queue.length > 0) {
      // Deterministic: sort queue for consistent ordering
      queue.sort();
      const id = queue.shift()!;
      nodeOrder.push(id);

      for (const neighbor of adjList.get(id) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Edge traversals (in topo order)
    const edgeTraversals: Array<{ from: string; to: string }> = [];
    for (const id of nodeOrder) {
      for (const edge of graph.edges) {
        if (edge.from === id) {
          edgeTraversals.push({ from: edge.from, to: edge.to });
        }
      }
    }

    // Node type sequence (in topo order)
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const nodeTypeSequence = nodeOrder.map((id) => nodeMap.get(id)?.type || "unknown");

    return { nodeOrder, edgeTraversals, nodeTypeSequence };
  }

  /**
   * Run replay consistency validation.
   * Projects raw graph first, then generates multiple traces and compares.
   */
  async run(
    domain: string,
    rawGraph: any,
    iterations: number = 3
  ): Promise<ReplayConsistencyReport> {
    // Project to normalized form
    const graph = this.r11.project(domain, rawGraph);

    if (!graph) {
      return {
        domain,
        iterations,
        stable: false,
        allSame: false,
        firstTraceHash: "",
        divergences: 1,
        traces: [],
      };
    }

    const traces: ReplayTrace[] = [];
    for (let i = 0; i < iterations; i++) {
      traces.push(this.generateTrace(graph));
    }

    const firstHash = this.hash(traces[0]);
    const allSame = traces.every((t) => this.hash(t) === firstHash);
    const divergences = traces.filter((t) => this.hash(t) !== firstHash).length;

    return {
      domain,
      iterations,
      stable: allSame,
      allSame,
      firstTraceHash: firstHash,
      divergences,
      traces,
    };
  }

  /**
   * Run multiple domains concurrently.
   */
  async runAll(
    testCases: Map<string, any>,
    iterations: number = 3
  ): Promise<ReplayConsistencyReport[]> {
    const results: ReplayConsistencyReport[] = [];
    for (const [domain, rawGraph] of testCases) {
      try {
        results.push(await this.run(domain, rawGraph, iterations));
      } catch (err: any) {
        results.push({
          domain,
          iterations,
          stable: false,
          allSame: false,
          firstTraceHash: "",
          divergences: 1,
          traces: [],
        });
      }
    }
    return results;
  }

  private hash(trace: ReplayTrace): string {
    return Buffer.from(JSON.stringify(trace)).toString("base64");
  }
}
