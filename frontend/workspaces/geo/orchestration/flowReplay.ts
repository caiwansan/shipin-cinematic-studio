/**
 * flowReplay — Deterministic Replay Engine
 *
 * Reconstructs semantic state from a trace log and asserts
 * that the same event sequence would produce the same route decisions.
 *
 * This is the "correctness proof" of the decision runtime.
 * No mock, no simulation — pure recomputation against the same
 * state machine and route graph used at runtime.
 *
 * Phase 3: The system goes from "can run" to "can be proven correct".
 *
 * Architecture:
 *   - Input: FlowTraceEntry[] (from flowTrace.getTrace() or exportTraceJSON())
 *   - Process: replay each entry's from→to transition through state machine + validator
 *   - Output: comparison table (runtime vs replay), pass/fail per step
 */

import { transitionSemantic } from '../lib/state-machines'
import { validateTransition } from './transitionValidator'
import { semanticRouteMap } from './semanticRouteMap'
import type { FlowTraceEntry } from './flowTrace'
import type { WorkflowSemanticState } from '../types/state'

// ── Replay Result Types ──

export interface ReplayStepResult {
  /** Index in the trace */
  index: number
  /** The trace entry being replayed */
  entry: FlowTraceEntry
  /** Reconstructed previous state (before replay transition) */
  replayFrom: WorkflowSemanticState | null
  /** Reconstructed target state (after replay transition) */
  replayTo: WorkflowSemanticState | null
  /** Was the transition allowed by state machine? */
  replayAllowed: boolean
  /** Route that the resolver WOULD select */
  replayRoute: string | null
  /** Did the replay route match the runtime route? */
  routeMatch: boolean | null  // null if both have no route
  /** Did the replay committed flag match runtime? */
  commitMatch: boolean
  /** Did the transition allowed flag match runtime? */
  allowedMatch: boolean
  /** Human-readable summary */
  status: '✅' | '⚠️' | '⛔'
  /** Reason for mismatch */
  reason?: string
}

export interface ReplaySummary {
  total: number
  passed: number
  warnings: number
  failed: number
  steps: ReplayStepResult[]
  disallowedSequence: number
  routeMismatches: number
  commitMismatches: number
}

// ── Replay Engine ──

/**
 * Replay a trace log against the same state machine + route graph.
 *
 * @param trace — The trace entries to replay (from flowTrace.getTrace())
 * @returns ReplaySummary with per-step results
 */
export function replayTrace(trace: readonly FlowTraceEntry[]): ReplaySummary {
  const summary: ReplaySummary = {
    total: trace.length,
    passed: 0,
    warnings: 0,
    failed: 0,
    steps: [],
    disallowedSequence: 0,
    routeMismatches: 0,
    commitMismatches: 0,
  }

  // Track current semantic state through replay
  let current: WorkflowSemanticState | null = null

  for (let i = 0; i < trace.length; i++) {
    const entry = trace[i]

    // 1. Determine "from" state for replay
    //    If current is set from a previous valid transition, use it.
    //    Otherwise, use entry.from (trace's recorded from).
    const replayFrom = current ?? entry.from

    // 2. Check if the transition is allowed by state machine
    let replayAllowed: boolean
    if (replayFrom !== null && entry.to) {
      replayAllowed = transitionSemantic(replayFrom, entry.to)
    } else {
      replayAllowed = false
    }

    // 3. If allowed, move current forward
    if (replayAllowed && entry.to) {
      current = entry.to
    }

    // 4. Resolve the route the resolver WOULD choose
    let replayRoute: string | null = null
    if (replayAllowed && entry.to) {
      const validated = validateTransition(replayFrom!, entry.to)
      if (validated.allowed && validated.primaryRoute) {
        replayRoute = validated.primaryRoute
      } else if (validated.allowed && semanticRouteMap[entry.to]) {
        // Fallback: direct semanticRouteMap lookup
        replayRoute = semanticRouteMap[entry.to] ?? null
      }
    }

    // 5. Compare with runtime
    const routeMatch = replayRoute === entry.route
      ? true
      : (replayRoute === null && entry.route === null)
        ? null  // both null = no route
        : false

    const allowedMatch = replayAllowed === entry.allowed
    const commitMatch = entry.committed === (routeMatch && replayAllowed)

    // 6. Determine status
    let status: '✅' | '⚠️' | '⛔'
    const reasons: string[] = []

    if (!allowedMatch) {
      status = '⛔'
      reasons.push(
        `transition mismatch: runtime=${entry.allowed}, replay=${replayAllowed} (${entry.from}→${entry.to})`,
      )
    } else if (routeMatch === false) {
      status = '⛔'
      reasons.push(
        `route mismatch: runtime="${entry.route}", replay="${replayRoute}"`,
      )
    } else if (!commitMatch) {
      status = '⚠️'
      reasons.push(
        `commit mismatch: runtime=${entry.committed}, replay=${routeMatch && replayAllowed}`,
      )
    } else {
      status = '✅'
    }

    if (replayAllowed && !entry.allowed) {
      reasons.push('⚠️ runtime REJECTED a valid transition — possible drift')
    }

    const step: ReplayStepResult = {
      index: i,
      entry,
      replayFrom,
      replayTo: entry.to,
      replayAllowed,
      replayRoute,
      routeMatch,
      commitMatch,
      allowedMatch,
      status,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    }

    summary.steps.push(step)

    // Update counters
    if (status === '✅') summary.passed++
    else if (status === '⚠️') summary.warnings++
    else summary.failed++

    if (routeMatch === false) summary.routeMismatches++
    if (!commitMatch) summary.commitMismatches++
    if (!allowedMatch) summary.disallowedSequence++
  }

  return summary
}

