/**
 * runtime/feedback-loop/loop-controller.ts
 *
 * Loop Controller — 闭环进化引擎核心
 *
 * 流程：
 *   Input PromptSpec
 *   ↓
 *   Compile → Generate Video A
 *   ↓
 *   Critic Evaluation
 *   ↓
 *   Diff Analysis
 *   ↓
 *   Prompt Fix → Generate Video B (Shadow)
 *   ↓
 *   Score Compare → Keep Best Version
 *
 * 模式：
 *   - evaluation-only: 只评分不重生成（用于分析）
 *   - shadow-revision: 生成 B 版并对比（默认）
 *
 * 指标体系（Cinematic Evolution Metrics）：
 *   - Prompt Accuracy Delta (B.score - A.score)
 *   - Camera Stability Gain
 *   - VFX Realism Gain
 *   - Loop Improvement Rate (连续 N 次提升率)
 *
 * @runtime feedback-loop
 */

import { compileAndScore as compilePrompt, fromOptimizedShots, type VideoPromptSpec } from '../../production-loop/prompt-compiler.js'
import { evaluateVideo, type VideoCritique } from './video-critic.js'
import { analyzeGap, type PromptGap } from './prompt-diff.js'
import { autoFix, type AutoFixResult } from './auto-fixer.js'

// ============================================================
// Types
// ============================================================

export interface LoopConfig {
  /** 是否启用 shadow revision 模式（生成 B 版对比） */
  shadowRevision: boolean
  /** 最低达标分（低于此分启动修正） */
  passThreshold: number
  /** 最大循环轮次 */
  maxLoops: number
  /** 视频生成回调（实际调用队列生成视频） */
  videoGenerator?: (spec: VideoPromptSpec, compiledPrompt: string) => Promise<string>
}

export interface LoopResult {
  /** 最终采用的 spec */
  finalSpec: VideoPromptSpec
  /** 最终编译的 prompt */
  finalPrompt: string
  /** 最终评分 */
  finalScore: number
  /** 最终视频 URL（如有生成） */
  finalVideoUrl?: string

  /** 循环轮次 */
  loopCount: number

  /** 版本 A 结果（原始） */
  versionA: {
    prompt: string
    critique: VideoCritique
    gap: PromptGap
  }

  /** 版本 B 结果（修正后，仅在 shadow 模式下有） */
  versionB?: {
    prompt: string
    spec: VideoPromptSpec
    critique: VideoCritique
    autoFix: AutoFixResult
  }

  /** 进化指标 */
  metrics: CinematicEvolutionMetrics

  /** 修复历史 */
  fixHistory: string[]

  /** 是否达标 */
  passed: boolean
}

export interface CinematicEvolutionMetrics {
  /** 提示词准确度变化率 (B.score - A.score) / A.score */
  promptAccuracyDelta: number
  /** Camera 稳定性增益 */
  cameraStabilityGain: number
  /** VFX 真实感增益 */
  vfxRealismGain: number
  /** 场景连贯性增益 */
  sceneCoherenceGain: number
  /** 本次循环提升率 */
  loopImprovementRate: number
}

// ============================================================
// Default Config
// ============================================================

const DEFAULT_CONFIG: LoopConfig = {
  shadowRevision: true,
  passThreshold: 0.6,
  maxLoops: 2,
}

// ============================================================
// Main Loop Controller
// ============================================================

/**
 * 运行一次完整的反馈闭环
 *
 * @param spec 原始 VideoPromptSpec
 * @param config 循环配置
 * @param videoGenerator 视频生成回调（可选，不传则只做 eval-only）
 */
