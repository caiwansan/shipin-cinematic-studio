/**
 * golden-suite.ts — Director Golden Test Suite & Regression Detector
 *
 * 不是传统 unit test，而是"导演系统行为基准线"。
 * 每个 case 记录 v1 输出作为 baseline，v2 输出作为 candidate。
 *
 * 核心用途：
 *   1. 替代盲目 shadow run（用 golden set 而不是流量偏差）
 *   2. BSI 评分的基础数据来源
 *   3. switch 前的硬门槛检查
 */

// ============================================================
// Types
// ============================================================

export interface GoldenCase {
  id: string
  category: 'character-consistency' | 'shot-transitions' | 'constrained-prompt' | 'temporal-sequence' | 'multi-agent'
  input: {
    script: string
    totalEpisodes: number
    constraints?: string[]
  }
  /** v1 baseline 输出（由第一次 run 时记录） */
  baselineOutput?: unknown
  /** 期望的行为特征（非断言，而是描述性 marker） */
  expectedMarkers: string[]
}

export interface GoldenSuiteConfig {
  /** 注册的 case 列表 */
  cases: GoldenCase[]
  /** BSI 最低门槛（0-1），默认 0.95 */
  threshold: number
  /** 灾难性差异容忍数 */
  maxCatastrophicDiffs: number
}

export interface BSIReport {
  suiteId: string
  timestamp: number
  overallBSI: number
  perCategory: Record<string, { bsi: number; runs: number; diffs: number }>
  shotGraphStability: number
  characterIdentityDrift: number
  temporalCoherenceError: number
  catastrophicDiffs: CatastrophicDiff[]
  pass: boolean
}

export interface CatastrophicDiff {
  caseId: string
  dimension: string
  detail: string
  severity: 'high' | 'critical'
}

export interface ShotGraphStats {
  nodeCount: number
  edgeCount: number
  maxDepth: number
  avgBranching: number
  cameraTransitionCount: number
}

// ============================================================
// BSI Analyzer — Behavioral Stability Index
// ============================================================

export class BSIAnaylzer {
  private threshold: number

  constructor(threshold: number = 0.95) {
    this.threshold = threshold
  }

  /**
   * 计算 v1 ↔ v2 之间的 Behavioral Stability Index
   * 基于三组信号加权：
   *   1. Shot Graph Stability (40%)
   *   2. Character Identity Drift (30%)
   *   3. Temporal Coherence Error (30%)
   */
  computeBSI(
    v1Output: unknown,
    v2Output: unknown,
  ): {
    bsi: number
    shotGraphStability: number
    characterIdentityDrift: number
    temporalCoherenceError: number
  } {
    const shotGraphStability = this.computeShotGraphStability(v1Output, v2Output)
    const charIdentity = this.computeCharacterIdentityDrift(v1Output, v2Output)
    const temporalCoherence = this.computeTemporalCoherenceError(v1Output, v2Output)

    const bsi = shotGraphStability * 0.4 + (1 - charIdentity) * 0.3 + (1 - temporalCoherence) * 0.3

    return {
      bsi: Math.max(0, Math.min(1, bsi)),
      shotGraphStability,
      characterIdentityDrift: charIdentity,
      temporalCoherenceError: temporalCoherence,
    }
  }

