/**
 * freedom-index.ts — Director System Creative Freedom / Entropy Budget
 *
 * 与 BSI 形成对偶：BSI 测稳定性，FreedomIndex 测创造力空间是否在缩水。
 *
 * 核心直觉：
 *   系统不是越稳定越好，也不是越多样越好。
 *   关键是 Stability × Freedom 的双轴区域——"可信任的创作空间"。
 *
 * 三个指标：
 *   1. Style Diversity — shot/emotion/camera 的分布范围
 *   2. Entropy Budget  — prompt/输出结构的熵下限
 *   3. Creative Drift  — 风格是否有意义地探索还是死循环
 */

// ============================================================
// Types
// ============================================================

export interface FreedomIndexReport {
  /** 综合自由度 (0-1), 越高越有创造力空间 */
  freedomIndex: number
  /** 风格多样性 (0-1) */
  styleDiversity: number
  /** 熵预算使用率 (0-1), 越高表示输出越多样化 */
  entropyUsage: number
  /** 创作漂移健康度 (0-1), 越高表示探索有意义 */
  creativeDriftHealth: number
  /** 警告 */
  warnings: FreedomWarning[]
  /** 是否处于健康范围 */
  healthy: boolean
}

export interface FreedomWarning {
  type: 'diversity_collapse' | 'entropy_depletion' | 'creative_stagnation' | 'chaotic_drift'
  severity: 'info' | 'warning' | 'critical'
  message: string
  detail: string
}

/** 相图区域 */
export type StabilityFreedomPhase =
  | 'creative_stable'     // BSI高 + Freedom高 = 理想区
  | 'stable_but_stagnant' // BSI高 + Freedom低 = 过拟合
  | 'creative_but_risky'  // BSI低 + Freedom高 = 混沌区
  | 'unstable_degenerate' // BSI低 + Freedom低 = 系统崩溃

// ============================================================
// Freedom Index Engine
// ============================================================

export class FreedomIndexEngine {
  /**
   * 计算系统的创造力自由度
   * 需要 N 个输出样本（N >= 10 才有统计意义）
   */
  compute(recentOutputs: unknown[]): FreedomIndexReport {
    const warnings: FreedomWarning[] = []

    // 1. Style Diversity
    const styleDiversity = this.computeStyleDiversity(recentOutputs)
    if (styleDiversity < 0.3) {
      warnings.push({
        type: 'diversity_collapse',
        severity: 'critical',
        message: '风格多样性严重不足',
        detail: `Style diversity ${styleDiversity.toFixed(2)} < 0.3，输出趋向单一化`,
      })
    } else if (styleDiversity < 0.5) {
      warnings.push({
        type: 'diversity_collapse',
        severity: 'warning',
        message: '风格多样性偏低',
        detail: `Style diversity ${styleDiversity.toFixed(2)} < 0.5，注意收敛趋势`,
      })
    }

    // 2. Entropy Budget
    const entropyUsage = this.computeEntropyUsage(recentOutputs)
    if (entropyUsage < 0.2) {
      warnings.push({
        type: 'entropy_depletion',
        severity: 'critical',
        message: '熵预算几乎耗尽，输出结构高度一致',
        detail: `Entropy usage ${entropyUsage.toFixed(2)} < 0.2`,
      })
    } else if (entropyUsage < 0.4) {
      warnings.push({
        type: 'entropy_depletion',
        severity: 'warning',
        message: '熵预算偏低',
        detail: `Entropy usage ${entropyUsage.toFixed(2)} < 0.4`,
      })
    }

    // 3. Creative Drift
    const creativeDriftHealth = this.computeCreativeDriftHealth(recentOutputs)
    if (creativeDriftHealth < 0.3) {
      warnings.push({
        type: 'creative_stagnation',
        severity: 'warning',
        message: '创作漂移停滞，风格探索近乎为零',
        detail: `Creative drift health ${creativeDriftHealth.toFixed(2)} < 0.3`,
      })
    }
    if (creativeDriftHealth > 0.9) {
      warnings.push({
        type: 'chaotic_drift',
        severity: 'info',
        message: '创作漂移较高，需确认是有意义探索还是随机波动',
        detail: `Creative drift health ${creativeDriftHealth.toFixed(2)} > 0.9`,
      })
    }

    // 综合自由度
    const freedomIndex = styleDiversity * 0.35 + entropyUsage * 0.35 + creativeDriftHealth * 0.3

    return {
      freedomIndex,
      styleDiversity,
      entropyUsage,
      creativeDriftHealth,
      warnings,
      healthy: freedomIndex >= 0.5 && warnings.filter(w => w.severity === 'critical').length === 0,
    }
  }

