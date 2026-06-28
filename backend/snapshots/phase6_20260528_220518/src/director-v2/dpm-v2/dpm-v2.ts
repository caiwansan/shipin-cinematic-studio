/**
 * dpm-v2.ts — Director Preference Model v2: Human-Centric Cinematic Alignment
 *
 * v1 → v2 核心变化：
 *   v1: system-generated pairwise comparison → internal preference
 *   v2: real video dataset + human labels → human-grounded preference
 *
 * 架构：
 *   RealVideoDataset (film clips / user ratings)
 *     → CinematicFeatureEncoder (motion/camera/emotion/composition/temporal)
 *       → HumanAlignedComparator (calibrated by real human judgment)
 *         → DPMv2Score (replaces v1 scoring)
 */

// ============================================================
// Types
// ============================================================

export interface CinematicEmbedding {
  motion: number
  camera: number
  emotion: number
  composition: number
  temporal: number
}

export interface RealVideoSample {
  id: string
  videoA: string
  videoB: string
  embeddingA: CinematicEmbedding
  embeddingB: CinematicEmbedding
  context: {
    genre?: string
    mood?: string
    pacing?: string
    sceneType?: string
  }
  humanPreference: 'A' | 'B'
  /** 偏好强度 (0-1) */
  confidence: number
  source: 'expert_rating' | 'user_study' | 'derived'
}

export interface VideoMetadata {
  title?: string
  duration?: number
  source?: string
  tags?: string[]
  cinematographer?: string
}

// ============================================================
// Cinematic Feature Encoder — 从真实视频提取特征
// ============================================================

export class CinematicFeatureEncoder {
  /**
   * encode video metadata + heuristic analysis → CinematicEmbedding
   *
   * v2 实现：基于视频元数据和启发式规则的嵌入估算。
   * 生产版本将对接真实视频分析模型（动作检测、镜头识别、情绪分类等）。
   */
  encode(video: {
    motionScore?: number
    cameraScore?: number
    emotionScore?: number
    compScore?: number
    temporalScore?: number
    tags?: string[]
    genre?: string
    metadata?: VideoMetadata
  }): CinematicEmbedding {
    return {
      motion: this.estimateMotion(video),
      camera: this.estimateCamera(video),
      emotion: this.estimateEmotion(video),
      composition: this.estimateComposition(video),
      temporal: this.estimateTemporal(video),
    }
  }

  private estimateMotion(v: Record<string, unknown>): number {
    if (typeof v.motionScore === 'number') return clamp(v.motionScore, 0, 1)
    const tags = (v.tags || []) as string[]
    const boost = tags.includes('action') || tags.includes('fight') ? 0.2 : tags.includes('slow') ? -0.1 : 0
    return clamp(0.5 + boost, 0, 1)
  }

  private estimateCamera(v: Record<string, unknown>): number {
    if (typeof v.cameraScore === 'number') return clamp(v.cameraScore, 0, 1)
    const genre = (v.genre || '') as string
    const boost = genre === 'drama' || genre === 'thriller' ? 0.15 : genre === 'documentary' ? 0.25 : 0
    return clamp(0.5 + boost, 0, 1)
  }

  private estimateEmotion(v: Record<string, unknown>): number {
    if (typeof v.emotionScore === 'number') return clamp(v.emotionScore, 0, 1)
    return 0.5
  }

  private estimateComposition(v: Record<string, unknown>): number {
    if (typeof v.compScore === 'number') return clamp(v.compScore, 0, 1)
    return 0.5
  }

  private estimateTemporal(v: Record<string, unknown>): number {
    if (typeof v.temporalScore === 'number') return clamp(v.temporalScore, 0, 1)
    return 0.5
  }
}

// ============================================================
// Real Video Dataset — 存储和管理真实人类偏好
// ============================================================

export class RealVideoDataset {
  private samples: RealVideoSample[] = []
  private maxSize: number

  constructor(maxSize: number = 5000) {
    this.maxSize = maxSize
  }

  add(sample: RealVideoSample): void {
    this.samples.push(sample)
    if (this.samples.length > this.maxSize) {
      this.samples = this.samples.slice(-this.maxSize)
    }
  }

  getAll(): RealVideoSample[] {
    return [...this.samples]
  }

  /** 按上下文筛选 */
  filter(context: Partial<RealVideoSample['context']>): RealVideoSample[] {
    return this.samples.filter(s => {
      if (context.genre && s.context.genre !== context.genre) return false
      if (context.mood && s.context.mood !== context.mood) return false
      if (context.pacing && s.context.pacing !== context.pacing) return false
      return true
    })
  }

