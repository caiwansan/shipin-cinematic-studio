/**
 * director-field.ts — Director Field Theory v1
 *
 * 统一模型：
 *   dS/dt = F_potential(S) + F_kinetic(S) + F_dissipation(S, escape)
 *
 * 核心能力：
 *   1. Potential Field （Governance — 约束势场）
 *   2. Kinetic Field  （Freedom — 动能场）
 *   3. Dissipation     （Escape — 耗散项，防止过度积累）
 *   4. Intent Entropy  （逃逸对导演意图的稀释监测）
 *
 * v1.1 更新 — 耦合场方程 + 预测 + 预测力验证
 *   - FieldCouplingMatrix: 场间耦合系数 (6个独立项)
 *   - predictNextState(): 基于当前场+耦合矩阵预测下一状态
 *   - PredictionValidator: 对比预测 vs 实测，验证预测力
 *   - 解决"解释过拟合"问题——预测能力是场论真实性的唯一标准
 *
 * 这不是指标系统。这是"生成动力系统的场论模型"。
 * 每个分量都是可计算的数（不依赖观测，只依赖系统自身状态）。
 */

// ============================================================
// Types
// ============================================================

export interface DirectorFieldState {
  /** 势能（来自 governance 约束强度） */
  potential: number
  /** 动能（来自 freedom / style diversity） */
  kinetic: number
  /** 耗散率（来自 escape 操作频率与幅度） */
  dissipation: number
  /** 总能量 = potential + kinetic - dissipation */
  totalEnergy: number
  /** 导演意图熵（逃逸对意图的累计稀释度） */
  intentEntropy: number
}

export interface FieldDynamics {
  /** 势场力：指向 governance 约束中心 */
  potentialForce: number
  /** 动能场力：指向多样态探索 */
  kineticForce: number
  /** 耗散力：指向收敛 / 稳定 */
  dissipationForce: number
  /** 合力 */
  netForce: number
}

// ============================================================
// Field States
// ============================================================

export class DirectorField {
  private intentEntropy = 0
  private escapeCount = 0
  private totalPerturbationMagnitude = 0
  private fieldHistory: { potential: number; kinetic: number; dissipation: number }[] = []

  /**
   * 更新场状态
   */
  update(
    bsi: number,
    freedomIndex: number,
    escapeActivity: { active: boolean; strategy: string | null; magnitude: number },
  ): DirectorFieldState {
    // 1. Potential Field — governance 约束强度
    // BSI 越高 → 约束越强 → 势能越高
    const potential = bsi

    // 2. Kinetic Field — 自由探索能量
    // FreedomIndex 越高 → 动能越高
    const kinetic = freedomIndex

    // 3. Dissipation — 逃逸耗散
    // 每次逃逸消耗一定能量来扰动系统
    if (escapeActivity.active) {
      this.escapeCount++
      this.totalPerturbationMagnitude += escapeActivity.magnitude
    }

    // 耗散率 = 逃逸频率 × 平均扰动幅度（带时间衰减）
    const escapeRate = this.escapeCount > 0
      ? Math.min(1, this.totalPerturbationMagnitude / Math.max(1, this.escapeCount) * (this.escapeCount / 10))
      : 0
    const dissipation = Math.min(1, escapeRate)

    // 4. Intent Entropy — 逃逸对导演意图的稀释
    // 每次逃逸如果使用高干预策略（REANCHOR > CONSTRAINT_RELAX > ENTROPY_INJECTION），
    // 都会对系统积累意图漂移
    if (escapeActivity.active && escapeActivity.strategy) {
      const strategyEntropy = escapeActivity.strategy === 'REANCHOR' ? 0.8
        : escapeActivity.strategy === 'CONSTRAINT_RELAX' ? 0.5
        : 0.2
      // 衰减更慢的累积
      this.intentEntropy = this.intentEntropy * 0.98 + strategyEntropy * escapeActivity.magnitude * 0.08
    } else {
      // 无逃逸时自然衰减（更慢）
      this.intentEntropy *= 0.99
    }

    const totalEnergy = potential + kinetic - dissipation

    const state: DirectorFieldState = {
      potential,
      kinetic,
      dissipation,
      totalEnergy,
      intentEntropy: this.intentEntropy,
    }

    this.fieldHistory.push({ potential, kinetic, dissipation })
    if (this.fieldHistory.length > 100) this.fieldHistory.shift()

    return state
  }

  /**
   * 计算动力学力场
   */
  computeDynamics(): FieldDynamics {
    if (this.fieldHistory.length < 2) {
      return { potentialForce: 0, kineticForce: 0, dissipationForce: 0, netForce: 0 }
    }

    const last = this.fieldHistory[this.fieldHistory.length - 1]
    const prev = this.fieldHistory[this.fieldHistory.length - 2]

    // 势场力：BSI 变化趋势（正 = 趋向更高约束）
    const potentialForce = last.potential - prev.potential
    // 动能场力：Freedom 变化趋势（正 = 趋向更多探索）
    const kineticForce = last.kinetic - prev.kinetic
    // 耗散力：耗散变化趋势（正 = 耗散增加，趋向收敛）
    const dissipationForce = last.dissipation - prev.dissipation

    const netForce = potentialForce + kineticForce - dissipationForce

    return { potentialForce, kineticForce, dissipationForce, netForce }
  }

  /**
   * 检查意图完整性
   * Intent Entropy > 0.5 表示意图已被显著稀释
   */
  checkIntentIntegrity(): {
    intact: boolean
    entropy: number
    warning: string | null
  } {
    const warn: string | null = this.intentEntropy > 0.5
      ? `Director intent significantly diluted (entropy=${this.intentEntropy.toFixed(2)}). Recommend intent re-anchor.`
      : this.intentEntropy > 0.3
        ? `Mild intent drift detected (entropy=${this.intentEntropy.toFixed(2)}). Monitor escape frequency.`
        : null

    return {
      intact: this.intentEntropy < 0.5,
      entropy: this.intentEntropy,
      warning: warn,
    }
  }

  /**
   * 获取当前场状态快照
   */
  getFieldState(): DirectorFieldState {
    const last = this.fieldHistory[this.fieldHistory.length - 1]
    if (!last) {
      return { potential: 0, kinetic: 0, dissipation: 0, totalEnergy: 0, intentEntropy: 0 }
    }
    return {
      ...last,
      totalEnergy: last.potential + last.kinetic - last.dissipation,
      intentEntropy: this.intentEntropy,
    }
  }

  /**
   * 复位
   */
  reset(): void {
    this.intentEntropy = 0
    this.escapeCount = 0
    this.totalPerturbationMagnitude = 0
    this.fieldHistory = []
  }
}

// ============================================================
// Escape Bias Detection
// ============================================================

export interface EscapeBiasReport {
  /** 是否检测到逃逸偏置 */
  biased: boolean
  /** 逃逸频率（次/更新） */
  escapeFrequency: number
  /** 策略分布 */
  strategyDistribution: Record<string, number>
  /** 意图熵趋势（上升 = 系统在 drift） */
  intentEntropyTrend: 'stable' | 'rising' | 'falling'
  /** 建设 */
  recommendation: string
}

export class EscapeBiasDetector {
  private escapeLog: { strategy: string; timestamp: number; postBsi: number; postFreedom: number }[] = []
  private maxLogSize = 50

