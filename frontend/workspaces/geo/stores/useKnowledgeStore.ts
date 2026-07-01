/**
 * GEO Knowledge Store — Pinia Store
 *
 * Manages knowledge data: assets, coverage, categories, freshness, relationships.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchKnowledge } from '../services/knowledgeService'
import type {
  KnowledgeData,
  KnowledgeAssets,
  KnowledgeCoverage,
  KnowledgeCategory,
  KnowledgeFreshness,
  KnowledgeRelationship,
} from '../services/knowledgeService'

export const useKnowledgeStore = defineStore('geo-knowledge', () => {
  const assets = ref<KnowledgeAssets>({ total: 0, entities: 0, claims: 0, evidences: 0, relations: 0, schemas: 0, faqs: 0, keywords: 0, knowledgeObjects: 0 })
  const coverage = ref<KnowledgeCoverage>({ percentage: 0, coveredDimensions: 0, totalDimensions: 7, dimensions: [] })
  const categories = ref<KnowledgeCategory[]>([])
  const freshness = ref<KnowledgeFreshness | null>(null)
  const missingKnowledge = ref<Array<{ category: string; suggestion: string }>>([])
  const relationships = ref<KnowledgeRelationship[]>([])

  // Backward compatible derived fields
  const brandDescription = computed(() => `Brand knowledge base with ${assets.value.total} total assets across ${coverage.value.coveredDimensions} of ${coverage.value.totalDimensions} dimensions.`)
  const sources = computed(() =>
    categories.value.map(cat => ({
      name: cat.name ?? 'Unknown Category',
      type: 'category',
      freshness: freshness.value?.lastUpdated ? `Updated ${freshness.value.lastUpdated.split('T')[0]}` : 'Not updated',
    }))
  )
  const statements = computed(() =>
    categories.value.flatMap(cat =>
      (cat.items ?? []).map(item => ({
        id: `${cat.name}-${item}`,
        content: item,
        category: cat.name,
        status: 'verified' as const,
      }))
    )
  )

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const isEditing = ref<boolean>(false)
  const projectId = ref<string>('default')
  const searchQuery = ref<string>('')

  const hasData = computed(() => assets.value.total > 0)
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
      assets.value = data.assets
      coverage.value = data.coverage
      categories.value = data.categories
      freshness.value = data.freshness
      missingKnowledge.value = data.missingKnowledge
      relationships.value = data.relationships
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
    assets, coverage, categories, freshness, missingKnowledge, relationships,
    brandDescription, sources, statements,
    isLoading, error, isEditing, projectId, searchQuery,
    hasData, hasMissingKnowledge, verifiedStatements, filteredStatements,
    fetchKnowledge: fetchKnowledgeData, toggleEditing, setProject, setSearchQuery,
  }
})
