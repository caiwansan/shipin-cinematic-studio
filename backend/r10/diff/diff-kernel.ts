/**
 * r10/diff/diff-kernel.ts
 *
 * R10 — Diff Kernel
 *
 * Deterministic deep-diff engine for comparing R9 baseline vs current run.
 * Pure function: no side effects, no state, no AI.
 */

import { DiffNode, DiffResult, DiffType } from "./diff-types";

function isObject(v: any): boolean {
  return v !== null && typeof v === "object";
}

function getType(v: any): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export class DiffKernel {

  /**
   * Recursive deep comparison between two values.
   * Pure function — returns DiffNode[] without mutation.
   */
  diff(baseline: any, current: any, path = ""): DiffNode[] {
    const nodes: DiffNode[] = [];

    // Type divergence
    if (getType(baseline) !== getType(current)) {
      nodes.push({
        path,
        type: "TYPE_CHANGED",
        baselineValue: baseline,
        currentValue: current,
      });
      return nodes;
    }

    // Both null / undefined
    if (baseline === null && current === null) {
      nodes.push({ path, type: "EQUAL", baselineValue: null, currentValue: null });
      return nodes;
    }

    // Primitive compare
    if (!isObject(baseline) && !isObject(current)) {
      if (baseline === current) {
        nodes.push({ path, type: "EQUAL", baselineValue: baseline, currentValue: current });
      } else {
        nodes.push({ path, type: "MODIFIED", baselineValue: baseline, currentValue: current });
      }
      return nodes;
    }

    // Array compare
    if (Array.isArray(baseline) && Array.isArray(current)) {
      const max = Math.max(baseline.length, current.length);

      for (let i = 0; i < max; i++) {
        const subPath = `${path}[${i}]`;

        if (i >= baseline.length) {
          // Added element
          nodes.push({ path: subPath, type: "ADDED", currentValue: current[i] });
        } else if (i >= current.length) {
          // Removed element
          nodes.push({ path: subPath, type: "REMOVED", baselineValue: baseline[i] });
        } else {
          // Compare
          nodes.push(...this.diff(baseline[i], current[i], subPath));
        }
      }

      return nodes;
    }

    // Object compare
    if (isObject(baseline) && isObject(current) && !Array.isArray(baseline) && !Array.isArray(current)) {
      const keys = new Set([
        ...Object.keys(baseline || {}),
        ...Object.keys(current || {}),
      ]);

      for (const key of keys) {
        const subPath = path ? `${path}.${key}` : key;

        if (!(key in baseline)) {
          // Added key
          nodes.push({ path: subPath, type: "ADDED", currentValue: current[key] });
        } else if (!(key in current)) {
          // Removed key
          nodes.push({ path: subPath, type: "REMOVED", baselineValue: baseline[key] });
        } else {
          // Compare recursively
          nodes.push(...this.diff(baseline[key], current[key], subPath));
        }
      }

      return nodes;
    }

    return nodes;
  }

  /**
   * Build a complete DiffResult from two arbitrary objects.
   */
  buildResult(
    baseline: any,
    current: any,
    baselineId: string,
    currentId: string,
  ): DiffResult {
    const nodes = this.diff(baseline, current);

    const summary = {
      total: nodes.length,
      equal: nodes.filter(n => n.type === "EQUAL").length,
      modified: nodes.filter(n => n.type === "MODIFIED").length,
      added: nodes.filter(n => n.type === "ADDED").length,
      removed: nodes.filter(n => n.type === "REMOVED").length,
      typeChanged: nodes.filter(n => n.type === "TYPE_CHANGED").length,
    };

    return {
      timestamp: Date.now(),
      baselineId,
      currentId,
      nodes,
      summary,
    };
  }
}
