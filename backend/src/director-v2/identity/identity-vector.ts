/**
 * identity/identity-vector.ts — Phase 8 身份向量模型
 *
 * 定义角色身份向量（5 维）及其演化函数。
 * 所有维度来自记忆数据（emotion history + scene outcomes），
 * 不依赖 LLM。
 *
 * 宪法：
 *   - 仅从 Memory 演化
 *   - 不可由 LLM 定义
 *   - 不可修改 IR/Timeline/ExecutionPlan
 *
 * 维度说明：
 *   courage: 面对困难时的稳定度（0= coward, 1= 勇猛）
 *   fear: 对威胁的敏感性（0= 无畏, 1= 极度恐惧）
 *   curiosity: 探索倾向（0= 保守, 1= 好奇）
 *   aggression: 攻击倾向（0= 温和, 1= 好斗）
 *   stability: 情绪稳定性（0= 情绪化, 1= 稳定）
 *   attention: 注意力/警觉度（0= 涣散, 1= 高度专注）
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface IdentityVector {
  courage: number
  fear: number
  curiosity: number
  aggression: number
  stability: number
  attention: number
}

export const DEFAULT_IDENTITY: IdentityVector = {
  courage: 0.5,
  fear: 0.5,
  curiosity: 0.5,
  aggression: 0.5,
  stability: 0.5,
  attention: 0.5,
}

/** 身份变化事件 */
export interface IdentityShift {
  characterId: string
  sceneId: string
  trait: keyof IdentityVector
  before: number
  after: number
  magnitude: number   // |after - before|
}

// ─── IdentityVectorUtil ─────────────────────────────────

export class IdentityVectorUtil {
  /** 创建默认向量 */
  static create(): IdentityVector {
    return { ...DEFAULT_IDENTITY }
  }

  /** 克隆向量 */
  static clone(v: IdentityVector): IdentityVector {
    return { ...v }
  }

  /** 应用增量变化（约束到 [0, 1]） */
  static applyDelta(v: IdentityVector, trait: keyof IdentityVector, delta: number): IdentityVector {
    const updated = { ...v }
    updated[trait] = Math.max(0, Math.min(1, v[trait] + delta))
    return updated
  }

  /** 计算两个向量的差异（用于检测身份漂移） */
  static diff(a: IdentityVector, b: IdentityVector): { trait: keyof IdentityVector; delta: number }[] {
    const result: { trait: keyof IdentityVector; delta: number }[] = []
    for (const key of Object.keys(a) as (keyof IdentityVector)[]) {
      const delta = Math.abs(a[key] - b[key])
      if (delta > 0.05) result.push({ trait: key, delta })
    }
    return result
  }

  /** 计算身份熵（不确定性/复杂度的度量） */
  static entropy(v: IdentityVector): number {
    const vals = Object.values(v)
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length
    // 偏离均匀分布的度量
    return vals.reduce((s, x) => s + (x - avg) ** 2, 0) / vals.length
  }

  /** 快照 */
  static snapshot(v: IdentityVector): Record<string, number> {
    return { ...v }
  }
}

export default IdentityVectorUtil
