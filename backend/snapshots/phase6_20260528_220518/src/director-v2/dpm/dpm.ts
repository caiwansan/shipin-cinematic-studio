/**
 * dpm.ts — Director Preference Model v1
 *
 * 从 rule-based scoring 升级为 learned preference model。
 *
 * 核心架构：
 *   pairwise comparison → preference buffer → learning signal → learned scoring
 *
 * v1 实现方案：
 *   使用简单 memory-based 偏好聚合（不依赖真实 ML 框架）
 *   但数据结构已经对齐 DPM v2 的"可训练接口"
 */

// ============================================================
// Type Definitions
// ============================================================

export type RenderSide = 'A' | 'B'

export interface RenderSnapshot {
  /** 渲染输出特征向量 */
  features: {
    motion: number
    camera: number
    temporal: number
    composition: number
    filmic: number
  }
  /** 原始 prompt */
  prompt: string
  /** 模型名称 */
  modelName?: string
}

export interface PreferenceSample {
  id: string
  context: {
    genre?: string
    mood?: string
    intensity?: 'low' | 'medium' | 'high'
    sceneType?: string
  }
  renderA: RenderSnapshot
  renderB: RenderSnapshot
  winner: RenderSide
  margin: number
  timestamp: number
}

export interface PreferenceScore {
  score: number
  confidence: number
  source: 'learned' | 'fallback_heuristic'
  breakdown: {
    motion: number
    camera: number
    temporal: number
    composition: number
    filmic: number
  }
}

export interface LearnedWeightVector {
  motion: number
  camera: number
  temporal: number
  composition: number
  filmic: number
  /** 每个维度的置信度（样本量） */
  confidence: number
}

// ============================================================
// Preference Buffer — 偏好数据存储器
// ============================================================

export class PreferenceBuffer {
  private samples: PreferenceSample[] = []
  private maxSize: number

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
  }

  record(sample: PreferenceSample): void {
    this.samples.push(sample)
    if (this.samples.length > this.maxSize) {
      // 淘汰最旧的
      this.samples.shift()
    }
  }

  getAll(): PreferenceSample[] {
    return [...this.samples]
  }

  /** 按上下文筛选 */
  filter(context: Partial<PreferenceSample['context']>): PreferenceSample[] {
    return this.samples.filter(s => {
      if (context.genre && s.context.genre !== context.genre) return false
      if (context.mood && s.context.mood !== context.mood) return false
      if (context.intensity && s.context.intensity !== context.intensity) return false
      if (context.sceneType && s.context.sceneType !== context.sceneType) return false
      return true
    })
  }

  size(): number {
    return this.samples.length
  }

  clear(): void {
    this.samples = []
  }
}

// ============================================================
// Pairwise Comparator — 对两个候选输出做偏好比较
// ============================================================

export class PairwiseComparator {
  /**
   * 比较两个渲染输出，确定偏好
   *
   * v1 实现基于特征加权比较
   * v2 将接入 learned weight vector
   */
  compare(
    renderA: RenderSnapshot,
    renderB: RenderSnapshot,
    context: PreferenceSample['context'],
    weights?: LearnedWeightVector,
  ): { winner: RenderSide; margin: number; sample: Omit<PreferenceSample, 'id' | 'timestamp'> } {
    const scoreA = this.computeScore(renderA, weights)
    const scoreB = this.computeScore(renderB, weights)

    const totalA = scoreA.motion + scoreA.camera + scoreA.temporal + scoreA.composition + scoreA.filmic
    const totalB = scoreB.motion + scoreB.camera + scoreB.temporal + scoreB.composition + scoreB.filmic

    const winner: RenderSide = totalA >= totalB ? 'A' : 'B'
    const margin = Math.abs(totalA - totalB)

    return {
      winner,
      margin,
      sample: { context, renderA, renderB, winner, margin },
    }
  }

  private computeScore(r: RenderSnapshot, weights?: LearnedWeightVector): RenderSnapshot['features'] {
    const w = weights || DEFAULT_WEIGHTS
    return {
      motion: r.features.motion * w.motion,
      camera: r.features.camera * w.camera,
      temporal: r.features.temporal * w.temporal,
      composition: r.features.composition * w.composition,
      filmic: r.features.filmic * w.filmic,
    }
  }
}

// ============================================================
// Learning Signal Extractor — 从偏好数据提取学习信号
// ============================================================

export interface LearningSignal {
  /** winner render 的特征向量 */
  winnerFeatures: RenderSnapshot['features']
  /** loser render 的特征向量 */
  loserFeatures: RenderSnapshot['features']
  /** 各维度的偏好方向（1 = winner 胜出, -1 = loser 胜出） */
  directionHint: number[]
  margin: number
  context: PreferenceSample['context']
}

