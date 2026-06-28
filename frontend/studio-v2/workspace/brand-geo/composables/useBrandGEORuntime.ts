// ============================================================
// BrandGEORuntime — 品牌GEO 运行时逻辑层 (Phase 1 + Phase 2)
// 封装业务逻辑，桥接 Store ↔ UI
// ============================================================

import { computed } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { GeoPanelId, Brand, GeoProject, GeoProjectV2, WorkspaceFlowStage } from '~/studio-v2/types/geo'

export function useBrandGEORuntime() {
  const store = useBrandGeoStore()

  // ─── 面板路由解析 ───
  function resolvePanelFromRoute(query: Record<string, string>): GeoPanelId {
    const panel = query.panel as GeoPanelId
    const validPanels: GeoPanelId[] = [
      'dashboard', 'brands', 'entities', 'visibility',
      'citations', 'topics', 'competitors', 'projects',
      'tasks', 'settings', 'reports', 'help',
      'project-create', 'project-select', 'brand-profile',
      'website-scanner', 'knowledge-graph',
    ]
    if (panel && validPanels.includes(panel)) {
      return panel
    }
    return 'dashboard'
  }

  // ─── 初始化加载 ───
  async function initialize() {
    store.setLoading(true)
    store.setError(null)
    try {
      await Promise.all([
        store.fetchDashboardStats(),
        store.fetchBrands(),
        store.fetchProjects(),
        store.fetchV2Projects(),
        store.fetchTasks(),
      ])
    } catch (err: any) {
      store.setError(err.message || '初始化失败')
    } finally {
      store.setLoading(false)
    }
  }

  // ─── 加载品牌相关完整数据 ───
  async function loadBrandData(brandId: string) {
    store.setSelectedBrandId(brandId)
    store.setLoading(true)
    try {
      await Promise.all([
        store.fetchVisibility(brandId),
        store.fetchCitations(brandId),
        store.fetchTopics(brandId),
        store.fetchCompetitors(brandId),
        store.fetchEntities(brandId),
      ])
    } catch (err: any) {
      store.setError(err.message || '加载品牌数据失败')
    } finally {
      store.setLoading(false)
    }
  }

  // ─── 统计数据计算 ───
  const coverageRatePercent = computed(() => {
    const s = store.dashboardStats.value
    return s.coverageRate.toFixed(1) + '%'
  })

  const averageVisibilityFormatted = computed(() => {
    const s = store.dashboardStats.value
    return s.averageVisibility.toFixed(0)
  })

  // ─── 品牌选择 ───
  function selectBrand(brandId: string | null) {
    store.setSelectedBrandId(brandId)
  }

  // ─── 项目相关 (Phase 1) ───
  async function createNewProject(data: Partial<GeoProject>): Promise<string | null> {
    return store.createProject(data)
  }

  // ─── V2 项目相关 ───
  function selectV2Project(projectId: string | null) {
    store.setSelectedV2ProjectId(projectId)
  }

  async function createNewV2Project(data: {
    name: string
    website?: string
    industry?: string
    language?: string
    country?: string
  }): Promise<string | null> {
    return store.createV2Project(data)
  }

  async function loadV2ProjectData(projectId: string) {
    store.setSelectedV2ProjectId(projectId)
    store.setLoading(true)
    store.setError(null)
    try {
      await Promise.all([
        store.fetchBrandProfile(projectId),
        store.fetchSnapshot(projectId),
        store.fetchGraphNodes(projectId),
        store.fetchGraphEdges(projectId),
      ])
    } catch (err: any) {
      store.setError(err.message || '加载项目数据失败')
    } finally {
      store.setLoading(false)
    }
  }

  // ─── Workspace Flow ───
  function advanceWorkspaceFlow() {
    store.advanceFlow()
  }

  function getStageStatus(stage: WorkspaceFlowStage) {
    return store.workspaceFlow.value.stages[stage]
  }

  function isStageActive(stage: WorkspaceFlowStage) {
    return store.workspaceFlow.value.currentStage === stage
  }

  function isStageCompleted(stage: WorkspaceFlowStage) {
    return store.workspaceFlow.value.stages[stage] === 'completed'
  }

  const workspaceFlowProgress = computed(() => {
    const order: WorkspaceFlowStage[] = [
      'create_project', 'edit_brand_profile', 'website_scan',
      'generate_snapshot', 'build_graph', 'ready',
    ]
    const currentIdx = order.indexOf(store.workspaceFlow.value.currentStage)
    const completed = order.filter(s => store.workspaceFlow.value.stages[s] === 'completed').length
    return {
      current: store.workspaceFlow.value.currentStage,
      currentIndex: Math.max(0, currentIdx),
      total: order.length,
      completed,
      percentage: Math.round((completed / order.length) * 100),
      label: stageLabel(store.workspaceFlow.value.currentStage),
    }
  })

  function stageLabel(stage: WorkspaceFlowStage): string {
    const labels: Record<WorkspaceFlowStage, string> = {
      create_project: '创建项目',
      edit_brand_profile: '编辑品牌信息',
      website_scan: '网站扫描',
      generate_snapshot: '生成快照',
      build_graph: '构建图谱',
      ready: '就绪',
    }
    return labels[stage]
  }

  // ─── 当前面板标题 ───
  const currentPanelTitle = computed(() => {
    const titles: Record<string, string> = {
      dashboard: '总览仪表盘',
      brands: '品牌管理',
      entities: '实体图谱',
      visibility: '可见性分析',
      citations: '引用追踪',
      topics: '热门话题',
      competitors: '竞品分析',
      projects: '项目管理',
      tasks: '任务中心',
      reports: '报告中心',
      settings: '设置',
      help: '帮助与教程',
      'project-create': '创建项目',
      'project-select': '选择项目',
      'brand-profile': '品牌档案',
      'website-scanner': '网站扫描',
      'knowledge-graph': '知识图谱',
    }
    return titles[store.activePanelId.value] || '品牌GEO'
  })

  return {
    // Store 直通 (Phase 1)
    state: store.state,
    activePanelId: store.activePanelId,
    brands: store.brands,
    entities: store.entities,
    visibilityMetrics: store.visibilityMetrics,
    searchVisibility: store.searchVisibility,
    citations: store.citations,
    topics: store.topics,
    competitors: store.competitors,
    projects: store.projects,
    tasks: store.tasks,
    dashboardStats: store.dashboardStats,
    loading: store.loading,
    error: store.error,
    selectedBrandId: store.selectedBrandId,
    selectedProjectId: store.selectedProjectId,
    // Store 方法 (Phase 1)
    setActivePanel: store.setActivePanel,
    setBrands: store.setBrands,
    addBrand: store.addBrand,
    updateBrand: store.updateBrand,
    removeBrand: store.removeBrand,
    setEntities: store.setEntities,
    setVisibilityMetrics: store.setVisibilityMetrics,
    setSearchVisibility: store.setSearchVisibility,
    setCitations: store.setCitations,
    addCitation: store.addCitation,
    setTopics: store.setTopics,
    setCompetitors: store.setCompetitors,
    setProjects: store.setProjects,
    addProject: store.addProject,
    updateProject: store.updateProject,
    removeProject: store.removeProject,
    setTasks: store.setTasks,
    addTask: store.addTask,
    updateTask: store.updateTask,
    removeTask: store.removeTask,
    setDashboardStats: store.setDashboardStats,
    fetchBrands: store.fetchBrands,
    fetchDashboardStats: store.fetchDashboardStats,
    fetchProjects: store.fetchProjects,
    fetchTasks: store.fetchTasks,
    fetchEntities: store.fetchEntities,

    // Store 直通 (V2)
    v2Projects: store.v2Projects,
    brandProfile: store.brandProfile,
    websiteSnapshot: store.websiteSnapshot,
    graphNodes: store.graphNodes,
    graphEdges: store.graphEdges,
    selectedV2ProjectId: store.selectedV2ProjectId,
    workspaceFlow: store.workspaceFlow,
    // Store 方法 (V2)
    setSelectedV2ProjectId: store.setSelectedV2ProjectId,
    fetchV2Projects: store.fetchV2Projects,
    createV2Project: store.createV2Project,
    fetchV2ProjectById: store.fetchV2ProjectById,
    fetchBrandProfile: store.fetchBrandProfile,
    saveBrandProfile: store.saveBrandProfile,
    triggerScan: store.triggerScan,
    fetchScanStatus: store.fetchScanStatus,
    fetchSnapshot: store.fetchSnapshot,
    fetchGraphNodes: store.fetchGraphNodes,
    createGraphNode: store.createGraphNode,
    fetchGraphEdges: store.fetchGraphEdges,
    createGraphEdge: store.createGraphEdge,
    setCurrentStage: store.setCurrentStage,
    setStageStatus: store.setStageStatus,
    advanceFlow: store.advanceFlow,

    // Runtime 业务方法
    resolvePanelFromRoute,
    initialize,
    loadBrandData,
    selectBrand,
    createNewProject,
    selectV2Project,
    createNewV2Project,
    loadV2ProjectData,
    advanceWorkspaceFlow,
    getStageStatus,
    isStageActive,
    isStageCompleted,
    workspaceFlowProgress,
    stageLabel,
    coverageRatePercent,
    averageVisibilityFormatted,
    currentPanelTitle,
  }
}
