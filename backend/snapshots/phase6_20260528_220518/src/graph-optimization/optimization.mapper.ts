/**
 * Optimization Mapper — Translates raw analytics → optimization language
 *
 * This is the core "translation layer" that takes bottleneck analysis,
 * cost analysis, and graph signals, and produces standardized
 * OptimizationResult that the Studio can render as actionable advice.
 *
 * Key principle: we are NOT computing new optimizations here.
 * We are interpreting existing analytics into the OptimizationResult format.
 */

import type { RunAnalyticsResult } from '../replay-analytics/analysis/analytics.engine.js'
import type { OptimizationResult, OptimizationIssue, OptimizationSuggestion, NodeOptimizationScore, IssueType, SuggestionAction } from './optimization.types.js'

/**
 * Map full analytics run result → OptimizationResult
 */
export function mapAnalyticsToOptimization(analytics: RunAnalyticsResult): OptimizationResult {
  const issues = extractIssues(analytics)
  const suggestions = extractSuggestions(analytics, issues)
  const heatmap = buildHeatmap(analytics)
  const score = computeOverallScore(issues, analytics)

  return {
    score,
    issues,
    suggestions,
    heatmap,
    generatedAt: Date.now(),
  }
}

// ── Issue Extraction ──

function extractIssues(analytics: RunAnalyticsResult): OptimizationIssue[] {
  const issues: OptimizationIssue[] = []

  // 1. Bottleneck issues (from bottleneck analyzer)
  const b = analytics.bottleneck
  if (b.slowestNodeId && b.impactPct >= 30) {
    issues.push({
      type: 'BOTTLENECK',
      nodeId: b.slowestNodeId,
      impact: b.impactPct,
      severity: b.impactPct >= 60 ? 'critical' : b.impactPct >= 40 ? 'warning' : 'info',
      message: b.slowestNodeType
        ? `${b.slowestNodeType} 耗时占比 ${b.impactPct}%`
        : `节点 ${b.slowestNodeId} 耗时占比 ${b.impactPct}%`,
    })
  }

  // 2. Per-node detailed bottleneck issues
  for (const timing of b.allNodeTimings ?? []) {
    // Only flag nodes that individually contribute >20% AND are not the slowest (avoid duplicate)
    const pct = b.totalDurationMs > 0 ? Math.round((timing.durationMs / b.totalDurationMs) * 100) : 0
    if (pct >= 20 && timing.nodeId !== b.slowestNodeId) {
      issues.push({
        type: 'BOTTLENECK',
        nodeId: timing.nodeId,
        impact: pct,
        severity: pct >= 40 ? 'warning' : 'info',
        message: `${timing.nodeType} 占用 ${pct}% 执行时间`,
      })
    }
  }

  // 2. Cost hotspot issues
  const c = analytics.cost
  if (c.costHotspot && c.totalCostUsd > 0) {
    const hotspotCost = c.costPerNodeType[c.costHotspot] ?? 0
    const pct = Math.round((hotspotCost / c.totalCostUsd) * 100)
    if (pct >= 30) {
      // Find the specific nodeIds for this hotspot type
      const hotspotNodeIds = c.breakdown
        .filter(b => b.nodeType === c.costHotspot)
        .map(b => b.nodeId)

      for (const nodeId of hotspotNodeIds) {
        issues.push({
          type: 'COST_HOTSPOT',
          nodeId,
          impact: pct,
          severity: pct >= 60 ? 'critical' : 'warning',
          message: `${c.costHotspot} 成本占比 ${pct}%`,
        })
      }
    }
  }

  // 3. Optimization signal issues
  for (const sig of analytics.optimization.suggestions) {
    // Map signal types to issue types
    const issueType = signalToIssueType(sig.type)
    if (!issueType) continue
    for (const nodeId of sig.nodeIds ?? []) {
      // Avoid duplicating bottleneck nodes already flagged
      if (issues.some(i => i.nodeId === nodeId && i.type === 'BOTTLENECK')) continue

      issues.push({
        type: issueType,
        nodeId,
        impact: sig.impactPct ?? 20,
        severity: severityMap(sig.severity),
        message: sig.title,
      })
    }
  }

  return issues
}

function signalToIssueType(signalType: string): IssueType | null {
  if (signalType === 'parallelizable_path') return 'PARALLEL_MISS'
  if (signalType === 'serial_bottleneck') return 'BOTTLENECK'
  if (signalType === 'high_cost_node') return 'COST_HOTSPOT'
  if (signalType === 'cacheable_output') return 'SCHEMA'
  return null
}

function severityMap(s: string): 'critical' | 'warning' | 'info' {
  if (s === 'critical') return 'critical'
  if (s === 'warning') return 'warning'
  return 'info'
}