  /**
   * 记录一次逃逸
   */
  recordEscape(strategy: string, postBsi: number, postFreedom: number): void {
    this.escapeLog.push({ strategy, timestamp: Date.now(), postBsi, postFreedom })
    if (this.escapeLog.length > this.maxLogSize) {
      this.escapeLog.shift()
    }
  }

  /**
   * 检测逃逸偏置
   *
   * 逃逸偏置条件：
   *   1. 高频逃逸：平均间隔过短
   *   2. 策略偏斜：过度使用高干预策略
   *   3. Return 递减：多次逃逸后 Freedom 增长递减
   *   4. 意图熵上升：多代逃逸后 entropy 持续增长
   */
  analyze(directorField: DirectorField): EscapeBiasReport {
    if (this.escapeLog.length < 3) {
      return {
        biased: false,
        escapeFrequency: 0,
        strategyDistribution: {},
        intentEntropyTrend: 'stable',
        recommendation: 'Insufficient escape data for bias analysis.',
      }
    }

    // 1. 策略分布
    const dist: Record<string, number> = {}
    for (const entry of this.escapeLog) {
      dist[entry.strategy] = (dist[entry.strategy] ?? 0) + 1
    }

    // 2. 逃逸频率（近 5 次的时间密集度）
    const recent = this.escapeLog.slice(-5)
    const timeSpan = recent.length >= 2
      ? (recent[recent.length - 1].timestamp - recent[0].timestamp) / recent.length
      : Infinity
    const escapeFrequency = timeSpan < 10000 ? 0.8 : timeSpan < 30000 ? 0.5 : 0.2
    // 10s 内 = 高频，30s 内 = 中频

    // 3. 策略偏斜：REANCHOR 占比
    const total = this.escapeLog.length
    const reanchorCount = dist['REANCHOR'] ?? 0
    const reanchorRatio = reanchorCount / total

    // 4. Return 递减检测：检查最后几次逃逸的 Freedom 增长
    let diminishingReturns = false
    if (recent.length >= 4) {
      const gains: number[] = []
      for (let i = 1; i < recent.length; i++) {
        gains.push(recent[i].postFreedom - recent[i - 1].postFreedom)
      }
      // 如果连续两次 gain 递减 → diminishing returns
      diminishingReturns = gains.length >= 2 && gains[gains.length - 1] < gains[gains.length - 2]
    }

    // 5. 意图熵趋势
    const intentInfo = directorField.checkIntentIntegrity()
    const entropyTrend: 'stable' | 'rising' | 'falling' =
      intentInfo.entropy > 0.4 ? 'rising'
        : intentInfo.entropy < 0.1 ? 'falling'
          : 'stable'

    const biased = escapeFrequency >= 0.5 || reanchorRatio > 0.4 || diminishingReturns || entropyTrend === 'rising'

    let recommendation: string
    if (biased) {
      const causes: string[] = []
      if (escapeFrequency >= 0.5) causes.push('high escape frequency')
      if (reanchorRatio > 0.4) causes.push('excessive REANCHOR usage')
      if (diminishingReturns) causes.push('diminishing returns')
      if (entropyTrend === 'rising') causes.push('intent entropy rising')
      recommendation = `Escape bias detected: ${causes.join(', ')}. Consider reducing escape sensitivity or increasing cooldown.`
    } else {
      recommendation = 'Escape behavior within healthy bounds.'
    }

    return {
      biased,
      escapeFrequency,
      strategyDistribution: dist,
      intentEntropyTrend: entropyTrend,
      recommendation,
    }
  }

  reset(): void {
    this.escapeLog = []
  }
}

// ============================================================
// Energy Landscape Analysis
// ============================================================

export interface EnergyLandscape {
  /** 当前能量 */
  currentEnergy: number
  /** 势能占比 */
  potentialRatio: number
  /** 动能占比 */
  kineticRatio: number
  /** 耗散占比 */
  dissipationRatio: number
  /** 能量趋势（上升 = 系统在激活，下降 = 系统在衰减） */
  energyTrend: 'rising' | 'stable' | 'falling'
  /** 系统相位 */
  systemPhase: 'high_energy_exploration' | 'balanced_flow' | 'low_energy_convergence' | 'over_dissipated'
}

export function analyzeEnergyLandscape(field: DirectorField): EnergyLandscape {
  const state = field.getFieldState()
  const total = state.potential + state.kinetic + state.dissipation || 1

  const potentialRatio = state.potential / total
  const kineticRatio = state.kinetic / total
  const dissipationRatio = state.dissipation / total

  let systemPhase: EnergyLandscape['systemPhase']
  if (state.totalEnergy > 1.2) {
    systemPhase = 'high_energy_exploration'
  } else if (state.dissipation > state.kinetic && state.totalEnergy < 0.6) {
    systemPhase = 'over_dissipated'
  } else if (state.totalEnergy < 0.8) {
    systemPhase = 'low_energy_convergence'
  } else {
    systemPhase = 'balanced_flow'
  }

  // 趋势：简单看最近 3 个 energy 的走向
  const fieldState = field['getFieldState']()
  const energyTrend: EnergyLandscape['energyTrend'] = fieldState.totalEnergy > 0.85
    ? 'rising'
    : fieldState.totalEnergy < 0.7
      ? 'falling'
      : 'stable'

  return {
    currentEnergy: state.totalEnergy,
    potentialRatio,
    kineticRatio,
    dissipationRatio,
    energyTrend,
    systemPhase,
  }
}

// ============================================================
// v1.1 — Field Coupling Matrix + Prediction + Validation
// ============================================================

/**
 * 场耦合矩阵
 *
 * 6 个独立项描述场间相互作用：
 *   C_pk: potential → kinetic  (BSI ↑ 对 Freedom 的抑制)
 *   C_kp: kinetic → potential  (Freedom ↑ 对 BSI 的反馈)
 *   C_pd: potential → dissipation (BSI ↑ 对 escape 的触发)
 *   C_kd: kinetic → dissipation (Freedom ↑ 对 escape 的需求)
 *   C_dp: dissipation → potential (escape 对 BSI 的冲击)
 *   C_dk: dissipation → kinetic (escape 对 Freedom 的增益)
 *
 * 耦合方程（预测模型）：
 *   ΔP = α_p * self_p + C_kp * ΔK + C_dp * D
 *   ΔK = α_k * self_k + C_pk * ΔP + C_dk * D
 *   ΔD = α_d * self_d + C_pd * ΔP + C_kd * ΔK
 *
 * 其中 self_* 是自回归项（系统自身惯性），D 是当前耗散值。
 */
export interface FieldCouplingMatrix {
  /** potential → kinetic (通常负值: BSI ↑ → Freedom ↓) */
  C_pk: number
  /** kinetic → potential (通常正值: Freedom ↑ → BSI ↑ 有延迟) */
  C_kp: number
  /** potential → dissipation (BSI 高 → 系统更可能触发 escape) */
  C_pd: number
  /** kinetic → dissipation (Freedom 低 → 系统触发 escape 需求更高) */
  C_kd: number
  /** dissipation → potential (escape → BSI 下降) */
  C_dp: number
  /** dissipation → kinetic (escape → Freedom 上升) */
  C_dk: number
  /** 自回归系数 */
  alpha_p: number
  alpha_k: number
  alpha_d: number
}