  /**
   * 判断当前 State-Freedom 双轴相图区域
   */
  classifyPhase(bsi: number, freedomIndex: number): StabilityFreedomPhase {
    if (bsi >= 0.85 && freedomIndex >= 0.5) return 'creative_stable'
    if (bsi >= 0.85 && freedomIndex < 0.5) return 'stable_but_stagnant'
    if (bsi < 0.85 && freedomIndex >= 0.5) return 'creative_but_risky'
    return 'unstable_degenerate'
  }

  // ============================================================
  // Measurement Methods
  // ============================================================

  /**
   * 风格多样性：基于输出中 camera types 和 emotion 值的分布广度
   */
  private computeStyleDiversity(outputs: unknown[]): number {
    if (outputs.length < 2) return 0.5 // 数据不足，默认中性

    // Camera type diversity
    const allCameraTypes = new Set<string>()
    let totalShots = 0
    const allEmotions: number[] = []

    for (const output of outputs) {
      if (!output || typeof output !== 'object') continue
      const root = output as Record<string, unknown>
      const shots = root.shots as unknown[]
      if (Array.isArray(shots)) {
        totalShots += shots.length
        for (const shot of shots) {
          if (typeof shot !== 'object' || !shot) continue
          const cam = String((shot as Record<string, unknown>).camera ?? (shot as Record<string, unknown>).cameraAngle ?? '')
          if (cam && cam !== 'undefined') allCameraTypes.add(cam)
        }
      }

      // emotions from scenes
      const scenes = root.scenes as unknown[]
      if (Array.isArray(scenes)) {
        for (const scene of scenes) {
          if (typeof scene !== 'object' || !scene) continue
          const e = Number((scene as Record<string, unknown>).emotion ?? NaN)
          if (!isNaN(e)) allEmotions.push(e)
        }
      }
    }

    // 多样性 = camera 类型丰富度 × emotion 分布广度
    const cameraRichness = totalShots > 0 ? allCameraTypes.size / Math.min(totalShots, 10) : 0

    const emotionRichness = allEmotions.length > 2
      ? this.computeVolatility(allEmotions) // 情绪波动越大 = 越多样
      : 0.5

    return Math.min(1, cameraRichness * 0.5 + emotionRichness * 0.5)
  }

  /**
   * 熵预算使用率：基于输出结构中的唯一字段/值组合
   * 如果所有输出都长一个样，熵接近 0
   */
  private computeEntropyUsage(outputs: unknown[]): number {
    if (outputs.length < 2) return 0.5

    // 比较各输出的 shot count、camera 分布、emotion 范围的差异度
    const shotCounts: number[] = []
    const cameraCounts: number[] = []
    const emotionMeans: number[] = []
    let totalUniqueCameras = 0
    let totalOutputsWithCam = 0

    for (const output of outputs) {
      if (!output || typeof output !== 'object') continue
      const root = output as Record<string, unknown>

      const shots = root.shots as unknown[]
      if (Array.isArray(shots)) {
        shotCounts.push(shots.length)
        const cams = new Set(shots.map(s => {
          if (typeof s !== 'object' || !s) return ''
          return String((s as Record<string, unknown>).camera ?? '')
        }).filter(Boolean))
        cameraCounts.push(cams.size)
        totalUniqueCameras += cams.size
        totalOutputsWithCam++
      }

      const scenes = root.scenes as unknown[]
      if (Array.isArray(scenes) && scenes.length > 0) {
        const emotions = scenes.map(s => {
          if (typeof s !== 'object' || !s) return NaN
          return Number((s as Record<string, unknown>).emotion ?? NaN)
        }).filter(e => !isNaN(e))
        if (emotions.length > 0) {
          emotionMeans.push(emotions.reduce((s, e) => s + e, 0) / emotions.length)
        }
      }
    }

    // 各维度的变异系数 (CV) = std / mean
    const shotCV = this.coefficientOfVariation(shotCounts)
    const cameraCV = this.coefficientOfVariation(cameraCounts)
    const emotionCV = this.coefficientOfVariation(emotionMeans)

    // 整体相机多样性（跨所有输出）
    const cameraRichness = totalOutputsWithCam > 0
      ? Math.min(1, totalUniqueCameras / (totalOutputsWithCam * 2))
      : 0

    // CV 越高 → 输出之间越多样 → 熵使用率越高
    // cameraRichness 补充了 CV 的盲区（相同 count 但不同 camera）
    return Math.min(1, (shotCV + cameraCV + emotionCV) / 3 * 1.5 + cameraRichness * 0.3)
  }

