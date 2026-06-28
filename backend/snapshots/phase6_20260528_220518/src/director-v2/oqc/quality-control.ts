/**
 * quality-control.ts — Phase OQC: Output Quality Control Loop
 *
 * 核心：把一次生成变成闭环优化。
 *   prompt → render → score → refine → rerender
 *
 * 5 维质量评估：
 *   motionNaturalness   — 动作是否物理真实
 *   temporalSmoothness  — 帧间是否平滑
 *   cameraIntentionality — 镜头是否有导演意图
 *   compositionClarity  — 构图是否清晰
 *   filmicPlausibility  — 整体是否像电影画面
 */

// ============================================================
// Quality Schema
// ============================================================

export interface QualityMetrics {
  motionNaturalness: number
  temporalSmoothness: number
  cameraIntentionality: number
  compositionClarity: number
  filmicPlausibility: number
}

export type QualityVerdict = 'cinematic_grade' | 'acceptable' | 'needs_refinement' | 'reject'
export type OptimizationTarget = keyof QualityMetrics

export function computeCinematicScore(m: QualityMetrics): number {
  return (
    m.motionNaturalness * 0.25 +
    m.temporalSmoothness * 0.25 +
    m.cameraIntentionality * 0.20 +
    m.compositionClarity * 0.15 +
    m.filmicPlausibility * 0.15
  )
}

export function getVerdict(score: number): QualityVerdict {
  if (score >= 0.8) return 'cinematic_grade'
  if (score >= 0.6) return 'acceptable'
  if (score >= 0.35) return 'needs_refinement'
  return 'reject'
}

// ============================================================
// Quality Evaluator — 评估视频质量
// ============================================================

export class QualityEvaluator {
  /**
   * 评估渲染输出
   */
  evaluate(output: RenderOutput): EvaluationResult {
    // 在实际系统中，这里会对接真实视频分析模型
    // 当前实现基于 CET 层提供的 signals + 启发式规则
    const breakdown = this.scoreBreakdown(output)
    const score = computeCinematicScore(breakdown)
    const verdict = getVerdict(score)

    return { score, breakdown, verdict, lowScoringDimensions: this.findLowDimensions(breakdown) }
  }

  private scoreBreakdown(output: RenderOutput): QualityMetrics {
    // 基于输出特征估算各维度分数
    const motion = this.estimateMotionNaturalness(output)
    const temporal = this.estimateTemporalSmoothness(output)
    const camera = this.estimateCameraIntentionality(output)
    const composition = this.estimateCompositionClarity(output)
    const filmic = this.estimateFilmicPlausibility(output)
    return { motionNaturalness: motion, temporalSmoothness: temporal, cameraIntentionality: camera, compositionClarity: composition, filmicPlausibility: filmic }
  }

  private estimateMotionNaturalness(output: RenderOutput): number {
    // 基于 physicalHints 密度估算运动自然度
    const hints = output.physicalHints || []
    const hintScore = Math.min(1, hints.length * 0.15)
    return clamp(0.3 + hintScore, 0, 1)
  }

  private estimateTemporalSmoothness(output: RenderOutput): number {
    // 基于 overlapHints 和 continuity 数量
    const overlaps = output.overlapHints || []
    const continuity = output.continuityAnchors || []
    const score = 0.3 + overlaps.length * 0.1 + continuity.length * 0.05
    return clamp(score, 0, 1)
  }

  private estimateCameraIntentionality(output: RenderOutput): number {
    // 基于 cameraDirectives 的情感映射质量
    const directives = output.cameraDirectives || []
    if (directives.length === 0) return 0.3
    const weighted = directives.reduce((sum, d) => sum + (d.cinematicWeight || 0.5), 0)
    return clamp(weighted / directives.length, 0, 1)
  }

  private estimateCompositionClarity(output: RenderOutput): number {
    const anchors = output.continuityAnchors || []
    const constraints = output.crossFrameConstraints || []
    return clamp(0.3 + anchors.length * 0.08 + constraints.length * 0.04, 0, 1)
  }

