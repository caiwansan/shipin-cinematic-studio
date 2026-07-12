// ============================================================
// RC3-3 — StaticEstimator
// ============================================================
// 静态估算器 — 基于注册的 Provider 成本/延迟数据
// 不依赖历史数据，不调用 AI Provider。
// 只算不改 — 不调整 Provider 分配、不修改 DAG、不调用 Scheduler。

import type { IEstimator } from './estimator.interface'
import type {
  EstimationResult,
  CriticalPathAnalysis,
  ResourceSummary,
  NodeEstimate,
  PredictionContext,
} from './prediction.types'

export class StaticEstimator implements IEstimator {
  name = 'static'

  /**
   * 静态估算 — 基于注册的 Provider 平均延迟和成本数据
   */
  async estimate(context: PredictionContext): Promise<EstimationResult> {
    const assumptions: string[] = [
      'Estimated based on registered provider average latency and cost',
      'Does not include actual runtime variations',
      'Parallel execution assumes no resource contention',
    ]

    // 1. 估算每个节点的成本和时间
    const nodeEstimates: NodeEstimate[] = context.assignments.map(assignment => {
      const costPerToken = context.providerCostMap.get(assignment.assignedTo) || 1
      const avgLatency = context.providerLatencyMap.get(assignment.assignedTo) || 1000

      // 基础时长：latency × 类型加权
      const typeFactor = this.getTypeFactor(assignment.resourceType)
      const estimatedDuration = avgLatency * typeFactor

      // 基础成本：假设平均 500 tokens 每次调用
      const estimatedTokens = 500
      const estimatedCost = estimatedTokens * costPerToken

      return {
        nodeId: assignment.nodeId,
        estimatedDuration,
        estimatedCost,
        assignedProvider: assignment.assignedTo,
        capability: assignment.capability,
        resourceType: assignment.resourceType,
      }
    })

    // 2. 关键路径分析（基于 Assignment 顺序）
    const criticalPath = this.analyzeCriticalPath(context, nodeEstimates)

    // 3. 资源汇总
    const resourceSummary = this.summarizeResources(nodeEstimates)

    // 4. 总成本和时间
    const estimatedCost = nodeEstimates.reduce((sum, n) => sum + n.estimatedCost, 0)
    const estimatedDuration = criticalPath.criticalDuration

    return {
      estimatedDuration,
      estimatedCost,
      confidence: 'medium', // 静态估算总是 medium
      criticalPath,
      resourceSummary,
      nodeEstimates,
      assumptions,
    }
  }

  /**
   * 根据资源类型获取时间加权因子
   */
  private getTypeFactor(type: string): number {
    const factors: Record<string, number> = {
      llm_provider: 1.0,
      crawler: 3.0,
      browser: 5.0,
      knowledge_index: 2.0,
      publishing_adapter: 1.5,
      webhook: 0.5,
      human_review: 60000,  // 人工审核 ≈ 1分钟
      gpu_worker: 10.0,
      background_job: 2.0,
      custom: 1.0,
    }
    return factors[type] || 1.0
  }

  /**
   * 关键路径分析
   * 简化处理：按 assignment 顺序估算（串行执行）
   * 真正的关键路径需要 DAG 拓扑排序（未来可扩展）
   */
  private analyzeCriticalPath(
    context: PredictionContext,
    estimates: NodeEstimate[],
  ): CriticalPathAnalysis {
    if (estimates.length === 0) {
      return {
        pathNodeIds: [],
        criticalDuration: 0,
        totalDuration: 0,
        parallelizableDuration: 0,
        parallelismFactor: 0,
        bottleneckNodeId: null,
      }
    }

    const pathNodeIds = estimates.map(e => e.nodeId)
    const totalDuration = estimates.reduce((sum, e) => sum + e.estimatedDuration, 0)
    const criticalDuration = totalDuration // 简化：串行执行
    const parallelizableDuration = Math.max(0, totalDuration - criticalDuration)

    // 找瓶颈（估算时长最长的节点）
    let bottleneckNodeId: string | null = null
    let maxDuration = 0
    for (const e of estimates) {
      if (e.estimatedDuration > maxDuration) {
        maxDuration = e.estimatedDuration
        bottleneckNodeId = e.nodeId
      }
    }

    return {
      pathNodeIds,
      criticalDuration: totalDuration,
      totalDuration,
      parallelizableDuration,
      parallelismFactor: context.edgeCount > 0 ? 0.3 : 0.0, // 有依赖关系时并行度较低
      bottleneckNodeId,
    }
  }

  /**
   * 按资源类型汇总
   */
  private summarizeResources(estimates: NodeEstimate[]): ResourceSummary[] {
    const grouped = new Map<string, {
      count: number
      cost: number
      providers: Map<string, number>
    }>()

    for (const e of estimates) {
      const key = e.resourceType
      if (!grouped.has(key)) {
        grouped.set(key, { count: 0, cost: 0, providers: new Map() })
      }
      const group = grouped.get(key)!
      group.count++
      group.cost += e.estimatedCost
      group.providers.set(
        e.assignedProvider,
        (group.providers.get(e.assignedProvider) || 0) + 1,
      )
    }

    return Array.from(grouped.entries()).map(([type, data]) => ({
      resourceType: type,
      count: data.count,
      estimatedUsage: data.count * 500, // 估算 tokens
      estimatedCost: data.cost,
      providers: Array.from(data.providers.entries()).map(([name, count]) => ({
        name,
        count,
      })),
    }))
  }
}
