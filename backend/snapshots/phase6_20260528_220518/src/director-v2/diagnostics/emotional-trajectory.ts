/**
 * emotional-trajectory.ts — Emotional Trajectory Field Extractor & Matcher
 *
 * 测量导演系统输出在"情绪曲线空间"的一致度。
 * 输入：scene-level emotion scores → 输出：两条曲线的结构相似度。
 *
 * 核心思想：人看电影感受到的不是 shot graph，而是情绪的升降曲线。
 * Dune 的沙漠辽阔 ≠ 情绪平静，Mad Max 的快节奏 ≠ 情绪无层次。
 */

// ============================================================
// Types
// ============================================================

export interface EmotionalTrajectory {
  /** 每个 scene/episode 的情绪值 (0-1, 0=低沉, 1=高潮) */
  curve: number[]
  /** 情绪变化率（一阶导数） */
  velocity: number[]
  /** 情绪加速度（二阶导数） */
  acceleration: number[]
  /** 峰值数（高潮点的个数） */
  peakCount: number
  /** 谷底数 */
  valleyCount: number
  /** 总能量（曲线的平方积分近似） */
  totalEnergy: number
  /** 波动度（标准差） */
  volatility: number
}

export interface EmotionalMatchResult {
  /** 曲线形状相似度 (0-1) */
  shapeSimilarity: number
  /** 情绪能量相似度 (0-1) */
  energySimilarity: number
  /** 节奏结构相似度 (0-1) */
  rhythmSimilarity: number
  /** 综合匹配度 (0-1) */
  overallMatch: number
  /** 是否发生情绪对齐失效 */
  affectiveDrift: boolean
  /** 漂移描述 */
  driftDescription?: string
}

// ============================================================
// Emotional Trajectory Extractor
// ============================================================

export class EmotionalTrajectoryExtractor {
  /**
   * 从导演系统输出中提取情绪轨迹
   * 支持多种数据格式：
   *   { scenes: [{ emotion, ... }] }
   *   { episodes: [{ emotionalIntensity, ... }] }
   *   { beats: [{ intensity, ... }] }
   *   { emotionCurve: number[] }
   *   或直接输出 number[] 原始曲线
   */
  extract(output: unknown): EmotionalTrajectory {
    const curve = this.parseCurve(output)
    const velocity = this.computeVelocity(curve)
    const acceleration = this.computeAcceleration(velocity)

    return {
      curve,
      velocity,
      acceleration,
      peakCount: this.countPeaks(curve),
      valleyCount: this.countValleys(curve),
      totalEnergy: this.computeTotalEnergy(curve),
      volatility: this.computeVolatility(curve),
    }
  }

  /**
   * 支持多种数据路径的通用解析
   */
  private parseCurve(output: unknown): number[] {
    if (!output || typeof output !== 'object') return [0.5] // 默认中性

    const root = output as Record<string, unknown>

    // 直接 emotionCurve 字段
    const directCurve = root.emotionCurve ?? root.emotionalCurve
    if (Array.isArray(directCurve) && directCurve.length > 0) {
      return directCurve.map(v => this.clamp(Number(v)))
    }

    // scenes arrays
    const scenes = root.scenes ?? root.episodes ?? root.beats
    if (Array.isArray(scenes) && scenes.length > 0) {
      const curve = scenes.map(s => {
        if (typeof s === 'number') return this.clamp(s)
        if (typeof s !== 'object' || !s) return 0.5
        const scene = s as Record<string, unknown>
        return this.clamp(
          Number(scene.emotion ?? scene.emotionalIntensity ?? scene.intensity ?? scene.energy ?? scene.tension ?? 0.5)
        )
      })
      if (curve.every(v => !isNaN(v))) return curve
    }

    // shots (deprecated but sometimes used)
    const shots = root.shots
    if (Array.isArray(shots) && shots.length > 0) {
      const curve = shots.map(s => {
        if (typeof s !== 'object' || !s) return 0.5
        return this.clamp(Number((s as Record<string, unknown>).emotion ?? 0.5))
      })
      if (curve.every(v => !isNaN(v))) return curve
    }

    return [0.5]
  }

  private computeVelocity(curve: number[]): number[] {
    if (curve.length <= 1) return [0]
    const velocity: number[] = []
    for (let i = 1; i < curve.length; i++) {
      velocity.push(curve[i] - curve[i - 1])
    }
    return velocity
  }

  private computeAcceleration(velocity: number[]): number[] {
    if (velocity.length <= 1) return [0]
    const acceleration: number[] = []
    for (let i = 1; i < velocity.length; i++) {
      acceleration.push(velocity[i] - velocity[i - 1])
    }
    return acceleration
  }

  private countPeaks(curve: number[]): number {
    let peaks = 0
    for (let i = 1; i < curve.length - 1; i++) {
      if (curve[i] > curve[i - 1] && curve[i] > curve[i + 1]) peaks++
    }
    return peaks
  }