  private estimateFilmicPlausibility(output: RenderOutput): number {
    // 基于照片级 realism markers 数量
    const markers = output.realismMarkers || []
    const modelName = (output as any).modelName || ''
    // 已知高质量模型 bias
    const modelBias = modelName === 'sora' ? 0.15 : modelName === 'runway' ? 0.1 : 0
    return clamp(0.25 + markers.length * 0.1 + modelBias, 0, 1)
  }

  private findLowDimensions(m: QualityMetrics): OptimizationTarget[] {
    const threshold = 0.6
    return (Object.entries(m) as [OptimizationTarget, number][])
      .filter(([, v]) => v < threshold)
      .map(([k]) => k)
  }
}

export interface RenderOutput {
  physicalHints?: string[]
  overlapHints?: string[]
  continuityAnchors?: string[]
  cameraDirectives?: Array<{ cinematicWeight: number }>
  crossFrameConstraints?: string[]
  realismMarkers?: string[]
  modelName?: string
  /** 原始提示文本 */
  rawPrompt?: string
}

export interface EvaluationResult {
  score: number
  breakdown: QualityMetrics
  verdict: QualityVerdict
  lowScoringDimensions: OptimizationTarget[]
}

// ============================================================
// Prompt Refinement — 自动优化
// ============================================================

export interface OptimizationHints {
  motion_boost: boolean
  temporal_smoothing: boolean
  camera_rewrite: boolean
  composition_bias: boolean
  filmic_boost: boolean
  /** 每个维度的优化描述 */
  descriptions: string[]
}

export class PromptRefiner {
  /**
   * 根据评估反馈生成优化提示
   */
  refine(prompt: string, evaluation: EvaluationResult): OptimizationHints {
    const hints: OptimizationHints = {
      motion_boost: false,
      temporal_smoothing: false,
      camera_rewrite: false,
      composition_bias: false,
      filmic_boost: false,
      descriptions: [],
    }

    for (const dim of evaluation.lowScoringDimensions) {
      switch (dim) {
        case 'motionNaturalness':
          hints.motion_boost = true
          hints.descriptions.push('[MOTION_BOOST] add inertia continuation, secondary motion lag, weight shift anticipation')
          break
        case 'temporalSmoothness':
          hints.temporal_smoothing = true
          hints.descriptions.push('[TEMPORAL_SMOOTH] enforce ease-in-out camera, frame overlap blending at shot boundaries')
          break
        case 'cameraIntentionality':
          hints.camera_rewrite = true
          hints.descriptions.push('[CAMERA_INTENT] translate technical camera to emotional meaning: push-in=intimacy, pull-out=distancing')
          break
        case 'compositionClarity':
          hints.composition_bias = true
          hints.descriptions.push('[COMPOSITION] enforce rule-of-thirds, clear foreground/subject separation, depth layers')
          break
        case 'filmicPlausibility':
          hints.filmic_boost = true
          hints.descriptions.push('[FILMIC] add film grain, 24fps cadence, anamorphic lens simulation, volumetric lighting')
          break
      }
    }

    return hints
  }

  /**
   * 生成优化后的 prompt 文本
   */
  applyRefinement(prompt: string, hints: OptimizationHints): string {
    const sections = prompt.split('\n')
    // 移除已有的 optimization 标记（如果前一轮有）
    const clean = sections.filter(s => !s.startsWith('[MOTION_BOOST]') && !s.startsWith('[TEMPORAL_SMOOTH]') && !s.startsWith('[CAMERA_INTENT]') && !s.startsWith('[COMPOSITION]') && !s.startsWith('[FILMIC]'))

    const insertIndex = clean.length
    for (const desc of hints.descriptions) {
      clean.splice(insertIndex, 0, desc)
    }

    return clean.join('\n')
  }
}

// ============================================================
// Closed-Loop Controller
// ============================================================

export interface LoopConfig {
  maxIterations: number
  acceptThreshold: number
  stopOnDegrade: boolean
}

