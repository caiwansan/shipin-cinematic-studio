/**
 * GEO Verification Store — Pinia Store
 *
 * Manages verification data: outcome, confidence, proof, trust.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchVerification } from '../services/verificationService'
import type { VerificationData } from '../services/verificationService'

export const useVerificationStore = defineStore('geo-verification', () => {
  const outcome = ref<VerificationData['outcome'] | null>(null)
  const confidence = ref<VerificationData['confidence']>([])
  const proof = ref<VerificationData['proof']>([])
  const trust = ref<VerificationData['trust'] | null>(null)
  const history = ref<VerificationData['history']>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => outcome.value !== null)
  const allComplete = computed(() => confidence.value.every(c => c.complete))
  const totalConfidenceItems = computed(() => confidence.value.length)
  const completedConfidenceItems = computed(() => confidence.value.filter(c => c.complete).length)

  async function fetchVerificationData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchVerification(projectId.value)
      outcome.value = data.outcome
      confidence.value = data.confidence
      proof.value = data.proof
      trust.value = data.trust
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
    outcome, confidence, proof, trust, history,
    isLoading, error, projectId,
    hasData, allComplete, totalConfidenceItems, completedConfidenceItems,
    fetchVerification: fetchVerificationData, setProject,
  }
})
