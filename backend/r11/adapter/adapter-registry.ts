/**
 * r11/adapter/adapter-registry.ts
 *
 * R11 — Graph Adapter Registry
 *
 * 统一注册 + 路由 + 投影入口。
 * 核心职责：input → find adapter → project → normalized ExecutionGraph
 */

import type { GraphAdapter, AdapterRegistration } from "./adapter-types";
import { AdapterNotFoundError, AdapterMismatchError } from "./adapter-types";
import type { ExecutionGraph } from "../graph/graph-types";

export class AdapterRegistry {
  private adapters = new Map<string, GraphAdapter>();

  /**
   * Register a graph adapter.
   */
  register(adapter: GraphAdapter): void {
    if (this.adapters.has(adapter.domain)) {
      console.warn(`[R11] Overwriting existing adapter for domain: ${adapter.domain}`);
    }
    this.adapters.set(adapter.domain, adapter);
  }

  /**
   * Register multiple adapters at once.
   */
  registerAll(adapters: GraphAdapter[]): void {
    for (const a of adapters) {
      this.register(a);
    }
  }

  /**
   * Get adapter by domain name.
   */
  get(domain: string): GraphAdapter | undefined {
    return this.adapters.get(domain);
  }

  /**
   * Find the first adapter that can handle the input (auto-detect).
   */
  findAdapter(input: any): GraphAdapter | null {
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.canAdapt(input)) return adapter;
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Project input to ExecutionGraph using named adapter.
   */
  projectByDomain(domain: string, input: any): ExecutionGraph {
    const adapter = this.adapters.get(domain);
    if (!adapter) throw new AdapterNotFoundError(domain);
    if (!adapter.canAdapt(input)) throw new AdapterMismatchError(domain, typeof input);

    return adapter.project(input);
  }

  /**
   * Auto-detect adapter and project.
   */
  projectAuto(input: any): ExecutionGraph {
    const adapter = this.findAdapter(input);
    if (!adapter) throw new AdapterNotFoundError("auto-detect");

    return adapter.project(input as any);
  }

  /**
   * List all registered domains.
   */
  listDomains(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/** Singleton */
export const adapterRegistry = new AdapterRegistry();
