// ============================================================
// BrandGEO — 运行时状态类型 (Phase 1 + Phase 2)
// ============================================================

import type {
  Brand, Entity, VisibilityMetric, SearchVisibility,
  Citation, Topic, Competitor, GeoProject, GeoTask,
  GeoProjectV2, GeoBrandProfile, WebsiteSnapshot, GeoGraphNode, GeoGraphEdge,
  WorkspaceFlowState,
} from './brand'

/** BrandGEO 仪表盘统计 */
export interface GeoDashboardStats {
  totalBrands: number
  activeProjects: number
  pendingTasks: number
  averageVisibility: number
  totalMentions: number
  positiveSentiment: number
  coverageRate: number
  competitorCount: number
}

/** 侧边栏菜单项 */
export interface SidebarMenuItem {
  id: string
  label: string
  icon: string
  route: string
  badge?: string | number
  children?: SidebarMenuItem[]
}

/** GEO 状态类型（与 store 配合） */
export type GeoPanelId =
  | 'dashboard'
  | 'brands'
  | 'entities'
  | 'visibility'
  | 'citations'
  | 'topics'
  | 'competitors'
  | 'projects'
  | 'tasks'
  | 'settings'
  | 'reports'
  | 'help'
  // V2 panels
  | 'project-create'
  | 'project-select'
  | 'brand-profile'
  | 'website-scanner'
  | 'knowledge-graph'
  // Phase 2.5
  | 'asset-center'

/** GEO Runtime */
export interface BrandGEORuntime {
  // 当前激活的面板
  activePanelId: GeoPanelId

  // 数据
  brands: Brand[]
  entities: Entity[]
  visibilityMetrics: VisibilityMetric[]
  searchVisibility: SearchVisibility[]
  citations: Citation[]
  topics: Topic[]
  competitors: Competitor[]
  projects: GeoProject[]
  tasks: GeoTask[]

  // V2 data
  v2Projects: GeoProjectV2[]
  brandProfile: GeoBrandProfile | null
  websiteSnapshot: WebsiteSnapshot | null
  graphNodes: GeoGraphNode[]
  graphEdges: GeoGraphEdge[]
  workspaceFlow: WorkspaceFlowState

  // 仪表盘统计
  dashboardStats: GeoDashboardStats

  // UI 状态
  loading: boolean
  error: string | null
  selectedBrandId: string | null
  selectedProjectId: string | null
  selectedV2ProjectId: string | null
}