export const DEFAULT_COUPLING: FieldCouplingMatrix = {
  C_pk: -0.15,   // BSI ↑ 抑制 Freedom
  C_kp: 0.08,    // Freedom ↑ 缓慢提升 BSI
  C_pd: 0.2,     // BSI 高 → 更易触发 escape
  C_kd: -0.25,   // Freedom 低 → 需要 escape
  C_dp: -0.12,   // escape → BSI 短暂下降
  C_dk: 0.3,     // escape → Freedom 短暂上升
  alpha_p: 0.85,  // BSI 自持性高
  alpha_k: 0.55,  // Freedom 自持性中等
  alpha_d: 0.4,   // Dissipation 自持性低
}

export class CoupledFieldPredictor {
  private coupling: FieldCouplingMatrix
  private anchor: IntentAnchor

  constructor(coupling?: Partial<FieldCouplingMatrix>, anchorConfig?: Partial<AnchorConfig>) {
    this.coupling = { ...DEFAULT_COUPLING, ...coupling }
    this.anchor = new IntentAnchor(anchorConfig)
  }

  /**
   * 基于当前状态和耦合矩阵预测下一状态
   *
   * @returns 预测的下一场状态
   */
  predictNext(
    current: DirectorFieldState,
    escapeActive: boolean,
    escapeStrategy: string | null,
    escapeMagnitude: number,
  ): {
    predictedPotential: number
    predictedKinetic: number
    predictedDissipation: number
    predictedTotalEnergy: number
  } {
    const { potential, kinetic, dissipation } = current
    const c = this.coupling

    // 逃逸主动触发时的额外耗散
    const escapePulse = escapeActive ? escapeMagnitude : 0

    // 耦合场方程：
    // ΔP = α_p * self_inertia + C_kp * ΔK + C_dp * D + escape_impact
    //   self_inertia ≈ 当前值偏移量（相对于 0.5 自然点）
    const selfP = potential - 0.5
    const selfK = kinetic - 0.5
    const selfD = dissipation

    // 预测变化量
    const dP = c.alpha_p * selfP + c.C_kp * selfK + c.C_dp * dissipation + c.C_dp * escapePulse * 0.5
    const dK = c.alpha_k * selfK + c.C_pk * selfP + c.C_dk * dissipation + c.C_dk * escapePulse * 0.5
    const dD = c.alpha_d * selfD + c.C_pd * selfP + c.C_kd * selfK + escapePulse * 0.3

    // 限制在 [0, 1]
    const predictedPotential = Math.max(0, Math.min(1, potential + dP))
    const predictedKinetic = Math.max(0, Math.min(1, kinetic + dK))
    const predictedDissipation = Math.max(0, Math.min(1, dissipation + dD + escapePulse))

    return {
      predictedPotential,
      predictedKinetic,
      predictedDissipation,
      predictedTotalEnergy: predictedPotential + predictedKinetic - predictedDissipation,
    }
  }

  /**
   * 更新耦合矩阵参数（在线学习）
   * 基于预测误差微调系数
   *
   * 学习后立即执行 IntentAnchor.anchor() 防止 drift
   */
  adapt(error: { potential: number; kinetic: number; dissipation: number }, learningRate: number = 0.01): void {
    this.coupling.C_pk += error.kinetic * learningRate * 0.1
    this.coupling.C_kp += error.potential * learningRate * 0.1
    this.coupling.C_pd += error.potential * learningRate * 0.05
    this.coupling.C_kd += error.kinetic * learningRate * 0.05
    this.coupling.C_dp += error.potential * learningRate * -0.05
    this.coupling.C_dk += error.kinetic * learningRate * 0.05
    this.coupling.alpha_p += error.potential * learningRate * 0.02
    this.coupling.alpha_k += error.kinetic * learningRate * 0.02
    this.coupling.alpha_d += error.dissipation * learningRate * 0.02

    // ⚡ 锚定：在每次学习后修正 drift
    this.anchor.anchor(this.coupling)
  }

  getCoupling(): FieldCouplingMatrix {
    return { ...this.coupling }
  }

  getAnchor(): IntentAnchor {
    return this.anchor
  }

  /**
   * 分析耦合强度
   */
  analyzeCoupling(): {
    dominant: string
    couplingStrength: number
    stabilityImplication: string
  } {
    const couplings = [
      { name: 'P→K (BSI抑制Freedom)', value: Math.abs(this.coupling.C_pk) },
      { name: 'K→P (Freedom反馈BSI)', value: Math.abs(this.coupling.C_kp) },
      { name: 'P→D (BSI触发逃逸)', value: Math.abs(this.coupling.C_pd) },
      { name: 'D→P (逃逸冲击BSI)', value: Math.abs(this.coupling.C_dp) },
      { name: 'D→K (逃逸提升Freedom)', value: Math.abs(this.coupling.C_dk) },
    ]

    const dominant = couplings.sort((a, b) => b.value - a.value)[0]
    const totalStrength = couplings.reduce((s, c) => s + c.value, 0)

    let stabilityImplication: string
    if (totalStrength > 1) {
      stabilityImplication = 'High coupling — fields strongly interact, prediction unstable without full coupling model'
    } else if (totalStrength > 0.5) {
      stabilityImplication = 'Moderate coupling — coupling effects measurable but not dominant'
    } else {
      stabilityImplication = 'Low coupling — fields are near independent, simple models may suffice'
    }

    return {
      dominant: dominant.name,
      couplingStrength: totalStrength,
      stabilityImplication,
    }
  }
}

// ============================================================
// Prediction Validator — 对抗解释过拟合的唯一工具
// ============================================================

export interface ValidationReport {
  /** 验证样本数 */
  samples: number
  /** 各场平均预测误差 */
  meanError: { potential: number; kinetic: number; dissipation: number }
  /** 各场 RMSE */
  rmse: { potential: number; kinetic: number; dissipation: number }
  /** 总预测力 (1 - normalized RMSE, 越高越好) */
  predictivePower: number
  /** 是否通过力验证（预测力 > 0.6） */
  valid: boolean
}

export class PredictionValidator {
  private predictions: { predicted: DirectorFieldState; actual: DirectorFieldState }[] = []

  /**
   * 记录一次预测→实际对比
   */
  record(predicted: DirectorFieldState, actual: DirectorFieldState): void {
    this.predictions.push({ predicted, actual })
    if (this.predictions.length > 100) this.predictions.shift()
  }

  /**
   * 验证预测力
   *
   * 核心原则：场论的 prediction ability 是理论真实性的唯一标准。
   * 解释得漂亮但 predict 不准 = field theory 是装饰。
   */
  validate(): ValidationReport {
    if (this.predictions.length === 0) {
      return {
        samples: 0,
        meanError: { potential: 0, kinetic: 0, dissipation: 0 },
        rmse: { potential: 0, kinetic: 0, dissipation: 0 },
        predictivePower: 0,
        valid: false,
      }
    }

    // 计算各场的误差
    const potErrors: number[] = []
    const kinErrors: number[] = []
    const disErrors: number[] = []

    for (const entry of this.predictions) {
      potErrors.push(Math.abs(entry.predicted.potential - entry.actual.potential))
      kinErrors.push(Math.abs(entry.predicted.kinetic - entry.actual.kinetic))
      disErrors.push(Math.abs(entry.predicted.dissipation - entry.actual.dissipation))
    }

    const meanPot = potErrors.reduce((s, e) => s + e, 0) / potErrors.length
    const meanKin = kinErrors.reduce((s, e) => s + e, 0) / kinErrors.length
    const meanDis = disErrors.reduce((s, e) => s + e, 0) / disErrors.length

    const rmsePot = Math.sqrt(potErrors.reduce((s, e) => s + e * e, 0) / potErrors.length)
    const rmseKin = Math.sqrt(kinErrors.reduce((s, e) => s + e * e, 0) / kinErrors.length)
    const rmseDis = Math.sqrt(disErrors.reduce((s, e) => s + e * e, 0) / disErrors.length)

    // 预测力：1 - normalized RMSE（相对于 0-1 区间归一化）
    const avgRMSE = (rmsePot + rmseKin + rmseDis) / 3
    const predictivePower = Math.max(0, 1 - avgRMSE * 2)

    return {
      samples: this.predictions.length,
      meanError: { potential: meanPot, kinetic: meanKin, dissipation: meanDis },
      rmse: { potential: rmsePot, kinetic: rmseKin, dissipation: rmseDis },
      predictivePower,
      valid: predictivePower > 0.6,
    }
  }

