/**
 * GEO Verification Store — Pinia Store
 *
 * Manages verification data: outcome, confidence, proof, trust.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchVerification } from '../services/verificationService'
import type {
  VerificationData,
  VerificationOutcome,
  BeforeAfter,
  VerificationEvidence,
  AiVisibilityInfo,
  VerificationCoverage,
  VerificationHistoryItem,
} from '../services/verificationService'

export const useVerificationStore = defineStore('geo-verification', () => {
  // New API-mapped fields
  const summary = ref<VerificationOutcome>({ outcome: 'pending', confidence: 0, proofLevel: 'needs-evidence', trustScore: 0 })
  const beforeAfter = ref<BeforeAfter | null>(null)
  const evidence = ref<VerificationEvidence>({ total: 0, items: [] })
  const aiVisibility = ref<AiVisibilityInfo>({ keywordCount: 0, entityCount: 0, claimCount: 0 })
  const coverage = ref<VerificationCoverage>({ schemas: 0, faqs: 0, evidences: 0 })
  const status = ref<string>('pending')
  const history = ref<VerificationHistoryItem[]>([])

  // Backward-compatible derived fields
  const outcome = computed(() => ({
    beforeScore: beforeAfter.value?.before.overall ?? 0,
    afterScore: beforeAfter.value?.after.overall ?? 0,
    delta: beforeAfter.value?.changes.overall ?? 0,
  }))
  const confidence = computed(() => {
    if (!beforeAfter.value) return []
    const dims = ['visibility', 'authority', 'content', 'website', 'knowledge']
    const dimLabels: Record<string, string> = {
      visibility: 'AI Visibility', authority: 'Authority', content: 'Content Quality',
      website: 'Website Health', knowledge: 'Knowledge Coverage',
    }
    return dims.map(dim => ({
      item: dimLabels[dim],
      complete: (beforeAfter.value?.changes as any)?.[dim] > 0 || beforeAfter.value?.after.overall > 0,
    }))
  })
  const proof = computed(() => {
    if (!beforeAfter.value) return []
    const dims = ['visibility', 'authority', 'content', 'website', 'knowledge']
    const dimLabels: Record<string, string> = {
      visibility: 'AI Visibility', authority: 'Authority', content: 'Content Quality',
      website: 'Website Health', knowledge: 'Knowledge Coverage',
    }
    return dims.map(dim => ({
      name: dimLabels[dim],
      before: (beforeAfter.value as any)?.before?.dimensions?.[dim] ?? 0,
      after: (beforeAfter.value as any)?.after?.dimensions?.[dim] ?? 0,
      delta: (beforeAfter.value as any)?.changes?.[dim] ?? 0,
      suffix: '/100' as string | undefined,
      isUnavailable: false,
      learnContent: (beforeAfter.value as any)?.changes?.[dim] > 0
        ? `+${(beforeAfter.value as any)?.changes?.[dim]} improvement in ${dimLabels[dim]}`
        : undefined,
    }))
  })
  const trust = computed(() => ({
    message: outcome.value.delta > 10
      ? `Your brand improved significantly (+${outcome.value.delta} points). Great progress!`
      : outcome.value.delta > 0
        ? `Your brand improved by ${outcome.value.delta} points. Keep going!`
        : outcome.value.delta === 0
          ? 'No change detected. Try new recommendations.'
          : `Your brand decreased by ${Math.abs(outcome.value.delta)} points. Review recommendations.`,
  }))

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => beforeAfter.value !== null && (beforeAfter.value.after.overall > 0 || beforeAfter.value.before.overall > 0))
  const allComplete = computed(() => confidence.value.length > 0 && confidence.value.every(c => c.complete))
  const totalConfidenceItems = computed(() => confidence.value.length)
  const completedConfidenceItems = computed(() => confidence.value.filter(c => c.complete).length)

  async function fetchVerificationData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchVerification(projectId.value)
      summary.value = data.summary
      beforeAfter.value = data.beforeAfter
      evidence.value = data.evidence
      aiVisibility.value = data.aiVisibility
      coverage.value = data.coverage
      status.value = data.status
      history.value = data.history
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load verification data'
    } finally {
      isLoading.value = false
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    summary, beforeAfter, evidence, aiVisibility, coverage, status, history,
    outcome, confidence, proof, trust,
    isLoading, error, projectId,
    hasData, allComplete, totalConfidenceItems, completedConfidenceItems,
    fetchVerification: fetchVerificationData, setProject,
  }
})
