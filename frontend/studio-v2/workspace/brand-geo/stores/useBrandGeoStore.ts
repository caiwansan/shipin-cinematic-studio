// ============================================================
// BrandGEO Store — 品牌GEO 工作台状态管理 (Phase 1 + 2 + P1.5)
// 遵循 Studio v2 Store → Runtime → UI 单向数据流
// Repository 模式：Service 不直接访问 Store
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
  GeoProjectV2,
  GeoBrandProfile,
  WebsiteSnapshot,
  GeoGraphNode,
  GeoGraphEdge,
  WorkspaceFlowStage,
  WorkspaceFlowState,
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
  if (!t) return { 'Content-Type': 'application/json' }
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` }
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

const defaultFlowState: WorkspaceFlowState = {
  currentStage: 'create_project',
  stages: {
    create_project: 'active',
    build_graph: 'pending',
    ready: 'pending',
  },
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
  // V2 state
  v2Projects: [],
  brandProfile: null,
  websiteSnapshot: null,
  graphNodes: [],
  graphEdges: [],
  workspaceFlow: { ...defaultFlowState },
  // Dashboard stats
  dashboardStats: { ...defaultDashboardStats },
  // UI state
  loading: false,
  error: null,
  selectedBrandId: null,
  selectedProjectId: null,
  selectedV2ProjectId: null,
  // P1.5 — brand geo store extensions
  currentBrand: null as GeoProjectV2 | null,
  providerStatus: { configured: false, providers: [] } as { configured: boolean; providers: any[] },
  _uiState: {} as Record<string, any>,
})

function apiUrl(path: string): string {
  return `/api/geo${path}`
}

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(apiUrl(path), { headers: authHeaders(), ...options })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API error ${res.status}: ${text}`)
    }
    const json = await res.json()
    return json as T
  } catch (err: any) {
    state.error = err.message
    return null
  }
}

