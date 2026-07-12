// ============================================================
// BrandHealth — 品牌健康报告（前端产品领域模型）
// 与后端 domain/brand-health.ts 一一对应
// 这是 GEO 工作台的 SSOT。所有页面/组件只能消费此模型。
// ============================================================

/** 品牌健康报告 */
export interface BrandHealthReport {
  // 品牌标识
  brandId: string
  brandName: string
  brandWebsite?: string
  brandIndustry?: string

  // 核心健康分
  overallScore: number
  scoreChange: number
  trend: 'improving' | 'stable' | 'declining'

  // 六大健康维度
  dimensions: BrandHealthDimension[]

  // 风险评估
  topRisks: BrandHealthRisk[]

  // 核心机会
  topOpportunities: BrandHealthOpportunity[]

  // 健康摘要
  summary: BrandHealthSummary

  // 证据覆盖
  evidence: BrandHealthEvidence

  // 时间轴
  timeline: BrandHealthTimeline[]

  // 元信息
  lastScanAt: string
  nextRecommendedAction: string
  engineVersion: string
}

/** 品牌健康维度 */
export interface BrandHealthDimension {
  id: string
  name: string
  score: number
  maxScore: number
  change: number
  explanation: {
    what: string
    why: string
    evidence: string[]
    confidence: number
  }
}

/** 品牌健康风险 */
export interface BrandHealthRisk {
  id: string
  label: string
  severity: 'high' | 'medium' | 'low'
  affectedDimension: string
  description: string
  impact: string
}

/** 品牌健康机会 */
export interface BrandHealthOpportunity {
  id: string
  label: string
  estimatedScoreGain: number
  affectedDimensions: string[]
  effort: 'low' | 'medium' | 'high'
  description: string
  actionUrl?: string
}

/** 健康摘要 */
export interface BrandHealthSummary {
  overall: string
  whatIsWorking: string[]
  whatNeedsAttention: string[]
  nextBestAction: string
}

/** 证据覆盖 */
export interface BrandHealthEvidence {
  totalEvidenceCount: number
  providerCoverage: number
  totalProviders: number
  lastScanDate: string
  sources: Array<{
    provider: string
    status: 'available' | 'unavailable' | 'error'
    evidenceCount: number
    lastCheckedAt: string
  }>
}

/** 品牌健康时间轴事件 */
export interface BrandHealthTimeline {
  date: string
  event: string
  type: 'scan' | 'improvement' | 'alert' | 'milestone'
  score?: number
  change?: number
  detail?: string
}

// ── 辅助类型 ──

/** 品牌健康概览（用于卡片/摘要展示） */
export interface BrandHealthOverview {
  brandName: string
  overallScore: number
  scoreChange: number
  trend: 'improving' | 'stable' | 'declining'
  riskCount: number
  opportunityCount: number
  lastScanAt: string
}
