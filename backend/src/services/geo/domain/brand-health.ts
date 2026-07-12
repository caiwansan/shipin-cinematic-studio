// ============================================================
// BrandHealth — 品牌健康报告（产品领域模型，非引擎模型）
// 这是 GEO 工作台的 SSOT。所有消费端（页面、API）只能消费此模型。
// 任何引擎输出必须通过 BrandHealthAggregator 转换后输出。
// ============================================================

/**
 * 品牌健康报告 —— 唯一面向产品层输出的数据模型
 */
export interface BrandHealthReport {
  // 品牌标识
  brandId: string
  brandName: string
  brandWebsite?: string
  brandIndustry?: string

  // 核心健康分
  overallScore: number
  scoreChange: number  // 与上次扫描对比的变化
  trend: 'improving' | 'stable' | 'declining'

  // 六大健康维度（替代引擎维度）
  dimensions: BrandHealthDimension[]

  // 风险评估
  topRisks: BrandHealthRisk[]

  // 核心机会
  topOpportunities: BrandHealthOpportunity[]

  // 健康摘要（自然语言）
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

/**
 * 品牌健康维度 —— 每个维度必须提供可解释性说明
 *
 * 当前支持的维度（Sprint W2-01）：
 *  - visibility   可见度    — 品牌在 AI 中被提及的频率和准确性
 *  - authority    权威性    — 品牌官网、官方信息在 AI 中的引用质量
 *  - awareness    认知度    — AI 对品牌业务、产品的理解深度
 *  - seo          网站表现  — 品牌网站 SEO/AI 友好度
 *  - competition  竞争定位  — 相对竞品在 AI 中的表现
 *  - freshness    新鲜度    — 品牌信息在 AI 中的更新频率
 */
export interface BrandHealthDimension {
  id: string
  name: string
  score: number  // 0-100
  maxScore: number  // 默认为 100
  change: number  // 对比上次的变化

  // 必须有 explainability
  explanation: {
    what: string  // 这个维度衡量什么
    why: string   // 为什么是这个分数
    evidence: string[]  // 支撑证据摘要
    confidence: number  // 0-100
  }
}

/**
 * 品牌健康风险 —— 如果不处理可能带来的负面影响
 */
export interface BrandHealthRisk {
  id: string
  label: string
  severity: 'high' | 'medium' | 'low'
  affectedDimension: string
  description: string
  impact: string  // 如果不处理的后果
}

/**
 * 品牌健康机会 —— 可以通过特定行动提升的分数
 */
export interface BrandHealthOpportunity {
  id: string
  label: string
  estimatedScoreGain: number  // 预估可以提升多少分
  affectedDimensions: string[]
  effort: 'low' | 'medium' | 'high'
  description: string
  actionUrl?: string  // 快捷入口
}

/**
 * 健康摘要（自然语言）
 */
export interface BrandHealthSummary {
  overall: string  // 一句话总结品牌健康状态
  whatIsWorking: string[]  // 做得好的方面
  whatNeedsAttention: string[]  // 需要改进的方面
  nextBestAction: string  // 最应该做的一件事
}

/**
 * 证据覆盖 —— 品牌在各大 AI 平台的存在情况
 */
export interface BrandHealthEvidence {
  totalEvidenceCount: number
  providerCoverage: number  // 覆盖了多少个 AI 平台
  totalProviders: number
  lastScanDate: string
  sources: Array<{
    provider: string
    status: 'available' | 'unavailable' | 'error'
    evidenceCount: number
    lastCheckedAt: string
  }>
}

/**
 * 品牌健康时间轴 —— 记录扫描、改善、告警等关键事件
 */
export interface BrandHealthTimeline {
  date: string
  event: string
  type: 'scan' | 'improvement' | 'alert' | 'milestone'
  score?: number
  change?: number
  detail?: string
}
