/**
 * transitionValidator — Transition Decision Layer
 *
 * Validates semantic state transitions and resolves candidate routes.
 * This is the system's "rational layer" — every transition is checked,
 * every route is resolved from the full graph, not a single map.
 *
 * Architecture:
 *   - Input: current state + requested target state + context
 *   - Output: validated result with candidate routes + fallback + error
 *   - Pure function: no side effects, no IO, no state mutation
 *
 * Phase 2: replaces direct semanticRouteMap lookup in useSemanticRouter.
 *          Router no longer reads semantic directly — it reads resolver output.
 */

import type { WorkflowSemanticState } from '../types/state'
import { transitionSemantic } from '../lib/state-machines'
import { semanticRouteMap } from './semanticRouteMap'

// ── Route Resolution Graph ──
//
// For states with multiple possible next routes, ALL candidates are listed.
// The resolver will choose one based on context.
// Phase 2: single route per state (multi-route reserved for Phase 3).

export interface RouteCandidate {
  state: WorkflowSemanticState
  route: string
  priority: number        // lower = higher priority
  condition?: string      // human-readable condition (e.g., "if previous step completed")
}

export interface ValidationResult {
  /** Is the transition allowed by state machine? */
  allowed: boolean
  /** Candidate routes for the target state */
  candidates: RouteCandidate[]
  /** Best route (first candidate) */
  primaryRoute: string | null
  /** Human-readable reason if disallowed */
  reason?: string
  /** True if transition is valid but no route mapped */
  noRouteMapped: boolean
}

// ── Route Resolution Graph ──

const ROUTE_GRAPH: Partial<Record<WorkflowSemanticState, RouteCandidate[]>> = {
  ENTRY_START: [
    { state: 'ENTRY_START', route: '/workspace/geo/health', priority: 1 },
  ],
  FIRST_MISSION_CREATED: [
    { state: 'FIRST_MISSION_CREATED', route: '/workspace/geo/recommendations', priority: 1 },
  ],
  WORKFLOW_ACTIVE: [
    { state: 'WORKFLOW_ACTIVE', route: '/workspace/geo/discovery', priority: 1 },
  ],
  WORKFLOW_COMPLETED: [
    { state: 'WORKFLOW_COMPLETED', route: '/workspace/geo/verification', priority: 1 },
    // Future: after verification, could also map to publishing directly
    // { state: 'WORKFLOW_COMPLETED', route: '/workspace/geo/publishing', priority: 2, condition: 'if auto-verified' },
  ],
  WORKFLOW_EXIT: [
    { state: 'WORKFLOW_EXIT', route: '/workspace/geo/dashboard', priority: 1 },
  ],
}

/**
 * Validate a semantic transition and get candidate routes.
 *
 * @param current - Current semantic state
 * @param target - Requested target state
 * @returns ValidationResult with candidates
 */
export function validateTransition(
  current: WorkflowSemanticState,
  target: WorkflowSemanticState,
): ValidationResult {
  // 1. Check state machine transition
  const allowed = transitionSemantic(current, target)

  if (!allowed) {
    return {
      allowed: false,
      candidates: [],
      primaryRoute: null,
      reason: `State machine rejected transition: ${current} → ${target}`,
      noRouteMapped: false,
    }
  }

  // 2. Resolve candidate routes from graph
  const candidates = ROUTE_GRAPH[target] || semanticRouteMap[target]
    ? [{ state: target, route: semanticRouteMap[target]!, priority: 1 }]
    : []

  if (candidates.length === 0) {
    return {
      allowed: true,
      candidates: [],
      primaryRoute: null,
      reason: `No route mapped for state: ${target}`,
      noRouteMapped: true,
    }
  }

  // 3. Sort by priority
  const sorted = [...candidates].sort((a, b) => a.priority - b.priority)

  return {
    allowed: true,
    candidates: sorted,
    primaryRoute: sorted[0].route,
    reason: undefined,
    noRouteMapped: false,
  }
}

/**
 * Get the full route graph (for debugging / trace output).
 */
export function getRouteGraph(): Record<string, RouteCandidate[]> {
  const graph: Record<string, RouteCandidate[]> = {}
  for (const [state, candidates] of Object.entries(ROUTE_GRAPH)) {
    graph[state] = candidates
  }
  return graph
}
