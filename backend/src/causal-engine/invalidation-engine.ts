/**
 * Invalidation Engine
 * Phase 5 — Causal Consistency Engine
 *
 * 失效传播引擎：给定一个被修改的节点，沿因果链传播失效。
 * BFS 遍历下游所有受影响的节点，返回完整失效集。
 *
 * 原则：
 *   - 不直接修改 blueprint（分离 concern）
 *   - 只输出 "哪些节点是脏的"
 *   - 下游全部失效（严苛但安全）
 */

import { CausalGraphIndex } from './causal-graph-index'

export class InvalidationEngine {
  /**
   * 从 nodeId 开始向下游传播失效
   * BFS 确保层级遍历，避免栈溢出
   */
  propagate(nodeId: string, graph: CausalGraphIndex): string[] {
    const invalidated = new Set<string>()
    const queue: string[] = [nodeId]

    while (queue.length > 0) {
      const current = queue.shift()!

      if (invalidated.has(current)) continue
      invalidated.add(current)

      const downstream = graph.getDownstream(current)
      for (const d of downstream) {
        if (!invalidated.has(d)) {
          queue.push(d)
        }
      }
    }

    return Array.from(invalidated)
  }

  /**
   * 多源失效传播（批量变更时使用）
   */
  propagateMany(nodeIds: string[], graph: CausalGraphIndex): string[] {
    const all = new Set<string>()
    for (const id of nodeIds) {
      const result = this.propagate(id, graph)
      for (const r of result) {
        all.add(r)
      }
    }
    return Array.from(all)
  }
}
