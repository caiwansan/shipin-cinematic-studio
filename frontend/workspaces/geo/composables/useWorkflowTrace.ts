/**
 * useWorkflowTrace — Zero-UI Semantic Trace Hook
 *
 * Records semantic state transitions for Golden Journey validation.
 * Does NOT modify any behavior, does NOT emit events, does NOT touch UI.
 *
 * Outputs to console.table for manual inspection.
 * Future: can write to file for CI replay.
 *
 * Architecture constraints (S1.2C-SM-001):
 *   - UI must NOT import this file (it's a debug/trace tool only)
 *   - trace must NOT modify state.semantic
 *   - trace must NOT influence page/task/card state
 *   - no side effects beyond console + an internal log array
 *
 * Part of Golden Journey Semantic Validation Protocol.
 */

import type { WorkflowSemanticState } from '../types/state'

// ── Singleton trace log ──

export interface TraceEntry {
  from: WorkflowSemanticState | null
  to: WorkflowSemanticState
  allowed: boolean
  timestamp: number
  /** Optional: mapped from page/empty/ready etc for context */
  pageContext?: string
}

const MAX_TRACE_ENTRIES = 500

/**
 * In-memory trace log. Not exported as reactive — debug/trace only.
 */
const _log: TraceEntry[] = []

// ── Public API ──

/**
 * Trace a semantic transition attempt.
 * Call from orchestration layer only (NEVER from components).
 *
 * @example
 *   const prev = state.semantic.current
 *   const ok = state.semantic.transition('FIRST_MISSION_CREATED')
 *   traceTransition(prev, 'FIRST_MISSION_CREATED', ok)
 */
export function traceTransition(
  from: WorkflowSemanticState | null,
  to: WorkflowSemanticState,
  allowed: boolean,
  pageContext?: string,
): void {
  const entry: TraceEntry = {
    from,
    to,
    allowed,
    timestamp: Date.now(),
    pageContext,
  }

  _log.push(entry)

  // Prevent unbounded memory growth
  if (_log.length > MAX_TRACE_ENTRIES) {
    _log.splice(0, _log.length - MAX_TRACE_ENTRIES)
  }

  // Debug trace — kept for workflow validation; use trace library in production
  // @beta-stub: 生产环境应替换为 trace 库调用
}

/**
 * Print the full trace log as a table.
 * Pure debug tool — call from browser console or Node repl.
 */
export function dumpTraceTable(): void {
  if (_log.length === 0) {
    // No transitions — nothing to dump
    return
  }
  // Debug output — kept for developer diagnostics
  const table = _log.map((e, i) => ({
    '#': i + 1,
    from: e.from ?? '(init)',
    to: e.to,
    allowed: e.allowed ? '✅' : '⛔',
    ctx: e.pageContext ?? '',
    t: new Date(e.timestamp).toISOString().slice(11, 23),
  })))
}

/**
 * Get raw trace log for programmatic consumption.
 */
export function getTraceLog(): readonly TraceEntry[] {
  return _log
}

/**
 * Build a journey summary: unique path from the trace entries.
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
 * Clear trace log.
 */
export function clearTrace(): void {
  _log.length = 0
}
