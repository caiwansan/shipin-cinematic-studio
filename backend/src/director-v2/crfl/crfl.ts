/**
 * crfl.ts — Cinematic Reality Feedback Loop v1
 *
 * 让系统被真实世界持续纠偏：
 *   render → human preference capture → normalize → DPM online update → CET calibration → next render
 *
 * 设计原则：
 *   - feedback → normalize → DPM → CET（不 bypass，不 raw train）
 *   - implicit + explicit 信号双重捕获
 *   - 噪声过滤 + session-level 聚合
 */

// ============================================================
// Types
// ============================================================

export interface HumanFeedback {
  sessionId: string
  videoId: string
  /** 隐式信号 */
  watchTimeMs?: number          // 观看时长（ms）
  playbackRate?: number         // 播放速度
  replayCount?: number          // 重播次数
  dropOffFrame?: number         // 弃看帧位置
  /** 显式信号 */
  preference?: 'like' | 'dislike' | 'neutral'
  pairwiseRanking?: 'A' | 'B'   // A/B 对比选择
  explicitScore?: number        // 1-5 分
  /** 上下文 */
  context?: {
    genre?: string
    mood?: string
    sceneType?: string
    deviceType?: string
  }
  timestamp: number
}

export interface NormalizedFeedback {
  /** 综合权重 (0-1) */
  weight: number
  /** 偏好方向：正 = 好/比 A 好，负 = 差/比 B 好 */
  direction: number
  sessionId: string
  videoId: string
  context: HumanFeedback['context']
  /** 信号可靠性 (0-1) */
  reliability: number
  source: 'implicit' | 'explicit' | 'mixed'
  timestamp: number
}

export interface FeedbackBatchSummary {
  totalSignals: number
  averageWeight: number
  netDirection: number         // > 0 = 整体正面反馈
  reliabilityWeighted: number  // 加权可靠性
  perContext: Record<string, { count: number; avgWeight: number; netDirection: number }>
}

export interface CRFLUpdate {
  dpmAdjustment: {
    weightShift: number        // 权重偏移向量（motion, camera, emotion, composition, temporal）
    confidenceDelta: number     // 置信度变化
  }
  cetCalibration: {
    motionBiasShift: number
    cameraBiasShift: number
    temporalBiasShift: number
  }
  appliedAt: number
  feedbackCount: number
}

// ============================================================
// Feedback Collector — 原始反馈收集和缓冲
// ============================================================

export class FeedbackCollector {
  private buffer: HumanFeedback[] = []
  private maxBuffer: number

  constructor(maxBuffer: number = 10000) {
    this.maxBuffer = maxBuffer
  }

  collect(feedback: HumanFeedback): void {
    this.buffer.push(feedback)
    if (this.buffer.length > this.maxBuffer) {
      this.buffer = this.buffer.slice(-this.maxBuffer)
    }
  }

  /** 清空并获取缓冲区 */
  flush(): HumanFeedback[] {
    const data = [...this.buffer]
    this.buffer = []
    return data
  }

  /** 按 session 聚合原始反馈 */
  getBySession(sessionId: string): HumanFeedback[] {
    return this.buffer.filter(f => f.sessionId === sessionId)
  }

  size(): number {
    return this.buffer.length
  }
}

// ============================================================
// Feedback Normalizer — 噪声过滤 + 信号归一化
// ============================================================

