/**
 * Growth Store — Skeleton (placeholder)
 * TODO: Implement in Sprint UI-04
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGrowthStore = defineStore('geo-growth', () => {
  const isLoading = ref(false)
  return { isLoading }
})
