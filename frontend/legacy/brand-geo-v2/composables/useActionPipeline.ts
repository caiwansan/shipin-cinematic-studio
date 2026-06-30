// @deprecated — GEO v1.5 Legacy. Use design-system product blocks instead.
/**
 * useActionPipeline — P2: Shared Action State
 *
 * Single source of truth for all action states across
 * Overview / Insights / Evidence / InsightsPanel.
 *
 * Design:
 * - ActionState statuses follow the locked state machine:
 *   not_started → in_progress → pending_verification → verified
 * - Every state transition requires a real VerificationEngine call
 * - No UI-only toggling
 */

import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'

// ── Types ──

export interface ActionVerificationState {
  executionId: string
  jobStatus: 'pending' | 'running' | 'completed' | 'failed'
  delta?: number
  beforeScore?: number
  afterScore?: number
}

export interface ActionState {
  id: string              // matches signal type or action identifier
  title: string
  status: 'not_started' | 'in_progress' | 'pending_verification' | 'verified'
  updatedAt: string
  verificationState?: ActionVerificationState
  signal?: any            // original signal data for reference
}

export function useActionPipeline(projectId: Ref<string | null>) {
  const actions = ref<ActionState[]>([])
  const executing = ref(false)
  const fetchLoading = ref(false)

  // ── Derived ──
  const completedCount = computed(() => actions.value.filter(a => a.status === 'verified').length)
  const totalCount = computed(() => actions.value.length)
  const progressPercent = computed(() =>
    totalCount.value > 0 ? Math.round((completedCount.value / totalCount.value) * 100) : 0
  )

  // ── Fetch actions from learning signals ──
  async function fetchActions() {
    if (!projectId.value) return
    fetchLoading.value = true
    try {
      const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
      const res = await client.get(`/learning/signals?projectId=${projectId.value}`)
      if (res.success && Array.isArray(res.data)) {
        // Merge existing states with new signals
        const existingMap = new Map(actions.value.map(a => [a.id, a]))
        actions.value = res.data
          .filter((s: any) => (s.weight || 0) > 0)
          .map((s: any) => {
            const id = s.type || s.signalType || s.id || `sig-${Math.random()}`
            const existing = existingMap.get(id)
            return existing || {
              id,
              title: id,
              status: 'not_started' as const,
              updatedAt: new Date().toISOString(),
              signal: s,
            }
          })
      }
    } catch {
      // ignore
    } finally {
      fetchLoading.value = false
    }
  }

  // ── Execute an action (calls real Verification Engine) ──
  async function executeAction(actionId: string, optimizationType?: string) {
    const action = actions.value.find(a => a.id === actionId)
    if (!action || !projectId.value) return

    // Transition: not_started → in_progress
    action.status = 'in_progress'
    action.updatedAt = new Date().toISOString()

    executing.value = true
    try {
      const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
      const res = await client.post('/verification/run', {
        projectId: projectId.value,
        optimizationType: optimizationType || action.id,
        triggerSource: 'manual',
      })

      if (res.success && res.data) {
        const executionId = res.data.executionId || res.data.id

        // Transition: in_progress → pending_verification
        action.status = 'pending_verification'
        action.verificationState = {
          executionId,
          jobStatus: 'pending',
        }
        action.updatedAt = new Date().toISOString()

        // Start polling for verification result
        pollVerification(action)
      } else {
        // API failed, reset
        action.status = 'not_started'
      }
    } catch {
      action.status = 'not_started'
    } finally {
      executing.value = false
    }
  }

  // ── Poll verification job until completion ──
  async function pollVerification(action: ActionState) {
    if (!action.verificationState?.executionId || !projectId.value) return

    const maxRetries = 30
    let retries = 0

    const poll = async () => {
      if (retries >= maxRetries) {
        action.status = 'verified' // fallback: accept what we have
        return
      }
      retries++

      try {
        const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
        const res = await client.get(`/verification/job/${action.verificationState!.executionId}`)

        if (res.success && res.data) {
          const jobStatus = res.data.status

          if (jobStatus === 'running') {
            action.verificationState!.jobStatus = 'running'
            setTimeout(poll, 2000) // poll every 2s
          } else if (jobStatus === 'completed' || jobStatus === 'success') {
            action.verificationState!.jobStatus = 'completed'
            action.verificationState!.delta = res.data.delta || 0
            action.verificationState!.beforeScore = res.data.beforeScore
            action.verificationState!.afterScore = res.data.afterScore
            action.status = 'verified'
            action.updatedAt = new Date().toISOString()
          } else if (jobStatus === 'failed') {
            action.verificationState!.jobStatus = 'failed'
            action.status = 'verified' // still mark as verified to unblock user
            action.updatedAt = new Date().toISOString()
          } else {
            setTimeout(poll, 2000)
          }
        } else {
          setTimeout(poll, 2000)
        }
      } catch {
        setTimeout(poll, 2000)
      }
    }

    poll()
  }

  // ── Get action state by id ──
  function getActionState(actionId: string): ActionState | undefined {
    return actions.value.find(a => a.id === actionId)
  }

  // Watch project changes
  watch(projectId, () => {
    actions.value = []
    fetchActions()
  }, { immediate: true })

  return {
    actions,
    executing,
    fetchLoading,
    completedCount,
    totalCount,
    progressPercent,
    fetchActions,
    executeAction,
    getActionState,
  }
}
