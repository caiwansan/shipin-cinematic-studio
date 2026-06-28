/**
 * r11/ui/view-models/timeline.vm.ts
 *
 * Timeline ViewModel — Passive diff result projection
 *
 * 展示 R9 baseline → R10 → current 的 graph 变化。
 * 所有数据来自 DiffResult，不做任何"趋势分析"。
 */

import type { DiffResult, DiffNode } from "../../r10/diff/diff-types";

export type ChangeType = "EQUAL" | "MODIFIED" | "ADDED" | "REMOVED";

/** 单个变化项 —— 纯 diff 记录投影 */
export interface TimelineChangeVM {
  type: ChangeType;
  nodeId: string;
  /** type-specific detail */
  detail?: {
    field?: string;
    oldValue?: string;
    newValue?: string;
  };
}

/** 时间轴 snapshot */
export interface TimelineSnapshotVM {
  label: string;
  timestamp: number;
  changes: TimelineChangeVM[];
  stats: {
    equal: number;
    modified: number;
    added: number;
    removed: number;
  };
}

/** diff 对比段 */
export interface TimelineDiffVM {
  baselineId: string;
  currentId: string;
  snapshot: TimelineSnapshotVM;
}

/** 完整时间轴视图状态 */
export interface TimelineViewState {
  diffs: TimelineDiffVM[];
  totalChanges: number;
}

export class TimelineViewModel {
  /**
   * Build timeline from a single diff result.
   * Pure projection — no trend, no drift, no risk assessment.
   */
  fromDiff(diff: DiffResult, baselineLabel?: string): TimelineDiffVM {
    const changes: TimelineChangeVM[] = [];

    for (const node of diff.nodes) {
      const change: TimelineChangeVM = {
        type: node.diffType as ChangeType,
        nodeId: node.key,
      };

      if (node.diffType === "MODIFIED" && node.changes) {
        change.detail = {
          field: node.changes[0]?.field,
          oldValue: node.changes[0]?.oldValue?.toString().slice(0, 60),
          newValue: node.changes[0]?.newValue?.toString().slice(0, 60),
        };
      }

      changes.push(change);
    }

    const summary = diff.summary;

    return {
      baselineId: diff.baselineSnapshotId,
      currentId: diff.currentSnapshotId,
      snapshot: {
        label: baselineLabel || `diff: ${diff.baselineSnapshotId} → ${diff.currentSnapshotId}`,
        timestamp: Date.now(),
        changes,
        stats: {
          equal: summary.equal,
          modified: summary.modified,
          added: summary.added,
          removed: summary.removed,
        },
      },
    };
  }

  /**
   * Build timeline from multiple diff results.
   */
  fromDiffs(diffs: DiffResult[], labels?: string[]): TimelineViewState {
    const timelineDiffs: TimelineDiffVM[] = diffs.map((d, i) =>
      this.fromDiff(d, labels?.[i])
    );

    return {
      diffs: timelineDiffs,
      totalChanges: timelineDiffs.reduce(
        (sum, d) => sum + d.snapshot.changes.length,
        0
      ),
    };
  }
}
