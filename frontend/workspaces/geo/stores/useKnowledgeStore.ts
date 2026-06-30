/**
 * Knowledge Store — Skeleton (placeholder)
 * TODO: Implement in Sprint UI-06
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useKnowledgeStore = defineStore('geo-knowledge', () => {
  const isLoading = ref(false)
  return { isLoading }
})
