/**
 * Cinematic Grammar System — Full Orchestrator
 * Cinematic Grammar System — 镜头语法系统
 *
 * 总控编排器：语法标注 → 叙事排序 → 情绪弧线 → 导演约束 完整链路。
 *
 * 这是从 "生成视频" 到 "导演视频" 的关键跃迁层。
 *
 * 使用方式：
 *   const grammar = new CinematicGrammarSystem()
 *   const result = grammar.run(shotTexts)
 */

import { ShotGrammarNode, ShotGrammarType, GRAMMAR_PRESETS } from './shot-grammar-tree'
import { NarrativeSequencer, NarrativeSequencedShot } from './narrative-sequencer'
import { EmotionalArcCompiler, EmotionalArc } from './emotional-arc-compiler'
import { DirectorialConstraintEngine, ConstraintReport } from './directorial-constraint-engine'
import { runCFL, ShotSkeleton, CFLRuntimeResult, defaultCFLState, computeCoherence } from './cinematic-flow-layer'
import { compressToIntentUnits, intentUnitToSkeleton, IntentUnit } from './narrative-compression-layer'

export interface GrammarResult {
  /** 原始镜头描述文本 */
  rawShots: string[]
  /** 语法标注后的镜头序列 */
  annotatedShots: {
    text: string
    grammarType: ShotGrammarType
    sortedPosition: number
  }[]
  /** 排序后的叙事序列 */
  sequencedShots: NarrativeSequencedShot[]
  /** 情绪弧线 */
  emotionalArc: EmotionalArc
  /** 导演约束报告 */
  constraintReport: ConstraintReport
  /** 语法分析摘要 */
  summary: string
  /** CFL Flow Layer 结果 */
  cflResult?: CFLRuntimeResult
}

export class CinematicGrammarSystem {
  constructor(
    private sequencer: NarrativeSequencer = new NarrativeSequencer(),
  private grammarNodes: ShotGrammarNode[] = [],
    private arcCompiler: EmotionalArcCompiler = new EmotionalArcCompiler(),
    private constraintEngine: DirectorialConstraintEngine = new DirectorialConstraintEngine(),
  ) {}

  /**
   * 运行完整镜头语法分析流程
   */
  run(shotTexts: string[], preset?: string): GrammarResult {
    // Step 1: 应用预设语法模板（如果有）
    const grammarNodes: ShotGrammarNode[] = preset && GRAMMAR_PRESETS[preset]
      ? GRAMMAR_PRESETS[preset].slice(0, shotTexts.length)
      : shotTexts.map((text, i) => this.sequencer.inferGrammarType(text, i, shotTexts.length))

    // Step 2: 叙事排序
    this.grammarNodes = grammarNodes
    const rawSequencedShots = this.sequencer.sequence(shotTexts)
    const sequencedShots = rawSequencedShots.map((s, i) => ({
      ...s,
      // 保持 grammarNodes 匹配
      grammarType: grammarNodes[i]?.type ?? 'build_up',
    }))

    // Step 3: 情绪弧线
    const emotionalArc = this.arcCompiler.compile(grammarNodes)

    // Step 4: 导演约束
    const constraintReport = this.constraintEngine.enforce(grammarNodes)

    // Step 5: 标注镜头
    const annotatedShots = shotTexts.map((text, i) => ({
      text,
      grammarType: grammarNodes[i]?.type ?? 'build_up',
      sortedPosition: rawSequencedShots.find(s => s.orderedPosition === i)?.sortedIndex ?? i,
    }))

    // Step 6: NCL — Narrative Compression Layer（E1.8.1）
    // 将 BCSG segments 压缩为 IntentUnit[]
    // CFL 只看 IntentUnit，不看 raw segments
    const intentUnits = compressToIntentUnits(sequencedShots)
    const compressionRate = shotTexts.length > 0
      ? ((1 - intentUnits.length / shotTexts.length) * 100).toFixed(0)
      : '0'

    // Step 7: CFL Flow Layer — modified to accept IntentUnit input
    // CFL 输入改为 IntentUnit[]，不再直接使用 grammarNodes
    const shotSkeletons: ShotSkeleton[] = intentUnits.map((unit, i) => {
      const skeleton = intentUnitToSkeleton(unit, i)
      return {
        shotType: skeleton.shotType,
        boundaryId: skeleton.boundaryId,
        framing: skeleton.framing,
        duration: skeleton.duration,
        camera: skeleton.camera,
        intensity: skeleton.intensity,
        speechActMark: skeleton.speechActMark,
      } as ShotSkeleton
    })
    const cflResult = runCFL(shotSkeletons, defaultCFLState())

    // Step 8: 摘要
    const arcTypeLabels: Record<string, string> = {
      classic: '经典弧线（低→高→低）',
      sustained_high: '持续高张力',
      roller_coaster: '过山车式起伏',
      flat: '平缓',
    }

    const cflCoherence = cflResult.coherence
    const cflLine = cflCoherence.passed
      ? `  ├─ CFL Flow: ✅ 三指标联合收敛（emotion ${cflCoherence.emotionStable} / visual ${cflCoherence.visualInertial} / rhythm ${cflCoherence.rhythmEmergent}）`
      : `  ├─ CFL Flow: 观测中（emotion ${cflCoherence.emotionStable} / visual ${cflCoherence.visualInertial} / rhythm ${cflCoherence.rhythmEmergent}）`

    const summary = [
      `🎬 镜头语法分析`,
      `  ├─ 原始镜头: ${shotTexts.length}`,
      `  ├─ NCL 压缩后: ${intentUnits.length}（-${compressionRate}%）`,
      `  ├─ 情绪弧线: ${arcTypeLabels[emotionalArc.arcType] || emotionalArc.arcType}`,
      `  ├─ 最大张力: ${(emotionalArc.maxTension * 100).toFixed(0)}%`,
      `  ├─ 波动幅度: ${(emotionalArc.volatility * 100).toFixed(0)}%`,
      `  ├─ 语法约束: ${constraintReport.passed ? '✅ 通过' : '❌ 违规 ' + constraintReport.hardViolations.length + ' 项'}`,
      cflLine,
      `  └─ 推荐: ${constraintReport.recommendations.length > 0 ? constraintReport.recommendations.join('; ') : '无'}`,
    ].join('\n')

    return {
      rawShots: shotTexts,
      annotatedShots,
      sequencedShots,
      emotionalArc,
      constraintReport,
      summary,
      cflResult,
    }
  }
}

// 辅助函数（已移除）