export const DEFAULT_LOOP_CONFIG: LoopConfig = {
  maxIterations: 3,
  acceptThreshold: 0.6,
  stopOnDegrade: true,
}

export interface LoopResult {
  status: 'optimal' | 'accepted' | 'converged_suboptimal' | 'degraded'
  score: number
  iterations: number
  finalPrompt: string
  hints: OptimizationHints
}

export class QualityControlLoop {
  private evaluator = new QualityEvaluator()
  private refiner = new PromptRefiner()

  /**
   * 运行完整质量优化循环
   *
   * @param prompt 初始提示
   * @param renderFn 渲染函数 (prompt: string) => RenderOutput
   * @param config 循环配置
   */
  async run(
    prompt: string,
    renderFn: (prompt: string) => Promise<RenderOutput>,
    config: LoopConfig = DEFAULT_LOOP_CONFIG,
  ): Promise<LoopResult> {
    let currentPrompt = prompt
    let lastScore = 0

    for (let i = 0; i < config.maxIterations; i++) {
      const output = await renderFn(currentPrompt)
      const evaluation = this.evaluator.evaluate(output)

      // 最优 → 直接返回
      if (evaluation.verdict === 'cinematic_grade') {
        return {
          status: 'optimal',
          score: evaluation.score,
          iterations: i + 1,
          finalPrompt: currentPrompt,
          hints: { motion_boost: false, temporal_smoothing: false, camera_rewrite: false, composition_bias: false, filmic_boost: false, descriptions: [] },
        }
      }

      // 可接受 → 返回但不继续优化
      if (evaluation.score >= config.acceptThreshold && evaluation.verdict === 'acceptable') {
        return {
          status: 'accepted',
          score: evaluation.score,
          iterations: i + 1,
          finalPrompt: currentPrompt,
          hints: { motion_boost: false, temporal_smoothing: false, camera_rewrite: false, composition_bias: false, filmic_boost: false, descriptions: [] },
        }
      }

      // 检查退化
      if (config.stopOnDegrade && i > 0 && evaluation.score < lastScore) {
        return {
          status: 'degraded',
          score: lastScore,
          iterations: i + 1,
          finalPrompt: currentPrompt,
          hints: { motion_boost: false, temporal_smoothing: false, camera_rewrite: false, composition_bias: false, filmic_boost: false, descriptions: [] },
        }
      }

      lastScore = evaluation.score

      // 计算优化方向
      const hints = this.refiner.refine(currentPrompt, evaluation)
      if (hints.descriptions.length === 0) {
        return {
          status: 'converged_suboptimal',
          score: evaluation.score,
          iterations: i + 1,
          finalPrompt: currentPrompt,
          hints,
        }
      }

      currentPrompt = this.refiner.applyRefinement(currentPrompt, hints)
    }

    // 达到最大迭代次数
    const lastOutput = await renderFn(currentPrompt)
    const lastEval = this.evaluator.evaluate(lastOutput)
    return {
      status: 'converged_suboptimal',
      score: lastEval.score,
      iterations: config.maxIterations,
      finalPrompt: currentPrompt,
      hints: { motion_boost: false, temporal_smoothing: false, camera_rewrite: false, composition_bias: false, filmic_boost: false, descriptions: [] },
    }
  }
}

// ============================================================
// Model-Specific Quality Bias Map
// ============================================================

export interface ModelQualityBias {
  motionWeight: number
  cameraSensitivity: number
  temporalStability: number
  compositionWeight: number
  globalCoherence: number
}

export const MODEL_BIAS_MAP: Record<string, Partial<ModelQualityBias>> = {
  runway: {
    motionWeight: 1.3,
    cameraSensitivity: 1.1,
    temporalStability: 0.9,
  },
  pika: {
    compositionWeight: 1.2,
    temporalStability: 0.8,
    cameraSensitivity: 0.9,
  },
  sora: {
    globalCoherence: 1.4,
    motionWeight: 0.9,
    temporalStability: 1.3,
  },
}

// ============================================================
// Utils
// ============================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