/**
 * Print a replay summary to console (dev/debug).
 */
export function dumpReplayResult(summary: ReplaySummary): void {
  console.log('┌─────────────────────────────────────────────┐')
  console.log('│   Flow Replay Result                        │')
  console.log('├─────────────────────────────────────────────┤')
  console.log(`│  Total       ${String(summary.total).padStart(5)}                           │`)
  console.log(`│  ✅ Passed   ${String(summary.passed).padStart(5)}                           │`)
  console.log(`│  ⚠️ Warnings ${String(summary.warnings).padStart(5)}                           │`)
  console.log(`│  ⛔ Failed   ${String(summary.failed).padStart(5)}                           │`)
  console.log(`│  Route mismatches : ${String(summary.routeMismatches).padStart(3)}                    │`)
  console.log(`│  Commit mismatches: ${String(summary.commitMismatches).padStart(3)}                    │`)
  console.log('└─────────────────────────────────────────────┘')

  for (const step of summary.steps) {
    if (step.status !== '✅') {
      console.log(`  ${step.status} [#${step.index}] ${step.reason}`)
    }
  }
}

/**
 * Run replay and return a human-readable pass/fail assertion.
 */
export function assertDeterministic(summary: ReplaySummary): boolean {
  if (summary.failed > 0) {
    console.warn(
      `[FlowReplay] ❌ NON-DETERMINISTIC: ${summary.failed} step(s) failed`,
    )
    return false
  }
  if (summary.warnings > 0) {
    console.warn(
      `[FlowReplay] ⚠️ DETERMINISTIC with ${summary.warnings} warning(s)`,
    )
    return true
  }
  console.log('[FlowReplay] ✅ FULLY DETERMINISTIC — all steps match')
  return true
}

/**
 * Get the reconstructed state path from a replay.
 */
export function getReplayPath(
  summary: ReplaySummary,
): WorkflowSemanticState[] {
  const path: WorkflowSemanticState[] = []
  let lastState: string | null = null
  for (const step of summary.steps) {
    if (step.replayTo && step.replayAllowed && step.replayTo !== lastState) {
      path.push(step.replayTo)
      lastState = step.replayTo
    }
  }
  return path
}

/**
 * Export replay result as JSON.
 */
export function exportReplayResult(summary: ReplaySummary): string {
  return JSON.stringify(
    {
      total: summary.total,
      passed: summary.passed,
      warnings: summary.warnings,
      failed: summary.failed,
      routeMismatches: summary.routeMismatches,
      commitMismatches: summary.commitMismatches,
      path: getReplayPath(summary).join(' → '),
      steps: summary.steps.map(s => ({
        i: s.index,
        from: s.replayFrom,
        to: s.replayTo,
        runtime: {
          allowed: s.entry.allowed,
          route: s.entry.route,
          committed: s.entry.committed,
        },
        replay: {
          allowed: s.replayAllowed,
          route: s.replayRoute,
        },
        match: s.status,
        reason: s.reason,
      })),
    },
    null,
    2,
  )
}

// ── Pre-commit Simulation (Phase 3C) ──

export interface SimulationResult {
  /** Would the transition be allowed? */
  allowed: boolean
  /** Route the resolver would select */
  route: string | null
  /** Expected state after transition */
  newState: WorkflowSemanticState | null
  /** Human-readable summary */
  summary: string
}

/**
 * Simulate a pending transition WITHOUT committing it.
 *
 * This is the pre-commit gate: run the full resolve pipeline
 * against a virtual state, then compare with the expected result.
 *
 * @param from — Current semantic state
 * @param to — Proposed target state
 * @returns SimulationResult with expected outcome
 */
export function simulateTransition(
  from: WorkflowSemanticState,
  to: WorkflowSemanticState,
): SimulationResult {
  // 1. Check state machine legality
  const allowed = transitionSemantic(from, to)

  if (!allowed) {
    return {
      allowed: false,
      route: null,
      newState: null,
      summary: `⛔ Illegal transition: ${from} → ${to}`,
    }
  }

  // 2. Resolve route via validator
  const validated = validateTransition(from, to)
  const route = validated.allowed && validated.primaryRoute
    ? validated.primaryRoute
    : (semanticRouteMap[to] ?? null)

  return {
    allowed: true,
    route,
    newState: to,
    summary: `✅ ${from} → ${to} → ${route || '(no route)'}`,
  }
}

/**
 * Compare an expected simulation with actual runtime entry.
 * Returns pass/fail with reason.
 */
export function compareSimulation(
  simulation: SimulationResult,
  actual: FlowTraceEntry,
): { pass: boolean; reason?: string } {
  if (simulation.allowed !== actual.allowed) {
    return {
      pass: false,
      reason: `allowed mismatch: sim=${simulation.allowed}, runtime=${actual.allowed}`,
    }
  }
  if (simulation.allowed && simulation.route !== actual.route) {
    return {
      pass: false,
      reason: `route mismatch: sim="${simulation.route}", runtime="${actual.route}"`,
    }
  }
  return { pass: true }
}
