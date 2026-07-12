// ============================================================
// Discovery Service — GEO Discovery Engine 对外暴露的入口
//
// V2 变更：
//   - 改用 ConsumerRegistry 统一管理下游引擎
//   - DiscoveryService 完全不知道具体有哪些 Consumer
//   - Consumer 通过 register() 注册，不修改 DiscoveryService 代码
// ============================================================

import { DiscoveryOrchestrator } from '../orchestrator/discovery-orchestrator.js'
import { DiscoveryPresenceStage } from '../pipeline/stages/presence-stage.js'
import { providerRegistry } from '../registry/provider-registry.js'
import { consumerRegistry } from './consumer-registry.js'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope.js'

export class DiscoveryService {
  private orchestrator: DiscoveryOrchestrator

  constructor(eventEmitter?: { emit(event: string, payload: unknown): void }) {
    this.orchestrator = new DiscoveryOrchestrator(eventEmitter ? { eventEmitter } : {})
  }

  initialize(): void {
    // 注册 Pipeline Stage（可插拔）
    this.orchestrator.registerStages([new DiscoveryPresenceStage()])

    // 注册 Provider（默认仅启用 DeepSeek）
    providerRegistry.register({ name: 'DeepSeek', adapter: 'presence', enabled: true, config: {} })
    providerRegistry.register({ name: 'Qwen', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'Doubao', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'Kimi', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'Xinghuo', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'ChatGPT', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'Claude', adapter: 'presence', enabled: false, config: {} })
    providerRegistry.register({ name: 'Gemini', adapter: 'presence', enabled: false, config: {} })
  }

  async discover(projectId: string, entityId: string, entityName: string): Promise<DiscoveryEnvelope> {
    const envelope = await this.orchestrator.discover(projectId, entityId, entityName)

    // ConsumerRegistry — 所有下游 Consumer 自行消费，不阻塞返回
    consumerRegistry.consumeAll(envelope).catch((err) => {
      console.error(`[DiscoveryService] ConsumerRegistry 消费失败:`, err)
    })

    return envelope
  }

  async replay(ctx: import('../../domain/discovery-context.js').DiscoveryContext): Promise<DiscoveryEnvelope> {
    return this.orchestrator.replay(ctx)
  }
}

export const discoveryService = new DiscoveryService()
