/**
 * world-view-factory.ts — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * WorldViewFactory — 世界视图工厂
 * ═══════════════════════════════════════════════════════════════
 *
 * 职责：
 *   从原始数据组装 WorldView——
 *   将平铺的原始信号 + 分散的实体信息
 *   转化为系统可理解的结构化世界视图。
 *
 * 流程：
 *   原始数据 → Entity 提取 → Signal 提取 → WorldView 组装 → 偏差检测
 *
 * 设计约束：
 *   1. 工厂是纯函数——相同输入永远相同输出
 *   2. 工厂不存储状态——每次调用独立
 *   3. 工厂不验证数据——验证属于 Validation Layer
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'
import { createEntity, type WorldEntity } from './world-entity.js'
import { createWorldSignal, type WorldSignal, type SignalValue } from './world-signal.js'
import { createWorldView, detectBiases, type WorldView, type BiasDeclaration } from './world-view.js'
import { createEntityRegistry, type EntityRegistry } from './entity-registry.js'

// ============================================================
// 1. 原始数据输入
// ============================================================

/**
 * 原始数据条目（模拟数据源返回的原始 JSON/API 响应）
 *
 * 这是 World Interface Layer 的"最原始输入"，对应 API 响应、
 * 网页爬取结果、数据库查询结果等。
 */
export interface RawDataEntry {
  /** 数据源名称 */
  source: string
  /** 实体类型名（必须在 EntityRegistry 中注册过） */
  entityType: string
  /** 实体名称 */
  entityName: string
  /** 实体属性（扁平键值对） */
  attributes: Record<string, SignalValue>
  /** 地域 */
  geoScope?: string
  /** 观测时间（Unix ms，空则视为当前时间） */
  observedAt?: number
  /** 数据源标称可信度 */
  claimedConfidence?: number
}

// ============================================================
// 2. 工厂构建参数
// ============================================================

export interface ViewFactoryParams {
  /** 领域 */
  domain: DomainType
  /** 原始数据条目列表 */
  entries: RawDataEntry[]
  /** 视图 ID（可选，自动生成） */
  viewId?: string
  /** 已知偏差列表（可选，手动追加） */
  manualBiases?: BiasDeclaration[]
  /** 视图生成方式 */
  generation?: WorldView['generation']
}

// ============================================================
// 3. 世界视图工厂
// ============================================================

export interface WorldViewFactory {
  /**
   * 从原始数据组装 WorldView
   *
   * 输入：扁平原始数据条目列表
   * 输出：结构化的 WorldView（含偏差检测）
   *
   * 流程：
   *   1. 从 entries 提取唯一实体列表
   *   2. 为每个 entry 创建 WorldSignal
   *   3. 组装 WorldView
   *   4. 自动检测偏差
   *   5. 追加手动偏差
   */
  build(params: ViewFactoryParams): WorldView
}

// ============================================================
// 4. 默认实现
// ============================================================

export function createWorldViewFactory(
  registry?: EntityRegistry,
): WorldViewFactory {
  const entityRegistry = registry ?? createEntityRegistry()

  function build(params: ViewFactoryParams): WorldView {
    const { domain, entries, viewId, manualBiases, generation } = params

    // Step 1: 提取唯一实体
    const entityMap = new Map<string, WorldEntity>()
    let signalIdCounter = 0

    for (const entry of entries) {
      // 生成实体唯一键（source + type + name 联合去重）
      const entityKey = `${entry.source}::${entry.entityType}::${entry.entityName}`

      if (!entityMap.has(entityKey)) {
        const entity = createEntity({
          // 用 source::type::name 做稳定散列
          id: `entity_${hashString(entityKey)}`,
          type: entry.entityType,
          domain,
          name: entry.entityName,
          location: entry.attributes['location'] as string | undefined,
          locationPrecision: 'city',
          attributes: entry.attributes,
          source: entry.source,
        })
        entityMap.set(entityKey, entity)
      }
    }

    const entities = Array.from(entityMap.values())

    // Step 2: 创建 WorldSignal
    const signals: WorldSignal[] = []

    for (const entry of entries) {
      const entityKey = `${entry.source}::${entry.entityType}::${entry.entityName}`
      const entity = entityMap.get(entityKey)!

      // 为每个非标识属性创建信号
      for (const [attrName, attrValue] of Object.entries(entry.attributes)) {
        // 跳过 location 已在实体中记录的属性
        if (attrName === 'location') continue

        signalIdCounter++
        const signal = createWorldSignal({
          id: `wsig_${viewId ?? 'view'}_${signalIdCounter}`,
          entityId: entity.id,
          source: entry.source,
          attributeName: attrName,
          value: attrValue,
          observedAt: entry.observedAt,
          claimedConfidence: entry.claimedConfidence,
          domain,
          geoScope: entry.geoScope,
        })
        signals.push(signal)
      }
    }

    // Step 3: 组装 WorldView
    const view = createWorldView({
      id: viewId ?? `view_${Date.now()}_${domain}`,
      entities,
      signals,
      biases: manualBiases,
      generation: generation ?? 'system',
    })

    // Step 4: 自动检测偏差
    const autoBiases = detectBiases(view)

    // 合并偏差
    view.biases = [...(manualBiases ?? []), ...autoBiases]

    // 更新完整度（有偏差声明会降低完整度）
    const biasPenalty = view.biases.reduce((s, b) => s + b.severity * 0.1, 0)
    view.completeness = Math.max(0, Math.min(1, view.completeness - biasPenalty))

    return view
  }

  return { build }
}

// ============================================================
// 5. 工具函数
// ============================================================

/**
 * 简单字符串散列（确定性的，用于生成实体 ID）
 * 不是密码学安全散列，只是确定性的 ID 生成
 */
function hashString(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

/** 单例 */
export const worldViewFactory = createWorldViewFactory()
