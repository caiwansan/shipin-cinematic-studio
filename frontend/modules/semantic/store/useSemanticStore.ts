// ============================================================
// Semantic Store — state management for Semantic Runtime
// ============================================================

import { reactive, computed } from 'vue'
import { semanticService } from '../services/semantic.service'
import type {
  SemanticEntity, SemanticTopic, SemanticAlias, SemanticTaxonomy,
  SemanticKeyword, SemanticStats, EntityFilter,
} from '../types/index'

interface SemanticStoreState {
  entities: SemanticEntity[]
  entitiesTotal: number
  topics: SemanticTopic[]
  topicsTotal: number
  aliases: SemanticAlias[]
  taxonomyTree: SemanticTaxonomy[]
  keywords: SemanticKeyword[]
  stats: SemanticStats
  loading: boolean
  error: string | null
}

const state = reactive<SemanticStoreState>({
  entities: [],
  entitiesTotal: 0,
  topics: [],
  topicsTotal: 0,
  aliases: [],
  taxonomyTree: [],
  keywords: [],
  stats: { entityCount: 0, topicCount: 0, relationCount: 0, aliasCount: 0, taxonomyCount: 0, keywordCount: 0 },
  loading: false,
  error: null,
})

export function useSemanticStore() {
  function setLoading(loading: boolean) { state.loading = loading }
  function setError(error: string | null) { state.error = error }

  async function fetchEntities(projectId: string, filter?: EntityFilter): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await semanticService.listEntities(projectId, filter)
      state.entities = result.items
      state.entitiesTotal = result.total
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchTopics(projectId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await semanticService.listTopics(projectId)
      state.topics = result.items
      state.topicsTotal = result.total
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchAliases(projectId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const aliases = await semanticService.listAliases(projectId)
      state.aliases = aliases
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchTaxonomyTree(projectId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const tree = await semanticService.getTaxonomyTree(projectId)
      state.taxonomyTree = tree
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchKeywords(projectId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await semanticService.listKeywords(projectId)
      state.keywords = result.items
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function fetchStats(projectId: string): Promise<boolean> {
    try {
      const stats = await semanticService.getStats(projectId)
      state.stats = stats
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    }
  }

  async function loadAll(projectId: string) {
    await Promise.all([
      fetchEntities(projectId),
      fetchTopics(projectId),
      fetchAliases(projectId),
      fetchTaxonomyTree(projectId),
      fetchKeywords(projectId),
      fetchStats(projectId),
    ])
  }

  return {
    state: state as Readonly<SemanticStoreState>,

    entities: computed(() => state.entities),
    entitiesTotal: computed(() => state.entitiesTotal),
    topics: computed(() => state.topics),
    topicsTotal: computed(() => state.topicsTotal),
    aliases: computed(() => state.aliases),
    taxonomyTree: computed(() => state.taxonomyTree),
    keywords: computed(() => state.keywords),
    stats: computed(() => state.stats),
    loading: computed(() => state.loading),
    error: computed(() => state.error),

    setLoading,
    setError,
    fetchEntities,
    fetchTopics,
    fetchAliases,
    fetchTaxonomyTree,
    fetchKeywords,
    fetchStats,
    loadAll,
  }
}