  /**
   * 创作漂移健康度：跟踪输出风格随时间的变化是否"有意义"
   * 不是随机波动（noise），而是有方向的变化（signal）
   */
  private computeCreativeDriftHealth(outputs: unknown[]): number {
    if (outputs.length < 4) return 0.5 // 需要至少 4 个样本才能看趋势

    // 按时间顺序看 camera 分布的变化
    const cameraProportions: Record<string, number[]> = {}

    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]
      if (!output || typeof output !== 'object') continue
      const root = output as Record<string, unknown>
      const shots = root.shots as unknown[]

      if (!Array.isArray(shots) || shots.length === 0) continue

      const camCount: Record<string, number> = {}
      for (const shot of shots) {
        if (typeof shot !== 'object' || !shot) continue
        const cam = String((shot as Record<string, unknown>).camera ?? '')
        if (cam && cam !== 'undefined') {
          camCount[cam] = (camCount[cam] ?? 0) + 1
        }
      }

      for (const [cam, count] of Object.entries(camCount)) {
        if (!cameraProportions[cam]) cameraProportions[cam] = []
        cameraProportions[cam].push(count / shots.length)
      }
    }

    if (Object.keys(cameraProportions).length === 0) return 0.5

    // 计算每种 camera 的 proportion 随时间的变化趋势
    // 如果有 directional change（单调增减）= 有意义的探索
    // 如果纯随机波动 = 噪声
    let directionalDriftCount = 0
    let totalSeries = 0

    for (const [, proportions] of Object.entries(cameraProportions)) {
      if (proportions.length < 3) continue
      totalSeries++

      // 检查是否单调趋势（方向一致变化）
      let increases = 0
      let decreases = 0
      for (let i = 1; i < proportions.length; i++) {
        if (proportions[i] > proportions[i - 1]) increases++
        else if (proportions[i] < proportions[i - 1]) decreases++
      }

      const dominant = Math.max(increases, decreases)
      const total = increases + decreases
      const trendStrength = total > 0 ? dominant / total : 0

      // 趋势强度 > 0.7 = 有方向性的探索
      if (trendStrength > 0.7 && dominant >= 2) directionalDriftCount++
    }

    return totalSeries > 0 ? Math.min(1, directionalDriftCount / totalSeries) : 0.5
  }

  // ============================================================
  // Utilities
  // ============================================================

  private computeVolatility(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
  }

  private coefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    if (mean === 0) return 0
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance) / mean
  }
}

// ============================================================
// Decision Gate — BSI × Freedom 双轴切换决策
// ============================================================

export interface SwitchDecision {
  allow: boolean
  phase: StabilityFreedomPhase
  bsi: number
  freedomIndex: number
  reasons: string[]
}

export class SwitchGate {
  private freedomEngine = new FreedomIndexEngine()

  /**
   * 基于 BSI + FreedomIndex 双轴做 switch 决策
   *
   * 规则：
   *   creative_stable      → ✅ ALLOW
   *   stable_but_stagnant  → ⚠️ 只允许带 entropy floor guard
   *   creative_but_risky   → ⚠️ 只允许带 stability guard
   *   unstable_degenerate  → ❌ REJECT
   */
  decide(
    bsi: number,
    recentOutputs: unknown[],
  ): SwitchDecision {
    const freedomReport = this.freedomEngine.compute(recentOutputs)
    const phase = this.freedomEngine.classifyPhase(bsi, freedomReport.freedomIndex)
    const reasons: string[] = []

    let allow = false

    switch (phase) {
      case 'creative_stable':
        allow = true
        reasons.push(`BSI ${bsi.toFixed(2)} ≥ 0.85, Freedom ${freedomReport.freedomIndex.toFixed(2)} ≥ 0.5 — 理想相区`)
        break
      case 'stable_but_stagnant':
        allow = true
        reasons.push(`BSI ${bsi.toFixed(2)} ≥ 0.85 但 Freedom ${freedomReport.freedomIndex.toFixed(2)} < 0.5 — 允许切换，需设置 entropy floor`)
        freedomReport.warnings.forEach(w => reasons.push(`  ⚠ ${w.message}`))
        break
      case 'creative_but_risky':
        allow = bsi >= 0.7 // 允许一定风险
        reasons.push(`BSI ${bsi.toFixed(2)} < 0.85, Freedom ${freedomReport.freedomIndex.toFixed(2)} ≥ 0.5 — 需 stability guard`)
        break
      case 'unstable_degenerate':
        allow = false
        reasons.push(`BSI ${bsi.toFixed(2)} < 0.85 AND Freedom ${freedomReport.freedomIndex.toFixed(2)} < 0.5 — 拒绝切换`)
        break
    }

    return { allow, phase, bsi, freedomIndex: freedomReport.freedomIndex, reasons }
  }
}
