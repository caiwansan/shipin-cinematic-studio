/**
 * causal/causal-types.ts
 *
 * Phase 5 — Causal Drift Attribution System
 *
 * 核心类型：因果链的结构定义。
 * 将 drift 事件归因到 causal chain。
 *
 * 铁律：
 * - 只做确定性归因，不做推断/猜测
 * - 不自动修复
 * - 不改变下层系统
 */

export type CausalNodeType = "adapter" | "graph" | "runtime" | "policy";

export interface CausalNode {
  id: string;
  type: CausalNodeType;
  label: string;
  detail?: string;
}

export interface CausalEdge {
  from: string;
  to: string;
  reason: string;
}

export interface CausalTrace {
  rootCause: CausalNode;
  chain: CausalNode[];
  edges: CausalEdge[];
  driftId: string;
  timestamp: number;
}

export type CausalImpact = "high" | "medium" | "low";

export interface CausalReport {
  trace: CausalTrace;
  impactedLayers: string[];
  impact: CausalImpact;
}

export interface DriftEventSummary {
  projectionDrift: boolean;
  replayDrift: boolean;
  regression: boolean;
  fidelityDelta: number;
  adapterVersionChanged: boolean;
  oldVersion: string;
  newVersion: string;
}
