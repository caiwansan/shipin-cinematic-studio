/**
 * r11/adapter/adapter-types.ts
 *
 * R11 — Adapter Layer 类型系统
 *
 * 每个 adapter 将一个 domain graph 投影到统一的 Normalized ExecutionGraph。
 * 语义：projection（投影），不是 transformation（转换）。
 */

import type { ExecutionGraph } from "../graph/graph-types";

export interface GraphAdapter<T = any> {
  /** Domain identifier, e.g. "decision-graph", "agent-graph" */
  domain: string;
  /** Human-readable label */
  label: string;

  /**
   * Check if this adapter can handle the input.
   * Guard clause — prevents mis-routing.
   */
  canAdapt(input: any): input is T;

  /**
   * Project domain-specific graph to normalized ExecutionGraph.
   * Must be loss-minimal — preserve raw payload for backtrace.
   */
  project(input: T): ExecutionGraph;
}

export interface AdapterRegistration {
  adapter: GraphAdapter;
  priority?: number;
}

export class AdapterNotFoundError extends Error {
  constructor(domain: string) {
    super(`[R11] No adapter found for domain: ${domain}`);
    this.name = "AdapterNotFoundError";
  }
}

export class AdapterMismatchError extends Error {
  constructor(domain: string, inputType: string) {
    super(`[R11] Adapter "${domain}" cannot handle input type: ${inputType}`);
    this.name = "AdapterMismatchError";
  }
}
