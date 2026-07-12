// ============================================================
// RC3-2 — ResourceAllocator
// 执行图资源分配器（AssignmentBuilder）
// ============================================================
// 核心职责:
//   为 ExecutionGraph 的每个节点分配最优资源（当前为 Provider）
//
// 架构约束:
//   1. 不触发 Retry（属于 Runtime Core）
//   2. 不更新 Provider Health（属于 Health Monitor）
//   3. 不调用 Scheduler
//   4. 不做 Cost Prediction（属于 RC3-3）
//   5. 不修改 RC1 / RC2 / RC3-1 代码
//
// 策略模式:
//   - fastest  — 最低延迟
//   - cheapest — 最低成本
//   - balanced — 综合加权

import type { ExecutionGraph } from '../types'
import type { ProviderHealth } from '../provider/provider-health'
import { ProviderRegistry } from '../provider/provider-registry'
import type { IAllocationStrategy } from './strategies/strategy.interface'
import { FastestStrategy } from './strategies/fastest.strategy'
import { CheapestStrategy } from './strategies/cheapest.strategy'
import { BalancedStrategy } from './strategies/balanced.strategy'
import type {
  ExecutionAssignment,
  AllocationResult,
  AllocationWarning,
} from './resource.types'

export class ResourceAllocator {
  private strategies: Map<string, IAllocationStrategy>

  constructor(
    private providerRegistry: ProviderRegistry,
    private healthService?: { getAllHealth(): Promise<Map<string, ProviderHealth>> },
  ) {
    this.strategies = new Map()
    this.strategies.set('fastest', new FastestStrategy())
    this.strategies.set('cheapest', new CheapestStrategy())
    this.strategies.set('balanced', new BalancedStrategy())
  }

  /**
   * 为 ExecutionGraph 分配资源
   * @param graph 执行图
   * @param strategy 分配策略名称（默认 fastest）
   */
  async allocate(
    graph: ExecutionGraph,
    strategy: string = 'fastest',
  ): Promise<AllocationResult> {
    const startTime = Date.now()
    const warnings: AllocationWarning[] = []
    const assignments: ExecutionAssignment[] = []

    // 1. 获取 health 信息
    let healthMap = new Map<string, ProviderHealth>()
    if (this.healthService) {
      healthMap = await this.healthService.getAllHealth()
    }

    // 2. 获取策略
    const allocationStrategy = this.strategies.get(strategy) ?? this.strategies.get('fastest')!
    if (!allocationStrategy) {
      throw new Error(`Unknown allocation strategy: ${strategy}`)
    }

    // 3. 遍历所有节点进行分配
    for (const node of graph.nodes) {
      // 获取拥有该能力的 Provider 列表
      const candidates = this.providerRegistry.getProvidersByCapability(node.capability)

      if (candidates.length === 0) {
        warnings.push({
          code: 'CAPABILITY_NOT_FOUND',
          message: `No provider found for capability: ${node.capability} on node ${node.id}`,
          nodeId: node.id,
        })
        continue
      }

      // 按策略分配
      const result = await allocationStrategy.allocate({
        node,
        candidates,
        healthMap,
        policy: strategy,
      })

      if (result) {
        assignments.push({
          nodeId: node.id,
          capability: node.capability,
          assignedTo: result.provider,
          resourceType: 'llm_provider',
          priority: result.priority,
          reason: result.reason,
        })
      } else {
        warnings.push({
          code: 'NO_PROVIDER_AVAILABLE',
          message: `No suitable provider for node ${node.id} with capability ${node.capability}`,
          nodeId: node.id,
        })
      }
    }

    return {
      graphId: graph.id,
      requestId: `alloc-${graph.id}`,
      assignments,
      strategy,
      warnings,
      diagnostics: {
        totalNodes: graph.nodes.length,
        allocated: assignments.length,
        unallocated: graph.nodes.length - assignments.length,
        strategyUsed: strategy,
        duration: Date.now() - startTime,
      },
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 注册自定义策略
   */
  registerStrategy(name: string, strategy: IAllocationStrategy): void {
    this.strategies.set(name, strategy)
  }
}
