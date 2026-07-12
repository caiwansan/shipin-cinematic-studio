// ============================================================
// DiscoverySignal — Provider 输出标准化后的统一信号
// Discovery 和其他所有下游引擎只消费 Signal，不消费 Provider
//
// SSOT: 这是 GEO 全平台所有信号的单一规范类型。
// Knowledge / Recommendations / Mission / Verification / Learning
// 全部基于 Signal，而不是基于 Provider。
// ============================================================

/**
 * 信号类型
 * presence: 存在感（品牌在 AI 训练数据中出现情况）
 * search:   搜索可见性（搜索引擎/B端平台表现）
 * knowledge: 知识覆盖（AI 对品牌的认知深度）
 * sentiment: 情感倾向（正面/负面/中性）
 * competition: 竞争关系
 */
export type SignalType = 'presence' | 'search' | 'knowledge' | 'sentiment' | 'competition'

export interface DiscoverySignal {
  /** Signal Schema 版本号（用于下游兼容性判断） */
  schemaVersion: string

  /** 信号唯一标识 */
  id: string

  /** 信号类型 */
  type: SignalType

  /** 来源 Provider（仅记录来源，不是判断依据） */
  provider: string

  /** 信号置信度 0~1 */
  confidence: number

  /** 发现的证据摘要 */
  evidence: SignalEvidence[]

  /** 信号发现时间 */
  timestamp: string

  /** 原始响应引用（用于 Debug / Audit） */
  rawReference: string | null

  /** 本次信号产生的成本（token 消耗） */
  cost: {
    tokensIn: number
    tokensOut: number
    latencyMs: number
  }
}

export interface SignalEvidence {
  /** 证据内容摘要 */
  summary: string

  /** 证据来源 */
  source: string

  /** 该证据的可信度 0~1 */
  confidence: number

  /** Citation 引用 */
  citation?: SignalCitation
}

export interface SignalCitation {
  url?: string
  title?: string
  snippet?: string
}

/**
 * 信号组 — 同一扫描批次产生的所有 Signal
 */
export interface SignalGroup {
  executionId: string
  projectId: string
  entityId: string
  entityName: string
  signals: DiscoverySignal[]
}
