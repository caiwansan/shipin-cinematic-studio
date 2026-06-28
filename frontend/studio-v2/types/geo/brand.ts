// ============================================================
// BrandGEO — 品牌领域模型 (Phase 1 + Phase 2)
// ============================================================

// ─── Phase 1 Types (Keep) ───

/** 品牌基本信息 */
export interface Brand {
  id: string
  name: string
  industry: string
  description: string
  logo?: string
  website?: string
  socialAccounts?: SocialAccount[]
  createdAt: string
  updatedAt: string
}

export interface SocialAccount {
  platform: string
  url: string
  followers?: number
}

/** 品牌实体（品牌相关的人/物/场所） */
export interface Entity {
  id: string
  brandId: string
  name: string
  type: EntityType
  description: string
  aliases: string[]
  relevanceScore: number
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type EntityType =
  | 'person'
  | 'product'
  | 'service'
  | 'place'
  | 'event'
  | 'concept'
  | 'organization'
  | 'other'

/** 品牌可见性指标 */
export interface VisibilityMetric {
  id: string
  brandId: string
  date: string
  channel: string
  impressions: number
  reach: number
  engagement: number
  mentions: number
  sentimentScore: number
  shareOfVoice: number
}

/** 搜索引擎可见性 */
export interface SearchVisibility {
  keyword: string
  rank: number
  url: string
  title: string
  description: string
  lastChecked: string
  change: 'up' | 'down' | 'stable'
}

/** 引用/来源 */
export interface Citation {
  id: string
  brandId: string
  sourceUrl: string
  sourceName: string
  sourceType: 'news' | 'social' | 'forum' | 'video' | 'review' | 'blog' | 'other'
  title: string
  snippet: string
  publishedAt: string
  sentiment: 'positive' | 'negative' | 'neutral'
  influenceScore: number
}

/** 热门话题 */
export interface Topic {
  id: string
  name: string
  volume: number
  sentiment: number
  trend: 'rising' | 'falling' | 'stable'
  relatedTopics: string[]
  category: string
}

/** 竞品分析 */
export interface Competitor {
  id: string
  brandId: string
  name: string
  website?: string
  marketShare: number
  strength: string[]
  weakness: string[]
  recentActivity: string[]
  visibilityScore: number
}

/** GEO 项目 (Phase 1) */
export interface GeoProject {
  id: string
  brandId: string
  name: string
  description: string
  status: GeoProjectStatus
  targetKeywords: string[]
  targetChannels: string[]
  startDate: string
  endDate?: string
  budget?: number
  createdAt: string
  updatedAt: string
}

export type GeoProjectStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'

/** GEO 任务 */
export interface GeoTask {
  id: string
  projectId: string
  type: GeoTaskType
  title: string
  description: string
  status: GeoTaskStatus
  assignee?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string
  completedAt?: string
  result?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GeoTaskType =
  | 'keyword_analysis'
  | 'content_creation'
  | 'seo_optimization'
  | 'social_listening'
  | 'competitor_analysis'
  | 'citation_building'
  | 'visibility_audit'
  | 'reporting'

export type GeoTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

// ─── Phase 2 Types (New) ───

/** Brand GEO V2 项目模型 (对应 GeoProject 表) */
export interface GeoProjectV2 {
  id: string
  userId: string
  name: string
  website?: string
  industry?: string
  language?: string
  country?: string
  status: string
  brandProfile?: GeoBrandProfile
  websiteSnapshot?: WebsiteSnapshot
  knowledgeGraph?: GeoGraphNode[]
  createdAt: string
  updatedAt: string
  schemaVersion: number
}

/** 品牌配置 (对应 GeoBrandProfile 表) */
export interface GeoBrandProfile {
  id: string
  projectId: string
  brandName?: string
  website?: string
  company?: string
  industry?: string
  primaryProducts?: string
  coreServices?: string
  targetAudience?: string
  targetRegions?: string
  primaryLanguage?: string
  competitors?: string
  keywords?: string
  brandDesc?: string
  socialLinks?: string
  createdAt: string
  updatedAt: string
  schemaVersion: number
}

/** 网站快照 (对应 WebsiteSnapshot 表) */
export interface WebsiteSnapshot {
  id: string
  projectId: string
  url: string
  title?: string
  description?: string
  language?: string
  robots?: string
  sitemap?: string
  meta?: string
  openGraph?: string
  schema?: string
  jsonLd?: string
  pages?: string
  images?: string
  scripts?: string
  styles?: string
  headers?: string
  status: string
  error?: string
  createdAt: string
  updatedAt: string
  scanVersion: number
}

/** 图谱节点 (对应 GeoGraphNode 表) */
export interface GeoGraphNode {
  id: string
  projectId: string
  type: string
  label: string
  properties?: string
  outgoing?: GeoGraphEdge[]
  incoming?: GeoGraphEdge[]
  createdAt: string
  updatedAt: string
  schemaVersion: number
}

/** 图谱边 (对应 GeoGraphEdge 表) */
export interface GeoGraphEdge {
  id: string
  sourceId: string
  targetId: string
  type: string
  properties?: string
  createdAt: string
  schemaVersion: number
}

/** Workspace Flow Stage */
export type WorkspaceFlowStage =
  | 'create_project'
  | 'edit_brand_profile'
  | 'website_scan'
  | 'generate_snapshot'
  | 'build_graph'
  | 'ready'

export interface WorkspaceFlowState {
  currentStage: WorkspaceFlowStage
  stages: Record<WorkspaceFlowStage, 'pending' | 'active' | 'completed' | 'skipped'>
}
