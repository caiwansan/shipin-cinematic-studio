/**
 * WorldEntity — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * WorldEntity — 世界实体
 * ═══════════════════════════════════════════════════════════════
 *
 * WorldEntity 是"现实世界事物"在系统中的抽象容器。
 * 它不是数据点，而是"可被观测的实体锚点"。
 *
 * 哲学设计：
 *   现实世界由离散实体构成——一所医院、一家公司、一栋房产、
 *   一位律师、一所学校、一家餐厅。
 *
 *   每个实体可以被多次观测（产生多个 WorldSignal），
 *   但实体本身在系统中是稳定存在的。
 *
 * 宪法约束：
 *   1. 每个实体必须有唯一 ID（UUID v4）
 *   2. 实体类型在 EntityRegistry 中预定义
 *   3. attributes 存储实体的"不变属性"（位置、类别、规模）
 *   4. 可变化的数据（评分、价格、评价）必须走 WorldSignal
 *   5. 属性是扁平结构，禁止嵌套复杂对象
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'

// ============================================================
// 1. 世界实体
// ============================================================

export interface WorldEntity {
  /** 实体唯一 ID（UUID v4） */
  id: string

  /** 实体类型（必须是 EntityRegistry 中定义的 domainEntityTypes） */
  type: string

  /** 实体领域 */
  domain: DomainType

  /** 实体名称（人类的可读名字） */
  name: string

  /** 地理位置（可选） */
  location?: string

  /** 地理精度（city / district / street / exact） */
  locationPrecision?: 'city' | 'district' | 'street' | 'exact'

  /** 实体不变属性（扁平结构） */
  attributes: Record<string, string | number | boolean>

  /** 实体来源（哪个数据源首次引入此实体） */
  source: string

  /** 首次引入时间戳 */
  introducedAt: number

  /** 最近一次更新时间戳 */
  lastUpdatedAt: number

  /** 实体在当前系统中的活跃度（0-1） */
  activityScore: number
}

// ============================================================
// 2. 实体构建函数
// ============================================================

export function createEntity(params: {
  id: string
  type: string
  domain: DomainType
  name: string
  location?: string
  locationPrecision?: WorldEntity['locationPrecision']
  attributes?: Record<string, string | number | boolean>
  source: string
}): WorldEntity {
  const now = Date.now()
  return {
    id: params.id,
    type: params.type,
    domain: params.domain,
    name: params.name,
    location: params.location,
    locationPrecision: params.locationPrecision,
    attributes: params.attributes ?? {},
    source: params.source,
    introducedAt: now,
    lastUpdatedAt: now,
    activityScore: 1.0,
  }
}

// ============================================================
// 3. 实体克隆（用于更新不破坏引用）
// ============================================================

export function cloneEntity(entity: WorldEntity, updates?: Partial<WorldEntity>): WorldEntity {
  return { ...entity, ...updates, lastUpdatedAt: Date.now() }
}
