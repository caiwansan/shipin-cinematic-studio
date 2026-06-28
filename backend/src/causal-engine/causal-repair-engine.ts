/**
 * Causal Repair Engine
 * Phase 5 — Causal Consistency Engine
 *
 * 自动修复引擎：根据失效传播结果，标记 blueprint 中需要重新生成的节点。
 *
 * 修复规则：
 *   - SHOT 失效 → 标记 status = "REGENERATE"
 *   - SCENE 失效 → 级联标记所有 shots status = "DIRTY"
 *   - 已标记的节点通过 ReExecutionEngine 重跑
 */

export class CausalRepairEngine {
  /**
   * 对 blueprint 应用失效修复标记
   * 返回修复后的 blueprint（原地修改，非不可变）
   */
  repair(invalidated: string[], blueprint: any): any {
    const raw = blueprint?.data ?? blueprint

    for (const scene of raw.scenes || []) {
      // SCENE 失效：所有 shots 标记 DIRTY
      if (invalidated.includes(scene.id)) {
        for (const shot of scene.shots || []) {
          shot.status = 'DIRTY'
        }
        continue // 跳过遍历 shots，因为都被标记了
      }

      // 单个 SHOT 失效
      for (const shot of scene.shots || []) {
        if (invalidated.includes(shot.id)) {
          shot.status = 'REGENERATE'
        }
      }
    }

    return blueprint
  }
}
