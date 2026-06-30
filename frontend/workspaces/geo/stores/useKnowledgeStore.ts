/**
 * GEO Knowledge Store — Pinia Store
 *
 * Manages knowledge data: brand description, coverage, sources, statements.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchKnowledge } from '../services/knowledgeService'
import type { KnowledgeData } from '../services/knowledgeService'

export const useKnowledgeStore = defineStore('geo-knowledge', () => {
  const brandDescription = ref<string>('')
  const coverage = ref<number>(0)
  const categories = ref<string[]>([])
  const sources = ref<KnowledgeData['sources']>([])
  const missingKnowledge = ref<string[]>([])
  const freshness = ref<KnowledgeData['freshness'] | null>(null)
  const relationships = ref<KnowledgeData['relationships']>([])
  const statements = ref<KnowledgeData['statements']>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isEditing = ref<boolean>(false)
  const projectId = ref<string>('default')
  const searchQuery = ref<string>('')

  const hasData = computed(() => brandDescription.value.length > 0)
  const hasMissingKnowledge = computed(() => missingKnowledge.value.length > 0)
  const verifiedStatements = computed(() => statements.value.filter(s => s.status === 'verified'))

  const filteredStatements = computed(() => {
    if (!searchQuery.value) return statements.value
    const q = searchQuery.value.toLowerCase()
    return statements.value.filter(s => s.content.toLowerCase().includes(q))
  })

  async function fetchKnowledgeData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchKnowledge(projectId.value)
      brandDescription.value = data.brandDescription
      coverage.value = data.coverage
      categories.value = data.categories
      sources.value = data.sources
      missingKnowledge.value = data.missingKnowledge
      freshness.value = data.freshness
      relationships.value = data.relationships
      statements.value = data.statements
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load knowledge data'
    } finally {
      isLoading.value = false
    }
  }

  function toggleEditing() {
    isEditing.value = !isEditing.value
  }

  function setProject(id: string) {
    projectId.value = id
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  return {
    brandDescription, coverage, categories, sources, missingKnowledge,
    freshness, relationships, statements, isLoading, error, isEditing,
    projectId, searchQuery,
    hasData, hasMissingKnowledge, verifiedStatements, filteredStatements,
    fetchKnowledge: fetchKnowledgeData, toggleEditing, setProject, setSearchQuery,
  }
})
