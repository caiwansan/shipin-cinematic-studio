/**
 * r11/ui/view-models/replay.vm.ts
 *
 * Replay ViewModel — Passive trace step projector
 *
 * 展示 execution trace 的逐步节点遍历。
 * 不解释，不判断异常，不标记 divergence（那属于 Phase 4）。
 */

import type { ExecutionGraph } from "../../graph/graph-types";

/** 单步执行信息 */
export interface ReplayStepVM {
  step: number;
  nodeId: string;
  nodeType: string;
  incomingFrom: string[];
  outgoingTo: string[];
}

/** 完整执行轨迹 */
export interface ReplayTraceVM {
  steps: ReplayStepVM[];
  nodeOrder: string[];
  nodeTypeSequence: string[];
}

/** 回放视图状态 */
export interface ReplayViewState {
  domain: string;
  iteration: number;
  trace: ReplayTraceVM;
  totalSteps: number;
  /** Determinism status — derived from trace hash comparison */
  deterministic: boolean;
  traceHash: string;
}

export class ReplayViewModel {
  /**
   * Build trace view model from an execution graph.
   * Uses topological sort (same algorithm as ReplayConsistencyTest).
   */
  fromGraph(graph: ExecutionGraph, iteration: number = 1): ReplayViewState {
    // Build adjacency
    const adjList = new Map<string, string[]>();
    const reverseAdj = new Map<string, string[]>();

    for (const node of graph.nodes) {
      adjList.set(node.id, []);
      reverseAdj.set(node.id, []);
    }

    for (const edge of graph.edges) {
      const out = adjList.get(edge.from) || [];
      out.push(edge.to);
      adjList.set(edge.from, out);

      const inc = reverseAdj.get(edge.to) || [];
      inc.push(edge.from);
      reverseAdj.set(edge.to, inc);
    }

    // Kahn's topological sort
    const inDegree = new Map<string, number>();
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
    }
    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const nodeOrder: string[] = [];
    const steps: ReplayStepVM[] = [];
    let step = 0;

    while (queue.length > 0) {
      queue.sort(); // deterministic
      const id = queue.shift()!;
      nodeOrder.push(id);

      const outgoing = adjList.get(id) || [];
      const incoming = reverseAdj.get(id) || [];
      const node = nodeMap.get(id);

      steps.push({
        step: ++step,
        nodeId: id,
        nodeType: node?.type || "unknown",
        incomingFrom: incoming,
        outgoingTo: outgoing,
      });

      for (const neighbor of outgoing) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    const nodeTypeSequence = nodeOrder.map((id) => nodeMap.get(id)?.type || "unknown");
    const traceHash = Buffer.from(JSON.stringify({ nodeOrder, nodeTypeSequence })).toString("base64");

    return {
      domain: graph.domain,
      iteration,
      trace: { steps, nodeOrder, nodeTypeSequence },
      totalSteps: steps.length,
      deterministic: true, // single iteration = deterministic by construction
      traceHash,
    };
  }

  /**
   * Compare multiple trace view models for determinism.
   */
  checkDeterminism(traces: ReplayViewState[]): {
    deterministic: boolean;
    count: number;
    allSame: boolean;
    firstHash: string;
  } {
    if (traces.length === 0) {
      return { deterministic: true, count: 0, allSame: true, firstHash: "" };
    }

    const firstHash = traces[0].traceHash;
    const allSame = traces.every((t) => t.traceHash === firstHash);

    return {
      deterministic: allSame,
      count: traces.length,
      allSame,
      firstHash,
    };
  }
}