export class LearningSignalExtractor {
  extract(sample: PreferenceSample): LearningSignal {
    const { renderA, renderB, winner, margin } = sample

    const winnerFeatures = winner === 'A' ? renderA.features : renderB.features
    const loserFeatures = winner === 'A' ? renderB.features : renderA.features

    const directionHint = [
      Math.sign(winnerFeatures.motion - loserFeatures.motion),
      Math.sign(winnerFeatures.camera - loserFeatures.camera),
      Math.sign(winnerFeatures.temporal - loserFeatures.temporal),
      Math.sign(winnerFeatures.composition - loserFeatures.composition),
      Math.sign(winnerFeatures.filmic - loserFeatures.filmic),
    ]

    return { winnerFeatures, loserFeatures, directionHint, margin, context: sample.context }
  }

  /** 从一批样本提取聚合学习信号 */
  extractBatch(samples: PreferenceSample[]): LearningSignal[] {
    return samples.map(s => this.extract(s))
  }
}

// ============================================================
// Weight Learner — 从偏好数据学习权重向量
// ============================================================

export class WeightLearner {
  /**
   * 从偏好数据学习最优权重向量
   *
   * v1 算法：基于 pairwise 胜率统计的简单学习
   *   1. 对每个样本计算 winner 在每维上的相对优势
   *   2. 按优势方向调整对应维度的权重
   *   3. 归一化到总和 = 1
   *
   * v2 将使用 gradient descent 或 Elo-based learning
   */
  learn(
    signals: LearningSignal[],
    currentWeights?: LearnedWeightVector,
    learningRate: number = 0.05,
  ): LearnedWeightVector {
    if (signals.length === 0) {
      return currentWeights || DEFAULT_WEIGHTS
    }

    const w = { ...(currentWeights || DEFAULT_WEIGHTS) }
    const dims: (keyof LearnedWeightVector)[] = ['motion', 'camera', 'temporal', 'composition', 'filmic']

    // 对每个信号，根据偏好方向微调权重
    for (const signal of signals) {
      const weightAdjustments = signal.directionHint
      const adjustedMargin = Math.min(signal.margin, 1) // 限制调整幅度

      dims.forEach((dim, i) => {
        const adjustment = weightAdjustments[i] * learningRate * adjustedMargin
        w[dim] = Math.max(0.01, w[dim] + adjustment)
      })
    }

    // 归一化
    const total = dims.reduce((s, d) => s + w[d], 0)
    dims.forEach(d => { w[d] /= total })

    // 置信度递增
    w.confidence = Math.min(1, w.confidence + signals.length * 0.01)

    return w
  }
}

// ============================================================
// Director Preference Model — 统一入口
// ============================================================

export class DirectorPreferenceModel {
  buffer = new PreferenceBuffer()
  comparator = new PairwiseComparator()
  signalExtractor = new LearningSignalExtractor()
  weightLearner = new WeightLearner()
  private currentWeights: LearnedWeightVector

  constructor() {
    this.currentWeights = { ...DEFAULT_WEIGHTS }
  }

  /**
   * 比较、记录、学习的完整流程
   */
  ingestComparison(
    renderA: RenderSnapshot,
    renderB: RenderSnapshot,
    context: PreferenceSample['context'],
  ): PreferenceSample {
    const { winner, margin, sample } = this.comparator.compare(renderA, renderB, context, this.currentWeights)

    const fullSample: PreferenceSample = {
      ...sample,
      id: `pref_${this.buffer.size()}_${Date.now()}`,
      timestamp: Date.now(),
    }

    this.buffer.record(fullSample)

    // 自动学习：如果 buffer 有足够新样本，更新权重
    const recentSamples = this.buffer.getAll().slice(-20)
    if (recentSamples.length >= 5) {
      const signals = this.signalExtractor.extractBatch(recentSamples)
      this.currentWeights = this.weightLearner.learn(signals, this.currentWeights, 0.03)
    }

    return fullSample
  }

  /**
   * 计算 DPM 评分（替代 OQC 的硬编码评分）
   */
  score(render: RenderSnapshot): PreferenceScore {
    const breakdown = {
      motion: render.features.motion * this.currentWeights.motion,
      camera: render.features.camera * this.currentWeights.camera,
      temporal: render.features.temporal * this.currentWeights.temporal,
      composition: render.features.composition * this.currentWeights.composition,
      filmic: render.features.filmic * this.currentWeights.filmic,
    }

    const total = breakdown.motion + breakdown.camera + breakdown.temporal + breakdown.composition + breakdown.filmic

    // 归一化到 0-1
    const normalizedScore = Math.min(1, total / 5)

    return {
      score: normalizedScore,
      confidence: this.currentWeights.confidence,
      source: this.currentWeights.confidence > 0.3 ? 'learned' : 'fallback_heuristic',
      breakdown,
    }
  }

  /**
   * 获取当前学习的权重向量（可观察学习状态）
   */
  getWeights(): LearnedWeightVector {
    return { ...this.currentWeights }
  }

  /**
   * 重置学习状态
   */
  reset(): void {
    this.currentWeights = { ...DEFAULT_WEIGHTS }
    this.buffer.clear()
  }
}

// ============================================================
// Default / Initial Weights
// ============================================================

const DEFAULT_WEIGHTS: LearnedWeightVector = {
  motion: 0.25,
  camera: 0.25,
  temporal: 0.20,
  composition: 0.15,
  filmic: 0.15,
  confidence: 0,
}
