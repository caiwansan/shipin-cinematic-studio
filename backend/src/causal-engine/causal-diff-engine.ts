/**
 * Causal Diff Engine
 * Phase 5 — Causal Consistency Engine
 *
 * DAG 差异检测：对比两个 blueprint 之间的差异，
 * 输出所有发生变化的节点 ID。
 *
 * 用于：
 *   - patch-node 后检测实际变更范围
 *   - retry-node 后验证重跑不可变
 *   - causal consistency 验证
 */

export interface DiffResult {
  changed: string[]
  added: string[]
  removed: string[]
}

export class CausalDiffEngine {
  /**
   * 对比两个 blueprint（或 raw data）之间的差异
   */
  diff(
    oldBlueprint: any,
    newBlueprint: any,
  ): DiffResult {
    const oldRaw = oldBlueprint?.data ?? oldBlueprint
    const newRaw = newBlueprint?.data ?? newBlueprint

    const oldIds = this.collectIds(oldRaw)
    const newIds = this.collectIds(newRaw)

    const oldSet = new Set(oldIds)
    const newSet = new Set(newIds)

    const removed = oldIds.filter(id => !newSet.has(id))
    const added = newIds.filter(id => !oldSet.has(id))

    // 检测相同 ID 节点的内容变更
    const changed: string[] = []
    for (const id of oldIds) {
      if (!newSet.has(id)) continue
      const oldNode = this.findNode(oldRaw, id)
      const newNode = this.findNode(newRaw, id)
      if (oldNode && newNode && JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
        changed.push(id)
      }
    }

    return { changed, added, removed }
  }

  /** 收集 blueprint 中所有节点 ID */
  private collectIds(raw: any): string[] {
    const ids: string[] = []
    if (raw.director?.id) ids.push(raw.director.id)
    for (const scene of raw.scenes || []) {
      if (scene.id) ids.push(scene.id)
      for (const shot of scene.shots || []) {
        if (shot.id) ids.push(shot.id)
      }
    }
    return ids
  }

  /** 按 ID 查找节点 */
  private findNode(raw: any, id: string): any | undefined {
    if (raw.director?.id === id) return raw.director
    for (const scene of raw.scenes || []) {
      if (scene.id === id) return scene
      for (const shot of scene.shots || []) {
        if (shot.id === id) return shot
      }
    }
    return undefined
  }
}
