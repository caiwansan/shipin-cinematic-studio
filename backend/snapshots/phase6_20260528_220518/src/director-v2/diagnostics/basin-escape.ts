/**
 * basin-escape.ts — Stagnation Attractor Escape Operator
 *
 * Phase Gate 的 actuator：检测到 stagnation attractor 时，
 * 不是被动拒绝 switch，而是主动 perturb 系统状态，
 * 尝试将系统推出 suboptimal manifold basin。
 *
 * 三种逃逸策略（按保守程度递进）：
 *   1. ENTROPY_INJECTION  → soft perturb: 加一个随机扰动向量
 *   2. CONSTRAINT_RELAX   → medium: 暂时放松 governance 阈值
 *   3. REANCHOR          → hard: 回滚到最近一个 healthy snapshot + 扰动
 *
 * 核心原则：不破坏稳定性，只破坏 stagnation。
 */

// ============================================================
// Types
// ============================================================

export type EscapeStrategy = 'ENTROPY_INJECTION' | 'CONSTRAINT_RELAX' | 'REANCHOR'

export interface EscapeConfig {
  /** 每次逃逸的扰动幅度 (0-1) */
  perturbationStrength: number
  /** 最大尝试次数 */
  maxAttempts: number
  /** 各策略的尝试顺序 */
  strategySequence: EscapeStrategy[]
  /** 尝试间隔（模拟周期数） */
  cooldownPeriods: number
}

export const DEFAULT_ESCAPE_CONFIG: EscapeConfig = {
  perturbationStrength: 0.15,
  maxAttempts: 3,
  strategySequence: ['ENTROPY_INJECTION', 'CONSTRAINT_RELAX', 'REANCHOR'],
  cooldownPeriods: 3,
}

export interface EscapeAttempt {
  /** 尝试 ID */
  id: string
  /** 使用的策略 */
  strategy: EscapeStrategy
  /** 扰动前的状态 */
  preState: { bsi: number; freedomIndex: number }
  /** 应用扰动后的状态 */
  postState: { bsi: number; freedomIndex: number }
  /** 是否成功（post 进入 creative_stable） */
  success: boolean
  /** 如果失败，尝试的下一个策略 */
  nextStrategy: EscapeStrategy | null
  /** 时间戳 */
  timestamp: number
}

// ============================================================
// Basin Escape Controller
// ============================================================

export class BasinEscapeController {
  private config: EscapeConfig
  private attemptHistory: EscapeAttempt[] = []
  private cooldownRemaining = 0
  private attemptCount = 0

  constructor(config?: Partial<EscapeConfig>) {
    this.config = { ...DEFAULT_ESCAPE_CONFIG, ...config }
  }

  /**
   * 尝试逃逸当前 stagnation attractor
   *
   * @param currentBsi 当前 BSI
   * @param currentFreedom 当前 FreedomIndex
   * @param applyPerturbation callback 应用扰动并返回新状态
   * @returns 逃逸结果
   */
  async attemptEscape(
    currentBsi: number,
    currentFreedom: number,
    applyPerturbation: (strategy: EscapeStrategy, strength: number) => Promise<{ bsi: number; freedomIndex: number }>,
  ): Promise<{
    escaped: boolean
    attempts: EscapeAttempt[]
    finalState: { bsi: number; freedomIndex: number }
    strategyUsed: EscapeStrategy | null
  }> {
    // 检查 cooldown
    if (this.cooldownRemaining > 0) {
      return {
        escaped: false,
        attempts: [],
        finalState: { bsi: currentBsi, freedomIndex: currentFreedom },
        strategyUsed: null,
      }
    }

    this.attemptCount++
    const attempts: EscapeAttempt[] = []

    for (const strategy of this.config.strategySequence) {
      if (attempts.length >= this.config.maxAttempts) break

      let strength: number
      switch (strategy) {
        case 'ENTROPY_INJECTION':
          strength = this.config.perturbationStrength
          break
        case 'CONSTRAINT_RELAX':
          strength = this.config.perturbationStrength * 1.5
          break
        case 'REANCHOR':
          strength = this.config.perturbationStrength * 2
          break
      }

      try {
        const postState = await applyPerturbation(strategy, strength)
        const success = postState.bsi >= 0.85 && postState.freedomIndex >= 0.5

        const attempt: EscapeAttempt = {
          id: `escape-${this.attemptCount}-${strategy}`,
          strategy,
          preState: { bsi: currentBsi, freedomIndex: currentFreedom },
          postState,
          success,
          nextStrategy: null,
          timestamp: Date.now(),
        }

        if (success) {
          // 成功逃逸
          attempt.nextStrategy = null
          attempts.push(attempt)
          this.attemptHistory.push(attempt)
          this.cooldownRemaining = this.config.cooldownPeriods
          return {
            escaped: true,
            attempts,
            finalState: postState,
            strategyUsed: strategy,
          }
        }

        // 失败，准备下一个策略
        const remainingStrategies = this.config.strategySequence.slice(
          this.config.strategySequence.indexOf(strategy) + 1
        )
        attempt.nextStrategy = remainingStrategies[0] ?? null
        attempts.push(attempt)
        this.attemptHistory.push(attempt)

        // 失败后冷却
        this.cooldownRemaining = Math.max(1, Math.floor(this.config.cooldownPeriods / 2))
      } catch {
        // 扰动失败，继续下一个策略
        continue
      }
    }

    // 所有策略都失败
    this.cooldownRemaining = this.config.cooldownPeriods

    return {
      escaped: false,
      attempts,
      finalState: { bsi: currentBsi, freedomIndex: currentFreedom },
      strategyUsed: null,
    }
  }