export class FeedbackNormalizer {
  /**
   * 将原始 HumanFeedback 归一化为 NormalizedFeedback
   *
   * 权重计算：
   *   implicit: watchTime * 0.4 + replayCount * 0.3 + dropOff (reversed) * 0.3
   *   explicit: 直接使用 explicitScore / 5
   *   pairwise: 1 (winner) or -1 (loser)
   */
  normalize(raw: HumanFeedback): NormalizedFeedback {
    const hasExplicit = raw.explicitScore !== undefined || raw.preference !== undefined || raw.pairwiseRanking !== undefined
    const hasImplicit = raw.watchTimeMs !== undefined || raw.replayCount !== undefined || raw.dropOffFrame !== undefined

    let weight: number
    let direction: number
    let source: 'implicit' | 'explicit' | 'mixed'

    if (hasExplicit && hasImplicit) {
      source = 'mixed'
      const expW = this.explicitWeight(raw)
      const impW = this.implicitWeight(raw)
      direction = expW > 0 ? 1 : -1
      weight = (Math.abs(expW) * 0.6 + Math.abs(impW) * 0.4)
    } else if (hasExplicit) {
      source = 'explicit'
      direction = this.explicitWeight(raw)
      weight = Math.abs(direction)
    } else if (hasImplicit) {
      source = 'implicit'
      direction = this.implicitWeight(raw)
      weight = Math.abs(direction)
    } else {
      source = 'implicit'
      direction = 0
      weight = 0
    }

    // reliability: 信号质量评估
    const reliability = this.computeReliability(raw, source)

    return {
      weight: clamp(weight, 0, 1),
      direction: clamp(direction, -1, 1),
      sessionId: raw.sessionId,
      videoId: raw.videoId,
      context: raw.context,
      reliability,
      source,
      timestamp: raw.timestamp,
    }
  }

  /** 批量归一化 + 噪声过滤 */
  normalizeBatch(rawFeedbacks: HumanFeedback[], minReliability: number = 0.1): NormalizedFeedback[] {
    return rawFeedbacks
      .map(f => this.normalize(f))
      .filter(n => n.reliability >= minReliability)
  }

  private explicitWeight(fb: HumanFeedback): number {
    let w = 0
    if (fb.explicitScore !== undefined) {
      w += (fb.explicitScore - 3) / 2  // 1-5 → -1 到 1
    }
    if (fb.preference === 'like') w += 1
    if (fb.preference === 'dislike') w -= 1
    if (fb.pairwiseRanking === 'A') w += 1
    if (fb.pairwiseRanking === 'B') w -= 1
    return clamp(w, -1, 1)
  }

  private implicitWeight(fb: HumanFeedback): number {
    let w = 0
    // watch time: 假定 30s = baseline
    if (fb.watchTimeMs !== undefined) {
      const watchMinutes = fb.watchTimeMs / 60000
      w += (Math.min(watchMinutes, 3) / 3) * 0.4  // max 3 min = full score
    }
    // replay count
    if (fb.replayCount !== undefined) {
      w += Math.min(fb.replayCount, 5) / 5 * 0.3
    }
    // drop off (reversed: later drop = better)
    if (fb.dropOffFrame !== undefined) {
      w += (1 - clamp(fb.dropOffFrame / 300, 0, 1)) * 0.3
    }
    return clamp(w, 0, 1)
  }

  private computeReliability(fb: HumanFeedback, source: string): number {
    let r = 0.3 // base
    if (source === 'explicit') r += 0.4
    if (fb.explicitScore !== undefined) r += 0.2
    if (fb.preference !== undefined) r += 0.3
    if (fb.pairwiseRanking !== undefined) r += 0.3
    if (fb.replayCount !== undefined && fb.replayCount >= 2) r += 0.2
    if (fb.watchTimeMs !== undefined && fb.watchTimeMs > 10000) r += 0.1
    return clamp(r, 0, 1)
  }
}

// ============================================================
// Session Aggregator — session 级聚合（去偏 + 降噪）
// ============================================================

