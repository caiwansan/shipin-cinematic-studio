/**
 * identity/identity-drift-engine.ts — Phase 8 身份漂移引擎
 *
 * 从 Memory 数据（情绪历史 + 场景结果）推导角色身份向量的演化。
 * 纯 deterministic，不依赖 LLM。
 *
 * 映射规则：
 *   - 持续的积极 valence → courage ↑, fear ↓, stability ↑
 *   - 持续的消极 valence → fear ↑, courage ↓, stability ↓
 *   - 高 arousal → aggression ↑, attention ↑
 *   - 低 arousal → curiosity ↑（探索倾向）
 *   - 高 volatility → stability ↓
 *   - 重复相同场景类型 → curiosity ↓, attention ↓
 */

import type { EmotionHistory } from '../memory/emotion-history.js'
import type { SceneMemoryStore } from '../memory/scene-memory-store.js'
import type { IdentityVector } from './identity-vector.js'
import { DEFAULT_IDENTITY, IdentityVectorUtil } from './identity-vector.js'

// ─── 类型 ─────────────────────────────────────────────────

export interface IdentityDriftConfig {
  /** 每次场景的情感影响权重 */
  emotionalInfluenceWeight: number
  /** 场景重复惩罚 */
  repetitionPenalty: number
  /** 稳定性恢复系数 */
  stabilityRecovery: number
}

const DEFAULT_CONFIG: IdentityDriftConfig = {
  emotionalInfluenceWeight: 0.15,
  repetitionPenalty: 0.08,
  stabilityRecovery: 0.05,
}

// ─── IdentityDriftEngine ──────────────────────────────

export class IdentityDriftEngine {
  private config: IdentityDriftConfig
  /** characterId → IdentityVector */
  private identities = new Map<string, IdentityVector>()

  constructor(config?: Partial<IdentityDriftConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 获取或初始化角色身份 */
  ensureIdentity(characterId: string): IdentityVector {
    let v = this.identities.get(characterId)
    if (!v) {
      v = IdentityVectorUtil.create()
      this.identities.set(characterId, v)
    }
    return v
  }

  /** 从记忆数据更新角色身份 */
  updateFromMemory(characterId: string, emotionHistory: EmotionHistory, sceneMemory: SceneMemoryStore): void {
    const current = this.ensureIdentity(characterId)
    const trend = emotionHistory.getTrend(characterId)
    const recent = emotionHistory.getRecent(characterId, 5)

    if (!trend || recent.length < 2) return

    let { courage, fear, curiosity, aggression, stability, attention } = current
    const w = this.config.emotionalInfluenceWeight

    // 1. 情绪趋势驱动
    if (trend.direction === 'rising') {
      courage = Math.min(1, courage + w)
      fear = Math.max(0, fear - w * 0.7)
      stability = Math.min(1, stability + w * 0.5)
    } else if (trend.direction === 'falling') {
      fear = Math.min(1, fear + w)
      courage = Math.max(0, courage - w * 0.7)
      stability = Math.max(0, stability - w * 0.5)
    }

    // 2. Arousal 驱动
    const avgArousal = recent.reduce((s, p) => s + p.arousal, 0) / recent.length
    if (avgArousal > 0.7) {
      aggression = Math.min(1, aggression + w * 0.6)
      attention = Math.min(1, attention + w * 0.4)
    } else if (avgArousal < 0.3) {
      curiosity = Math.min(1, curiosity + w * 0.5)
      attention = Math.max(0, attention - w * 0.3)
    }

    // 3. Volatility 驱动
    if (trend.volatility > 0.3) {
      stability = Math.max(0, stability - w * 0.8)
    } else if (trend.volatility < 0.1) {
      stability = Math.min(1, stability + this.config.stabilityRecovery)
    }

    // 4. 场景重复检测（curiosity 衰减）
    const completedScenes = sceneMemory.getCompletedScenes()
    const sceneTypes = completedScenes.map(s => s.sceneType)
    const typeCounts = new Map<string, number>()
    for (const t of sceneTypes) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    for (const [, count] of typeCounts) {
      if (count > 1) {
        curiosity = Math.max(0.1, curiosity - this.config.repetitionPenalty * (count - 1))
      }
    }

    const updated: IdentityVector = {
      courage: clamp(courage),
      fear: clamp(fear),
      curiosity: clamp(curiosity),
      aggression: clamp(aggression),
      stability: clamp(stability),
      attention: clamp(attention),
    }

    this.identities.set(characterId, updated)
  }

  /** 获取当前身份向量 */
  getIdentity(characterId: string): IdentityVector {
    return this.identities.get(characterId) ?? DEFAULT_IDENTITY
  }

  /** 获取所有身份 */
  getAllIdentities(): Map<string, IdentityVector> {
    return new Map(this.identities)
  }

  /** 快照 */
  snapshot(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {}
    for (const [id, v] of this.identities) {
      out[id] = IdentityVectorUtil.snapshot(v)
    }
    return out
  }

  clear(): void {
    this.identities.clear()
  }
}

// ─── 辅助 ──────────────────────────────────────────────

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export default IdentityDriftEngine
