// ============================================================
// C0 Core: DiscoveryConsumer 接口 + ConsumerRegistry
//
// 所有下游引擎统一通过此接口接入 Discovery
// DiscoveryService 永远不知道具体消费了哪些引擎
// ============================================================

import type { DiscoveryEnvelope } from '../../domain/discovery-envelope'

/**
 * DiscoveryConsumer — 下游引擎的统一消费接口
 *
 * 实现此接口的引擎在 Discovery 完成后自动收到 DiscoveryEnvelope
 * supports(): 判断是否应当消费此 envelope
 * consume():  消费逻辑，推荐异步非阻塞
 */
export interface DiscoveryConsumer {
  /** 消费器唯一标识 */
  readonly name: string

  /** 是否支持本次 Discovery 结果 */
  supports(envelope: DiscoveryEnvelope): boolean

  /** 消费 DiscoveryEnvelope */
  consume(envelope: DiscoveryEnvelope): Promise<void>
}

/**
 * ConsumerRegistry — 所有 DiscoveryConsumer 注册中心
 *
 * DiscoveryService 在 discover() 完成后遍历所有已注册的 Consumer
 * 并调用 consume()（仅当 supports() 返回 true）
 */
export class ConsumerRegistry {
  private consumers: DiscoveryConsumer[] = []

  /** 注册一个 Consumer */
  register(consumer: DiscoveryConsumer): void {
    this.consumers.push(consumer)
    console.log(`[ConsumerRegistry] 已注册: ${consumer.name}`)
  }

  /** 批量注册 */
  registerAll(consumers: DiscoveryConsumer[]): void {
    for (const c of consumers) this.register(c)
  }

  /** 获取所有已注册的 Consumer */
  getAll(): DiscoveryConsumer[] {
    return [...this.consumers]
  }

  /** 获取所有 supports()===true 的 Consumer */
  getSupported(envelope: DiscoveryEnvelope): DiscoveryConsumer[] {
    return this.consumers.filter((c) => c.supports(envelope))
  }

  /** 消费一个 envelope — 不返回，不阻塞 */
  async consumeAll(envelope: DiscoveryEnvelope): Promise<void> {
    const supported = this.getSupported(envelope)
    if (supported.length === 0) {
      console.log(`[ConsumerRegistry] 没有 Consumer 消费: ${envelope.executionId}`)
      return
    }

    await Promise.all(
      supported.map((c) =>
        c.consume(envelope).catch((err) => {
          console.error(`[ConsumerRegistry] ${c.name} 消费失败:`, err)
        })
      )
    )
  }
}

/** 全局单例 */
export const consumerRegistry = new ConsumerRegistry()
