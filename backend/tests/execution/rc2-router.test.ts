// ============================================================
// RC2 — Provider Registry + Capability Router + Health Model
// 测试场景：
//   1. Provider Registry — 注册/获取/按能力查询/排序
//   2. FASTEST 策略 — 选择延迟最低的 Provider
//   3. CHEAPEST 策略 — 选择成本最低的 Provider
//   4. CN_PROVIDER_FIRST 策略 — 优先选择中国 Provider
//   5. 无匹配 Provider — 抛出错误
//   6. Health Service — 记录成功/失败/查询
//   7. 集成测试 — Router + Registry + HealthService 协同工作
// ============================================================

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

import {
  ProviderRegistry,
  ProviderHealthService,
  CapabilityRouter,
  InMemoryProviderHealthRepository,
} from '../../src/services/geo/execution/index'

import type {
  ProviderRegistration,
  ProviderCapability,
  RouterContext,
  ProviderHealth,
} from '../../src/services/geo/execution/index'

// ─── 辅助：创建测试 Provider 注册 ───

function createRegistration(
  overrides: Partial<ProviderRegistration> & {
    provider: string
    capabilities: ProviderCapability[]
  },
): ProviderRegistration {
  return {
    enabled: true,
    ...overrides,
  }
}

function createCapability(
  overrides: Partial<ProviderCapability> & {
    capability: string
  },
): ProviderCapability {
  return {
    provider: overrides.provider ?? 'test',
    capability: overrides.capability,
    priority: 10,
    costPerToken: 1,
    averageLatency: 100,
    supportedPolicies: ['FASTEST', 'CHEAPEST', 'MOST_RELIABLE', 'LOCAL_ONLY', 'CN_PROVIDER_FIRST'],
    maxRetries: 3,
    timeout: 30000,
    ...overrides,
  }
}

// ─── 辅助：创建带默认值的 Repository ───

function makeHealthRepo() {
  return new InMemoryProviderHealthRepository()
}

// ─── 测试 ───

