/**
 * Execution Lineage Graph
 * Phase 6 — Execution Memory Layer
 *
 * 执行谱系：追踪 DAG 版本之间的父子关系。
 * 每次 retry / patch / 重新 render 都会产生新的版本次，
 * Lineage Graph 记录 "谁产生了谁"。
 *
 * 图结构：DAG（非树），一个版本可以有多个子版本。
 */

export class ExecutionLineage {
  private parents = new Map<string, string[]>()
  private children = new Map<string, string[]>()

  /**
   * 记录版本间的父子关系
   */
  link(fromVersionId: string, toVersionId: string): void {
    // 记录子→父（getParents）
    if (!this.parents.has(toVersionId)) {
      this.parents.set(toVersionId, [])
    }
    this.parents.get(toVersionId)!.push(fromVersionId)

    // 记录父→子（getChildren）
    if (!this.children.has(fromVersionId)) {
      this.children.set(fromVersionId, [])
    }
    this.children.get(fromVersionId)!.push(toVersionId)
  }

  /**
   * 获取某个版本的所有子版本（下游）
   */
  getChildren(versionId: string): string[] {
    return this.children.get(versionId) || []
  }

  /**
   * 获取某个版本的所有父版本（上游）
   */
  getParents(versionId: string): string[] {
    return this.parents.get(versionId) || []
  }

  /**
   * 获取从根版本到指定版本的路径（第一个找到的路径）
   */
  getPath(fromVersionId: string, toVersionId: string): string[] {
    const visited = new Set<string>()
    const queue: { id: string; path: string[] }[] = [
      { id: fromVersionId, path: [fromVersionId] },
    ]

    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      if (id === toVersionId) return path

      if (visited.has(id)) continue
      visited.add(id)

      for (const child of this.getChildren(id)) {
        queue.push({ id: child, path: [...path, child] })
      }
    }

    return []
  }

  /**
   * 获取所有版本 ID（用于统计）
   */
  getAllVersionIds(): string[] {
    return Array.from(
      new Set([...this.parents.keys(), ...this.children.keys()]),
    )
  }
}

// 进程内全局实例
export const globalLineage = new ExecutionLineage()