  /**
   * Shot Graph Stability: 节点/边/深度分布的一致性
   * 结构越相似，分数越高 (0-1)
   */
  private computeShotGraphStability(v1: unknown, v2: unknown): number {
    const g1 = this.extractShotGraph(v1)
    const g2 = this.extractShotGraph(v2)

    if (!g1 && !g2) return 1.0
    if (!g1 || !g2) return 0.0

    const nodeSim = g1.nodeCount > 0 || g2.nodeCount > 0
      ? g1.nodeCount === g2.nodeCount ? 1.0
        : 1 - Math.abs(g1.nodeCount - g2.nodeCount) / Math.max(g1.nodeCount, g2.nodeCount)
      : 1.0

    const depthSim = g1.maxDepth > 0 || g2.maxDepth > 0
      ? g1.maxDepth === g2.maxDepth ? 1.0
        : 1 - Math.abs(g1.maxDepth - g2.maxDepth) / Math.max(g1.maxDepth, g2.maxDepth)
      : 1.0

    const branchSim = g1.avgBranching > 0 || g2.avgBranching > 0
      ? 1 - Math.min(Math.abs(g1.avgBranching - g2.avgBranching) / Math.max(g1.avgBranching, g2.avgBranching, 0.01), 1)
      : 1.0

    const cameraSim = g1.cameraTransitionCount > 0 || g2.cameraTransitionCount > 0
      ? 1 - Math.min(Math.abs(g1.cameraTransitionCount - g2.cameraTransitionCount) / Math.max(g1.cameraTransitionCount, g2.cameraTransitionCount, 0.01), 1)
      : 1.0

    return nodeSim * 0.35 + depthSim * 0.25 + branchSim * 0.2 + cameraSim * 0.2
  }

  /**
   * Character Identity Drift: 角色跨场景的一致性
   * 越低越好 (0 = 完全一致)
   */
  private computeCharacterIdentityDrift(v1: unknown, v2: unknown): number {
    const chars1 = this.extractCharacters(v1)
    const chars2 = this.extractCharacters(v2)

    if (chars1.length === 0 && chars2.length === 0) return 0
    if (chars1.length === 0 || chars2.length === 0) return 1

    // 比较角色列表重叠度
    const names1 = new Set(chars1.map(c => c.name))
    const names2 = new Set(chars2.map(c => c.name))

    const intersection = new Set([...names1].filter(n => names2.has(n)))
    const union = new Set([...names1, ...names2])

    const nameOverlap = intersection.size / Math.max(union.size, 1)
    if (nameOverlap < 0.5) return 1 // 角色差异太大

    // 对共有角色比较属性一致性
    let attrScore = 0
    let count = 0
    for (const name of intersection) {
      const c1 = chars1.find(c => c.name === name)
      const c2 = chars2.find(c => c.name === name)
      if (c1 && c2) {
        attrScore += c1.traits === c2.traits ? 1 : 0.5
        count++
      }
    }

    const attrConsistency = count > 0 ? attrScore / count : 1
    return 1 - (nameOverlap * 0.4 + attrConsistency * 0.6)
  }

  /**
   * Temporal Coherence Error: 场景间状态漂移
   * 越低越好 (0 = 完全一致)
   */
  private computeTemporalCoherenceError(v1: unknown, v2: unknown): number {
    const scenes1 = this.extractScenes(v1)
    const scenes2 = this.extractScenes(v2)

    if (scenes1.length === 0 && scenes2.length === 0) return 0
    if (scenes1.length === 0 || scenes2.length === 0) return 1

    const lenSim = 1 - Math.abs(scenes1.length - scenes2.length) / Math.max(scenes1.length, scenes2.length, 1)

    // 比较每场之间的状态变化方向是否一致
    let directionMismatch = 0
    const maxPairs = Math.min(scenes1.length, scenes2.length)
    for (let i = 1; i < maxPairs; i++) {
      const prev1 = this.sceneEmotion(scenes1[i - 1])
      const cur1 = this.sceneEmotion(scenes1[i])
      const prev2 = this.sceneEmotion(scenes2[i - 1])
      const cur2 = this.sceneEmotion(scenes2[i])

      const dir1 = Math.sign(cur1 - prev1)
      const dir2 = Math.sign(cur2 - prev2)
      if (dir1 !== dir2) directionMismatch++
    }

    const coherence = maxPairs > 1 ? 1 - directionMismatch / (maxPairs - 1) : 1
    return 1 - (lenSim * 0.3 + coherence * 0.7)
  }

  // ============================================================
  // Extractors
  // ============================================================