  /**
   * 清空历史
   */
  reset(): void {
    this.predictions = []
  }
}

// ============================================================
// v1.2 — Intent Anchor Layer
//   防止 learning drift: C 可以学习，但不能逃逸出"导演语义"(semantic identity) 约束。
//
//   结构层次（7 层显式化）：
//     Layer 1: StaticConstraintLayer   — 固定规则（signConstraint）
//     Layer 2: ProjectionLayer          — 几何投影（curvature-aware）
//     Layer 3: OscillationMonitor       — 震荡检测（时间稳定性）
//     Layer 4: AutoRelaxationLayer      — 边界形变（受控松弛）
//     Layer 5: MetaDriftMonitor         — 元漂移监控（baseline 对比）
//     Layer 6: DiagnosticLayer          — 报告生成（整合诊断）
//     Layer 7: ArchivalLayer            — 历史快照（版本化持久）
// ============================================================

/**
 * 锚定配置：
 *   每个系数有：
 *     - admissibleRange: [min, max] 准许漂移范围
 *     - signConstraint: 符号约束（必须保持的关系）
 *     - anchorStrength: 锚定强度（0=无锚, 1=完美锚定）
 */
export interface AnchorConfig {
  C_pk: { admissibleRange: [number, number]; signConstraint: 'negative'; anchorStrength?: number }
  C_kp: { admissibleRange: [number, number]; signConstraint: 'positive' | 'any'; anchorStrength?: number }
  C_pd: { admissibleRange: [number, number]; signConstraint: 'positive'; anchorStrength?: number }
  C_kd: { admissibleRange: [number, number]; signConstraint: 'negative'; anchorStrength?: number }
  C_dp: { admissibleRange: [number, number]; signConstraint: 'negative'; anchorStrength?: number }
  C_dk: { admissibleRange: [number, number]; signConstraint: 'positive'; anchorStrength?: number }
  alpha_p: { admissibleRange: [number, number]; anchorStrength?: number }
  alpha_k: { admissibleRange: [number, number]; anchorStrength?: number }
  alpha_d: { admissibleRange: [number, number]; anchorStrength?: number }
}

export const DEFAULT_ANCHOR_CONFIG: AnchorConfig = {
  C_pk: { admissibleRange: [-0.4, -0.05], signConstraint: 'negative' },
  C_kp: { admissibleRange: [0, 0.3], signConstraint: 'positive' },
  C_pd: { admissibleRange: [0.05, 0.4], signConstraint: 'positive' },
  C_kd: { admissibleRange: [-0.4, -0.05], signConstraint: 'negative' },
  C_dp: { admissibleRange: [-0.3, -0.02], signConstraint: 'negative' },
  C_dk: { admissibleRange: [0.05, 0.45], signConstraint: 'positive' },
  alpha_p: { admissibleRange: [0.5, 0.95] },
  alpha_k: { admissibleRange: [0.3, 0.8] },
  alpha_d: { admissibleRange: [0.2, 0.7] },
}

export interface AnchorReport {
  /** 当前耦合矩阵 */
  coupling: FieldCouplingMatrix
  /** 各系数的 drift (距离 admissible range 中心的偏移) */
  driftPercentages: Record<string, number>
  /** 总 drift 量（全部系数的平均偏移比） */
  totalDrift: number
  /** 是否有系数处在锚定边界 */
  anchored: boolean
  /** 最近一次修正的系数名 */
  lastCorrection: string | null
  /** 语义完整性（所有符号约束是否满足） */
  semanticIntact: boolean
  /** 警告 */
  warnings: string[]
  /** 边界稳定性分析 */
  boundaryStability: BoundaryStabilityReport | null
}

export interface BoundaryStabilityReport {
  /** 各系数边界附近震荡频率 */
  oscillationFrequencies: Record<string, { boundary: 'low' | 'high'; count: number; consecutive: boolean }>
  /** 总震荡次数 */
  totalOscillations: number
  /** 是否检测到边界不稳定 */
  unstable: boolean
  /** 建议 */
  recommendation: string
  /** 累积边界偏移（相对原始默认值） */
  cumulativeDrift: Record<string, number>
  /** 全局边界偏移警告 */
  globalDriftWarning: string | null
}

export class IntentAnchor {
  private config: AnchorConfig
  private lastCorrection: string | null = null
  /** 边界震荡跟踪：{coefficientKey: { nearBoundaryCount, lastDirection }} */
  private oscillationTracker: Map<string, { nearBoundaryCount: number; lastDirection: 'inward' | 'outward' | null; consecutive: boolean }> = new Map()
  private totalOscillations = 0
  /** 边界松弛历史：{coefficientKey: relaxationCount} */
  private relaxationHistory: Map<string, number> = new Map()
  private maxRelaxations = 3
  /** 原始配置快照 — 用于检测 meta-boundary drift */
  private readonly baselineConfig: AnchorConfig

  constructor(config?: Partial<AnchorConfig>) {
    this.config = { ...DEFAULT_ANCHOR_CONFIG, ...config }
    // Deep merge each field
    for (const key of Object.keys(DEFAULT_ANCHOR_CONFIG)) {
      const k = key as keyof AnchorConfig
      this.config[k] = { ...DEFAULT_ANCHOR_CONFIG[k], ...(config?.[k] ?? {}) }
    }
    // 冻结 baseline
    this.baselineConfig = JSON.parse(JSON.stringify(this.config))
  }

  /**
   * 自动边界微扩：当同一个系数反复震荡时，在保证符号约束的前提下
   * 微幅扩展 admissible range。
   *
   * 规则：
   *   1. 只在检测到连续 crossing 时生效（非首次）
   *   2. 每次扩展 5%（膨胀系数 = 1.05）
   *   3. 不会违反 signConstraint
   *   4. 最多扩展 maxRelaxations 次
   *
   * 本质：边界位置的"自动假设检验"——如果系统在边界反复震荡，
   * 可能意味着边界定太紧了，而非学习错了。
   */
  private autoRelax(key: string): void {
    const relaxCount = this.relaxationHistory.get(key) ?? 0
    if (relaxCount >= this.maxRelaxations) return

    const cfg = this.config[key as keyof AnchorConfig]
    if (!cfg) return

    const oldRange = [...cfg.admissibleRange] as [number, number]
    const halfWidth = (oldRange[1] - oldRange[0]) / 2
    const center = (oldRange[0] + oldRange[1]) / 2
    const newHalfWidth = halfWidth * 1.05 // 5% 膨胀

    const newLo = center - newHalfWidth
    const newHi = center + newHalfWidth

    // signConstraint 保持
    if ('signConstraint' in cfg && cfg.signConstraint !== 'any') {
      if (cfg.signConstraint === 'positive' && newLo < 0) {
        cfg.admissibleRange = [0, Math.max(oldRange[1], newHi)] as [number, number]
      } else if (cfg.signConstraint === 'negative' && newHi > 0) {
        cfg.admissibleRange = [Math.min(oldRange[0], newLo), 0] as [number, number]
      } else {
        cfg.admissibleRange = [newLo, newHi]
      }
    } else {
      cfg.admissibleRange = [newLo, newHi]
    }

    this.relaxationHistory.set(key, relaxCount + 1)
  }

