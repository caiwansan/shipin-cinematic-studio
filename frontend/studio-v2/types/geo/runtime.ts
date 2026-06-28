// ============================================================
// BrandGEO — 运行时状态类型
// ============================================================

import type { Brand, Entity, VisibilityMetric, SearchVisibility, Citation, Topic, Competitor, GeoProject, GeoTask } from './brand'

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

  // 仪表盘统计
  dashboardStats: GeoDashboardStats

  // UI 状态
  loading: boolean
  error: string | null
  selectedBrandId: string | null
  selectedProjectId: string | null
}
