/**
 * causal/causal-tracer.ts
 *
 * Phase 5 — CausalTracer
 *
 * 统一入口：接收 R11 drift timeline point → 产出 CausalReport。
 * 结合之前的 drift delta（来自 DriftDetector）和 policy evaluation（来自 StabilityService）。
 *
 * 铁律：
 * - 不做推断，只做确定性归因
 * - 不自动修复
 * - 不修改状态
 */

import type { CausalReport, CausalTrace, DriftEventSummary, CausalImpact } from "./causal-types";
import { DriftAttributor } from "./drift-attributor";

export interface CausalInput {
  projectionDrift: boolean;
  replayDrift: boolean;
  regression: boolean;
  fidelityDelta: number;
  adapterVersionChanged: boolean;
  oldVersion: string;
  newVersion: string;
  driftId?: string;
}

export class CausalTracer {
  private attributor = new DriftAttributor();

  /**
   * Trace a single drift point to its cause chain.
   */
  trace(input: CausalInput): CausalReport {
    const summary: DriftEventSummary = {
      projectionDrift: input.projectionDrift,
      replayDrift: input.replayDrift,
      regression: input.regression,
      fidelityDelta: input.fidelityDelta,
      adapterVersionChanged: input.adapterVersionChanged,
      oldVersion: input.oldVersion,
      newVersion: input.newVersion,
    };

    const trace: CausalTrace = this.attributor.attribute(summary);

    // Determine impacted layers
    const impactedLayers: string[] = [];
    for (const node of trace.chain) {
      const layer = layerName(node.type);
      if (!impactedLayers.includes(layer)) {
        impactedLayers.push(layer);
      }
    }

    // Determine impact level
    const impact: CausalImpact = this.determineImpact(trace, input);

    return { trace, impactedLayers, impact };
  }

  /**
   * Trace multiple drift points into a list of reports.
   */
  traceBatch(inputs: CausalInput[]): CausalReport[] {
    return inputs.map((input) => this.trace(input));
  }

  private determineImpact(trace: CausalTrace, input: CausalInput): CausalImpact {
    // regression + full chain = high
    // adapter change + graph shift = medium
    // nothing major = low
    if (input.regression && input.projectionDrift && input.replayDrift) {
      return "high";
    }
    if (input.projectionDrift || input.adapterVersionChanged) {
      return "medium";
    }
    return "low";
  }
}

function layerName(type: string): string {
  const map: Record<string, string> = {
    adapter: "Adapter Layer",
    graph: "Graph Structure",
    runtime: "Execution Runtime",
    policy: "Policy Layer",
  };
  return map[type] ?? type;
}
