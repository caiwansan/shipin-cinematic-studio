/**
 * DAG Optimizer
 * Phase 7 — Execution Intelligence Layer
 *
 * 执行路径优化器：对 DAG 的执行顺序进行智能优化。
 *
 * 优化策略：
 *   - LIGHT_FIRST: 小场景优先（最小 shot 数最先跑）
 *   - HEAVY_FIRST: 大场景优先（最大 shot 数最先跑，释放资源）
 *   - COST_BALANCED: 按成本分布均匀化（默认）
 *
 * 优化不改变 DAG 拓扑结构，只改变执行顺序。
 * 因果一致性不受影响——优化的是「调度顺序」，不是「依赖关系」。
 */

import { CostModel, ExecutionCost } from './cost-model'

export type OptimizationMode = 'LIGHT_FIRST' | 'HEAVY_FIRST' | 'COST_BALANCED'

export class DAGOptimizer {
  /**
   * 优化场景执行顺序
   * @param scenes 场景列表
   * @param mode 优化模式
   * @returns 优化后的场景列表（原地排序）
   */
  optimize(
    scenes: any[],
    mode: OptimizationMode = 'COST_BALANCED',
  ): any[] {
    const costModel = new CostModel()

    const scored = scenes.map(scene => ({
      scene,
      cost: costModel.estimate(scene),
    }))

    switch (mode) {
      case 'LIGHT_FIRST':
        scored.sort((a, b) => a.cost.renderTime - b.cost.renderTime)
        break
      case 'HEAVY_FIRST':
        scored.sort((a, b) => b.cost.renderTime - a.cost.renderTime)
        break
      case 'COST_BALANCED':
        // 交替大小场景：大 → 小 → 中大 → 小中 …
        scored.sort((a, b) => b.cost.renderTime - a.cost.renderTime)
        this.interleave(scored)
        break
    }

    return scored.map(s => s.scene)
  }

  /**
   * 生成优化建议的文本说明
   */
  explain(scenes: any[], mode: OptimizationMode): string {
    const names = scenes.map(s => `${s.id}(${s.name || s.id})`).join(' → ')
    const modeLabel: Record<OptimizationMode, string> = {
      LIGHT_FIRST: '轻量优先',
      HEAVY_FIRST: '重量优先',
      COST_BALANCED: '成本均衡',
    }
    return `[${modeLabel[mode]}] 执行顺序: ${names}`
  }

  /**
   * 大小交替排列（大中小大小小中大...）
   */
  private interleave(scored: { cost: ExecutionCost }[]): void {
    if (scored.length <= 2) return

    const result: typeof scored = []
    let left = 0
    let right = scored.length - 1
    let takeFromLeft = false // 从大开始

    while (left <= right) {
      if (takeFromLeft) {
        result.push(scored[left])
        left++
      } else {
        result.push(scored[right])
        right--
      }
      takeFromLeft = !takeFromLeft
    }

    // 原地写回
    for (let i = 0; i < result.length; i++) {
      scored[i] = result[i]
    }
  }
}
