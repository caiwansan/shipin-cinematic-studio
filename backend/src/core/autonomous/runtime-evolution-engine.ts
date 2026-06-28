/**
 * P7 — RuntimeEvolutionEngine（运行时进化引擎）
 *
 * 系统的自我调优核心。
 * 定期执行：负载分析 → 权重调整 → 集群扩缩 → 策略更新。
 *
 * ═══ 宪法 ═══
 * 进化引擎运行在后台，不影响当前执行流。
 * 进化操作必须是可逆的（支持回滚）。
 */

import { patternLearner } from './pattern-learner.js'
import { adaptiveClusterScaler } from './adaptive-cluster-scaler.js'
import { Capability } from '../runtime/capabilities.js'
import { stabilityController } from '../governance/stability-controller.js'
import { evolutionGuard } from '../governance/evolution-guard.js'
import { driftDetector } from '../governance/drift-detector.js'
import { rollbackManager } from '../governance/rollback-manager.js'

export interface EvolutionReport {
  timestamp: number
  cycleNumber: number
  scaling: {
    action: string
    reason: string
    currentCapacity: number
    suggestedCapacity: number
  }
  weightAdjustments: Array<{
    capability: string
    weights: { latencyWeight: number; costWeight: number; loadWeight: number; confidence: number }
  }>
  insights: any[]
}

class RuntimeEvolutionEngine {
  private cycleNumber = 0
  private timer: ReturnType<typeof setInterval> | null = null

  /**
   * 启动进化引擎
   */
  start(intervalMs: number = 60000): void {
    if (this.timer) {
      console.warn('[RuntimeEvolutionEngine] ⚠️ 已在运行')
      return
    }

    this.timer = setInterval(() => this.evolve(), intervalMs)
    console.log(`[RuntimeEvolutionEngine] ✅ 进化引擎已启动 (间隔 ${intervalMs / 1000}s)`)
  }

  /**
   * 执行一次进化
   */
  async evolve(): Promise<EvolutionReport> {
    this.cycleNumber++

    // ═══ Governance Check ═══
    if (!stabilityController.canEvolve()) {
      const report = stabilityController.report()
      console.warn(`[RuntimeEvolutionEngine] ⏸️ 进化#${this.cycleNumber} 跳过 — 系统当前 ${report.level}`)
      // 如果是 CRITICAL，尝试自动回滚
      if (report.level === 'CRITICAL') {
        await rollbackManager.rollbackToStable()
      }
      return {
        timestamp: Date.now(),
        cycleNumber: this.cycleNumber,
        scaling: { action: 'blocked_by_governance', reason: `系统 ${report.level}`, currentCapacity: 0, suggestedCapacity: 0 },
        weightAdjustments: [],
        insights: [],
      }
    }

    // 1. 集群扩缩决策（过 Policy Engine 检查）
    const scaling = adaptiveClusterScaler.decide()
    if (scaling.action !== 'no_change') {
      const proposal = {
        type: 'cluster_scaling' as const,
        previousValue: scaling.currentCapacity,
        proposedValue: scaling.suggestedCapacity,
        reason: scaling.reason,
        triggeredBy: 'runtime-evolution-engine',
      }
      const decision = await evolutionGuard.review(proposal)
      if (!decision.approved) {
        console.log(`[RuntimeEvolutionEngine] ⏭️ 集群扩缩被 Governance 拒绝: ${decision.violations.join('; ')}`)
        scaling.action = 'blocked_by_governance' as any
      }
    }

    // 2. 权重调整（过 EvolutionGuard）
    const weightAdjustments: EvolutionReport['weightAdjustments'] = []
    for (const cap of Object.values(Capability)) {
      const weights = patternLearner.learnWeights(cap)
      const proposal = {
        type: 'weight_adjustment' as const,
        capability: cap,
        previousValue: { latencyWeight: 0.4, costWeight: 0.3, loadWeight: 0.3, confidence: 0 },
        proposedValue: weights,
        reason: `adaptive learning from ${weights.samples} samples`,
        triggeredBy: 'pattern-learner',
      }
      const decision = await evolutionGuard.review(proposal)
      weightAdjustments.push({
        capability: cap,
        weights: decision.approved ? weights : { latencyWeight: 0.4, costWeight: 0.3, loadWeight: 0.3, confidence: 0 },
      })
    }

    // 3. 学习洞察
    const insights = patternLearner.getInsights()

    // 4. 漂移检测
    const driftAlerts = driftDetector.detect()
    if (driftAlerts.length > 0) {
      console.warn(`[RuntimeEvolutionEngine] ⚠️ 进化#${this.cycleNumber} 检测到 ${driftAlerts.length} 个漂移告警`)
    }

    // 5. 保存快照
    await rollbackManager.saveSnapshot(
      `进化周期#${this.cycleNumber}`,
      weightAdjustments.reduce((acc, w) => ({ ...acc, [w.capability]: w.weights.latencyWeight }), {}),
      scaling.currentCapacity,
    )

    const report: EvolutionReport = {
      timestamp: Date.now(),
      cycleNumber: this.cycleNumber,
      scaling,
      weightAdjustments,
      insights,
    }

    const summary = `[RuntimeEvolutionEngine] 🔄 进化#${this.cycleNumber}: 扩缩=${scaling.action}(${scaling.currentCapacity}→${scaling.suggestedCapacity}) 洞察=${insights.length}`
    console.log(summary)

    return report
  }

  /**
   * 停止进化引擎
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      console.log('[RuntimeEvolutionEngine] ⏹️ 已停止')
    }
  }

  /**
   * 获取当前周期
   */
  getCycleNumber(): number {
    return this.cycleNumber
  }
}

export const runtimeEvolutionEngine = new RuntimeEvolutionEngine()
