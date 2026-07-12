// ============================================================
// RC2-3b — FallbackResolver
// 按 spec 3. Fallback Resolution Rule 实现
//
// 架构约束:
//   - 不修改原始 ExecutionGraph.nodes（悬挂子图模式）
//   - 只读 Circuit Breaker（allowRequest），不修改 CB 状态
//   - 不调用 CapabilityRouter（只接收 availableProviders 作为参数）
//   - 不触发 RetryPolicy
// ============================================================

import type { ExecutionNode, ExecutionGraph, ExecutionEvent } from '../types'
import type { FallbackNode, FallbackGraph, FallbackConfig } from './fallback.types'
import type { ProviderRegistration } from '../provider/types'
import { createExecutionEvent } from '../event'

// ─── Public Interface ───

export interface IFallbackResolver {
  /**
   * 为失败的节点构建 fallback graph
   * @param failedNode — 失败的 ExecutionNode
   * @param availableProviders — 当前可用的 provider 列表（从 CapabilityRouter/Pipeline 传入）
   * @param executionGraph — 当前执行图（用于排除已使用 provider）
   * @param circuitBreaker — 可选，用于检查 CB 状态（只读 allowRequest）
   * @param config — FallbackConfig
   */
  resolve(
    failedNode: ExecutionNode,
    availableProviders: ProviderRegistration[],
    executionGraph: ExecutionGraph,
    circuitBreaker?: { allowRequest(provider: string): Promise<boolean> },
    config?: FallbackConfig,
  ): Promise<{
    fallbackGraph: FallbackGraph
    events: ExecutionEvent[]
  }>

  /**
   * 选中 fallback 链中的下一个 provider
   * @param fallbackGraph — 当前 fallback graph
   */
  selectNext(fallbackGraph: FallbackGraph): Promise<{
    nextNode: FallbackNode | null
    events: ExecutionEvent[]
  }>
}

// ─── Default Config Factory ───

export function createDefaultFallbackConfig(
  overrides?: Partial<FallbackConfig>,
): FallbackConfig {
  return {
    maxFallbackLevel: 2,
    requireCircuitCheck: true,
    ...overrides,
  }
}

// ─── Implementation ───

export class FallbackResolver implements IFallbackResolver {
  async resolve(
    failedNode: ExecutionNode,
    availableProviders: ProviderRegistration[],
    executionGraph: ExecutionGraph,
    circuitBreaker?: { allowRequest(provider: string): Promise<boolean> },
    config?: FallbackConfig,
  ): Promise<{ fallbackGraph: FallbackGraph; events: ExecutionEvent[] }> {
    const cfg = config || createDefaultFallbackConfig()
    const events: ExecutionEvent[] = []

    // ── 1. 收集当前 DAG 中已使用的 provider ──
    const usedProviders = this.collectUsedProviders(executionGraph, failedNode.id)

    // ── 2. 构建候选 provider 列表 ──
    const candidates = this.buildCandidates(
      failedNode,
      availableProviders,
      usedProviders,
    )

    // ── 3. 按 priority 排序（低 = 优先） ──
    candidates.sort((a, b) => a.priority - b.priority)

    // ── 4. 检查 Circuit Breaker 状态（只读 allowRequest） ──
    let availableCandidates = candidates
    if (cfg.requireCircuitCheck && circuitBreaker) {
      availableCandidates = []
      for (const c of candidates) {
        const allowed = await circuitBreaker.allowRequest(c.provider)
        if (allowed) {
          availableCandidates.push(c)
        }
      }
    }

    // ── 5. 取前 maxFallbackLevel 个作为 fallback chain ──
    const fallbackNodes: FallbackNode[] = availableCandidates
      .slice(0, cfg.maxFallbackLevel)
      .map((c, index) => ({
        id: `fallback-${failedNode.id}-${index + 1}`,
        originalNodeId: failedNode.id,
        provider: c.provider,
        capability: failedNode.capability,
        fallbackLevel: index + 1,
        priority: c.priority,
      }))

    // ── 6. 构建 FallbackGraph（不修改原始 DAG） ──
    const fallbackGraph: FallbackGraph = {
      id: `fb-${failedNode.id}-${Date.now()}`,
      originalNodeId: failedNode.id,
      fallbackNodes,
      selectedNodeId: fallbackNodes.length > 0 ? fallbackNodes[0].id : null,
      status: fallbackNodes.length > 0 ? 'pending' : 'exhausted',
      createdAt: new Date().toISOString(),
    }

    // ── 7. 生成 node_fallback event ──
    if (fallbackNodes.length > 0) {
      events.push(
        this.createNodeFallbackEvent(
          failedNode,
          executionGraph,
          fallbackNodes,
        ),
      )
    }

    // 架构合规：不修改原始 ExecutionGraph.nodes
    return { fallbackGraph, events }
  }

