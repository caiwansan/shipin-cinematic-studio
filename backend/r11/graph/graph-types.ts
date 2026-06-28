/**
 * r11/graph/graph-types.ts
 *
 * R11 — Normalized ExecutionGraph（归一化投影目标）
 *
 * 设计原则：
 *   1. Neutral — 不包含任何 domain logic
 *   2. Minimal — 只包含 diff/replay 所需的最小字段
 *   3. Traceable — 保留原始身份信息（domain + nativeId）
 */

export type NormalizedNodeType =
  | "agent"
  | "tool"
  | "transform"
  | "state"
  | "decision"
  | "llm"
  | "pipeline"
  | "unknown";

export type NormalizedEdgeType =
  | "flow"
  | "data"
  | "control"
  | "depends"
  | "version"
  | "unknown";

export interface NormalizedNode {
  id: string;
  type: NormalizedNodeType;

  /** Preserve raw domain payload for backtrace */
  raw?: any;

  /** Original identity before normalization */
  domainId?: string;
}

export interface NormalizedEdge {
  from: string;
  to: string;
  type: NormalizedEdgeType;
}

export interface ExecutionGraph {
  domain: string;
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  meta?: {
    runId?: string;
    timestamp?: number;
    label?: string;
  };
}
