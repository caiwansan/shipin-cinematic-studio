/**
 * identity/memory-to-action-mapper.ts — Phase 8 记忆到动作映射器
 *
 * 连接 Memory Events → Identity Drift → Behavior Bias 的管道。
 * 检测记忆中的重复失败、成功、情感模式，转化为行为偏置。
 *
 * 宪法：
 *   - 不修改 IR/Timeline/ExecutionPlan
 *   - 不依赖 LLM
 *   - 仅输出 bias hints
 */

import type { SceneMemoryStore } from '../memory/scene-memory-store.js'
import type { CausalEventChain } from '../memory/causal-event-chain.js'
import type { BehaviorBias } from './behavior-bias-engine.js'
import { BehaviorBiasEngine } from './behavior-bias-engine.js'
import type { IdentityVector } from './identity-vector.js'
import { IdentityVectorUtil } from './identity-vector.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface MemoryActionHint {
  /** 重复失败检测 */
  hasRepeatedFailure: boolean
  failureCount: number
  /** 成功模式检测 */
  hasSuccessPattern: boolean
  successCount: number
  /** 场景类型惯性 */
  dominantSceneType: string | null
  typeRepetitionRatio: number
  /** 情感惯性 */
  emotionInertia: 'rising' | 'falling' | 'stable'
  /** 因果链密度 */
  causalDensity: number
  /** 推荐的偏置调整 */
  suggestedBias: Partial<BehaviorBias>
}

// ─── MemoryToActionMapper ─────────────────────────────

export class MemoryToActionMapper {
  private biasEngine = new BehaviorBiasEngine()

  /** 从记忆 + 身份向量映射到动作提示 */
  map(memoryScenes: SceneMemoryStore, causalEvents: CausalEventChain, identity: IdentityVector): MemoryActionHint {
    const completedScenes = memoryScenes.getCompletedScenes()
    const sceneTypes = completedScenes.map(s => s.sceneType)

    // 1. 重复失败检测（outcome 完成但 finalIntensity 很低）
    const failures = completedScenes.filter(s => (s.outcome?.finalIntensity ?? 0.5) < 0.2)
    const successes = completedScenes.filter(s => (s.outcome?.finalIntensity ?? 0.5) > 0.7)

    // 2. 场景类型惯性
    const typeCounts = new Map<string, number>()
    for (const t of sceneTypes) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    let dominantSceneType: string | null = null
    let maxCount = 0
    for (const [type, count] of typeCounts) {
      if (count > maxCount) { maxCount = count; dominantSceneType = type }
    }
    const typeRepetitionRatio = completedScenes.length > 0 ? maxCount / completedScenes.length : 0

    // 3. 因果链密度
    const causalDensity = causalEvents.snapshot().totalLinks as number / Math.max(1, completedScenes.length)

    // 4. 从身份向量推导偏置
    const baseBias = this.biasEngine.computeBias(identity)

    // 5. 失败模式 → 降低 aggression + 增加 hesitation
    if (failures.length >= 2) {
      baseBias.pacingBias = Math.max(-0.5, baseBias.pacingBias - 0.15 * failures.length)
      baseBias.intensityBias = Math.max(-0.3, baseBias.intensityBias - 0.1 * failures.length)
    }

    // 6. 成功模式 → 增加 courage
    if (successes.length >= 2) {
      baseBias.pacingBias = Math.min(0.5, baseBias.pacingBias + 0.1 * successes.length)
    }

    // 7. 场景类型惯性 → curiosity 衰减信号
    if (typeRepetitionRatio > 0.6 && completedScenes.length >= 3) {
      baseBias.pacingBias = Math.max(-0.5, baseBias.pacingBias - 0.1)
      baseBias.reason += '；场景类型同质化'
    }

    return {
      hasRepeatedFailure: failures.length >= 2,
      failureCount: failures.length,
      hasSuccessPattern: successes.length >= 2,
      successCount: successes.length,
      dominantSceneType,
      typeRepetitionRatio,
      emotionInertia: identity.fear > 0.6 ? 'falling' : identity.courage > 0.6 ? 'rising' : 'stable',
      causalDensity,
      suggestedBias: {
        pacingBias: baseBias.pacingBias,
        intensityBias: baseBias.intensityBias,
        cameraPreference: baseBias.cameraPreference,
        actionProbabilityBias: baseBias.actionProbabilityBias,
        confidence: baseBias.confidence,
        reason: baseBias.reason,
      },
    }
  }

  /** 快照 */
  snapshot(memoryScenes: SceneMemoryStore, causalEvents: CausalEventChain, identity: IdentityVector): Record<string, unknown> {
    const hint = this.map(memoryScenes, causalEvents, identity)
    return {
      failureCount: hint.failureCount,
      successCount: hint.successCount,
      typeRepetitionRatio: hint.typeRepetitionRatio,
      causalDensity: hint.causalDensity,
      bias: hint.suggestedBias,
    }
  }
}

export default MemoryToActionMapper
