/**
 * causal/drift-attributor.ts
 *
 * Phase 5 — DriftAttributor
 *
 * 将 drift delta 映射为因果节点链。
 * 规则驱动，不做概率推断。
 *
 * 归因规则（确定性）：
 *   1. adapter 变更 → graph 结构漂移 → runtime 发散
 *   2. 无 adapter 变更但有 projection drift → graph 自身变化
 *   3. 仅 replay drift → runtime 非确定性（无需跟踪）
 *   4. regression → fidelity delta 为负
 *
 * 铁律：
 * - 只做确定性规则匹配
 * - 不做预测、不做猜测
 */

import type {
  CausalNode,
  CausalEdge,
  CausalTrace,
  DriftEventSummary,
  CausalNodeType,
} from "./causal-types";

export class DriftAttributor {
  /**
   * 将 drift delta 归因到因果链。
   * 返回 rootCause → chain 的有向序列。
   */
  attribute(drift: DriftEventSummary): CausalTrace {
    const chain: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    const timestamp = Date.now();

    // Layer 1: adapter change
    if (drift.adapterVersionChanged) {
      const node: CausalNode = {
        id: `adapter_${timestamp}`,
        type: "adapter",
        label: `Adapter change: ${drift.oldVersion} → ${drift.newVersion}`,
        detail: `Version migration`,
      };
      chain.push(node);
    }

    // Layer 2: graph structure shift
    if (drift.projectionDrift) {
      const prev = chain[chain.length - 1];
      const node: CausalNode = {
        id: `graph_${timestamp}`,
        type: "graph",
        label: "Graph structure shift",
        detail: "projection hash changed",
      };
      if (prev) {
        edges.push({
          from: prev.id,
          to: node.id,
          reason: "adapter_change_induced_structure_shift",
        });
      }
      chain.push(node);
    }

    // Layer 3: runtime divergence
    if (drift.replayDrift) {
      const prev = chain[chain.length - 1];
      const node: CausalNode = {
        id: `runtime_${timestamp}`,
        type: "runtime",
        label: "Execution path divergence",
        detail: "replay hash changed",
      };
      if (prev) {
        edges.push({
          from: prev.id,
          to: node.id,
          reason: "structure_shift_induced_runtime_divergence",
        });
      }
      chain.push(node);
    }

    // Layer 4: policy trigger (regression)
    if (drift.regression) {
      const prev = chain[chain.length - 1];
      const node: CausalNode = {
        id: `policy_${timestamp}`,
        type: "policy",
        label: `Fidelity regression: ${(drift.fidelityDelta * 100).toFixed(1)}%`,
        detail: `fidelity delta = ${drift.fidelityDelta}`,
      };
      if (prev) {
        edges.push({
          from: prev.id,
          to: node.id,
          reason: "fidelity_degradation_triggered_policy",
        });
      }
      chain.push(node);
    }

    // If no drift detected at all, still return a single node
    if (chain.length === 0) {
      chain.push({
        id: `no_drift_${timestamp}`,
        type: "graph",
        label: "No structural drift detected",
      });
    }

    return {
      rootCause: chain[0],
      chain,
      edges,
      driftId: `drift_${timestamp}`,
      timestamp,
    };
  }
}
