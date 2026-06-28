// ============================================================
// BrandGEORuntime — 品牌GEO 运行时逻辑层
// 封装业务逻辑，桥接 Store ↔ UI
// ============================================================

import { computed } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { GeoPanelId, Brand, GeoProject } from '~/studio-v2/types/geo'

export function useBrandGEORuntime() {
  const store = useBrandGeoStore()

  // ─── 面板路由解析 ───
  function resolvePanelFromRoute(query: Record<string, string>): GeoPanelId {
    const panel = query.panel as GeoPanelId
    const validPanels: GeoPanelId[] = [
      'dashboard', 'brands', 'entities', 'visibility',
      'citations', 'topics', 'competitors', 'projects',
      'tasks', 'settings', 'reports', 'help',
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

  // ─── 项目相关 ───
  async function createNewProject(data: Partial<GeoProject>): Promise<string | null> {
    return store.createProject(data)
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
    }
    return titles[store.activePanelId.value] || '品牌GEO'
  })

  return {
    // Store 直通
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

    // Store 方法
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

    // Runtime 业务方法
    resolvePanelFromRoute,
    initialize,
    loadBrandData,
    selectBrand,
    createNewProject,
    coverageRatePercent,
    averageVisibilityFormatted,
    currentPanelTitle,
  }
}
