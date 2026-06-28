/**
 * WorldSignal — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * WorldSignal — 世界信号
 * ═══════════════════════════════════════════════════════════════
 *
 * WorldSignal 是"对世界实体的观测记录"——它代表在某个时间点，
 * 从某个数据源获取到的实体某个属性的值。
 *
 * 与 GroundingSignal 的区别：
 *   GroundingSignal = 经过编排后可信任的"现实基线"（A-3.2 输出）
 *   WorldSignal    = 原始的、未经信任过滤的"观测记录"（A-4 原始输入）
 *
 * 关系链：
 *   WorldSignal (原始) → SignalOrchestrator (编排) → GroundingSignal (可信任)
 *
 * 宪法约束：
 *   1. WorldSignal 不能直接被评分引擎消费
 *   2. WorldSignal 必须关联到一个存在的 WorldEntity
 *   3. timestamp 是观测时间，不是数据入库时间
 *   4. value 类型受实体属性约束（数值/枚举/文本）
 *   5. 每个 WorldSignal 默认 untrusted——信任由 A-3.3 决定
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 信号值类型
// ============================================================

export type SignalValue =
  | number   // 数值类型（评分、价格、距离、人数）
  | string   // 文本类型（描述、名称、类别）
  | boolean  // 布尔类型（是否有、是否支持）

// ============================================================
// 2. 采样方法
// ============================================================

export enum SamplingMethod {
  /** 官方统计 */
  OFFICIAL_STAT = 'OFFICIAL_STAT',
  /** 全量数据 */
  FULL_SCAN = 'FULL_SCAN',
  /** 随机采样 */
  RANDOM_SAMPLE = 'RANDOM_SAMPLE',
  /** 用户提交 */
  USER_SUBMITTED = 'USER_SUBMITTED',
  /** 爬取 */
  CRAWLED = 'CRAWLED',
  /** 估计/推算 */
  ESTIMATED = 'ESTIMATED',
  /** 未知 */
  UNKNOWN = 'UNKNOWN',
}

// ============================================================
// 3. 世界信号
// ============================================================

export interface WorldSignal {
  /** 信号唯一 ID */
  id: string

  /** 关联的实体 ID */
  entityId: string

  /** 数据源名称（如"链家""大众点评"） */
  source: string

  /** 采样方法 */
  samplingMethod: SamplingMethod

  /** 观测到的属性名（如 "price", "rating", "ratingCount"） */
  attributeName: string

  /** 观测值 */
  value: SignalValue

  /** 观测时间戳（数据在现实世界中被产生的时间） */
  observedAt: number

  /** 数据接入系统的时间戳 */
  ingestedAt: number

  /** 数据源标称的可信度（注意：这不是系统信任值，是数据源自报的） */
  claimedConfidence: number

  /** 领域 */
  domain: DomainType

  /** 地域范围 */
  geoScope?: string

  /** 可选：原始数据引用（API 响应、文档摘录） */
  rawReference?: string
}

// ============================================================
// 4. 信号构建函数
// ============================================================

export function createWorldSignal(params: {
  id: string
  entityId: string
  source: string
  attributeName: string
  value: SignalValue
  observedAt?: number
  samplingMethod?: SamplingMethod
  claimedConfidence?: number
  domain: DomainType
  geoScope?: string
  rawReference?: string
}): WorldSignal {
  return {
    id: params.id,
    entityId: params.entityId,
    source: params.source,
    samplingMethod: params.samplingMethod ?? SamplingMethod.UNKNOWN,
    attributeName: params.attributeName,
    value: params.value,
    observedAt: params.observedAt ?? Date.now(),
    ingestedAt: Date.now(),
    claimedConfidence: params.claimedConfidence ?? 0.5,
    domain: params.domain,
    geoScope: params.geoScope,
    rawReference: params.rawReference,
  }
}
