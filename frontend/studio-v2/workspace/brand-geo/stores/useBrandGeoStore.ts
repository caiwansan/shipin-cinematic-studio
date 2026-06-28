// ============================================================
// BrandGEO Store — 品牌GEO 工作台状态管理
// 遵循 Studio v2 Store → Runtime → UI 单向数据流
// ============================================================

import { reactive, computed, readonly } from 'vue'
import type {
  Brand,
  Entity,
  VisibilityMetric,
  SearchVisibility,
  Citation,
  Topic,
  Competitor,
  GeoProject,
  GeoTask,
  GeoDashboardStats,
  GeoPanelId,
  BrandGEORuntime,
} from '~/studio-v2/types/geo'

// ─── Helpers ───
function getAuthToken(): string {
  try {
    const nuxtToken = (window as any).__NUXT__?.token
    if (nuxtToken) return nuxtToken
    const ls = window.localStorage
    if (ls) {
      for (const key of ['auth_token', 'accessToken', 'token']) {
        const val = ls.getItem(key)
        if (val) return val
      }
    }
    return ''
  } catch { return '' }
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken()
  return t
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
    : { 'Content-Type': 'application/json' }
}

function httpErrorMessage(status: number, defaultMsg: string): string {
  const map: Record<number, string> = {
    400: '请求参数有误，请检查输入',
    401: '登录已过期，请重新登录',
    403: '权限不足',
    404: '请求的资源不存在',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误',
    502: '网关异常',
    503: '服务暂时不可用',
  }
  return map[status] || defaultMsg
}

// ─── Default Dashboard Stats ───
const defaultDashboardStats: GeoDashboardStats = {
  totalBrands: 0,
  activeProjects: 0,
  pendingTasks: 0,
  averageVisibility: 0,
  totalMentions: 0,
  positiveSentiment: 0,
  coverageRate: 0,
  competitorCount: 0,
}

// ─── State ───
const state = reactive<BrandGEORuntime>({
  activePanelId: 'dashboard',
  brands: [],
  entities: [],
  visibilityMetrics: [],
  searchVisibility: [],
  citations: [],
  topics: [],
  competitors: [],
  projects: [],
  tasks: [],
  dashboardStats: { ...defaultDashboardStats },
  loading: false,
  error: null,
  selectedBrandId: null,
  selectedProjectId: null,
})

