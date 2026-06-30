// ============================================================
// BrandGEO Store — 品牌GEO 工作台状态管理 (Phase 1 + 2 + P1.5)
// 遵循 Studio v2 Store → Runtime → UI 单向数据流
// Repository 模式：Service 不直接访问 Store
// @deprecated — GEO v3 Legacy, use brand-geo-v2
//
// Phase 2 cleaned: removed deprecated methods, bare fetch(), unused state
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

import { client } from '../clients/GEOApiClient'

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
  // P1.5 — Knowledge Objects
  knowledgeObjects: [],
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
  const activeBrandProjects = computed(() =>
    state.selectedBrandId
      ? state.projects.filter(p => p.brandId === state.selectedBrandId)
      : state.projects
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
      const res = await client.get<{ projects: GeoProjectV2[] }>('/projects')
      if (res.success && Array.isArray(res.data?.projects)) setV2Projects(res.data.projects as GeoProjectV2[])
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
      const body: Record<string, any> = {
        name: data.name,
        industry: data.industry,
        language: data.language,
        topic: data.website || data.country || '',
      }
      if (data.executionResults) {
        body.config = data.executionResults
      }
      const res = await client.post<{ project: GeoProjectV2 }>('/projects', body)
      if (res.success && res.data?.project) {
        addV2Project(res.data.project as GeoProjectV2)
        return res.data.project.id
      }
      return null
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

  // ==================================================================
  // V2 — Website Scanner / Snapshot
  // ==================================================================

  function setWebsiteSnapshot(snapshot: WebsiteSnapshot | null) { state.websiteSnapshot = snapshot }

  // ==================================================================
  // V2 — Knowledge Graph
  // ==================================================================

  function setGraphNodes(nodes: GeoGraphNode[]) { state.graphNodes = nodes }
  function setGraphEdges(edges: GeoGraphEdge[]) { state.graphEdges = edges }
  function addGraphNode(node: GeoGraphNode) { state.graphNodes.push(node) }
  function addGraphEdge(edge: GeoGraphEdge) { state.graphEdges.push(edge) }

  async function createGraphNode(data: {
    projectId: string
    type: string
    label: string
    properties?: string
  }): Promise<GeoGraphNode | null> {
    state.loading = true
    state.error = null
    try {
      const res = await client.post<{ node: GeoGraphNode }>(`/projects/${data.projectId}/graph/nodes`, data)
      const node = res.data?.node || null
      if (node) addGraphNode(node)
      return node
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
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
      const res = await client.post<{ edge: GeoGraphEdge }>('/graph/edges', data)
      const edge = res.data?.edge || null
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
  // P1.5 — Brand Geo Store Extensions
  // ==================================================================

  function setCurrentBrand(brand: GeoProjectV2 | null) { state.currentBrand = brand }
  function setProviderStatus(status: { configured: boolean; providers: any[] }) { state.providerStatus = status }
  function resetToProviderSetup() { state.providerStatus = { configured: false, providers: [] } }

  async function fetchProviderStatus(): Promise<{ configured: boolean; providers: any[] } | null> {
    try {
      const res = await client.get<{ configured: boolean; providers: any[] }>('/dashboard/provider-status')
      if (res.success) {
        const ps = { configured: res.data?.configured || false, providers: res.data?.providers || [] }
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
    // Knowledge Objects
    knowledgeObjects: computed(() => state.knowledgeObjects),
    setActivePanel,
    // Selection
    selectedBrandId: computed(() => state.selectedBrandId),
    selectedProjectId: computed(() => state.selectedProjectId),
    selectedV2ProjectId: computed(() => {
      const id = state.selectedV2ProjectId
      return typeof id === 'string' ? id : null
    }),
    setSelectedBrandId, setSelectedV2ProjectId,
    selectedV2Project,

    // V2 — Projects
    projects: computed(() => state.projects),
    v2Projects: computed(() => state.v2Projects),
    setV2Projects, addV2Project,
    fetchV2Projects, createV2Project,

    // V2 — Brand Profile
    brandProfile: computed(() => state.brandProfile),
    setBrandProfile,

    // V2 — Scanner / Snapshot
    websiteSnapshot: computed(() => state.websiteSnapshot),
    setWebsiteSnapshot,

    // V2 — Knowledge Graph
    graphNodes: computed(() => state.graphNodes),
    graphEdges: computed(() => state.graphEdges),
    setGraphNodes, setGraphEdges, addGraphNode, addGraphEdge,
    createGraphNode, createGraphEdge,

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
