/**
 * useSemanticRouter — Orchestration Hook
 *
 * Watches semantic state and drives UI route changes automatically.
 * Single instance shared across the workspace via getWorkspaceState().
 *
 * ⚠️  This is the ONLY place where semantic → route mapping lives.
 *     No manual router.push() for workflow-driven navigation elsewhere.
 *
 * Also listens for PROJECT:CREATED as the BUSINESS TRIGGER that sets
 * semantic state to ENTRY_START (the first spark in the workflow).
 *
 * Phase 1 constraint:
 *   - Does NOT add business logic beyond semantic transition + route
 *   - Does NOT touch API/backend
 *   - Does NOT modify workflow state machine
 */

import { watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getWorkspaceState } from '../composables/useWorkspaceState'
import { semanticRouteMap } from './semanticRouteMap'
import { eventBus } from '../lib/eventBus'

export function useSemanticRouter(): void {
  const router = useRouter()
  const state = getWorkspaceState()
  const lastRoute = ref<string | null>(null)

  // ── Business Trigger: PROJECT:CREATED → ENTRY_START ──
  // This is the FIRST SPARK that starts the semantic workflow.
  // Without this, semantic remains idle — no flow happens.
  eventBus.on('PROJECT:CREATED', (payload) => {
    const prev = state.semantic.current
    const ok = state.semantic.transition('ENTRY_START')
    // Debug trace — kept for Golden Journey validation
    if (!ok) {
      console.warn('[SEMANTIC FLOW:TRIGGER] Transition rejected', {
        from: prev,
        to: 'ENTRY_START',
      })
    }
  })

  // ── Semantic → Route watcher ──
  watch(
    () => state.semantic.current,
    (next, prev) => {
      const target = semanticRouteMap[next]

      if (!target) {
        console.warn('[SEMANTIC FLOW] No route mapped for state:', next)
        return
      }

      // Safety guard: prevent infinite loop (same route twice)
      if (target === lastRoute.value) {
        return
      }

      lastRoute.value = target
      router.push(target)
    },
    { immediate: true },
  )

  // Trace dump on mount for debugging
  console.table({
    semantic: state.semantic.current,
    route: semanticRouteMap[state.semantic.current] ?? '(no route)',
  })
}
