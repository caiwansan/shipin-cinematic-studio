// ============================================================
// Dependency Builder — 执行图依赖构建器 (RC3-1)
// ============================================================
// 负责从 PlanningStep 中提取依赖关系，并支持自动推断。
// 不涉及 Scheduler / CapabilityRouter / 成本估算。

import type { NodeType } from '../types'
import type { PlanningStep, PlanningEdgeResult } from './planner.types'

export class DependencyBuilder {
  /**
   * 从 steps 构建依赖边
   * 每个 step 的 dependsOn 列表直接映射为边
   */
  buildEdges(steps: PlanningStep[]): PlanningEdgeResult[] {
    const edges: PlanningEdgeResult[] = []
    const stepIds = new Set(steps.map((s) => s.id))

    for (const step of steps) {
      for (const depId of step.dependsOn) {
        // 只添加存在于步骤列表中的依赖
        if (stepIds.has(depId)) {
          edges.push({ from: depId, to: step.id })
        }
      }
    }

    return edges
  }

  /**
   * 自动推断依赖
   * 基于节点类型的预设依赖规则
   *
   * 默认规则链:
   *   discovery → knowledge
   *   discovery → knowledge → recommendation
   *   discovery → knowledge → recommendation → verification
   *   discovery → knowledge → recommendation → verification → publishing
   */
  inferDependencies(
    steps: PlanningStep[],
    rules?: Map<NodeType, NodeType[]>,
  ): PlanningEdgeResult[] {
    // 默认推断规则
    const defaultRules = new Map<string, string[]>()
    defaultRules.set('knowledge', ['discovery'])
    defaultRules.set('recommendation', ['discovery', 'knowledge'])
    defaultRules.set('verification', ['recommendation', 'knowledge'])
    defaultRules.set('publishing', ['verification', 'recommendation'])

    const rulesToUse = rules ?? defaultRules
    const edges: PlanningEdgeResult[] = []

    for (const step of steps) {
      const requiredTypes = rulesToUse.get(step.type)
      if (!requiredTypes) continue

      for (const requiredType of requiredTypes) {
        // 找当前步骤之前最近的同类型节点
        const preReq = steps.find(
          (s) =>
            s.type === requiredType &&
            s.id !== step.id &&
            !step.dependsOn.includes(s.id) &&
            !edges.some((e) => e.from === s.id && e.to === step.id),
        )
        if (preReq) {
          edges.push({ from: preReq.id, to: step.id })
        }
      }
    }

    return edges
  }
}
