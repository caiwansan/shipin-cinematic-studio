/**
 * identity/behavior-bias-engine.ts — Phase 8 行为偏置引擎
 *
 * 从身份向量推导执行偏好（pacing、action probability、camera intensity weighting）。
 * 不修改 IR/Timeline 结构——只输出"偏置提示"供 Adaptive Kernel 使用。
 *
 * 宪法：
 *   - 不修改 IR / Timeline / ExecutionPlan
 *   - 不依赖 LLM
 *   - 仅输出 bias hints
 */

import type { IdentityVector } from './identity-vector.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface BehaviorBias {
  /** 推荐 pacing 调整 */
  pacingBias: number          // -0.5 (慢) 到 0.5 (快)
  /** 推荐 intensity 调整 */
  intensityBias: number       // -0.3 到 0.3
  /** 镜头推荐类型 */
  cameraPreference: 'close' | 'medium' | 'wide' | 'dynamic'
  /** 动作概率调整 */
  actionProbabilityBias: number
  /** 偏置信度 */
  confidence: number           // 0-1
  /** 解释 */
  reason: string
}

// ─── BehaviorBiasEngine ──────────────────────────────

export class BehaviorBiasEngine {
  /** 从身份向量推导行为偏置 */
  computeBias(identity: IdentityVector): BehaviorBias {
    // 1. Pacing bias: high aggression + high attention → 快节奏
    let pacingBias = 0
    pacingBias += (identity.aggression - 0.5) * 0.4
    pacingBias += (identity.attention - 0.5) * 0.3
    pacingBias += (identity.fear - 0.5) * 0.2   // 高恐惧 → 稍快（紧张）

    // 2. Intensity bias: high courage + high aggression → 高强度
    let intensityBias = 0
    intensityBias += (identity.courage - 0.5) * 0.2
    intensityBias += (identity.aggression - 0.5) * 0.3
    intensityBias -= (identity.fear - 0.5) * 0.2  // 高恐惧 → 低强度（回避）

    // 3. Camera preference
    let cameraPreference: 'close' | 'medium' | 'wide' | 'dynamic' = 'medium'
    const courageMinusFear = identity.courage - identity.fear
    if (courageMinusFear > 0.3 && identity.aggression > 0.6) {
      cameraPreference = 'close'     // 勇猛 → 特写
    } else if (courageMinusFear > 0.2) {
      cameraPreference = 'dynamic'   // 勇猛但不过激 → 动态镜头
    } else if (identity.fear > 0.7 && identity.attention > 0.7) {
      cameraPreference = 'close'     // 恐惧+警觉 → 特写（紧张感）
    } else if (identity.curiosity > 0.6) {
      cameraPreference = 'wide'      // 好奇 → 全景
    }

    // 4. Action probability bias
    let actionProbabilityBias = 0
    actionProbabilityBias += (identity.courage - 0.5) * 0.3
    actionProbabilityBias += (identity.aggression - 0.5) * 0.4
    actionProbabilityBias -= (identity.fear - 0.5) * 0.3
    actionProbabilityBias += (identity.attention - 0.5) * 0.2

    // 置信度：基于身份向量的"极化程度"
    const polarization = Object.values(identity).reduce(
      (sum, v) => sum + Math.abs(v - 0.5), 0
    ) / 6
    const confidence = Math.min(1, polarization * 1.5)

    // 原因描述
    const parts: string[] = []
    if (identity.aggression > 0.7) parts.push('攻击性高')
    if (identity.courage > 0.7) parts.push('勇气充沛')
    if (identity.fear > 0.7) parts.push('高度恐惧')
    if (identity.curiosity > 0.6) parts.push('好奇心强')
    if (identity.stability > 0.7) parts.push('情绪稳定')
    const reason = parts.length > 0
      ? `身份驱动: ${parts.join('、')}`
      : '身份均衡，无显著偏置'

    return {
      pacingBias: clampNeg(pacingBias, -0.5, 0.5),
      intensityBias: clampNeg(intensityBias, -0.3, 0.3),
      cameraPreference,
      actionProbabilityBias,
      confidence,
      reason,
    }
  }
}

function clampNeg(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export default BehaviorBiasEngine