export function useBrandGeoStore() {
  // ─── Panel Navigation ───
  function setActivePanel(panelId: GeoPanelId) {
    state.activePanelId = panelId
  }

  // ─── Brand ───
  function setBrands(brands: Brand[]) {
    state.brands = brands
  }

  function addBrand(brand: Brand) {
    state.brands.push(brand)
  }

  function updateBrand(id: string, patch: Partial<Brand>) {
    const idx = state.brands.findIndex(b => b.id === id)
    if (idx >= 0) {
      state.brands[idx] = { ...state.brands[idx], ...patch }
    }
  }

  function removeBrand(id: string) {
    state.brands = state.brands.filter(b => b.id !== id)
  }

  // ─── Entity ───
  function setEntities(entities: Entity[]) {
    state.entities = entities
  }

  function addEntity(entity: Entity) {
    state.entities.push(entity)
  }

  function updateEntity(id: string, patch: Partial<Entity>) {
    const idx = state.entities.findIndex(e => e.id === id)
    if (idx >= 0) {
      state.entities[idx] = { ...state.entities[idx], ...patch }
    }
  }

  function removeEntity(id: string) {
    state.entities = state.entities.filter(e => e.id !== id)
  }

  // ─── Visibility ───
  function setVisibilityMetrics(metrics: VisibilityMetric[]) {
    state.visibilityMetrics = metrics
  }

  function setSearchVisibility(vis: SearchVisibility[]) {
    state.searchVisibility = vis
  }

  // ─── Citations ───
  function setCitations(citations: Citation[]) {
    state.citations = citations
  }

  function addCitation(citation: Citation) {
    state.citations.push(citation)
  }

  // ─── Topics ───
  function setTopics(topics: Topic[]) {
    state.topics = topics
  }

  // ─── Competitors ───
  function setCompetitors(competitors: Competitor[]) {
    state.competitors = competitors
  }

  // ─── Projects ───
  function setProjects(projects: GeoProject[]) {
    state.projects = projects
  }

  function addProject(project: GeoProject) {
    state.projects.push(project)
  }

  function updateProject(id: string, patch: Partial<GeoProject>) {
    const idx = state.projects.findIndex(p => p.id === id)
    if (idx >= 0) {
      state.projects[idx] = { ...state.projects[idx], ...patch }
    }
  }

  function removeProject(id: string) {
    state.projects = state.projects.filter(p => p.id !== id)
  }

  function setSelectedProjectId(id: string | null) {
    state.selectedProjectId = id
  }

  // ─── Tasks ───
  function setTasks(tasks: GeoTask[]) {
    state.tasks = tasks
  }

  function addTask(task: GeoTask) {
    state.tasks.push(task)
  }

  function updateTask(id: string, patch: Partial<GeoTask>) {
    const idx = state.tasks.findIndex(t => t.id === id)
    if (idx >= 0) {
      state.tasks[idx] = { ...state.tasks[idx], ...patch }
    }
  }

  function removeTask(id: string) {
    state.tasks = state.tasks.filter(t => t.id !== id)
  }

  // ─── Dashboard Stats ───
  function setDashboardStats(stats: GeoDashboardStats) {
    state.dashboardStats = stats
  }

  function updateDashboardStats(patch: Partial<GeoDashboardStats>) {
    Object.assign(state.dashboardStats, patch)
  }

  // ─── Loading / Error ───
  function setLoading(loading: boolean) {
    state.loading = loading
  }

  function setError(error: string | null) {
    state.error = error
  }

  // ─── Selection ───
  function setSelectedBrandId(id: string | null) {
    state.selectedBrandId = id
  }

  // ─── Computed ───
  const selectedBrand = computed(() =>
    state.brands.find(b => b.id === state.selectedBrandId) || null
  )

  const selectedProject = computed(() =>
    state.projects.find(p => p.id === state.selectedProjectId) || null
  )

  const activeBrandProjects = computed(() =>
    state.selectedBrandId
      ? state.projects.filter(p => p.brandId === state.selectedBrandId)
      : state.projects
  )

  const pendingTasks = computed(() =>
    state.tasks.filter(t => t.status === 'pending')
  )

  // ─── API Methods ───

  /** 获取品牌列表 */
  async function fetchBrands(): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch('/api/geo/brands', { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取品牌列表失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.brands) setBrands(json.data.brands)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取品牌可见性 */
  async function fetchVisibility(brandId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch(`/api/geo/brands/${brandId}/visibility`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取可见性失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.metrics) setVisibilityMetrics(json.data.metrics)
      if (json.data?.search) setSearchVisibility(json.data.search)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取引用列表 */
  async function fetchCitations(brandId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch(`/api/geo/brands/${brandId}/citations`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取引用失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.citations) setCitations(json.data.citations)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取热门话题 */
  async function fetchTopics(brandId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch(`/api/geo/brands/${brandId}/topics`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取话题失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.topics) setTopics(json.data.topics)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取竞品分析 */
  async function fetchCompetitors(brandId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch(`/api/geo/brands/${brandId}/competitors`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取竞品失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.competitors) setCompetitors(json.data.competitors)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取仪表盘统计数据 */
  async function fetchDashboardStats(): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch('/api/geo/dashboard/stats', { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取统计数据失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.stats) setDashboardStats(json.data.stats)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 获取项目列表 */
  async function fetchProjects(brandId?: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const query = brandId ? `?brandId=${brandId}` : ''
      const res = await fetch(`/api/geo/projects${query}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取项目列表失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.projects) setProjects(json.data.projects)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 创建项目 */
  async function createProject(project: Partial<GeoProject>): Promise<string | null> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch('/api/geo/projects', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(project),
      })
      if (!res.ok) throw new Error(`创建项目失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.project) {
        addProject(json.data.project)
        return json.data.project.id
      }
      return null
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  /** 获取任务列表 */
  async function fetchTasks(projectId?: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const query = projectId ? `?projectId=${projectId}` : ''
      const res = await fetch(`/api/geo/tasks${query}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取任务列表失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.tasks) setTasks(json.data.tasks)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  /** 创建任务 */
  async function createTask(task: Partial<GeoTask>): Promise<string | null> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch('/api/geo/tasks', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(task),
      })
      if (!res.ok) throw new Error(`创建任务失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.task) {
        addTask(json.data.task)
        return json.data.task.id
      }
      return null
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  /** 获取品牌实体 */
  async function fetchEntities(brandId: string): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const res = await fetch(`/api/geo/brands/${brandId}/entities`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`获取实体失败: ${res.status}`)
      const json = await res.json()
      if (json.data?.entities) setEntities(json.data.entities)
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Return ───
  return {
    // 只读 state
    state: readonly(state) as unknown as BrandGEORuntime,
    // Panel
    activePanelId: computed(() => state.activePanelId),
    setActivePanel,
    // Brands
    brands: computed(() => state.brands),
    setBrands,
    addBrand,
    updateBrand,
    removeBrand,
    // Entities
    entities: computed(() => state.entities),
    setEntities,
    addEntity,
    updateEntity,
    removeEntity,
    // Visibility
    visibilityMetrics: computed(() => state.visibilityMetrics),
    searchVisibility: computed(() => state.searchVisibility),
    setVisibilityMetrics,
    setSearchVisibility,
    // Citations
    citations: computed(() => state.citations),
    setCitations,
    addCitation,
    // Topics
    topics: computed(() => state.topics),
    setTopics,
    // Competitors
    competitors: computed(() => state.competitors),
    setCompetitors,
    // Projects
    projects: computed(() => state.projects),
    setProjects,
    addProject,
    updateProject,
    removeProject,
    setSelectedProjectId,
    // Tasks
    tasks: computed(() => state.tasks),
    setTasks,
    addTask,
    updateTask,
    removeTask,
    // Dashboard
    dashboardStats: computed(() => state.dashboardStats),
    setDashboardStats,
    updateDashboardStats,
    // Loading / Error
    loading: computed(() => state.loading),
    error: computed(() => state.error),
    setLoading,
    setError,
    // Selection
    selectedBrandId: computed(() => state.selectedBrandId),
    selectedProjectId: computed(() => state.selectedProjectId),
    setSelectedBrandId,
    selectedBrand,
    selectedProject,
    // Computed
    activeBrandProjects,
    pendingTasks,
    // API
    fetchBrands,
    fetchVisibility,
    fetchCitations,
    fetchTopics,
    fetchCompetitors,
    fetchDashboardStats,
    fetchProjects,
    createProject,
    fetchTasks,
    createTask,
    fetchEntities,
  }
}