  /** 按来源筛选 */
  bySource(source: RealVideoSample['source']): RealVideoSample[] {
    return this.samples.filter(s => s.source === source)
  }

  size(): number {
    return this.samples.length
  }

  clear(): void {
    this.samples = []
  }

  /** 偏好分布统计 */
  getStats(): { totalSamples: number; byGenre: Record<string, number>; bySource: Record<string, number> } {
    const byGenre: Record<string, number> = {}
    const bySource: Record<string, number> = {}
    for (const s of this.samples) {
      const genre = s.context.genre || 'unknown'
      byGenre[genre] = (byGenre[genre] || 0) + 1
      bySource[s.source] = (bySource[s.source] || 0) + 1
    }
    return { totalSamples: this.samples.length, byGenre, bySource }
  }
}

// ============================================================
// Human-Aligned Comparator — 用真实人类偏好校准
// ============================================================

export class HumanAlignedComparator {
  private encoder = new CinematicFeatureEncoder()

  /**
   * 比较两个视频，预测人类偏好
   */
  compare(
    videoA: Parameters<CinematicFeatureEncoder['encode']>[0],
    videoB: Parameters<CinematicFeatureEncoder['encode']>[0],
    context: RealVideoSample['context'],
    weights?: CinematicEmbedding,
  ): { predictedWinner: 'A' | 'B'; scoreA: number; scoreB: number; margin: number } {
    const embA = this.encoder.encode(videoA)
    const embB = this.encoder.encode(videoB)
    const w = weights || DEFAULT_HUMAN_WEIGHTS

    const scoreA = embA.motion * w.motion + embA.camera * w.camera + embA.emotion * w.emotion + embA.composition * w.composition + embA.temporal * w.temporal
    const scoreB = embB.motion * w.motion + embB.camera * w.camera + embB.emotion * w.emotion + embB.composition * w.composition + embB.temporal * w.temporal

    // 上下文校准
    const calibratedA = this.applyContextBias(scoreA, context)
    const calibratedB = this.applyContextBias(scoreB, context)

    return {
      predictedWinner: calibratedA >= calibratedB ? 'A' : 'B',
      scoreA: calibratedA,
      scoreB: calibratedB,
      margin: Math.abs(calibratedA - calibratedB),
    }
  }

  /**
   * 评估预测与真实人类偏好的一致性
   */
  evaluateAlignment(dataset: RealVideoDataset): AlignmentReport {
    const samples = dataset.getAll()
    if (samples.length === 0) return { accuracy: 0, totalSamples: 0, correctPredictions: 0, perGenre: {} }

    let correct = 0
    const perGenre: Record<string, { total: number; correct: number }> = {}

    for (const sample of samples) {
      const prediction = this.compare(
      { motionScore: sample.embeddingA.motion, cameraScore: sample.embeddingA.camera, emotionScore: sample.embeddingA.emotion, compScore: sample.embeddingA.composition, temporalScore: sample.embeddingA.temporal },
      { motionScore: sample.embeddingB.motion, cameraScore: sample.embeddingB.camera, emotionScore: sample.embeddingB.emotion, compScore: sample.embeddingB.composition, temporalScore: sample.embeddingB.temporal },
      sample.context,
    )

      const isCorrect = prediction.predictedWinner === sample.humanPreference
      if (isCorrect) correct++

      const genre = sample.context.genre || 'unknown'
      if (!perGenre[genre]) perGenre[genre] = { total: 0, correct: 0 }
      perGenre[genre].total++
      if (isCorrect) perGenre[genre].correct++
    }

    const accuracy = correct / samples.length

    return {
      accuracy,
      totalSamples: samples.length,
      correctPredictions: correct,
      perGenre: Object.fromEntries(
        Object.entries(perGenre).map(([g, v]) => [g, { accuracy: v.correct / v.total, ...v }]),
      ),
    }
  }

  private applyContextBias(score: number, context: RealVideoSample['context']): number {
    let biased = score
    // 不同类型的人类偏好 bias
    if (context.genre === 'drama') biased *= 1.05 // drama 稍微看重情感构图
    if (context.genre === 'action') biased *= 1.02
    if (context.mood === 'suspense') biased *= 1.08 // suspense 更看重镜头语言
    if (context.pacing === 'slow') biased *= 1.03
    return biased
  }
}