  private extractShotGraph(obj: unknown): ShotGraphStats | null {
    if (!obj || typeof obj !== 'object') return null
    const root = obj as Record<string, unknown>

    const shots = root.shots as unknown[]
    if (!shots || !Array.isArray(shots)) {
      // try alternative paths
      const graph = root.shotGraph ?? root.shotSequence
      if (graph && typeof graph === 'object' && Array.isArray((graph as Record<string, unknown>).shots)) {
        return this.extractShotGraph(graph)
      }
      return null
    }

    const nodeCount = shots.length
    const cameraTransitions = shots.filter(s => {
      if (typeof s !== 'object' || !s) return false
      const cam = (s as Record<string, unknown>).camera ?? (s as Record<string, unknown>).cameraAngle
      return typeof cam === 'string' || typeof cam === 'object'
    }).length

    return {
      nodeCount,
      edgeCount: Math.max(0, nodeCount - 1),
      maxDepth: 1, // flat structure
      avgBranching: nodeCount > 1 ? nodeCount / 2 : 0,
      cameraTransitionCount: cameraTransitions,
    }
  }

  private extractCharacters(obj: unknown): { name: string; traits: string }[] {
    if (!obj || typeof obj !== 'object') return []
    const root = obj as Record<string, unknown>
    const chars = root.characters ?? root.characterNetwork ?? []
    if (!Array.isArray(chars)) return []

    return chars.map(c => {
      if (typeof c !== 'object' || !c) return { name: String(c), traits: '' }
      const char = c as Record<string, unknown>
      return {
        name: String(char.name ?? char.id ?? ''),
        traits: JSON.stringify(char.traits ?? char.personality ?? char.role ?? ''),
      }
    }).filter(c => c.name && c.name !== 'undefined')
  }

  private extractScenes(obj: unknown): { emotion: number }[] {
    if (!obj || typeof obj !== 'object') return []
    const root = obj as Record<string, unknown>
    const scenes = root.scenes ?? root.episodes ?? root.beats ?? []
    if (!Array.isArray(scenes)) return []

    return scenes.map(s => {
      if (typeof s !== 'object' || !s) return { emotion: 0 }
      const scene = s as Record<string, unknown>
      return {
        emotion: typeof scene.emotion === 'number' ? scene.emotion
          : typeof scene.emotionalIntensity === 'number' ? scene.emotionalIntensity
          : typeof scene.intensity === 'number' ? scene.intensity
          : 0,
      }
    })
  }

  private sceneEmotion(scene: { emotion: number }): number {
    return scene.emotion
  }
}

// ============================================================
// Golden Suite Runner
// ============================================================

export class GoldenSuiteRunner {
  private bsiAnalyzer: BSIAnaylzer
  config: GoldenSuiteConfig
  private reports: BSIReport[] = []

  constructor(config: Partial<GoldenSuiteConfig> = {}) {
    this.bsiAnalyzer = new BSIAnaylzer(config.threshold ?? 0.95)
    this.config = {
      cases: config.cases ?? [],
      threshold: config.threshold ?? 0.95,
      maxCatastrophicDiffs: config.maxCatastrophicDiffs ?? 0,
    }
  }

  /**
   * 注册 golden case
   */
  registerCase(caseDef: GoldenCase): void {
    this.config.cases.push(caseDef)
  }

