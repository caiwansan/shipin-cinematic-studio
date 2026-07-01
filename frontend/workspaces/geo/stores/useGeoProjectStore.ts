/**
 * GEO Project Store — Unified Project Model
 *
 * P1-A: Persistence Layer + Unified Project Model
 *
 * Manages:
 * - Current project selection
 * - Persisted discovery report, action plans, verification report
 * - Project history
 * - CRUD operations backed by API
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { geoApi } from '../services/api'

export interface GEOProject {
  id: string
  userId: string
  name: string
  website?: string
  topic?: string
  industry?: string
  language: string
  country?: string
  status: string
  config?: Record<string, any>
  workspaceId?: string
  deletedAt?: string | null
  createdAt: string
  updatedAt: string
  entityCount?: number
  relationCount?: number
  versionCount?: number
}

export interface PersistedDiscoveryReport {
  id: string
  projectId: string
  entityName: string
  adi: number
  coverageScore: number
  shareScore: number
  positionScore: number
  reportData: any
  createdAt: string
  updatedAt: string
}

export interface PersistedActionPlan {
  id: string
  projectId: string
  discoveryReportId: string | null
  planData: any
  status: string
  createdAt: string
  updatedAt: string
}

export interface PersistedVerificationReport {
  id: string
  projectId: string
  entityName: string
  beforeAdi: number
  afterAdi: number
  deltaAdi: number
  reportData: any
  createdAt: string
}

export interface HistoryItem {
  type: 'discovery' | 'action_plan' | 'verification'
  id: string
  projectId: string
  entityName?: string
  createdAt: string
  summary: string
}

export interface ProjectDashboard {
  project: GEOProject | null
  discoveryReport: PersistedDiscoveryReport | null
  actionPlan: PersistedActionPlan | null
  verificationReport: PersistedVerificationReport | null
}

export const useGeoProjectStore = defineStore('geo-project', () => {
  // ── State ──
  const currentProject = ref<GEOProject | null>(null)
  const projects = ref<GEOProject[]>([])
  const discoveryReport = ref<PersistedDiscoveryReport | null>(null)
  const actionPlan = ref<PersistedActionPlan | null>(null)
  const verificationReport = ref<PersistedVerificationReport | null>(null)
  const history = ref<HistoryItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // ── API Helpers ──

  function getHeaders() {
    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function apiCall<T>(url: string, options?: any): Promise<T> {
    const headers = getHeaders()
    return geoApi<T>(url, {
      ...options,
      headers: { ...headers, ...options?.headers },
    })
  }

  // ── Actions ──

  async function listProjects(): Promise<GEOProject[]> {
    try {
      const raw = await apiCall<{ success: boolean; data: GEOProject[] }>('projects')
      projects.value = raw.data || []
      return projects.value
    } catch (err: any) {
      error.value = err?.message || 'Failed to load projects'
      return []
    }
  }

  async function createProject(name: string, industry?: string, extraFields?: {
    website?: string
    description?: string
    region?: string
    companyType?: string
    primaryLanguage?: string
  }): Promise<GEOProject | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{ success: boolean; data: GEOProject }>('projects', {
        method: 'POST',
        body: {
          name,
          industry,
          website: extraFields?.website || '',
          description: extraFields?.description || '',
          region: extraFields?.region || '',
          companyType: extraFields?.companyType || '',
          primaryLanguage: extraFields?.primaryLanguage || '',
        },
      })
      currentProject.value = raw.data
      projects.value.unshift(raw.data)
      return raw.data
    } catch (err: any) {
      error.value = err?.message || 'Failed to create project'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function updateProject(projectId: string, name?: string, industry?: string, extraFields?: {
    website?: string
    description?: string
    region?: string
    companyType?: string
    primaryLanguage?: string
  }): Promise<GEOProject | null> {
    isLoading.value = true
    error.value = null

    try {
      const body: any = {}
      if (name) body.name = name
      if (industry) body.industry = industry
      if (extraFields?.website) body.website = extraFields.website
      if (extraFields?.description) body.description = extraFields.description
      if (extraFields?.region) body.region = extraFields.region
      if (extraFields?.companyType) body.companyType = extraFields.companyType
      if (extraFields?.primaryLanguage) body.primaryLanguage = extraFields.primaryLanguage

      const raw = await apiCall<{ success: boolean; data: GEOProject }>(`projects/${projectId}`, {
        method: 'PUT',
        body,
      })
      currentProject.value = raw.data
      // Update in list too
      const idx = projects.value.findIndex((p: any) => p.id === projectId)
      if (idx !== -1) projects.value[idx] = raw.data
      return raw.data
    } catch (err: any) {
      error.value = err?.message || '更新失败'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function loadProject(projectId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      // Load dashboard (project + all reports)
      const raw = await apiCall<{ success: boolean; data: ProjectDashboard }>(`projects/${projectId}/dashboard`)
      const d = raw.data
      currentProject.value = d.project
      discoveryReport.value = d.discoveryReport
      actionPlan.value = d.actionPlan
      verificationReport.value = d.verificationReport
    } catch (err: any) {
      error.value = err?.message || 'Failed to load project'
    } finally {
      isLoading.value = false
    }
  }

  async function loadBrand(brandId: string): Promise<GEOProject | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{ success: boolean; data: GEOProject }>(`brands/${brandId}`)
      currentProject.value = raw.data
      return raw.data
    } catch (err: any) {
      error.value = err?.message || 'Failed to load brand'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function saveDiscoveryReport(projectId: string, report: {
    entityName: string
    adi: number
    coverageScore: number
    shareScore: number
    positionScore: number
    reportData: any
  }): Promise<PersistedDiscoveryReport | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{ success: boolean; data: PersistedDiscoveryReport }>(
        `projects/${projectId}/discovery`,
        {
          method: 'PUT',
          body: report,
        }
      )
      discoveryReport.value = raw.data
      return raw.data
    } catch (err: any) {
      error.value = err?.message || 'Failed to save discovery report'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function saveActionPlan(projectId: string, planData: any, discoveryReportId?: string): Promise<PersistedActionPlan | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{ success: boolean; data: PersistedActionPlan }>(
        `projects/${projectId}/action-plan`,
        {
          method: 'PUT',
          body: { planData, discoveryReportId },
        }
      )
      actionPlan.value = raw.data
      return raw.data
    } catch (err: any) {
      error.value = err?.message || 'Failed to save action plan'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function saveVerificationReport(projectId: string, report: {
    entityName: string
    beforeAdi: number
    afterAdi: number
    reportData: any
  }): Promise<PersistedVerificationReport | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{ success: boolean; data: PersistedVerificationReport }>(
        `projects/${projectId}/verification`,
        {
          method: 'PUT',
          body: report,
        }
      )
      verificationReport.value = raw.data
      return raw.data
    } catch (err: any) {
      error.value = err?.message || 'Failed to save verification report'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function loadHistory(projectId: string): Promise<HistoryItem[]> {
    try {
      const raw = await apiCall<{ success: boolean; data: HistoryItem[] }>(`projects/${projectId}/history`)
      history.value = raw.data || []
      return history.value
    } catch (err: any) {
      error.value = err?.message || 'Failed to load history'
      return []
    }
  }

  async function deleteBrand(brandId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      await apiCall<{ success: boolean; data: { deleted: boolean } }>(`brands/${brandId}`, {
        method: 'DELETE',
      })
      // Remove from local list
      projects.value = projects.value.filter((p: any) => p.id !== brandId)
      currentProject.value = null
      return true
    } catch (err: any) {
      error.value = err?.message || '删除失败'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function quickDiscovery(projectId: string): Promise<{
    adi: number
    dimensions: { coverage: number; share: number; position: number }
    summary: string
  } | null> {
    isLoading.value = true
    error.value = null

    try {
      const raw = await apiCall<{
        success: boolean
        data: { adi: number; dimensions: { coverage: number; share: number; position: number }; summary: string }
      }>(`projects/${projectId}/quick-discovery`, {
        method: 'POST',
      })
      return raw.data
    } catch (err: any) {
      error.value = err?.message || '快速分析失败'
      return null
    } finally {
      isLoading.value = false
    }
  }

  function reset() {
    currentProject.value = null
    projects.value = []
    discoveryReport.value = null
    actionPlan.value = null
    verificationReport.value = null
    history.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    currentProject,
    projects,
    discoveryReport,
    actionPlan,
    verificationReport,
    history,
    isLoading,
    error,

    // Actions
    listProjects,
    createProject,
    updateProject,
    loadProject,
    loadBrand,
    saveDiscoveryReport,
    saveActionPlan,
    saveVerificationReport,
    loadHistory,
    deleteBrand,
    quickDiscovery,
    reset,
  }
})
