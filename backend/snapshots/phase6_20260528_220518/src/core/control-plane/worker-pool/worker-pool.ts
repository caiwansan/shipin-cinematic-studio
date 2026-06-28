/**
 * P2 — WorkerPool（Worker 池）
 *
 * 按 Capability 分组，替代 legacy worker-runtime。
 * 每个 Pool 有固定并发数，adapter 执行真正的 AI 调用。
 *
 * ═══ 宪法 ═══
 * Worker Pool 是 Runtime 执行入口，禁止绕过。
 * Provider 调用必须经过 Adapter，Worker 不持有 Provider 逻辑。
 */

import { Capability } from '../../runtime/capabilities.js'
import { providerRegistry } from '../../../providers/core/provider-registry.js'

export interface Worker {
  id: string
  capability: Capability
  run(task: {
    capability: Capability
    userId: string
    providerConfig?: any
    payload: any
    signal?: AbortSignal
    timeout?: number
  }): Promise<any>
}

// 默认 Pool 配置
const POOL_SIZES: Record<Capability, number> = {
  [Capability.SCRIPT_ANALYSIS]: 200,
  [Capability.PROMPT_OPTIMIZATION]: 200,
  [Capability.IMAGE_GENERATION]: 50,
  [Capability.VIDEO_GENERATION]: 10,
  [Capability.VOICE_GENERATION]: 30,
  [Capability.DIRECTOR_REASONING]: 50,
  [Capability.STORY_EXPANSION]: 100,
  [Capability.CINEMATIC_PROMPT]: 100,
  [Capability.MUSIC_GENERATION]: 10,
  [Capability.EFFECT_GENERATION]: 10,
}

export class WorkerPool {
  private pools: Map<Capability, Worker[]> = new Map()
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return

    for (const [capStr, size] of Object.entries(POOL_SIZES)) {
      const capability = capStr as Capability
      const workers: Worker[] = []
      for (let i = 0; i < size; i++) {
        workers.push(this.createWorker(capability, i))
      }
      this.pools.set(capability, workers)
    }

    this.initialized = true
    console.log(`[WorkerPool] ✅ 已初始化: ${Object.keys(POOL_SIZES).length} 个池, 共 ${this.totalWorkers()} 个 Worker`)
  }

  /**
   * 获取 Capability 对应的 Worker Pool
   */
  async acquire(capability: Capability): Promise<Worker> {
    if (!this.initialized) await this.init()

    const pool = this.pools.get(capability)
    if (!pool || pool.length === 0) {
      throw new Error(`[WorkerPool] ❌ 未注册 capability="${capability}" 的 Worker Pool`)
    }

    // 简单轮询：返回第一个 Worker（后续替换为负载均衡）
    return pool[0]
  }

  /**
   * 获取 Pool 大小
   */
  poolSize(capability: Capability): number {
    return this.pools.get(capability)?.length || 0
  }

  /**
   * 总 Worker 数
   */
  totalWorkers(): number {
    let total = 0
    for (const workers of this.pools.values()) {
      total += workers.length
    }
    return total
  }

  private createWorker(capability: Capability, index: number): Worker {
    return {
      id: `worker-${capability}-${index}`,
      capability,
      async run(task) {
        // Worker 不持有 Provider 逻辑
        // 从 Registry 获取 Adapter 执行
        let providerName = task.providerConfig?.provider
        if (!providerName) {
          // 无 providerConfig 时自动按 capability 选第一个注册的 provider
          const providers = providerRegistry.getProvidersForCapability(capability)
          if (providers.length > 0) providerName = providers[0].name
        }
        const adapter = providerRegistry.getAdapter(providerName)
        if (!adapter) {
          throw new Error(`[Worker ${capability}] ❌ Provider 未注册: ${providerName || '(none)'} (已注册: ${providerRegistry.listProviders().join(',')})`)
        }

        return adapter.execute({
          providerConfig: { ...task.providerConfig, provider: providerName },
          payload: task.payload,
        })
      },
    }
  }
}
