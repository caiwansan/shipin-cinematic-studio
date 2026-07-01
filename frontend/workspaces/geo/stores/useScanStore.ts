/**
 * GEO Scan Store — Pinia Store
 *
 * Manages scan-related state for brand scanning MVP.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchProjects,
  fetchProject,
  createProject,
  triggerScan,
  fetchScanResult,
  fetchOptimizeSuggestions,
  applyOptimization,
  type ProjectItem,
  type ScanResult,
  type OptimizeSuggestion,
  type CreateProjectInput,
  type ScanHistoryItem,
} from '../services/scanService'

export const useScanStore = defineStore('geo-scan', () => {
  // ---- State ----
  const projects = ref<ProjectItem[]>([])
  const currentProject = ref<ProjectItem | null>(null)
  const currentScanResult = ref<ScanResult | null>(null)
  const optimizeSuggestions = ref<OptimizeSuggestion[]>([])
  const scanHistory = ref<ScanHistoryItem[]>([])

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isScanning = ref(false)
  const isOptimizing = ref(false)

  // ---- Computed ----
  const hasProjects = computed(() => projects.value.length > 0)
  const hasCurrentProject = computed(() => currentProject.value !== null)
  const hasScanResult = computed(() => currentScanResult.value !== null)
  const hasOptimizeSuggestions = computed(() => optimizeSuggestions.value.length > 0)
  const latestScanScore = computed(() => currentScanResult.value?.overallScore ?? 0)

  const dimensionLabels: Record<string, string> = {
    visibility: '可见度',
    accuracy: '准确性',
    consistency: '一致性',
    recommendability: '推荐意愿',
  }

  // ---- Actions ----

  /** 获取所有项目列表 */
  async function loadProjects(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      projects.value = await fetchProjects()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取项目列表失败'
    } finally {
      isLoading.value = false
    }
  }

  /** 获取单个项目详情 */
  async function loadProject(id: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      currentProject.value = await fetchProject(id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取项目详情失败'
    } finally {
      isLoading.value = false
    }
  }

  /** 创建新项目 */
  async function createNewProject(input: CreateProjectInput): Promise<ProjectItem | null> {
    isLoading.value = true
    error.value = null
    try {
      const project = await createProject(input)
      projects.value.unshift(project)
      return project
    } catch (err) {
      error.value = err instanceof Error ? err.message : '创建项目失败'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** 触发扫描 */
  async function startScan(projectId: string): Promise<{ scanId: string } | null> {
    isScanning.value = true
    error.value = null
    try {
      const result = await triggerScan(projectId)
      return { scanId: result.scanId }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '触发扫描失败'
      return null
    } finally {
      isScanning.value = false
    }
  }

  /** 获取扫描结果 */
  async function loadScanResult(projectId: string, scanId: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      currentScanResult.value = await fetchScanResult(projectId, scanId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取扫描结果失败'
    } finally {
      isLoading.value = false
    }
  }

  /** 获取优化建议 */
  async function loadOptimizeSuggestions(projectId: string, scanId: string): Promise<void> {
    isOptimizing.value = true
    error.value = null
    try {
      optimizeSuggestions.value = await fetchOptimizeSuggestions(projectId, scanId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取优化建议失败'
    } finally {
      isOptimizing.value = false
    }
  }

  /** 标记优化已应用 */
  async function markOptimizationApplied(projectId: string, scanId: string, suggestionId: string): Promise<boolean> {
    try {
      const success = await applyOptimization(projectId, scanId)
      if (success) {
        const idx = optimizeSuggestions.value.findIndex((s) => s.id === suggestionId)
        if (idx >= 0) {
          optimizeSuggestions.value[idx].applied = true
        }
      }
      return success
    } catch (err) {
      error.value = err instanceof Error ? err.message : '应用优化失败'
      return false
    }
  }

  /** 添加到扫描历史 */
  function addScanHistory(projectId: string, item: ScanHistoryItem): void {
    scanHistory.value.unshift(item)
  }

  /** 清空错误 */
  function clearError(): void {
    error.value = null
  }

  /** 重置状态 */
  function reset(): void {
    projects.value = []
    currentProject.value = null
    currentScanResult.value = null
    optimizeSuggestions.value = []
    scanHistory.value = []
    isLoading.value = false
    error.value = null
    isScanning.value = false
    isOptimizing.value = false
  }

  return {
    // State
    projects,
    currentProject,
    currentScanResult,
    optimizeSuggestions,
    scanHistory,
    isLoading,
    error,
    isScanning,
    isOptimizing,
    // Computed
    hasProjects,
    hasCurrentProject,
    hasScanResult,
    hasOptimizeSuggestions,
    latestScanScore,
    dimensionLabels,
    // Actions
    loadProjects,
    loadProject,
    createNewProject,
    startScan,
    loadScanResult,
    loadOptimizeSuggestions,
    markOptimizationApplied,
    addScanHistory,
    clearError,
    reset,
  }
})