  private countValleys(curve: number[]): number {
    let valleys = 0
    for (let i = 1; i < curve.length - 1; i++) {
      if (curve[i] < curve[i - 1] && curve[i] < curve[i + 1]) valleys++
    }
    return valleys
  }

  private computeTotalEnergy(curve: number[]): number {
    if (curve.length === 0) return 0
    return curve.reduce((sum, v) => sum + v * v, 0) / curve.length
  }

  private computeVolatility(curve: number[]): number {
    if (curve.length <= 1) return 0
    const mean = curve.reduce((s, v) => s + v, 0) / curve.length
    const variance = curve.reduce((s, v) => s + (v - mean) ** 2, 0) / curve.length
    return Math.sqrt(variance)
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(1, isNaN(v) ? 0.5 : v))
  }
}

// ============================================================
// Emotional Trajectory Matcher
// ============================================================

export class EmotionalTrajectoryMatcher {
  /**
   * 计算两个情绪轨迹的匹配度
   *
   * 三轴加权：
   *   shapeSimilarity  (0.5) — 曲线形态
   *   energySimilarity (0.25) — 能量水平
   *   rhythmSimilarity (0.25) — 节奏结构
   */
  match(v1: EmotionalTrajectory, v2: EmotionalTrajectory): EmotionalMatchResult {
    const shapeSimilarity = this.computeShapeSimilarity(v1, v2)
    const energySimilarity = 1 - Math.min(Math.abs(v1.totalEnergy - v2.totalEnergy) / 2, 1)
    const rhythmSimilarity = this.computeRhythmSimilarity(v1, v2)

    const overallMatch = shapeSimilarity * 0.5 + energySimilarity * 0.25 + rhythmSimilarity * 0.25

    const peaksDiff = Math.abs(v1.peakCount - v2.peakCount)
    const valleysDiff = Math.abs(v1.valleyCount - v2.valleyCount)
    const volatilityDiff = Math.abs(v1.volatility - v2.volatility)

    // 离散差异描述辅助
    const issues: string[] = []
    if (peaksDiff > 1) issues.push(`peak count mismatch (${v1.peakCount}→${v2.peakCount})`)
    if (valleysDiff > 1) issues.push(`valley count mismatch (${v1.valleyCount}→${v2.valleyCount})`)
    if (volatilityDiff > 0.2) issues.push(`volatility drift (${v1.volatility.toFixed(2)}→${v2.volatility.toFixed(2)})`)

    return {
      shapeSimilarity,
      energySimilarity,
      rhythmSimilarity,
      overallMatch,
      affectiveDrift: overallMatch < 0.8 || peaksDiff > 2,
      driftDescription: issues.length > 0 ? issues.join('; ') : undefined,
    }
  }

  /**
   * 曲线形态相似度：
   *   - 使用标准化互相关 (normalized cross-correlation at lag 0)
   *   - 补偿长度差异（对齐短曲线）
   */
  private computeShapeSimilarity(v1: EmotionalTrajectory, v2: EmotionalTrajectory): number {
    const c1 = v1.curve
    const c2 = v2.curve

    if (c1.length === 0 && c2.length === 0) return 1
    if (c1.length === 0 || c2.length === 0) return 0

    // 对齐到同一长度
    const maxLen = Math.max(c1.length, c2.length)
    const aligned1 = this.alignLength(c1, maxLen)
    const aligned2 = this.alignLength(c2, maxLen)

    // 归一化
    const mean1 = aligned1.reduce((s, v) => s + v, 0) / aligned1.length
    const mean2 = aligned2.reduce((s, v) => s + v, 0) / aligned2.length

    const norm1 = aligned1.map(v => v - mean1)
    const norm2 = aligned2.map(v => v - mean2)

    const numerator = norm1.reduce((s, v, i) => s + v * norm2[i], 0)
    const denom1 = Math.sqrt(norm1.reduce((s, v) => s + v * v, 0))
    const denom2 = Math.sqrt(norm2.reduce((s, v) => s + v * v, 0))

    if (denom1 === 0 && denom2 === 0) return 1
    if (denom1 === 0 || denom2 === 0) return 0

    // 归一化到 [0, 1]
    return Math.max(0, (numerator / (denom1 * denom2) + 1) / 2)
  }

  /**
   * 节奏相似度：基于速度曲线的相似度
   * 导演节奏 = 情绪变化的剧烈程度
   */
  private computeRhythmSimilarity(v1: EmotionalTrajectory, v2: EmotionalTrajectory): number {
    const vel1 = v1.velocity
    const vel2 = v2.velocity

    if (vel1.length === 0 && vel2.length === 0) return 1
    if (vel1.length === 0 || vel2.length === 0) return 0

    const maxLen = Math.max(vel1.length, vel2.length)
    const a1 = this.alignLength(vel1, maxLen)
    const a2 = this.alignLength(vel2, maxLen)

    let totalDiff = 0
    for (let i = 0; i < maxLen; i++) {
      totalDiff += Math.abs(Math.sign(a1[i]) - Math.sign(a2[i]))
    }

    // 方向一致度
    return 1 - totalDiff / (maxLen * 2)
  }

