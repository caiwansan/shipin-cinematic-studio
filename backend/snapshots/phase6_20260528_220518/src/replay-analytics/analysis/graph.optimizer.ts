/**
 * Graph Optimizer — generates optimization suggestions from run analysis
 *
 * This is the core "system intelligence" piece that turns raw metrics
 * into actionable improvements.
 */

import type { BottleneckResult } from './bottleneck.analyzer.js'
import type { CostAnalysisResult } from './cost.analyzer.js'
import type { OptimizationSignal } from '../metrics/execution.metrics.js'

export interface GraphOptimizationResult {
  suggestions: OptimizationSignal[]
  score: number          // 0-100, how optimized the pipeline is
  summary: string
}

/**
 * Analyze metrics and generate optimization suggestions
 */
export function analyzeGraphOptimization(
  bottleneck: BottleneckResult,
  cost: CostAnalysisResult,
  events: any[],
  graph?: { nodes?: any[]; edges?: any[] },
): GraphOptimizationResult {
  const suggestions: OptimizationSignal[] = []

  // 1. Serial bottleneck — if one node dominates >50% time
  if (bottleneck.impactPct >= 50) {
    suggestions.push({
      type: 'serial_bottleneck',
      severity: 'critical',
      title: `序列瓶颈: ${bottleneck.slowestNodeType}`,
      description: `${bottleneck.slowestNodeType} 占用 ${bottleneck.impactPct}% 的总执行时间`,
      nodeIds: [bottleneck.slowestNodeId],
      impactPct: bottleneck.impactPct,
      suggestedAction: `考虑将 ${bottleneck.slowestNodeType} 拆分为并行子任务或使用更快的模型`,
      code: 'serial_bottleneck',
    })
  }

  // 2. High cost node (>50% of total cost)
  if (cost.costHotspot && cost.totalCostUsd > 0) {
    const hotspotCost = cost.costPerNodeType[cost.costHotspot] ?? 0
    const hotspotPct = cost.totalCostUsd > 0 ? Math.round((hotspotCost / cost.totalCostUsd) * 100) : 0
    if (hotspotPct >= 40) {
      suggestions.push({
        type: 'high_cost_node',
        severity: 'warning',
        title: `成本热点: ${cost.costHotspot}`,
        description: `${cost.costHotspot} 占 ${hotspotPct}% 总成本 ($${(cost.totalCostUsd).toFixed(4)})`,
        nodeIds: cost.breakdown.filter(b => b.nodeType === cost.costHotspot).map(b => b.nodeId),
        impactPct: hotspotPct,
        suggestedAction: `考虑切换到成本更低的模型或减少 ${cost.costHotspot} 的输出长度`,
        code: 'high_cost_node',
      })
    }
  }

  // 3. Detect parallelizable nodes from graph structure
  if (graph?.nodes && graph?.edges) {
    const serialPairs = findSerialPairs(graph.nodes, graph.edges)
    for (const pair of serialPairs) {
      suggestions.push({
        type: 'parallelizable_path',
        severity: 'info',
        title: '可并行化路径',
        description: `${pair[0]}.${pair[1]} 之间没有数据依赖，可并行执行`,
        nodeIds: [pair[0], pair[1]],
        impactPct: 20,
        suggestedAction: '使用 parallel 节点包装这两个路径',
        code: 'parallelizable_path',
      })
    }
  }

  // 4. Cacheable output (repeated same type nodes)
  const typeCounts: Record<string, number> = {}
  if (graph?.nodes) {
    for (const node of graph.nodes) {
      typeCounts[node.type] = (typeCounts[node.type] ?? 0) + 1
    }
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count >= 2 && ['image_gen', 'prompt_builder', 'shot_split'].includes(type)) {
        suggestions.push({
          type: 'cacheable_output',
          severity: 'info',
          title: `${type} 节点可缓存`,
          description: `${count} 个同类型节点可共享输出缓存`,
          nodeIds: graph.nodes.filter(n => n.type === type).map(n => n.id),
          impactPct: 30,
          suggestedAction: `启用 ${type} 输出缓存，类似输入的 prompt 直接复用结果`,
          code: 'cacheable_output',
        })
      }
    }
  }

  // Calculate optimization score (lower = needs more work)
  const score = calculateScore(suggestions, bottleneck, cost)

  return {
    suggestions,
    score,
    summary: generateSummary(score, suggestions.length),
  }
}

function findSerialPairs(nodes: any[], edges: any[]): [string, string][] {
  const pairs: [string, string][] = []
  const edgeSet = new Set(edges.map((e: any) => {
    const s = typeof e.source === 'object' ? e.source.nodeId : e.source
    const t = typeof e.target === 'object' ? e.target.nodeId : e.target
    return `${s}->${t}`
  }))

  // Find nodes that COULD be parallel but are serial
  for (let i = 0; i < Math.min(nodes.length - 1, 10); i++) {
    for (let j = i + 1; j < Math.min(nodes.length, 10); j++) {
      const idA = nodes[i].id
      const idB = nodes[j].id
      // Check no direct edge between A and B
      if (!edgeSet.has(`${idA}->${idB}`) && !edgeSet.has(`${idB}->${idA}`)) {
        pairs.push([idA, idB])
      }
    }
  }
  return pairs
}

function calculateScore(
  suggestions: OptimizationSignal[],
  bottleneck: BottleneckResult,
  cost: CostAnalysisResult,
): number {
  let score = 100
  if (bottleneck.impactPct > 50) score -= 20
  if (bottleneck.impactPct > 80) score -= 10
  if (cost.totalCostUsd > 0.05) score -= 10
  if (suggestions.length >= 5) score -= 10
  const critical = suggestions.filter(s => s.severity === 'critical').length
  score -= critical * 15
  return Math.max(0, Math.min(100, score))
}

function generateSummary(score: number, suggestionCount: number): string {
  if (score >= 90) return '流水线执行状况良好，无显著优化需求'
  if (score >= 70) return '流水线基本高效，有少量可优化项'
  if (score >= 50) return '流水线有优化空间，建议按建议逐步改进'
  return '流水线存在严重瓶颈，建议优先处理关键优化项'
}