export function useBrandGeoStore() {
  // ─── Panel Navigation ───
  function setActivePanel(panelId: GeoPanelId) {
    state.activePanelId = panelId
  }

  // ─── Brand (Phase 1) ───
  function setBrands(brands: Brand[]) { state.brands = brands }
  function addBrand(brand: Brand) { state.brands.push(brand) }
  function updateBrand(id: string, patch: Partial<Brand>) {
    const idx = state.brands.findIndex(b => b.id === id)
    if (idx >= 0) state.brands[idx] = { ...state.brands[idx], ...patch }
  }
  function removeBrand(id: string) { state.brands = state.brands.filter(b => b.id !== id) }

  // ─── Entity (Phase 1) ───
  function setEntities(entities: Entity[]) { state.entities = entities }
  function addEntity(entity: Entity) { state.entities.push(entity) }
  function updateEntity(id: string, patch: Partial<Entity>) {
    const idx = state.entities.findIndex(e => e.id === id)
    if (idx >= 0) state.entities[idx] = { ...state.entities[idx], ...patch }
  }
  function removeEntity(id: string) { state.entities = state.entities.filter(e => e.id !== id) }

  // ─── Visibility (Phase 1) ───
  function setVisibilityMetrics(metrics: VisibilityMetric[]) { state.visibilityMetrics = metrics }
  function setSearchVisibility(vis: SearchVisibility[]) { state.searchVisibility = vis }

  // ─── Citations (Phase 1) ───
  function setCitations(citations: Citation[]) { state.citations = citations }
  function addCitation(citation: Citation) { state.citations.push(citation) }

  // ─── Topics (Phase 1) ───
  function setTopics(topics: Topic[]) { state.topics = topics }

  // ─── Competitors (Phase 1) ───
  function setCompetitors(competitors: Competitor[]) { state.competitors = competitors }

  // ─── Projects (Phase 1) ───
  function setProjects(projects: GeoProject[]) { state.projects = projects }
  function addProject(project: GeoProject) { state.projects.push(project) }
  function updateProject(id: string, patch: Partial<GeoProject>) {
    const idx = state.projects.findIndex(p => p.id === id)
    if (idx >= 0) state.projects[idx] = { ...state.projects[idx], ...patch }
  }
  function removeProject(id: string) { state.projects = state.projects.filter(p => p.id !== id) }
  function setSelectedProjectId(id: string | null) { state.selectedProjectId = id }

  // ─── Tasks (Phase 1) ───
  function setTasks(tasks: GeoTask[]) { state.tasks = tasks }
  function addTask(task: GeoTask) { state.tasks.push(task) }
  function updateTask(id: string, patch: Partial<GeoTask>) {
    const idx = state.tasks.findIndex(t => t.id === id)
    if (idx >= 0) state.tasks[idx] = { ...state.tasks[idx], ...patch }
  }
  function removeTask(id: string) { state.tasks = state.tasks.filter(t => t.id !== id) }

  // ─── Dashboard Stats (Phase 1) ───
  function setDashboardStats(stats: GeoDashboardStats) { state.dashboardStats = stats }
  function updateDashboardStats(patch: Partial<GeoDashboardStats>) {
    Object.assign(state.dashboardStats, patch)
  }

  // ─── Loading / Error (Phase 1) ───
  function setLoading(loading: boolean) { state.loading = loading }
  function setError(error: string | null) { state.error = error }

  // ─── Selection (Phase 1) ───
  function setSelectedBrandId(id: string | null) { state.selectedBrandId = id }

  // ─── Computed (Phase 1) ───
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

  // ==================================================================
  // V2 — GeoProject
  // ==================================================================

  function setV2Projects(projects: GeoProjectV2[]) { state.v2Projects = projects }
  function addV2Project(project: GeoProjectV2) { state.v2Projects.push(project) }
  function setSelectedV2ProjectId(id: string | null) { state.selectedV2ProjectId = id }

  const selectedV2Project = computed(() =>
    state.v2Projects.find(p => p.id === state.selectedV2ProjectId) || null
  )

  async function fetchV2Projects(): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: GeoProjectV2[] }>('/projects')
      if (result?.success && Array.isArray(result.data)) setV2Projects(result.data as GeoProjectV2[])
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function createV2Project(data: {
    name: string
    website?: string
    industry?: string
    language?: string
    country?: string
    executionResults?: any
  }): Promise<string | null> {
    state.loading = true
    state.error = null
    try {
      // Map frontend fields to backend API format
      const body: Record<string, any> = {
        name: data.name,
        industry: data.industry,
        language: data.language,
        topic: data.website || data.country || '',
      }
      if (data.executionResults) {
        body.config = data.executionResults
      }
      const result = await apiFetch<{ success: boolean; data: any }>('/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (result?.data) {
        addV2Project(result.data as GeoProjectV2)
        return result.data.id
      }
      return null
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchV2ProjectById(id: string): Promise<GeoProjectV2 | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { project: GeoProjectV2 } }>(`/projects/${id}`)
      return result?.data?.project || null
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // ==================================================================
  // V2 — Brand Profile
  // ==================================================================

  function setBrandProfile(profile: GeoBrandProfile | null) { state.brandProfile = profile }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchBrandProfile(projectId: string): Promise<GeoBrandProfile | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { brand: GeoBrandProfile } }>(`/brand/${projectId}`)
      const profile = result?.data?.brand || null
      setBrandProfile(profile)
      return profile
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function saveBrandProfile(projectId: string, data: Partial<GeoBrandProfile>): Promise<GeoBrandProfile | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { brand: GeoBrandProfile } }>(`/brand/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      const profile = result?.data?.brand || null
      setBrandProfile(profile)
      return profile
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // ==================================================================
  // V2 — Website Scanner / Snapshot
  // ==================================================================

  function setWebsiteSnapshot(snapshot: WebsiteSnapshot | null) { state.websiteSnapshot = snapshot }
  // @deprecated Phase 1 cleanup candidate — no UI consumer

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function triggerScan(projectId: string, url: string): Promise<WebsiteSnapshot | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { snapshot: WebsiteSnapshot } }>('/scan', {
        method: 'POST',
        body: JSON.stringify({ projectId, url }),
      })
      const snapshot = result?.data?.snapshot || null
      setWebsiteSnapshot(snapshot)
      return snapshot
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchScanStatus(projectId: string): Promise<{ status: string; error?: string } | null> {
    try {
      const result = await apiFetch<{ success: boolean; data: { status: { status: string; error?: string } } }>(`/scan/${projectId}/status`)
      return result?.data?.status || null
    } catch {
      return null
    }
  }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchSnapshot(projectId: string): Promise<WebsiteSnapshot | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { snapshot: WebsiteSnapshot } }>(`/snapshot/${projectId}`)
      const snapshot = result?.data?.snapshot || null
      setWebsiteSnapshot(snapshot)
      return snapshot
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // ==================================================================
  // V2 — Knowledge Graph
  // ==================================================================

  function setGraphNodes(nodes: GeoGraphNode[]) { state.graphNodes = nodes }
  function setGraphEdges(edges: GeoGraphEdge[]) { state.graphEdges = edges }
  function addGraphNode(node: GeoGraphNode) { state.graphNodes.push(node) }
  function addGraphEdge(edge: GeoGraphEdge) { state.graphEdges.push(edge) }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchGraphNodes(projectId: string): Promise<GeoGraphNode[]> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { nodes: GeoGraphNode[] } }>(`/projects/${projectId}/graph/nodes`)
      const nodes = result?.data?.nodes || []
      setGraphNodes(nodes)
      return nodes
    } catch (err: any) {
      state.error = err.message
      return []
    } finally {
      state.loading = false
    }
  }

  async function createGraphNode(data: {
    projectId: string
    type: string
    label: string
    properties?: string
  }): Promise<GeoGraphNode | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { node: GeoGraphNode } }>(`/projects/${data.projectId}/graph/nodes`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const node = result?.data?.node || null
      if (node) addGraphNode(node)
      return node
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // @deprecated Phase 1 cleanup candidate — no UI consumer
  async function fetchGraphEdges(projectId: string): Promise<GeoGraphEdge[]> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { edges: GeoGraphEdge[] } }>(`/projects/${projectId}/graph/edges`)
      const edges = result?.data?.edges || []
      setGraphEdges(edges)
      return edges
    } catch (err: any) {
      state.error = err.message
      return []
    } finally {
      state.loading = false
    }
  // @deprecated Phase 1 cleanup candidate — no UI consumer
  }

  async function createGraphEdge(data: {
    sourceId: string
    targetId: string
    type: string
    properties?: string
  }): Promise<GeoGraphEdge | null> {
    state.loading = true
    state.error = null
    try {
      const result = await apiFetch<{ success: boolean; data: { edge: GeoGraphEdge } }>('/graph/edges', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const edge = result?.data?.edge || null
      if (edge) addGraphEdge(edge)
      return edge
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // ==================================================================
  // V2 — Workspace Flow
  // ==================================================================

  function setCurrentStage(stage: WorkspaceFlowStage) {
    state.workspaceFlow.currentStage = stage
  }

  function setStageStatus(stage: WorkspaceFlowStage, status: 'pending' | 'active' | 'completed' | 'skipped') {
    state.workspaceFlow.stages[stage] = status
  }

  function advanceFlow() {
    const order: WorkspaceFlowStage[] = [
      'create_project',
      'edit_brand_profile',
      'website_scan',
      'generate_snapshot',
      'build_graph',
      'ready',
    ]
    const currentIdx = order.indexOf(state.workspaceFlow.currentStage)
    if (currentIdx < order.length - 1) {
      state.workspaceFlow.stages[state.workspaceFlow.currentStage] = 'completed'
      state.workspaceFlow.currentStage = order[currentIdx + 1]
      state.workspaceFlow.stages[order[currentIdx + 1]] = 'active'
    }
  }

  // ==================================================================
  // Phase 1 API Methods (Keep)
  // ==================================================================

  // ==================================================================
  // P1.5 — Brand Geo Store Extensions
  // ==================================================================

  function setCurrentBrand(brand: GeoProjectV2 | null) { state.currentBrand = brand }
  function setProviderStatus(status: { configured: boolean; providers: any[] }) { state.providerStatus = status }
  function resetToProviderSetup() { state.providerStatus = { configured: false, providers: [] } }

  async function fetchProviderStatus(): Promise<{ configured: boolean; providers: any[] } | null> {
    try {
      const res = await fetch('/api/geo/dashboard/provider-status', { headers: authHeaders() })
      const json = await res.json()
      if (json.success) {
        const ps = { configured: json.data.configured, providers: json.data.providers || [] }
        setProviderStatus(ps)
        return ps
      }
      return null
    } catch {
      return null
    }
  }

  // ─── Return ───
  return {
    // 只读 state
    state: readonly(state) as unknown as BrandGEORuntime,
    // Panel
    activePanelId: computed(() => state.activePanelId),
    setActivePanel,
    // Selection
    selectedBrandId: computed(() => state.selectedBrandId),
    selectedProjectId: computed(() => state.selectedProjectId),
    selectedV2ProjectId: computed(() => state.selectedV2ProjectId),
    setSelectedBrandId, setSelectedV2ProjectId,
    selectedBrand, selectedProject, selectedV2Project,

    // V2 — Projects
    v2Projects: computed(() => state.v2Projects),
    setV2Projects, addV2Project,
    fetchV2Projects, createV2Project, fetchV2ProjectById,

    // V2 — Brand Profile
    brandProfile: computed(() => state.brandProfile),
    setBrandProfile,
    fetchBrandProfile, saveBrandProfile,

    // V2 — Scanner / Snapshot
    websiteSnapshot: computed(() => state.websiteSnapshot),
    setWebsiteSnapshot,
    triggerScan, fetchScanStatus, fetchSnapshot,

    // V2 — Knowledge Graph
    graphNodes: computed(() => state.graphNodes),
    graphEdges: computed(() => state.graphEdges),
    setGraphNodes, setGraphEdges, addGraphNode, addGraphEdge,
    fetchGraphNodes, createGraphNode, fetchGraphEdges, createGraphEdge,

    // V2 — Workspace Flow
    workspaceFlow: computed(() => state.workspaceFlow),
    setCurrentStage, setStageStatus, advanceFlow,

    // P1.5 — Extensions
    currentBrand: computed(() => state.currentBrand),
    providerStatus: computed(() => state.providerStatus),
    _uiState: computed(() => state._uiState),
    setCurrentBrand, setProviderStatus, resetToProviderSetup,
    fetchProviderStatus,
  }
}