// ── Suggestion Extraction ──

function extractSuggestions(analytics: RunAnalyticsResult, issues: OptimizationIssue[]): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  const seen = new Set<string>()

  // 1. From optimization signals
  for (const sig of analytics.optimization.suggestions) {
    const action = mapAction(sig.type)
    if (!action) continue
    const key = `${action}-${(sig.nodeIds ?? []).join(',')}`
    if (seen.has(key)) continue
    seen.add(key)

    suggestions.push({
      action,
      targetNodes: sig.nodeIds ?? [],
      expectedGain: {
        latencyPct: sig.type === 'cacheable_output' ? undefined : sig.impactPct,
        costPct: sig.type === 'high_cost_node' ? sig.impactPct : undefined,
      },
      description: sig.suggestedAction || sig.title,
    })
  }

  // 2. Add generic "add parallel node" suggestion for parallel_miss issues
  const parallelMisses = issues.filter(i => i.type === 'PARALLEL_MISS')
  for (const issue of parallelMisses) {
    const key = `PARALLELIZE-${issue.nodeId}`
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push({
      action: 'PARALLELIZE',
      targetNodes: [issue.nodeId],
      expectedGain: { latencyPct: 20 },
      description: `添加 parallel 节点包装 ${issue.nodeId}，利用并行执行缩短总耗时`,
    })
  }

  // 3. Add model replacement suggestion for cost hotspots
  const costHotspots = issues.filter(i => i.type === 'COST_HOTSPOT')
  for (const issue of costHotspots) {
    const key = `REPLACE_MODEL-${issue.nodeId}`
    if (seen.has(key)) continue
    seen.add(key)
    suggestions.push({
      action: 'REPLACE_MODEL',
      targetNodes: [issue.nodeId],
      expectedGain: { costPct: Math.min(issue.impact, 60) },
      description: `为 ${issue.nodeId} 切换到更低成本的模型，预期降低 ${Math.min(issue.impact, 60)}% 成本`,
    })
  }

  return suggestions
}

function mapAction(signalType: string): SuggestionAction | null {
  switch (signalType) {
    case 'serial_bottleneck': return 'SPLIT'
    case 'high_cost_node': return 'REPLACE_MODEL'
    case 'parallelizable_path': return 'PARALLELIZE'
    case 'cacheable_output': return 'CACHE'
    default: return null
  }
}

// ── Heatmap ──

function buildHeatmap(analytics: RunAnalyticsResult): NodeOptimizationScore[] {
  const result: NodeOptimizationScore[] = []
  const perNode = analytics.metrics.perNode ?? {}

  for (const [nodeId, nodeMetrics] of Object.entries(perNode)) {
    const score = computeNodeScore(nodeId, nodeMetrics, analytics)
    result.push({
      nodeId,
      score,
      color: score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red',
      label: nodeMetrics.nodeType,
    })
  }

  return result.sort((a, b) => a.score - b.score) // worst first
}

function computeNodeScore(
  nodeId: string,
  nodeMetrics: any,
  analytics: RunAnalyticsResult,
): number {
  let score = 100

  // Penalize by timing (slow nodes)
  const totalMs = analytics.metrics.totalDurationMs || 1
  const nodeMs = nodeMetrics.metrics?.timing?.durationMs ?? 0
  const pct = (nodeMs / totalMs) * 100
  if (pct > 50) score -= 40
  else if (pct > 30) score -= 20
  else if (pct > 15) score -= 10

  // Penalize by cost
  const costBreakdown = analytics.metrics.costBreakdown ?? {}
  const nodeType = nodeMetrics.nodeType
  const typeCost = costBreakdown[nodeType]
  const totalCost = analytics.metrics.totalCostUsd || 0.001
  if (typeCost && (typeCost / totalCost) > 0.5) score -= 20
  else if (typeCost && (typeCost / totalCost) > 0.3) score -= 10

  // Check if this node has optimization hints
  if (nodeMetrics.optimizationHint) score -= 15

  return Math.max(0, Math.min(100, score))
}

// ── Overall Score ──

function computeOverallScore(issues: OptimizationIssue[], analytics: RunAnalyticsResult): number {
  let score = 100

  // Deduct for critical issues
  const criticals = issues.filter(i => i.severity === 'critical')
  const warnings = issues.filter(i => i.severity === 'warning')
  score -= criticals.length * 20
  score -= warnings.length * 10

  // Deduct for overall optimization signals count
  score -= Math.min(analytics.optimization.suggestions.length * 5, 20)

  // Boost if pipeline is complete and healthy
  if (analytics.metrics.failedCount === 0 && analytics.optimization.score >= 80) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}
