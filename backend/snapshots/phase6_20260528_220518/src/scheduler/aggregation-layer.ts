/**
 * Graph Completion Aggregator
 * 
 * 收集所有 graph 输出，合并 AIGC production result，
 * 输出最终 project package。
 */

import { type GraphOutput } from './graph-scheduler.js'
import { graphScheduler } from './graph-scheduler.js'

// ============================================================
// Aggregated Result
// ============================================================

export interface AggregatedProductionResult {
  projectId: string
  status: 'completed' | 'partial' | 'degraded'
  totalGraphs: number
  completedGraphs: number
  degradedGraphs: number
  totalCost: number
  totalLatency: number
  graphs: GraphOutput[]
  mergedOutput: {
    characters: any[]
    scenes: any[]
    storyboards: any[]
    videos: any[]
  }
}

/**
 * 聚合所有 graph 输出为统一的 production result
 */
export function aggregateProjectResult(projectId: string): AggregatedProductionResult {
  const allOutputs = graphScheduler.getAllOutputs()
  const projectOutputs = allOutputs.filter(g => g.projectId === projectId)

  const completed = projectOutputs.filter(g => g.status === 'completed')
  const degraded = projectOutputs.filter(g => g.status === 'degraded')

  // 合并输出
  const merged = {
    characters: [] as any[],
    scenes: [] as any[],
    storyboards: [] as any[],
    videos: [] as any[],
  }

  for (const output of projectOutputs) {
    const result = output.result?.runtimeResult || {}
    // 从各 graph 的 context 中收集产出
    if (result.characters) merged.characters.push(...result.characters)
    if (result.scenes) merged.scenes.push(...result.scenes)
    if (result.storyboards) merged.storyboards.push(...result.storyboards)
    if (result.videos) merged.videos.push(...result.videos)
  }

  return {
    projectId,
    status: degraded.length === 0 ? 'completed' : completed.length > 0 ? 'partial' : 'degraded',
    totalGraphs: projectOutputs.length,
    completedGraphs: completed.length,
    degradedGraphs: degraded.length,
    totalCost: projectOutputs.reduce((sum, g) => sum + (g.cost || 0), 0),
    totalLatency: projectOutputs.reduce((sum, g) => sum + (g.latency || 0), 0),
    graphs: projectOutputs,
    mergedOutput: merged,
  }
}

/**
 * API 响应封装
 */
export function formatSchedulerResponse(aggregated: AggregatedProductionResult) {
  return {
    success: true,
    degraded: aggregated.status !== 'completed',
    data: {
      projectId: aggregated.projectId,
      status: aggregated.status,
      graphs: aggregated.graphs.map(g => ({
        graphId: g.graphId,
        status: g.status,
        nodesCompleted: g.nodesCompleted,
        nodesFailed: g.nodesFailed,
        latencyMs: g.latency,
      })),
      mergedOutput: aggregated.mergedOutput,
    },
    meta: {
      totalCost: aggregated.totalCost,
      totalLatency: aggregated.totalLatency,
      totalGraphs: aggregated.totalGraphs,
      completedGraphs: aggregated.completedGraphs,
      degradedGraphs: aggregated.degradedGraphs,
    },
  }
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