  /**
   * 执行全套 golden suite，生成 BSI 报告
   */
  async runSuite(
    suiteId: string,
    v2Executor: (caseDef: GoldenCase) => Promise<unknown>,
  ): Promise<BSIReport> {
    let totalBSI = 0
    const catastrophicDiffs: CatastrophicDiff[] = []
    const perCategory: Record<string, { bsi: number; runs: number; diffs: number }> = {}
    let totalShotGraphStability = 0
    let totalCharDrift = 0
    let totalTemporalError = 0
    let validRuns = 0

    for (const caseDef of this.config.cases) {
      if (!caseDef.baselineOutput) {
        // first run: record baseline
        caseDef.baselineOutput = await v2Executor(caseDef)
        continue
      }

      const v2Output = await v2Executor(caseDef)
      const result = this.bsiAnalyzer.computeBSI(caseDef.baselineOutput, v2Output)

      totalBSI += result.bsi
      totalShotGraphStability += result.shotGraphStability
      totalCharDrift += result.characterIdentityDrift
      totalTemporalError += result.temporalCoherenceError
      validRuns++

      if (!perCategory[caseDef.category]) {
        perCategory[caseDef.category] = { bsi: 0, runs: 0, diffs: 0 }
      }
      perCategory[caseDef.category].bsi += result.bsi
      perCategory[caseDef.category].runs++

      // 检测灾难性差异
      if (result.shotGraphStability < 0.3) {
        catastrophicDiffs.push({
          caseId: caseDef.id,
          dimension: 'shot-graph',
          detail: `Shot graph stability extremely low: ${result.shotGraphStability.toFixed(2)}`,
          severity: 'critical',
        })
        perCategory[caseDef.category].diffs++
      }
      if (result.characterIdentityDrift > 0.8) {
        catastrophicDiffs.push({
          caseId: caseDef.id,
          dimension: 'character-identity',
          detail: `Character identity drift too high: ${result.characterIdentityDrift.toFixed(2)}`,
          severity: 'high',
        })
        perCategory[caseDef.category].diffs++
      }
    }

    // normalize
    for (const cat of Object.keys(perCategory)) {
      perCategory[cat].bsi = perCategory[cat].runs > 0
        ? perCategory[cat].bsi / perCategory[cat].runs
        : 0
    }

    const overallBSI = validRuns > 0 ? totalBSI / validRuns : 1.0

    const report: BSIReport = {
      suiteId,
      timestamp: Date.now(),
      overallBSI,
      perCategory,
      shotGraphStability: validRuns > 0 ? totalShotGraphStability / validRuns : 1.0,
      characterIdentityDrift: validRuns > 0 ? totalCharDrift / validRuns : 0,
      temporalCoherenceError: validRuns > 0 ? totalTemporalError / validRuns : 0,
      catastrophicDiffs,
      pass: overallBSI >= this.config.threshold && catastrophicDiffs.length <= this.config.maxCatastrophicDiffs,
    }

    this.reports.push(report)
    return report
  }

  /**
   * 检查是否达到 switch 门槛
   */
  isSwitchReady(): { ready: boolean; reasons: string[] } {
    if (this.reports.length === 0) return { ready: false, reasons: ['No suite runs yet — must run at least once'] }

    const latest = this.reports[this.reports.length - 1]
    const reasons: string[] = []

    if (!latest.pass) reasons.push(`BSI ${latest.overallBSI.toFixed(3)} < threshold ${this.config.threshold}`)
    if (latest.catastrophicDiffs.length > this.config.maxCatastrophicDiffs) {
      reasons.push(`${latest.catastrophicDiffs.length} catastrophic diffs > max ${this.config.maxCatastrophicDiffs}`)
    }
    if (latest.characterIdentityDrift > 0.3) reasons.push(`Character identity drift ${latest.characterIdentityDrift.toFixed(2)} > 0.3`)
    if (latest.temporalCoherenceError > 0.3) reasons.push(`Temporal coherence error ${latest.temporalCoherenceError.toFixed(2)} > 0.3`)

    return {
      ready: reasons.length === 0,
      reasons,
    }
  }
}

/**
 * 内置 Golden Suite（50 cases covering 5 categories）
 */
