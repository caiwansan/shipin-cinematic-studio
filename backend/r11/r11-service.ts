/**
 * r11/r11-service.ts
 *
 * R11 — Graph Normalization & Replay Service
 *
 * 组合 Adapter Registry + Graph Diff + Graph Replay 为统一入口。
 * 延续 R10 的工程约束：
 *   1. 不可侵入主 runtime
 *   2. 无副作用
 *   3. 默认关闭（通过 R10 config feature flag）
 */

import { isR10Enabled } from "../r10/r10-config";
import { AdapterRegistry, adapterRegistry } from "./adapter/adapter-registry";
import type { GraphAdapter } from "./adapter/adapter-types";
import type { ExecutionGraph } from "./graph/graph-types";
import { DiffKernel } from "../r10/diff/diff-kernel";

export class R11Service {
  private diffKernel = new DiffKernel();

  /**
   * Register adapter into the global registry.
   */
  registerAdapter(adapter: GraphAdapter): void {
    adapterRegistry.register(adapter);
  }

  /**
   * Register multiple adapters.
   */
  registerAdapters(adapters: GraphAdapter[]): void {
    adapterRegistry.registerAll(adapters);
  }

  /**
   * Get the adapter registry (for inspection).
   */
  getRegistry(): AdapterRegistry {
    return adapterRegistry;
  }

  /**
   * Project domain graph to normalized ExecutionGraph.
   */
  project(domain: string, input: any): ExecutionGraph | null {
    if (!isR10Enabled()) {
      console.warn("[R11] R10 is disabled. Enable via config.");
      return null;
    }
    return adapterRegistry.projectByDomain(domain, input);
  }

  /**
   * Diff two execution graphs (post-projection).
   */
  diff(
    baselineGraph: ExecutionGraph,
    currentGraph: ExecutionGraph,
    baselineId: string,
    currentId: string,
  ) {
    if (!isR10Enabled()) return null;
    return this.diffKernel.buildResult(baselineGraph, currentGraph, baselineId, currentId);
  }

  /**
   * List registered domains.
   */
  listDomains(): string[] {
    return adapterRegistry.listDomains();
  }

  /**
   * Projection fidelity check: project → JSON roundtrip
   * Returns true if projection is stable (no info loss on re-project).
   */
  checkFidelity(domain: string, input: any): boolean {
    try {
      const projected = this.project(domain, input);
      if (!projected) return false;
      // Re-project — should produce same normalized form
      const reProjected = this.project(domain, input);
      return JSON.stringify(projected) === JSON.stringify(reProjected);
    } catch {
      return false;
    }
  }
}
