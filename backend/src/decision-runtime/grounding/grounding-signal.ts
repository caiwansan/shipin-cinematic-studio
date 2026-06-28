/**
 * grounding-signal.ts — Phase A-3.2 Reality Grounding Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * GroundingSignal — 现实锚定信号
 * ═══════════════════════════════════════════════════════════════
 *
 * GroundingSignal 是"现实锚定"的基本单位。
 * 它不是数据，而是"关于现实状态的标记"。
 *
 * 每个信号代表：
 *   "现实世界在某个维度上有一个已知的数值/事实"
 *
 * 信号分类：
 *   - authorized    权威数据（政府/央行/统计局/行业白皮书）
 *   - aggregated    聚合数据（多家平台交叉校验）
 *   - sampled       采样数据（局部市场调研）
 *   - estimate      估算（无权威源时的最佳推测）
 *
 * 信号来源：
 *   - real_estate    房地产：政府网签均价 / 链家成交价 / 贝壳挂盘价
 *   - legal          法律：官方案例库 / 司法解释
 *   - medical        医疗：卫健委指南 / 医保目录 / 临床路径
 *   - education      教育：教育部政策 / 985/211 名单
 *   - travel         旅行：民航数据 / 景区评级
 *   - finance        金融：央行利率 / 指数数据
 *   - commerce       电商：行业均价 / 品牌排名
 *   - services       服务：行业协会数据 / 标准化报价
 *   - agriculture    农业：国家统计局产量 / 批发市场价格
 *   - general        通用：权威百科 / 公开数据
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 信号可信度等级
// ============================================================

export enum SignalAuthority {
  /** 权威数据 — 官方发布、经过验证、不可反驳 */
  AUTHORIZED = 'AUTHORIZED',

  /** 聚合数据 — 多家来源交叉验证 */
  AGGREGATED = 'AGGREGATED',

  /** 采样数据 — 局部采样、有限范围 */
  SAMPLED = 'SAMPLED',

  /** 估算 — 无精确来源、基于模型推测 */
  ESTIMATE = 'ESTIMATE',
}

// ============================================================
// 2. 现实锚定信号
// ============================================================

export interface GroundingSignal {
  /** 唯一信号 ID */
  id: string

  /** 信号分类 */
  authority: SignalAuthority

  /** 信号归属领域 */
  domain: DomainType

  /** 信号来源描述（用于追溯） */
  source: string

  /** 信号名称（如"深圳市南山区二手房均价"） */
  name: string

  /** 数值（现实基准值） */
  value: number

  /** 值含义描述 */
  description: string

  /** 可信度权重 [0, 1] — 越高越可信 */
  reliability: number

  /** 波动性 [0, 1] — 越高越不稳定（如房价月波动） */
  volatility: number

  /** 信号时效（Unix ms）— 超过此值信号被视为过期 */
  expiresAt: number

  /** 采集时间戳 */
  capturedAt: number

  /** 关联的评估轴名称（与此信号相关的轴） */
  relatedAxis?: string

  /** 此信号适用的地理范围（如"深圳南山"） */
  geoScope?: string

  /** 元数据扩展 */
  meta?: Record<string, unknown>
}

// ============================================================
// 3. 信号构建辅助
// ============================================================

export function createAuthorizedSignal(params: {
  id: string
  domain: DomainType
  source: string
  name: string
  value: number
  description: string
  volatility?: number
  expiresInDays?: number
  relatedAxis?: string
  geoScope?: string
}): GroundingSignal {
  const now = Date.now()
  const expiresIn = (params.expiresInDays ?? 365) * 86400 * 1000

  return {
    id: params.id,
    authority: SignalAuthority.AUTHORIZED,
    domain: params.domain,
    source: params.source,
    name: params.name,
    value: params.value,
    description: params.description,
    reliability: 0.95, // 权威数据高可信
    volatility: params.volatility ?? 0.05,
    expiresAt: now + expiresIn,
    capturedAt: now,
    relatedAxis: params.relatedAxis,
    geoScope: params.geoScope,
  }
}

export function createAggregatedSignal(params: {
  id: string
  domain: DomainType
  source: string
  name: string
  value: number
  description: string
  reliability?: number
  volatility?: number
  expiresInDays?: number
  relatedAxis?: string
  geoScope?: string
}): GroundingSignal {
  const now = Date.now()
  const expiresIn = (params.expiresInDays ?? 180) * 86400 * 1000

  return {
    id: params.id,
    authority: SignalAuthority.AGGREGATED,
    domain: params.domain,
    source: params.source,
    name: params.name,
    value: params.value,
    description: params.description,
    reliability: params.reliability ?? 0.8,
    volatility: params.volatility ?? 0.15,
    expiresAt: now + expiresIn,
    capturedAt: now,
    relatedAxis: params.relatedAxis,
    geoScope: params.geoScope,
  }
}

export function createSampledSignal(params: {
  id: string
  domain: DomainType
  source: string
  name: string
  value: number
  description: string
  reliability?: number
  volatility?: number
  expiresInDays?: number
  relatedAxis?: string
  geoScope?: string
}): GroundingSignal {
  const now = Date.now()
  const expiresIn = (params.expiresInDays ?? 90) * 86400 * 1000

  return {
    id: params.id,
    authority: SignalAuthority.SAMPLED,
    domain: params.domain,
    source: params.source,
    name: params.name,
    value: params.value,
    description: params.description,
    reliability: params.reliability ?? 0.6,
    volatility: params.volatility ?? 0.25,
    expiresAt: now + expiresIn,
    capturedAt: now,
    relatedAxis: params.relatedAxis,
    geoScope: params.geoScope,
  }
}

export function createEstimatedSignal(params: {
  id: string
  domain: DomainType
  source: string
  name: string
  value: number
  description: string
  reliability?: number
  volatility?: number
  expiresInDays?: number
  relatedAxis?: string
  geoScope?: string
}): GroundingSignal {
  const now = Date.now()
  const expiresIn = (params.expiresInDays ?? 30) * 86400 * 1000

  return {
    id: params.id,
    authority: SignalAuthority.ESTIMATE,
    domain: params.domain,
    source: params.source,
    name: params.name,
    value: params.value,
    description: params.description,
    reliability: params.reliability ?? 0.3,
    volatility: params.volatility ?? 0.4,
    expiresAt: now + expiresIn,
    capturedAt: now,
    relatedAxis: params.relatedAxis,
    geoScope: params.geoScope,
  }
}

// ============================================================
// 4. 信号有效性
// ============================================================

/**
 * 检查信号是否过期
 */
export function isSignalExpired(signal: GroundingSignal): boolean {
  return Date.now() > signal.expiresAt
}

/**
 * 信号的有效可信度 = reliability × (1 - volatility) × (未过期则1)
 */
export function effectiveReliability(signal: GroundingSignal): number {
  const decay = isSignalExpired(signal) ? 0.3 : 1.0
  return signal.reliability * (1 - signal.volatility) * decay
}

/**
 * 排序：有效可信度从高到低
 */
export function sortByReliability(signals: GroundingSignal[]): GroundingSignal[] {
  return [...signals].sort((a, b) => effectiveReliability(b) - effectiveReliability(a))
}