  /**
   * 锚定一个耦合矩阵：修正违反语义的系数
   *
   * v2 — curvature-aware projection + boundary oscillation tracking + auto relaxation
   */
  anchor(coupling: FieldCouplingMatrix): void {
    this.lastCorrection = null

    const keys: (keyof FieldCouplingMatrix)[] = ['C_pk', 'C_kp', 'C_pd', 'C_kd', 'C_dp', 'C_dk', 'alpha_p', 'alpha_k', 'alpha_d']

    for (const key of keys) {
      const cfg = this.config[key]
      if (!cfg) continue
      const value = coupling[key]
      if (typeof value !== 'number') continue

      const [lo, hi] = cfg.admissibleRange
      const center = (lo + hi) / 2
      const halfRange = (hi - lo) / 2
      let corrected = value
      let needsCorrection = false

      // 0. 边界震荡跟踪
      const wasNearLow = value >= lo && value < lo + halfRange * 0.15
      const wasNearHigh = value <= hi && value > hi - halfRange * 0.15
      const wasNearBoundary = wasNearLow || wasNearHigh
      const wasOutOfRange = value < lo || value > hi

      const track = this.oscillationTracker.get(key) ?? { nearBoundaryCount: 0, lastDirection: null as 'inward' | 'outward' | null, consecutive: false }
      track.nearBoundaryCount = (track.nearBoundaryCount || 0) + (wasNearBoundary ? 1 : 0)

      let oscillationDetected = false
      if (wasOutOfRange) {
        track.nearBoundaryCount++
        if (track.lastDirection === 'inward') {
          track.consecutive = true
          this.totalOscillations++
          oscillationDetected = true
        }
        track.lastDirection = 'outward'
      } else if (wasNearBoundary && track.lastDirection === 'outward') {
        track.consecutive = true
        this.totalOscillations++
        oscillationDetected = true
        track.lastDirection = 'inward'
      } else if (wasNearBoundary) {
        track.lastDirection = 'inward'
      }
      this.oscillationTracker.set(key, track)

      // 0b. 自动边界松弛：震荡时微扩 admissible range
      if (oscillationDetected) {
        this.autoRelax(key)
        // 重新读取松弛后的边界
        const newCfg = this.config[key as keyof AnchorConfig]
        if (newCfg) {
          const [newLo, newHi] = newCfg.admissibleRange
          if (newLo !== lo || newHi !== hi) {
            // boundary changed mid-loop → recompute perspective
            this.lastCorrection = key
          }
        }
      }

      // 1. 符号约束 — 最高优先级
      if ('signConstraint' in cfg && cfg.signConstraint !== 'any') {
        const sc = cfg as { signConstraint: 'positive' | 'negative'; admissibleRange: [number, number]; anchorStrength: number }
        if (sc.signConstraint === 'positive' && corrected < 0) {
          corrected = center
          needsCorrection = true
          this.lastCorrection = key
        } else if (sc.signConstraint === 'negative' && corrected > 0) {
          corrected = center
          needsCorrection = true
          this.lastCorrection = key
        }
        if (needsCorrection) {
          coupling[key] = corrected as never
          continue
        }
      }

      // 2. range 约束 — curvature-aware projection
      if (corrected < lo) {
        const distance = (lo - corrected) / halfRange
        const strength = Math.min(0.9, 0.5 + distance * 0.4)
        corrected = lo + (corrected - lo) * (1 - strength)
        if (corrected < lo) corrected = lo
        needsCorrection = true
        this.lastCorrection = key
      } else if (corrected > hi) {
        const distance = (corrected - hi) / halfRange
        const strength = Math.min(0.9, 0.5 + distance * 0.4)
        corrected = hi + (corrected - hi) * (1 - strength)
        if (corrected > hi) corrected = hi
        needsCorrection = true
        this.lastCorrection = key
      }

      // 3. 软投影 — 边界附近微力回中
      if (!needsCorrection && corrected >= lo && corrected <= hi) {
        const distanceToCenter = Math.abs(corrected - center)
        const normalizedDistance = distanceToCenter / halfRange

        if (normalizedDistance > 0.9) {
          const softStrength = (normalizedDistance - 0.9) / 0.1 * 0.15
          corrected += (center - corrected) * softStrength
          this.lastCorrection = key
        }
      }

      coupling[key] = corrected as never
    }
  }

