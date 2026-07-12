/**
 * flowTrace — Semantic Transition Trace Layer
 *
 * Records every semantic transition with full context.
 * This is the system's "memory layer" — every decision is logged.
 *
 * Architecture:
 *   - Singleton: all orchestration components share one trace log
 *   - Immutable entries: once written, never mutated
 *   - Bounded: max TRACE_LIMIT entries, oldest dropped
 *   - Serializable: entries can be exported for replay/Golden Journey validation
 *
 * Phase 2: replaces console.log in useSemanticRouter.
 * @beta-stub: 调试工具，生产环境应移除或替换为 trace 库
 * ESLint notes: console.log calls are intentional debug tooling
 *          All semantic transitions go through trace before action.
 */

import type { WorkflowSemanticState } from '../types/state'

/**
 * A single semantic transition trace entry.
 * Written once, never mutated, always appended.
 */
export interface FlowTraceEntry {
  /** Timestamp (epoch ms) */
  t: number
  /** Source of the transition */
  source: 'trigger' | 'watch' | 'resolver'
  /** Triggering event name (if source = 'trigger') */
  event?: string
  /** Previous semantic state */
  from: WorkflowSemanticState | null
  /** Target semantic state */
  to: WorkflowSemanticState
  /** Whether the transition was allowed by state machine */
  allowed: boolean
  /** Resolved route (if applicable) */
  route: string | null
  /** Whether the route was actually pushed */
  committed: boolean
  /** Human-readable reason or error */
  reason?: string
}

// ── Bounded Trace Log ──

const TRACE_LIMIT = 500
const _log: FlowTraceEntry[] = []

// ── Public API ──

/**
 * Append a trace entry.
 * Automatically drops oldest if over TRACE_LIMIT.
 */
export function appendEntry(entry: FlowTraceEntry): void {
  _log.push(entry)
  if (_log.length > TRACE_LIMIT) {
    _log.splice(0, _log.length - TRACE_LIMIT)
  }
}

/**
 * Get all trace entries (read-only).
 */
export function getTrace(): readonly FlowTraceEntry[] {
  return _log
}

/**
 * Get the last N entries.
 */
export function lastEntries(n: number = 10): FlowTraceEntry[] {
  return _log.slice(-n)
}

/**
 * Get the most recent entry.
 */
export function lastEntry(): FlowTraceEntry | null {
  return _log.length > 0 ? _log[_log.length - 1] : null
}

/**
 * Build a journey summary: unique path from trace entries.
 */
export function getJourneySummary(): string {
  const path: string[] = []
  for (const entry of _log) {
    if (entry.allowed && path[path.length - 1] !== entry.to) {
      path.push(entry.to)
    }
  }
  return path.join(' → ') || '(no transitions)'
}

/**
 * Check for anomalies:
 *   - Transitions that were NOT allowed
 *   - Repeated transitions without intervening state change
 *   - Transitions that didn't commit a route
 */
export interface DriftReport {
  disallowedTransitions: number
  notCommitted: number
  anomalies: string[]
}

export function detectDrift(): DriftReport {
  const report: DriftReport = {
    disallowedTransitions: 0,
    notCommitted: 0,
    anomalies: [],
  }

  let lastFrom: WorkflowSemanticState | null = null
  for (const entry of _log) {
    if (!entry.allowed) {
      report.disallowedTransitions++
      report.anomalies.push(
        `[${new Date(entry.t).toISOString()}] ⛔ Transition disallowed: ${entry.from} → ${entry.to} (reason: ${entry.reason || 'state machine rejected'})`,
      )
    }
    if (!entry.committed && entry.route && entry.allowed) {
      report.notCommitted++
      report.anomalies.push(
        `[${new Date(entry.t).toISOString()}] ⚠️ Route not committed: ${entry.from} → ${entry.to} → ${entry.route}`,
      )
    }
    lastFrom = entry.from
  }

  return report
}

/**
 * Export trace as JSON (for download, replay, testing).
 */
export function exportTraceJSON(): string {
  return JSON.stringify(_log, null, 2)
}

/**
 * Clear trace log.
 */
export function clearTrace(): void {
  _log.length = 0
}

/**
 * Dump trace table to console (debug/dev only).
 */
export function dumpTraceTable(): void {
  if (_log.length === 0) {
    console.log('[FlowTrace] (empty — no transitions recorded)')
    return
  }
  console.table(
    _log.map((e, i) => ({
      '#': i + 1,
      source: e.source,
      event: e.event ?? '',
      from: e.from ?? '(init)',
      to: e.to,
      allowed: e.allowed ? '✅' : '⛔',
      route: e.route ?? '',
      committed: e.committed ? '✅' : '❌',
      t: new Date(e.t).toISOString().slice(11, 23),
    })),
  )
}

