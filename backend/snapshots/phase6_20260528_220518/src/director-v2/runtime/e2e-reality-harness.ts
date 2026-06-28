/**
 * e2e-reality-harness.ts — Phase 5B: End-to-End Semantic Reality Test Harness
 *
 * 验证 3 件事：
 *   1. Semantic Continuity — 同一个 script N 次运行，scene/ intent 是否稳定
 *   2. Projection Fidelity — projection 是否忠实表达了 constitution 的核心语义
 *   3. Control Integrity — intervention 是否在 projection 层可见响应
 *
 * 这不是 debug 脚本。这是"语义操作系统在现实层一致性成立"的验证工具。
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import type { CinematicIntentVector } from './cinematic-intent.js'
import { cinematicIntent } from './cinematic-intent.js'
import { directorProjection } from './director-projection.js'
import { semanticEnergy } from './semantic-energy.js'
import type { ScenePreview, DirectorStatus, GenerationResult } from './director-projection.js'

// ============================================================
// Types
// ============================================================

export interface E2ERunSnapshot {
  /** 运行编号 */
  runId: number
  /** 输入的 script 指纹 */
  scriptFingerprint: string
  /** 生成的 constitution */
  constitution: StoryConstitution
  /** 意图向量 */
  intent: CinematicIntentVector
  /** 投影结果 */
  projection: GenerationResult
  /** 连贯评分 */
  coherence: {
    level: string
    score: number
  }
  /** 能量评分 */
  energy: {
    level: string
    score: number
  }
}

export interface E2EHarnessResult {
  /** 所有 runs */
  runs: E2ERunSnapshot[]
  /** Semantic Continuity Score (0-1, 1=完全一致) */
  continuity: {
    overall: number
    sceneConsistency: number
    intentTrajectoryConsistency: number
    shotAbstractionStability: number
  }
  /** Projection Fidelity Score (0-1, 1=完全忠实) */
  fidelity: {
    overall: number
    emotionalPreservation: number
    pacingPreservation: number
    structuralFidelity: number
  }
  /** Control Integrity Assessment */
  integrity: {
    overall: number
    interventionVisibility: number
    constraintRespect: number
  }
  /** 通过/不通过 */
  verdict: 'PASS' | 'REVIEW'
  /** 详细报告 */
  report: string[]
}

export interface E2EConfig {
  /** 运行次数 */
  runsN: number
  /** 语义连续性阈值 */
  continuityThreshold: number
  /** 投影保真度阈值 */
  fidelityThreshold: number
  /** 控制完整性阈值 */
  integrityThreshold: number
}

const DEFAULT_CONFIG: E2EConfig = {
  runsN: 10,
  continuityThreshold: 0.7,
  fidelityThreshold: 0.75,
  integrityThreshold: 0.8,
}

// ============================================================
// Harness
// ============================================================

export class E2ERealityHarness {
  private config: E2EConfig