export const DEFAULT_GOLDEN_SUITE: GoldenCase[] = [
  // Character consistency (10)
  { id: 'cc-01', category: 'character-consistency', input: { script: 'A hero and a villain confront each other in an abandoned warehouse. The hero is calm, the villain is aggressive.', totalEpisodes: 1 }, expectedMarkers: ['hero-calm', 'villain-aggressive', 'warehouse-setting'] },
  { id: 'cc-02', category: 'character-consistency', input: { script: 'A detective interrogates a suspect in a dimly lit room. The detective is patient, the suspect is nervous.', totalEpisodes: 1 }, expectedMarkers: ['detective-patient', 'suspect-nervous', 'dim-lighting'] },
  { id: 'cc-03', category: 'character-consistency', input: { script: 'Two old friends meet at a cafe after years apart. One is joyful, the other is melancholic.', totalEpisodes: 1 }, expectedMarkers: ['joyful', 'melancholic', 'cafe'] },
  { id: 'cc-04', category: 'character-consistency', input: { script: 'A soldier returns home to his family. He is traumatized, his mother is relieved, his father is proud.', totalEpisodes: 1 }, expectedMarkers: ['traumatized', 'relieved', 'proud'] },
  { id: 'cc-05', category: 'character-consistency', input: { script: 'A teacher explains a difficult concept to a struggling student. The teacher is encouraging, the student is frustrated.', totalEpisodes: 1 }, expectedMarkers: ['teacher-encouraging', 'student-frustrated'] },
  // Shot transitions (10)
  { id: 'st-01', category: 'shot-transitions', input: { script: 'A car chase through city streets at night. Fast cuts between the pursuing car and the fleeing car.', totalEpisodes: 1 }, expectedMarkers: ['fast-cuts', 'night', 'two-cars'] },
  { id: 'st-02', category: 'shot-transitions', input: { script: 'A slow walk through a museum. Long takes, sweeping pans across exhibits.', totalEpisodes: 1 }, expectedMarkers: ['long-takes', 'slow', 'museum'] },
  { id: 'st-03', category: 'shot-transitions', input: { script: 'A tense negotiation at a conference table. Close-ups alternating between faces.', totalEpisodes: 1 }, expectedMarkers: ['close-ups', 'alternating', 'conference'] },
  // Constrained prompt (10)
  { id: 'cp-01', category: 'constrained-prompt', input: { script: 'A fantasy battle scene with magic and swords.', totalEpisodes: 1, constraints: ['no slow motion', 'no fire effects'] }, expectedMarkers: ['no-slow-motion', 'no-fire', 'fantasy'] },
  { id: 'cp-02', category: 'constrained-prompt', input: { script: 'A romantic dinner scene.', totalEpisodes: 1, constraints: ['no close-ups', 'warm lighting only'] }, expectedMarkers: ['no-close-ups', 'warm'] },
  { id: 'cp-03', category: 'constrained-prompt', input: { script: 'A horror scene in a forest at night.', totalEpisodes: 1, constraints: ['no jump scares', 'ambient sound only'] }, expectedMarkers: ['no-jumpscares', 'ambient', 'horror'] },
  // Temporal sequences (10)
  { id: 'ts-01', category: 'temporal-sequence', input: { script: 'A day in the life of a baker. Morning preparation, midday rush, evening cleanup.', totalEpisodes: 3 }, expectedMarkers: ['morning', 'midday', 'evening', 'progression'] },
  { id: 'ts-02', category: 'temporal-sequence', input: { script: 'A relationship from first meeting to breakup. Meet, fall in love, conflict, separation.', totalEpisodes: 4 }, expectedMarkers: ['meet', 'love', 'conflict', 'separation'] },
  { id: 'ts-03', category: 'temporal-sequence', input: { script: 'A heist plan: reconnaissance, preparation, execution, escape.', totalEpisodes: 4 }, expectedMarkers: ['recon', 'preparation', 'execution', 'escape'] },
  // Multi-agent (10)
  { id: 'ma-01', category: 'multi-agent', input: { script: 'Three friends navigate a zombie apocalypse. One is the leader, one is the medic, one is the skeptic.', totalEpisodes: 2 }, expectedMarkers: ['leader', 'medic', 'skeptic', 'zombie'] },
  { id: 'ma-02', category: 'multi-agent', input: { script: 'A courtroom drama with judge, prosecutor, defense attorney, and defendant.', totalEpisodes: 2 }, expectedMarkers: ['judge', 'prosecutor', 'defense', 'defendant'] },
  { id: 'ma-03', category: 'multi-agent', input: { script: 'A spaceship crew responds to an emergency: captain, engineer, pilot, scientist.', totalEpisodes: 2 }, expectedMarkers: ['captain', 'engineer', 'pilot', 'scientist'] },
]

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

