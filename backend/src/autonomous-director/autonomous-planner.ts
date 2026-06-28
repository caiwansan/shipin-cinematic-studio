/**
 * Autonomous Execution Planner
 * Phase 8 — Autonomous Director Layer
 *
 * 自治执行规划器：对自动构建的 DAG 制定执行策略。
 *
 * 规划维度：
 *   - 优先级：根据场景位置和策略动态计算
 *   - 执行策略：可选 balanced / low_latency / batch
 *   - 资源分配：每个场景的 computeUnits 预估
 *   - 依赖链分析：预测并发执行机会
 */

import { SceneGraphNode } from './scene-graph-composer'

export interface ExecutionPlanItem {
  id: string
  type: 'SCENE' | 'SHOT'
  priority: number
  strategy: string
  computeUnits: number
  estimatedTime: number
  dependsOn: string[]
}

export interface AutonomousPlan {
  items: ExecutionPlanItem[]
  concurrencyHints: string[][] // 可以并发执行的节点组
  totalEstimate: {
    computeUnits: number
    estimatedTime: number
    parallelizable: number // 可以并行化的比例
  }
}

export class AutonomousPlanner {
  /**
   * 对 DAG 蓝图制定自治执行计划
   */
  plan(blueprint: { scenes: SceneGraphNode[] }): AutonomousPlan {
    const items: ExecutionPlanItem[] = []
    const concurrencyGroups: Set<string>[] = []
    let totalCompute = 0

    for (const scene of blueprint.scenes) {
      // SCENE 节点
      const scenePriority = this.calculatePriority(scene, 'SCENE')
      items.push({
        id: scene.id,
        type: 'SCENE',
        priority: scenePriority,
        strategy: scene.strategy,
        computeUnits: scene.shots?.length || 1 * 2,
        estimatedTime: (scene.shots?.length || 1) * 150,
        dependsOn: scene.order > 0
          ? [blueprint.scenes[scene.order - 1].id]
          : [],
      })
      totalCompute += scene.shots?.length || 1

      // SHOT 节点
      const shotGroup = new Set<string>()
      for (const shot of scene.shots || []) {
        const shotPriority = this.calculatePriority(shot, 'SHOT')
        items.push({
          id: shot.id,
          type: 'SHOT',
          priority: shotPriority,
          strategy: shot.strategy,
          computeUnits: 1,
          estimatedTime: 120,
          dependsOn: [scene.id],
        })
        shotGroup.add(shot.id)
      }

      // 同一场景的 shot 可以并行
      if (shotGroup.size > 1) {
        concurrencyGroups.push(shotGroup)
      }
    }

    // 按优先级排序
    items.sort((a, b) => a.priority - b.priority)

    const totalTime = items.reduce((sum, i) => sum + i.estimatedTime, 0)
    const parallelizableItems = items.filter(
      i => concurrencyGroups.some(g => g.has(i.id)),
    ).length

    return {
      items,
      concurrencyHints: concurrencyGroups.map(g => Array.from(g)),
      totalEstimate: {
        computeUnits: totalCompute,
        estimatedTime: totalTime,
        parallelizable: totalCompute > 0
          ? Math.round((parallelizableItems / items.length) * 100)
          : 0,
      },
    }
  }

  /**
   * 计算节点优先级
   * SCENE: 越靠前优先级越高
   * SHOT: 同一场景内 shot 均衡
   */
  private calculatePriority(
    node: { order: number },
    type: 'SCENE' | 'SHOT',
  ): number {
    if (type === 'SCENE') {
      return 100 + node.order * 50
    }
    return 150
  }
}