  /**
   * 将曲线对齐到目标长度（使用线性插值）
   */
  private alignLength(curve: number[], targetLen: number): number[] {
    if (curve.length === targetLen) return [...curve]
    if (curve.length === 0) return new Array(targetLen).fill(0.5)

    const result: number[] = []
    for (let i = 0; i < targetLen; i++) {
      const pos = (i / (targetLen - 1)) * (curve.length - 1)
      const idx = Math.floor(pos)
      const frac = pos - idx

      if (idx >= curve.length - 1) {
        result.push(curve[curve.length - 1])
      } else {
        result.push(curve[idx] * (1 - frac) + curve[idx + 1] * frac)
      }
    }
    return result
  }
}

// ============================================================
// Style Drift Detector
// ============================================================

export interface StyleDriftReport {
  /** 是否检测到 style collapse */
  collapseDetected: boolean
  /** style 变异性（过低 = collapse） */
  volatilityRatio: number
  /** shot diversity change */
  shotDiversityDelta: number
  /** prompt entropy change */
  promptEntropyDelta: number
  /** 详细描述 */
  detail: string
}

export class StyleDriftDetector {
  /**
   * 检测 v1 → v2 之间是否发生"隐式风格收敛"
   *
   * 原理：如果 v2 的 volatility / diversity / entropy 同时下降而 BSI 不变
   * 则可能发生 style collapse
   */
  detectStyleCollapse(
    v1Outputs: unknown[],
    v2Outputs: unknown[],
  ): StyleDriftReport {
    const v1Vol = this.computeOutputVolatility(v1Outputs)
    const v2Vol = this.computeOutputVolatility(v2Outputs)

    const v1Diversity = this.computeShotDiversity(v1Outputs)
    const v2Diversity = this.computeShotDiversity(v2Outputs)

    const v1Entropy = this.computePromptEntropy(v1Outputs)
    const v2Entropy = this.computePromptEntropy(v2Outputs)

    const volatilityRatio = v1Vol > 0 ? v2Vol / v1Vol : 1
    const shotDiversityDelta = v2Diversity - v1Diversity
    const promptEntropyDelta = v2Entropy - v1Entropy

    // 三重同时降低 = collapse 信号
    const volCollapse = volatilityRatio < 0.7
    const divCollapse = shotDiversityDelta < -0.15
    const entCollapse = promptEntropyDelta < -0.15

    const collapseDetected = volCollapse && (divCollapse || entCollapse)

    let detail: string
    if (collapseDetected) {
      detail = `STYLE COLLAPSE: volatility ${(volatilityRatio * 100).toFixed(0)}% of baseline`
      if (divCollapse) detail += `, shot diversity down ${(Math.abs(shotDiversityDelta) * 100).toFixed(0)}%`
      if (entCollapse) detail += `, prompt entropy down ${(Math.abs(promptEntropyDelta) * 100).toFixed(0)}%`
    } else {
      detail = 'No style collapse detected'
    }

    return {
      collapseDetected,
      volatilityRatio,
      shotDiversityDelta,
      promptEntropyDelta,
      detail,
    }
  }

  private computeOutputVolatility(outputs: unknown[]): number {
    if (outputs.length < 2) return 0
    const extractor = new EmotionalTrajectoryExtractor()
    const energies = outputs.map(o => extractor.extract(o).totalEnergy)
    const mean = energies.reduce((s, v) => s + v, 0) / energies.length
    const variance = energies.reduce((s, v) => s + (v - mean) ** 2, 0) / energies.length
    return Math.sqrt(variance)
  }

  private computeShotDiversity(outputs: unknown[]): number {
    if (outputs.length === 0) return 0
    let totalCameraTypes = 0
    let count = 0

    for (const output of outputs) {
      if (!output || typeof output !== 'object') continue
      const root = output as Record<string, unknown>
      const shots = root.shots
      if (!Array.isArray(shots) || shots.length === 0) continue

      const cameraTypes = new Set<string>()
      for (const shot of shots) {
        if (typeof shot !== 'object' || !shot) continue
        const cam = (shot as Record<string, unknown>).camera ?? (shot as Record<string, unknown>).cameraAngle
        if (typeof cam === 'string') cameraTypes.add(cam)
      }
      totalCameraTypes += cameraTypes.size
      count++
    }

    return count > 0 ? totalCameraTypes / count : 0
  }

  /**
   * 基于输出结构的 prompt 熵估计
   * 输出字段越丰富 → entropy 越高
   */
  private computePromptEntropy(outputs: unknown[]): number {
    if (outputs.length === 0) return 0

    let totalFields = 0
    let count = 0

    for (const output of outputs) {
      if (!output || typeof output !== 'object') continue
      const keys = Object.keys(output as Record<string, unknown>)
      totalFields += keys.length
      count++
    }

    return count > 0 ? totalFields / count / 20 : 0 // normalize to approx 0-1
  }
}
