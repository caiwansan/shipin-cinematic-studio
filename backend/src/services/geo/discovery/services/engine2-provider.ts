// ============================================================
// Engine2Provider — Discovery Engine 2.0 Provider
// 使用新架构：Pipeline → Adapter → ProviderRegistry
// Feature Flag: DISCOVERY_ENGINE=v2
//
// V2.1 变更：
//   下游 Consumer 通过 ConsumerRegistry 统一注册
//   不再手动引入具体 Consumer
// ============================================================

import type { DiscoveryProvider } from './discovery-provider.js'
import type { DiscoveryEnvelope } from '../../domain/discovery-envelope.js'
import { DiscoveryService } from './discovery.service.js'
import { consumerRegistry } from './consumer-registry.js'
import { knowledgeConsumer } from './knowledge-consumer.js'
import { recommendationsConsumer } from './recommendations-consumer.js'
import { missionConsumer } from './mission-consumer.js'
import { verificationConsumer } from './verification-consumer.js'
import { publishingConsumer } from './publishing-consumer.js'
import { learningConsumer } from './learning-consumer.js'

export class Engine2Provider implements DiscoveryProvider {
  readonly name = 'engine-v2'
  private service: DiscoveryService

  constructor(eventEmitter?: { emit(event: string, payload: unknown): void }) {
    this.service = new DiscoveryService(eventEmitter)
    this.service.initialize()

    // 注册所有下游 Consumer
    // 后续新增引擎只需：import + consumerRegistry.register()
    consumerRegistry.register(knowledgeConsumer)
    consumerRegistry.register(recommendationsConsumer)
    consumerRegistry.register(missionConsumer)
    consumerRegistry.register(verificationConsumer)
    consumerRegistry.register(publishingConsumer)
    consumerRegistry.register(learningConsumer)
  }

  async discover(projectId: string, entityId: string, entityName: string): Promise<DiscoveryEnvelope> {
    return this.service.discover(projectId, entityId, entityName)
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now()
    return { ok: true, latencyMs: Date.now() - start }
  }

  capabilities(): string[] {
    return ['presence-scan', 'pipeline-execution', 'replay-supported', 'metrics-collected', 'consumer-registry']
  }
}
