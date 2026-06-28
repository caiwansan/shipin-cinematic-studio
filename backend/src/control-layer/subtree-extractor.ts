/**
 * Subtree Extractor
 * Phase 4 — Execution Control Layer
 *
 * 给定 DAG 节点 ID，提取受影响的完整子树（含全部子孙节点）。
 * 用于 retry-node 时精确限定重跑范围。
 */

import { ExecutionTimeline, TimelineNode } from '../production-loop/timeline-types'

export class SubtreeExtractor {
  /**
   * 提取 nodeId 的完整子树（DFS，含自身）
   */
  extract(timeline: ExecutionTimeline, nodeId: string): string[] {
    const result: string[] = []

    function dfs(id: string) {
      result.push(id)
      for (const n of Object.values(timeline.nodes)) {
        if (n.parentId === id) {
          dfs(n.id)
        }
      }
    }

    dfs(nodeId)
    return result
  }

  /**
   * 提取 nodeId 的直接子节点（仅下一级）
   */
  extractChildren(timeline: ExecutionTimeline, nodeId: string): string[] {
    return Object.values(timeline.nodes)
      .filter(n => n.parentId === nodeId)
      .map(n => n.id)
  }

  /**
   * 提取 nodeId 的所有父路径（根 → 当前节点）
   */
  extractPath(timeline: ExecutionTimeline, nodeId: string): string[] {
    const path: string[] = []
    let current: TimelineNode | undefined = timeline.nodes[nodeId]

    while (current) {
      path.unshift(current.id)
      current = current.parentId ? timeline.nodes[current.parentId] : undefined
    }

    return path
  }
}
