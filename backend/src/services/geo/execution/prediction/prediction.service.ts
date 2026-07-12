// ============================================================
// RC3-3 — PredictionService
// ============================================================
// 估算流程编排器。
// 为 ExecutionGraph + Assignments 生成预测，供 PlanningResult 展示。
// Runtime 不关心任何预测值。

import type { ExecutionGraph } from '../types'
import type { ExecutionAssignment } from '../resource/resource.types'
import type { IEstimator } from './estimator.interface'
import { StaticEstimator } from './static-estimator'
import type { EstimationResult } from './prediction.types'

export class PredictionService {
  private estimator: IEstimator

  constructor(estimator?: IEstimator) {
    this.estimator = estimator || new StaticEstimator()
  }

  /**
   * 切换估算器
   */
  setEstimator(estimator: IEstimator): void {
    this.estimator = estimator
  }

  /**
   * 获取当前估算器名称
   */
  getEstimatorName(): string {
    return this.estimator.name
  }

  /**
   * 为 ExecutionGraph + Assignments 生成预测
   *
   * @param graph - ExecutionGraph（用于获取节点/边计数和 ID）
   * @param assignments - 资源分配结果
   * @param providerData - 可选的 Provider 成本/延迟数据（未提供则使用默认值）
   */
  async predict(
    graph: ExecutionGraph,
    assignments: ExecutionAssignment[],
    providerData?: {
      costMap?: Map<string, number>
      latencyMap?: Map<string, number>
    },
  ): Promise<EstimationResult> {
    const costMap = providerData?.costMap || new Map<string, number>()
    const latencyMap = providerData?.latencyMap || new Map<string, number>()

    // 如果未提供数据，使用默认值
    if (costMap.size === 0) {
      costMap.set('deepseek', 0.5)
      costMap.set('chatgpt', 2.0)
      costMap.set('claude', 3.0)
      costMap.set('doubao', 0.8)
      costMap.set('xinghuo', 0.6)
    }
    if (latencyMap.size === 0) {
      latencyMap.set('deepseek', 899)
      latencyMap.set('chatgpt', 1500)
      latencyMap.set('claude', 2000)
      latencyMap.set('doubao', 1200)
      latencyMap.set('xinghuo', 1000)
    }

    return this.estimator.estimate({
      graphId: graph.id,
      assignments,
      providerCostMap: costMap,
      providerLatencyMap: latencyMap,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    })
  }
}