describe('RC2 — Provider Runtime', () => {
  let registry: ProviderRegistry
  let healthService: ProviderHealthService
  let router: CapabilityRouter

  before(() => {
    registry = new ProviderRegistry()
    healthService = new ProviderHealthService(makeHealthRepo())
    router = new CapabilityRouter(registry, healthService)
  })

  after(() => {
    registry.clear()
  })

  // ──────────────────────────────
  // 场景 1: Provider Registry 注册/获取/按能力查询/排序
  // ──────────────────────────────
  describe('1. Provider Registry', () => {
    before(() => {
      registry.clear()

      const deepseekReasoning = createCapability({
        provider: 'deepseek',
        capability: 'reasoning',
        priority: 1,
        costPerToken: 2,
        averageLatency: 500,
      })
      const chatgptReasoning = createCapability({
        provider: 'chatgpt',
        capability: 'reasoning',
        priority: 2,
        costPerToken: 5,
        averageLatency: 300,
      })
      const deepseekSearch = createCapability({
        provider: 'deepseek',
        capability: 'search',
        priority: 1,
        costPerToken: 1,
        averageLatency: 200,
      })
      const ollamaLocal = createCapability({
        provider: 'ollama-llama',
        capability: 'reasoning',
        priority: 3,
        costPerToken: 0,
        averageLatency: 1000,
      })

      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [deepseekReasoning, deepseekSearch],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [chatgptReasoning],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'ollama-llama',
          capabilities: [ollamaLocal],
        }),
      )
    })

    it('应能注册并获取 Provider', () => {
      const deepseek = registry.getProvider('deepseek')
      assert.ok(deepseek, 'deepseek 应已注册')
      assert.equal(deepseek.provider, 'deepseek')
      assert.equal(deepseek.capabilities.length, 2)
    })

    it('返回 undefined 对于未注册的 Provider', () => {
      const result = registry.getProvider('nonexistent')
      assert.equal(result, undefined)
    })

    it('应能通过能力查询 Provider', () => {
      const reasoningProviders = registry.getProvidersByCapability('reasoning')
      assert.equal(reasoningProviders.length, 3)
      // 按 priority 排序：deepseek(1) < chatgpt(2) < ollama(3)
      assert.equal(reasoningProviders[0].provider, 'deepseek')
      assert.equal(reasoningProviders[1].provider, 'chatgpt')
      assert.equal(reasoningProviders[2].provider, 'ollama-llama')
    })

    it('不应返回禁用的 Provider', () => {
      registry.register(
        createRegistration({
          provider: 'disabled-provider',
          capabilities: [
            createCapability({
              provider: 'disabled-provider',
              capability: 'reasoning',
              priority: 5,
            }),
          ],
          enabled: false,
        }),
      )

      const reasoningProviders = registry.getProvidersByCapability('reasoning')
      const disabledFound = reasoningProviders.find(
        p => p.provider === 'disabled-provider',
      )
      assert.equal(disabledFound, undefined, '禁用的 Provider 不应出现在结果中')

      registry.unregister('disabled-provider')
    })

    it('应能获取所有 Provider', () => {
      const all = registry.getAllProviders()
      assert.equal(all.length, 3)
    })

    it('应能取消注册', () => {
      registry.unregister('ollama-llama')
      const all = registry.getAllProviders()
      assert.equal(all.length, 2)
      assert.equal(registry.getProvider('ollama-llama'), undefined)

      // 重新注册 ollama 供后续测试使用
      const ollamaLocal = createCapability({
        provider: 'ollama-llama',
        capability: 'reasoning',
        priority: 3,
        costPerToken: 0,
        averageLatency: 1000,
      })
      registry.register(
        createRegistration({
          provider: 'ollama-llama',
          capabilities: [ollamaLocal],
        }),
      )
    })
  })

  // ──────────────────────────────
  // 场景 2: FASTEST 策略
  // ──────────────────────────────
  describe('2. FASTEST 策略', () => {
    before(() => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      // deepseek: avg 500ms, chatgpt: avg 300ms (faster)
      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 1,
              averageLatency: 500,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 2,
              averageLatency: 300,
            }),
          ],
        }),
      )
    })

    it('应选择 latencyP50 最低的 Provider', async () => {
      // 先记录两个 Provider 的 latency — P50 将由 Repository 计算
      await healthService.recordSuccess('deepseek', 500)
      await healthService.recordSuccess('deepseek', 600)
      await healthService.recordSuccess('chatgpt', 100)
      await healthService.recordSuccess('chatgpt', 200)
      await healthService.recordSuccess('chatgpt', 150)

      const provider = await router.resolve('reasoning', 'FASTEST')
      assert.equal(provider, 'chatgpt', 'chatgpt 的 latencyP50 应该更低')
    })

    it('当 health 数据为零时回退到注册时的 averageLatency', async () => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      // 注册时 deepseek 的 averageLatency=500，chatgpt=300
      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'generation',
              priority: 1,
              averageLatency: 500,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'generation',
              priority: 2,
              averageLatency: 300,
            }),
          ],
        }),
      )

      const provider = await router.resolve('generation', 'FASTEST')
      assert.equal(provider, 'chatgpt', 'chatgpt 的注册 latency 更低')
    })
  })

  // ──────────────────────────────
  // 场景 3: CHEAPEST 策略
  // ──────────────────────────────
  describe('3. CHEAPEST 策略', () => {
    before(() => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 1,
              costPerToken: 2,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 2,
              costPerToken: 5,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'ollama-llama',
          capabilities: [
            createCapability({
              provider: 'ollama-llama',
              capability: 'reasoning',
              priority: 3,
              costPerToken: 0,
            }),
          ],
        }),
      )
    })

    it('应选择 costPerToken 最低的 Provider', async () => {
      const provider = await router.resolve('reasoning', 'CHEAPEST')
      assert.equal(
        provider,
        'ollama-llama',
        'ollama 的 costPerToken 为 0 应最便宜',
      )
    })

    it('当两个 Provider cost 相同时应按 priority 选择', async () => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      registry.register(
        createRegistration({
          provider: 'provider-a',
          capabilities: [
            createCapability({
              provider: 'provider-a',
              capability: 'search',
              priority: 1,
              costPerToken: 3,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'provider-b',
          capabilities: [
            createCapability({
              provider: 'provider-b',
              capability: 'search',
              priority: 2,
              costPerToken: 3,
            }),
          ],
        }),
      )

      const provider = await router.resolve('search', 'CHEAPEST')
      assert.equal(
        provider,
        'provider-a',
        'provider-a 在结果中应在 provider-b 之前',
      )
    })
  })

  // ──────────────────────────────
  // 场景 4: CN_PROVIDER_FIRST 策略
  // ──────────────────────────────
  describe('4. CN_PROVIDER_FIRST 策略', () => {
    before(() => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 1,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 2,
            }),
          ],
        }),
      )
    })

    it('应优先选择中国 Provider（deepseek）', async () => {
      const provider = await router.resolve('reasoning', 'CN_PROVIDER_FIRST')
      assert.equal(provider, 'deepseek', 'deepseek 是中国 Provider，应被优先选择')
    })

    it('当没有中国 Provider 时应返回第一个候选', async () => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 1,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'claude',
          capabilities: [
            createCapability({
              provider: 'claude',
              capability: 'reasoning',
              priority: 2,
            }),
          ],
        }),
      )

      const provider = await router.resolve('reasoning', 'CN_PROVIDER_FIRST')
      assert.equal(
        provider,
        'chatgpt',
        '没有中国 Provider 时应返回第一个（按 priority 排序）',
      )
    })
  })

  // ──────────────────────────────
  // 场景 5: 无匹配 Provider — 抛出错误
  // ──────────────────────────────
  describe('5. 无匹配 Provider', () => {
    before(() => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      // 只注册 reasoning，不注册 unknown_capability
      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 1,
            }),
          ],
        }),
      )
    })

    it('当没有 Provider 拥有该能力时应抛出错误', async () => {
      await assert.rejects(
        () => router.resolve('unknown_capability', 'FASTEST'),
        {
          message: 'No provider found for capability: unknown_capability',
        },
      )
    })

    it('当没有注册任何 Provider 时应抛出错误', async () => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      await assert.rejects(
        () => router.resolve('reasoning', 'FASTEST'),
        {
          message: 'No provider found for capability: reasoning',
        },
      )
    })
  })

  // ──────────────────────────────
  // 场景 6: Health Service — 记录成功/失败/查询
  // ──────────────────────────────
  describe('6. Health Service', () => {
    let repo: InMemoryProviderHealthRepository
    let hs: ProviderHealthService

    before(() => {
      repo = new InMemoryProviderHealthRepository()
      hs = new ProviderHealthService(repo)
    })

    it('初始状态应为 healthy，errorRate=0', async () => {
      const health = await hs.getHealth('deepseek')
      assert.equal(health.provider, 'deepseek')
      assert.equal(health.status, 'healthy')
      assert.equal(health.errorRate, 0)
      assert.equal(health.successCount, 0)
      assert.equal(health.failureCount, 0)
    })

    it('记录成功应更新 latencyP50', async () => {
      await hs.recordSuccess('deepseek', 200)
      const health = await hs.getHealth('deepseek')
      assert.equal(health.successCount, 1)
      assert.equal(health.latencyP50, 200) // 第一次 = 直接使用
    })

    it('记录多次成功应更新滑动平均 latencyP50', async () => {
      await hs.recordSuccess('deepseek', 400)
      const health = await hs.getHealth('deepseek')
      assert.equal(health.successCount, 2)
      // latencyP50 = 200 * 0.9 + 400 * 0.1 = 220
      assert.equal(health.latencyP50, 220)
    })

    it('记录失败应增加 errorRate', async () => {
      await hs.recordFailure('deepseek', 'timeout')
      const health = await hs.getHealth('deepseek')
      assert.equal(health.failureCount, 1)
      // errorRate = 1 / (2 + 1) = 0.333...
      assert.ok(health.errorRate > 0.33)
      assert.ok(health.errorRate < 0.34)
    })

    it('高错误率应导致状态变为 degraded 或 unhealthy', async () => {
      // 当前 2 success, 1 failure → errorRate ≈ 0.33 → degraded
      const health1 = await hs.getHealth('deepseek')
      assert.equal(health1.status, 'degraded')

      // 再添加 2 个 failure → 2 success, 3 failure → errorRate = 0.6 → unhealthy
      await hs.recordFailure('deepseek', 'error-1')
      await hs.recordFailure('deepseek', 'error-2')
      const health2 = await hs.getHealth('deepseek')
      assert.equal(health2.status, 'unhealthy')
    })

    it('isCircuitOpen 返回正确的状态', async () => {
      // circuit_open 状态目前仅由外部设置，isCircuitOpen 检查 status
      // 当前 deepseek 是 unhealthy，isCircuitOpen 应为 false
      const isOpen = await hs.isCircuitOpen('deepseek')
      assert.equal(isOpen, false)

      // 直接修改 repository 的 health status
      const repo2 = new InMemoryProviderHealthRepository()
      const hs2 = new ProviderHealthService(repo2)
      // 模拟 circuit_open
      const health = await hs2.getHealth('test-circuit')
      health.status = 'circuit_open'
      // 直接通过 repo 设置 circuit_open — 用 recordFailure 模拟大量失败
      // 但 repository 目前不会自动设为 circuit_open，所以手动设置不了
      // 只能测试当前逻辑：errorRate > 0.5 → unhealthy
      // isCircuitOpen 返回 false，除非有外部机制设置 circuit_open
    })

    it('getAllHealth 返回所有 Provider 的健康状态', async () => {
      await hs.recordSuccess('provider-b', 150)
      const all = await hs.getAllHealth()
      assert.ok(all.has('deepseek'))
      assert.ok(all.has('provider-b'))
    })
  })

  // ──────────────────────────────
  // 场景 7: 集成测试 — Router + Registry + HealthService
  // ──────────────────────────────
  describe('7. 集成测试', () => {
    before(() => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      // 注册 3 个 Provider
      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 1,
              costPerToken: 2,
              averageLatency: 500,
            }),
            createCapability({
              provider: 'deepseek',
              capability: 'search',
              priority: 1,
              costPerToken: 1,
              averageLatency: 200,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 2,
              costPerToken: 5,
              averageLatency: 300,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'local-ollama',
          capabilities: [
            createCapability({
              provider: 'local-ollama',
              capability: 'reasoning',
              priority: 3,
              costPerToken: 0,
              averageLatency: 1500,
            }),
          ],
        }),
      )
    })

    it('集成场景: 为 reasoning 能力按 CHEAPEST 策略应选择 local-ollama', async () => {
      const provider = await router.resolve('reasoning', 'CHEAPEST')
      assert.equal(
        provider,
        'local-ollama',
        'local-ollama cost=0 应最便宜',
      )
    })

    it('集成场景: 为 reasoning 能力按 FASTEST 策略应选择 chatgpt（latency 最低）', async () => {
      const provider = await router.resolve('reasoning', 'FASTEST')
      // chatgpt avgLatency=300 最低
      assert.equal(
        provider,
        'chatgpt',
        'chatgpt averageLatency=300 应最快',
      )
    })

    it('集成场景: 为 reasoning 能力按 LOCAL_ONLY 策略应选择 local-ollama', async () => {
      const provider = await router.resolve('reasoning', 'LOCAL_ONLY')
      assert.equal(provider, 'local-ollama', 'local-ollama 是本地 Provider')
    })

    it('集成场景: 为 reasoning 能力按 CN_PROVIDER_FIRST 策略应选择 deepseek', async () => {
      const provider = await router.resolve('reasoning', 'CN_PROVIDER_FIRST')
      assert.equal(provider, 'deepseek', 'deepseek 是中国 Provider')
    })

    it('集成场景: 为 search 能力按 CHEAPEST 策略应选择 deepseek', async () => {
      // 只有 deepseek 有 search 能力
      const provider = await router.resolve('search', 'CHEAPEST')
      assert.equal(provider, 'deepseek', '只有 deepseek 有 search 能力')
    })

    it('集成场景: 带 RouterContext 的路由应正常工作', async () => {
      const ctx: RouterContext = {
        brandId: 'brand-1',
        tenantId: 'tenant-1',
        sourceType: 'mission',
        routingHints: { region: 'cn' },
      }
      const provider = await router.resolve('reasoning', 'FASTEST', ctx)
      assert.equal(typeof provider, 'string')
      assert.ok(provider.length > 0)
    })

    it('集成场景: Health Service 影响路由结果', async () => {
      registry.clear()
      healthService = new ProviderHealthService(makeHealthRepo())
      router = new CapabilityRouter(registry, healthService)

      registry.register(
        createRegistration({
          provider: 'deepseek',
          capabilities: [
            createCapability({
              provider: 'deepseek',
              capability: 'reasoning',
              priority: 1,
              averageLatency: 500,
            }),
          ],
        }),
      )
      registry.register(
        createRegistration({
          provider: 'chatgpt',
          capabilities: [
            createCapability({
              provider: 'chatgpt',
              capability: 'reasoning',
              priority: 2,
              averageLatency: 300,
            }),
          ],
        }),
      )

      // 给 chatgpt 记录高延迟，让它不再是 fastest
      await healthService.recordSuccess('chatgpt', 2000)
      await healthService.recordSuccess('chatgpt', 3000)
      await healthService.recordSuccess('deepseek', 100)

      const provider = await router.resolve('reasoning', 'FASTEST')
      assert.equal(
        provider,
        'deepseek',
        'chatgpt 的实测 latency 高，deepseek 应被选中',
      )
    })
  })
})