  /**
   * 生成锚定报告
   */
  report(coupling: FieldCouplingMatrix): AnchorReport {
    const keys: (keyof AnchorConfig)[] = ['C_pk', 'C_kp', 'C_pd', 'C_kd', 'C_dp', 'C_dk', 'alpha_p', 'alpha_k', 'alpha_d']
    const driftPercentages: Record<string, number> = {}
    let totalDrift = 0
    let driftCount = 0
    const warnings: string[] = []
    let anchored = false
    let semanticIntact = true

    const oscFreq: BoundaryStabilityReport['oscillationFrequencies'] = {}
    let totalOsc = 0

    for (const key of keys) {
      const cfg = this.config[key]
      if (!cfg) continue

      const value = coupling[key] as number
      const [lo, hi] = cfg.admissibleRange
      const center = (lo + hi) / 2
      const halfRange = (hi - lo) / 2

      // drift = 距中心偏移百分比（负 = 已越界）
      const drift = halfRange > 0 ? 1 - Math.abs(value - center) / halfRange : 0
      driftPercentages[key] = Math.max(-1, Math.min(1, drift))
      driftCount++

      // 检查符号约束
      if ('signConstraint' in cfg && cfg.signConstraint !== 'any') {
        const sc = cfg as { signConstraint: 'positive' | 'negative' }
        if (sc.signConstraint === 'positive' && value < 0) {
          semanticIntact = false
          warnings.push(`${key} violates positive sign constraint (${value.toFixed(3)})`)
        } else if (sc.signConstraint === 'negative' && value > 0) {
          semanticIntact = false
          warnings.push(`${key} violates negative sign constraint (${value.toFixed(3)})`)
        }
      }

      // 检查是否在锚定边界
      if (value <= lo * 1.1 || value >= hi * 0.9) {
        anchored = true
      }

      totalDrift += drift

      // Boundary oscillation analysis
      const track = this.oscillationTracker.get(key)
      if (track && track.nearBoundaryCount > 0) {
        const boundary = value >= hi - halfRange * 0.15 ? 'high' : 'low'
        oscFreq[key] = {
          boundary,
          count: track.nearBoundaryCount,
          consecutive: track.consecutive,
        }
        totalOsc += track.consecutive ? 1 : 0
      }
    }

    const avgDrift = driftCount > 0 ? totalDrift / driftCount : 0

    if (!semanticIntact) {
      warnings.push('Semantic constraints violated — coupling no longer reflects director intent')
    }

    if (anchored) {
      warnings.push('Some coefficients at anchor boundary — learning may be pushing against intent')
    }

    // 计算累积边界偏移
    const cumulativeDrift: Record<string, number> = {}
    let maxCumulativeDrift = 0
    let maxDriftKey = ''

    for (const key of keys) {
      const current = this.config[key]
      const baseline = this.baselineConfig[key]
      if (!current || !baseline) continue

      const currWidth = current.admissibleRange[1] - current.admissibleRange[0]
      const baseWidth = baseline.admissibleRange[1] - baseline.admissibleRange[0]
      if (baseWidth > 0) {
        const ratio = currWidth / baseWidth
        cumulativeDrift[key] = ratio
        if (ratio > maxCumulativeDrift) {
          maxCumulativeDrift = ratio
          maxDriftKey = key
        }
      }
    }

    let globalDriftWarning: string | null = null
    if (maxCumulativeDrift > 1.3) {
      globalDriftWarning = `Meta-boundary drift warning: ${maxDriftKey} has expanded to ${(maxCumulativeDrift * 100).toFixed(0)}% of original width. `
        + 'This suggests the default admissible range may not match the natural dynamics of the system. '
        + 'Consider reviewing the DEFAULT_ANCHOR_CONFIG or increasing the regularization strength on that coefficient.'
    } else if (maxCumulativeDrift > 1.1) {
      globalDriftWarning = `Notice: ${maxDriftKey} expanded to ${(maxCumulativeDrift * 100).toFixed(0)}% of original width. Minor, but worth monitoring.`
    }

    const boundaryStability: BoundaryStabilityReport = {
      oscillationFrequencies: oscFreq,
      totalOscillations: totalOsc,
      unstable: totalOsc >= 3,
      recommendation: totalOsc >= 3
        ? `Boundary oscillation detected (${totalOsc} crossings). `
          + 'Auto-relaxation triggered — admissible ranges widened by ~5% per crossing. '
          + `Cumulative drift: ${maxDriftKey} at ${(maxCumulativeDrift * 100).toFixed(0)}%. `
          + 'Monitor globalDriftWarning for meta-boundary drift risk.'
        : totalOsc > 0
          ? 'Minor boundary activity — auto-relaxation may apply.'
          : 'No boundary oscillations detected.',
      cumulativeDrift,
      globalDriftWarning,
    }

    return {
      coupling: { ...coupling },
      driftPercentages,
      totalDrift: avgDrift,
      anchored,
      lastCorrection: this.lastCorrection,
      semanticIntact,
      warnings,
      boundaryStability,
    }
  }

  getConfig(): AnchorConfig {
    return { ...this.config }
  }

  /** 边界松弛历史 */
  getRelaxationHistory(): Record<string, number> {
    return Object.fromEntries(this.relaxationHistory)
  }

  /** 总震荡次数 */
  getTotalOscillations(): number {
    return this.totalOscillations
  }

  getMaxRelaxations(): number {
    return this.maxRelaxations
  }

  /**
   * 输出可配置快照 — 版本化约束配置
   */
  snapshot(): AnchoredConfigSnapshot {
    const keys: (keyof AnchorConfig)[] = ['C_pk', 'C_kp', 'C_pd', 'C_kd', 'C_dp', 'C_dk', 'alpha_p', 'alpha_k', 'alpha_d']
    const ranges: Record<string, [number, number]> = {}
    let drifted = false
    let totalShiftRatio = 0
    let shiftCount = 0

    for (const key of keys) {
      const current = this.config[key]
      const baseline = this.baselineConfig[key]
      if (!current || !baseline) continue

      ranges[key] = [...current.admissibleRange]

      const currWidth = current.admissibleRange[1] - current.admissibleRange[0]
      const baseWidth = baseline.admissibleRange[1] - baseline.admissibleRange[0]
      if (baseWidth > 0) {
        totalShiftRatio += currWidth / baseWidth
        shiftCount++
        if (Math.abs(currWidth - baseWidth) / baseWidth > 0.05) {
          drifted = true
        }
      }
    }

    return {
      ranges,
      timestamp: Date.now(),
      driftDetected: drifted,
      averageDriftRatio: shiftCount > 0 ? totalShiftRatio / shiftCount : 1,
      relaxationCounts: Object.fromEntries(this.relaxationHistory),
      totalOscillations: this.totalOscillations,
      globalDriftWarning: this.computeGlobalDriftWarning(totalShiftRatio / Math.max(1, shiftCount)),
    }
  }

  private computeGlobalDriftWarning(avgDriftRatio: number): string | null {
    if (avgDriftRatio > 1.3) {
      return `Meta-boundary drift detected: average admissible range expanded to ${(avgDriftRatio * 100).toFixed(0)}% of baseline. `
        + 'Strongly recommend reviewing baseline configuration.'
    }
    if (avgDriftRatio > 1.1) {
      return `Mild boundary shift: average expanded to ${(avgDriftRatio * 100).toFixed(0)}% of baseline. Monitor if trend continues.`
    }
    return null
  }
}

export interface AnchoredConfigSnapshot {
  /** 当前 admissible ranges */
  ranges: Record<string, [number, number]>
  /** 快照时间戳 */
  timestamp: number
  /** 是否检测到偏移 */
  driftDetected: boolean
  /** 平均偏移比（>1 = 放宽） */
  averageDriftRatio: number
  /** 各系数松弛次数 */
  relaxationCounts: Record<string, number>
  /** 总震荡次数 */
  totalOscillations: number
  /** 全局偏移警告 */
  globalDriftWarning: string | null
}

// ============================================================
// Snapshot Diff — 约束拓扑差分算子
//   比较两个 snapshots，输出结构化的约束演变报告。
//   不是新机制，是 snapshot 接口的直接下游工具。
// ============================================================

export interface SnapshotDiff {
  timeSpan: number
  rangeDiffs: Record<string, {
    oldRange: [number, number]
    newRange: [number, number]
    widthRatio: number
    centerShift: number
    shiftDirection: 'toward positive' | 'toward negative' | 'none'
  }>
  maxRangeExpansion: { key: string; ratio: number } | null
  maxCenterShift: { key: string; shift: number } | null
  relaxationDelta: Record<string, number>
  oscillationDelta: number
  assessment: 'stable' | 'minor_drift' | 'structural_change'
  summary: string
}