export interface AlignmentReport {
  accuracy: number
  totalSamples: number
  correctPredictions: number
  perGenre: Record<string, { total: number; correct: number; accuracy: number }>
}

// ============================================================
// Calibration Engine — 从真实数据优化权重
// ============================================================

export class CalibrationEngine {
  /**
   * 从真实人类偏好数据校准权重向量
   *
   * 算法：对每个样本，按人类偏好方向调整权重
   *   - 如果人类选了 A，那么 A 的特征应该获得更高的权重
   *   - 每次调整后归一化到总和 = 1
   */
  calibrate(
    dataset: RealVideoDataset,
    currentWeights?: CinematicEmbedding,
    learningRate: number = 0.01,
  ): CinematicEmbedding {
    const samples = dataset.getAll()
    if (samples.length === 0) return currentWeights || { ...DEFAULT_HUMAN_WEIGHTS }

    const w = { ...(currentWeights || DEFAULT_HUMAN_WEIGHTS) }
    const dims: (keyof CinematicEmbedding)[] = ['motion', 'camera', 'emotion', 'composition', 'temporal']

    for (const sample of samples) {
      const winnerEmb = sample.humanPreference === 'A' ? sample.embeddingA : sample.embeddingB
      const loserEmb = sample.humanPreference === 'A' ? sample.embeddingB : sample.embeddingA

      for (const dim of dims) {
        const diff = winnerEmb[dim] - loserEmb[dim]
        const adjustment = diff * learningRate * sample.confidence
        w[dim] = Math.max(0.01, w[dim] + adjustment)
      }
    }

    // 归一化
    const total = dims.reduce((s, d) => s + w[d], 0)
    dims.forEach(d => { w[d] /= total })

    return w
  }
}

// ============================================================
// Director Preference Model v2 — 统一入口
// ============================================================

export class DirectorPreferenceModelV2 {
  dataset = new RealVideoDataset()
  comparator = new HumanAlignedComparator()
  calibration = new CalibrationEngine()
  private currentWeights: CinematicEmbedding

  constructor() {
    this.currentWeights = { ...DEFAULT_HUMAN_WEIGHTS }
  }

  /**
   * 注入真实人类偏好样本
   */
  ingestRealPreference(sample: Omit<RealVideoSample, 'id'>): RealVideoSample {
    const fullSample: RealVideoSample = {
      ...sample,
      id: `real_${this.dataset.size()}_${Date.now()}`,
    }
    this.dataset.add(fullSample)

    // 自动校准（有足够样本时）
    if (this.dataset.size() >= 10) {
      this.currentWeights = this.calibration.calibrate(this.dataset, this.currentWeights, 0.005)
    }

    return fullSample
  }

  /**
   * DPM v2 评分 — 替代 v1 的 scoring
   */
  score(
    video: Parameters<CinematicFeatureEncoder['encode']>[0],
    context?: RealVideoSample['context'],
  ): { score: number; source: string; alignmentConfidence: number } {
    const encoder = new CinematicFeatureEncoder()
    const emb = encoder.encode(video)
    const w = this.currentWeights

    const rawScore = emb.motion * w.motion + emb.camera * w.camera + emb.emotion * w.emotion + emb.composition * w.composition + emb.temporal * w.temporal
    const calibrated = context ? this.comparator['applyContextBias'](rawScore, context) : rawScore

    return {
      score: Math.min(1, calibrated / 5),
      source: this.dataset.size() >= 10 ? 'dpm_v2_human_aligned' : 'dpm_v2_bootstrap',
      alignmentConfidence: Math.min(1, this.dataset.size() / 100),
    }
  }

  /**
   * 评估当前模型与人类偏好的一致性
   */
  evaluateAlignment(): AlignmentReport {
    return this.comparator.evaluateAlignment(this.dataset)
  }

  /**
   * 获取当前权重
   */
  getWeights(): CinematicEmbedding {
    return { ...this.currentWeights }
  }

  /**
   * 重置
   */
  reset(): void {
    this.currentWeights = { ...DEFAULT_HUMAN_WEIGHTS }
    this.dataset.clear()
  }
}

// ============================================================
// Default weights (initial human bootstrap)
// ============================================================

const DEFAULT_HUMAN_WEIGHTS: CinematicEmbedding = {
  motion: 0.25,
  camera: 0.25,
  emotion: 0.20,
  composition: 0.15,
  temporal: 0.15,
}

// ============================================================
// Utils
// ============================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
