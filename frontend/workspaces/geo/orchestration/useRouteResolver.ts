/**
 * useRouteResolver — Decision Engine Hook
 *
 * Phase 2: log → validate → resolve → commit
 * Phase 3C: log → validate → simulate → compare → commit (verified execution)
 *
 * The key architectural change: replay is now a PRE-COMMIT GATE, not a post-hoc tool.
 * Every transition is simulated before being committed. If simulation and expected
 * result don't match, the commit is aborted and a drift warning is emitted.
 *
 * Architecture:
 *   - Wraps flowTrace (log) + transitionValidator (validate) + flowReplay (simulate)
 *   - Every transition is now: simulate FIRST, commit only if match
 *   - Drift report accessible via window.__GEO_FLOW_STATS__
 *
 * Phase 3C constraint:
 *   - Does NOT modify semantic state machine
 *   - Does NOT add business logic
 *   - Does NOT modify state-machines.ts
 */

import { watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkspaceState } from '../composables/useWorkspaceState'
import { semanticRouteMap } from './semanticRouteMap'
import { validateTransition } from './transitionValidator'
import { appendEntry, lastEntry, dumpTraceTable, detectDrift, getTrace, dumpTraceGraph, exportTraceGraphJSON, type FlowTraceEntry } from './flowTrace'
import { simulateTransition, compareSimulation, replayTrace, dumpReplayResult, assertDeterministic, getReplayPath, exportReplayResult } from './flowReplay'
import { eventBus } from '../lib/eventBus'
import type { WorkflowSemanticState } from '../types/state'

/**
 * Resolve the best route from validation result.
 */
function resolveBestRoute(
  validated: ReturnType<typeof validateTransition>,
): string | null {
  if (!validated.allowed || validated.noRouteMapped) return null

  if (validated.candidates.length > 0) {
    return validated.candidates[0].route
  }

  return validated.primaryRoute
}

/**
 * Execute the full decision pipeline for a pending transition:
 *   simulate → compare → commit (only if pass)
 *
 * Returns the trace entry that was (or would have been) written.
 */
function executeSimulationGate(
  source: 'trigger' | 'watch',
  event: string | undefined,
  prev: WorkflowSemanticState,
  target: WorkflowSemanticState,
  state: ReturnType<typeof getWorkspaceState>,
  router: ReturnType<typeof useRouter>,
  lastRoute: { value: string | null },
): FlowTraceEntry {
  // 1. Validate locally
  const validated = validateTransition(prev, target)
  if (!validated.allowed) {
    const entry: FlowTraceEntry = {
      t: Date.now(),
      source,
      event,
      from: prev,
      to: target,
      allowed: false,
      route: null,
      committed: false,
      reason: validated.reason,
    }
    appendEntry(entry)
    console.warn(`[RouteResolver:${source}] ⛔ Rejected:`, validated.reason)
    return entry
  }

  // 2. Resolve candidate route
  const route = resolveBestRoute(validated)

  // 3. SIMULATION: run pre-commit replay
  const sim = simulateTransition(prev, target)

  // 4. COMPARE: simulation vs what we're about to do
  const pendingEntry: FlowTraceEntry = {
    t: Date.now(),
    source,
    event,
    from: prev,
    to: target,
    allowed: validated.allowed,
    route,
    committed: false,  // not yet committed
  }
  const comparison = compareSimulation(sim, pendingEntry)

  if (!comparison.pass) {
    // SIMULATION FAILED — DO NOT COMMIT
    const entry: FlowTraceEntry = {
      t: Date.now(),
      source,
      event,
      from: prev,
      to: target,
      allowed: validated.allowed,
      route,
      committed: false,
      reason: `SIMULATION GATE BLOCKED: ${comparison.reason}`,
    }
    appendEntry(entry)
    console.error(`[RouteResolver:${source}] ⛔ SIMULATION GATE BLOCKED:`, comparison.reason)
    console.error(`  simulation:`, sim)
    console.error(`  expected:`, { allowed: validated.allowed, route })
    return entry
  }

  // 5. COMMIT — simulation passed
  let committed = false
  if (route && route !== lastRoute.value) {
    lastRoute.value = route
    router.push(route)
    committed = true
  } else if (route === lastRoute.value) {
    console.log(`[RouteResolver:${source}] 🔄 Duplicate route skip:`, route)
  }

  // 6. Execute real semantic transition
  const ok = state.semantic.transition(target)

  // 7. Trace
  const entry: FlowTraceEntry = {
    t: Date.now(),
    source,
    event,
    from: prev,
    to: target,
    allowed: ok,
    route,
    committed,
    reason: ok
      ? undefined
      : 'state.transition() returned false despite valid simulation',
  }
  appendEntry(entry)

  console.log(`[RouteResolver:${source}] ✅`, {
    from: prev,
    to: target,
    route,
    committed,
    simPass: comparison.pass,
  })

  return entry
}

/**
 * Mount the route resolver.
 * Call once at layout level (already done in GeoWorkspaceLayout.vue).
 */
export function useRouteResolver(): void {
  const router = useRouter()
  const state = getWorkspaceState()
  const lastRoute = ref<string | null>(null)
  const lastState = ref(state.semantic.current)

  // ── Business Trigger: PROJECT:CREATED → ENTRY_START ──
  eventBus.on('PROJECT:CREATED', (payload) => {
    executeSimulationGate(
      'trigger',
      'PROJECT:CREATED',
      state.semantic.current,
      'ENTRY_START' as WorkflowSemanticState,
      state,
      router,
      lastRoute,
    )
  })

  // ── Semantic → Route: validated watcher ──
  watch(
    () => state.semantic.current,
    (next, prev) => {
      // Skip first watch fire if it's the same state
      if (next === prev || next === lastState.value) {
        lastState.value = next
        return
      }
      lastState.value = next

      executeSimulationGate(
        'watch',
        undefined,
        prev,
        next,
        state,
        router,
        lastRoute,
      )
    },
    { immediate: false },
  )

  // ── Debug inspector (dev only) ──
  if (typeof window !== 'undefined') {
    ; (window as any).__GEO_FLOW_STATS__ = {
      trace: () => dumpTraceTable(),
      drift: () => detectDrift(),
      last: () => lastEntry(),
      replay: () => {
        const r = replayTrace(getTrace())
        dumpReplayResult(r)
        return r
      },
      replayPath: () => {
        const r = replayTrace(getTrace())
        return getReplayPath(r).join(' → ')
      },
      replayExport: () => {
        const r = replayTrace(getTrace())
        return exportReplayResult(r)
      },
      graph: () => dumpTraceGraph(),
      graphJSON: () => exportTraceGraphJSON(),
    }
    console.log('[RouteResolver] 🐛 window.__GEO_FLOW_STATS__ available')
    console.table({
      semantic: state.semantic.current,
      route: semanticRouteMap[state.semantic.current] ?? '(no route)',
    })
  }
}
