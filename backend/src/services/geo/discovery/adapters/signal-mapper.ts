// ============================================================
// SignalMapper — Provider Raw → DiscoverySignal 标准化映射器
//
// 每个 Provider 只需实现 Mapper 接口
// Mapper 不关心 Pipeline，不关心 DiscoveryContext
// 职责只有一项：Raw Response → DiscoverySignal[]
// ============================================================

import type { DiscoverySignal } from '../../domain/discovery-signal.js'

/**
 * Provider 原始响应映射器接口
 *
 * 每个 Provider 一个 Mapper 实现
 * Mapper 输出 DiscoverySignal 后由 Pipeline 统一消费
 */
export interface SignalMapper {
  /** 此 Mapper 支持的 Provider 名称 */
  readonly provider: string

  /**
   * 将 Provider 原始响应转换为标准化信号数组
   *
   * @param rawResponse - Provider 返回的原始字符串（通常是 JSON）
   * @param context - 映射上下文（entityId, entityName 等）
   * @returns DiscoverySignal[] — 可以为空数组（映射失败时）
   */
  map(rawResponse: string, context: SignalMapperContext): DiscoverySignal[]

  /**
   * 验证原始响应是否可以映射
   */
  canMap(rawResponse: string): boolean
}

export interface SignalMapperContext {
  entityId: string
  entityName: string
  projectId: string
  executionId: string
  provider: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
}
