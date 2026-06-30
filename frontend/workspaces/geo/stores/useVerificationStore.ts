/**
 * Verification Store — Skeleton (placeholder)
 * TODO: Implement in Sprint UI-03
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVerificationStore = defineStore('geo-verification', () => {
  const isLoading = ref(false)
  return { isLoading }
})
