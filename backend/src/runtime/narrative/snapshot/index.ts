/**
 * Snapshot Engine — 统一出口
 * 
 * 所有 Snapshot Builder 在此注册，对外统一暴露。
 * 消费者只通过这里拿 Snapshot，不直接调 Runtime。
 */

import { WriterSnapshotBuilder } from './writer-snapshot-builder.js'
import { PlannerSnapshotBuilder } from './planner-snapshot-builder.js'
import type { WriterSnapshot, PlannerSnapshot, SnapshotContext } from './snapshot-types.js'

class SnapshotEngine {
  readonly writer = new WriterSnapshotBuilder()
  readonly planner = new PlannerSnapshotBuilder()

  /**
   * 构建 Writer 快照
   * Writer 只消费这一个对象
   */
  async buildWriterSnapshot(projectId: string, context?: Partial<SnapshotContext>): Promise<WriterSnapshot> {
    return this.writer.build(projectId, {
      projectId,
      chapterNo: context?.chapterNo || 1,
      focusCharacter: context?.focusCharacter,
      windowSize: context?.windowSize || 5,
    })
  }

  /**
   * 构建 Planner 快照
   * Planner 只消费这一个对象
   */
  async buildPlannerSnapshot(projectId: string): Promise<PlannerSnapshot> {
    return this.planner.build(projectId, { projectId })
  }
}

export const snapshotEngine = new SnapshotEngine()
