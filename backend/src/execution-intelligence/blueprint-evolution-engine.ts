/**
 * Blueprint Evolution Engine
 * Phase 7 — Execution Intelligence Layer
 *
 * 蓝图进化器：根据执行反馈和历史数据自动优化 blueprint。
 *
 * 进化信号：
 *   - 失败镜头数多 → 降低复杂度
 *   - 执行成本高 → 启用批量渲染
 *   - 延迟过高 → 拆分大场景
 *   - 执行效果稳定 → 可尝试更高精度
 */

export interface EvolutionFeedback {
  failedShots: number
  totalShots: number
  cost: number
  avgLatency: number
  totalRenderTime: number
}

export type OptimizationMode = 'STANDARD' | 'LOW_LATENCY' | 'BATCH_RENDER' | 'HIGH_PRECISION'

export interface EvolutionResult {
  optimizationMode: OptimizationMode
  appliedOptimizations: string[]
  explanation: string
}

export class BlueprintEvolutionEngine {
  /**
   * 根据反馈数据进化 blueprint 的优化模式
   */
  evolve(blueprint: any, feedback: EvolutionFeedback): EvolutionResult {
    const raw = blueprint?.data ?? blueprint
    const appliedOptimizations: string[] = []
    let mode: OptimizationMode = 'STANDARD'

    // 信号检测 + 决策
    const failureRate = feedback.totalShots > 0
      ? feedback.failedShots / feedback.totalShots
      : 0

    if (failureRate > 0.2) {
      mode = 'LOW_LATENCY'
      appliedOptimizations.push(
        `失败率 ${(failureRate * 100).toFixed(0)}% > 20% → 降低延迟`,
        '减少场景复杂度',
        '启用快速渲染路径',
      )
    } else if (feedback.cost > 1000) {
      mode = 'BATCH_RENDER'
      appliedOptimizations.push(
        `成本 ${feedback.cost} > 阈值 → 批量渲染`,
        '合并小场景为批次',
        '资源复用',
      )
    } else if (feedback.avgLatency > 3) {
      mode = 'LOW_LATENCY'
      appliedOptimizations.push(
        `平均延迟 ${feedback.avgLatency.toFixed(1)} > 3 → 优化延迟`,
        '拆分大场景',
      )
    } else if (failureRate < 0.05 && feedback.avgLatency < 1.5) {
      mode = 'HIGH_PRECISION'
      appliedOptimizations.push(
        '系统稳定 → 尝试更高精度',
        '启用增强渲染',
      )
    } else {
      mode = 'STANDARD'
      appliedOptimizations.push('当前模式正常，无需优化')
    }

    // 将优化模式写入 blueprint
    raw.optimizationMode = mode

    return {
      optimizationMode: mode,
      appliedOptimizations,
      explanation: this.explain(mode, appliedOptimizations),
    }
  }

  /**
   * 生成人类可读的进化说明
   */
  private explain(mode: OptimizationMode, optimizations: string[]): string {
    const modeLabel: Record<OptimizationMode, string> = {
      STANDARD: '标准模式',
      LOW_LATENCY: '低延迟模式',
      BATCH_RENDER: '批量渲染模式',
      HIGH_PRECISION: '高精度模式',
    }

    return `🔄 进化至 [${modeLabel[mode]}]\n  ${optimizations.join('\n  ')}`
  }
}