  /**
   * 生成一个 entropy injection 扰动向量
   * 用于在不需要 callback 时直接计算扰动目标
   */
  generatePerturbationVector(
    currentBsi: number,
    currentFreedom: number,
    strategy: EscapeStrategy,
  ): { targetBsi: number; targetFreedom: number } {
    let strength: number
    switch (strategy) {
      case 'ENTROPY_INJECTION': strength = this.config.perturbationStrength; break
      case 'CONSTRAINT_RELAX': strength = this.config.perturbationStrength * 1.5; break
      case 'REANCHOR': strength = this.config.perturbationStrength * 2; break
    }

    // 扰动方向：朝向 creative_stable 区域
    // 计算从当前位置到 creative_stable 中心 (0.9, 0.6) 的方向向量
    const targetCenterBsi = 0.9
    const targetCenterFreedom = 0.65

    const dirBsi = targetCenterBsi - currentBsi
    const dirFreedom = targetCenterFreedom - currentFreedom
    const dirMagnitude = Math.sqrt(dirBsi * dirBsi + dirFreedom * dirFreedom)

    if (dirMagnitude === 0) {
      return { targetBsi: currentBsi, targetFreedom: currentFreedom + strength }
    }

    // 沿方向移动 + 正交扰动（正交扰动 = 防止直线进入）
    const alongMagnitude = strength * 0.7
    const orthMagnitude = strength * 0.3

    // 正交向量
    const orthBsi = -dirFreedom
    const orthFreedom = dirBsi
    const orthDirMagnitude = Math.sqrt(orthBsi * orthBsi + orthFreedom * orthFreedom)

    const targetBsi = currentBsi
      + (dirBsi / dirMagnitude) * alongMagnitude
      + (orthDirMagnitude > 0 ? orthBsi / orthDirMagnitude * orthMagnitude : 0)

    const targetFreedom = currentFreedom
      + (dirFreedom / dirMagnitude) * alongMagnitude
      + (orthDirMagnitude > 0 ? orthFreedom / orthDirMagnitude * orthMagnitude : 0)

    return {
      targetBsi: Math.max(0, Math.min(1, targetBsi)),
      targetFreedom: Math.max(0, Math.min(1, targetFreedom)),
    }
  }

  /**
   * 递减冷却计数器（每次 tick 调用）
   */
  tick(): void {
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining--
    }
  }

  /**
   * 获取逃逸历史统计
   */
  getStats(): {
    totalAttempts: number
    successfulEscapes: number
    successRate: number
    recentAttempts: EscapeAttempt[]
    cooldownRemaining: number
  } {
    const successful = this.attemptHistory.filter(a => a.success).length
    return {
      totalAttempts: this.attemptHistory.length,
      successfulEscapes: successful,
      successRate: this.attemptHistory.length > 0 ? successful / this.attemptHistory.length : 0,
      recentAttempts: this.attemptHistory.slice(-5),
      cooldownRemaining: this.cooldownRemaining,
    }
  }

  /**
   * 重置控制器
   */
  reset(): void {
    this.attemptHistory = []
    this.cooldownRemaining = 0
    this.attemptCount = 0
  }
}

// ============================================================
// Escape Strategy Effects (宣告已知效应)
// ============================================================

export const ESCAPE_STRATEGY_EFFECTS: Record<EscapeStrategy, {
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  expectedEffect: string
  sideEffects: string[]
}> = {
  ENTROPY_INJECTION: {
    description: '对 governance weight 施加随机扰动，打破熵锁定',
    riskLevel: 'low',
    expectedEffect: 'FreedomIndex +0.05~0.15, BSI -0.02~0.05',
    sideEffects: ['可能短暂降低 BSI', '如果扰动过小可能无法逃逸'],
  },
  CONSTRAINT_RELAX: {
    description: '临时放松 governance maxWeightShift 和 entropy cap',
    riskLevel: 'medium',
    expectedEffect: 'FreedomIndex +0.1~0.25, BSI -0.05~0.1',
    sideEffects: ['可能引入短期不稳定', '恢复后需要调 governance 参数'],
  },
  REANCHOR: {
    description: '回滚到最近的 healthy snapshot 并从那里重新探索',
    riskLevel: 'high',
    expectedEffect: 'BSI 恢复至 snapshot 水平, FreedomIndex +0.15~0.3',
    sideEffects: ['丢失近期反馈信号', '可能回到旧 attractor（如果结构未变）'],
  },
}