// ── Trace Graph (Phase 3B) ──
// Pure projection of trace entries into an execution DAG.
// No new logic, no new state — just structure.

export interface TraceGraphNode {
  id: WorkflowSemanticState
  route: string | null
  visited: boolean       // true if this state appears in trace
  timestamp: number | null  // last visit
  count: number           // how many times visited
}

export interface TraceGraphEdge {
  from: WorkflowSemanticState | null
  to: WorkflowSemanticState
  route: string | null
  committed: boolean
  timestamp: number
  source: string
}

export interface TraceGraph {
  nodes: TraceGraphNode[]
  edges: TraceGraphEdge[]
  summary: {
    totalTransitions: number
    distinctStates: number
    uniqueEdges: number
    disallowedEdges: number
    uncommittedEdges: number
    path: string
  }
}

import { semanticRouteMap } from './semanticRouteMap'

/**
 * Project current trace into an execution DAG.
 * Derived entirely from _log — no new state or logic.
 */
export function getTraceGraph(): TraceGraph {
  const nodeMap = new Map<WorkflowSemanticState, TraceGraphNode>()
  const edges: TraceGraphEdge[] = []

  for (const entry of _log) {
    const from = entry.from
    const to = entry.to

    // Ensure from-node exists
    if (from && !nodeMap.has(from)) {
      nodeMap.set(from, {
        id: from,
        route: semanticRouteMap[from] ?? null,
        visited: false,
        timestamp: null,
        count: 0,
      })
    }

    // Ensure to-node exists (always)
    if (!nodeMap.has(to)) {
      nodeMap.set(to, {
        id: to,
        route: semanticRouteMap[to] ?? null,
        visited: false,
        timestamp: null,
        count: 0,
      })
    }

    // Update to-node
    const tNode = nodeMap.get(to)!
    tNode.visited = true
    tNode.timestamp = entry.t
    tNode.count++

    // Edge
    edges.push({
      from: from ?? null,
      to,
      route: entry.route,
      committed: entry.committed,
      timestamp: entry.t,
      source: entry.source,
    })
  }

  const nodes = Array.from(nodeMap.values())

  // Build path string
  const pathNodes: string[] = []
  for (const edge of edges) {
    if (edge.from && pathNodes[pathNodes.length - 1] !== edge.from) {
      pathNodes.push(edge.from)
    }
    if (pathNodes[pathNodes.length - 1] !== edge.to) {
      pathNodes.push(edge.to)
    }
  }

  return {
    nodes,
    edges,
    summary: {
      totalTransitions: _log.length,
      distinctStates: nodes.length,
      uniqueEdges: new Set(edges.map(e => `${e.from}→${e.to}`)).size,
      disallowedEdges: edges.filter(e => !e.committed).length,
      uncommittedEdges: edges.filter(e => !e.committed).length,
      path: pathNodes.join(' → '),
    },
  }
}

/**
 * Dump trace graph to console.
 */
export function dumpTraceGraph(): void {
  const graph = getTraceGraph()
  console.log('┌─────────────────────────────────────────────┐')
  console.log('│   Trace Execution Graph                     │')
  console.log('├─────────────────────────────────────────────┤')
  console.log(`│  Path: ${graph.summary.path.padEnd(38)} │`)
  console.log(`│  Transitions : ${String(graph.summary.totalTransitions).padStart(5)}                    │`)
  console.log(`│  States      : ${String(graph.summary.distinctStates).padStart(5)}                    │`)
  console.log(`│  Edges       : ${String(graph.summary.uniqueEdges).padStart(5)}                    │')
  console.log(`│  Disallowed  : ${String(graph.summary.disallowedEdges).padStart(5)}                    │')
  console.log('└─────────────────────────────────────────────┘')

  console.log('Nodes:')
  console.table(graph.nodes.map(n => ({
    state: n.id,
    route: n.route ?? '(none)',
    visited: n.visited ? '✅' : '❌',
    count: n.count,
  })))

  if (graph.edges.length > 0) {
    console.log('Edges:')
    console.table(graph.edges.map((e, i) => ({
      '#': i + 1,
      from: e.from ?? '(init)',
      to: e.to,
      route: e.route ?? '',
      ok: e.committed ? '✅' : '⛔',
    })))
  }
}

/**
 * Export trace graph as JSON (for external tools/visualization).
 */
export function exportTraceGraphJSON(): string {
  return JSON.stringify(getTraceGraph(), null, 2)
}
