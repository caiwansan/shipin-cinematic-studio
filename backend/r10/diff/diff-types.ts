/**
 * r10/diff/diff-types.ts
 *
 * R10 — Diff Kernel 类型系统
 *
 * 固定 diff 语言：EQUAL / MODIFIED / ADDED / REMOVED / TYPE_CHANGED
 * 所有系统统一使用此 schema 描述变化。
 */

export type DiffType =
  | "EQUAL"
  | "MODIFIED"
  | "ADDED"
  | "REMOVED"
  | "TYPE_CHANGED";

export interface DiffNode {
  /** JSON path, e.g. "asset.images[0].url" */
  path: string;
  type: DiffType;

  /** Primitive values for terminal nodes */
  baselineValue?: any;
  currentValue?: any;

  /** Optional severity hint for future scoring */
  metadata?: {
    severity?: "low" | "medium" | "high";
    reason?: string;
  };
}

export interface DiffResult {
  timestamp: number;
  baselineId: string;
  currentId: string;

  /** Full diff node list */
  nodes: DiffNode[];

  summary: {
    total: number;
    equal: number;
    modified: number;
    added: number;
    removed: number;
    typeChanged: number;
  };
}
