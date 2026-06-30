/**
 * Publishing Store — Skeleton (placeholder)
 * TODO: Implement in Sprint UI-04
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePublishingStore = defineStore('geo-publishing', () => {
  const isLoading = ref(false)
  return { isLoading }
})
