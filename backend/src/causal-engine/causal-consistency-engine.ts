/**
 * Causal Consistency Engine — Full Orchestrator
 * Phase 5 — Causal Consistency Engine
 *
 * 总控编排层：将因果索引、失效传播、差异检测、重算计划、自动修复
 * 编织为一个完整的因果一致性流程。
 *
 * 典型调用链路：
 *   triggerChange(nodeId, job)
 *     → 失效传播（CausalGraphIndex + InvalidationEngine）
 *     → 差异检测（CausalDiffEngine）
 *     → 重算计划（RecomputePlanner）
 *     → 自动修复（CausalRepairEngine）
 *     → 返回完整报告
 */

import { CausalGraphIndex } from './causal-graph-index'
import { InvalidationEngine } from './invalidation-engine'
import { RecomputePlanner, RecomputePlan } from './recompute-planner'
import { CausalDiffEngine, DiffResult } from './causal-diff-engine'
import { CausalRepairEngine } from './causal-repair-engine'

export interface ConsistencyReport {
  traceId: string
  nodeId: string
  invalidated: string[]
  diff: DiffResult | null
  plan: RecomputePlan
  repaired: boolean
  graphEdges: number
}

export class CausalConsistencyEngine {
  constructor(
    private graph: CausalGraphIndex = new CausalGraphIndex(),
    private invalidator: InvalidationEngine = new InvalidationEngine(),
    private planner: RecomputePlanner = new RecomputePlanner(),
    private differ: CausalDiffEngine = new CausalDiffEngine(),
    private repairer: CausalRepairEngine = new CausalRepairEngine(),
  ) {}

  /**
   * 因果图初始化（从 blueprint 建立因果索引）
   */
  initialize(blueprint: any): void {
    this.graph = CausalGraphIndex.fromBlueprint(blueprint)
  }

  /**
   * 触发一次因果一致性检查 + 修复
   *
   * @param nodeId 被修改的节点 ID
   * @param job 当前 job（含 blueprint）
   * @param oldBlueprint 修改前的 blueprint 快照（用于 diff）
   * @returns 完整的一致性报告
   */
  triggerChange(
    nodeId: string,
    job: { traceId: string; blueprint: any },
    oldBlueprint?: any,
  ): ConsistencyReport {
    // 1. 失效传播
    const invalidated = this.invalidator.propagate(nodeId, this.graph)

    // 2. 差异检测（如有前序快照）
    const diff: DiffResult | null = oldBlueprint
      ? this.differ.diff(oldBlueprint, job.blueprint)
      : null

    // 3. 重算计划
    const plan = this.planner.plan(invalidated, job.blueprint)

    // 4. 自动修复
    const repaired = invalidated.length > 0
    if (repaired) {
      this.repairer.repair(invalidated, job.blueprint)
    }

    return {
      traceId: job.traceId,
      nodeId,
      invalidated,
      diff,
      plan,
      repaired,
      graphEdges: this.graph.edges.length,
    }
  }

  /**
   * 获取当前因果图（只读）
   */
  getGraph(): CausalGraphIndex {
    return this.graph
  }
}