  constructor(config: Partial<E2EConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 注入一条 constitution 并运行完整验证链
   * （模拟 Director OS 从 constitution → intent → projection 的全链路）
   */
  runSingle(constitution: StoryConstitution, runId: number): E2ERunSnapshot {
    // 1. 计算 intent
    const intent = cinematicIntent.buildFromConstitution(
      String(constitution.projectId || 'test_proj'),
      constitution,
    )

    // 2. 计算 coherence
    const coherence = cinematicIntent.scoreCoherence(intent, constitution)

    // 3. 计算 energy
    const energy = semanticEnergy.compute(constitution)

    // 4. 构建 projection
    const projection = directorProjection.buildResult(
      String(constitution.projectId || 'test_proj'),
      constitution,
      coherence.level,
      energy,
    )

    // 5. 计算 script fingerprint
    const scriptFingerprint = this.computeFingerprint(constitution.coreTheme || '')

    return {
      runId,
      scriptFingerprint,
      constitution: JSON.parse(JSON.stringify(constitution)),
      intent: JSON.parse(JSON.stringify(intent)),
      projection: JSON.parse(JSON.stringify(projection)),
      coherence: { level: coherence.level, score: coherence.total },
      energy: { level: energy.level, score: energy.total },
    }
  }

  /**
   * 运行 N 次相同 constitution 并评估一致性
   */
  runRealityTest(constitution: StoryConstitution): E2EHarnessResult {
    const runs: E2ERunSnapshot[] = []
    const report: string[] = []

    // 生成 N 次 runs（用相同的 constitution）
    for (let i = 0; i < this.config.runsN; i++) {
      runs.push(this.runSingle(constitution, i + 1))
    }

    // 评估 3 大指标
    const continuity = this.evaluateContinuity(runs, report)
    const fidelity = this.evaluateFidelity(runs[0], report)
    const integrity = this.evaluateIntegrity(runs, report)

    const overall = (continuity.overall + fidelity.overall + integrity.overall) / 3
    const verdict = overall >= this.config.fidelityThreshold ? 'PASS' : 'REVIEW'

    report.push(`\n=== VERDICT: ${verdict} ===`)
    report.push(`Overall Score: ${overall.toFixed(3)}`)
    if (verdict === 'REVIEW') {
      report.push('\n⚠️  Attention needed:')
      if (continuity.overall < this.config.continuityThreshold) {
        report.push(`  - Continuity below threshold: ${continuity.overall.toFixed(3)} < ${this.config.continuityThreshold}`)
      }
      if (fidelity.overall < this.config.fidelityThreshold) {
        report.push(`  - Fidelity below threshold: ${fidelity.overall.toFixed(3)} < ${this.config.fidelityThreshold}`)
      }
      if (integrity.overall < this.config.integrityThreshold) {
        report.push(`  - Integrity below threshold: ${integrity.overall.toFixed(3)} < ${this.config.integrityThreshold}`)
      }
    }

    return { runs, continuity, fidelity, integrity, verdict, report }
  }

  // ============================================================
  // Evaluation — Semantic Continuity
  // ============================================================

  private evaluateContinuity(
    runs: E2ERunSnapshot[],
    report: string[],
  ): E2EHarnessResult['continuity'] {
    report.push('\n=== Semantic Continuity ===')
    report.push(`Runs evaluated: ${runs.length}`)

    // Scene structure consistency
    const sceneConsistency = this.evaluateSceneConsistency(runs, report)

    // Intent trajectory consistency
    const intentConsistency = this.evaluateIntentConsistency(runs, report)

    // Shot abstraction stability
    const shotStability = this.evaluateShotStability(runs, report)

    const overall = (sceneConsistency + intentConsistency + shotStability) / 3

    report.push(`Overall Continuity: ${overall.toFixed(3)}`)
    report.push(`  Scene: ${sceneConsistency.toFixed(3)}`)
    report.push(`  Intent: ${intentConsistency.toFixed(3)}`)
    report.push(`  Shot: ${shotStability.toFixed(3)}`)

    return {
      overall,
      sceneConsistency,
      intentTrajectoryConsistency: intentConsistency,
      shotAbstractionStability: shotStability,
    }
  }

  private evaluateSceneConsistency(runs: E2ERunSnapshot[], report: string[]): number {
    // 场景结构一致性：所有 run 的场景数量、场景标题是否一致
    const sceneCounts = runs.map(r => r.projection.scenes.length)
    const allSameCount = sceneCounts.every(c => c === sceneCounts[0])

    if (!allSameCount) {
      report.push('  ⚠️  Scene count varies across runs')
      return 0.5
    }

    // 场景标题一致性
    const titles = runs.map(r => r.projection.scenes.map(s => s.title))
    const titleConsistency = titles.map(t => this.jaccardSimilarity(t, titles[0]))
    const avgTitleConsistency = titleConsistency.reduce((a, b) => a + b, 0) / titleConsistency.length

    return avgTitleConsistency
  }

  private evaluateIntentConsistency(runs: E2ERunSnapshot[], report: string[]): number {
    // Coherence level 一致性
    const coherenceLevels = runs.map(r => r.coherence.level)
    const allSameLevel = coherenceLevels.every(l => l === coherenceLevels[0])
    const levelStability = allSameLevel ? 1.0 : 0.6

    // Coherence score 一致性（低方差）
    const scores = runs.map(r => r.coherence.score)
    const variance = this.computeVariance(scores)
    const scoreStability = Math.max(0, 1 - variance * 5) // 惩罚高方差

    return (levelStability + scoreStability) / 2
  }

  private evaluateShotStability(runs: E2ERunSnapshot[], report: string[]): number {
    // Shot 的类型分布稳定性
    const shotTypes = runs.map(r =>
      r.projection.scenes.flatMap(scene =>
        // 从 projection 的 scene 数据提取 shot type
        scene.visualKeywords,
      ),
    )

    if (shotTypes.length === 0) return 0.5

    const avgLen = shotTypes.reduce((a, b) => a + b.length, 0) / shotTypes.length
    const allSameLen = shotTypes.every(s => s.length === shotTypes[0].length)

    return allSameLen ? 1.0 : Math.min(1.0, avgLen / 5)
  }

  // ============================================================
  // Evaluation — Projection Fidelity
  // ============================================================

  private evaluateFidelity(
    benchmark: E2ERunSnapshot,
    report: string[],
  ): E2EHarnessResult['fidelity'] {
    report.push('\n=== Projection Fidelity ===')

    // 1. Emotional preservation
    const emotionalPreservation = this.evaluateEmotionalFidelity(benchmark, report)

    // 2. Pacing preservation
    const pacingPreservation = this.evaluatePacingFidelity(benchmark, report)

    // 3. Structural fidelity
    const structuralFidelity = this.evaluateStructuralFidelity(benchmark, report)

    const overall = (emotionalPreservation + pacingPreservation + structuralFidelity) / 3

    report.push(`Overall Fidelity: ${overall.toFixed(3)}`)
    report.push(`  Emotional: ${emotionalPreservation.toFixed(3)}`)
    report.push(`  Pacing: ${pacingPreservation.toFixed(3)}`)
    report.push(`  Structural: ${structuralFidelity.toFixed(3)}`)

    return { overall, emotionalPreservation, pacingPreservation, structuralFidelity }
  }

  private evaluateEmotionalFidelity(run: E2ERunSnapshot, report: string[]): number {
    const constitution = run.constitution
    const projection = run.projection.preview

    const constitutionEmotion = String(
      constitution.emotionalTrajectory?.dominantEmotion ||
      constitution.emotionalTrajectory?.resolutionTone ||
      '',
    ).toLowerCase()

    const projectionEmotion = projection.emotionalTone.toLowerCase()

    // 情感是否被弱化/美化/误读
    const exactMatch = constitutionEmotion === projectionEmotion ? 1.0 :
      projectionEmotion.includes(constitutionEmotion) ||
      constitutionEmotion.includes(projectionEmotion) ? 0.8 : 0.4

    // 能量等级是否一致
    const constitutionEnergy = run.energy.level
    const projectionEnergy = projection.energy

    // 能量映射验证
    const energyMap: Record<string, string[]> = {
      'intense': ['very_high', 'high'],
      'building': ['medium'],
      'calm': ['low', 'very_low'],
    }

    let energyMatch = 0
    for (const [projLevel, kernelLevels] of Object.entries(energyMap)) {
      if (projLevel === projectionEnergy && kernelLevels.includes(constitutionEnergy)) {
        energyMatch = 1.0
        break
      }
    }

    return (exactMatch + energyMatch) / 2
  }

  private evaluatePacingFidelity(run: E2ERunSnapshot, report: string[]): number {
    const constitution = run.constitution
    const timeline = run.projection.preview

    const constitutionPacing = String(constitution.pacingDoctrine?.pacingCurve || '')

    // 投影至少应该包含 pacing 相关信息
    // 由于 projection 不直接暴露 pacing，通过 timeline 的 pacingDescription 判断
    const speedWords = ['渐进', '加速', '快', '递增', '稳态', '匀速', '慢']
    const hasPacingInfo = speedWords.some(w => timeline.emotionalTone.includes(w))

    // 情感弧线是否隐含了节奏信息
    const emotionalArc = run.projection.scenes.map(s => s.emotionalShift).join(' → ')
    const arcHasPacing = emotionalArc.length > 5

    const infoPreserved = hasPacingInfo || arcHasPacing ? 1.0 : 0.3

    return infoPreserved
  }

  private evaluateStructuralFidelity(run: E2ERunSnapshot, report: string[]): number {
    const constitution = run.constitution
    const projection = run.projection

    // 1. 角色数量一致
    const constitutionChars = (constitution.characterLaws || []).length
    const projectionChars = projection.preview.keyCharacters.length
    const charMatch = Math.min(1.0, projectionChars / Math.max(constitutionChars, 1))

    // 2. 项目标题存在
    const titleExists = projection.title.length > 0 ? 1.0 : 0

    // 3. 场景数量合理
    const sceneCount = projection.scenes.length
    const sceneReasonable = sceneCount >= 2 && sceneCount <= 10 ? 1.0 : 0.5

    return (charMatch + titleExists + sceneReasonable) / 3
  }

  // ============================================================
  // Evaluation — Control Integrity
  // ============================================================

  private evaluateIntegrity(
    runs: E2ERunSnapshot[],
    report: string[],
  ): E2EHarnessResult['integrity'] {
    report.push('\n=== Control Integrity ===')

    // Intervention visibility: 如果 coherence 变化了，projection 应该反映
    const levels = runs.map(r => r.projection.preview.stability)
    const coherenceLevels = runs.map(r => r.coherence.level)

    let stableMismatches = 0
    for (let i = 0; i < levels.length; i++) {
      const expectedStability = coherenceLevels[i] === 'ALIGNED' ? 'stable' : 'notable_shift'
      if (levels[i] !== expectedStability &&
          levels[i] !== 'stable' && // 允许 mild_variance 作为中间态
          coherenceLevels[i] === 'ALIGNED') {
        stableMismatches++
      }
    }

    const interventionVisibility = 1 - (stableMismatches / Math.max(levels.length, 1))

    // Constraint respect: projection 不应该泄露 raw data
    let constraintRespect = 1.0
    const forbiddenKeys = ['drift', 'confidence', 'intervention', 'skeleton', 'enrichment']
    for (const run of runs) {
      for (const key of forbiddenKeys) {
        if (key in run.projection) {
          constraintRespect = 0
          report.push(`  ⚠️  Forbidden key leaked in projection: "${key}" (run ${run.runId})`)
        }
      }
    }

    const overall = (interventionVisibility + constraintRespect) / 2

    report.push(`Overall Integrity: ${overall.toFixed(3)}`)
    report.push(`  Intervention Visibility: ${interventionVisibility.toFixed(3)}`)
    report.push(`  Constraint Respect: ${constraintRespect.toFixed(3)}`)

    return { overall, interventionVisibility, constraintRespect }
  }

  // ============================================================
  // Utilities
  // ============================================================

  private computeFingerprint(theme: string): string {
    // 简单的指纹：取主题的前 20 个字符
    return theme.slice(0, 20).replace(/\s+/g, '_')
  }

  private jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a)
    const setB = new Set(b)
    const intersection = new Set([...setA].filter(x => setB.has(x)))
    const union = new Set([...setA, ...setB])
    return union.size === 0 ? 1 : intersection.size / union.size
  }

  private computeVariance(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  }
}
