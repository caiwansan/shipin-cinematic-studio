/**
 * GEO Workspace Store — Project Context & Workflow State Runtime
 *
 * 职责：所有 GEO 页面通过此 store 获取当前 project 上下文和 workflow 状态
 * 禁止页面自行读取 route.query.projectId 或 route.params.projectId
 *
 * Flow:
 *   setProject(id) → loadProject() → refreshWorkflow() → availableActions
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { geoApi } from '../workspaces/geo/services/api'

// ── Types ──

export type GEOStage =
  | 'CREATED'
  | 'DISCOVERING'
  | 'UNDERSTANDING'
  | 'OPTIMIZING'
  | 'VERIFYING'
  | 'PUBLISHING'
  | 'OBSERVING'

export interface GEOProjectInfo {
  id: string
  name: string
  website?: string
  industry?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

export interface GEOWorkflowState {
  id: string
  projectId: string
  stage: GEOStage
  completedStages: string[]
  availableActions: string[]
  updatedAt: string
}

export interface GEOWorkspaceContext {
  currentProjectId: string | null
  currentProject: GEOProjectInfo | null
  workflow: GEOWorkflowState | null
  loading: boolean
  error: string | null
}

// ── Store ──

export const useGeoWorkspaceStore = defineStore('geo-workspace', () => {
  // ── State ──
  const currentProjectId = ref<string | null>(null)
  const currentProject = ref<GEOProjectInfo | null>(null)
  const workflow = ref<GEOWorkflowState | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──
  const hasProject = computed(() => currentProjectId.value !== null && currentProject.value !== null)
  const workflowStage = computed(() => workflow.value?.stage ?? 'CREATED')
  const availableActions = computed(() => workflow.value?.availableActions ?? [])
  const isProjectLoaded = computed(() => !!currentProject.value && !!currentProjectId.value)

  // ── Actions ──

  function setProject(id: string) {
    if (currentProjectId.value !== id) {
      currentProjectId.value = id
      currentProject.value = null
      workflow.value = null
    }
  }

  async function loadProject(projectId?: string) {
    const pid = projectId || currentProjectId.value
    if (!pid) {
      error.value = '无项目 ID'
      return
    }

    setProject(pid)
    loading.value = true
    error.value = null

    try {
      // 优先从 /api/v1/geo/projects/:id 获取完整数据
      const res = await geoApi<{ success: boolean; data: GEOProjectInfo }>(`v1/geo/projects/${pid}`)
      if (res?.data) {
        currentProject.value = res.data
      }
    } catch (err: any) {
      error.value = err?.message || '加载项目失败'
    } finally {
      loading.value = false
    }
  }

  async function refreshWorkflow() {
    if (!currentProjectId.value) return

    try {
      const res = await geoApi<{ success: boolean; data: GEOWorkflowState }>(
        `v1/geo/projects/${currentProjectId.value}/workflow`
      )
      if (res?.data) {
        workflow.value = res.data
      }
    } catch {
      // workflow API 可能尚未就绪 — 静默失败
    }
  }

  function clearProject() {
    currentProjectId.value = null
    currentProject.value = null
    workflow.value = null
    error.value = null
  }

  async function initializeWithProject(projectId: string) {
    setProject(projectId)
    await loadProject()
    await refreshWorkflow()
  }

  return {
    // State
    currentProjectId,
    currentProject,
    workflow,
    loading,
    error,

    // Computed
    hasProject,
    workflowStage,
    availableActions,
    isProjectLoaded,

    // Actions
    setProject,
    loadProject,
    refreshWorkflow,
    clearProject,
    initializeWithProject,
  }
})
