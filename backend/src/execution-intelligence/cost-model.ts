/**
 * Execution Cost Model
 * Phase 7 — Execution Intelligence Layer
 *
 * 执行成本模型：预估每个节点的执行成本。
 * 成本维度：
 *   - renderTime: 预估渲染耗时（ms）
 *   - computeUnits: 预估计算量（token/算力单位）
 *   - latency: 预估延迟阶（shot=1, scene=3, director=5）
 *   - monetaryCost: 货币成本（预留，需接入计费系统后启用）
 *
 * 用途：
 *   - DAGOptimizer 排序依据
 *   - AdaptiveExecutor 优先级计算
 *   - 系统 self-tuning 参考
 */

export interface ExecutionCost {
  renderTime: number
  computeUnits: number
  latency: number
  monetaryCost?: number
}

export class CostModel {
  /**
   * 估算单个节点的执行成本
   */
  estimate(node: any): ExecutionCost {
    if (!node) {
      return { renderTime: 0, computeUnits: 0, latency: 0 }
    }

    const shotCount = node.shots?.length || 1

    // latency: SHOT=1, SCENE=3, DIRECTOR=5
    const latencyMap: Record<string, number> = {
      SHOT: 1,
      SCENE: 3,
      DIRECTOR: 5,
    }
    const latency = latencyMap[node.type] ?? 2

    // renderTime: shots × 基准 120ms
    const renderTime = shotCount * 120

    // computeUnits: shots × 2
    const computeUnits = shotCount * 2

    return { renderTime, computeUnits, latency }
  }

  /**
   * 估算完整 blueprint 的总成本
   */
  estimateBlueprint(blueprint: any): {
    total: ExecutionCost
    perScene: Record<string, ExecutionCost>
  } {
    const raw = blueprint?.data ?? blueprint
    const perScene: Record<string, ExecutionCost> = {}
    let totalRenderTime = 0
    let totalComputeUnits = 0
    let totalLatency = 0

    for (const scene of raw.scenes || []) {
      const cost = this.estimate(scene)
      perScene[scene.id] = cost
      totalRenderTime += cost.renderTime
      totalComputeUnits += cost.computeUnits
      totalLatency = Math.max(totalLatency, cost.latency)
    }

    return {
      total: {
        renderTime: totalRenderTime,
        computeUnits: totalComputeUnits,
        latency: totalLatency,
      },
      perScene,
    }
  }

  /**
   * 比较两个执行方案的优劣
   */
  compare(a: ExecutionCost, b: ExecutionCost): 'BETTER' | 'WORSE' | 'SAME' {
    const scoreA = a.renderTime + a.latency * 100
    const scoreB = b.renderTime + b.latency * 100
    if (scoreA < scoreB) return 'BETTER'
    if (scoreA > scoreB) return 'WORSE'
    return 'SAME'
  }
}
