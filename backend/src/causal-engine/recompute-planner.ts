/**
 * Incremental Recompute Planner
 * Phase 5 — Causal Consistency Engine
 *
 * 局部重算计划器：将失效集转换为可执行的"哪些节点需要重算"的计划。
 *
 * 计划结果包含：
 *   - scene 级别：是否整场需要重算
 *   - shot 级别：是否单个 shot 需要重算
 *   - 标记状态：哪些应设为 REGENERATE / DIRTY
 */

export interface RecomputePlan {
  invalidated: string[]
  scenes: ScenePlan[]
}

export interface ScenePlan {
  id: string
  shouldRecompute: boolean
  shots: ShotPlan[]
}

export interface ShotPlan {
  id: string
  shouldRecompute: boolean
  markStatus: 'REGENERATE' | 'DIRTY' | 'CLEAN'
}

export class RecomputePlanner {
  /**
   * 根据失效集和 job blueprint 生成重算计划
   */
  plan(invalidatedNodes: string[], blueprint: any): RecomputePlan {
    const raw = blueprint?.data ?? blueprint
    const scenePlans: ScenePlan[] = []

    for (const scene of raw.scenes || []) {
      const sceneAffected = invalidatedNodes.includes(scene.id)
      const shotPlans: ShotPlan[] = []

      for (const shot of scene.shots || []) {
        const shotAffected = sceneAffected || invalidatedNodes.includes(shot.id)
        shotPlans.push({
          id: shot.id,
          shouldRecompute: shotAffected,
          markStatus: shotAffected ? 'REGENERATE' : 'CLEAN',
        })
      }

      scenePlans.push({
        id: scene.id,
        shouldRecompute: sceneAffected || shotPlans.some(s => s.shouldRecompute),
        shots: shotPlans,
      })
    }

    return {
      invalidated: invalidatedNodes,
      scenes: scenePlans,
    }
  }
}
