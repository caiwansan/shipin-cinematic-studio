/**
 * Emotional Arc Compiler
 * Cinematic Grammar System — 镜头语法系统
 *
 * 情绪曲线编译器：为镜头序列构建一条**情绪弧线**。
 *
 * 情绪弧线是导演语言的核心——好的镜头序列应该有：
 *   - 开场（establishing）：低情绪，给信息
 *   - 累积（build-up）：情绪缓慢上升
 *   - 高潮（peak）：情绪峰值
 *   - 释放（release）：情绪回落
 *
 * 输出：为每个镜头附加 emotionalWeight（0~1）和 emotionalTension（0~1）。
 */

import { ShotGrammarNode, ShotGrammarType } from './shot-grammar-tree'

export interface EmotionalArcPoint {
  /** 镜头索引 */
  index: number
  /** 语法类型 */
  type: ShotGrammarType
  /** 情绪权重（0~1，越高越重要） */
  emotionalWeight: number
  /** 情绪张力（0~1，越高越紧张） */
  emotionalTension: number
  /** 情绪标签 */
  mood: 'calm' | 'rising' | 'tensed' | 'explosive' | 'falling' | 'resolved'
}

export interface EmotionalArc {
  /** 情绪弧线数据点 */
  points: EmotionalArcPoint[]
  /** 弧线类型 */
  arcType: 'classic' | 'sustained_high' | 'roller_coaster' | 'flat'
  /** 最大张力值 */
  maxTension: number
  /** 情绪变化幅度 */
  volatility: number
}

export class EmotionalArcCompiler {
  /**
   * 为镜头序列生成情绪弧线
   */
  compile(node: ShotGrammarNode[]): EmotionalArc {
    const points: EmotionalArcPoint[] = []

    let maxTension = 0
    let totalTension = 0

    node.forEach((n, i) => {
      const baseTension = this.typeBaseTension(n.type)
      const intensityBoost = n.intensity * 0.3
      const positionFactor = this.positionFactor(i, node.length)

      let tension = baseTension + intensityBoost + positionFactor
      if (n.type === 'peak') tension += 0.2
      tension = Math.min(1, Math.max(0, tension))

      if (tension > maxTension) maxTension = tension
      totalTension += tension

      points.push({
        index: i,
        type: n.type,
        emotionalWeight: n.intensity,
        emotionalTension: tension,
        mood: this.tensionToMood(tension, n.type),
      })
    })

    // 计算弧线类型
    const arcType = this.classifyArc(points)
    const volatility = this.calculateVolatility(points)

    return { points, arcType, maxTension, volatility }
  }

  /**
   * 镜头语法类型的基础张力
   */
  private typeBaseTension(type: ShotGrammarType): number {
    const map: Record<ShotGrammarType, number> = {
      establishing: 0.15,
      insert: 0.20,
      build_up: 0.40,
      pov: 0.45,
      transition: 0.25,
      reaction: 0.50,
      peak: 0.80,
      release: 0.30,
    }
    return map[type] || 0.3
  }

  /**
   * 位置因子：同一个镜头在序列的不同位置，张力不同
   * 越接近中间越高（叙事弧线规律）
   */
  private positionFactor(index: number, total: number): number {
    if (total <= 1) return 0
    const normalizedPos = index / (total - 1) // 0~1
    // 抛物线：中间最高
    return 1 - Math.abs(normalizedPos - 0.5) * 2
  }

  /**
   * 张力值 → 情绪标签
   */
  private tensionToMood(tension: number, type: ShotGrammarType): EmotionalArcPoint['mood'] {
    if (type === 'establishing') return 'calm'
    if (type === 'peak') return 'explosive'
    if (type === 'release') return 'falling'
    if (tension >= 0.7) return 'tensed'
    if (tension >= 0.4) return 'rising'
    if (tension < 0.3) return 'resolved'
    return 'calm'
  }

  /**
   * 分类弧线类型
   */
  private classifyArc(points: EmotionalArcPoint[]): EmotionalArc['arcType'] {
    if (points.length < 3) return 'flat'

    const firstTension = points[0].emotionalTension
    const midTension = points[Math.floor(points.length / 2)].emotionalTension
    const lastTension = points[points.length - 1].emotionalTension

    // 经典弧线：低→高→低
    if (firstTension < midTension && lastTension < midTension) return 'classic'

    // 持续高张力
    const avgTension = points.reduce((s, p) => s + p.emotionalTension, 0) / points.length
    if (avgTension > 0.6) return 'sustained_high'

    // 过山车：多次高低起伏
    const tensionChanges = points.map(p => p.emotionalTension)
    const peaks = tensionChanges.filter(
      (t, i) => i > 0 && i < tensionChanges.length - 1 && t > tensionChanges[i - 1] && t > tensionChanges[i + 1],
    )
    if (peaks.length >= 2) return 'roller_coaster'

    return 'flat'
  }

  /**
   * 情绪波动幅度
   */
  private calculateVolatility(points: EmotionalArcPoint[]): number {
    if (points.length < 2) return 0
    let sumDiff = 0
    for (let i = 1; i < points.length; i++) {
      sumDiff += Math.abs(points[i].emotionalTension - points[i - 1].emotionalTension)
    }
    return sumDiff / (points.length - 1)
  }
}
