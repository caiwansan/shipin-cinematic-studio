/**
 * Optimization Decision Layer — Types
 *
 * These are the standardized types used to communicate optimization
 * decisions to the frontend. They translate raw analytics (bottlenecks,
 * costs, signals) into "executable advice" that the Studio can consume.
 */

// ── Issue — something wrong with the graph ──
export type IssueType = 'BOTTLENECK' | 'COST_HOTSPOT' | 'SCHEMA' | 'PARALLEL_MISS'

export interface OptimizationIssue {
  type: IssueType
  nodeId: string
  impact: number      // 0-100, how much this issue impacts overall performance
  severity: 'critical' | 'warning' | 'info'
  message: string
}

// ── Suggestion — what can be done ──
export type SuggestionAction = 'SPLIT' | 'CACHE' | 'PARALLELIZE' | 'REORDER' | 'REPLACE_MODEL'

export interface OptimizationSuggestion {
  action: SuggestionAction
  targetNodes: string[]
  expectedGain: {
    latencyPct?: number
    costPct?: number
  }
  description: string
}

// ── Heatmap — per-node optimization score ──
export interface NodeOptimizationScore {
  nodeId: string
  score: number       // 0-100
  color: 'green' | 'yellow' | 'red'
  label: string       // node type or label for display
}

// ── Top-level result ──
export interface OptimizationResult {
  score: number       // 0-100, pipeline efficiency
  issues: OptimizationIssue[]
  suggestions: OptimizationSuggestion[]
  heatmap: NodeOptimizationScore[]
  generatedAt: number
}