export async function runFeedbackLoop(
  spec: VideoPromptSpec,
  config?: Partial<LoopConfig>,
  videoGenerator?: (spec: VideoPromptSpec, compiledPrompt: string) => Promise<string>,
): Promise<LoopResult> {
  const cfg: LoopConfig = { ...DEFAULT_CONFIG, ...config }
  const fixHistory: string[] = []
  let currentSpec = spec
  let loopCount = 0

  // ─── Round 0: Compile Version A ───
  const resultA = compilePrompt(currentSpec)
  const promptA = resultA.prompt
  console.log(`[FeedbackLoop] 🔄 Round 0 (Version A): compiled prompt (${promptA.length} chars, score=${resultA.scores.overall.toFixed(3)})`)

  // ─── Generate Video A ───
  let videoUrlA = ''
  if (videoGenerator) {
    try {
      videoUrlA = await videoGenerator(currentSpec, promptA)
      console.log(`[FeedbackLoop] 🎬 Video A generated: ${videoUrlA.substring(0, 60)}...`)
    } catch (err: any) {
      console.warn(`[FeedbackLoop] ⚠️ Video A generation failed: ${err.message}`)
    }
  }

  // ─── Evaluate Version A ───
  const critiqueA = await evaluateVideo({
    prompt: promptA,
    videoUrl: videoUrlA || undefined,
    specJson: JSON.stringify(currentSpec),
    expectedCamera: currentSpec.camera.shot_type,
    expectedMovement: currentSpec.camera.movement,
  })
  console.log(`[FeedbackLoop] 📊 Critique A: overall=${critiqueA.overallScore.toFixed(3)}, reasons=${critiqueA.failureReasons.length}`)

  // ─── Diff Analysis A ───
  const gapA = analyzeGap(critiqueA, currentSpec, promptA)
  console.log(`[FeedbackLoop] 🔍 Gap A: camera=${gapA.cameraMismatch.length}, vfx=${gapA.vfxMismatch.length}, action=${gapA.actionMismatch.length}`)

  // ─── Check pass ───
  if (critiqueA.overallScore >= cfg.passThreshold || cfg.maxLoops === 0) {
    console.log(`[FeedbackLoop] ✅ Version A passed (score=${critiqueA.overallScore.toFixed(3)} >= ${cfg.passThreshold})`)
    return {
      finalSpec: currentSpec,
      finalPrompt: promptA,
      finalScore: critiqueA.overallScore,
      finalVideoUrl: videoUrlA || undefined,
      loopCount: 0,
      versionA: { prompt: promptA, critique: critiqueA, gap: gapA },
      metrics: {
        promptAccuracyDelta: 0,
        cameraStabilityGain: 0,
        vfxRealismGain: 0,
        sceneCoherenceGain: 0,
        loopImprovementRate: 0,
      },
      fixHistory: [],
      passed: true,
    }
  }

  // ─── If shadow revision disabled, return A as final ───
  if (!cfg.shadowRevision) {
    return {
      finalSpec: currentSpec,
      finalPrompt: promptA,
      finalScore: critiqueA.overallScore,
      finalVideoUrl: videoUrlA || undefined,
      loopCount: 0,
      versionA: { prompt: promptA, critique: critiqueA, gap: gapA },
      metrics: {
        promptAccuracyDelta: 0,
        cameraStabilityGain: 0,
        vfxRealismGain: 0,
        sceneCoherenceGain: 0,
        loopImprovementRate: 0,
      },
      fixHistory: [`Score ${critiqueA.overallScore.toFixed(3)} < ${cfg.passThreshold}, shadow revision disabled`],
      passed: false,
    }
  }

  // ─── Auto-Fix: Spec A → Spec B ───
  const fixResult = autoFix(currentSpec, gapA)
  fixHistory.push(...fixResult.changes.map(c => `[Loop 1] ${c}`))
  console.log(`[FeedbackLoop] 🔧 Auto-fix: ${fixResult.changes.length} changes, confidence=${fixResult.confidence.toFixed(3)}`)

  if (!fixResult.didChange) {
    console.log(`[FeedbackLoop] ⚠️ No changes from auto-fixer, returning best available`)
    return {
      finalSpec: currentSpec,
      finalPrompt: promptA,
      finalScore: critiqueA.overallScore,
      finalVideoUrl: videoUrlA || undefined,
      loopCount: 0,
      versionA: { prompt: promptA, critique: critiqueA, gap: gapA },
      versionB: {
        prompt: promptA,
        spec: currentSpec,
        critique: critiqueA,
        autoFix: fixResult,
      },
      metrics: {
        promptAccuracyDelta: 0,
        cameraStabilityGain: 0,
        vfxRealismGain: 0,
        sceneCoherenceGain: 0,
        loopImprovementRate: 0,
      },
      fixHistory: ['Auto-fixer produced no changes'],
      passed: false,
    }
  }

  const specB = fixResult.spec
  loopCount++

  // ─── Compile Version B ───
  const resultB = compilePrompt(specB)
  const promptB = resultB.prompt
  console.log(`[FeedbackLoop] 🔄 Round 1 (Version B): compiled prompt (${promptB.length} chars)`)

  // ─── Generate Video B ───
  let videoUrlB = ''
  if (videoGenerator) {
    try {
      videoUrlB = await videoGenerator(specB, promptB)
      console.log(`[FeedbackLoop] 🎬 Video B generated: ${videoUrlB.substring(0, 60)}...`)
    } catch (err: any) {
      console.warn(`[FeedbackLoop] ⚠️ Video B generation failed: ${err.message}`)
    }
  }

  // ─── Evaluate Version B ───
  const critiqueB = await evaluateVideo({
    prompt: promptB,
    videoUrl: videoUrlB || undefined,
    specJson: JSON.stringify(specB),
    expectedCamera: specB.camera.shot_type,
    expectedMovement: specB.camera.movement,
  })
  console.log(`[FeedbackLoop] 📊 Critique B: overall=${critiqueB.overallScore.toFixed(3)}, reasons=${critiqueB.failureReasons.length}`)

  // ─── Score Compare: 选择最优版本 ───
  const useB = critiqueB.overallScore > critiqueA.overallScore
  const finalSpec = useB ? specB : currentSpec
  const finalPrompt = useB ? promptB : promptA
  const finalScore = useB ? critiqueB.overallScore : critiqueA.overallScore
  const finalVideoUrl = useB ? (videoUrlB || undefined) : (videoUrlA || undefined)

  console.log(`[FeedbackLoop] 🏆 Final: ${useB ? 'Version B' : 'Version A'} (A=${critiqueA.overallScore.toFixed(3)}, B=${critiqueB.overallScore.toFixed(3)})`)

  // ─── Metrics ───
  const metrics: CinematicEvolutionMetrics = {
    promptAccuracyDelta: critiqueA.overallScore > 0
      ? parseFloat(((critiqueB.overallScore - critiqueA.overallScore) / critiqueA.overallScore).toFixed(4))
      : critiqueB.overallScore,
    cameraStabilityGain: critiqueB.cameraScore - critiqueA.cameraScore,
    vfxRealismGain: critiqueB.vfxScore - critiqueA.vfxScore,
    sceneCoherenceGain: critiqueB.compositionScore - critiqueA.compositionScore,
    loopImprovementRate: critiqueA.overallScore > 0
      ? parseFloat(((critiqueB.overallScore - critiqueA.overallScore) / critiqueA.overallScore * 100).toFixed(1))
      : 0,
  }

  return {
    finalSpec,
    finalPrompt,
    finalScore,
    finalVideoUrl,
    loopCount,
    versionA: { prompt: promptA, critique: critiqueA, gap: gapA },
    versionB: {
      prompt: promptB,
      spec: specB,
      critique: critiqueB,
      autoFix: fixResult,
    },
    metrics,
    fixHistory,
    passed: finalScore >= cfg.passThreshold,
  }
}