export class SessionAggregator {
  /**
   * 按 session 聚合反馈，减少单用户噪声
   * 同一 session 内：取中位数方向，平均权重
   */
  aggregate(normalized: NormalizedFeedback[]): FeedbackBatchSummary {
    if (normalized.length === 0) {
      return { totalSignals: 0, averageWeight: 0, netDirection: 0, reliabilityWeighted: 0, perContext: {} }
    }

    // 按 session 聚合
    const sessionMap = new Map<string, { directions: number[]; weights: number[]; reliabilities: number[] }>()
    const contextMap = new Map<string, { count: number; totalWeight: number; netDir: number }>()

    for (const n of normalized) {
      if (!sessionMap.has(n.sessionId)) {
        sessionMap.set(n.sessionId, { directions: [], weights: [], reliabilities: [] })
      }
      const s = sessionMap.get(n.sessionId)!
      s.directions.push(n.direction)
      s.weights.push(n.weight)
      s.reliabilities.push(n.reliability)

      // context 统计
      const ctxKey = JSON.stringify(n.context || {})
      if (!contextMap.has(ctxKey)) {
        contextMap.set(ctxKey, { count: 0, totalWeight: 0, netDir: 0 })
      }
      const c = contextMap.get(ctxKey)!
      c.count++
      c.totalWeight += n.weight
      c.netDir += n.direction
    }

    // session-level aggregation: 对每个 session 取 direction 中位数
    let totalWeightedDir = 0
    let totalWeight = 0
    let reliabilitySum = 0

    for (const [, s] of sessionMap) {
      const medianDir = median(s.directions)
      const avgWeight = s.weights.reduce((a, b) => a + b, 0) / s.weights.length
      const avgReliability = s.reliabilities.reduce((a, b) => a + b, 0) / s.reliabilities.length

      totalWeightedDir += medianDir * avgWeight * avgReliability
      totalWeight += avgWeight * avgReliability
      reliabilitySum += avgReliability
    }

    const perContext: Record<string, { count: number; avgWeight: number; netDirection: number }> = {}
    for (const [key, val] of contextMap) {
      perContext[key] = {
        count: val.count,
        avgWeight: val.totalWeight / val.count,
        netDirection: val.netDir,
      }
    }

    return {
      totalSignals: normalized.length,
      averageWeight: totalWeight / (reliabilitySum || 1),
      netDirection: totalWeightedDir / (totalWeight || 1),
      reliabilityWeighted: reliabilitySum / sessionMap.size,
      perContext,
    }
  }
}

// ============================================================
// CRFL Controller — 闭环控制器
// ============================================================

export class CRFLController {
  collector = new FeedbackCollector()
  normalizer = new FeedbackNormalizer()
  aggregator = new SessionAggregator()
  private minBatchSize: number

  constructor(minBatchSize: number = 5) {
    this.minBatchSize = minBatchSize
  }

  /**
   * 接收一次人类反馈
   */
  receiveFeedback(feedback: HumanFeedback): void {
    this.collector.collect(feedback)
  }

  /**
   * 运行一轮完整的闭环更新
   * 从 buffer 中 flush 出批量反馈 → normalize → aggregate → compute update
   */
  runCycle(): CRFLUpdate | null {
    const rawBatch = this.collector.flush()
    if (rawBatch.length < this.minBatchSize) {
      // 不够一批次，退回重新收集
      rawBatch.forEach(f => this.collector.collect(f))
      return null
    }

    const normalized = this.normalizer.normalizeBatch(rawBatch, 0.15)
    const summary = this.aggregator.aggregate(normalized)

    // 计算 DPM 调整量
    const weightShift = summary.netDirection * summary.averageWeight * 0.1
    const confidenceDelta = Math.min(0.05, summary.reliabilityWeighted * 0.02 * summary.totalSignals / 10)

    const dpmAdjustment = {
      weightShift: clamp(weightShift, -0.3, 0.3),
      confidenceDelta: clamp(confidenceDelta, 0, 0.2),
    }

    // 计算 CET 校准量（DPM → CET 级联）
    const motionShift = dpmAdjustment.weightShift * 0.3
    const cameraShift = dpmAdjustment.weightShift * 0.4
    const temporalShift = dpmAdjustment.weightShift * 0.3

    const update: CRFLUpdate = {
      dpmAdjustment,
      cetCalibration: {
        motionBiasShift: clamp(motionShift, -0.1, 0.1),
        cameraBiasShift: clamp(cameraShift, -0.1, 0.1),
        temporalBiasShift: clamp(temporalShift, -0.1, 0.1),
      },
      appliedAt: Date.now(),
      feedbackCount: rawBatch.length,
    }

    return update
  }
}

// ============================================================
// Utils
// ============================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export { clamp }