  async selectNext(
    fallbackGraph: FallbackGraph,
  ): Promise<{ nextNode: FallbackNode | null; events: ExecutionEvent[] }> {
    const events: ExecutionEvent[] = []

    // 已耗尽或已完成，无 next
    if (
      fallbackGraph.status === 'exhausted' ||
      fallbackGraph.status === 'completed'
    ) {
      return { nextNode: null, events }
    }

    // 找到当前选中节点的下标
    const currentIndex = fallbackGraph.fallbackNodes.findIndex(
      n => n.id === fallbackGraph.selectedNodeId,
    )

    // 还没选中 → 返回第一个
    if (currentIndex < 0) {
      if (fallbackGraph.fallbackNodes.length > 0) {
        fallbackGraph.selectedNodeId = fallbackGraph.fallbackNodes[0].id
        fallbackGraph.status = 'active'
        events.push(
          this.createFallbackEventData(fallbackGraph, 1),
        )
        return { nextNode: fallbackGraph.fallbackNodes[0], events }
      }
      return { nextNode: null, events }
    }

    // 尝试下一个
    const nextIndex = currentIndex + 1
    if (nextIndex < fallbackGraph.fallbackNodes.length) {
      fallbackGraph.selectedNodeId = fallbackGraph.fallbackNodes[nextIndex].id
      fallbackGraph.status = 'active'
      events.push(
        this.createFallbackEventData(fallbackGraph, nextIndex + 1),
      )
      return { nextNode: fallbackGraph.fallbackNodes[nextIndex], events }
    }

    // 全部用完
    fallbackGraph.status = 'exhausted'
    return { nextNode: null, events }
  }

  // ── Private Helpers ──

  /**
   * 从 ExecutionGraph 中收集已使用的 provider
   */
  private collectUsedProviders(
    graph: ExecutionGraph,
    excludeNodeId: string,
  ): Set<string> {
    const providers = new Set<string>()
    for (const node of graph.nodes) {
      if (node.id === excludeNodeId) continue
      if (node.artifact?.metadata?.provider) {
        providers.add(node.artifact.metadata.provider)
      }
    }
    return providers
  }

  /**
   * 构建候选列表
   * - 排除已使用的 provider
   * - 排除和原始节点相同的 provider
   * - 只保留匹配 failedNode.capability 的能力
   */
  private buildCandidates(
    failedNode: ExecutionNode,
    availableProviders: ProviderRegistration[],
    usedProviders: Set<string>,
  ): { provider: string; priority: number }[] {
    const failedProvider = failedNode.artifact?.metadata?.provider
    const candidates: { provider: string; priority: number }[] = []

    for (const reg of availableProviders) {
      // 排除已使用的 provider
      if (usedProviders.has(reg.provider)) continue

      // 排除和原始节点相同的 provider
      if (failedProvider && reg.provider === failedProvider) continue

      // 找到匹配的能力
      const cap = reg.capabilities.find(
        c => c.capability === failedNode.capability,
      )
      if (!cap) continue

      candidates.push({
        provider: reg.provider,
        priority: cap.priority,
      })
    }

    return candidates
  }

  /**
   * 创建 node_fallback event（resolve 时用）
   */
  private createNodeFallbackEvent(
    failedNode: ExecutionNode,
    graph: ExecutionGraph,
    fallbackNodes: FallbackNode[],
  ): ExecutionEvent {
    return createExecutionEvent({
      executionId: graph.context.executionId,
      graphId: graph.id,
      type: 'node_fallback',
      nodeId: failedNode.id,
      data: {
        originalNodeId: failedNode.id,
        originalProvider: failedNode.artifact?.metadata?.provider || 'unknown',
        fallbackChain: fallbackNodes.map(n => ({
          id: n.id,
          provider: n.provider,
          level: n.fallbackLevel,
        })),
        selectedNodeId: fallbackNodes[0].id,
        fallbackProvider: fallbackNodes[0].provider,
        fallbackLevel: 1,
        remainingLevels: fallbackNodes.length - 1,
      },
    })
  }

  /**
   * 创建 selectNext 的 fallback event
   */
  private createFallbackEventData(
    graph: FallbackGraph,
    level: number,
  ): ExecutionEvent {
    const selected = graph.fallbackNodes.find(
      n => n.id === graph.selectedNodeId,
    )
    return createExecutionEvent({
      executionId: `fb-${Date.now()}`,
      graphId: graph.id,
      type: 'node_fallback',
      nodeId: graph.originalNodeId,
      data: {
        originalNodeId: graph.originalNodeId,
        fallbackChain: graph.fallbackNodes.map(n => ({
          id: n.id,
          provider: n.provider,
          level: n.fallbackLevel,
        })),
        selectedNodeId: graph.selectedNodeId,
        fallbackProvider: selected?.provider || 'unknown',
        fallbackLevel: level,
        remainingLevels: graph.fallbackNodes.length - level,
      },
    })
  }
}
