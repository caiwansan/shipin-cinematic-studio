/**
 * world-interface.ts — Phase A-4 Decision World Interface Layer
 *
 * ═══════════════════════════════════════════════════════════════
 * WorldInterface — 顶层世界接口
 * ═══════════════════════════════════════════════════════════════
 *
 * 这是 A-4 的唯一对外暴露入口。
 * Runtime 不应直接访问 entityRegistry / worldViewFactory 等下层组件。
 *
 * WorldInterface 的职责：
 *   1. 接收原始数据 → 输出 WorldView
 *   2. 将 WorldView 转化为 GroundingSignal（供 A-3.2 消费）
 *   3. 声明 WorldView 的局限（偏差/完整度）
 *
 * 宪法约束：
 *   1. WorldInterface 不存储状态——每次调用独立
 *   2. WorldInterface 不缓存数据——数据新鲜度由调用方保证
 *   3. WorldInterface 不验证数据正确性——只负责结构转换
 *   4. WorldInterface 的输出必须有 biases 声明（至少声明 observations gap）
 *
 * @phase decision-runtime
 */

import type { DomainType } from '../business-intelligence/domain-classifier.js'
import type { GroundingSignal } from '../grounding/grounding-signal.js'
import type { WorldSignal } from './world-signal.js'
import type { WorldView, BiasDeclaration } from './world-view.js'
import type { WorldViewFactory, RawDataEntry } from './world-view-factory.js'
import { createWorldViewFactory } from './world-view-factory.js'
import { SamplingMethod } from './world-signal.js'

// ============================================================
// 1. World Interface 配置
// ============================================================

export interface WorldInterfaceConfig {
  /** 默认信号到期天数（用于转换为 GroundingSignal） */
  defaultSignalExpiryDays: number
}

const DEFAULT_CONFIG: WorldInterfaceConfig = {
  defaultSignalExpiryDays: 90,
}

// ============================================================
// 2. World Interface
// ============================================================

export interface WorldInterface {
  /**
   * 从原始数据条目录入世界视图
   *
   * 这是 A-4 的核心入口：
   *   RawDataEntry[] → WorldView
   *
   * 输出包含：
   *   - 从数据中提取的实体列表
   *   - 从数据中提取的信号列表
   *   - 完整度/新鲜度评估
   *   - 已知偏差声明
   */
  ingest(params: {
    domain: DomainType
    entries: RawDataEntry[]
  }): WorldView

  /**
   * 将 WorldView 的信号转换为 GroundingSignal
   * （供 A-3.2 Reality Adjustment Engine 消费）
   *
   * 转换规则：
   *   - WorldSignal → GroundingSignal（值保留）
   *   - 可信度 = claimedConfidence × (1 - bias 衰减)
   *   - 波动性从信号采样方法推断
   */
  toGroundingSignals(view: WorldView): GroundingSignal[]

  /**
   * 获取 WorldView 的"偏差摘要"
   * （用于在最终报告中标注数据局限）
   */
  getBiasSummary(view: WorldView): string
}

// ============================================================
// 3. 默认实现
// ============================================================

export function createWorldInterface(
  factory?: WorldViewFactory,
  config?: Partial<WorldInterfaceConfig>,
): WorldInterface {
  const viewFactory = factory ?? createWorldViewFactory()
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  function ingest(params: {
    domain: DomainType
    entries: RawDataEntry[]
  }): WorldView {
    return viewFactory.build({
      domain: params.domain,
      entries: params.entries,
      generation: 'system',
    })
  }

  function toGroundingSignals(view: WorldView): GroundingSignal[] {
    const now = Date.now()
    const expiryMs = mergedConfig.defaultSignalExpiryDays * 86400 * 1000

    // 计算偏差衰减
    const totalBiasSeverity = view.biases.reduce((s, b) => s + b.severity, 0)
    const biasDecay = Math.min(0.5, totalBiasSeverity * 0.1)

    return view.signals
      .map((ws) => {
        if (typeof ws.value !== 'number') return null
        const baselineValue = normalizeToBaseline(ws.value, ws.attributeName)
        const reliability = Math.max(0, Math.min(1, ws.claimedConfidence - biasDecay))
        const volatility = inferVolatility(ws.samplingMethod)
        return {
          id: `gs_${ws.id}`,
          authority: 'SAMPLED' as any,
          domain: ws.domain,
          source: ws.source,
          name: ws.attributeName,
          value: baselineValue,
          description: `${ws.entityId} 的 ${ws.attributeName} (原始值: ${ws.value})`,
          reliability,
          volatility,
          expiresAt: ws.observedAt + expiryMs,
          capturedAt: ws.observedAt,
          relatedAxis: ws.attributeName,
          geoScope: ws.geoScope,
        } as GroundingSignal
      })
      .filter((s): s is GroundingSignal => s !== null)
  }

  function getBiasSummary(view: WorldView): string {
    if (view.biases.length === 0) {
      return '数据质量良好，未检测到显著偏差'
    }

    const lines = view.biases.map(b => {
      const level = b.severity < 0.3 ? '轻微' : b.severity < 0.6 ? '中等' : '严重'
      return `• [${level}] ${b.description}`
    })

    lines.push(`数据覆盖: 完整度 ${(view.completeness * 100).toFixed(0)}%，新鲜度 ${(view.freshness * 100).toFixed(0)}%`)

    return lines.join('\n')
  }

  return { ingest, toGroundingSignals, getBiasSummary }
}

// ============================================================
// 4. 内部工具
// ============================================================

/**
 * 数值归一化到 [0, 100] 基准分
 * 这只是一个骨架实现——A-5 需要引入更精准的映射
 */
function normalizeToBaseline(value: number, attributeName: string): number {
  // 评分属性（通常 1-5 或 1-10）
  if (attributeName === 'rating' || attributeName === 'score') {
    if (value <= 5) return (value / 5) * 100
    if (value <= 10) return value * 10
    return Math.min(100, value)
  }
  // 价格属性（归一化到 0-100 的比较基准，不是实际价格）
  if (attributeName === 'price' || attributeName === 'avgCost' || attributeName === 'pricePerNight') {
    // 暂不归一化具体价格，保持原始值（A-5 改进）
    return value > 0 ? Math.min(100, value / 1000) : 0
  }
  // 其他数值
  return Math.min(100, value)
}

/**
 * 从采样方法推断波动性
 */
function inferVolatility(method: SamplingMethod): number {
  switch (method) {
    case SamplingMethod.OFFICIAL_STAT: return 0.05
    case SamplingMethod.FULL_SCAN: return 0.1
    case SamplingMethod.RANDOM_SAMPLE: return 0.2
    case SamplingMethod.CRAWLED: return 0.25
    case SamplingMethod.USER_SUBMITTED: return 0.35
    case SamplingMethod.ESTIMATED: return 0.4
    default: return 0.3
  }
}
