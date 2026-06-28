/**
 * Bottleneck Analyzer — finds the slowest parts of a pipeline run
 *
 * Input: run events + node states
 * Output: bottleneck identification + timing distribution
 */

import type { RuntimeRunEvent } from '../../api/runtime/run.model.js'

export interface BottleneckResult {
  slowestNodeId: string
  slowestNodeType: string
  slowestDurationMs: number
  impactPct: number           // % of total pipeline time
  totalDurationMs: number

  allNodeTimings: Array<{
    nodeId: string
    nodeType: string
    durationMs: number
    pctOfTotal: number
  }>

  timingDistribution: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }
}

/**
 * Analyze bottleneck from events + node states
 */
export function analyzeBottleneck(
  events: RuntimeRunEvent[],
  nodeStates: Record<string, { status: string; startedAt?: number; finishedAt?: number; durationMs?: number }>,
): BottleneckResult {
  // Build per-node timing from nodeStates
  const nodeTimings: Record<string, {
    nodeId: string
    nodeType: string
    durationMs: number
  }> = {}

  for (const [nodeId, state] of Object.entries(nodeStates)) {
    const nodeEvent = events.find(e => e.nodeId === nodeId && e.type === 'node:start')
    const nodeType = nodeEvent?.nodeType ?? 'unknown'
    const dur = state.durationMs ?? (state.startedAt && state.finishedAt ? state.finishedAt - state.startedAt : 0)
    nodeTimings[nodeId] = { nodeId, nodeType, durationMs: dur }
  }

  // Fallback: derive from events if nodeStates missing timings
  if (Object.keys(nodeTimings).length === 0) {
    for (const event of events) {
      if (event.type === 'node:complete' && event.nodeId && event.durationMs) {
        nodeTimings[event.nodeId] = {
          nodeId: event.nodeId,
          nodeType: event.nodeType ?? 'unknown',
          durationMs: event.durationMs,
        }
      }
    }
  }

  const timings = Object.values(nodeTimings)
  if (timings.length === 0) {
    return {
      slowestNodeId: '',
      slowestNodeType: '',
      slowestDurationMs: 0,
      impactPct: 0,
      totalDurationMs: 0,
      allNodeTimings: [],
      timingDistribution: { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 },
    }
  }

  timings.sort((a, b) => b.durationMs - a.durationMs)
  const total = timings.reduce((s, t) => s + t.durationMs, 0)
  const slowest = timings[0]

  const durations = timings.map(t => t.durationMs).sort((a, b) => a - b)
  const distribution = {
    min: durations[0],
    max: durations[durations.length - 1],
    avg: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
  }

  // Find run duration from run:start → run:complete events
  const startEvent = events.find(e => e.type === 'run:start')
  const completeEvent = events.find(e => e.type === 'run:complete' || e.type === 'run:failed')
  const totalDurationMs = startEvent && completeEvent
    ? completeEvent.timestamp - startEvent.timestamp
    : total

  return {
    slowestNodeId: slowest.nodeId,
    slowestNodeType: slowest.nodeType,
    slowestDurationMs: slowest.durationMs,
    impactPct: total > 0 ? Math.round((slowest.durationMs / totalDurationMs) * 100) : 0,
    totalDurationMs,
    allNodeTimings: timings.map(t => ({
      ...t,
      pctOfTotal: total > 0 ? Math.round((t.durationMs / totalDurationMs) * 100) : 0,
    })),
    timingDistribution: distribution,
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}