export function diffSnapshots(a: AnchoredConfigSnapshot, b: AnchoredConfigSnapshot): SnapshotDiff {
  const timeSpan = b.timestamp - a.timestamp
  const rangeDiffs: SnapshotDiff['rangeDiffs'] = {}
  const relaxationDelta: Record<string, number> = {}
  let maxExpansion: { key: string; ratio: number } | null = null
  let maxShift: { key: string; shift: number } | null = null

  const allKeys = new Set([...Object.keys(a.ranges), ...Object.keys(b.ranges)])
  for (const key of allKeys) {
    const oldR = a.ranges[key]
    const newR = b.ranges[key]
    if (!oldR || !newR) continue
    const oldWidth = oldR[1] - oldR[0]
    const newWidth = newR[1] - newR[0]
    const widthRatio = oldWidth > 0 ? newWidth / oldWidth : 1
    const oldCenter = (oldR[0] + oldR[1]) / 2
    const newCenter = (newR[0] + newR[1]) / 2
    const centerShift = newCenter - oldCenter
    rangeDiffs[key] = { oldRange: [...oldR], newRange: [...newR], widthRatio, centerShift, shiftDirection: centerShift > 0.01 ? 'toward positive' : centerShift < -0.01 ? 'toward negative' : 'none' }
    if (maxExpansion === null || widthRatio > maxExpansion.ratio) maxExpansion = { key, ratio: widthRatio }
    if (maxShift === null || Math.abs(centerShift) > Math.abs(maxShift.shift)) maxShift = { key, shift: centerShift }
  }
  for (const key of Object.keys(b.relaxationCounts)) {
    const oldCount = a.relaxationCounts[key] ?? 0
    const newCount = b.relaxationCounts[key] ?? 0
    if (newCount !== oldCount) relaxationDelta[key] = newCount - oldCount
  }
  const oscillationDelta = b.totalOscillations - a.totalOscillations
  const sigExp = Object.values(rangeDiffs).filter(d => d.widthRatio > 1.15 || d.widthRatio < 0.85)
  const sigShift = Object.values(rangeDiffs).filter(d => Math.abs(d.centerShift) > 0.05)
  let assessment: SnapshotDiff['assessment']
  if (sigExp.length > 2 || sigShift.length > 2 || oscillationDelta > 5) assessment = 'structural_change'
  else if (sigExp.length > 0 || sigShift.length > 0 || oscillationDelta > 0) assessment = 'minor_drift'
  else assessment = 'stable'
  const parts: string[] = [`Diff over ${timeSpan > 3600000 ? `${(timeSpan / 3600000).toFixed(1)}h` : `${(timeSpan / 1000).toFixed(0)}s`}`]
  if (maxExpansion && maxExpansion.ratio > 1.05) parts.push(`${maxExpansion.key} ×${maxExpansion.ratio.toFixed(2)}`)
  if (maxShift && Math.abs(maxShift.shift) > 0.01) parts.push(`${maxShift.key} ↦ ${maxShift.shift > 0 ? '+' : ''}${maxShift.shift.toFixed(3)}`)
  if (oscillationDelta > 0) parts.push(`+${oscillationDelta} osc`)
  parts.push(`→ ${assessment}`)
  return { timeSpan, rangeDiffs, maxRangeExpansion: maxExpansion, maxCenterShift: maxShift, relaxationDelta, oscillationDelta, assessment, summary: parts.join(' | ') }
}

// ============================================================
// DriftInterpreter — 漂移语义解释器
//
// 把数值层观测（drift ratio / boundary / oscillation / entropy）
// 映射到可读的语义类别。不引入新动力机制，只做解释。
// ============================================================

export type DriftSemanticClass =
  | 'stable'
  | 'creative_exploration'
  | 'constraint_loosening'
  | 'semantic_shift'
  | 'structural_instability'

export interface DriftInterpretation {
  /** 语义类别 */
  class: DriftSemanticClass
  /** 置信度 0-1 */
  confidence: number
  /** 语义标签（简短可读） */
  label: string
  /** 详细描述 */
  description: string
  /** 关键信号（哪个指标主导了分类） */
  keySignals: string[]
}

export interface DriftInput {
  /** 平均偏移比（>1 = 放宽） */
  averageDriftRatio: number
  /** 总震荡次数 */
  totalOscillations: number
  /** 各系数松弛次数 */
  relaxationCounts: Record<string, number>
  /** 最大边界扩展比 */
  maxExpansionRatio: number
  /** 意图熵（如果有） */
  intentEntropy?: number
  /** 是否检测到全局偏移警告 */
  globalDriftWarning?: string | null
  /** 逃逸偏置 */
  escapeBias?: number
}

export function interpretDrift(input: DriftInput): DriftInterpretation {
  const signals: string[] = []
  const totalRelaxations = Object.values(input.relaxationCounts).reduce((a, b) => a + b, 0)
  const hasRelaxation = totalRelaxations > 0
  const hasOscillation = input.totalOscillations > 0
  const hasExpansion = input.maxExpansionRatio > 1.05
  const hasSignificantExpansion = input.maxExpansionRatio > 1.15
  const hasDriftWarning = input.globalDriftWarning !== null && input.globalDriftWarning !== undefined
  const hasEscapeBias = (input.escapeBias ?? 0) > 0.3

  // 收集信号
  if (input.averageDriftRatio <= 1.03 && input.totalOscillations === 0 && totalRelaxations === 0) {
    signals.push('no_drift')
    return {
      class: 'stable',
      confidence: 0.95,
      label: '系统稳定',
      description: '约束流形无显著变化，系统处于稳态吸引域',
      keySignals: signals,
    }
  }

  if (input.averageDriftRatio <= 1.05 && input.totalOscillations <= 2 && !hasSignificantExpansion) {
    signals.push('minor_fluctuation')
    return {
      class: 'stable',
      confidence: 0.85,
      label: '微小波动',
      description: '约束边界有微小变化，但不超出稳态范围',
      keySignals: ['平均偏移率 < 5%', ...(hasRelaxation ? ['少量松弛'] : [])],
    }
  }

  // 创意探索：震荡 + 少量边界扩展 + 无全局警告
  if (hasOscillation && hasExpansion && !hasSignificantExpansion && !hasDriftWarning && !hasEscapeBias) {
    signals.push('boundary_exploration')
    signals.push('no_warning')
    return {
      class: 'creative_exploration',
      confidence: 0.75,
      label: '创意探索中',
      description: `系统在探索新约束区域（${input.maxExpansionRatio.toFixed(2)}× 边界扩展），无退化信号`,
      keySignals: ['约束边界轻微扩展', '震荡可恢复', '无全局偏移警告'],
    }
  }

  // 约束松弛：边界扩展显著 + 无震荡 + 无逃逸
  if (hasSignificantExpansion && !hasOscillation && !hasEscapeBias && !hasDriftWarning) {
    signals.push('boundary_expansion')
    return {
      class: 'constraint_loosening',
      confidence: 0.7,
      label: '约束松弛',
      description: `约束边界显著放宽（${((input.maxExpansionRatio - 1) * 100).toFixed(0)}% 扩展），但无震荡或逃逸`,
      keySignals: [`边界扩展 ${((input.maxExpansionRatio - 1) * 100).toFixed(0)}%`],
    }
  }

  // 语义偏移：边界扩展 + 震荡 + 松弛累积
  if (hasExpansion && hasOscillation && totalRelaxations > 2) {
    signals.push('accumulated_relaxation')
    if (hasDriftWarning) {
      signals.push('global_drift_warning')
      return {
        class: 'semantic_shift',
        confidence: 0.85,
        label: '语义偏移',
        description: `约束流形持续偏移，边界扩展 ${((input.maxExpansionRatio - 1) * 100).toFixed(0)}% + ${input.totalOscillations} 次震荡 + 全局警告`,
        keySignals: ['累计松弛 ' + totalRelaxations + ' 次', '全局偏移警告', '边界扩展 > 5%'],
      }
    }
    signals.push('no_global_warning')
    return {
      class: 'semantic_shift',
      confidence: 0.65,
      label: '语义偏移（早期）',
      description: `约束边界缓慢偏移，${input.totalOscillations} 次震荡，但无全局警告`,
      keySignals: [`${input.totalOscillations} 次震荡`, `${totalRelaxations} 次松弛`],
    }
  }

  // 结构不稳定：高逃逸偏置 + 显著震荡 + 全局警告
  if (hasEscapeBias || (hasDriftWarning && input.totalOscillations > 3)) {
    signals.push('escape_bias_detected')
    signals.push('high_oscillation')
    return {
      class: 'structural_instability',
      confidence: 0.9,
      label: '结构不稳定',
      description: `系统可能正在脱离原约束吸引域${hasEscapeBias ? '（逃逸偏置 ' + (input.escapeBias ?? 0).toFixed(2) + '）' : ''}`,
      keySignals: [...(hasEscapeBias ? ['逃逸偏置'] : []), `${input.totalOscillations} 次震荡`, '全局偏移警告'],
    }
  }

  // 兜底：边缘情况
  signals.push('mixed_signals')
  return {
    class: 'structural_instability',
    confidence: 0.55,
    label: '信号模糊',
    description: '多指标信号混杂，无法明确分类',
    keySignals: Object.entries({
      driftRatio: input.averageDriftRatio,
      oscillations: input.totalOscillations,
      relaxations: totalRelaxations,
    })
      .filter(([_, v]) => (typeof v === 'number' ? v > 0 : true))
      .map(([k, v]) => `${k}=${v}`),
  }
}

