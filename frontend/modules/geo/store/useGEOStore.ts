// ============================================================
// GEO Store — Pinia 统一状态管理
// ============================================================

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GEOProject, Entity, EntityRelation, KnowledgeGraph, GraphVisualizationData, ResearchOutput } from '../types/index'
import { PIPELINE_STEPS } from '../types/index'
import { geoApi } from '../services/geo.service'

export const useGEOStore = defineStore('geo', () => {
  // ─── State ───
  const projects = ref<GEOProject[]>([])
  const currentProject = ref<GEOProject | null>(null)
  const entities = ref<Entity[]>([])
  const relations = ref<EntityRelation[]>([])
  const graph = ref<KnowledgeGraph | null>(null)
  const visualizationData = ref<GraphVisualizationData | null>(null)
  const researchResult = ref<ResearchOutput | null>(null)
  const pipelineSteps = ref([...PIPELINE_STEPS])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ─── Getters ───
  const activeProjects = computed(() => projects.value.filter(p => p.status !== 'archived'))
  const currentPipelineStep = computed(() => pipelineSteps.value.find(s => s.status === 'active'))
  const completedSteps = computed(() => pipelineSteps.value.filter(s => s.status === 'completed'))
  const entityCount = computed(() => entities.value.length)
  const relationCount = computed(() => relations.value.length)

  // ─── Actions ───

  function setProjects(list: GEOProject[]) {
    projects.value = list
  }

  function setCurrentProject(project: GEOProject | null) {
    currentProject.value = project
  }

  function reset() {
    projects.value = []
    currentProject.value = null
    entities.value = []
    relations.value = []
    graph.value = null
    visualizationData.value = null
    researchResult.value = null
    pipelineSteps.value = [...PIPELINE_STEPS]
    loading.value = false
    error.value = null
  }

  async function loadProjects(tenantId: string) {
    loading.value = true
    error.value = null
    try {
      projects.value = await geoApi.listProjects(tenantId)
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createProject(data: {
    name: string
    topic?: string
    userId?: string
    language?: string
    industry?: string
  }) {
    loading.value = true
    error.value = null
    try {
      const project = await geoApi.createProject(data)
      projects.value.unshift(project)
      return project
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function openProject(id: string) {
    loading.value = true
    error.value = null
    try {
      const project = await geoApi.getProject(id)
      currentProject.value = project
      // Load entity and graph data
      const [ents, graphData, vizData] = await Promise.all([
        geoApi.listEntities(id).catch(() => [] as Entity[]),
        geoApi.getGraph(id).catch(() => null),
        geoApi.visualize(id).catch(() => null),
      ])
      entities.value = ents
      graph.value = graphData
      visualizationData.value = vizData
      return project
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function runResearch(topic: string) {
    if (!currentProject.value) return null
    loading.value = true
    error.value = null
    try {
      setPipelineStep('topic_research', 'active')
      const result = await geoApi.discoverEntities(currentProject.value.id, topic)
      researchResult.value = {
        primaryTopic: topic,
        secondaryTopics: [],
        questions: [],
        competitors: [],
        keywords: [],
      }
      entities.value = result.entities
      relations.value = result.relations
      setPipelineStep('topic_research', 'completed')
      setPipelineStep('entity_discovery', 'completed')
      return result
    } catch (e: any) {
      setPipelineStep('topic_research', 'error')
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function buildGraph() {
    if (!currentProject.value) return null
    loading.value = true
    error.value = null
    try {
      setPipelineStep('knowledge_graph', 'active')
      const result = await geoApi.buildGraph(currentProject.value.id)
      graph.value = result
      visualizationData.value = await geoApi.visualize(currentProject.value.id).catch(() => null)
      setPipelineStep('knowledge_graph', 'completed')
      return result
    } catch (e: any) {
      setPipelineStep('knowledge_graph', 'error')
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  function setPipelineStep(key: string, status: 'pending' | 'active' | 'completed' | 'error') {
    const step = pipelineSteps.value.find(s => s.key === key)
    if (step) {
      step.status = status
    }
  }

  function resetPipeline() {
    pipelineSteps.value = [...PIPELINE_STEPS]
  }

  return {
    // State
    projects,
    currentProject,
    entities,
    relations,
    graph,
    visualizationData,
    researchResult,
    pipelineSteps,
    loading,
    error,
    // Getters
    activeProjects,
    currentPipelineStep,
    completedSteps,
    entityCount,
    relationCount,
    // Actions
    setProjects,
    setCurrentProject,
    reset,
    loadProjects,
    createProject,
    openProject,
    runResearch,
    buildGraph,
    setPipelineStep,
    resetPipeline,
  }
})
