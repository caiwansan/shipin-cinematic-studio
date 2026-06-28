/**
 * r11/ui/adapters/diff-view.adapter.ts
 *
 * Diff View Adapter — 时间轴渲染数据投影
 *
 * 职责：把 TimelineDiffVM 转为 timeline 时间线渲染数据。
 * 纯被动投影——不判断趋势，不标异常。
 */

import type { TimelineDiffVM, TimelineChangeVM } from "../view-models/timeline.vm";

export type ChangeColor = "green" | "red" | "yellow" | "gray";

export interface TimelineItem {
  changeType: string;
  nodeId: string;
  color: ChangeColor;
  detail?: string;
}

export interface DiffRenderData {
  baselineId: string;
  currentId: string;
  stats: {
    equal: number;
    modified: number;
    added: number;
    removed: number;
  };
  changes: TimelineItem[];
}

const CHANGE_COLOR: Record<string, ChangeColor> = {
  ADDED: "green",
  REMOVED: "red",
  MODIFIED: "yellow",
  EQUAL: "gray",
};

export class DiffViewAdapter {
  /**
   * Project TimelineDiffVM to render data.
   */
  project(diff: TimelineDiffVM): DiffRenderData {
    const changes: TimelineItem[] = diff.snapshot.changes.map((c: TimelineChangeVM) => ({
      changeType: c.type,
      nodeId: c.nodeId,
      color: CHANGE_COLOR[c.type] || "gray",
      detail: c.detail
        ? `${c.detail.field}: ${c.detail.oldValue} → ${c.detail.newValue}`
        : undefined,
    }));

    return {
      baselineId: diff.baselineId,
      currentId: diff.currentId,
      stats: { ...diff.snapshot.stats },
      changes,
    };
  }

  /**
   * Project multiple diffs for timeline view.
   */
  projectAll(diffs: TimelineDiffVM[]): DiffRenderData[] {
    return diffs.map((d) => this.project(d));
  }
}