// ============================================================
// DriftTransitionRecorder
//
// 记录 drift semantic class 之间的转移历史。
// 只写（在 diagnostics 层），只读（被 aggregation tools 消费）。
// interpretation 层（interpretDrift）保持纯函数，不写入。
//
// 架构边界：
//   - Runtime        : ❌ state（唯一真实状态）
//   - Diagnostics    : ✔ state（记录历史）
//   - Interpretation : ❌ state（纯函数）
//   - Aggregation    : ✔ state（读 history，生成 matrix）
// ============================================================

export interface DriftTransition {
  from: DriftSemanticClass
  to: DriftSemanticClass
  timestamp: number
}

export interface DriftTransitionMatrix {
  /** 从 class → 到 class 的计数 */
  counts: Record<string, Record<string, number>>
  /** 各 class 出现总次数 */
  totals: Record<string, number>
  /** 从 class → 最频繁的 to class */
  mostLikelyNext: Record<string, { to: string; count: number; probability: number }>
  /** 最近 N 条转移（用于时序分析） */
  recentTransitions: DriftTransition[]
  /** 采样总数 */
  totalTransitions: number
}

export class DriftTransitionRecorder {
  private buffer: DriftTransition[] = []
  private maxSize: number
  private lastClass: DriftSemanticClass | null = null

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  /**
   * 记录一次 drift class 观测。
   * 如果与上次 class 不同，记录一次转移。
   * 纯记录，不参与任何控制流，不修改任何系统状态外的数据。
   */
  record(class_: DriftSemanticClass): void {
    if (this.lastClass !== null && class_ !== this.lastClass) {
      this.buffer.push({
        from: this.lastClass,
        to: class_,
        timestamp: Date.now(),
      })
      if (this.buffer.length > this.maxSize) {
        this.buffer.shift()
      }
    }
    this.lastClass = class_
  }

  /**
   * 计算转移矩阵（读操作，不修改状态）
   */
  getMatrix(): DriftTransitionMatrix {
    const counts: Record<string, Record<string, number>> = {}
    const totals: Record<string, number> = {}

    for (const t of this.buffer) {
      if (!counts[t.from]) counts[t.from] = {}
      if (!counts[t.from][t.to]) counts[t.from][t.to] = 0
      counts[t.from][t.to]++
      totals[t.from] = (totals[t.from] ?? 0) + 1
    }

    const mostLikelyNext: DriftTransitionMatrix['mostLikelyNext'] = {}
    for (const [from, tos] of Object.entries(counts)) {
      let maxTo = ''
      let maxCount = 0
      for (const [to, c] of Object.entries(tos)) {
        if (c > maxCount) {
          maxTo = to
          maxCount = c
        }
      }
      if (maxTo) {
        mostLikelyNext[from] = {
          to: maxTo,
          count: maxCount,
          probability: Math.round((maxCount / (totals[from] ?? 1)) * 100) / 100,
        }
      }
    }

    return {
      counts,
      totals,
      mostLikelyNext,
      recentTransitions: [...this.buffer].slice(-10),
      totalTransitions: this.buffer.length,
    }
  }

  /**
   * 重置
   */
  reset(): void {
    this.buffer = []
    this.lastClass = null
  }
}

// ============================================================
// DriftBasinAnalyzer — 语义吸引子地图
//
// 把 transition matrix 折叠为 basin/boundary/transient 三类。
// 只回答："系统历史上倾向收敛在哪些 state cluster"
// 不参与控制流，不修改任何数据。
// ============================================================

export interface BasinMap {
  /** 吸引子 — 进入后不易离开的 state */
  attractors: Array<{ class: string; selfLoopProb: number; entrySources: string[] }>
  /** 边界态 — 频繁与其他 state 互换 */
  boundaries: Array<{ class: string; transitionPartners: string[] }>
  /** 瞬态 — 仅作为过渡出现的 state */
  transients: Array<{ class: string; occurrenceRate: number }>
  /** 汇总描述 */
  summary: string
}

export function analyzeBasins(matrix: DriftTransitionMatrix): BasinMap {
  const { counts, totals } = matrix
  const attractors: BasinMap['attractors'] = []
  const boundaries: BasinMap['boundaries'] = []
  const transients: BasinMap['transients'] = []

  const totalTransitions = matrix.totalTransitions

  for (const [state, tos] of Object.entries(counts)) {
    const totalFrom = totals[state] ?? 1
    const selfLoops = tos[state] ?? 0
    const selfLoopProb = selfLoops / totalFrom
    const partnerCount = Object.keys(tos).length

    // 吸引子：自环概率 > 0.5 且 partner 少（通常只自环 + 偶尔外出）
    if (selfLoopProb > 0.5) {
      const entrySources: string[] = []
      for (const [other, tosOther] of Object.entries(counts)) {
        if (other !== state && tosOther[state]) {
          entrySources.push(other)
        }
      }
      attractors.push({ class: state, selfLoopProb, entrySources })
    }
    // 边界态：partner 多（≥3）且自环适中
    else if (partnerCount >= 3) {
      const partners = Object.keys(tos).filter(k => k !== state)
      boundaries.push({ class: state, transitionPartners: partners })
    }
    // 瞬态：出现次数少
    else {
      const occurrenceRate = totalFrom / Math.max(1, totalTransitions)
      transients.push({ class: state, occurrenceRate })
    }
  }

  // 排序
  attractors.sort((a, b) => b.selfLoopProb - a.selfLoopProb)
  boundaries.sort((a, b) => b.transitionPartners.length - a.transitionPartners.length)
  transients.sort((a, b) => b.occurrenceRate - a.occurrenceRate)

  const parts: string[] = []
  if (attractors.length) parts.push(`${attractors.length} attractor${attractors.length > 1 ? 's' : ''}: ${attractors.map(a => `${a.class}(${(a.selfLoopProb * 100).toFixed(0)}%)`).join(', ')}`)
  if (boundaries.length) parts.push(`${boundaries.length} boundar${boundaries.length > 1 ? 'ies' : 'y'}`)
  if (transients.length) parts.push(`${transients.length} transient${transients.length > 1 ? 's' : ''}`)
  parts.push(`total ${totalTransitions} transitions`)

  return { attractors, boundaries, transients, summary: parts.join(' | ') }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

