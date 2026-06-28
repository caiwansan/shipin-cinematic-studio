/**
 * Analytics Engine — orchestrates all analysis passes on a run
 *
 * Input: runId → fetches replay data → runs all analyzers → returns insights
 */

import { getRunReplayData } from '../../api/runtime/runtime.service.js'
import { analyzeBottleneck } from './bottleneck.analyzer.js'
import { analyzeCost } from './cost.analyzer.js'
import { analyzeGraphOptimization } from './graph.optimizer.js'
import type { RunMetricsAggregate, ExecutionMetrics } from '../metrics/execution.metrics.js'

export interface RunAnalyticsResult {
  runId: string
  pipelineId: string
  status: string
  metrics: RunMetricsAggregate
  bottleneck: ReturnType<typeof analyzeBottleneck>
  cost: ReturnType<typeof analyzeCost>
  optimization: ReturnType<typeof analyzeGraphOptimization>
  generatedAt: number
}

/**
 * Analyze a single run — the entry point for all analytics
 */
export async function analyzeRun(runId: string): Promise<RunAnalyticsResult> {
  const replayData = await getRunReplayData(runId)
  if (!replayData) {
    throw new Error(`Run not found: ${runId}`)
  }

  const { run, events, artifacts, nodeStates } = replayData

  // 1. Bottleneck analysis
  const bottleneck = analyzeBottleneck(events, nodeStates)

  // 2. Cost analysis
  const cost = analyzeCost(events, nodeStates, artifacts)

  // 3. Graph optimization
  const graphSnap = (run as any).graphSnapshot ?? null
  const optimization = analyzeGraphOptimization(bottleneck, cost, events, graphSnap)

  // 4. Aggregate per-node metrics
  const perNode: RunMetricsAggregate['perNode'] = {}
  for (const [nodeId, state] of Object.entries(nodeStates)) {
    const nodeEvent = events.find(e => e.nodeId === nodeId)
    perNode[nodeId] = {
      nodeType: nodeEvent?.nodeType ?? 'unknown',
      metrics: {
        timing: {
          durationMs: state.durationMs ?? 0,
        },
      },
      optimizationHint: findOptimizationHint(nodeId, optimization.suggestions),
    }
  }

  // 5. Build aggregate
  const timingDist = bottleneck.timingDistribution
  const metrics: RunMetricsAggregate = {
    runId,
    totalDurationMs: bottleneck.totalDurationMs,
    totalCostUsd: cost.totalCostUsd,
    totalTokens: cost.totalTokens,
    nodeCount: Object.keys(nodeStates).length,
    completedCount: Object.values(nodeStates).filter(s => s.status === 'completed').length,
    failedCount: Object.values(nodeStates).filter(s => s.status === 'failed').length,
    skippedCount: Object.values(nodeStates).filter(s => s.status === 'skipped').length,
    timingDistribution: timingDist,
    bottleneckNodeId: bottleneck.slowestNodeId || undefined,
    bottleneckNodeType: bottleneck.slowestNodeType || undefined,
    bottleneckImpactPct: bottleneck.impactPct || undefined,
    costBreakdown: cost.costPerNodeType,
    perNode,
  }

  return {
    runId,
    pipelineId: run.pipelineId,
    status: run.status,
    metrics,
    bottleneck,
    cost,
    optimization,
    generatedAt: Date.now(),
  }
}

function findOptimizationHint(nodeId: string, suggestions: any[]): string | undefined {
  for (const s of suggestions) {
    if (s.nodeIds?.includes(nodeId)) {
      return s.type.replace(/_/g, ' ')
    }
  }
  return undefined
}
