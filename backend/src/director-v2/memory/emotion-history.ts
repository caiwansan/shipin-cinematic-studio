/**
 * memory/emotion-history.ts — Phase 7 情绪历史引擎
 *
 * 跟踪每个角色/场景的 emotion(t) 随时间演变曲线
 * 提供：连续性保证、漂移检测输入、自适应 pacing 反馈
 *
 * 宪法：
 *   - 不依赖 LLM
 *   - 结构化数值数据（非文本）
 *   - 可被 Adaptive Kernel 消费
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface EmotionPoint {
  tick: number
  sceneId: string
  valence: number
  arousal: number
  intensity: number
}

export interface EmotionTrend {
  direction: 'rising' | 'falling' | 'stable'
  slope: number
  volatility: number
}

// ─── EmotionHistory ─────────────────────────────────────

export class EmotionHistory {
  /** 每角色的情绪时间线 */
  private characterTimelines = new Map<string, EmotionPoint[]>()
  /** 全局情绪时间线 */
  private globalTimeline: EmotionPoint[] = []

  /** 记录情绪点 */
  record(characterId: string | null, point: EmotionPoint): void {
    if (characterId) {
      let tl = this.characterTimelines.get(characterId)
      if (!tl) {
        tl = []
        this.characterTimelines.set(characterId, tl)
      }
      tl.push(point)
    }
    this.globalTimeline.push(point)
  }

  /** 获取角色的最近 N 个情绪点 */
  getRecent(characterId: string, count: number = 5): EmotionPoint[] {
    const tl = this.characterTimelines.get(characterId)
    if (!tl) return []
    return tl.slice(-count)
  }

  /** 计算角色情绪趋势 */
  getTrend(characterId: string): EmotionTrend | null {
    const tl = this.characterTimelines.get(characterId)
    if (!tl || tl.length < 3) return null

    const recent = tl.slice(-5)
    const n = recent.length
    // 线性回归：tick 到 valence
    const sumX = recent.reduce((s, p) => s + p.tick, 0)
    const sumY = recent.reduce((s, p) => s + p.valence, 0)
    const sumXY = recent.reduce((s, p) => s + p.tick * p.valence, 0)
    const sumX2 = recent.reduce((s, p) => s + p.tick * p.tick, 0)
    const slope = n * sumXY - sumX * sumY !== 0
      ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
      : 0

    // volatility = 标准差
    const avg = sumY / n
    const variance = recent.reduce((s, p) => s + (p.valence - avg) ** 2, 0) / n
    const volatility = Math.sqrt(variance)

    return {
      direction: slope > 0.02 ? 'rising' : slope < -0.02 ? 'falling' : 'stable',
      slope,
      volatility,
    }
  }

  /** 获取全局最近的全局情绪 */
  getGlobalRecent(count: number = 5): EmotionPoint[] {
    return this.globalTimeline.slice(-count)
  }

  /** 全局情绪趋势 */
  getGlobalTrend(): EmotionTrend | null {
    if (this.globalTimeline.length < 3) return null
    return this.getTrend('__global__') // 用虚拟 key 复用计算逻辑
  }

  /** 导出快照 */
  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [id, tl] of this.characterTimelines) {
      out[id] = { points: tl.length, last: tl[tl.length - 1] }
    }
    return { characters: out, globalPoints: this.globalTimeline.length }
  }

  clear(): void {
    this.characterTimelines.clear()
    this.globalTimeline = []
  }
}

export default EmotionHistory
