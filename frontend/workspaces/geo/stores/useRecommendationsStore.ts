/**
 * Recommendations Store — Skeleton (placeholder)
 * TODO: Implement in Sprint UI-02
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRecommendationsStore = defineStore('geo-recommendations', () => {
  const isLoading = ref(false)
  return { isLoading }
})
