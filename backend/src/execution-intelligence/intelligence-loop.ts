/**
 * Intelligence Loop — Full Orchestrator
 * Phase 7 — Execution Intelligence Layer
 *
 * 自我进化闭环：将成本模型、DAG 优化器、自适应执行器、蓝图进化器
 * 编织为一个完整的智能闭环。
 *
 * 闭环链路：
 *   run(blueprint)
 *     → DAGOptimizer 优化执行顺序
 *     → AdaptiveExecutor 生成调度计划
 *     → 模拟执行并收集反馈
 *     → BlueprintEvolutionEngine 进化优化模式
 *     → 返回优化后的 blueprint + 执行计划 + 进化说明
 *
 * 这一闭环让系统从"人驱动执行"变为"系统自己优化自己"。
 */

import { CostModel, ExecutionCost } from './cost-model'
import { DAGOptimizer, OptimizationMode } from './dag-optimizer'
import { AdaptiveExecutor, ScheduleItem, AdaptationResult } from './adaptive-executor'
import { BlueprintEvolutionEngine, EvolutionFeedback, EvolutionResult } from './blueprint-evolution-engine'

export interface IntelligenceLoopInput {
  blueprint: any
  optimizationMode?: OptimizationMode
}

export interface IntelligenceLoopOutput {
  optimizedBlueprint: any
  schedule: ScheduleItem[]
  cost: { total: ExecutionCost; perScene: Record<string, ExecutionCost> }
  evolution: EvolutionResult
  adaptation: AdaptationResult
  trace: string[]
}

export class IntelligenceLoop {
  constructor(
    private costModel: CostModel = new CostModel(),
    private dagOptimizer: DAGOptimizer = new DAGOptimizer(),
    private adaptiveExecutor: AdaptiveExecutor = new AdaptiveExecutor(),
    private evolutionEngine: BlueprintEvolutionEngine = new BlueprintEvolutionEngine(),
  ) {}

  /**
   * 运行一次完整的智能闭环
   */
  run(input: IntelligenceLoopInput): IntelligenceLoopOutput {
    // 深度克隆 blueprint 以免修改 frozen 对象
    const raw = structuredClone(input.blueprint?.data ?? input.blueprint)
    const originalBlueprint = input.blueprint
    const trace: string[] = []

    // Step 1: 优化执行顺序
    const mode = input.optimizationMode || 'COST_BALANCED'
    const optimizedScenes = this.dagOptimizer.optimize(raw.scenes || [], mode)
    raw.scenes = optimizedScenes

    const orderExplanation = this.dagOptimizer.explain(optimizedScenes, mode)
    trace.push(orderExplanation)

    // Step 2: 生成调度计划
    const schedule = this.adaptiveExecutor.schedule(raw)
    trace.push(`自适应调度: ${schedule.length} 个节点按优先级排序`)

    // Step 3: 成本评估
    const cost = this.costModel.estimateBlueprint(raw)
    trace.push(`总成本: renderTime=${cost.total.renderTime}ms, computeUnits=${cost.total.computeUnits}`)

    // Step 4: 收集模拟反馈（基于成本模型预估）
    const feedback: EvolutionFeedback = {
      failedShots: 0,
      totalShots: schedule.filter(s => s.estimatedCost.latency === 1).length,
      cost: cost.total.computeUnits,
      avgLatency: cost.total.latency,
      totalRenderTime: cost.total.renderTime,
    }

    // Step 5: 适应性调整
    const adaptation = this.adaptiveExecutor.adapt({
      failedItems: feedback.failedShots,
      totalItems: feedback.totalShots,
      avgLatency: feedback.avgLatency,
      costOverThreshold: feedback.cost > 1000,
    })
    trace.push(`自适应调整: ${adaptation.reason}`)

    // Step 6: 蓝图进化
    const evolution = this.evolutionEngine.evolve(raw, feedback)
    trace.push(`蓝图进化: ${evolution.optimizationMode} — ${evolution.appliedOptimizations.length} 项优化`)

    return {
      optimizedBlueprint: raw,
      schedule,
      cost,
      evolution,
      adaptation,
      trace,
    }
  }
}
