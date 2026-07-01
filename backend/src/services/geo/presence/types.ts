// ============================================================
// AI Presence Engine — Core Types
// P0-T005: AI Presence Engine Foundation
// P0-T005.1: 12 Platform Extension — added group & platformGroups
// ============================================================

export interface PresenceContext {
  projectId: string
  name: string
  website?: string
  industry?: string
  description?: string
}

export type Visibility = 'visible' | 'partial' | 'missing' | 'checking' | 'unknown'
export type EvidenceLevel = 'A' | 'B' | 'C' | 'D' | 'N/A'
export type PlatformGroup = 'international' | 'china'

export interface ProviderResult {
  provider: string
  displayName: string
  visibility: Visibility
  group: PlatformGroup
  knowledgeQuality?: number // 0-100
  evidenceLevel: EvidenceLevel
  confidence: number // 0-100
  lastCheckedAt?: string
  evidenceCount: number
  summary?: string
  explain?: string
  recommendations: string[]
}

export interface AIPresenceOverall {
  score: number // 综合可见度评分 0-100
  visibilityCount: number // visible + partial 数量
  totalChecked: number // 已检查的平台数
  averageKnowledge: number // 平均知识质量
}

export interface AIPresenceResult {
  overall: AIPresenceOverall
  providers: ProviderResult[]
  platformGroups: {
    international: string[]
    china: string[]
  }
  checkedAt: string
}
